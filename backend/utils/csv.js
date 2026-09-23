import { HttpError } from './httpError.js';

export function parseCsv(input) {
  if (typeof input !== 'string' || !input.trim()) throw new HttpError(400, 'CSV body is empty');
  const rows = [];
  let row = [], field = '', quoted = false;
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field.trim()); field = ''; }
    else if (char === '\n') { row.push(field.trim()); if (row.some(value => value !== '')) rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (quoted) throw new HttpError(400, 'CSV contains an unclosed quoted field');
  row.push(field.trim());
  if (row.some(value => value !== '')) rows.push(row);
  if (rows.length < 2) throw new HttpError(400, 'CSV must include a header and at least one data row');
  const headers = rows.shift().map(value => value.trim());
  const duplicates = headers.filter((value, index) => headers.indexOf(value) !== index);
  if (duplicates.length) throw new HttpError(400, `Duplicate CSV headers: ${[...new Set(duplicates)].join(', ')}`);
  return rows.map((values, index) => ({
    rowNumber: index + 2,
    data: Object.fromEntries(headers.map((header, column) => [header, values[column] ?? '']))
  }));
}

export function requireCsvColumns(rows, required) {
  const available = Object.keys(rows[0]?.data || {});
  const missing = required.filter(column => !available.includes(column));
  if (missing.length) throw new HttpError(400, `Missing CSV columns: ${missing.join(', ')}`);
}

export function csvBoolean(value, fallback = false) {
  if (value === '' || value == null) return fallback;
  if (['true', '1', 'yes', 'y'].includes(String(value).toLowerCase())) return true;
  if (['false', '0', 'no', 'n'].includes(String(value).toLowerCase())) return false;
  throw new Error(`Invalid boolean value "${value}"`);
}

export function csvNumber(value, name, { min = -Infinity, max = Infinity, fallback } = {}) {
  if ((value === '' || value == null) && fallback !== undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new Error(`${name} must be a number from ${min} to ${max}`);
  return parsed;
}

