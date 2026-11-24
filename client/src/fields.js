// Single place that describes every Excel column and how its form field behaves.
//   origin: 'ai'      -> filled from the resume by Groq
//           'default' -> pre-filled, editable
//           'manual'  -> recruiter fills it in
export const SOURCES = ['Naukri', 'LinkedIn', 'Referral', 'Monster', 'Indeed', 'Job portal', 'Consultancy', 'Other'];

const F = (key, label, opts = {}) => ({ key, label, required: true, type: 'text', origin: 'manual', ...opts });

export const SECTIONS = [
  {
    id: 'candidate',
    title: 'Candidate',
    hint: 'Read from the resume',
    fields: [
      F('name', 'Name', { origin: 'ai', placeholder: 'Full name' }),
      F('contactNumber', 'Contact number', { origin: 'ai', placeholder: '+91 98765 43210' }),
      F('email', 'Email ID', { origin: 'ai', type: 'email', placeholder: 'name@example.com' }),
      F('source', 'Source', { origin: 'default', list: SOURCES, placeholder: 'Where did you find them?' }),
    ],
  },
  {
    id: 'experience',
    title: 'Experience and skills',
    hint: 'Read from the resume',
    fields: [
      F('totalExperience', 'Total experience (years)', { origin: 'ai', placeholder: 'e.g. 5.5' }),
      F('relevantExperience', 'Relevant experience (years)', { origin: 'ai', placeholder: 'e.g. 4' }),
      F('skill', 'Skill', { origin: 'ai', type: 'tags', wide: true, placeholder: 'Type a skill and press Enter' }),
      F('subSkill', 'Sub skill', { origin: 'ai', type: 'tags', wide: true, placeholder: 'Tools, frameworks, databases' }),
      F('currentCompany', 'Current company', { origin: 'ai', placeholder: 'Employer' }),
      F('clientsWorked', 'Clients worked', {
        origin: 'ai',
        type: 'tags',
        placeholder: 'Add a client and press Enter',
        emptyHint: 'No clients named in the resume. Add them if you know them.',
      }),
      F('education', 'Education including passed year', {
        origin: 'ai',
        type: 'textarea',
        wide: true,
        rows: 2,
        placeholder: 'B.Tech (CSE) - University - 2018',
      }),
    ],
  },
  {
    id: 'assessment',
    title: 'Assessment',
    hint: 'Defaults you can change after the screening call',
    fields: [
      F('communicationSkill', 'Communication skill', {
        origin: 'default',
        type: 'select',
        options: ['Excellent', 'Good', 'Average', 'Poor'],
      }),
      F('trackingHistory', 'Tracking history', { origin: 'default', type: 'select', options: ['YES', 'NO'] }),
      F('technicalCompetency', 'Technical competency', {
        origin: 'default',
        type: 'textarea',
        wide: true,
        rows: 2,
        placeholder: 'What they are good at and what they want next',
      }),
      F('recruiterComments', "Recruiter's comments and recommendation", {
        origin: 'default',
        type: 'textarea',
        wide: true,
        rows: 2,
        placeholder: 'Answers to questions for this requirement and customer',
      }),
    ],
  },
  {
    id: 'logistics',
    title: 'Availability and pay',
    hint: 'Ask the candidate',
    fields: [
      F('noticePeriod', 'Notice period', {
        placeholder: 'e.g. 30 days or 2 months',
        chips: ['Immediate', '15 days', '30 days', '60 days', '90 days'],
      }),
      F('holdingOffers', 'Holding offers and details', { placeholder: 'Company, CTC, joining date', chips: ['None'] }),
      F('currentLocation', 'Current location', { placeholder: 'City' }),
      F('preferredLocation', 'Preferred location', { placeholder: 'City or Any' }),
      F('currentCTC', 'Current CTC', { placeholder: 'e.g. 12 LPA' }),
      F('expectedCTC', 'Expected CTC', { placeholder: 'e.g. 16 LPA' }),
    ],
  },
  {
    id: 'submission',
    title: 'Submission',
    hint: 'Who is submitting, and when',
    fields: [
      F('resumeFile', 'Upload resume', { type: 'readonly' }),
      F('recruiterName', 'Recruiter name', { placeholder: 'Your name' }),
      F('submissionDate', 'Submission date', { type: 'date', required: false, origin: 'default' }),
    ],
  },
];

export const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);
export const FIELD_BY_KEY = Object.fromEntries(ALL_FIELDS.map((f) => [f.key, f]));

// Column order of the Excel sheet (must match server/fields.js).
export const EXCEL_ORDER = [
  'name', 'contactNumber', 'email', 'source', 'totalExperience', 'relevantExperience', 'skill', 'subSkill',
  'communicationSkill', 'noticePeriod', 'education', 'currentLocation', 'preferredLocation', 'currentCTC',
  'expectedCTC', 'currentCompany', 'clientsWorked', 'holdingOffers', 'technicalCompetency', 'recruiterComments',
  'trackingHistory', 'resumeFile', 'recruiterName', 'submissionDate',
];

export const columnLetter = (i) => String.fromCharCode(65 + i); // 24 columns, A to X

export const AI_KEYS = ALL_FIELDS.filter((f) => f.origin === 'ai').map((f) => f.key);

export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const isEmpty = (v) => (Array.isArray(v) ? v.length === 0 : String(v ?? '').trim() === '');

export function newRecord(extra = {}) {
  const rec = {};
  for (const f of ALL_FIELDS) rec[f.key] = f.type === 'tags' ? [] : '';
  return {
    ...rec,
    source: 'Naukri',
    communicationSkill: 'Good',
    technicalCompetency: 'Good',
    recruiterComments: 'Good',
    trackingHistory: 'YES',
    submissionDate: todayISO(),
    ...extra,
  };
}

export const missingFields = (rec) => ALL_FIELDS.filter((f) => f.required && isEmpty(rec[f.key])).map((f) => f.key);

// Copy only non-empty AI values so defaults are never overwritten with blanks.
export function applyExtraction(rec, extracted) {
  const next = { ...rec };
  for (const key of AI_KEYS) {
    if (!isEmpty(extracted?.[key])) next[key] = extracted[key];
  }
  return next;
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now());
