import { FFmpeg } from '@ffmpeg/ffmpeg';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';

const MIME_TYPES: Record<string, string> = {
  mp3:  'audio/mpeg',
  wav:  'audio/wav',
  ogg:  'audio/ogg',
  flac: 'audio/flac',
  m4a:  'audio/mp4',
  mp4:  'video/mp4',
  webm: 'video/webm',
  gif:  'image/gif',
  avi:  'video/x-msvideo',
  mov:  'video/quicktime',
  mkv:  'video/x-matroska',
};

type WorkerMessage =
  | { type: 'CONVERT'; payload: { fileBuffer: ArrayBuffer; fileName: string; outputFormat: string } };

type WorkerResponse =
  | { type: 'STATUS';   payload: string }
  | { type: 'PROGRESS'; payload: number }
  | { type: 'DONE';     payload: { buffer: ArrayBuffer; mimeType: string } }
  | { type: 'ERROR';    payload: string };

let ffmpeg: FFmpeg | null = null;
let isLoaded = false;

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type, payload } = e.data;
  if (type !== 'CONVERT') return;

  const respond = (msg: WorkerResponse, transfer?: Transferable[]) => {
    if (transfer) {
      (self as unknown as Worker).postMessage(msg, transfer);
    } else {
      (self as unknown as Worker).postMessage(msg);
    }
  };

  try {
    if (!ffmpeg) {
      ffmpeg = new FFmpeg();
    }

    if (!isLoaded) {
      respond({ type: 'STATUS', payload: 'Loading conversion engine...' });
      respond({ type: 'PROGRESS', payload: 2 });

      ffmpeg.on('progress', ({ progress }: { progress: number }) => {
        respond({ type: 'PROGRESS', payload: Math.max(10, Math.round(progress * 100)) });
      });

      await ffmpeg.load({
        coreURL,
        wasmURL,
      });
      isLoaded = true;
      respond({ type: 'PROGRESS', payload: 10 });
    }

    respond({ type: 'STATUS', payload: 'Converting...' });

    const { fileBuffer, fileName, outputFormat } = payload;
    const ext = fileName.split('.').pop()?.toLowerCase() ?? 'bin';
    const inputName = `input.${ext}`;
    const outputName = `output.${outputFormat}`;

    await ffmpeg.writeFile(inputName, new Uint8Array(fileBuffer));
    await ffmpeg.exec(['-i', inputName, outputName]);

    const data = (await ffmpeg.readFile(outputName)) as Uint8Array;

    // Cleanup virtual FS
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});

    // Copy into a plain ArrayBuffer (data.buffer may be a SharedArrayBuffer)
    const buffer = new ArrayBuffer(data.byteLength);
    new Uint8Array(buffer).set(data);
    respond(
      { type: 'DONE', payload: { buffer, mimeType: MIME_TYPES[outputFormat] ?? 'application/octet-stream' } },
      [buffer],
    );
  } catch (err) {
    respond({ type: 'ERROR', payload: (err as Error).message ?? 'Unknown error' });
  }
};
