import express from 'express';
import bcrypt from 'bcryptjs';
import * as xlsx from 'xlsx';
import { query } from '../db.js';
import { requireAuth, requirePermission, requireRole } from '../middleware/auth.js';
import { normalizePermissions } from '../utils/permissions.js';
import { DEFAULT_ROLE, normalizeRoleValue } from '../utils/roles.js';

const router = express.Router();

function toInteger(value) {
  return Number.parseInt(value ?? 0, 10) || 0;
}

function toDecimal(value) {
  return Number.parseFloat(value ?? 0) || 0;
}

function buildDeleteRestriction(row, { currentUserId, adminCount }) {
  const generalRegistrationCount = toInteger(row.general_registration_count);
  const nhisRegistrationCount = toInteger(row.nhis_registration_count);
  const visitCount = toInteger(row.visit_count);
  const hasRecordedActivity = generalRegistrationCount > 0 || nhisRegistrationCount > 0 || visitCount > 0;

  if (row.id === currentUserId) {
    return 'You cannot delete your own account.';
  }

  if (normalizeRoleValue(row.role) === 'admin' && adminCount <= 1) {
    return 'You cannot delete the only remaining admin account.';
  }

  if (hasRecordedActivity) {
    return 'This user has saved records. Disable the account instead to keep the audit history.';
  }

  return null;
}

function mapUser(row, context = {}) {
  const safeRole = normalizeRoleValue(row.role) || DEFAULT_ROLE;
  const generalRegistrationCount = toInteger(row.general_registration_count);
  const nhisRegistrationCount = toInteger(row.nhis_registration_count);
  const visitCount = toInteger(row.visit_count);
  const deleteRestrictionReason = buildDeleteRestriction(row, context);

  return {
    ...row,
    role: safeRole,
    permissions: normalizePermissions(row.permissions, safeRole),
    general_registration_count: generalRegistrationCount,
    nhis_registration_count: nhisRegistrationCount,
    visit_count: visitCount,
    nhis_total_amount: toDecimal(row.nhis_total_amount),
    can_delete: !deleteRestrictionReason,
    delete_restriction_reason: deleteRestrictionReason
  };
}

function slugifyFilename(value, fallback = 'user-records') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

async function getUserRecordCollections(userId) {
  const [generalRegistrationsResult, nhisRegistrationsResult] = await Promise.all([
    query(
      `SELECT
         id,
         TRIM(CONCAT_WS(' ', NULLIF(last_name, ''), NULLIF(first_name, ''), NULLIF(other_names, ''))) AS full_name,
         gender,
         occupation,
         reason_for_coming,
         COALESCE(
           NULLIF(TRIM(CONCAT_WS(', ', NULLIF(address_line1, ''), NULLIF(city, ''))), ''),
           NULLIF(city, ''),
           'Not set'
         ) AS location,
         program_year,
         registration_date,
         created_at
       FROM people
       WHERE created_by = $1
       ORDER BY registration_date DESC, created_at DESC`,
      [userId]
    ),
    query(
      `SELECT
         id,
         full_name,
         situation_case,
         COALESCE(amount, 0)::numeric(12,2) AS amount,
         program_year,
         registration_date,
         created_at
       FROM nhis_registrations
       WHERE created_by = $1
       ORDER BY registration_date DESC, created_at DESC`,
      [userId]
    )
  ]);

  const generalRegistrations = generalRegistrationsResult.rows.map((row) => ({
    ...row,
    full_name: row.full_name || 'Unnamed record'
  }));
  const nhisRegistrations = nhisRegistrationsResult.rows.map((row) => ({
    ...row,
    amount: toDecimal(row.amount)
  }));

  return {
    generalRegistrations,
    nhisRegistrations,
    summary: {
      general_registration_count: generalRegistrations.length,
      nhis_registration_count: nhisRegistrations.length,
      nhis_total_amount: nhisRegistrations.reduce((sum, item) => sum + toDecimal(item.amount), 0)
    }
  };
}

router.use(requireAuth);
router.use(requirePermission('userManagement', 'view'));
router.use(requireRole(['admin']));

router.get('/', async (req, res) => {
  const result = await query(
    `SELECT
       users.id,
       users.full_name,
       users.email,
       users.role,
       users.is_active,
       users.created_at,
       users.last_login_at,
       users.permissions,
       COALESCE(people_activity.general_registration_count, 0)::int AS general_registration_count,
       COALESCE(nhis_activity.nhis_registration_count, 0)::int AS nhis_registration_count,
       COALESCE(visit_activity.visit_count, 0)::int AS visit_count,
       COALESCE(nhis_activity.nhis_total_amount, 0)::numeric(12,2) AS nhis_total_amount
     FROM users
     LEFT JOIN (
       SELECT created_by, COUNT(*) AS general_registration_count
       FROM people
       GROUP BY created_by
     ) AS people_activity ON people_activity.created_by = users.id
     LEFT JOIN (
       SELECT created_by, COUNT(*) AS nhis_registration_count, COALESCE(SUM(amount), 0) AS nhis_total_amount
       FROM nhis_registrations
       GROUP BY created_by
     ) AS nhis_activity ON nhis_activity.created_by = users.id
     LEFT JOIN (
       SELECT created_by, COUNT(*) AS visit_count
       FROM visits
       GROUP BY created_by
     ) AS visit_activity ON visit_activity.created_by = users.id
     ORDER BY users.created_at DESC`
  );

  const adminCount = result.rows.reduce(
    (count, row) => count + (normalizeRoleValue(row.role) === 'admin' ? 1 : 0),
    0
  );

  return res.json(
    result.rows.map((row) => mapUser(row, { currentUserId: req.user.id, adminCount }))
  );
});

router.post('/', async (req, res) => {
  const payload = req.body || {};
  const fullName = String(payload.fullName || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const parsedRole = payload.role === undefined ? null : normalizeRoleValue(payload.role);
  const role = parsedRole || DEFAULT_ROLE;

  if (!fullName || !email || !password) {
    return res.status(400).json({ message: 'fullName, email, and password are required.' });
  }

  if (payload.role !== undefined && !parsedRole) {
    return res.status(400).json({ message: 'Invalid role provided.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }

  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    return res.status(409).json({ message: 'Email already in use.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const permissions = normalizePermissions(payload.permissions, role);
  const isActive = payload.isActive === undefined ? true : Boolean(payload.isActive);

  const insert = await query(
    `INSERT INTO users (full_name, email, password_hash, role, is_active, permissions)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id, full_name, email, role, is_active, created_at, last_login_at, permissions`,
    [fullName, email, passwordHash, role, isActive, JSON.stringify(permissions)]
  );

  return res.status(201).json(mapUser(insert.rows[0], { currentUserId: req.user.id, adminCount: 1 }));
});

router.get('/:id/records', async (req, res) => {
  const { id } = req.params;

  const userResult = await query(
    `SELECT id, full_name, email, role
     FROM users
     WHERE id = $1`,
    [id]
  );

  if (!userResult.rows.length) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const {
    generalRegistrations,
    nhisRegistrations,
    summary
  } = await getUserRecordCollections(id);

  return res.json({
    user: mapUser(userResult.rows[0], { currentUserId: req.user.id, adminCount: 1 }),
    summary,
    general_registrations: generalRegistrations,
    nhis_registrations: nhisRegistrations
  });
});

router.get('/:id/export', async (req, res) => {
  const { id } = req.params;

  const userResult = await query(
    `SELECT id, full_name, email, role
     FROM users
     WHERE id = $1`,
    [id]
  );

  if (!userResult.rows.length) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const userRow = userResult.rows[0];
  const {
    generalRegistrations,
    nhisRegistrations,
    summary
  } = await getUserRecordCollections(id);

  if (!generalRegistrations.length && !nhisRegistrations.length) {
    return res.status(400).json({ message: 'This user has no General or NHIS records to export yet.' });
  }

  const workbook = xlsx.utils.book_new();

  const summarySheet = xlsx.utils.aoa_to_sheet([
    ['User', userRow.full_name || 'Not set'],
    ['Email', userRow.email || 'Not set'],
    ['Role', normalizeRoleValue(userRow.role) || DEFAULT_ROLE],
    ['General Registration Records', summary.general_registration_count],
    ['NHIS Registration Records', summary.nhis_registration_count]
  ]);
  xlsx.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  if (generalRegistrations.length) {
    const generalRows = [
      ['Name', 'Gender', 'Occupation', 'Reason for Coming', 'Location', 'Program Year', 'Registration Date'],
      ...generalRegistrations.map((item) => ([
        item.full_name || '',
        item.gender || '',
        item.occupation || '',
        item.reason_for_coming || '',
        item.location || '',
        item.program_year || '',
        item.registration_date || ''
      ]))
    ];

    const generalSheet = xlsx.utils.aoa_to_sheet(generalRows);
    xlsx.utils.book_append_sheet(workbook, generalSheet, 'General Registration');
  }

  if (nhisRegistrations.length) {
    const nhisRows = [
      ['Name', 'Situation / Case', 'Amount', 'Program Year', 'Registration Date'],
      ...nhisRegistrations.map((item) => ([
        item.full_name || '',
        item.situation_case || '',
        item.amount || 0,
        item.program_year || '',
        item.registration_date || ''
      ]))
    ];

    const nhisSheet = xlsx.utils.aoa_to_sheet(nhisRows);
    xlsx.utils.book_append_sheet(workbook, nhisSheet, 'NHIS Registration');
  }

  const filename = `${slugifyFilename(userRow.full_name || userRow.email)}-records.xlsx`;
  const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(buffer);
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};

  const existingResult = await query(
    'SELECT id, role, permissions FROM users WHERE id = $1',
    [id]
  );

  if (!existingResult.rows.length) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const existing = existingResult.rows[0];
  const existingRole = normalizeRoleValue(existing.role) || DEFAULT_ROLE;
  const requestedRole = payload.role !== undefined ? normalizeRoleValue(payload.role) : null;
  const nextRole = payload.role !== undefined ? requestedRole : existingRole;

  if (id === req.user.id && payload.isActive === false) {
    return res.status(400).json({ message: 'You cannot disable your own account.' });
  }

  if (payload.role !== undefined && !requestedRole) {
    return res.status(400).json({ message: 'Invalid role provided.' });
  }

  if (id === req.user.id && payload.role !== undefined && nextRole !== 'admin') {
    return res.status(400).json({ message: 'You cannot remove your own admin role.' });
  }

  if (id === req.user.id && payload.permissions?.userManagement?.view === false) {
    return res.status(400).json({ message: 'You cannot remove your own User Management access.' });
  }

  const updates = [];
  const values = [];

  if (payload.fullName !== undefined) {
    const fullName = String(payload.fullName || '').trim();
    if (!fullName) {
      return res.status(400).json({ message: 'fullName cannot be empty.' });
    }
    values.push(fullName);
    updates.push(`full_name = $${values.length}`);
  }

  if (payload.email !== undefined) {
    const email = String(payload.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: 'email cannot be empty.' });
    }

    const emailInUse = await query(
      'SELECT id FROM users WHERE email = $1 AND id <> $2',
      [email, id]
    );
    if (emailInUse.rows.length) {
      return res.status(409).json({ message: 'Email already in use.' });
    }

    values.push(email);
    updates.push(`email = $${values.length}`);
  }

  if (payload.role !== undefined) {
    values.push(nextRole);
    updates.push(`role = $${values.length}`);
  }

  if (payload.isActive !== undefined) {
    values.push(Boolean(payload.isActive));
    updates.push(`is_active = $${values.length}`);
  }

  if (payload.password !== undefined) {
    const password = String(payload.password || '');
    if (password && password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      values.push(passwordHash);
      updates.push(`password_hash = $${values.length}`);
    }
  }

  if (payload.permissions !== undefined || payload.role !== undefined) {
    const sourcePermissions = payload.permissions !== undefined
      ? payload.permissions
      : existing.permissions;
    const permissions = normalizePermissions(sourcePermissions, nextRole);
    values.push(JSON.stringify(permissions));
    updates.push(`permissions = $${values.length}::jsonb`);
  }

  if (!updates.length) {
    return res.status(400).json({ message: 'No valid fields provided for update.' });
  }

  values.push(id);
  const result = await query(
    `UPDATE users
     SET ${updates.join(', ')}
     WHERE id = $${values.length}
     RETURNING id, full_name, email, role, is_active, created_at, last_login_at, permissions`,
    values
  );

  const adminCountResult = await query(
    `SELECT COUNT(*)::int AS admin_count
     FROM users
     WHERE role = 'admin'`
  );

  return res.json(
    mapUser(result.rows[0], {
      currentUserId: req.user.id,
      adminCount: toInteger(adminCountResult.rows[0]?.admin_count)
    })
  );
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const existingResult = await query(
    `SELECT id, full_name, email, role
     FROM users
     WHERE id = $1`,
    [id]
  );

  if (!existingResult.rows.length) {
    return res.status(404).json({ message: 'User not found.' });
  }

  if (id === req.user.id) {
    return res.status(400).json({ message: 'You cannot delete your own account.' });
  }

  const existingUser = existingResult.rows[0];

  if (normalizeRoleValue(existingUser.role) === 'admin') {
    const adminCountResult = await query(
      `SELECT COUNT(*)::int AS admin_count
       FROM users
       WHERE role = 'admin'`
    );

    if (toInteger(adminCountResult.rows[0]?.admin_count) <= 1) {
      return res.status(400).json({ message: 'You cannot delete the only remaining admin account.' });
    }
  }

  const linkedRecordsResult = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM people WHERE created_by = $1 OR updated_by = $1) AS people_count,
       (SELECT COUNT(*)::int FROM nhis_registrations WHERE created_by = $1 OR updated_by = $1) AS nhis_count,
       (SELECT COUNT(*)::int FROM visits WHERE created_by = $1) AS visits_count`,
    [id]
  );

  const linkedRecords = linkedRecordsResult.rows[0] || {};
  const peopleCount = toInteger(linkedRecords.people_count);
  const nhisCount = toInteger(linkedRecords.nhis_count);
  const visitsCount = toInteger(linkedRecords.visits_count);

  if (peopleCount > 0 || nhisCount > 0 || visitsCount > 0) {
    return res.status(409).json({
      message: 'This user has saved records. Disable the account instead to keep the audit history.',
      linked_records: {
        general_registration_count: peopleCount,
        nhis_registration_count: nhisCount,
        visit_count: visitsCount
      }
    });
  }

  await query('DELETE FROM users WHERE id = $1', [id]);

  return res.json({ message: 'User deleted successfully.' });
});

export default router;
