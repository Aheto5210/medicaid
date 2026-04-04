import express from 'express';
import multer from 'multer';
import * as xlsx from 'xlsx';
import { query, withTransaction } from '../db.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  acquireTransactionLock,
  buildStaleRecordMessage,
  getIdempotentResponse,
  normalizeClientRequestId,
  normalizeExpectedUpdatedAt,
  storeIdempotentResponse
} from '../utils/concurrency.js';
import { titleCaseText } from '../utils/text.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const TEMPLATE_TITLE = 'NHIS REGISTRATION';
const TEMPLATE_SUBTITLE = 'EWC COMMUNITY 25 CAMPUS';
const TEMPLATE_HEADERS = ['', 'No.', 'Name', 'Situation/Case', 'Amount (GHS)'];
const TEMPLATE_COLUMN_WIDTHS = [4, 8, 34, 38, 18];
const HEADER_START_ROW = 6;
const DATA_START_ROW = 8;
const NHIS_DUPLICATE_MESSAGE = 'This NHIS data already exists (same name and amount).';
const NHIS_SITUATION_CASE_OPTIONS = [
  'New Registration for Adults (18yrs and above)',
  'Renewal for Adults',
  'New Registration for Adults (18yrs and below)',
  'Renewal for below 18yrs',
  'New Registration (with SNNIT ID)',
  'Renewal (with SNNIT ID)',
  'Aged (above 70yrs)',
  'Evidence of pregnancy'
];

const NORMALIZED_HEADER_MAP = {
  no: 'no',
  'no.': 'no',
  number: 'no',
  name: 'name',
  fullname: 'name',
  'full name': 'name',
  'situation case': 'situation',
  'situation/case': 'situation',
  situation: 'situation',
  case: 'situation',
  amount: 'amount',
  'amount ghs': 'amount'
};

function normalizeHeader(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9/]+/g, ' ')
    .trim();
}

function parseProgramYear(value, fallback = new Date().getFullYear()) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseAmount(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }

  const cleaned = String(value).replace(/[^0-9.-]+/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatAmountForSheet(value) {
  const amount = parseAmount(value);
  if (amount === null) return '';
  return Number(amount.toFixed(2));
}

function normalizeAmountKey(value) {
  const amount = parseAmount(value);
  return amount === null ? '' : amount.toFixed(2);
}

function buildNhisDuplicateKey({ fullName, amount }) {
  return [
    String(fullName || '').trim().toLowerCase(),
    normalizeAmountKey(amount)
  ].join('|');
}

async function findDuplicateNhisRecord({ fullName, amount }, options = {}) {
  if (!fullName) return null;

  const { excludeId = null } = options;
  const normalizedAmount = parseAmount(amount);
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
  const result = await (options.executor || { query }).query(sql, params);
  return result.rows[0] || null;
}

async function buildWorkbookBuffer({ dataRows = [], prefillCount = 0, showOptionsSheet = false }) {
  const normalizedRows = dataRows.map((row) => (
    Array.from({ length: 5 }, (_, index) => row[index] ?? '')
  ));

  if (!normalizedRows.length && prefillCount > 0) {
    for (let index = 1; index <= prefillCount; index += 1) {
      normalizedRows.push(['', index, '', '', '']);
    }
  }

  try {
    const excelJSImport = await import('exceljs');
    const ExcelJS = excelJSImport.default || excelJSImport;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('NHIS', {
      views: [{
        state: 'frozen',
        ySplit: DATA_START_ROW - 1,
        topLeftCell: `B${DATA_START_ROW}`
      }]
    });

    sheet.columns = TEMPLATE_COLUMN_WIDTHS.map((width) => ({ width }));

    const optionsSheet = workbook.addWorksheet('Options');
    if (!showOptionsSheet) {
      optionsSheet.state = 'veryHidden';
    }
    NHIS_SITUATION_CASE_OPTIONS.forEach((option, index) => {
      optionsSheet.getCell(index + 1, 1).value = option;
    });

    sheet.mergeCells('B1:E1');
    sheet.mergeCells('A2:E2');
    sheet.getCell('A1').value = '+';
    sheet.getCell('B1').value = TEMPLATE_TITLE;
    sheet.getCell('A2').value = TEMPLATE_SUBTITLE;
    sheet.getCell('D4').value = 'Total Amount (GHS)';

    const totalStart = DATA_START_ROW;
    const totalEnd = DATA_START_ROW + normalizedRows.length - 1;
    if (totalEnd >= totalStart) {
      sheet.getCell('E4').value = { formula: `SUM(E${totalStart}:E${totalEnd})` };
    } else {
      sheet.getCell('E4').value = 0;
    }

    for (let col = 1; col <= TEMPLATE_HEADERS.length; col += 1) {
      sheet.getCell(HEADER_START_ROW, col).value = TEMPLATE_HEADERS[col - 1];
    }

    normalizedRows.forEach((row, index) => {
      const rowNumber = DATA_START_ROW + index;
      row.forEach((cellValue, cellIndex) => {
        const cell = sheet.getCell(rowNumber, cellIndex + 1);
        cell.value = cellValue;
      });
    });

    sheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true };
    sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell('B1').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('B1').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell('B1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF156082' }
    };
    sheet.getCell('A2').font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF0B2E3A' } };
    sheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell('A2').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDCEFF7' }
    };
    if (showOptionsSheet) {
      sheet.getCell('D7').value = 'Use dropdown. See "Options" sheet for all Situation/Case values.';
      sheet.getCell('D7').font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF5A6A70' } };
      sheet.getCell('D7').alignment = { vertical: 'middle', horizontal: 'left' };
    }

    sheet.getCell('D4').font = { name: 'Arial', size: 11, bold: true };
    sheet.getCell('E4').font = { name: 'Arial', size: 11, bold: true };
    sheet.getCell('D4').alignment = { vertical: 'middle', horizontal: 'right' };
    sheet.getCell('E4').alignment = { vertical: 'middle', horizontal: 'right' };
    sheet.getCell('E4').numFmt = '#,##0.00';

    const headerRow = sheet.getRow(HEADER_START_ROW);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E78' }
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF154165' } },
        bottom: { style: 'thin', color: { argb: 'FF154165' } },
        left: { style: 'thin', color: { argb: 'FF154165' } },
        right: { style: 'thin', color: { argb: 'FF154165' } }
      };
    });
    sheet.getCell(HEADER_START_ROW, 3).alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getCell(HEADER_START_ROW, 4).alignment = { vertical: 'middle', horizontal: 'left' };

    for (let rowIndex = DATA_START_ROW; rowIndex < DATA_START_ROW + normalizedRows.length; rowIndex += 1) {
      for (let colIndex = 1; colIndex <= TEMPLATE_HEADERS.length; colIndex += 1) {
        const cell = sheet.getCell(rowIndex, colIndex);
        cell.font = { name: 'Arial', size: 11 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colIndex === 2 ? 'center' : (colIndex === 5 ? 'right' : 'left'),
          wrapText: colIndex === 4
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
      sheet.getCell(rowIndex, 5).numFmt = '#,##0.00';
    }

    const minimumValidationRows = 150;
    const validationEndRow = Math.max(DATA_START_ROW + normalizedRows.length - 1, DATA_START_ROW + minimumValidationRows - 1);
    const validationSource = `Options!$A$1:$A$${NHIS_SITUATION_CASE_OPTIONS.length}`;
    for (let rowIndex = DATA_START_ROW; rowIndex <= validationEndRow; rowIndex += 1) {
      sheet.getCell(rowIndex, 4).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [validationSource],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Invalid Situation/Case',
        error: 'Select a value from the Situation/Case dropdown list.'
      };
    }

    sheet.autoFilter = { from: `B${HEADER_START_ROW}`, to: `E${HEADER_START_ROW}` };
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    const wb = xlsx.utils.book_new();
    const rows = [
      ['+', TEMPLATE_TITLE, '', '', ''],
      [TEMPLATE_SUBTITLE, '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', 'Total Amount (GHS)', 0],
      ['', '', '', '', ''],
      [...TEMPLATE_HEADERS],
      [''],
      ...normalizedRows
    ];
    const ws = xlsx.utils.aoa_to_sheet(rows);
    ws['!cols'] = TEMPLATE_COLUMN_WIDTHS.map((width) => ({ wch: width }));
    xlsx.utils.book_append_sheet(wb, ws, 'NHIS');
    const optionsSheetRows = [['Situation/Case Options'], ...NHIS_SITUATION_CASE_OPTIONS.map((option) => [option])];
    const optionsSheet = xlsx.utils.aoa_to_sheet(optionsSheetRows);
    optionsSheet['!cols'] = [{ wch: 46 }];
    xlsx.utils.book_append_sheet(wb, optionsSheet, 'Options');
    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}

router.use(requireAuth);

router.get('/', requirePermission('nhisRegistration', 'view'), asyncHandler(async (req, res) => {
  const { search, year } = req.query || {};
  const params = [];
  const where = [];
  const programYear = parseProgramYear(year);

  if (search) {
    params.push(`%${search}%`);
    where.push(`(full_name ILIKE $${params.length} OR situation_case ILIKE $${params.length})`);
  }

  params.push(programYear);
  where.push(`program_year = $${params.length}`);

  const result = await query(
    `SELECT id, full_name, situation_case, amount::double precision AS amount, program_year, registration_date
     FROM nhis_registrations
     WHERE ${where.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT 300`,
    params
  );

  return res.json(result.rows);
}));

router.get('/template', requirePermission('nhisRegistration', 'view'), asyncHandler(async (req, res) => {
  const buffer = await buildWorkbookBuffer({ prefillCount: 99, showOptionsSheet: true });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="ewccomm25-nhis-template.xlsx"');
  return res.send(buffer);
}));

router.post('/import', requirePermission('nhisRegistration', 'import'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const programYear = parseProgramYear(req.body?.year);
  const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });

  const headerIndex = rows.findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    return normalized.includes('name') && normalized.includes('amount');
  });

  if (headerIndex === -1) {
    return res.status(400).json({ message: 'Could not find NHIS header row in the uploaded sheet.' });
  }

  const headerRow = rows[headerIndex];
  const columnIndex = {};
  headerRow.forEach((cell, index) => {
    const key = NORMALIZED_HEADER_MAP[normalizeHeader(cell)];
    if (key) {
      columnIndex[key] = index;
    }
  });

  if (columnIndex.name === undefined) {
    return res.status(400).json({ message: 'Name column is missing in the uploaded sheet.' });
  }

  const records = [];
  let skipped = 0;
  let duplicates = 0;

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    const fullName = titleCaseText(row[columnIndex.name]);

    if (!fullName) {
      skipped += 1;
      continue;
    }

    records.push({
      fullName,
      situationCase: titleCaseText(row[columnIndex.situation]),
      amount: parseAmount(row[columnIndex.amount])
    });
  }

  if (!records.length) {
    return res.status(400).json({ message: 'No valid NHIS rows found in the sheet.' });
  }

  const dedupedRecords = [];
  const seenKeys = new Set();
  for (const record of records) {
    const dedupeKey = buildNhisDuplicateKey(record);
    if (seenKeys.has(dedupeKey)) {
      skipped += 1;
      duplicates += 1;
      continue;
    }
    seenKeys.add(dedupeKey);

    const existing = await findDuplicateNhisRecord(record);
    if (existing) {
      skipped += 1;
      duplicates += 1;
      continue;
    }

    dedupedRecords.push(record);
  }

  if (!dedupedRecords.length) {
    return res.status(409).json({
      message: NHIS_DUPLICATE_MESSAGE,
      inserted: 0,
      skipped,
      duplicates
    });
  }

  const columns = [
    'full_name',
    'situation_case',
    'amount',
    'program_year',
    'created_by',
    'updated_by'
  ];

  const values = [];
  const placeholders = dedupedRecords.map((record, index) => {
    const offset = index * columns.length;
    values.push(
      record.fullName,
      record.situationCase,
      record.amount,
      programYear,
      req.user.id,
      req.user.id
    );
    const tokens = columns.map((_, columnIndex) => `$${offset + columnIndex + 1}`);
    return `(${tokens.join(',')})`;
  });

  await query(
    `INSERT INTO nhis_registrations (${columns.join(', ')})
     VALUES ${placeholders.join(', ')}`,
    values
  );

  return res.json({ inserted: dedupedRecords.length, skipped, duplicates });
}));

router.get('/export', requirePermission('nhisRegistration', 'export'), asyncHandler(async (req, res) => {
  const { name, situation, year } = req.query || {};
  const params = [];
  const where = [];

  if (name) {
    params.push(`%${name}%`);
    where.push(`full_name ILIKE $${params.length}`);
  }

  if (situation) {
    params.push(`%${situation}%`);
    where.push(`situation_case ILIKE $${params.length}`);
  }

  if (year) {
    params.push(parseProgramYear(year));
    where.push(`program_year = $${params.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const result = await query(
    `SELECT full_name, situation_case, amount::double precision AS amount
     FROM nhis_registrations
     ${whereClause}
     ORDER BY registration_date DESC, created_at DESC`,
    params
  );

  const rows = result.rows.map((record, index) => ([
    '',
    index + 1,
    record.full_name || '',
    record.situation_case || '',
    formatAmountForSheet(record.amount)
  ]));
  const buffer = await buildWorkbookBuffer({ dataRows: rows });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="ewccomm25-nhis-registrations.xlsx"');
  return res.send(buffer);
}));

router.post('/', requirePermission('nhisRegistration', 'create'), asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const fullName = titleCaseText(payload.fullName);
  const amount = parseAmount(payload.amount);
  const programYear = parseProgramYear(payload.programYear);
  const clientRequestId = normalizeClientRequestId(payload.clientRequestId);
  const hasAmountInput = !(
    payload.amount === undefined
    || payload.amount === null
    || String(payload.amount).trim() === ''
  );

  if (!fullName) {
    return res.status(400).json({ message: 'fullName is required.' });
  }

  if (hasAmountInput && amount === null) {
    return res.status(400).json({ message: 'Amount must be a valid number.' });
  }

  const createScope = 'nhis:create';
  const duplicateKey = buildNhisDuplicateKey({ fullName, amount });
  const outcome = await withTransaction(async (client) => {
    if (clientRequestId) {
      await acquireTransactionLock(client, `${createScope}:request:${clientRequestId}`);
      const existingResponse = await getIdempotentResponse(client, createScope, clientRequestId);
      if (existingResponse) {
        return { replay: existingResponse };
      }
    }

    await acquireTransactionLock(client, `${createScope}:dedupe:${duplicateKey}`);

    const duplicate = await findDuplicateNhisRecord({ fullName, amount }, { executor: client });
    if (duplicate) {
      return { duplicate: true };
    }

    const result = await client.query(
      `INSERT INTO nhis_registrations (
        full_name, situation_case, amount, program_year, created_by, updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, full_name, situation_case, amount::double precision AS amount,
                program_year, registration_date, created_at, updated_at`,
      [
        fullName,
        titleCaseText(payload.situationCase),
        amount,
        programYear,
        req.user.id,
        req.user.id
      ]
    );

    const createdRecord = result.rows[0];
    if (clientRequestId) {
      await storeIdempotentResponse(client, createScope, clientRequestId, 201, createdRecord);
    }

    return { created: createdRecord };
  });

  if (outcome.replay) {
    return res.status(outcome.replay.status).json(outcome.replay.body);
  }

  if (outcome.duplicate) {
    return res.status(409).json({ message: NHIS_DUPLICATE_MESSAGE });
  }

  return res.status(201).json(outcome.created);
}));

router.get('/:id', requirePermission('nhisRegistration', 'view'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await query(
    `SELECT id, full_name, situation_case, amount::double precision AS amount,
            program_year, registration_date, created_at, updated_at
     FROM nhis_registrations
     WHERE id = $1`,
    [id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ message: 'NHIS record not found.' });
  }

  return res.json(result.rows[0]);
}));

router.patch('/:id', requirePermission('nhisRegistration', 'edit'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};
  const updates = [];
  const values = [];
  let fullNameInput = null;
  let amountInput = null;
  const expectedUpdatedAt = payload.expectedUpdatedAt === undefined
    ? null
    : normalizeExpectedUpdatedAt(payload.expectedUpdatedAt);

  if (payload.expectedUpdatedAt !== undefined && !expectedUpdatedAt) {
    return res.status(400).json({ message: 'expectedUpdatedAt must be a valid timestamp.' });
  }

  if (payload.fullName !== undefined) {
    const fullName = titleCaseText(payload.fullName);
    if (!fullName) {
      return res.status(400).json({ message: 'fullName cannot be empty.' });
    }
    fullNameInput = fullName;
    values.push(fullName);
    updates.push(`full_name = $${values.length}`);
  }

  if (payload.situationCase !== undefined) {
    const situationCase = titleCaseText(payload.situationCase);
    values.push(situationCase || null);
    updates.push(`situation_case = $${values.length}`);
  }

  if (payload.amount !== undefined) {
    const amount = parseAmount(payload.amount);
    const hasAmountInput = !(
      payload.amount === undefined
      || payload.amount === null
      || String(payload.amount).trim() === ''
    );
    if (hasAmountInput && amount === null) {
      return res.status(400).json({ message: 'Amount must be a valid number.' });
    }
    amountInput = amount;
    values.push(amount);
    updates.push(`amount = $${values.length}`);
  }

  if (payload.programYear !== undefined) {
    const programYear = Number.parseInt(payload.programYear, 10);
    if (!Number.isFinite(programYear)) {
      return res.status(400).json({ message: 'programYear must be a valid year.' });
    }
    values.push(programYear);
    updates.push(`program_year = $${values.length}`);
  }

  if (!updates.length) {
    return res.status(400).json({ message: 'No valid fields provided for update.' });
  }

  const outcome = await withTransaction(async (client) => {
    const currentRecord = await client.query(
      `SELECT id, full_name, amount::double precision AS amount, updated_at
       FROM nhis_registrations
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
        message: buildStaleRecordMessage('NHIS record')
      };
    }

    if (payload.fullName !== undefined || payload.amount !== undefined) {
      const nextDuplicateKey = buildNhisDuplicateKey({
        fullName: fullNameInput ?? current.full_name,
        amount: payload.amount !== undefined ? amountInput : current.amount
      });

      await acquireTransactionLock(client, `nhis:update:dedupe:${nextDuplicateKey}`);

      const duplicate = await findDuplicateNhisRecord({
        fullName: fullNameInput ?? current.full_name,
        amount: payload.amount !== undefined ? amountInput : current.amount
      }, { excludeId: id, executor: client });
      if (duplicate) {
        return { duplicate: true };
      }
    }

    values.push(req.user.id);
    updates.push(`updated_by = $${values.length}`);
    values.push(id);

    const result = await client.query(
      `UPDATE nhis_registrations
       SET ${updates.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, full_name, situation_case, amount::double precision AS amount,
                 program_year, registration_date, created_at, updated_at`,
      values
    );

    return { updated: result.rows[0] };
  });

  if (outcome.missing) {
    return res.status(404).json({ message: 'NHIS record not found.' });
  }

  if (outcome.stale) {
    return res.status(409).json({ code: 'stale_record', message: outcome.message });
  }

  if (outcome.duplicate) {
    return res.status(409).json({ message: NHIS_DUPLICATE_MESSAGE });
  }

  return res.json(outcome.updated);
}));

router.delete('/:id', requirePermission('nhisRegistration', 'delete'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await query(
    'DELETE FROM nhis_registrations WHERE id = $1 RETURNING id',
    [id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ message: 'NHIS record not found.' });
  }

  return res.json({ success: true, id: result.rows[0].id });
}));

export default router;
