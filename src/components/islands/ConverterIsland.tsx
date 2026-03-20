import { useState, useCallback, useRef, useEffect } from 'react';
import FileDropzone from '../FileDropzone';
import type { Engine } from '../../data/converters';

type ConversionState = 'idle' | 'loading' | 'processing' | 'done' | 'error';

interface Props {
  from: string;
  to: string;
  engine: Engine;
  mimeIn: string[];
}

export default function ConverterIsland({ from, to, engine, mimeIn }: Props) {
  const [state, setState] = useState<ConversionState>('idle');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputFilename, setOutputFilename] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [inputFile, setInputFile] = useState<File | null>(null);
  const prevUrlRef = useRef<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Warn if cross-origin isolation is missing (needed for FFmpeg SharedArrayBuffer)
  const [isolationWarning, setIsolationWarning] = useState(false);
  useEffect(() => {
    if (engine === 'ffmpeg' && typeof window !== 'undefined' && !window.crossOriginIsolated) {
      setIsolationWarning(true);
    }
  }, [engine]);

  const cleanup = useCallback(() => {
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
    }
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    cleanup();
    setState('idle');
    setProgress(0);
    setStatusText('');
    setOutputUrl(null);
    setOutputFilename('');
    setErrorMsg('');
    setInputFile(null);
  }, [cleanup]);

  const handleFile = useCallback(
    async (file: File) => {
      cleanup();
      setInputFile(file);
      setOutputUrl(null);
      setErrorMsg('');
      setProgress(0);

      try {
        if (engine === 'image') {
          setState('processing');
          setStatusText('Converting image...');
          setProgress(30);

          const { convertImage } = await import('../../engines/imageEngine');
          const blob = await convertImage(file, to as 'png' | 'jpg' | 'webp' | 'ico' | 'avif');

          setProgress(100);
          const url = URL.createObjectURL(blob);
          prevUrlRef.current = url;
          setOutputUrl(url);
          setOutputFilename(`${file.name.replace(/\.[^.]+$/, '')}.${to}`);
          setState('done');
          setStatusText('Done!');

        } else if (engine === 'document') {
          setState('loading');
          setStatusText('Loading document engine...');
          setProgress(5);

          const { convertDocument } = await import('../../engines/documentEngine');
          setState('processing');
          setStatusText('Converting document...');

          const blob = await convertDocument(
            file,
            to as 'html' | 'md' | 'txt',
            (pct) => setProgress(pct),
          );

          const url = URL.createObjectURL(blob);
          prevUrlRef.current = url;
          setOutputUrl(url);
          setOutputFilename(`${file.name.replace(/\.[^.]+$/, '')}.${to}`);
          setState('done');
          setProgress(100);
          setStatusText('Conversion complete!');

        } else if (engine === 'pdf') {
          setState('loading');
          setStatusText('Loading PDF engine...');
          setProgress(5);

          const { convertPdf } = await import('../../engines/pdfEngine');
          setState('processing');
          setStatusText('Converting document...');

          const blob = await convertPdf(
            file,
            to as 'png' | 'jpg' | 'pdf' | 'txt',
            (pct) => setProgress(pct),
          );

          const url = URL.createObjectURL(blob);
          prevUrlRef.current = url;
          setOutputUrl(url);
          setOutputFilename(`${file.name.replace(/\.[^.]+$/, '')}.${to}`);
          setState('done');
          setProgress(100);
          setStatusText('Conversion complete!');

        } else {
          // FFmpeg via Web Worker
          setState('loading');
          setStatusText('Initialising engine...');
          setProgress(2);

          const blob = await new Promise<Blob>((resolve, reject) => {
            const worker = new Worker(
              new URL('../../workers/ffmpeg.worker.ts', import.meta.url),
              { type: 'module' },
            );
            workerRef.current = worker;

            worker.onmessage = (e: MessageEvent) => {
              const { type, payload } = e.data as {
                type: 'STATUS' | 'PROGRESS' | 'DONE' | 'ERROR';
                payload: string | number | { buffer: ArrayBuffer; mimeType: string };
              };

              if (type === 'STATUS') {
                const text = payload as string;
                setStatusText(text);
                if (text.startsWith('Converting')) setState('processing');
              } else if (type === 'PROGRESS') {
                setProgress(payload as number);
              } else if (type === 'DONE') {
                const { buffer, mimeType } = payload as { buffer: ArrayBuffer; mimeType: string };
                resolve(new Blob([buffer], { type: mimeType }));
                worker.terminate();
                workerRef.current = null;
              } else if (type === 'ERROR') {
                reject(new Error(payload as string));
                worker.terminate();
                workerRef.current = null;
              }
            };

            worker.onerror = (err) => {
              reject(new Error(err.message));
              worker.terminate();
              workerRef.current = null;
            };

            file.arrayBuffer().then((buffer) => {
              worker.postMessage(
                { type: 'CONVERT', payload: { fileBuffer: buffer, fileName: file.name, outputFormat: to } },
                [buffer],
              );
            });
          });

          const url = URL.createObjectURL(blob);
          prevUrlRef.current = url;
          setOutputUrl(url);
          setOutputFilename(`${file.name.replace(/\.[^.]+$/, '')}.${to}`);
          setState('done');
          setProgress(100);
          setStatusText('Conversion complete!');
        }
      } catch (err) {
        setState('error');
        setErrorMsg((err as Error).message ?? 'An unknown error occurred.');
      }
    },
    [engine, to, cleanup],
  );

  const handleDownload = useCallback(() => {
    if (!outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    a.download = outputFilename;
    a.click();
    // Revoke after short delay (allow browser to initiate download)
    setTimeout(() => {
      URL.revokeObjectURL(outputUrl);
      prevUrlRef.current = null;
      setOutputUrl(null);
      setState('idle');
      setInputFile(null);
      setProgress(0);
    }, 2000);
  }, [outputUrl, outputFilename]);

  // Card container style
  const card: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    overflow: 'hidden',
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Isolation warning */}
      {isolationWarning && (
        <div
          style={{
            background: 'rgba(255, 87, 87, 0.08)',
            border: '1px solid rgba(255, 87, 87, 0.3)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <span style={{ color: 'var(--error)', fontSize: '1rem', flexShrink: 0 }}>⚠</span>
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem', lineHeight: 1.5 }}>
            Cross-origin isolation is not active. FFmpeg requires the{' '}
            <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>Cross-Origin-Embedder-Policy</code>{' '}
            and{' '}
            <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>Cross-Origin-Opener-Policy</code>{' '}
            headers. Check your deployment headers or run locally with the headers set.
          </p>
        </div>
      )}

      {/* Main card */}
      <div style={card}>
        {/* Header strip */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="format-badge">.{from}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
            <span className="format-badge">.{to}</span>
          </div>
          {(state === 'done' || state === 'error' || state === 'processing') && (
            <button
              onClick={reset}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted)',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-sans)',
                padding: '4px 8px',
                borderRadius: 4,
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
            >
              ↺ Start over
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          {state === 'idle' && (
            <FileDropzone
              onFile={handleFile}
              accept={mimeIn}
              fromFormat={from}
              disabled={false}
            />
          )}

          {(state === 'loading' || state === 'processing') && (
            <div
              style={{
                minHeight: 220,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 20,
                textAlign: 'center',
                padding: 16,
              }}
            >
              {/* Spinner */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  border: '2px solid var(--border)',
                  borderTopColor: 'var(--accent)',
                  animation: 'spin-slow 0.9s linear infinite',
                }}
              />

              {/* File name */}
              {inputFile && (
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: 'var(--muted)',
                    maxWidth: 300,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {inputFile.name}
                </p>
              )}

              {/* Status */}
              <p style={{ color: 'var(--text)', fontSize: '0.875rem', fontWeight: 500 }}>
                {statusText}
              </p>

              {/* Progress */}
              <div style={{ width: '100%', maxWidth: 300 }}>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                </div>
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    color: 'var(--muted)',
                    marginTop: 6,
                    textAlign: 'right',
                  }}
                >
                  {progress}%
                </p>
              </div>

              <p style={{ color: 'var(--faint)', fontSize: '0.75rem' }}>
                {state === 'loading'
                  ? engine === 'ffmpeg'
                    ? 'Fetching WebAssembly engine (~5 MB)...'
                    : 'Loading document libraries...'
                  : `Converting ${from.toUpperCase()} → ${to.toUpperCase()}...`}
              </p>
            </div>
          )}

          {state === 'done' && (
            <div
              className="animate-fade-in"
              style={{
                minHeight: 220,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 20,
                textAlign: 'center',
                padding: 16,
              }}
            >
              {/* Success check */}
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'rgba(94, 206, 122, 0.1)',
                  border: '1.5px solid rgba(94, 206, 122, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <div>
                <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>Ready to download</p>
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: 'var(--muted)',
                    maxWidth: 280,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    margin: '0 auto',
                  }}
                >
                  {outputFilename}
                </p>
              </div>

              <button className="btn-primary animate-pulse-glow" onClick={handleDownload}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download .{to}
              </button>
            </div>
          )}

          {state === 'error' && (
            <div
              className="animate-fade-in"
              style={{
                minHeight: 220,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                textAlign: 'center',
                padding: 16,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'rgba(255, 87, 87, 0.1)',
                  border: '1.5px solid rgba(255, 87, 87, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>

              <div>
                <p style={{ color: 'var(--error)', fontWeight: 600, marginBottom: 6 }}>Conversion failed</p>
                <p style={{ color: 'var(--muted)', fontSize: '0.825rem', maxWidth: 340 }}>{errorMsg}</p>
              </div>

              <button className="btn-ghost" onClick={reset}>
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Footer strip */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 20,
            alignItems: 'center',
          }}
        >
          <PrivacyPill icon="🔒" text="No uploads" />
          <PrivacyPill icon="⚡" text="WebAssembly" />
          <PrivacyPill icon="💻" text="Runs locally" />
        </div>
      </div>
    </div>
  );
}

function PrivacyPill({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: '0.7rem' }}>{icon}</span>
      <span style={{ color: 'var(--faint)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.03em' }}>
        {text}
      </span>
    </div>
  );
}
