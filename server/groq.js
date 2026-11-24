import { UserError } from './extract.js';

const baseUrl = () => (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, '');
const TEXT_MODEL = () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = () => process.env.GROQ_FALLBACK_MODEL || 'llama-3.1-8b-instant';
const VISION_MODEL = () => process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

// Free-tier Groq models have small per-minute token budgets, so keep the prompt compact.
const MAX_RESUME_CHARS = 14000;

export const groqConfigured = () => Boolean(process.env.GROQ_API_KEY);
export const activeModels = () => ({ text: TEXT_MODEL(), vision: VISION_MODEL() });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildSystemPrompt() {
  const today = new Date().toISOString().slice(0, 10);
  return `You are a recruitment data-extraction engine. You read one resume and answer with a single JSON object and nothing else.

Rules:
- Use only facts present in the resume. Never invent anything. Missing text value -> "", missing list -> [], missing number -> null.
- Today's date is ${today}. Treat "Present", "Current", "Till date" or "Ongoing" as today when computing durations.
- name: the candidate's full name as written on the resume (not a referee, not the file name).
- contactNumber: the candidate's primary mobile number, with country code if written.
- email: the candidate's primary email address.
- totalExperienceYears: total professional work experience in years as a decimal number (for example 4.5). Compute it from the employment date ranges, merging overlapping periods. Exclude internships/trainee periods unless they are the only experience. If the dates and a stated total (such as "7+ years") disagree, trust the dates. A fresher gets 0.
- relevantExperienceYears: if a job requirement is provided, the years of experience that are relevant to it. Otherwise the years of experience in the candidate's primary skill area. Decimal number, never larger than totalExperienceYears.
- skills: the 4 to 8 PRIMARY technical skills or technologies that define this candidate's profile (for example "Java", "React", "SAP FICO", "Manual Testing"). Short names only.
- subSkills: up to 15 SECONDARY tools, frameworks, libraries, databases, cloud services, or methodologies. Do not repeat items from skills.
- education: every qualification, highest first, each with degree, specialization or institution when available, and the passing year, e.g. "B.Tech (CSE) - ABC University - 2018; 12th - 2014". Separate entries with "; ".
- currentCompany: the employer of the most recent or current job.
- clientsWorked: names of end clients or customers the candidate delivered projects for (look for "Client:", "Customer:", "for <company>" in project descriptions). Do not list the candidate's own employers unless the resume explicitly calls them clients. [] if none.

Return JSON with exactly these keys: name, contactNumber, email, totalExperienceYears, relevantExperienceYears, skills, subSkills, education, currentCompany, clientsWorked.`;
}

function userInstruction(jobContext) {
  const jd = String(jobContext || '').trim().slice(0, 2000);
  return jd
    ? `Job requirement (use it for relevantExperienceYears):\n${jd}\n\n`
    : 'No job requirement was provided.\n\n';
}

async function callGroq({ model, messages, json }) {
  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0,
      max_tokens: 1800,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.error?.message || '';
    } catch {
      /* ignore */
    }
    const err = new Error(detail || `Groq request failed (${res.status})`);
    err.status = res.status;
    err.retryAfter = Number(res.headers.get('retry-after')) || 0;
    throw err;
  }
  const body = await res.json();
  return body?.choices?.[0]?.message?.content ?? '';
}

// Primary model -> wait once on rate limit -> fallback model.
async function callWithFallback({ messages, model, fallback, json }) {
  try {
    return await callGroq({ model, messages, json });
  } catch (err) {
    if (err.status === 401) {
      throw new UserError('Groq rejected the API key. Check GROQ_API_KEY in your .env file.', 401);
    }
    if (err.status === 429) {
      await sleep(Math.min(Math.max(err.retryAfter, 2), 10) * 1000);
      try {
        return await callGroq({ model, messages, json });
      } catch (err2) {
        if (err2.status !== 429 || !fallback) {
          throw new UserError('Groq rate limit reached. Wait a minute and retry.', 429);
        }
      }
    }
    if (fallback && [400, 404, 413, 429, 500, 503].includes(err.status)) {
      try {
        return await callGroq({ model: fallback, messages, json });
      } catch (err3) {
        throw new UserError(`Groq error: ${err3.message}`, 502);
      }
    }
    throw new UserError(`Groq error: ${err.message}`, 502);
  }
}

function parseJson(raw) {
  const text = String(raw || '').trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
  }
  throw new UserError('The AI returned an unreadable answer. Please retry.', 502);
}

// ---------- normalisation ----------
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function findEmail(text) {
  return text.match(EMAIL_RE)?.[0] || '';
}

function findPhone(text) {
  const candidates = text.match(/\+?\d[\d\s().-]{8,16}\d/g) || [];
  for (const c of candidates) {
    const digits = c.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 13 && !/^(19|20)\d{2}/.test(digits)) return c.trim();
  }
  return '';
}

const str = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());

function years(v) {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > 60) return '';
  return String(Math.round(n * 10) / 10);
}

function list(v, max) {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,;\n]/) : [];
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const s = str(typeof item === 'object' && item ? Object.values(item)[0] : item);
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
  }
  return out.slice(0, max);
}

function titleCaseIfShouting(name) {
  if (name && name === name.toUpperCase()) {
    return name.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  }
  return name;
}

export function normalize(raw, sourceText = '') {
  const education = Array.isArray(raw.education)
    ? raw.education.map((e) => (typeof e === 'string' ? e : Object.values(e || {}).join(' - '))).join('; ')
    : str(raw.education);

  let total = years(raw.totalExperienceYears);
  let relevant = years(raw.relevantExperienceYears);
  if (total && relevant && Number(relevant) > Number(total)) relevant = total;

  const skills = list(raw.skills, 8);
  const skillSet = new Set(skills.map((s) => s.toLowerCase()));

  return {
    name: titleCaseIfShouting(str(raw.name)),
    contactNumber: str(raw.contactNumber) || findPhone(sourceText),
    email: str(raw.email) || findEmail(sourceText),
    totalExperience: total,
    relevantExperience: relevant,
    skill: skills,
    subSkill: list(raw.subSkills, 15).filter((s) => !skillSet.has(s.toLowerCase())),
    education,
    currentCompany: str(raw.currentCompany),
    clientsWorked: list(raw.clientsWorked, 12),
  };
}

// ---------- public API ----------
export async function parseResume({ kind, text, image, jobContext }) {
  if (!groqConfigured()) {
    throw new UserError(
      'GROQ_API_KEY is not set. Create a .env file in the project root with GROQ_API_KEY=your_key and restart the server.',
      500
    );
  }

  if (kind === 'image') {
    const content = [
      { type: 'text', text: `${userInstruction(jobContext)}The resume is the attached image. Read it and return the JSON.` },
      { type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.base64}` } },
    ];
    const raw = await callWithFallback({
      model: VISION_MODEL(),
      fallback: null,
      json: false,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content },
      ],
    });
    return normalize(parseJson(raw), '');
  }

  const clipped = text.slice(0, MAX_RESUME_CHARS);
  const raw = await callWithFallback({
    model: TEXT_MODEL(),
    fallback: FALLBACK_MODEL(),
    json: true,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: `${userInstruction(jobContext)}RESUME:\n"""\n${clipped}\n"""` },
    ],
  });
  return normalize(parseJson(raw), text);
}
