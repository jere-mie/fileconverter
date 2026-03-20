# File Converter

A browser-based file converter powered by WebAssembly. Convert video, audio, images, and documents in your browser without uploading the selected files to any server.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/github-jere--mie%2Ffileconverter-lightgrey?logo=github)](https://github.com/jere-mie/fileconverter)

## Features

- **Local file processing** - selected files are processed in your browser and are not uploaded to the app's server
- **25+ conversion formats** across video, audio, image, and document
- **Bulk conversion** - drop multiple files at once, download as ZIP
- **Runs locally after load** - once the page assets are loaded, conversions happen inside the current browser tab
- **No accounts, no tracking, no telemetry**

## Supported Conversions

| Category | Conversions |
|----------|-------------|
| Video    | MP4 → MP3, MP4 → WebM, MP4 → GIF, AVI → MP4, MOV → MP4, MKV → MP4, WebM → MP4 |
| Audio    | WAV → MP3, MP3 → WAV, FLAC → MP3, OGG → MP3, MP3 → OGG |
| Image    | PNG ↔ JPG, PNG ↔ WebP, JPG ↔ WebP |
| Document | MD ↔ HTML, MD → TXT, HTML → MD, HTML → TXT, DOCX → HTML, DOCX → MD, DOCX → TXT |

## How It Works

1. **Drop your file** - Drag and drop onto the converter, or click to browse. No size limits - your RAM is the only constraint.
2. **Engine loads** - The page loads its conversion code and WebAssembly assets into your browser tab.
3. **Conversion runs** - Processing happens locally. Progress is reported in real time.
4. **Download** - Your converted file is handed back immediately. The app does not upload the selected file to its server.

## Tech Stack

- [Astro](https://astro.build) - static site generation with `client:visible` islands for lazy hydration
- [React](https://react.dev) - hydrated interactive components only
- [Tailwind CSS v4](https://tailwindcss.com) - utility-first styling
- [@ffmpeg/ffmpeg](https://ffmpegwasm.netlify.app) - FFmpeg compiled to WebAssembly for video/audio
- [marked](https://marked.js.org) + [turndown](https://github.com/mixmark-io/turndown) + [mammoth](https://github.com/mwilliamson/mammoth.js) - lightweight document conversion
- [JSZip](https://stuk.github.io/jszip) - client-side ZIP generation
- Deployed on [Cloudflare Pages](https://pages.cloudflare.com)

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

> **Note:** The dev server requires `Cross-Origin-Embedder-Policy` and `Cross-Origin-Opener-Policy` headers for `SharedArrayBuffer` (used by FFmpeg WASM). These are set automatically via `astro.config.mjs`. For production, they are set in `public/_headers` (Cloudflare Pages).

## Deployment

- Canonical production URL: `https://fileconverter.zxcv.fyi`
- GitHub Pages deploys through `.github/workflows/deploy-pages.yml` using Node 24
- GitHub Pages cannot send the required COOP/COEP headers, so the site registers `public/coi-serviceworker.js` to apply them through a service worker on supported browsers
- `public/CNAME` sets the custom domain for GitHub Pages

## Project Structure

```
src/
├── data/converters.ts          # All 25 conversion pairs - single source of truth
├── engines/
│   ├── imageEngine.ts          # Canvas API image conversion
│   └── documentEngine.ts       # marked / turndown / mammoth (all lazy-loaded)
├── workers/ffmpeg.worker.ts    # FFmpeg WASM in a Web Worker
├── components/islands/
│   └── BulkConverterIsland.tsx # Main converter UI (queue, bulk, ZIP)
└── pages/
    ├── index.astro             # Landing page
    └── convert/[from]-to-[to].astro  # 25 SEO converter pages
```

## License

[MIT](LICENSE) © [jere-mie](https://github.com/jere-mie)
