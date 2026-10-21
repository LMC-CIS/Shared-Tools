// Shared helpers for reading and checking the catalog.
// Used by validate.mjs, build-index.mjs and check-links.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CATALOG_DIR = path.join(ROOT, 'catalog');
export const SCHEMA_PATH = path.join(ROOT, 'schema', 'tool.schema.json');

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Compiled programs and packaged installers are never hosted here. Apps and
// extensions must link to (or include) readable source code instead.
const BLOCKED_EXTENSIONS = [
  '.exe', '.dmg', '.msi', '.pkg', '.apk', '.ipa', '.crx', '.xpi',
  '.jar', '.app', '.dll', '.so', '.dylib', '.bin', '.zip', '.7z', '.rar', '.tar', '.gz'
];

// Text files we scan for secrets. Other files are skipped.
const TEXT_EXTENSIONS = [
  '.js', '.mjs', '.ts', '.json', '.md', '.txt', '.html', '.css', '.py',
  '.yml', '.yaml', '.csv', '.xml', '.sh', '.ps1', '.gs', '.toml', '.ini'
];

// Patterns that usually mean a credential slipped in. Kept simple on purpose.
const SECRET_PATTERNS = [
  { re: /\b(api[_-]?key|secret|access[_-]?token|auth[_-]?token|password|passwd)\b\s*[:=]\s*\\?["'][^"'\s\\]{8,}\\?["']/i, label: 'a hard-coded key, token, or password' },
  { re: /\bBearer\s+[A-Za-z0-9\-._~+/]{20,}=*/, label: 'a "Bearer" access token' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, label: 'an AWS access key' },
  { re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/, label: 'a GitHub token' },
  { re: /\bsk-[A-Za-z0-9_-]{20,}\b/, label: 'an API secret key (sk-…)' },
  { re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/, label: 'a Slack token' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, label: 'a private key' },
  { re: /\b[0-9a-f]{40,}\b/i, label: 'a long hexadecimal string (often a token)' },
  { re: /\b\d{1,5}~[A-Za-z0-9]{40,}\b/, label: 'a Canvas-style access token' }
];

// Emails on these domains are clearly fake and fine to use in examples.
const SAFE_EMAIL_DOMAINS = /@(example\.(com|org|net|edu)|users\.noreply\.github\.com)$/i;

let validateFn;
function getValidator() {
  if (!validateFn) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    validateFn = ajv.compile(schema);
  }
  return validateFn;
}

// Turn one Ajv error into a sentence a non-programmer can act on.
function explain(err, data) {
  const field = err.instancePath
    ? err.instancePath.replace(/^\//, '').replace(/\/(\d+)/g, '[$1]').replace(/\//g, '.')
    : '';
  const where = field ? `"${field}"` : 'The file';
  const p = err.params || {};
  const actual = field ? valueAt(data, err.instancePath) : undefined;
  const youWrote = actual === undefined ? '' : ` You wrote ${JSON.stringify(actual)}.`;
  switch (err.keyword) {
    case 'required':
      return `Missing required field "${p.missingProperty}". Add it (see templates/tool.json for an example).`;
    case 'additionalProperties':
      return `Unknown field "${p.additionalProperty}". Check the spelling, or remove it. Allowed fields are listed in schema/tool.schema.json.`;
    case 'enum':
      return `${where} must be one of: ${p.allowedValues.join(', ')}.${youWrote}`;
    case 'const':
      if (field === 'ferpaConfirmed') {
        return '"ferpaConfirmed" must be true. Set it to true only after confirming FERPA and student privacy were considered and no real student data is included.';
      }
      return `${where} must be ${JSON.stringify(p.allowedValue)}.${youWrote}`;
    case 'type':
      return `${where} must be ${article(p.type)}.${youWrote}`;
    case 'minLength':
      return `${where} is too short (at least ${p.limit} characters).`;
    case 'maxLength':
      return `${where} is too long (at most ${p.limit} characters; it has ${String(actual).length}).`;
    case 'minItems':
      return `${where} needs at least ${p.limit} item${p.limit === 1 ? '' : 's'}.`;
    case 'uniqueItems':
      return `${where} lists the same value twice.`;
    case 'format':
      if (p.format === 'date') return `${where} must be a date written as YYYY-MM-DD (for example 2026-01-31), or null.${youWrote}`;
      if (p.format === 'uri') return `${where} must be a full web address starting with https://.${youWrote}`;
      return `${where} is not a valid ${p.format}.${youWrote}`;
    case 'pattern':
      if (field === 'contact') return `"contact" must be an email address or a web address starting with https://.${youWrote}`;
      if (field === 'source' || field === 'bookmarkletCode') return `${where} must start with https://.${youWrote}`;
      return `${where} is not in the expected format.${youWrote}`;
    case 'oneOf':
    case 'anyOf':
      if (!field) return 'Add either "source" (a link to the code, for linked tools) or "files" (a list of files in this folder, for hosted tools).';
      return null; // the more specific sub-error already explains it
    default:
      return `${where}: ${err.message}.`;
  }
}

function article(type) {
  const map = { string: 'text in quotes', array: 'a list in square brackets [ ]', boolean: 'true or false', object: 'an object { }', null: 'null' };
  return type.split(',').map(t => map[t] || t).join(' or ');
}

function valueAt(obj, pointer) {
  return pointer.split('/').slice(1).reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function listToolDirs() {
  if (!fs.existsSync(CATALOG_DIR)) return [];
  return fs.readdirSync(CATALOG_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('_'))
    .map(d => d.name)
    .sort();
}

function scanForSecrets(text, label, errors, warnings) {
  for (const { re, label: what } of SECRET_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const line = text.slice(0, m.index).split('\n').length;
      errors.push(`${label} (line ${line}) looks like it contains ${what}. Remove credentials before submitting. If this is a false alarm, ask a maintainer.`);
    }
  }
  const emails = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  for (const email of new Set(emails)) {
    if (!SAFE_EMAIL_DOMAINS.test(email)) {
      warnings.push(`${label} contains the email address "${email}". Make sure it is not a student's or anyone's private address; use name@example.org in examples.`);
    }
  }
}

// Read and check every tool. Returns { tools, errors, warnings }.
// errors are blocking; warnings are shown but do not fail the check.
export function loadCatalog() {
  const validate = getValidator();
  const tools = [];
  const errors = [];
  const warnings = [];

  const dirs = listToolDirs();
  if (dirs.length === 0) warnings.push('The catalog folder has no tools yet.');

  for (const slug of dirs) {
    const dir = path.join(CATALOG_DIR, slug);
    const rel = `catalog/${slug}`;
    const add = msg => errors.push(`${rel}/tool.json: ${msg}`);

    if (!SLUG_RE.test(slug)) {
      errors.push(`${rel}: the folder name must use only lowercase letters, numbers, and single hyphens (for example "grade-export-helper").`);
    }

    const jsonPath = path.join(dir, 'tool.json');
    if (!fs.existsSync(jsonPath)) {
      errors.push(`${rel}: this folder has no tool.json. Every tool folder needs one (copy templates/tool.json to start).`);
      continue;
    }

    const raw = fs.readFileSync(jsonPath, 'utf8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      add(`is not valid JSON (${e.message}). Common causes: a missing comma between fields, a trailing comma after the last field, or quotes that are not straight double quotes (").`);
      continue;
    }

    if (!validate(data)) {
      const seen = new Set();
      for (const err of validate.errors) {
        const msg = explain(err, data);
        if (msg && !seen.has(msg)) { seen.add(msg); add(msg); }
      }
    }

    scanForSecrets(raw, `${rel}/tool.json`, errors, warnings);

    // Checks the schema cannot express.
    const files = Array.isArray(data.files) ? data.files : [];
    for (const f of files) {
      if (typeof f !== 'string') continue;
      const norm = path.posix.normalize(f.replace(/\\/g, '/'));
      if (norm.startsWith('..') || path.posix.isAbsolute(norm)) {
        add(`file "${f}" must be inside this tool's folder (no "../" or leading "/").`);
        continue;
      }
      if (norm === 'tool.json') {
        add('do not list tool.json itself in "files".');
        continue;
      }
      const ext = path.extname(norm).toLowerCase();
      if (BLOCKED_EXTENSIONS.includes(ext)) {
        add(`file "${f}" is a compiled program or archive (${ext}). This catalog does not host binaries or packages; link to the source code instead.`);
        continue;
      }
      const full = path.join(dir, norm);
      if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
        add(`lists the file "${f}", but there is no such file in ${rel}/. Upload it or fix the name (names are case-sensitive).`);
        continue;
      }
      if (TEXT_EXTENSIONS.includes(ext)) {
        scanForSecrets(fs.readFileSync(full, 'utf8'), `${rel}/${norm}`, errors, warnings);
      }
    }
    if (data.primaryFile && !files.includes(data.primaryFile)) {
      add(`"primaryFile" is "${data.primaryFile}", but that name is not in the "files" list.`);
    }

    if (data.type === 'bookmarklet') {
      const hasJs = files.some(f => /\.js$/i.test(f));
      if (!hasJs && !data.bookmarkletCode) {
        add('bookmarklet tools need either a .js file in "files" or a "bookmarkletCode" link to the raw JavaScript, so the site can build the drag-to-bookmarks button.');
      }
    }
    if ((data.type === 'app' || data.type === 'extension') && !data.source && files.length === 0) {
      add(`${data.type} tools must link to their source code ("source") or include it in "files".`);
    }

    const readmePath = path.join(dir, 'README.md');
    const hasReadme = fs.existsSync(readmePath);
    if (hasReadme) scanForSecrets(fs.readFileSync(readmePath, 'utf8'), `${rel}/README.md`, errors, warnings);

    tools.push({ slug, dir, data, hasReadme });
  }

  return { tools, errors, warnings };
}

export function readSiteConfig() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
}
