# DocuView

**DocuView** is a private, mobile-friendly document reader that opens common office documents directly in the browser.

## Supported formats

- PDF
- Word **DOCX**
- Excel **XLSX / XLS**
- CSV
- TXT

Legacy binary Word **.doc** files are not converted by the browser-only reader yet.

## Reader features

- Local file opening and drag & drop
- PDF pages, thumbnails, zoom, fit-to-width, rotation and fullscreen
- PDF text search
- DOCX semantic HTML rendering
- Excel workbook sheet tabs and spreadsheet tables
- CSV table viewing
- Plain-text reading
- Print and download
- Dark/light theme
- Mobile responsive design
- Installable PWA for phones
- File Handling API support where the browser provides it
- No application server and no document upload

## Phone use

Open the GitHub Pages site in Chrome on Android and choose **Add to Home screen / Install app**. After installation, DocuView can act as a single reader for the supported document formats.

The Word and Excel viewers use browser libraries loaded from CDN; the document contents remain in the browser and are not sent to an application backend.

## Local development

Serve the repository with a local web server:

```bash
python3 -m http.server 8000
```

Then open:

`http://localhost:8000`

## Libraries

- PDF.js for PDF rendering
- Mammoth for DOCX → HTML conversion
- SheetJS for XLS/XLSX/CSV parsing

The deployed frontend pins the browser library versions in its HTML.
