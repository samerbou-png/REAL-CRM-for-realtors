import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ESCAPE_RE = /[",\n\r]/;

function escapeField(value) {
  const text = value == null ? '' : String(value);
  if (ESCAPE_RE.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

export function readCsv(filePath) {
  if (!existsSync(filePath)) {
    return [];
  }

  const raw = readFileSync(filePath, 'utf8').trim();
  if (!raw) {
    return [];
  }

  const lines = raw.split(/\r?\n/);
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

export function writeCsv(filePath, rows, headers) {
  const headerLine = headers.map(escapeField).join(',');
  const body = rows.map((row) => headers.map((header) => escapeField(row[header])).join(','));
  writeFileSync(filePath, [headerLine, ...body].join('\n') + '\n', 'utf8');
}

export function dataPath(dataDir, name) {
  return resolve(dataDir, name);
}
