/**
 * Browser-native image conversion using Canvas API.
 * Runs on the main thread - images are fast enough that a Worker is unnecessary.
 */
function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob returned null.'));
        }
      },
      mime,
      quality,
    );
  });
}

function getOutputMime(outputFormat: 'png' | 'jpg' | 'jpeg' | 'webp' | 'ico' | 'avif'): string {
  if (outputFormat === 'jpg' || outputFormat === 'jpeg') {
    return 'image/jpeg';
  }
  if (outputFormat === 'ico') {
    return 'image/x-icon';
  }
  return `image/${outputFormat}`;
}

function normalizeHeicConversionResult(result: Blob | Blob[]): Blob {
  return Array.isArray(result) ? result[0] : result;
}

async function convertHeicSource(
  file: File,
  outputFormat: 'png' | 'jpg' | 'jpeg' | 'webp' | 'ico' | 'avif',
): Promise<Blob> {
  const { default: heic2any } = await import('heic2any');
  const intermediateMime = outputFormat === 'jpg' || outputFormat === 'jpeg'
    ? 'image/jpeg'
    : 'image/png';

  try {
    const converted = await heic2any({
      blob: file,
      toType: intermediateMime,
      quality: outputFormat === 'jpg' || outputFormat === 'jpeg' ? 0.92 : undefined,
    });
    const blob = normalizeHeicConversionResult(converted);

    if (outputFormat === 'png' || outputFormat === 'jpg' || outputFormat === 'jpeg') {
      return blob;
    }

    return new File([blob], `${file.name}.png`, { type: blob.type });
  } catch (error) {
    const message = typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : 'Failed to decode HEIC image.';
    throw new Error(message);
  }
}

async function createIcoBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const iconSize = Math.min(256, Math.max(canvas.width, canvas.height));
  const iconCanvas = document.createElement('canvas');
  iconCanvas.width = iconSize;
  iconCanvas.height = iconSize;

  const iconContext = iconCanvas.getContext('2d');
  if (!iconContext) {
    throw new Error('Could not acquire canvas 2D context.');
  }

  iconContext.clearRect(0, 0, iconSize, iconSize);

  const scale = Math.min(iconSize / canvas.width, iconSize / canvas.height);
  const scaledWidth = Math.max(1, Math.round(canvas.width * scale));
  const scaledHeight = Math.max(1, Math.round(canvas.height * scale));
  const offsetX = Math.floor((iconSize - scaledWidth) / 2);
  const offsetY = Math.floor((iconSize - scaledHeight) / 2);

  iconContext.drawImage(canvas, offsetX, offsetY, scaledWidth, scaledHeight);

  const pngBlob = await canvasToBlob(iconCanvas, 'image/png');
  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
  const header = new ArrayBuffer(6 + 16);
  const view = new DataView(header);

  // ICONDIR
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);

  // ICONDIRENTRY
  view.setUint8(6, iconSize === 256 ? 0 : iconSize);
  view.setUint8(7, iconSize === 256 ? 0 : iconSize);
  view.setUint8(8, 0);
  view.setUint8(9, 0);
  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, pngBytes.byteLength, true);
  view.setUint32(18, 22, true);

  return new Blob([header, pngBytes], { type: 'image/x-icon' });
}

export async function convertImage(
  file: File,
  outputFormat: 'png' | 'jpg' | 'jpeg' | 'webp' | 'ico' | 'avif',
): Promise<Blob> {
  const inputFormat = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (inputFormat === 'heic' || inputFormat === 'heif') {
    const converted = await convertHeicSource(file, outputFormat);
    if (outputFormat === 'png' || outputFormat === 'jpg' || outputFormat === 'jpeg') {
      return converted;
    }
    file = new File([converted], `${file.name}.png`, { type: converted.type });
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not acquire canvas 2D context.'));
        return;
      }

      // JPEG has no alpha - fill with white to avoid black backgrounds
      if (outputFormat === 'jpg' || outputFormat === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(objectUrl);

      if (outputFormat === 'ico') {
        createIcoBlob(canvas).then(resolve).catch(reject);
        return;
      }

      const mime = getOutputMime(outputFormat);

      canvasToBlob(canvas, mime, 0.92).then(resolve).catch(reject);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image file.'));
    };

    img.src = objectUrl;
  });
}
