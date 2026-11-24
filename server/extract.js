import path from 'node:path';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import WordExtractor from 'word-extractor';
// Import the lib file directly: pdf-parse's index.js runs a debug routine when imported in ESM.
import pdf from 'pdf-parse/lib/pdf-parse.js';

export class UserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const IMAGE_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

export const SUPPORTED_EXT = [
  '.pdf', '.docx', '.doc', '.txt', '.md', '.rtf', '.html', '.htm',
  ...Object.keys(IMAGE_MIME),
];

const MAX_CHARS = 60000;

function clean(text) {
  return String(text || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_CHARS);
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

function stripHtml(html) {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );
}

function stripRtf(rtf) {
  return rtf
    .replace(/\{\\\*[^{}]*\}/g, '')
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\tab/g, '\t')
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '');
}

// Reads text straight from the DOCX XML: includes headers, footers, tables and text boxes
// (many resume templates put contact details in the header or a text box, which mammoth skips).
async function docxXmlText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files).filter((n) =>
    /^word\/(document|header\d*|footer\d*)\.xml$/.test(n)
  );
  const parts = [];
  for (const name of names.sort()) {
    let xml = await zip.files[name].async('string');
    xml = xml.replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, ''); // text boxes appear twice otherwise
    const text = xml
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<\/w:tc>/g, ' | ')
      .replace(/<[^>]+>/g, '');
    parts.push({ name, text: decodeEntities(text) });
  }
  return parts;
}

async function extractDocx(buffer) {
  let main = '';
  try {
    main = (await mammoth.extractRawText({ buffer })).value || '';
  } catch {
    /* fall through to raw XML */
  }
  let parts = [];
  try {
    parts = await docxXmlText(buffer);
  } catch {
    /* ignore */
  }
  const rawBody = parts.find((p) => p.name === 'word/document.xml')?.text || '';
  const extras = parts
    .filter((p) => p.name !== 'word/document.xml')
    .map((p) => p.text.trim())
    .filter(Boolean);

  // If mammoth missed a lot (text boxes etc.), prefer the raw XML body.
  const body = rawBody.length > main.length * 1.25 ? rawBody : main || rawBody;
  return [...extras, body].join('\n');
}

export async function extractFromFile({ originalname, buffer }) {
  const ext = path.extname(originalname || '').toLowerCase();
  if (!SUPPORTED_EXT.includes(ext)) {
    throw new UserError(
      `Unsupported file type "${ext || 'unknown'}". Supported: ${SUPPORTED_EXT.join(', ')}`
    );
  }

  if (IMAGE_MIME[ext]) {
    return { kind: 'image', image: { mime: IMAGE_MIME[ext], base64: buffer.toString('base64') } };
  }

  let text = '';
  try {
    switch (ext) {
      case '.pdf':
        text = (await pdf(buffer)).text;
        break;
      case '.docx':
        text = await extractDocx(buffer);
        break;
      case '.doc': {
        const doc = await new WordExtractor().extract(buffer);
        text = [doc.getHeaders({ includeFooters: true }), doc.getBody()].join('\n');
        break;
      }
      case '.rtf':
        text = stripRtf(buffer.toString('utf8'));
        break;
      case '.html':
      case '.htm':
        text = stripHtml(buffer.toString('utf8'));
        break;
      default:
        text = buffer.toString('utf8');
    }
  } catch (err) {
    throw new UserError(
      `Could not read "${originalname}" (${err.message}). The file may be corrupted or password-protected.`
    );
  }

  text = clean(text);
  if (text.length < 40) {
    throw new UserError(
      ext === '.pdf'
        ? 'This PDF has no readable text (it looks like a scanned image). Upload it as a PNG/JPG screenshot instead, or use a text-based PDF.'
        : 'No readable text found in this file.'
    );
  }
  return { kind: 'text', text };
}
