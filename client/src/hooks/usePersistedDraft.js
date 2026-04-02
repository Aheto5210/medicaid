import { useEffect, useRef, useState } from 'react';
import { getCachedValue, removeCachedValue, setCachedValue } from '../utils/offlineData.js';

export default function usePersistedDraft({
  cacheKey,
  initialValue,
  saveDelay = 250,
  restoreValue
}) {
  const [value, setValue] = useState(initialValue);
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);
  const persistenceDisabledRef = useRef(false);

  useEffect(() => {
    let active = true;
    persistenceDisabledRef.current = false;
    setHydrated(false);

    async function loadDraft() {
      try {
        const cachedValue = await getCachedValue(cacheKey);
        if (!active) return;

        if (cachedValue && typeof cachedValue === 'object') {
          setValue(
            typeof restoreValue === 'function'
              ? restoreValue(cachedValue, initialValue)
              : { ...initialValue, ...cachedValue }
          );
          setRestored(true);
        } else {
          setValue(initialValue);
          setRestored(false);
        }
      } catch {
        if (!active) return;
        setValue(initialValue);
        setRestored(false);
      } finally {
        if (active) {
          setHydrated(true);
        }
      }
    }

    loadDraft();

    return () => {
      active = false;
    };
  }, [cacheKey, initialValue, restoreValue]);

  useEffect(() => {
    if (!hydrated || persistenceDisabledRef.current) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      if (persistenceDisabledRef.current) return;
      void setCachedValue(cacheKey, value);
    }, saveDelay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [cacheKey, hydrated, saveDelay, value]);

  async function clearDraft() {
    persistenceDisabledRef.current = true;
    setRestored(false);
    await removeCachedValue(cacheKey);
  }

  return {
    value,
    setValue,
    hydrated,
    restored,
    clearDraft
  };
}
