/**
 * Data conversion engine - pure JS, all libraries lazily imported.
 *
 * Supported pairs
 * ─────────────────────────────────────────
 *  csv  → json   (built-in CSV parser)
 *  csv  → yaml   (built-in CSV parser + js-yaml)
 *  json → csv    (built-in CSV serialiser)
 *  json → yaml   (js-yaml)
 *  json → xml    (fast-xml-parser)
 *  yaml → json   (js-yaml)
 *  xml  → json   (fast-xml-parser)
 *  xml  → yaml   (fast-xml-parser + js-yaml)
 *  xlsx → csv    (SheetJS, first sheet)
 *  xlsx → json   (SheetJS)
 */

// ── CSV helpers ───────────────────────────────────────────────────────────────

function parseCSVRow(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === ',' && !inQuotes) {
      fields.push(field); field = '';
    } else {
      field += c;
    }
  }
  fields.push(field);
  return fields;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVRow(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = parseCSVRow(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i]?.trim() ?? ''; });
    return obj;
  });
}

function stringifyCSV(data: Record<string, unknown>[]): string {
  if (!data.length) return '';
  const headers = [...new Set(data.flatMap(r => Object.keys(r)))];
  const esc = (v: unknown): string => {
    const s = String(v == null ? '' : v);
    return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.map(esc).join(','),
    ...data.map(row => headers.map(h => esc((row as Record<string, unknown>)[h])).join(',')),
  ].join('\n');
}

function normaliseXmlSource(data: unknown): Record<string, unknown> {
  if (Array.isArray(data)) {
    return { root: data };
  }
  if (data && typeof data === 'object') {
    return data as Record<string, unknown>;
  }
  return { root: data };
}

async function workbookToJson(arrayBuffer: ArrayBuffer): Promise<unknown> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetNames = workbook.SheetNames;

  if (!sheetNames.length) {
    return [];
  }

  if (sheetNames.length === 1) {
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetNames[0]], { defval: '' });
  }

  return Object.fromEntries(
    sheetNames.map((sheetName) => [
      sheetName,
      XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' }),
    ]),
  );
}

async function workbookToCsv(arrayBuffer: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return '';
  }

  return XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheetName]);
}

// ── Main export ───────────────────────────────────────────────────────────────

export type DataOutputFormat = 'json' | 'csv' | 'yaml' | 'xml';

const OUTPUT_MIME: Record<DataOutputFormat, string> = {
  json: 'application/json',
  csv:  'text/csv',
  yaml: 'text/yaml',
  xml:  'application/xml',
};

export async function convertData(
  file: File,
  outputFormat: DataOutputFormat,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  onProgress?.(10);
  const from = file.name.split('.').pop()?.toLowerCase() ?? '';

  let result = '';

  if (from === 'csv') {
    const text = await file.text();
    onProgress?.(30);
    const data = parseCSV(text);
    if (outputFormat === 'json') {
      result = JSON.stringify(data, null, 2);
    } else if (outputFormat === 'yaml') {
      const { dump } = await import('js-yaml');
      result = dump(data);
    } else {
      throw new Error(`csv → ${outputFormat} not supported`);
    }

  } else if (from === 'json') {
    const text = await file.text();
    onProgress?.(30);
    const data = JSON.parse(text) as unknown;
    if (outputFormat === 'csv') {
      const arr = Array.isArray(data) ? data : [data];
      result = stringifyCSV(arr as Record<string, unknown>[]);
    } else if (outputFormat === 'yaml') {
      const { dump } = await import('js-yaml');
      result = dump(data);
    } else if (outputFormat === 'xml') {
      const { XMLBuilder } = await import('fast-xml-parser');
      const builder = new XMLBuilder({
        format: true,
        ignoreAttributes: false,
        suppressBooleanAttributes: false,
      });
      result = builder.build(normaliseXmlSource(data));
    } else {
      throw new Error(`json → ${outputFormat} not supported`);
    }

  } else if (from === 'yaml' || from === 'yml') {
    const text = await file.text();
    onProgress?.(30);
    if (outputFormat !== 'json') throw new Error(`yaml → ${outputFormat} not supported`);
    const { load } = await import('js-yaml');
    result = JSON.stringify(load(text), null, 2);

  } else if (from === 'xml') {
    const text = await file.text();
    onProgress?.(30);
    const { XMLParser } = await import('fast-xml-parser');
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const data = parser.parse(text);
    if (outputFormat === 'json') {
      result = JSON.stringify(data, null, 2);
    } else if (outputFormat === 'yaml') {
      const { dump } = await import('js-yaml');
      result = dump(data);
    } else {
      throw new Error(`xml → ${outputFormat} not supported`);
    }

  } else if (from === 'xlsx') {
    const arrayBuffer = await file.arrayBuffer();
    onProgress?.(30);

    if (outputFormat === 'json') {
      result = JSON.stringify(await workbookToJson(arrayBuffer), null, 2);
    } else if (outputFormat === 'csv') {
      result = await workbookToCsv(arrayBuffer);
    } else {
      throw new Error(`xlsx → ${outputFormat} not supported`);
    }

  } else {
    throw new Error(`Unsupported input format: .${from}`);
  }

  onProgress?.(100);
  return new Blob([result], { type: `${OUTPUT_MIME[outputFormat]};charset=utf-8` });
}
