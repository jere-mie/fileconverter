import { useCallback, useState } from 'react';

interface Props {
  onFile: (file: File) => void;
  accept: string[];
  disabled?: boolean;
  fromFormat: string;
}

export default function FileDropzone({ onFile, accept, disabled = false, fromFormat }: Props) {
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback(
    (file: File) => {
      if (!disabled) onFile(file);
    },
    [onFile, disabled],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [disabled, processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset so same file can be re-selected
      e.target.value = '';
    },
    [processFile],
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`dropzone ${isDragging ? 'drag-over' : ''} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      style={{ minHeight: 220 }}
    >
      <input
        type="file"
        id="file-converter-input"
        accept={accept.join(',')}
        onChange={handleChange}
        disabled={disabled}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          width: '100%',
          height: '100%',
          zIndex: 2,
        }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '32px 24px',
          textAlign: 'center',
          pointerEvents: 'none',
          width: '100%',
        }}
      >
        {/* Upload icon */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 10,
            border: `1.5px solid ${isDragging ? 'var(--accent)' : 'var(--border-light)'}`,
            background: isDragging ? 'rgba(232,145,45,0.08)' : 'var(--elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isDragging ? 'var(--accent)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <div>
          <p style={{ color: 'var(--text)', fontWeight: 500, fontSize: '0.9rem', marginBottom: 4 }}>
            {isDragging ? 'Drop it here' : 'Drop your file or click to browse'}
          </p>
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
            Accepts{' '}
            <span className="format-badge" style={{ fontSize: '0.65rem' }}>
              .{fromFormat}
            </span>
          </p>
        </div>

        <p style={{ color: 'var(--faint)', fontSize: '0.72rem', letterSpacing: '0.03em' }}>
          Processed entirely in your browser - never uploaded
        </p>
      </div>
    </div>
  );
}
