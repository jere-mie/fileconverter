/**
 * Document conversion engine using lightweight pure-JS libraries:
 *  - marked       (Markdown → HTML)
 *  - turndown     (HTML → Markdown)
 *  - mammoth      (DOCX → HTML / Markdown / TXT)
 *
 * All conversions happen synchronously on the main thread (they are fast enough).
 *
 * Supported pairs
 * ─────────────────────────────────────────
 *  md   → html   (marked)
 *  md   → txt    (strip tags from html)
 *  html → md     (turndown)
 *  html → txt    (DOMParser strip tags)
 *  docx → html   (mammoth)
 *  docx → md     (mammoth → turndown)
 *  docx → txt    (mammoth extractRawText)
 */

export type DocPair = `${string}-${string}`;

const MIMES: Record<string, string> = {
  html: 'text/html',
  md:   'text/markdown',
  txt:  'text/plain',
};

function stripTags(html: string): string {
  // Use DOMParser when available (browser), otherwise regex fallback
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent ?? '';
  }
  return html.replace(/<[^>]+>/g, '');
}

export async function convertDocument(
  file: File,
  outputFormat: 'html' | 'md' | 'txt',
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  onProgress?.(10);
  const from = file.name.split('.').pop()?.toLowerCase() ?? '';

  let outputText = '';

  if (from === 'md' || from === 'markdown') {
    const text = await file.text();
    onProgress?.(40);
    const { marked } = await import('marked');
    const html = await marked(text);
    onProgress?.(80);

    if (outputFormat === 'html') {
      outputText = `<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
    } else if (outputFormat === 'txt') {
      outputText = stripTags(html);
    } else {
      // md → md (no-op, shouldn't occur)
      outputText = text;
    }

  } else if (from === 'html' || from === 'htm') {
    const text = await file.text();
    onProgress?.(40);

    if (outputFormat === 'md') {
      const TurndownService = (await import('turndown')).default;
      const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
      outputText = td.turndown(text);
    } else if (outputFormat === 'txt') {
      outputText = stripTags(text);
    } else {
      outputText = text;
    }
    onProgress?.(80);

  } else if (from === 'docx') {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    onProgress?.(40);

    if (outputFormat === 'html') {
      const result = await mammoth.convertToHtml({ arrayBuffer });
      outputText = result.value;
    } else if (outputFormat === 'md') {
      const result = await mammoth.convertToHtml({ arrayBuffer });
      onProgress?.(65);
      const TurndownService = (await import('turndown')).default;
      const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
      outputText = td.turndown(result.value);
    } else {
      const result = await mammoth.extractRawText({ arrayBuffer });
      outputText = result.value;
    }
    onProgress?.(80);

  } else {
    throw new Error(`Unsupported input format: ${from}`);
  }

  onProgress?.(100);
  const mime = MIMES[outputFormat] ?? 'text/plain';
  return new Blob([outputText], { type: `${mime};charset=utf-8` });
}
