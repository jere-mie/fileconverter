export type Category = 'video' | 'audio' | 'image' | 'document' | 'data';
export type Engine = 'ffmpeg' | 'image' | 'document' | 'data' | 'pdf';

export interface ConverterPair {
  from: string;
  to: string;
  engine: Engine;
  category: Category;
  mimeIn: string[];
}

export const converters: ConverterPair[] = [
  // Video
  { from: 'mp4',  to: 'mp3',  engine: 'ffmpeg', category: 'audio', mimeIn: ['video/mp4'] },
  { from: 'mp4',  to: 'webm', engine: 'ffmpeg', category: 'video', mimeIn: ['video/mp4'] },
  { from: 'mp4',  to: 'gif',  engine: 'ffmpeg', category: 'video', mimeIn: ['video/mp4'] },
  { from: 'avi',  to: 'mp4',  engine: 'ffmpeg', category: 'video', mimeIn: ['video/avi', 'video/x-msvideo'] },
  { from: 'avi',  to: 'gif',  engine: 'ffmpeg', category: 'video', mimeIn: ['video/avi', 'video/x-msvideo'] },
  { from: 'mov',  to: 'mp4',  engine: 'ffmpeg', category: 'video', mimeIn: ['video/quicktime'] },
  { from: 'mov',  to: 'mp3',  engine: 'ffmpeg', category: 'audio', mimeIn: ['video/quicktime'] },
  { from: 'mov',  to: 'webm', engine: 'ffmpeg', category: 'video', mimeIn: ['video/quicktime'] },
  { from: 'mkv',  to: 'mp4',  engine: 'ffmpeg', category: 'video', mimeIn: ['video/x-matroska'] },
  { from: 'mkv',  to: 'mp3',  engine: 'ffmpeg', category: 'audio', mimeIn: ['video/x-matroska'] },
  { from: 'mkv',  to: 'webm', engine: 'ffmpeg', category: 'video', mimeIn: ['video/x-matroska'] },
  { from: 'webm', to: 'mp4',  engine: 'ffmpeg', category: 'video', mimeIn: ['video/webm'] },
  { from: 'webm', to: 'mp3',  engine: 'ffmpeg', category: 'audio', mimeIn: ['video/webm'] },
  { from: 'webm', to: 'gif',  engine: 'ffmpeg', category: 'video', mimeIn: ['video/webm'] },
  // Audio
  { from: 'wav',  to: 'mp3',  engine: 'ffmpeg', category: 'audio', mimeIn: ['audio/wav', 'audio/wave', 'audio/x-wav'] },
  { from: 'wav',  to: 'ogg',  engine: 'ffmpeg', category: 'audio', mimeIn: ['audio/wav', 'audio/wave', 'audio/x-wav'] },
  { from: 'wav',  to: 'flac', engine: 'ffmpeg', category: 'audio', mimeIn: ['audio/wav', 'audio/wave', 'audio/x-wav'] },
  { from: 'm4a',  to: 'mp3',  engine: 'ffmpeg', category: 'audio', mimeIn: ['audio/mp4', 'audio/x-m4a'] },
  { from: 'm4a',  to: 'wav',  engine: 'ffmpeg', category: 'audio', mimeIn: ['audio/mp4', 'audio/x-m4a'] },
  { from: 'aac',  to: 'mp3',  engine: 'ffmpeg', category: 'audio', mimeIn: ['audio/aac', 'audio/x-aac'] },
  { from: 'mp3',  to: 'wav',  engine: 'ffmpeg', category: 'audio', mimeIn: ['audio/mpeg', 'audio/mp3'] },
  { from: 'mp3',  to: 'ogg',  engine: 'ffmpeg', category: 'audio', mimeIn: ['audio/mpeg', 'audio/mp3'] },
  { from: 'mp3',  to: 'flac', engine: 'ffmpeg', category: 'audio', mimeIn: ['audio/mpeg', 'audio/mp3'] },
  { from: 'flac', to: 'mp3',  engine: 'ffmpeg', category: 'audio', mimeIn: ['audio/flac', 'audio/x-flac'] },
  { from: 'flac', to: 'm4a',  engine: 'ffmpeg', category: 'audio', mimeIn: ['audio/flac', 'audio/x-flac'] },
  { from: 'flac', to: 'wav',  engine: 'ffmpeg', category: 'audio', mimeIn: ['audio/flac', 'audio/x-flac'] },
  { from: 'ogg',  to: 'mp3',  engine: 'ffmpeg', category: 'audio', mimeIn: ['audio/ogg'] },
  { from: 'ogg',  to: 'wav',  engine: 'ffmpeg', category: 'audio', mimeIn: ['audio/ogg'] },
  // Image
  { from: 'png',  to: 'jpg',  engine: 'image', category: 'image', mimeIn: ['image/png'] },
  { from: 'png',  to: 'avif', engine: 'image', category: 'image', mimeIn: ['image/png'] },
  { from: 'jpg',  to: 'png',  engine: 'image', category: 'image', mimeIn: ['image/jpeg'] },
  { from: 'jpg',  to: 'avif', engine: 'image', category: 'image', mimeIn: ['image/jpeg'] },
  { from: 'heic', to: 'jpg',  engine: 'image', category: 'image', mimeIn: ['.heic', '.heif', 'image/heic', 'image/heif'] },
  { from: 'heic', to: 'png',  engine: 'image', category: 'image', mimeIn: ['.heic', '.heif', 'image/heic', 'image/heif'] },
  { from: 'heic', to: 'webp', engine: 'image', category: 'image', mimeIn: ['.heic', '.heif', 'image/heic', 'image/heif'] },
  { from: 'heif', to: 'jpg',  engine: 'image', category: 'image', mimeIn: ['.heic', '.heif', 'image/heic', 'image/heif'] },
  { from: 'heif', to: 'png',  engine: 'image', category: 'image', mimeIn: ['.heic', '.heif', 'image/heic', 'image/heif'] },
  { from: 'heif', to: 'webp', engine: 'image', category: 'image', mimeIn: ['.heic', '.heif', 'image/heic', 'image/heif'] },
  { from: 'avif', to: 'jpg',  engine: 'image', category: 'image', mimeIn: ['image/avif'] },
  { from: 'avif', to: 'png',  engine: 'image', category: 'image', mimeIn: ['image/avif'] },
  { from: 'webp', to: 'png',  engine: 'image', category: 'image', mimeIn: ['image/webp'] },
  { from: 'png',  to: 'webp', engine: 'image', category: 'image', mimeIn: ['image/png'] },
  { from: 'jpg',  to: 'webp', engine: 'image', category: 'image', mimeIn: ['image/jpeg'] },
  { from: 'webp', to: 'jpg',  engine: 'image', category: 'image', mimeIn: ['image/webp'] },
  { from: 'svg',  to: 'png',  engine: 'image', category: 'image', mimeIn: ['image/svg+xml'] },
  { from: 'svg',  to: 'jpg',  engine: 'image', category: 'image', mimeIn: ['image/svg+xml'] },
  { from: 'png',  to: 'ico',  engine: 'image', category: 'image', mimeIn: ['image/png'] },
  { from: 'jpg',  to: 'ico',  engine: 'image', category: 'image', mimeIn: ['image/jpeg'] },
  { from: 'webp', to: 'ico',  engine: 'image', category: 'image', mimeIn: ['image/webp'] },
  { from: 'svg',  to: 'ico',  engine: 'image', category: 'image', mimeIn: ['image/svg+xml'] },
  // Document
  { from: 'md',   to: 'html', engine: 'document', category: 'document', mimeIn: ['text/markdown', 'text/x-markdown', 'text/plain'] },
  { from: 'md',   to: 'txt',  engine: 'document', category: 'document', mimeIn: ['text/markdown', 'text/x-markdown', 'text/plain'] },
  { from: 'md',   to: 'pdf',  engine: 'pdf',      category: 'document', mimeIn: ['text/markdown', 'text/x-markdown', 'text/plain'] },
  { from: 'html', to: 'md',   engine: 'document', category: 'document', mimeIn: ['text/html'] },
  { from: 'html', to: 'txt',  engine: 'document', category: 'document', mimeIn: ['text/html'] },
  { from: 'html', to: 'pdf',  engine: 'pdf',      category: 'document', mimeIn: ['text/html'] },
  { from: 'docx', to: 'html', engine: 'document', category: 'document', mimeIn: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] },
  { from: 'docx', to: 'md',   engine: 'document', category: 'document', mimeIn: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] },
  { from: 'docx', to: 'pdf',  engine: 'pdf',      category: 'document', mimeIn: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] },
  { from: 'docx', to: 'txt',  engine: 'document', category: 'document', mimeIn: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] },
  { from: 'pdf',  to: 'png',  engine: 'pdf',      category: 'document', mimeIn: ['application/pdf'] },
  { from: 'pdf',  to: 'jpg',  engine: 'pdf',      category: 'document', mimeIn: ['application/pdf'] },
  { from: 'pdf',  to: 'txt',  engine: 'pdf',      category: 'document', mimeIn: ['application/pdf'] },
  // Data
  { from: 'csv',  to: 'json', engine: 'data', category: 'data', mimeIn: ['text/csv', 'text/plain'] },
  { from: 'csv',  to: 'yaml', engine: 'data', category: 'data', mimeIn: ['text/csv', 'text/plain'] },
  { from: 'json', to: 'csv',  engine: 'data', category: 'data', mimeIn: ['application/json', 'text/plain'] },
  { from: 'json', to: 'xml',  engine: 'data', category: 'data', mimeIn: ['application/json', 'text/plain'] },
  { from: 'json', to: 'yaml', engine: 'data', category: 'data', mimeIn: ['application/json', 'text/plain'] },
  { from: 'xlsx', to: 'csv',  engine: 'data', category: 'data', mimeIn: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] },
  { from: 'xlsx', to: 'json', engine: 'data', category: 'data', mimeIn: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] },
  { from: 'yaml', to: 'json', engine: 'data', category: 'data', mimeIn: ['application/x-yaml', 'text/yaml', 'text/plain'] },
  { from: 'xml',  to: 'json', engine: 'data', category: 'data', mimeIn: ['application/xml', 'text/xml', 'text/plain'] },
  { from: 'xml',  to: 'yaml', engine: 'data', category: 'data', mimeIn: ['application/xml', 'text/xml', 'text/plain'] },
  // Video
  { from: 'mp4',  to: 'mov',  engine: 'ffmpeg', category: 'video', mimeIn: ['video/mp4'] },
  { from: 'mov',  to: 'gif',  engine: 'ffmpeg', category: 'video', mimeIn: ['video/quicktime'] },
];

export function getConverter(from: string, to: string): ConverterPair | undefined {
  return converters.find(c => c.from === from && c.to === to);
}

export function getConvertersByFrom(from: string): ConverterPair[] {
  return converters.filter(c => c.from === from);
}

export const categoryLabels: Record<Category, string> = {
  video:    'Video',
  audio:    'Audio',
  image:    'Image',
  document: 'Doc',
  data:     'Data',
};

export const categoryIcons: Record<Category, string> = {
  video:    '▶',
  audio:    '♪',
  image:    '◈',
  document: '❑',
  data:     '⊞',
};

export const mimeOutputTypes: Record<string, string> = {
  mp3:  'audio/mpeg',
  wav:  'audio/wav',
  ogg:  'audio/ogg',
  flac: 'audio/flac',
  mp4:  'video/mp4',
  webm: 'video/webm',
  gif:  'image/gif',
  avi:  'video/x-msvideo',
  mov:  'video/quicktime',
  mkv:  'video/x-matroska',
  png:  'image/png',
  jpg:  'image/jpeg',
  webp: 'image/webp',
  ico:  'image/x-icon',
  avif: 'image/avif',
  html: 'text/html',
  md:   'text/markdown',
  txt:  'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf:  'application/pdf',
  csv:  'text/csv',
  json: 'application/json',
  yaml: 'text/yaml',
  xml:  'application/xml',
  m4a:  'audio/mp4',
  aac:  'audio/aac',
  svg:  'image/svg+xml',
};
