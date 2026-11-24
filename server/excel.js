import ExcelJS from 'exceljs';
import { COLUMNS } from './fields.js';
import { UserError } from './extract.js';

// "Notice Period (Months or Days)*" and "notice period" both become "noticeperiod".
const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]/g, '');

function headersMatch(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || (x.length >= 5 && y.startsWith(x)) || (y.length >= 5 && x.startsWith(y));
}

function cellValue(col, row) {
  const v = row[col.key];
  if (col.list) return Array.isArray(v) ? v.join(', ') : String(v ?? '');
  if (col.numeric) {
    const n = Number(v);
    return v !== '' && v != null && Number.isFinite(n) ? n : String(v ?? '');
  }
  if (col.date && /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ''))) {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  return String(v ?? '');
}

function lastUsedRow(ws) {
  for (let r = ws.rowCount; r >= 1; r--) {
    const row = ws.getRow(r);
    let has = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.value !== null && cell.value !== '') has = true;
    });
    if (has) return r;
  }
  return 0;
}

const thin = { style: 'thin', color: { argb: 'FFD5DBE3' } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

function styleHeader(cell) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D6F42' } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  cell.border = border;
}

const WIDTHS = {
  name: 22, contactNumber: 17, email: 30, source: 12, totalExperience: 14, relevantExperience: 14,
  skill: 28, subSkill: 38, communicationSkill: 16, noticePeriod: 16, education: 40,
  currentLocation: 18, preferredLocation: 18, currentCTC: 12, expectedCTC: 12, currentCompany: 24,
  clientsWorked: 28, holdingOffers: 26, technicalCompetency: 30, recruiterComments: 34,
  trackingHistory: 12, resumeFile: 28, recruiterName: 18, submissionDate: 15,
};

export async function buildWorkbook(rows, existingBuffer) {
  const wb = new ExcelJS.Workbook();
  let ws;
  let colIndex = {}; // key -> 1-based column number
  let writeRow;

  if (existingBuffer) {
    try {
      await wb.xlsx.load(existingBuffer);
    } catch {
      throw new UserError('Could not open that Excel file. Upload a valid .xlsx file.');
    }
    ws = wb.worksheets[0];
    if (!ws) throw new UserError('That Excel file has no worksheet.');

    // The header row is the first non-empty row in the top 5 rows.
    let headerRow = 0;
    for (let r = 1; r <= 5 && !headerRow; r++) {
      let has = false;
      ws.getRow(r).eachCell({ includeEmpty: false }, () => (has = true));
      if (has) headerRow = r;
    }

    if (!headerRow) {
      headerRow = 1;
      COLUMNS.forEach((c, i) => {
        colIndex[c.key] = i + 1;
        const cell = ws.getRow(1).getCell(i + 1);
        cell.value = c.header;
        styleHeader(cell);
        ws.getColumn(i + 1).width = WIDTHS[c.key] || 18;
      });
    } else {
      const header = ws.getRow(headerRow);
      let maxCol = header.cellCount;
      for (const c of COLUMNS) {
        for (let i = 1; i <= header.cellCount; i++) {
          if (headersMatch(header.getCell(i).text, c.header)) {
            colIndex[c.key] = i;
            break;
          }
        }
      }
      // Columns missing from the user's sheet are added at the end so no data is lost.
      for (const c of COLUMNS) {
        if (!colIndex[c.key]) {
          maxCol += 1;
          colIndex[c.key] = maxCol;
          const cell = header.getCell(maxCol);
          cell.value = c.header;
          styleHeader(cell);
          ws.getColumn(maxCol).width = WIDTHS[c.key] || 18;
        }
      }
    }
    let next = Math.max(lastUsedRow(ws), headerRow) + 1;
    writeRow = () => next++;
  } else {
    ws = wb.addWorksheet('Candidates', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] });
    COLUMNS.forEach((c, i) => {
      colIndex[c.key] = i + 1;
      const cell = ws.getRow(1).getCell(i + 1);
      cell.value = c.header;
      styleHeader(cell);
      ws.getColumn(i + 1).width = WIDTHS[c.key] || 18;
    });
    ws.getRow(1).height = 34;
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };
    let next = 2;
    writeRow = () => next++;
  }

  for (const rec of rows) {
    const r = ws.getRow(writeRow());
    for (const c of COLUMNS) {
      const cell = r.getCell(colIndex[c.key]);
      cell.value = cellValue(c, rec);
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = border;
      if (c.date) cell.numFmt = 'dd-mmm-yyyy';
    }
    r.commit?.();
  }

  return wb.xlsx.writeBuffer();
}
