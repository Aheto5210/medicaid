import { apiFetch } from '../api.js';
import { bucketOccupations, bucketRegistrationSources, mapCountsFromPeople } from './dashboardAnalytics.js';
import { buildFullName, buildPersonDisplayName } from './people.js';

const BROWSER_DB_NAME = 'medicaid-local-data';
const BROWSER_DB_VERSION = 1;
const MUTATION_STORE = 'mutations';
const CACHE_STORE = 'cache';
const FALLBACK_STORAGE_KEY = 'medicaid-offline-fallback';
const SQLITE_DB_PATH = 'sqlite:medicaid-offline.db';
const SQLITE_MIGRATION_KEY = 'browser-storage-v1';
export const OFFLINE_SYNC_EVENT = 'medicaid:offline-sync-complete';

const queueListeners = new Set();
let indexedDbPromise = null;
let storageAdapterPromise = null;
let flushInProgress = false;
let syncRuntimeRefs = 0;
let syncIntervalId = null;
let onlineListener = null;

function createEmptyBucket() {
  return { mutations: {}, cache: {} };
}

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

function getFallbackBucket() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createEmptyBucket();
  }

  try {
    const raw = window.localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (!raw) return createEmptyBucket();
    const parsed = JSON.parse(raw);
    return {
      mutations: parsed.mutations || {},
      cache: parsed.cache || {}
    };
  } catch {
    return createEmptyBucket();
  }
}

function setFallbackBucket(bucket) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(bucket));
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getBrowserDb() {
  if (!hasIndexedDb()) return null;
  if (indexedDbPromise) return indexedDbPromise;

  indexedDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(BROWSER_DB_NAME, BROWSER_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MUTATION_STORE)) {
        db.createObjectStore(MUTATION_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return indexedDbPromise;
}

function getRecordKey(record) {
  const recordKey = record?.id ?? record?.key;
  if (recordKey === undefined || recordKey === null) {
    throw new Error('Offline storage record is missing its primary key.');
  }
  return String(recordKey);
}

function parseStoredPayload(payload) {
  if (typeof payload !== 'string') return null;

  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

async function readAllFromBrowserStore(storeName) {
  const db = await getBrowserDb();
  if (!db) {
    const bucket = getFallbackBucket();
    return Object.values(bucket[storeName] || {});
  }

  const tx = db.transaction(storeName, 'readonly');
  return requestToPromise(tx.objectStore(storeName).getAll());
}

async function readOneFromBrowserStore(storeName, key) {
  const db = await getBrowserDb();
  if (!db) {
    const bucket = getFallbackBucket();
    return bucket[storeName]?.[key] || null;
  }

  const tx = db.transaction(storeName, 'readonly');
  return requestToPromise(tx.objectStore(storeName).get(key));
}

async function writeOneToBrowserStore(storeName, record) {
  const db = await getBrowserDb();
  if (!db) {
    const bucket = getFallbackBucket();
    bucket[storeName][getRecordKey(record)] = record;
    setFallbackBucket(bucket);
    return record;
  }

  const tx = db.transaction(storeName, 'readwrite');
  await requestToPromise(tx.objectStore(storeName).put(record));
  return record;
}

async function deleteOneFromBrowserStore(storeName, key) {
  const db = await getBrowserDb();
  if (!db) {
    const bucket = getFallbackBucket();
    delete bucket[storeName][key];
    setFallbackBucket(bucket);
    return;
  }

  const tx = db.transaction(storeName, 'readwrite');
  await requestToPromise(tx.objectStore(storeName).delete(key));
}

function createBrowserStorageAdapter() {
  return {
    type: 'browser',
    readAll: readAllFromBrowserStore,
    readOne: readOneFromBrowserStore,
    writeOne: writeOneToBrowserStore,
    deleteOne: deleteOneFromBrowserStore
  };
}

async function createDesktopSqlStorageAdapter() {
  if (typeof window === 'undefined') return null;

  const { isTauri } = await import('@tauri-apps/api/core');
  if (!isTauri()) {
    return null;
  }

  const { default: Database } = await import('@tauri-apps/plugin-sql');
  const db = await Database.load(SQLITE_DB_PATH);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS offline_records (
      store_name TEXT NOT NULL,
      record_key TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (store_name, record_key)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS offline_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  async function getMetaValue(key) {
    const rows = await db.select(
      'SELECT value FROM offline_meta WHERE key = ? LIMIT 1',
      [key]
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0].value : null;
  }

  async function setMetaValue(key, value) {
    const timestamp = new Date().toISOString();
    await db.execute(
      `
        INSERT INTO offline_meta (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `,
      [key, value, timestamp]
    );
  }

  async function migrateBrowserStorage() {
    const alreadyMigrated = await getMetaValue(SQLITE_MIGRATION_KEY);
    if (alreadyMigrated) return;

    for (const storeName of [MUTATION_STORE, CACHE_STORE]) {
      const mergedRecords = new Map();
      const fallbackRecords = Object.values(getFallbackBucket()[storeName] || {});
      const indexedDbRecords = await readAllFromBrowserStore(storeName).catch(() => []);

      for (const record of fallbackRecords) {
        try {
          mergedRecords.set(getRecordKey(record), record);
        } catch {
          // Skip malformed legacy entries instead of blocking the migration.
        }
      }

      for (const record of indexedDbRecords) {
        try {
          mergedRecords.set(getRecordKey(record), record);
        } catch {
          // Skip malformed legacy entries instead of blocking the migration.
        }
      }

      for (const [recordKey, record] of mergedRecords) {
        await db.execute(
          `
            INSERT INTO offline_records (store_name, record_key, payload, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(store_name, record_key) DO UPDATE SET
              payload = excluded.payload,
              updated_at = excluded.updated_at
          `,
          [storeName, recordKey, JSON.stringify(record), new Date().toISOString()]
        );
      }
    }

    await setMetaValue(SQLITE_MIGRATION_KEY, new Date().toISOString());
  }

  await migrateBrowserStorage();

  return {
    type: 'sqlite',
    async readAll(storeName) {
      const rows = await db.select(
        'SELECT payload FROM offline_records WHERE store_name = ?',
        [storeName]
      );

      if (!Array.isArray(rows)) {
        return [];
      }

      return rows
        .map((row) => parseStoredPayload(row.payload))
        .filter((record) => record !== null);
    },
    async readOne(storeName, key) {
      const rows = await db.select(
        `
          SELECT payload
          FROM offline_records
          WHERE store_name = ? AND record_key = ?
          LIMIT 1
        `,
        [storeName, String(key)]
      );

      if (!Array.isArray(rows) || rows.length === 0) {
        return null;
      }

      return parseStoredPayload(rows[0].payload);
    },
    async writeOne(storeName, record) {
      const recordKey = getRecordKey(record);
      await db.execute(
        `
          INSERT INTO offline_records (store_name, record_key, payload, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(store_name, record_key) DO UPDATE SET
            payload = excluded.payload,
            updated_at = excluded.updated_at
        `,
        [storeName, recordKey, JSON.stringify(record), new Date().toISOString()]
      );
      return record;
    },
    async deleteOne(storeName, key) {
      await db.execute(
        'DELETE FROM offline_records WHERE store_name = ? AND record_key = ?',
        [storeName, String(key)]
      );
    }
  };
}

async function getStorageAdapter() {
  if (!storageAdapterPromise) {
    storageAdapterPromise = createDesktopSqlStorageAdapter().catch((error) => {
      console.warn('Falling back to browser storage for offline data.', error);
      return null;
    }).then((adapter) => adapter || createBrowserStorageAdapter());
  }

  return storageAdapterPromise;
}

async function readAll(storeName) {
  const storage = await getStorageAdapter();
  return storage.readAll(storeName);
}

async function readOne(storeName, key) {
  const storage = await getStorageAdapter();
  return storage.readOne(storeName, key);
}

async function writeOne(storeName, record) {
  const storage = await getStorageAdapter();
  return storage.writeOne(storeName, record);
}

async function deleteOne(storeName, key) {
  const storage = await getStorageAdapter();
  return storage.deleteOne(storeName, key);
}

function normalizeKeyText(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function textIncludes(haystack, needle) {
  return normalizeKeyText(haystack).includes(normalizeKeyText(needle));
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}:${crypto.randomUUID()}`;
  }
  return `${prefix}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

function isLikelyNetworkError(error) {
  if (!error) return false;
  const message = String(error.message || error);
  return error instanceof TypeError
    || /fetch|network|failed|load|offline/i.test(message);
}

async function updateMutationsWithServerId(localId, serverId) {
  if (!localId || !serverId) return;
  const items = await loadPendingMutations();
  for (const item of items) {
    if (item.entityId === localId) {
      const updated = { ...item, entityId: serverId };
      if (item.scope === 'people') {
        updated.path = `/api/people/${serverId}`;
      } else if (item.scope === 'nhis') {
        updated.path = `/api/nhis/${serverId}`;
      }
      await writeOne(MUTATION_STORE, updated);
    }
  }
}

function isNhisReason(value) {
  return normalizeKeyText(value) === 'nhis';
}

function buildPeopleCreateDedupKey(payload = {}) {
  return [
    'people:create',
    normalizeKeyText(payload.firstName),
    normalizeKeyText(payload.lastName),
    normalizeKeyText(payload.age),
    normalizeKeyText(payload.gender),
    normalizeKeyText(payload.addressLine1)
  ].join('|');
}

function buildNhisCreateDedupKey(payload = {}) {
  return [
    'nhis:create',
    normalizeKeyText(payload.fullName),
    normalizeKeyText(payload.amount)
  ].join('|');
}

function formatPersonRow(payload = {}, id, createdAt = nowIso()) {
  return {
    id,
    first_name: payload.firstName || '',
    last_name: payload.lastName || '',
    other_names: payload.otherNames || payload.firstName || '',
    age: payload.age ?? null,
    gender: payload.gender || '',
    phone: payload.phone || '',
    email: payload.email || '',
    occupation: payload.occupation || '',
    registration_source: payload.registrationSource || '',
    reason_for_coming: payload.reasonForComing || '',
    address_line1: payload.addressLine1 || '',
    program_year: payload.programYear || new Date().getFullYear(),
    onboarding_status: payload.onboardingStatus || 'registered',
    registration_date: createdAt,
    __pending: true
  };
}

function formatPersonPatch(current = {}, payload = {}) {
  return {
    ...current,
    first_name: payload.firstName ?? current.first_name ?? '',
    last_name: payload.lastName ?? current.last_name ?? '',
    other_names: payload.otherNames ?? current.other_names ?? payload.firstName ?? current.first_name ?? '',
    age: payload.age ?? current.age ?? null,
    gender: payload.gender ?? current.gender ?? '',
    phone: payload.phone ?? current.phone ?? '',
    email: payload.email ?? current.email ?? '',
    occupation: payload.occupation ?? current.occupation ?? '',
    registration_source: payload.registrationSource ?? current.registration_source ?? '',
    reason_for_coming: payload.reasonForComing ?? current.reason_for_coming ?? '',
    address_line1: payload.addressLine1 ?? current.address_line1 ?? '',
    program_year: payload.programYear ?? current.program_year ?? new Date().getFullYear(),
    onboarding_status: payload.onboardingStatus ?? current.onboarding_status ?? 'registered',
    registration_date: current.registration_date || nowIso(),
    __pending: true
  };
}

function formatNhisRow(payload = {}, id, createdAt = nowIso()) {
  return {
    id,
    full_name: payload.fullName || '',
    situation_case: payload.situationCase || '',
    amount: payload.amount === '' ? null : payload.amount ?? null,
    program_year: payload.programYear || new Date().getFullYear(),
    registration_date: createdAt,
    __pending: true
  };
}

function formatNhisPatch(current = {}, payload = {}) {
  return {
    ...current,
    full_name: payload.fullName ?? current.full_name ?? '',
    situation_case: payload.situationCase ?? current.situation_case ?? '',
    amount: payload.amount === '' ? null : (payload.amount ?? current.amount ?? null),
    program_year: payload.programYear ?? current.program_year ?? new Date().getFullYear(),
    registration_date: current.registration_date || nowIso(),
    __pending: true
  };
}

function sortNewestFirst(items = []) {
  return [...items].sort((a, b) => {
    const left = new Date(b.registration_date || b.createdAt || 0).getTime();
    const right = new Date(a.registration_date || a.createdAt || 0).getTime();
    return left - right;
  });
}

function matchesPeopleSearch(person, search) {
  if (!search) return true;
  return [
    buildPersonDisplayName(person),
    person.phone,
    person.address_line1,
    person.reason_for_coming
  ].some((value) => textIncludes(value, search));
}

function matchesNhisSearch(record, search) {
  if (!search) return true;
  return [record.full_name, record.situation_case].some((value) => textIncludes(value, search));
}

async function emitQueueChange() {
  const items = await loadPendingMutations();
  queueListeners.forEach((listener) => listener(items));
}

function emitSyncComplete(item) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OFFLINE_SYNC_EVENT, { detail: item }));
}

export async function loadPendingMutations() {
  const items = await readAll(MUTATION_STORE);
  return [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function subscribePendingMutations(listener) {
  queueListeners.add(listener);
  void loadPendingMutations().then(listener);
  return () => queueListeners.delete(listener);
}

export async function getCachedValue(key) {
  const record = await readOne(CACHE_STORE, key);
  return record?.value ?? null;
}

export async function setCachedValue(key, value) {
  await writeOne(CACHE_STORE, {
    key,
    value,
    updatedAt: nowIso()
  });
}

export async function removeCachedValue(key) {
  await deleteOne(CACHE_STORE, key);
}

function buildFetchOptions(item) {
  return {
    method: item.method,
    body: item.body ? JSON.stringify(item.body) : undefined
  };
}

function isExpectedQueuedSuccess(response, item) {
  if (response.ok) return true;
  if (item.scope === 'people' && item.action === 'create' && response.status === 409) return true;
  if (item.scope === 'nhis' && item.action === 'create' && response.status === 409) return true;
  if (item.action === 'delete' && response.status === 404) return true;
  return false;
}

async function flushQueuedMutations() {
  if (flushInProgress) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  flushInProgress = true;

  try {
    const items = await loadPendingMutations();

    for (const item of items) {
      try {
        const response = await apiFetch(item.path, buildFetchOptions(item));

        if (isExpectedQueuedSuccess(response, item)) {
          // For CREATE mutations, capture the server's actual ID and update any pending mutations
          if ((item.scope === 'people' || item.scope === 'nhis') && item.action === 'create' && response.ok) {
            try {
              const clone = response.clone();
              const data = await clone.json();
              const serverId = data?.id;
              if (serverId && item.entityId !== serverId) {
                await updateMutationsWithServerId(item.entityId, serverId);
              }
            } catch {
              // Ignore parse errors - proceed with delete
            }
          }
          await deleteOne(MUTATION_STORE, item.id);
          emitSyncComplete(item);
          continue;
        }

        const data = await response.json().catch(() => ({}));
        // If mutation fails with 400 and entityId is a local ID, it can never succeed
        // (server doesn't know about local IDs like "local-person:xxx" or "derived:xxx")
        // Delete it to stop retrying forever
        if (response.status === 400 && item.entityId && (
          String(item.entityId).startsWith('local-') ||
          String(item.entityId).startsWith('derived:')
        )) {
          await deleteOne(MUTATION_STORE, item.id);
          emitSyncComplete(item);
          continue;
        }
        await writeOne(MUTATION_STORE, {
          ...item,
          lastError: data.message || `HTTP ${response.status}`,
          lastAttemptAt: nowIso()
        });
        break;
      } catch (error) {
        if (!isLikelyNetworkError(error)) {
          throw error;
        }

        await writeOne(MUTATION_STORE, {
          ...item,
          lastError: 'Network error',
          lastAttemptAt: nowIso()
        });
        break;
      }
    }
  } finally {
    flushInProgress = false;
    await emitQueueChange();
  }
}

export function startOfflineSyncProcessor() {
  if (typeof window === 'undefined') {
    return () => {};
  }

  syncRuntimeRefs += 1;

  if (syncRuntimeRefs === 1) {
    onlineListener = () => {
      void flushQueuedMutations();
    };

    window.addEventListener('online', onlineListener);
    syncIntervalId = window.setInterval(() => {
      void flushQueuedMutations();
    }, 15000);

    void flushQueuedMutations();
  }

  return () => {
    syncRuntimeRefs = Math.max(0, syncRuntimeRefs - 1);
    if (syncRuntimeRefs > 0) return;

    if (onlineListener) {
      window.removeEventListener('online', onlineListener);
      onlineListener = null;
    }

    if (syncIntervalId) {
      window.clearInterval(syncIntervalId);
      syncIntervalId = null;
    }
  };
}

async function upsertQueuedMutation(nextItem) {
  const items = await loadPendingMutations();
  const now = nowIso();

  if (nextItem.action === 'create') {
    const duplicate = items.find((item) => item.action === 'create' && item.dedupeKey === nextItem.dedupeKey);
    if (duplicate) {
      return duplicate;
    }

    const queued = {
      ...nextItem,
      createdAt: nextItem.createdAt || now,
      updatedAt: now
    };
    await writeOne(MUTATION_STORE, queued);
    await emitQueueChange();
    return queued;
  }

  if (nextItem.action === 'update') {
    const existingCreate = items.find(
      (item) => item.scope === nextItem.scope && item.action === 'create' && item.entityId === nextItem.entityId
    );
    if (existingCreate) {
      const mergedCreate = {
        ...existingCreate,
        body: {
          ...existingCreate.body,
          ...nextItem.body
        },
        optimisticRecord: nextItem.optimisticRecord,
        dedupeKey: nextItem.scope === 'people'
          ? buildPeopleCreateDedupKey({
            ...existingCreate.body,
            ...nextItem.body
          })
          : buildNhisCreateDedupKey({
            ...existingCreate.body,
            ...nextItem.body
          }),
        updatedAt: now
      };
      await writeOne(MUTATION_STORE, mergedCreate);
      await emitQueueChange();
      return mergedCreate;
    }

    const existingUpdate = items.find(
      (item) => item.scope === nextItem.scope && item.action === 'update' && item.entityId === nextItem.entityId
    );
    if (existingUpdate) {
      const mergedUpdate = {
        ...existingUpdate,
        body: {
          ...existingUpdate.body,
          ...nextItem.body
        },
        optimisticRecord: nextItem.optimisticRecord,
        updatedAt: now
      };
      await writeOne(MUTATION_STORE, mergedUpdate);
      await emitQueueChange();
      return mergedUpdate;
    }

    const queued = {
      ...nextItem,
      createdAt: nextItem.createdAt || now,
      updatedAt: now
    };
    await writeOne(MUTATION_STORE, queued);
    await emitQueueChange();
    return queued;
  }

  if (nextItem.action === 'delete') {
    const existingCreate = items.find(
      (item) => item.scope === nextItem.scope && item.action === 'create' && item.entityId === nextItem.entityId
    );
    if (existingCreate) {
      await deleteOne(MUTATION_STORE, existingCreate.id);
      const siblingUpdate = items.find(
        (item) => item.scope === nextItem.scope && item.action === 'update' && item.entityId === nextItem.entityId
      );
      if (siblingUpdate) {
        await deleteOne(MUTATION_STORE, siblingUpdate.id);
      }
      await emitQueueChange();
      return null;
    }

    const existingUpdate = items.find(
      (item) => item.scope === nextItem.scope && item.action === 'update' && item.entityId === nextItem.entityId
    );
    if (existingUpdate) {
      await deleteOne(MUTATION_STORE, existingUpdate.id);
    }

    const existingDelete = items.find(
      (item) => item.scope === nextItem.scope && item.action === 'delete' && item.entityId === nextItem.entityId
    );
    if (existingDelete) {
      return existingDelete;
    }

    const queued = {
      ...nextItem,
      createdAt: nextItem.createdAt || now,
      updatedAt: now
    };
    await writeOne(MUTATION_STORE, queued);
    await emitQueueChange();
    return queued;
  }

  await writeOne(MUTATION_STORE, nextItem);
  await emitQueueChange();
  return nextItem;
}

async function performMutationOrQueue(item) {
  const queuedItem = {
    ...item,
    body: item.body ? { ...item.body, clientRequestId: item.clientRequestId } : null
  };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const stored = await upsertQueuedMutation(queuedItem);
    return { ok: true, queued: true, item: stored };
  }

  try {
    const response = await apiFetch(queuedItem.path, buildFetchOptions(queuedItem));
    if (response.ok) {
      // For CREATE mutations, capture the server's actual ID and update any pending mutations
      if ((item.scope === 'people' || item.scope === 'nhis') && item.action === 'create') {
        try {
          const clone = response.clone();
          const data = await clone.json();
          const serverId = data?.id;
          if (serverId && item.entityId !== serverId) {
            await updateMutationsWithServerId(item.entityId, serverId);
          }
        } catch {
          // Ignore parse errors - proceed with return
        }
      }
      return { ok: true, queued: false, response };
    }
    return { ok: false, queued: false, response };
  } catch (error) {
    if (!isLikelyNetworkError(error)) {
      throw error;
    }

    const stored = await upsertQueuedMutation(queuedItem);
    return { ok: true, queued: true, item: stored };
  }
}

export async function createPersonMutation(payload) {
  const localId = createId('local-person');
  const createdAt = nowIso();
  return performMutationOrQueue({
    id: createId('queue-people-create'),
    scope: 'people',
    action: 'create',
    entityId: localId,
    method: 'POST',
    path: '/api/people',
    body: payload,
    clientRequestId: createId('people-request'),
    dedupeKey: buildPeopleCreateDedupKey(payload),
    optimisticRecord: formatPersonRow(payload, localId, createdAt),
    createdAt
  });
}

export async function updatePersonMutation(entityId, payload, currentPerson) {
  return performMutationOrQueue({
    id: createId('queue-people-update'),
    scope: 'people',
    action: 'update',
    entityId,
    method: 'PATCH',
    path: `/api/people/${entityId}`,
    body: payload,
    clientRequestId: createId('people-request'),
    optimisticRecord: formatPersonPatch(currentPerson, payload)
  });
}

export async function deletePersonMutation(entityId) {
  return performMutationOrQueue({
    id: createId('queue-people-delete'),
    scope: 'people',
    action: 'delete',
    entityId,
    method: 'DELETE',
    path: `/api/people/${entityId}`,
    body: null,
    clientRequestId: createId('people-request')
  });
}

export async function createNhisMutation(payload) {
  const localId = createId('local-nhis');
  const createdAt = nowIso();
  return performMutationOrQueue({
    id: createId('queue-nhis-create'),
    scope: 'nhis',
    action: 'create',
    entityId: localId,
    method: 'POST',
    path: '/api/nhis',
    body: payload,
    clientRequestId: createId('nhis-request'),
    dedupeKey: buildNhisCreateDedupKey(payload),
    optimisticRecord: formatNhisRow(payload, localId, createdAt),
    createdAt
  });
}

export async function updateNhisMutation(entityId, payload, currentRecord) {
  return performMutationOrQueue({
    id: createId('queue-nhis-update'),
    scope: 'nhis',
    action: 'update',
    entityId,
    method: 'PATCH',
    path: `/api/nhis/${entityId}`,
    body: payload,
    clientRequestId: createId('nhis-request'),
    optimisticRecord: formatNhisPatch(currentRecord, payload)
  });
}

export async function deleteNhisMutation(entityId) {
  return performMutationOrQueue({
    id: createId('queue-nhis-delete'),
    scope: 'nhis',
    action: 'delete',
    entityId,
    method: 'DELETE',
    path: `/api/nhis/${entityId}`,
    body: null,
    clientRequestId: createId('nhis-request')
  });
}

export function applyPeopleOfflineMutations(serverPeople = [], mutations = [], options = {}) {
  const year = Number(options.programYear) || new Date().getFullYear();
  const search = options.search || '';
  const rows = [...serverPeople];

  const upsert = (record) => {
    const index = rows.findIndex((item) => item.id === record.id);
    if (index >= 0) {
      rows[index] = { ...rows[index], ...record, __pending: true };
    } else {
      rows.unshift({ ...record, __pending: true });
    }
  };

  for (const item of mutations) {
    if (item.scope !== 'people') continue;

    if (item.action === 'create' && item.optimisticRecord?.program_year === year) {
      upsert(item.optimisticRecord);
      continue;
    }

    if (item.action === 'update') {
      const index = rows.findIndex((entry) => entry.id === item.entityId);
      if (index >= 0) {
        rows[index] = { ...rows[index], ...item.optimisticRecord, __pending: true };
      }
      continue;
    }

    if (item.action === 'delete') {
      const index = rows.findIndex((entry) => entry.id === item.entityId);
      if (index >= 0) {
        rows.splice(index, 1);
      }
    }
  }

  return sortNewestFirst(
    rows.filter((person) => Number(person.program_year) === year && matchesPeopleSearch(person, search))
  );
}

function buildDerivedNhisRecordFromPeopleMutation(item, year) {
  const record = item.optimisticRecord;
  if (!record || Number(record.program_year) !== year) return null;
  if (!isNhisReason(record.reason_for_coming)) return null;

  return {
    id: `derived:${item.id}`,
    full_name: buildFullName(record.first_name || record.other_names || '', record.last_name || ''),
    situation_case: '',
    amount: null,
    program_year: record.program_year,
    registration_date: record.registration_date,
    __pending: true,
    __derivedFrom: item.entityId
  };
}

export function applyNhisOfflineMutations(serverRecords = [], mutations = [], options = {}) {
  const year = Number(options.programYear) || new Date().getFullYear();
  const search = options.search || '';
  const rows = [...serverRecords];

  const upsert = (record) => {
    const index = rows.findIndex((item) => item.id === record.id);
    if (index >= 0) {
      rows[index] = { ...rows[index], ...record, __pending: true };
    } else {
      rows.unshift({ ...record, __pending: true });
    }
  };

  for (const item of mutations) {
    if (item.scope === 'nhis') {
      if (item.action === 'create' && item.optimisticRecord?.program_year === year) {
        upsert(item.optimisticRecord);
        continue;
      }

      if (item.action === 'update') {
        const index = rows.findIndex((entry) => entry.id === item.entityId);
        if (index >= 0) {
          rows[index] = { ...rows[index], ...item.optimisticRecord, __pending: true };
        }
        continue;
      }

      if (item.action === 'delete') {
        const index = rows.findIndex((entry) => entry.id === item.entityId);
        if (index >= 0) {
          rows.splice(index, 1);
        }
      }
    }
  }

  for (const item of mutations) {
    if (item.scope !== 'people') continue;

    if (item.action === 'delete') {
      const index = rows.findIndex((entry) => entry.__derivedFrom === item.entityId);
      if (index >= 0) {
        rows.splice(index, 1);
      }
      continue;
    }

    const derived = buildDerivedNhisRecordFromPeopleMutation(item, year);
    if (!derived) continue;

    const alreadyExists = rows.some((entry) => (
      normalizeKeyText(entry.full_name) === normalizeKeyText(derived.full_name)
      && normalizeKeyText(entry.amount) === normalizeKeyText(derived.amount)
    ));

    if (!alreadyExists) {
      upsert(derived);
    }
  }

  return sortNewestFirst(
    rows.filter((record) => Number(record.program_year) === year && matchesNhisSearch(record, search))
  );
}

export function mapPersonSummaryFromList(people = []) {
  const totals = { people: people.length, onboarded: 0, inReview: 0, newThisWeek: 0 };
  const genderCounts = new Map();
  const reasonCounts = new Map();
  const ageCounts = new Map();
  const now = Date.now();
  const weekAgo = now - (7 * 24 * 60 * 60 * 1000);

  const ageLabels = [
    ['0-17', (age) => age >= 0 && age <= 17],
    ['18-24', (age) => age >= 18 && age <= 24],
    ['25-34', (age) => age >= 25 && age <= 34],
    ['35-44', (age) => age >= 35 && age <= 44],
    ['45-54', (age) => age >= 45 && age <= 54],
    ['55-64', (age) => age >= 55 && age <= 64],
    ['65+', (age) => age >= 65]
  ];

  for (const person of people) {
    const status = normalizeKeyText(person.onboarding_status);
    if (status === 'onboarded') {
      totals.onboarded += 1;
    } else if (!status || ['registered', 'in review', 'in_review', 'approved'].includes(status)) {
      totals.inReview += 1;
    }

    const registeredOn = new Date(person.registration_date || 0).getTime();
    if (registeredOn && registeredOn >= weekAgo) {
      totals.newThisWeek += 1;
    }

    const genderLabel = (person.gender || 'Unknown').trim() || 'Unknown';
    genderCounts.set(genderLabel, (genderCounts.get(genderLabel) || 0) + 1);

    const reasonLabel = (person.reason_for_coming || 'Unknown').trim() || 'Unknown';
    reasonCounts.set(reasonLabel, (reasonCounts.get(reasonLabel) || 0) + 1);

    const numericAge = Number(person.age);
    const matchedAgeLabel = Number.isFinite(numericAge)
      ? ageLabels.find(([, matcher]) => matcher(numericAge))?.[0] || 'Unknown'
      : 'Unknown';
    ageCounts.set(matchedAgeLabel, (ageCounts.get(matchedAgeLabel) || 0) + 1);
  }

  return {
    totals,
    gender: [...genderCounts.entries()].map(([label, value]) => ({ label, value })),
    reasons: [...reasonCounts.entries()].map(([label, value]) => ({ label, value })),
    ageRanges: [...ageCounts.entries()].map(([label, value]) => ({ label, value })),
    registrationSources: bucketRegistrationSources(mapCountsFromPeople(people, 'registration_source')),
    occupations: bucketOccupations(mapCountsFromPeople(people, 'occupation'))
  };
}
