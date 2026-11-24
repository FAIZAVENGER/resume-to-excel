import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { extractFromFile, UserError, SUPPORTED_EXT } from './extract.js';
import { parseResume, groqConfigured, activeModels } from './groq.js';
import { buildWorkbook } from './excel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config(); // also allow server/.env

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});
const exportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, fieldSize: 20 * 1024 * 1024, files: 1 },
});

// Browsers send UTF-8 names that multer reads as latin1.
const fixName = (n) => Buffer.from(n || 'resume', 'latin1').toString('utf8');

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    groqConfigured: groqConfigured(),
    models: activeModels(),
    supported: SUPPORTED_EXT,
  });
});

app.post('/api/parse', resumeUpload.single('resume'), async (req, res, next) => {
  try {
    if (!req.file) throw new UserError('No file received.');
    const originalname = fixName(req.file.originalname);
    const extracted = await extractFromFile({ originalname, buffer: req.file.buffer });
    const data = await parseResume({ ...extracted, jobContext: req.body?.jobContext });
    res.json({ data, meta: { fileName: originalname, kind: extracted.kind } });
  } catch (err) {
    next(err);
  }
});

app.post('/api/export', exportUpload.single('workbook'), async (req, res, next) => {
  try {
    let rows;
    try {
      rows = JSON.parse(req.body?.rows || '[]');
    } catch {
      throw new UserError('Invalid rows payload.');
    }
    if (!Array.isArray(rows) || rows.length === 0) throw new UserError('There are no candidates to export.');
    const buffer = await buildWorkbook(rows, req.file?.buffer);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="candidates.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built React app (production / Render).
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong.';
  if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (limit 10 MB).' : err.message;
  } else if (!(err instanceof UserError)) {
    console.error(err);
    if (status === 500) message = 'Unexpected server error. Check the server logs.';
  }
  res.status(status).json({ error: message });
});

const port = process.env.PORT || 5000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Resume to Excel server running on http://localhost:${port}`);
  if (!groqConfigured()) console.warn('GROQ_API_KEY is not set. Resume parsing will not work until you add it to .env');
});
