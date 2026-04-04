import express from 'express';
import multer from 'multer';
import * as xlsx from 'xlsx';
import { query, withTransaction } from '../db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { peopleUpdateSchema, peopleCreateSchema, validateBody } from '../validation/schemas.js';
import {
  acquireTransactionLock,
  buildStaleRecordMessage,
  getIdempotentResponse,
  normalizeClientRequestId,
  normalizeExpectedUpdatedAt,
  storeIdempotentResponse
} from '../utils/concurrency.js';
import { cleanedText, lowerCaseText, titleCaseText } from '../utils/text.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const TEMPLATE_TITLE = 'GENERAL REGISTRATION';
const TEMPLATE_SUBTITLE = 'EWC COMM25 CAMPUS';
const TEMPLATE_HEADERS = [
  'No.',
  'Name',
  'Age',
  'Sex',
  'Phone No.',
  'Occupation',
  'How did you hear about MEDICAID?',
  'Main Reason for Coming',
  'House No./Address',
  'E-mail Address (if available)'
];
const GENDER_OPTIONS = ['Male', 'Female'];
const HEARD_ABOUT_OPTIONS = [
  'Radio',
  'Other',
  'My child told me',
  'Information van (with megaphones)',
  'On a whatsapp platform',
  'Outreach guys with megaphones',
  'Poster',
  'Influencer (station master/market queen/assembly man)',
  'Church/mosque announcement',
  'Friends/Family (not my child)',
  'Town crier (announcer)'
];
const MAIN_REASON_OPTIONS = [
  'NHIS',
  'General Screening',
  'Counseling',
  'Dental',
  'Other',
  'Eye Screening'
];
const TEMPLATE_COLUMN_WIDTHS = [7, 34, 9, 12, 18, 20, 38, 24, 30, 28];
const DUPLICATE_MESSAGE = 'This data already exists (same name, age, sex, and address).';
const NHIS_REASON = 'nhis';

const NORMALIZED_HEADER_MAP = {
  'no': 'no',
  'no.': 'no',
  'number': 'no',
  'name': 'name',
  'full name': 'name',
  'age': 'age',
  'sex': 'sex',
  'gender': 'sex',
  'phone no': 'phone',
  'phone number': 'phone',
  'phone': 'phone',
  'occupation': 'occupation',
  'how did you hear about medicaid': 'heard',
  'main reason for coming': 'reason',
  'reason for coming': 'reason',
  'house no address': 'address',
  'house no address ': 'address',
  'address': 'address',
  'e mail address if available': 'email',
  'e mail address': 'email',
  'email address if available': 'email',
  'email address': 'email',
  'email': 'email'
};

function normalizeHeader(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function splitFullName(fullName = '') {
  const trimmed = cleanedText(fullName) || '';
  if (!trimmed) {
    return { firstName: '', lastName: '' };
  }
  if (trimmed.includes(',')) {
    const [lastName, firstName] = trimmed.split(',').map((part) => part.trim());
    return {
      firstName: titleCaseText(firstName || lastName || trimmed) || '',
      lastName: titleCaseText(lastName || firstName || trimmed) || ''
    };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    const value = titleCaseText(parts[0]) || '';
    return { firstName: value, lastName: value };
  }
  return {
    firstName: titleCaseText(parts.slice(0, -1).join(' ')) || '',
    lastName: titleCaseText(parts[parts.length - 1]) || ''
  };
}

function normalizeGender(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  if (['m', 'male'].includes(raw)) return 'Male';
  if (['f', 'female'].includes(raw)) return 'Female';
  return null;
}

function parseAge(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildDuplicateKey({ firstName, lastName, age, gender, addressLine1 }) {
  return [
    String(firstName || '').trim().toLowerCase(),
    String(lastName || '').trim().toLowerCase(),
    age === null || age === undefined ? '' : String(age),
    String(gender || '').trim().toLowerCase(),
    String(addressLine1 || '').trim().toLowerCase()
  ].join('|');
}

function getExecutor(executor) {
  return executor || { query };
}

async function findDuplicatePerson({ firstName, lastName, age, gender, addressLine1 }, options = {}, executor) {
  if (!firstName || !lastName) return null;
  const { excludeId = null } = options;
  const params = [firstName, lastName, age ?? null, gender ?? null, addressLine1 ?? null];
  let sql = `
    SELECT id
    FROM people
    WHERE LOWER(BTRIM(first_name)) = LOWER(BTRIM($1))
      AND LOWER(BTRIM(last_name)) = LOWER(BTRIM($2))
      AND age IS NOT DISTINCT FROM $3::integer
      AND LOWER(BTRIM(gender)) IS NOT DISTINCT FROM LOWER(BTRIM($4::text))
      AND LOWER(BTRIM(address_line1)) IS NOT DISTINCT FROM LOWER(BTRIM($5::text))
  `;

  if (excludeId) {
    params.push(excludeId);
    sql += ` AND id <> $${params.length}`;
  }

  sql += ' LIMIT 1';
  const result = await getExecutor(executor).query(sql, params);
  return result.rows[0] || null;
}

function normalizeNhisAmount(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const cleaned = String(value).replace(/[^0-9.-]+/g, '');
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return Number(parsed.toFixed(2));
}

function isNhisReason(value) {
  return String(value || '').trim().toLowerCase() === NHIS_REASON;
}

async function findDuplicateNhisRecord({ fullName, amount }, options = {}, executor) {
  if (!fullName) return null;

  const { excludeId = null } = options;
  const normalizedAmount = normalizeNhisAmount(amount);
  const params = [fullName, normalizedAmount];
  let sql = `
    SELECT id
    FROM nhis_registrations
    WHERE LOWER(BTRIM(full_name)) = LOWER(BTRIM($1))
      AND amount IS NOT DISTINCT FROM $2::numeric
  `;

  if (excludeId) {
    params.push(excludeId);
    sql += ` AND id <> $${params.length}`;
  }

  sql += ' LIMIT 1';
  const result = await getExecutor(executor).query(sql, params);
  return result.rows[0] || null;
}

async function ensureNhisRegistrationFromPerson({ firstName, lastName, amount = null, programYear, userId }, executor) {
  if (!executor) {
    return withTransaction((client) => ensureNhisRegistrationFromPerson(
      { firstName, lastName, amount, programYear, userId },
      client
    ));
  }

  const fullName = titleCaseText(`${firstName || ''} ${lastName || ''}`);
  if (!fullName) return false;

  const dbExecutor = getExecutor(executor);
  await acquireTransactionLock(
    dbExecutor,
    `nhis:dedupe:${String(fullName || '').trim().toLowerCase()}|${normalizeNhisAmount(amount) ?? ''}`
  );

  const duplicate = await findDuplicateNhisRecord({ fullName, amount }, {}, dbExecutor);
  if (duplicate) return false;

  await dbExecutor.query(
    `INSERT INTO nhis_registrations (
      full_name, situation_case, amount, program_year, created_by, updated_by
    )
    VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      fullName,
      null,
      normalizeNhisAmount(amount),
      programYear || new Date().getFullYear(),
      userId,
      userId
    ]
  );

  return true;
}

async function buildWorkbookBuffer({ dataRows = [], prefillCount = 0 }) {
  const normalizedRows = dataRows.map((row) => {
    return Array.from({ length: 10 }, (_, i) => row[i] ?? '');
  });

  if (!normalizedRows.length && prefillCount > 0) {
    for (let index = 1; index <= prefillCount; index += 1) {
      normalizedRows.push([index, '', '', '', '', '', '', '', '', '']);
    }
  }

  try {
    const excelJSImport = await import('exceljs');
    const ExcelJS = excelJSImport.default || excelJSImport;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('General Registration', {
      views: [{
        state: 'frozen',
        ySplit: 4,
        topLeftCell: 'A5',
        zoomScale: 95,
        zoomScaleNormal: 95
      }]
    });

    const optionsSheet = workbook.addWorksheet('Results');
    optionsSheet.state = 'veryHidden';
    optionsSheet.getCell('A1').value = 'Sex';
    GENDER_OPTIONS.forEach((option, index) => {
      optionsSheet.getCell(2 + index, 1).value = option;
    });
    optionsSheet.getCell('B1').value = 'How did you hear about MEDICAID?';
    HEARD_ABOUT_OPTIONS.forEach((option, index) => {
      optionsSheet.getCell(2 + index, 2).value = option;
    });
    optionsSheet.getCell('C1').value = 'Main Reason for Coming';
    MAIN_REASON_OPTIONS.forEach((option, index) => {
      optionsSheet.getCell(2 + index, 3).value = option;
    });

    sheet.columns = TEMPLATE_COLUMN_WIDTHS.map((width) => ({ width }));
    sheet.mergeCells('A1:J1');
    sheet.mergeCells('A2:J2');
    sheet.mergeCells('A3:J3');
    sheet.getCell('A1').value = TEMPLATE_TITLE;
    sheet.getCell('A2').value = TEMPLATE_SUBTITLE;
    sheet.getCell('A3').value = 'Fill one person per row. Use the dropdown fields for Sex, How did you hear about MEDICAID?, and Main Reason for Coming.';
    sheet.addRow(TEMPLATE_HEADERS);
    normalizedRows.forEach((row) => sheet.addRow(row));

    sheet.getRow(1).height = 31;
    sheet.getRow(2).height = 24;
    sheet.getRow(3).height = 30;
    sheet.getRow(4).height = 28;

    sheet.getCell('A1').font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF156082' }
    };

    sheet.getCell('A2').font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF0B2E3A' } };
    sheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell('A2').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDCEFF7' }
    };

    sheet.getCell('A3').font = { name: 'Arial', size: 10, bold: false, color: { argb: 'FF2E4251' } };
    sheet.getCell('A3').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    sheet.getCell('A3').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FBFD' }
    };

    for (let col = 1; col <= 10; col += 1) {
      sheet.getCell(4, col).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E78' }
      };
    }

    const headerRow = sheet.getRow(4);
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF154165' } },
        bottom: { style: 'thin', color: { argb: 'FF154165' } },
        left: { style: 'thin', color: { argb: 'FF154165' } },
        right: { style: 'thin', color: { argb: 'FF154165' } }
      };
    });
    sheet.getCell('B4').alignment = { vertical: 'middle', horizontal: 'left' };

    for (let rowIndex = 5; rowIndex <= sheet.rowCount; rowIndex += 1) {
      const row = sheet.getRow(rowIndex);
      row.height = row.height || 22;

      for (let colNumber = 1; colNumber <= 10; colNumber += 1) {
        const cell = row.getCell(colNumber);
        cell.font = { name: 'Arial', size: 11 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 1 || colNumber === 3 || colNumber === 4 ? 'center' : 'left',
          wrapText: colNumber >= 7
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowIndex % 2 === 0 ? 'FFF7FBFE' : 'FFFFFFFF' }
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFBFC9D1' } },
          bottom: { style: 'thin', color: { argb: 'FFBFC9D1' } },
          left: { style: 'thin', color: { argb: 'FFBFC9D1' } },
          right: { style: 'thin', color: { argb: 'FFBFC9D1' } }
        };
      }

      sheet.getCell(rowIndex, 4).dataValidation = {
        type: 'list',
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: 'Invalid Option',
        error: 'Please select Male or Female.',
        formulae: [`=Results!$A$2:$A$${1 + GENDER_OPTIONS.length}`]
      };
      sheet.getCell(rowIndex, 7).dataValidation = {
        type: 'list',
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: 'Invalid Option',
        error: 'Please select a value from the dropdown list.',
        formulae: [`=Results!$B$2:$B$${1 + HEARD_ABOUT_OPTIONS.length}`]
      };
      sheet.getCell(rowIndex, 8).dataValidation = {
        type: 'list',
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: 'Invalid Option',
        error: 'Please select a value from the dropdown list.',
        formulae: [`=Results!$C$2:$C$${1 + MAIN_REASON_OPTIONS.length}`]
      };
    }

    sheet.autoFilter = { from: 'A4', to: 'J4' };
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    const wb = xlsx.utils.book_new();
    const rows = [
      [TEMPLATE_TITLE],
      [TEMPLATE_SUBTITLE],
      ['Fill one person per row. Use dropdown lists where provided.'],
      [...TEMPLATE_HEADERS],
      ...normalizedRows
    ];
    const ws = xlsx.utils.aoa_to_sheet(rows);
    ws['!cols'] = TEMPLATE_COLUMN_WIDTHS.map((width) => ({ wch: width }));
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } }
    ];
    xlsx.utils.book_append_sheet(wb, ws, 'General Registration');
    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}

router.use(requireAuth);

router.get('/', requirePermission('generalRegistration', 'view'), async (req, res) => {
  const { search, status, year } = req.query || {};
  const params = [];
  const where = [];
  const programYear = Number.parseInt(year, 10) || new Date().getFullYear();

  if (search) {
    params.push(`%${search}%`);
    where.push(`(first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR phone ILIKE $${params.length})`);
  }

  if (status) {
    params.push(status);
    where.push(`onboarding_status = $${params.length}`);
  }

  params.push(programYear);
  where.push(`program_year = $${params.length}`);

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const result = await query(
    `SELECT id, first_name, last_name, gender, age, phone, email, occupation, registration_source,
            reason_for_coming, address_line1, city, region, onboarding_status, registration_date, program_year
     FROM people
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT 200`,
    params
  );

  return res.json(result.rows);
});

router.get('/template', requirePermission('generalRegistration', 'view'), async (req, res) => {
  const buffer = await buildWorkbookBuffer({ prefillCount: 99 });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="ewccomm25-registration-template.xlsx"');
  return res.send(buffer);
});

router.post('/import', requirePermission('generalRegistration', 'import'), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const programYear = Number.parseInt(req.body?.year, 10) || new Date().getFullYear();
  const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });

  const headerIndex = rows.findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    return normalized.includes('name') && (normalized.includes('sex') || normalized.includes('gender'));
  });

  if (headerIndex === -1) {
    return res.status(400).json({ message: 'Could not find header row in the uploaded sheet.' });
  }

  const headerRow = rows[headerIndex];
  const columnIndex = {};
  headerRow.forEach((cell, index) => {
    const normalized = normalizeHeader(cell);
    const key = NORMALIZED_HEADER_MAP[normalized];
    if (key) {
      columnIndex[key] = index;
    }
  });

  const records = [];
  let skipped = 0;
  let duplicates = 0;

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    const nameCell = row[columnIndex.name];
    if (!String(nameCell || '').trim()) {
      skipped += 1;
      continue;
    }

    const { firstName, lastName } = splitFullName(nameCell);
    const age = parseAge(row[columnIndex.age]);

    records.push({
      firstName,
      lastName,
      age,
      gender: normalizeGender(row[columnIndex.sex]),
      phone: cleanedText(row[columnIndex.phone]),
      occupation: titleCaseText(row[columnIndex.occupation]),
      registrationSource: titleCaseText(row[columnIndex.heard]),
      reasonForComing: titleCaseText(row[columnIndex.reason]),
      addressLine1: titleCaseText(row[columnIndex.address]),
      email: lowerCaseText(row[columnIndex.email])
    });
  }

  if (!records.length) {
    return res.status(400).json({ message: 'No valid registration rows found in the sheet.' });
  }

  const dedupedRecords = [];
  const seenKeys = new Set();
  for (const record of records) {
    const dedupeKey = buildDuplicateKey(record);
    if (seenKeys.has(dedupeKey)) {
      skipped += 1;
      duplicates += 1;
      continue;
    }
    seenKeys.add(dedupeKey);

    const existing = await findDuplicatePerson(record);
    if (existing) {
      skipped += 1;
      duplicates += 1;
      continue;
    }

    dedupedRecords.push(record);
  }

  if (!dedupedRecords.length) {
    return res.status(409).json({
      message: DUPLICATE_MESSAGE,
      inserted: 0,
      skipped,
      duplicates
    });
  }

  const columns = [
    'first_name',
    'last_name',
    'age',
    'gender',
    'phone',
    'email',
    'occupation',
    'registration_source',
    'reason_for_coming',
    'address_line1',
    'program_year',
    'onboarding_status',
    'created_by',
    'updated_by'
  ];

  const values = [];
  const placeholders = dedupedRecords.map((record, index) => {
    const offset = index * columns.length;
    values.push(
      record.firstName,
      record.lastName,
      record.age,
      record.gender,
      record.phone,
      record.email,
      record.occupation,
      record.registrationSource,
      record.reasonForComing,
      record.addressLine1,
      programYear,
      'registered',
      req.user.id,
      req.user.id
    );
    const tokens = columns.map((_, columnIndex) => `$${offset + columnIndex + 1}`);
    return `(${tokens.join(',')})`;
  });

  await query(
    `INSERT INTO people (${columns.join(', ')})
     VALUES ${placeholders.join(', ')}`,
    values
  );

  for (const record of dedupedRecords) {
    if (!isNhisReason(record.reasonForComing)) continue;
    await ensureNhisRegistrationFromPerson({
      firstName: record.firstName,
      lastName: record.lastName,
      programYear,
      userId: req.user.id
    });
  }

  return res.json({ inserted: dedupedRecords.length, skipped, duplicates });
});

router.get('/export', requirePermission('generalRegistration', 'export'), async (req, res) => {
  const {
    name,
    gender,
    location,
    reason,
    year
  } = req.query || {};

  const params = [];
  const where = [];

  if (name) {
    params.push(`%${name}%`);
    where.push(`(first_name ILIKE $${params.length} OR last_name ILIKE $${params.length})`);
  }

  if (gender) {
    params.push(gender);
    where.push(`LOWER(gender) = LOWER($${params.length})`);
  }

  if (location) {
    params.push(`%${location}%`);
    where.push(`(address_line1 ILIKE $${params.length} OR city ILIKE $${params.length} OR region ILIKE $${params.length})`);
  }

  if (reason) {
    params.push(reason);
    where.push(`LOWER(reason_for_coming) = LOWER($${params.length})`);
  }

  if (year) {
    params.push(Number.parseInt(year, 10));
    where.push(`program_year = $${params.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const result = await query(
    `SELECT first_name, last_name, age, gender, phone, occupation, registration_source,
            reason_for_coming, address_line1, email
     FROM people
     ${whereClause}
     ORDER BY registration_date DESC`,
    params
  );

  const rows = [
    ...result.rows.map((person, index) => ([
      index + 1,
      `${person.first_name} ${person.last_name}`.trim(),
      person.age || '',
      person.gender || '',
      person.phone || '',
      person.occupation || '',
      person.registration_source || '',
      person.reason_for_coming || '',
      person.address_line1 || '',
      person.email || ''
    ]))
  ];
  const buffer = await buildWorkbookBuffer({ dataRows: rows });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="ewccomm25-registrations.xlsx"');
  return res.send(buffer);
});

router.post('/', requirePermission('generalRegistration', 'create'), validateBody(peopleCreateSchema), async (req, res) => {
  const payload = req.body;
  const firstName = titleCaseText(payload.firstName);
  const lastName = titleCaseText(payload.lastName);
  const age = parseAge(payload.age);
  const gender = normalizeGender(payload.gender);
  const addressLine1 = titleCaseText(payload.addressLine1);
  const reasonForComing = titleCaseText(payload.reasonForComing);

  if (payload.age !== undefined && payload.age !== null && String(payload.age).trim() !== '' && age === null) {
    return res.status(400).json({ message: 'Age must be a valid number.' });
  }

  const duplicate = await findDuplicatePerson({
    firstName,
    lastName,
    age,
    gender,
    addressLine1
  });
  if (duplicate) {
    return res.status(409).json({ message: DUPLICATE_MESSAGE });
  }

  const programYear = payload.programYear || new Date().getFullYear();
  const clientRequestId = normalizeClientRequestId(payload.clientRequestId);
  const createScope = 'people:create';
  const duplicateKey = buildDuplicateKey({
    firstName,
    lastName,
    age,
    gender,
    addressLine1
  });

  const outcome = await withTransaction(async (client) => {
    if (clientRequestId) {
      await acquireTransactionLock(client, `${createScope}:request:${clientRequestId}`);
      const existingResponse = await getIdempotentResponse(client, createScope, clientRequestId);
      if (existingResponse) {
        return { replay: existingResponse };
      }
    }

    await acquireTransactionLock(client, `${createScope}:dedupe:${duplicateKey}`);

    const duplicate = await findDuplicatePerson({
      firstName,
      lastName,
      age,
      gender,
      addressLine1
    }, {}, client);
    if (duplicate) {
      return { duplicate: true };
    }

    const result = await client.query(
      `INSERT INTO people (
        first_name, last_name, other_names, dob, age, gender, phone, email,
        address_line1, address_line2, city, region, country, nationality,
        id_type, id_number, emergency_name, emergency_phone, registration_source,
        occupation, reason_for_coming, program_year, onboarding_status, notes, created_by, updated_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,
        $9,$10,$11,$12,$13,$14,
        $15,$16,$17,$18,$19,
        $20,$21,$22,$23,$24,$25,$26
      )
      RETURNING *`,
      [
        firstName,
        lastName,
        titleCaseText(payload.otherNames),
        payload.dob || null,
        age,
        gender,
        cleanedText(payload.phone),
        lowerCaseText(payload.email),
        addressLine1,
        titleCaseText(payload.addressLine2),
        titleCaseText(payload.city),
        titleCaseText(payload.region),
        titleCaseText(payload.country) || 'Ghana',
        titleCaseText(payload.nationality),
        titleCaseText(payload.idType),
        cleanedText(payload.idNumber),
        titleCaseText(payload.emergencyName),
        cleanedText(payload.emergencyPhone),
        titleCaseText(payload.registrationSource),
        titleCaseText(payload.occupation),
        reasonForComing,
        programYear,
        payload.onboardingStatus || 'registered',
        cleanedText(payload.notes),
        req.user.id,
        req.user.id
      ]
    );

    if (isNhisReason(reasonForComing)) {
      await ensureNhisRegistrationFromPerson({
        firstName,
        lastName,
        programYear,
        userId: req.user.id
      }, client);
    }

    const createdPerson = result.rows[0];

    if (clientRequestId) {
      await storeIdempotentResponse(client, createScope, clientRequestId, 201, createdPerson);
    }

    return { created: createdPerson };
  });

  if (outcome.replay) {
    return res.status(outcome.replay.status).json(outcome.replay.body);
  }

  if (outcome.duplicate) {
    return res.status(409).json({ message: DUPLICATE_MESSAGE });
  }

  return res.status(201).json(outcome.created);
});

router.get('/:id', requirePermission('generalRegistration', 'view'), async (req, res) => {
  const { id } = req.params;
  const result = await query('SELECT * FROM people WHERE id = $1', [id]);

  if (!result.rows.length) {
    return res.status(404).json({ message: 'Person not found' });
  }

  return res.json(result.rows[0]);
});

router.patch('/:id', requirePermission('generalRegistration', 'edit'), validateBody(peopleUpdateSchema), async (req, res) => {
  const { id } = req.params;
  const payload = req.body;
  const firstNameInput = payload.firstName !== undefined ? titleCaseText(payload.firstName) : null;
  const lastNameInput = payload.lastName !== undefined ? titleCaseText(payload.lastName) : null;
  const ageInput = payload.age !== undefined ? parseAge(payload.age) : null;
  const genderInput = payload.gender !== undefined ? normalizeGender(payload.gender) : null;
  const addressLine1Input = payload.addressLine1 !== undefined ? titleCaseText(payload.addressLine1) : null;
  const reasonForComingInput = payload.reasonForComing !== undefined ? titleCaseText(payload.reasonForComing) : null;
  const expectedUpdatedAt = payload.expectedUpdatedAt === undefined
    ? null
    : normalizeExpectedUpdatedAt(payload.expectedUpdatedAt);
  const hasIdentityFieldUpdate = ['firstName', 'lastName', 'age', 'gender', 'addressLine1']
    .some((field) => payload[field] !== undefined);

  if (payload.expectedUpdatedAt !== undefined && !expectedUpdatedAt) {
    return res.status(400).json({ message: 'expectedUpdatedAt must be a valid timestamp.' });
  }

  if (payload.age !== undefined && payload.age !== null && String(payload.age).trim() !== '' && ageInput === null) {
    return res.status(400).json({ message: 'Age must be a valid number.' });
  }

  const outcome = await withTransaction(async (client) => {
    const currentRecord = await client.query(
      `SELECT id, first_name, last_name, age, gender, address_line1,
              reason_for_coming, program_year, updated_at
       FROM people
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (!currentRecord.rows.length) {
      return { missing: true };
    }

    const current = currentRecord.rows[0];
    const currentUpdatedAt = new Date(current.updated_at).toISOString();

    if (expectedUpdatedAt && currentUpdatedAt !== expectedUpdatedAt) {
      return {
        stale: true,
        message: buildStaleRecordMessage('person record')
      };
    }

    if (hasIdentityFieldUpdate) {
      const nextDuplicateKey = buildDuplicateKey({
        firstName: firstNameInput ?? current.first_name,
        lastName: lastNameInput ?? current.last_name,
        age: ageInput ?? current.age,
        gender: genderInput ?? current.gender,
        addressLine1: addressLine1Input ?? current.address_line1
      });

      await acquireTransactionLock(client, `people:update:dedupe:${nextDuplicateKey}`);

      const duplicate = await findDuplicatePerson({
        firstName: firstNameInput ?? current.first_name,
        lastName: lastNameInput ?? current.last_name,
        age: ageInput ?? current.age,
        gender: genderInput ?? current.gender,
        addressLine1: addressLine1Input ?? current.address_line1
      }, { excludeId: id }, client);
      if (duplicate) {
        return { duplicate: true };
      }
    }

    const result = await client.query(
      `UPDATE people SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        other_names = COALESCE($3, other_names),
        dob = COALESCE($4, dob),
        age = COALESCE($5, age),
        gender = COALESCE($6, gender),
        phone = COALESCE($7, phone),
        email = COALESCE($8, email),
        address_line1 = COALESCE($9, address_line1),
        address_line2 = COALESCE($10, address_line2),
        city = COALESCE($11, city),
        region = COALESCE($12, region),
        country = COALESCE($13, country),
        nationality = COALESCE($14, nationality),
        id_type = COALESCE($15, id_type),
        id_number = COALESCE($16, id_number),
        emergency_name = COALESCE($17, emergency_name),
        emergency_phone = COALESCE($18, emergency_phone),
        registration_source = COALESCE($19, registration_source),
        occupation = COALESCE($20, occupation),
        reason_for_coming = COALESCE($21, reason_for_coming),
        program_year = COALESCE($22, program_year),
        onboarding_status = COALESCE($23, onboarding_status),
        onboarding_date = COALESCE($24, onboarding_date),
        notes = COALESCE($25, notes),
        updated_by = $26
       WHERE id = $27
       RETURNING *`,
      [
        firstNameInput,
        lastNameInput,
        titleCaseText(payload.otherNames),
        payload.dob || null,
        ageInput,
        genderInput,
        cleanedText(payload.phone),
        lowerCaseText(payload.email),
        addressLine1Input,
        titleCaseText(payload.addressLine2),
        titleCaseText(payload.city),
        titleCaseText(payload.region),
        titleCaseText(payload.country),
        titleCaseText(payload.nationality),
        titleCaseText(payload.idType),
        cleanedText(payload.idNumber),
        titleCaseText(payload.emergencyName),
        cleanedText(payload.emergencyPhone),
        titleCaseText(payload.registrationSource),
        titleCaseText(payload.occupation),
        reasonForComingInput,
        payload.programYear || null,
        payload.onboardingStatus || null,
        payload.onboardingDate || null,
        cleanedText(payload.notes),
        req.user.id,
        id
      ]
    );

    const updatedPerson = result.rows[0];
    const nextReasonForComing = reasonForComingInput ?? current.reason_for_coming;
    if (isNhisReason(nextReasonForComing)) {
      await ensureNhisRegistrationFromPerson({
        firstName: firstNameInput ?? current.first_name,
        lastName: lastNameInput ?? current.last_name,
        programYear: payload.programYear || current.program_year,
        userId: req.user.id
      }, client);
    }

    return { updated: updatedPerson };
  });

  if (outcome.error) {
    return res.status(outcome.status || 500).json({ message: outcome.message });
  }

  if (outcome.missing) {
    return res.status(404).json({ message: 'Person not found' });
  }

  if (outcome.stale) {
    return res.status(409).json({ code: 'stale_record', message: outcome.message });
  }

  if (outcome.duplicate) {
    return res.status(409).json({ message: DUPLICATE_MESSAGE });
  }

  return res.json(outcome.updated);
});

router.delete('/:id', requirePermission('generalRegistration', 'delete'), async (req, res) => {
  const { id } = req.params;
  const result = await query('DELETE FROM people WHERE id = $1 RETURNING id', [id]);

  if (!result.rows.length) {
    return res.status(404).json({ message: 'Person not found' });
  }

  return res.json({ success: true, id: result.rows[0].id });
});

router.post('/:id/onboard', requirePermission('generalRegistration', 'edit'), async (req, res) => {
  const { id } = req.params;
  const { status, onboardingDate, notes } = req.body || {};

  const result = await query(
    `UPDATE people SET onboarding_status = $1,
        onboarding_date = COALESCE($2, onboarding_date),
        notes = COALESCE($3, notes),
        updated_by = $4
     WHERE id = $5
     RETURNING id, first_name, last_name, onboarding_status, onboarding_date`,
    [status || 'onboarded', onboardingDate || new Date().toISOString().slice(0, 10), notes || null, req.user.id, id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ message: 'Person not found' });
  }

  return res.json(result.rows[0]);
});

router.get('/:id/visits', requirePermission('generalRegistration', 'view'), async (req, res) => {
  const { id } = req.params;
  const result = await query(
    `SELECT id, visit_date, complaint, diagnosis, treatment, provider_name, outcome, follow_up_date, notes
     FROM visits WHERE person_id = $1 ORDER BY visit_date DESC`,
    [id]
  );

  return res.json(result.rows);
});

router.post('/:id/visits', requirePermission('generalRegistration', 'edit'), async (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};

  const result = await query(
    `INSERT INTO visits (person_id, visit_date, complaint, diagnosis, treatment, provider_name, outcome, follow_up_date, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, visit_date, complaint, diagnosis, treatment, provider_name, outcome, follow_up_date, notes`,
    [
      id,
      payload.visitDate || new Date().toISOString().slice(0, 10),
      titleCaseText(payload.complaint),
      titleCaseText(payload.diagnosis),
      titleCaseText(payload.treatment),
      titleCaseText(payload.providerName),
      titleCaseText(payload.outcome),
      payload.followUpDate || null,
      cleanedText(payload.notes),
      req.user.id
    ]
  );

  return res.status(201).json(result.rows[0]);
});

export default router;
