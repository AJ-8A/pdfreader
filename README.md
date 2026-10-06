# DocuView

A polished, browser-based document reader built around Mozilla PDF.js.

## Features

- Local PDF opening and drag-and-drop
- Page thumbnails
- Previous/next/page jump controls
- Search across PDF text
- Zoom and fit-to-width
- Page rotation
- Fullscreen mode
- Print and download
- Dark/light theme
- Mobile-friendly layout
- No server or file upload required

## Run

Because modern PDF.js uses browser modules and workers, serve the folder with a local web server instead of opening `index.html` directly.

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

PDF.js is loaded from its explicit browser build and worker CDN files.
