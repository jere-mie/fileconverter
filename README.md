# File Converter

A browser-based file converter powered by WebAssembly. Convert video, audio, images, and documents in your browser without uploading the selected files to any server.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/github-jere--mie%2Ffileconverter-lightgrey?logo=github)](https://github.com/jere-mie/fileconverter)

## Features

- **Local file processing** - selected files are processed in your browser and are not uploaded to the app's server
- **75+ conversion formats** across video, audio, image, document, and data
- **Bulk conversion** - drop multiple files at once, download as ZIP
- **Runs locally after load** - once the page assets are loaded, conversions happen inside the current browser tab
- **No accounts, no tracking, no telemetry**

## Supported Conversions

| Category | Conversions |
|----------|-------------|
| Video    | MP4 → MP3/WebM/GIF/MOV, AVI → MP4/GIF, MOV → MP4/MP3/WebM/GIF, MKV → MP4/MP3/WebM, WebM → MP4/MP3/GIF |
| Audio    | WAV → MP3/OGG/FLAC, MP3 → WAV/OGG/FLAC, M4A → MP3/WAV, AAC → MP3, FLAC → MP3/M4A/WAV, OGG → MP3/WAV |
| Image    | PNG/JPG/WebP/SVG → ICO, PNG ↔ JPG/WebP/AVIF, JPG ↔ WebP/AVIF, WebP ↔ PNG/JPG, HEIC/HEIF → JPG/PNG/WebP, AVIF → JPG/PNG, SVG → PNG/JPG |
| Document | MD → HTML/TXT/PDF, HTML → MD/TXT/PDF, DOCX → HTML/MD/PDF/TXT, PDF → PNG/JPG/TXT |
| Data     | CSV → JSON/YAML, JSON → CSV/XML/YAML, XLSX → CSV/JSON, YAML → JSON, XML → JSON/YAML |

## How It Works

1. **Drop your file** - Drag and drop onto the converter, or click to browse. No size limits - your RAM is the only constraint.
2. **Engine loads** - The page loads its conversion code and WebAssembly assets into your browser tab.
3. **Conversion runs** - Processing happens locally. Progress is reported in real time.
4. **Download** - Your converted file is handed back immediately. The app does not upload the selected file to its server.

## Tech Stack

- [Astro](https://astro.build) - static site generation with `client:load` islands
- [React](https://react.dev) - hydrated interactive components only
- [Tailwind CSS v4](https://tailwindcss.com) - utility-first styling
- [@ffmpeg/ffmpeg](https://ffmpegwasm.netlify.app) - FFmpeg compiled to WebAssembly for video/audio
- [marked](https://marked.js.org) + [turndown](https://github.com/mixmark-io/turndown) + [mammoth](https://github.com/mwilliamson/mammoth.js) - document conversion (MD, HTML, DOCX)
- [jsPDF](https://github.com/parallax/jsPDF) + [pdfjs-dist](https://github.com/mozilla/pdf.js) - PDF generation and rendering
- [SheetJS (xlsx)](https://sheetjs.com) - XLSX parsing (vendored tarball)
- [js-yaml](https://github.com/nodeca/js-yaml) + [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) - YAML and XML data conversion
- [heic2any](https://github.com/alexcorvi/heic2any) - HEIC/HEIF decoding
- [JSZip](https://stuk.github.io/jszip) - client-side ZIP generation
- Deployed on [GitHub Pages](https://pages.github.com)

## Development

```sh
# Install dependencies
npm install

# Start dev server (localhost:4321)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The project vendors the SheetJS `xlsx` tarball at `vendor/xlsx-0.20.3.tgz` because the public npm registry package is stale. If you need to update it, replace the tarball and update the dependency entry in `package.json`.

> **Note:** The dev server requires `Cross-Origin-Embedder-Policy` and `Cross-Origin-Opener-Policy` headers for `SharedArrayBuffer` (used by FFmpeg WASM). These are set automatically via `astro.config.mjs` in development. In production on GitHub Pages (which cannot set custom response headers), `public/coi-serviceworker.js` injects them via a service worker.

## Deployment

- Canonical production URL: `https://fileconverter.zxcv.fyi`
- GitHub Pages deploys through `.github/workflows/deploy-pages.yml` using Node 24
- GitHub Pages cannot send the required COOP/COEP headers, so the site registers `public/coi-serviceworker.js` to apply them through a service worker on supported browsers
- `public/CNAME` sets the custom domain for GitHub Pages

## Project Structure

```
src/
├── data/converters.ts          # All 75 conversion pairs - single source of truth
├── engines/
│   ├── imageEngine.ts          # Canvas API + heic2any image conversion
│   ├── documentEngine.ts       # marked / turndown / mammoth (all lazy-loaded)
│   ├── pdfEngine.ts            # jsPDF (generation) + pdfjs-dist (rendering)
│   └── dataEngine.ts           # SheetJS / js-yaml / fast-xml-parser
├── workers/ffmpeg.worker.ts    # FFmpeg WASM in a Web Worker
├── components/islands/
│   └── BulkConverterIsland.tsx # Main converter UI (queue, bulk, ZIP)
└── pages/
    ├── index.astro             # Landing page
    └── convert/[from]-to-[to].astro  # 75 SEO converter pages
```

## License

[MIT](LICENSE) © [jere-mie](https://github.com/jere-mie)
