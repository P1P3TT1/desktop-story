// Loads the story from content/: story.json, the generated manifest.json, and one .md file per item.
// Each .md file has a front-matter header (between --- lines) followed by its body text.

const CONTENT_ROOT = 'content/';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export async function loadContent() {
  const [story, manifest] = await Promise.all([fetchJson('story.json'), fetchJson('manifest.json')]);
  const sections = {};
  await Promise.all(Object.entries(manifest.files ?? {}).map(async ([folder, files]) => {
    sections[folder] = await Promise.all(files.map(file => loadEntry(folder, file)));
  }));
  return { story, sections };
}

export function contentUrl(folder, file) {
  return `${CONTENT_ROOT}${folder}/${encodeURI(file)}`;
}

async function fetchText(path) {
  const response = await fetch(CONTENT_ROOT + path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Could not load ${CONTENT_ROOT}${path} (HTTP ${response.status})`);
  return response.text();
}

async function fetchJson(path) {
  const text = await fetchText(path);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${CONTENT_ROOT}${path} is not valid JSON: ${error.message}`);
  }
}

// Every entry gets an id like "emails/02-mom": its folder plus its file name without ".md".
// That id is what "requires" fields refer to.
async function loadEntry(folder, file) {
  const { data, body } = parseFrontMatter(await fetchText(`${folder}/${encodeURIComponent(file)}`));
  const slug = file.replace(/\.md$/, '');
  return { ...data, id: `${folder}/${slug}`, slug, folder, file, body };
}

// Front matter: one "key: value" per line. Values may be "quoted", true/false, numbers or [a, b] lists.
export function parseFrontMatter(text) {
  text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const match = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  if (!match) return { data: {}, body: text.trim() };

  const data = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1 || line.trim().startsWith('#')) continue;
    data[line.slice(0, colon).trim()] = parseValue(line.slice(colon + 1).trim());
  }
  return { data, body: match[2].trim() };
}

function parseValue(raw) {
  if (/^".*"$|^'.*'$/.test(raw)) return raw.slice(1, -1);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (raw.startsWith('[') && raw.endsWith(']')) {
    return raw.slice(1, -1).split(',').map(item => parseValue(item.trim())).filter(item => item !== '');
  }
  return raw;
}

export function asList(value) {
  if (Array.isArray(value)) return value;
  return value == null || value === '' ? [] : [value];
}

// "emails/06-last-chance:pier" → { id: "emails/06-last-chance", choice: "pier" }
export function parseRequirement(requirement) {
  const [id, choice] = String(requirement).split(':').map(part => part.trim());
  return { id, choice: choice || null };
}

// "pier: I'll be there" → { value: "pier", label: "I'll be there" }
export function parseChoices(value) {
  return asList(value).map(item => {
    const text = String(item);
    const colon = text.indexOf(':');
    return colon === -1
      ? { value: normalizeAnswer(text), label: text }
      : { value: text.slice(0, colon).trim(), label: text.slice(colon + 1).trim() };
  });
}

// Passwords ignore case, spaces and punctuation: "Room B-7" and "roomb7" match.
export function normalizeAnswer(value) {
  return String(value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

// Body text: HTML is escaped first, so content files can't inject markup. Then a few inline rules:
//   ||text||      redacted (revealed on hover)
//   **text**      bold
//   *text*        italic
//   [text](url)   link that opens in the story's web browser
// Line breaks are kept by the CSS (white-space: pre-line).
export function renderText(text) {
  return escapeHtml(text)
    .replace(/\|\|(.+?)\|\|/g, '<span class="redacted" tabindex="0">$1</span>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(\S(?:.*?\S)?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, '<a href="#" class="story-link" data-url="$2">$1</a>');
}

export function plainText(text) {
  return String(text ?? '')
    .replace(/\|\||\*\*?/g, '')
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// Dates are written as "2024-03-28" or "2024-03-28 15:42". Anything else is shown as written.
function parseDate(value) {
  const m = String(value ?? '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  return { year: +m[1], month: +m[2], day: +m[3], hour: m[4] == null ? null : +m[4], minute: m[5] };
}

export function formatDate(value, { time = true } = {}) {
  const date = parseDate(value);
  if (!date) return value == null ? '' : String(value);
  let text = `${MONTHS[date.month - 1]} ${date.day}, ${date.year}`;
  if (time && date.hour !== null) {
    text += ` - ${date.hour % 12 || 12}:${date.minute} ${date.hour < 12 ? 'AM' : 'PM'}`;
  }
  return text;
}

// Sortable form of a date value ("2024-03-28T15:42" and "2024-03-28 15:42" compare equal).
export function dateKey(value) {
  const date = parseDate(value);
  if (!date) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${date.year}-${pad(date.month)}-${pad(date.day)} ${pad(date.hour ?? 0)}:${date.minute ?? '00'}`;
}
