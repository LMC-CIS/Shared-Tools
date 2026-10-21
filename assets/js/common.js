// Shared helpers used by every page: theme toggle, site settings, small utilities.
// All paths are relative so the site works under any base path
// (e.g. https://lmc-cis.github.io/Shared-Tools/ or a custom domain root).

export const TYPE_LABELS = {
  bookmarklet: 'Bookmarklet', skill: 'AI skill', guide: 'Guide', workflow: 'Workflow',
  app: 'App', extension: 'Browser extension', other: 'Other'
};
export const STATUS_LABELS = {
  active: 'Active', experimental: 'Experimental', unmaintained: 'Unmaintained', retired: 'Retired'
};
export const STATUS_HELP = {
  active: 'Working and looked after by its author.',
  experimental: 'Early or in progress. Expect rough edges.',
  unmaintained: 'No longer updated. It may still work, or may not.',
  retired: 'No longer recommended. Kept for reference.'
};
export const AUDIENCE_LABELS = { students: 'Students', faculty: 'Faculty', staff: 'Staff' };

// Build an element: h('a', { href: '…', class: 'x' }, 'text', child)
// Text is always inserted as text, never as HTML.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// Only allow http(s), mailto and relative links in anything we render.
export function safeHref(url) {
  const s = String(url || '').trim();
  if (/^(https?:|mailto:)/i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return '#';
  return s;
}

export function formatDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function contactHref(contact) {
  if (!contact) return null;
  if (/^https:\/\//i.test(contact)) return contact;
  return 'mailto:' + contact.replace(/^mailto:/i, '');
}

export async function loadIndex() {
  const res = await fetch('catalog/index.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load the catalog (HTTP ${res.status}).`);
  return res.json();
}

let configPromise;
export function loadConfig() {
  configPromise ||= fetch('site.config.json').then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  return configPromise;
}

function initThemeToggle() {
  const btn = document.querySelector('.theme-toggle');
  if (!btn) return;
  const root = document.documentElement;
  const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
  const current = () => root.getAttribute('data-theme') || (systemDark() ? 'dark' : 'light');
  const render = () => {
    const dark = current() === 'dark';
    btn.setAttribute('aria-pressed', String(dark));
    btn.textContent = dark ? 'Dark mode: on' : 'Dark mode: off';
  };
  btn.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) { /* not saved; fine */ }
    render();
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', render);
  render();
}

// Fill elements like <a data-config-href="contactEmail"> from site.config.json,
// so maintainers change contact details in one place.
async function fillConfig() {
  const targets = document.querySelectorAll('[data-config], [data-config-href]');
  if (!targets.length) return;
  const cfg = await loadConfig();
  for (const el of targets) {
    const key = el.getAttribute('data-config') || el.getAttribute('data-config-href');
    const val = cfg[key];
    if (!val) continue;
    if (el.hasAttribute('data-config')) el.textContent = val;
    if (el.hasAttribute('data-config-href')) {
      el.setAttribute('href', safeHref(key.toLowerCase().includes('email') ? 'mailto:' + val : val));
    }
  }
  const placeholder = Object.values(cfg).some(v => typeof v === 'string' && v.includes('TODO'));
  document.querySelectorAll('[data-placeholder-note]').forEach(n => { n.hidden = !placeholder; });
}

function markCurrentNav() {
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav a').forEach(a => {
    if (a.getAttribute('href') === here || (here === 'tool.html' && a.getAttribute('href') === 'index.html')) {
      if (here !== 'tool.html') a.setAttribute('aria-current', 'page');
    }
  });
}

initThemeToggle();
fillConfig();
markCurrentNav();
