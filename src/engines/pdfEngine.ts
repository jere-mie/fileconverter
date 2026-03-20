/**
 * PDF conversion engine - libraries lazily imported.
 *
 * Supported pairs
 * ─────────────────────────────────────────
 *  pdf → png   (pdfjs-dist - one PNG per page, returned as a ZIP)
 *  pdf → jpg   (pdfjs-dist - one JPG per page, returned as a ZIP)
 *  pdf → txt   (pdfjs-dist - text extraction)
 *  html → pdf  (jspdf + html2canvas)
 *  md   → pdf  (marked → html → jspdf + html2canvas)
 *  docx → pdf  (mammoth → html → jspdf + html2canvas)
 */

// ── PDF → images (ZIP) ───────────────────────────────────────────────────────

function canvasToBlob(canvas: HTMLCanvasElement, mime: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob returned null')),
      mime,
      0.92,
    );
  });
}

async function pdfToImages(
  file: File,
  outputFormat: 'png' | 'jpg',
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  onProgress?.(5);

  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  onProgress?.(15);

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  onProgress?.(20);

  const totalPages = pdf.numPages;
  const scale = 2; // retina quality
  const mime = outputFormat === 'jpg' ? 'image/jpeg' : 'image/png';
  const baseName = file.name.replace(/\.pdf$/i, '');

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    if (outputFormat === 'jpg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // RenderTask in pdfjs-dist is not directly thenable - must await .promise
    await (page.render({ canvasContext: ctx, viewport, canvas }) as unknown as { promise: Promise<void> }).promise;

    const pageBlob = await canvasToBlob(canvas, mime);
    const padded = String(pageNum).padStart(String(totalPages).length, '0');
    zip.file(`${baseName}-page-${padded}.${outputFormat}`, pageBlob);

    onProgress?.(20 + Math.round((pageNum / totalPages) * 70));
  }

  onProgress?.(95);
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  onProgress?.(100);
  return new Blob([zipBlob], { type: 'application/zip' });
}

async function htmlStringToPdf(
  html: string,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  const { default: html2canvas } = await import('html2canvas');
  const { default: jsPDF } = await import('jspdf');
  onProgress?.(15);

  // Render HTML into a temporary off-screen container
  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    'width:794px',       // ~A4 at 96 dpi
    'background:#ffffff',
    'color:#000000',
    'font-family:sans-serif',
    'padding:0',
    'margin:0',
  ].join(';');
  container.innerHTML = html;
  document.body.appendChild(container);

  onProgress?.(25);

  const canvas = await html2canvas(container, {
    scale: 1.5,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: 794,
  });
  document.body.removeChild(container);
  onProgress?.(80);

  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();   // 210
  const pageH = pdf.internal.pageSize.getHeight(); // 297
  const imgH = (canvas.height * pageW) / canvas.width;

  let remaining = imgH;
  let yPos = 0;
  while (remaining > 0) {
    if (yPos > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, -yPos, pageW, imgH);
    yPos += pageH;
    remaining -= pageH;
  }

  onProgress?.(100);
  return pdf.output('blob');
}

async function pdfToText(file: File, onProgress?: (pct: number) => void): Promise<Blob> {
  onProgress?.(5);

  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  onProgress?.(15);

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push(pageText);
    onProgress?.(15 + Math.round((pageNum / pdf.numPages) * 80));
  }

  onProgress?.(100);
  return new Blob([pages.join('\n\n')], { type: 'text/plain;charset=utf-8' });
}

// ── Main export ───────────────────────────────────────────────────────────────

export type PdfOutputFormat = 'png' | 'jpg' | 'pdf' | 'txt';

export async function convertPdf(
  file: File,
  outputFormat: PdfOutputFormat,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  const from = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (from === 'pdf' && (outputFormat === 'png' || outputFormat === 'jpg')) {
    return pdfToImages(file, outputFormat, onProgress);
  }
  if (from === 'pdf' && outputFormat === 'txt') {
    return pdfToText(file, onProgress);
  }
  if (from === 'html' && outputFormat === 'pdf') {
    onProgress?.(5);
    const html = await file.text();
    return htmlStringToPdf(html, onProgress);
  }
  if ((from === 'md' || from === 'markdown') && outputFormat === 'pdf') {
    onProgress?.(5);
    const text = await file.text();
    const { marked } = await import('marked');
    const body = await marked(text);
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Georgia,serif;line-height:1.7;max-width:740px;margin:40px auto;color:#111;}code{background:#f4f4f4;padding:2px 5px;border-radius:3px;}pre{background:#f4f4f4;padding:12px;border-radius:4px;overflow-x:auto;}h1,h2,h3{margin-top:1.5em;}blockquote{border-left:3px solid #ccc;margin:0;padding:0 1em;color:#555;}</style></head><body>${body}</body></html>`;
    return htmlStringToPdf(html, onProgress);
  }
  if (from === 'docx' && outputFormat === 'pdf') {
    onProgress?.(5);
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return htmlStringToPdf(`<!doctype html><html><head><meta charset="utf-8"></head><body>${result.value}</body></html>`, onProgress);
  }
  throw new Error(`${from} → ${outputFormat} is not supported by the PDF engine`);
}
