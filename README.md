# ResumeSheet

Upload a resume in any format, let Groq AI read it, fill in the remaining cells by hand, and download the row as Excel.

- **Frontend:** React (Vite)
- **Backend:** Node + Express (keeps your Groq key off the browser)
- **AI:** Groq API (free tier works)
- **Excel:** ExcelJS, either a fresh `.xlsx` or rows appended to your own workbook

## Run it locally

You need Node 18.17 or newer.

```bash
npm run install:all          # installs root, server and client packages
cp .env.example .env         # on Windows: copy .env.example .env
# open .env and paste your key: GROQ_API_KEY=gsk_...
npm run dev
```

Open http://localhost:5173. (The API runs on port 5000; Vite forwards `/api` calls to it.)

Get a free key at https://console.groq.com/keys.

## How the sheet is filled

| Column | Filled by |
|---|---|
| Name, Contact Number, Email ID | AI from the resume |
| Total Experience, Relevant Experience | AI from the resume (dates are totalled; "Job requirement" box guides relevant experience) |
| Skill, Sub Skill | AI from the resume (editable tags) |
| Education including Passed Year | AI from the resume |
| Current Company | AI from the resume |
| Clients Worked | AI from the resume (editable tags) |
| Source | Default `Naukri`, editable |
| Communication Skill, Technical Competency, Recruiter's Comments | Default `Good`, editable |
| Tracking History | Default `YES`, editable |
| Notice Period, Current/Preferred Location, Current/Expected CTC, Holding Offers | You type them |
| Upload Resume | File name of the uploaded resume |
| Recruiter Name | You type it once; the app remembers it |
| Submission Date | Defaults to today, editable |

Every required cell (marked *) must be filled before a row can be saved. The lettered strip above the form (A to X) mirrors the Excel columns and shows what is still empty.

Candidates are kept in your browser (localStorage) until you export them. Open the **Excel sheet** tab to:

- **Download Excel**: all rows, or only the ticked ones.
- **Add to my Excel file**: pick your existing `.xlsx`. New rows are appended to its first sheet, columns are matched by title, and any column your file lacks is added on the right. Nothing in your file is deleted.

## Supported resume formats

PDF (text-based), DOCX, DOC, TXT, MD, RTF, HTML, and images (PNG, JPG, WEBP, read with a Groq vision model). Scanned PDFs have no text layer: upload them as an image instead.

Word headers, footers, tables and text boxes are read too, since many templates keep contact details there.

## Change the column titles or order

- `server/fields.js`: Excel column titles and order (edit `header` to match your template).
- `client/src/fields.js`: form fields, defaults, labels, quick-pick chips.

If you reorder columns, update `EXCEL_ORDER` in `client/src/fields.js` to match.

## Groq models

Defaults (override in `.env` if Groq retires one, see https://console.groq.com/docs/models):

- `GROQ_MODEL=llama-3.3-70b-versatile`
- `GROQ_FALLBACK_MODEL=llama-3.1-8b-instant` (used automatically on rate limits)
- `GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct`

The free tier has per-minute limits, so multiple resumes are processed one after another.

## Deploy on Render

1. Push this folder to a GitHub repository (`.env` is git-ignored; never commit your key).
2. In Render: **New > Blueprint**, pick the repo. `render.yaml` sets everything up.
   Or **New > Web Service** manually with:
   - Build command: `npm run build`
   - Start command: `npm start`
   - Health check path: `/api/health`
3. Add the environment variable `GROQ_API_KEY` in the Render dashboard.

One service serves both the API and the built React app, so there is a single URL and no CORS setup.

Notes for the free Render plan: the service sleeps after inactivity (the first request afterwards takes about a minute), and the disk is not persistent. That is fine here because nothing is stored on the server; resumes are processed in memory and rows live in the browser until exported.

## Project layout

```
resume-to-excel/
  server/   Express API: extract.js (file to text), groq.js (AI + cleanup), excel.js, fields.js
  client/   React app: src/App.jsx, src/fields.js, src/components/*
  render.yaml, .env.example
```

## Good to know

- AI extraction is a first pass. Review the green "From resume" fields before saving, especially experience years and clients.
- Resumes are sent to Groq for processing. Check your privacy requirements before uploading candidate data.
