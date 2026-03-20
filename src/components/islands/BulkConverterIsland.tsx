import { useState, useRef } from 'react';
import {
  getConverter,
  getConvertersByFrom,
  type Engine,
  type ConverterPair,
} from '../../data/converters';

// ─── Types ────────────────────────────────────────────────────────────────────

type JobState = 'awaiting-format' | 'pending' | 'converting' | 'done' | 'error';

interface Job {
  id: string;
  file: File;
  from: string;
  to: string | null;
  engine: Engine | null;
  state: JobState;
  progress: number;
  statusText: string;
  outputBlob: Blob | null;
  outputFilename: string;
  errorMsg: string;
  availableTargets: ConverterPair[];
}

interface Props {
  /** Fixed source format (converter pages). Omit for smart/any-file mode. */
  from?: string;
  /** Fixed target format (converter pages). Omit to let user pick. */
  to?: string;
  engine?: Engine;
  mimeIn?: string[];
}

// ─── Engine runner ────────────────────────────────────────────────────────────

async function runJob(
  job: Job,
  onProgress: (p: number) => void,
  onStatus: (s: string) => void,
): Promise<Blob> {
  const { file, to, engine } = job;
  if (!to || !engine) throw new Error('No output format selected.');

  if (engine === 'image') {
    onStatus('Converting...');
    onProgress(30);
    const { convertImage } = await import('../../engines/imageEngine');
    const blob = await convertImage(file, to as 'png' | 'jpg' | 'webp' | 'ico' | 'avif');
    onProgress(100);
    return blob;
  }

  if (engine === 'document') {
    onStatus('Converting document...');
    const { convertDocument } = await import('../../engines/documentEngine');
    return convertDocument(file, to as 'html' | 'md' | 'txt', onProgress);
  }

  if (engine === 'data') {
    onStatus('Converting...');
    const { convertData } = await import('../../engines/dataEngine');
    return convertData(file, to as 'json' | 'csv' | 'yaml' | 'xml', onProgress);
  }

  if (engine === 'pdf') {
    onStatus('Converting...');
    const { convertPdf } = await import('../../engines/pdfEngine');
    return convertPdf(file, to as 'png' | 'jpg' | 'pdf' | 'txt', onProgress);
  }

  // FFmpeg via Web Worker
  onStatus('Loading engine...');
  onProgress(2);
  return new Promise<Blob>((resolve, reject) => {
    const worker = new Worker(
      new URL('../../workers/ffmpeg.worker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.onmessage = (e: MessageEvent) => {
      const { type, payload } = e.data as {
        type: 'STATUS' | 'PROGRESS' | 'DONE' | 'ERROR';
        payload: unknown;
      };
      if (type === 'STATUS')    onStatus(payload as string);
      else if (type === 'PROGRESS') onProgress(payload as number);
      else if (type === 'DONE') {
        const { buffer, mimeType } = payload as { buffer: ArrayBuffer; mimeType: string };
        resolve(new Blob([buffer], { type: mimeType }));
        worker.terminate();
      } else if (type === 'ERROR') {
        reject(new Error(payload as string));
        worker.terminate();
      }
    };
    worker.onerror = (e) => { reject(new Error(e.message)); worker.terminate(); };
    file.arrayBuffer().then((buf) => {
      worker.postMessage(
        { type: 'CONVERT', payload: { fileBuffer: buf, fileName: file.name, outputFormat: to } },
        [buf],
      );
    });
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

let idCounter = 0;

export default function BulkConverterIsland({
  from: fixedFrom,
  to: fixedTo,
  engine: fixedEngine,
  mimeIn,
}: Props) {
  const smart = !fixedFrom;
  const jobsRef = useRef<Job[]>([]);
  const [jobs, setJobsState] = useState<Job[]>([]);
  const processing = useRef(false);
  const [dragging, setDragging] = useState(false);

  // Keep jobsRef and render state in sync via a single mutate helper
  function mutate(fn: (prev: Job[]) => Job[]) {
    const next = fn(jobsRef.current);
    jobsRef.current = next;
    setJobsState([...next]);
  }

  function patch(id: string, partial: Partial<Job>) {
    mutate(js => js.map(j => j.id === id ? { ...j, ...partial } : j));
  }

  // Sequential job queue - called after any state change that may produce new 'pending' jobs
  async function pump() {
    if (processing.current) return;
    const job = jobsRef.current.find(j => j.state === 'pending');
    if (!job) return;

    processing.current = true;
    patch(job.id, { state: 'converting' });

    try {
      const blob = await runJob(
        job,
        (p) => patch(job.id, { progress: p }),
        (s) => patch(job.id, { statusText: s }),
      );
      patch(job.id, {
        state: 'done',
        outputBlob: blob,
        // If the engine returns a ZIP (e.g. PDF → pages), use .zip extension
        outputFilename: `${job.file.name.replace(/\.[^.]+$/, '')}.${blob.type === 'application/zip' ? 'zip' : job.to}`,
        to: blob.type === 'application/zip' ? 'zip' : job.to,
        progress: 100,
        statusText: 'Done',
      });
    } catch (e) {
      patch(job.id, { state: 'error', errorMsg: (e as Error).message ?? 'Unknown error' });
    }

    processing.current = false;
    pump(); // move to next pending job
  }

  function addFiles(files: File[]) {
    const newJobs: Job[] = files.map((file) => {
      const from = fixedFrom ?? file.name.split('.').pop()?.toLowerCase() ?? '';
      const to = fixedTo ?? null;
      const targets = smart ? getConvertersByFrom(from) : [];
      const unsupported = smart && targets.length === 0;
      const engine = fixedEngine ?? (to ? getConverter(from, to)?.engine ?? null : null);
      return {
        id: `j${++idCounter}`,
        file,
        from,
        to,
        engine,
        availableTargets: targets,
        state: (unsupported ? 'error' : smart && !to ? 'awaiting-format' : 'pending') as JobState,
        progress: 0,
        statusText: '',
        outputBlob: null,
        outputFilename: '',
        errorMsg: unsupported ? `No converters available for .${from} files` : '',
      };
    });
    mutate(prev => [...prev, ...newJobs]);
    setTimeout(pump, 0);
  }

  function pickFormat(id: string, target: ConverterPair) {
    mutate(js => js.map(j =>
      j.id === id ? { ...j, to: target.to, engine: target.engine, state: 'pending' as JobState } : j
    ));
    setTimeout(pump, 0);
  }

  function downloadOne(job: Job) {
    if (!job.outputBlob) return;
    const url = URL.createObjectURL(job.outputBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = job.outputFilename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  async function downloadZip() {
    const done = jobsRef.current.filter(j => j.state === 'done' && j.outputBlob);
    if (!done.length) return;
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    done.forEach(j => zip.file(j.outputFilename, j.outputBlob!));
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted-files.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  function retryJob(id: string) {
    mutate(js => js.map(j =>
      j.id === id ? { ...j, state: 'pending' as JobState, errorMsg: '', progress: 0, statusText: '' } : j
    ));
    setTimeout(pump, 0);
  }

  function removeJob(id: string) {
    mutate(js => js.filter(j => j.id !== id));
  }

  // Drop / input handlers
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(Array.from(e.dataTransfer.files));
  };
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); };
  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) { addFiles(Array.from(e.target.files)); e.target.value = ''; }
  };

  const hasJobs   = jobs.length > 0;
  const doneJobs  = jobs.filter(j => j.state === 'done');
  const activeCount = jobs.filter(j => j.state === 'pending' || j.state === 'converting').length;
  const compact   = hasJobs;

  return (
    <div style={{ maxWidth: 660, margin: '0 auto' }}>

      {/* Optional header strip for fixed-mode (converter pages) */}
      {fixedFrom && fixedTo && (
        <div style={{
          padding: '12px 20px',
          borderRadius: '10px 10px 0 0',
          border: '1px solid var(--border)',
          borderBottom: 'none',
          background: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="format-badge">.{fixedFrom}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
            <span className="format-badge">.{fixedTo}</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--muted)' }}>
            Multiple files supported
          </span>
        </div>
      )}

      {/* Dropzone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`dropzone ${dragging ? 'drag-over' : ''}`}
        style={{
          position: 'relative',
          minHeight: compact ? 68 : 220,
          transition: 'min-height 0.3s ease',
          borderRadius: fixedFrom ? (compact ? '0' : '0') : (compact ? '10px 10px 0 0' : '10px'),
          display: 'flex',
          flexDirection: compact ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: compact ? 'flex-start' : 'center',
          gap: compact ? 12 : 0,
          padding: compact ? '0 20px' : 0,
        }}
      >
        <input
          type="file"
          multiple
          accept={mimeIn?.join(',') ?? '*/*'}
          onChange={onInput}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 2, width: '100%', height: '100%' }}
        />
        {/* Upload icon */}
        <div style={{
          width: compact ? 32 : 52, height: compact ? 32 : 52,
          borderRadius: compact ? 8 : 10,
          border: `1.5px solid ${dragging ? 'var(--accent)' : 'var(--border-light)'}`,
          background: dragging ? 'rgba(232,145,45,0.08)' : 'var(--elevated)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, transition: 'all 0.25s ease', pointerEvents: 'none',
        }}>
          <svg width={compact ? 14 : 22} height={compact ? 14 : 22} viewBox="0 0 24 24" fill="none" stroke={dragging ? 'var(--accent)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        {/* Text */}
        <div style={{ pointerEvents: 'none' }}>
          <p style={{ color: dragging ? 'var(--accent)' : 'var(--text)', fontWeight: 500, fontSize: compact ? '0.82rem' : '0.9rem', margin: 0 }}>
            {dragging
              ? 'Drop to add'
              : compact
                ? 'Drop more files to add to queue'
                : smart
                  ? 'Drop any file - format detected automatically'
                  : `Drop .${fixedFrom?.toUpperCase()} files to convert`}
          </p>
          {!compact && (
            <p style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: 4 }}>
              {smart
                ? 'Multiple files supported · Convert each to your chosen format'
                : 'Drop multiple files at once - they\'ll be converted sequentially'}
            </p>
          )}
        </div>
        {!compact && (
          <p style={{ position: 'absolute', bottom: 16, color: 'var(--muted)', fontSize: '0.72rem', letterSpacing: '0.03em', pointerEvents: 'none' }}>
            Processed entirely in your browser - never uploaded
          </p>
        )}
      </div>

      {/* Jobs list */}
      {hasJobs && (
        <div style={{
          border: '1px solid var(--border)',
          borderTop: 'none',
          borderRadius: fixedFrom ? '0' : '0 0 0 0',
          overflow: 'hidden',
        }}>
          {jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              smart={smart}
              onPickFormat={(t) => pickFormat(job.id, t)}
              onDownload={() => downloadOne(job)}
              onRetry={() => retryJob(job.id)}
              onRemove={() => removeJob(job.id)}
            />
          ))}
        </div>
      )}

      {/* Footer: bulk actions */}
      {hasJobs && (
        <div style={{
          marginTop: 0,
          padding: '10px 16px',
          border: '1px solid var(--border)',
          borderTop: '1px solid var(--border)',
          borderRadius: fixedFrom ? '0 0 10px 10px' : '0 0 10px 10px',
          background: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}>
          {doneJobs.length >= 2 && (
            <button
              className="btn-primary"
              onClick={downloadZip}
              style={{ fontSize: '0.78rem', padding: '0.45rem 1rem', gap: 6 }}
            >
              <DownloadIcon size={12} />
              Download {doneJobs.length} files as .zip
            </button>
          )}
          {doneJobs.length === 1 && (
            <button
              className="btn-primary"
              onClick={() => downloadOne(doneJobs[0])}
              style={{ fontSize: '0.78rem', padding: '0.45rem 1rem', gap: 6 }}
            >
              <DownloadIcon size={12} />
              Download .{doneJobs[0].to}
            </button>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {activeCount > 0 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--muted)' }}>
                {activeCount} converting...
              </span>
            )}
            {activeCount === 0 && (
              <button
                className="btn-ghost"
                onClick={() => mutate(() => [])}
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.8rem' }}
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Privacy pills - only when idle (no jobs) */}
      {!hasJobs && (
        <div style={{
          padding: '10px 20px',
          border: '1px solid var(--border)',
          borderTop: 'none',
          borderRadius: fixedFrom ? '0 0 10px 10px' : '0 0 10px 10px',
          background: 'var(--surface)',
          display: 'flex',
          gap: 20,
          alignItems: 'center',
        }}>
          <Pill icon="🔒" label="No uploads" />
          <Pill icon="⚡" label="WebAssembly" />
          <Pill icon="💻" label="Runs locally" />
        </div>
      )}
    </div>
  );
}

// ─── JobRow ───────────────────────────────────────────────────────────────────

function JobRow({
  job,
  smart,
  onPickFormat,
  onDownload,
  onRetry,
  onRemove,
}: {
  job: Job;
  smart: boolean;
  onPickFormat: (t: ConverterPair) => void;
  onDownload: () => void;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const name = job.file.name;
  const displayName = name.length > 34 ? name.slice(0, 22) + '...' + name.slice(-8) : name;

  let stateIcon: React.ReactNode;
  if (job.state === 'converting' || job.state === 'pending') {
    stateIcon = (
      <div style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid var(--border-light)', borderTopColor: job.state === 'converting' ? 'var(--accent)' : 'var(--faint)', animation: job.state === 'converting' ? 'spin-slow 0.9s linear infinite' : 'none', flexShrink: 0 }} />
    );
  } else if (job.state === 'done') {
    stateIcon = (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  } else if (job.state === 'error') {
    stateIcon = (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
  } else {
    // awaiting-format
    stateIcon = (
      <div style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid var(--border-light)', flexShrink: 0 }} />
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 16px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      flexWrap: 'wrap',
      minHeight: 50,
    }}>
      {/* State indicator */}
      {stateIcon}

      {/* Filename */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 140px', minWidth: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}
        </span>
        <span className="format-badge">.{job.from}</span>
      </div>

      {/* Middle: format picker / progress / done / error */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '2 1 200px', flexWrap: 'wrap' }}>

        {job.state === 'awaiting-format' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <ArrowIcon />
            {job.availableTargets.map(t => (
              <FormatButton key={t.to} label={`.${t.to}`} onClick={() => onPickFormat(t)} />
            ))}
          </div>
        )}

        {(job.state === 'pending' || job.state === 'converting') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            {job.to && <><ArrowIcon /><span className="format-badge" style={{ color: 'var(--muted)' }}>.{job.to}</span></>}
            <div style={{ flex: 1, minWidth: 70 }}>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${job.progress}%` }} />
              </div>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.63rem', color: 'var(--muted)', flexShrink: 0 }}>
              {job.state === 'pending' ? 'Queued' : `${job.progress}%`}
            </span>
          </div>
        )}

        {job.state === 'done' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowIcon />
            <span className="format-badge" style={{ color: 'var(--success)', borderColor: 'rgba(94,206,122,0.3)' }}>.{job.to}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.63rem', color: 'var(--success)' }}>Ready</span>
          </div>
        )}

        {job.state === 'error' && (
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--error)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {job.errorMsg}
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 'auto' }}>
        {job.state === 'done' && (
          <button
            onClick={onDownload}
            style={{ fontFamily: 'var(--font-sans)', fontSize: '0.73rem', fontWeight: 600, padding: '4px 11px', borderRadius: 5, border: '1px solid rgba(94,206,122,0.3)', background: 'rgba(94,206,122,0.07)', color: 'var(--success)', cursor: 'pointer', minHeight: 30 }}
          >
            ↓ .{job.to}
          </button>
        )}
        {job.state === 'error' && job.to && (
          <button
            onClick={onRetry}
            style={{ fontFamily: 'var(--font-sans)', fontSize: '0.72rem', padding: '4px 10px', borderRadius: 5, border: '1px solid var(--border-light)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', minHeight: 28 }}
          >
            Retry
          </button>
        )}
        <button
          onClick={onRemove}
          title="Remove"
          style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--faint)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--error)'; e.currentTarget.style.color = 'var(--error)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--faint)'; }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function FormatButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 3, background: 'var(--elevated)', border: '1px solid var(--border-light)', color: 'var(--muted)', cursor: 'pointer', minHeight: 28, transition: 'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = 'var(--muted)'; }}
    >
      {label}
    </button>
  );
}

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function DownloadIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function Pill({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: '0.7rem' }}>{icon}</span>
      <span style={{ color: 'var(--muted)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.03em' }}>{label}</span>
    </div>
  );
}
