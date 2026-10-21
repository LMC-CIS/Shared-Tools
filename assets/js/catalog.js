// Home page: loads catalog/index.json, renders cards, and applies search + filters.
// Filters combine like this: within one group (e.g. Type) any checked option
// matches; across groups all must match. An empty group means "any".
// The current search and filters are kept in the address bar so they can be shared.

import { h, loadIndex, formatDate, TYPE_LABELS, STATUS_LABELS, AUDIENCE_LABELS } from './common.js';

const form = document.getElementById('filters-form');
const search = document.getElementById('search');
const systemSelect = document.getElementById('f-system');
const list = document.getElementById('cards');
const count = document.getElementById('result-count');
const resetBtn = document.getElementById('reset-filters');
const DEFAULT_STATUS = ['active', 'experimental', 'unmaintained'];

let tools = [];

function checked(name) {
  return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(i => i.value);
}

function readState() {
  return {
    q: search.value.trim().toLowerCase(),
    audience: checked('audience'),
    type: checked('type'),
    status: checked('status'),
    system: systemSelect.value
  };
}

function matches(t, s) {
  if (s.audience.length && !t.audience.some(a => s.audience.includes(a))) return false;
  if (s.type.length && !s.type.includes(t.type)) return false;
  if (s.status.length && !s.status.includes(t.status)) return false;
  if (s.system && !t.runsOn.some(r => r.toLowerCase() === s.system.toLowerCase())) return false;
  if (s.q) {
    const hay = [t.name, t.summary, t.author, TYPE_LABELS[t.type], ...(t.runsOn || []), ...(t.tags || [])].join(' ').toLowerCase();
    if (!s.q.split(/\s+/).every(word => hay.includes(word))) return false;
  }
  return true;
}

function card(t) {
  const verified = t.lastVerified
    ? `Last verified ${formatDate(t.lastVerified)}`
    : t.linkStatus === 'broken' ? 'Link check failed' : 'Not yet verified';
  return h('li', { class: 'card' },
    h('h3', {}, h('a', { href: `tool.html?id=${encodeURIComponent(t.slug)}` }, t.name)),
    h('ul', { class: 'badges', 'aria-label': 'Labels' },
      h('li', { class: 'badge' }, TYPE_LABELS[t.type] || t.type),
      h('li', { class: `badge status-${t.status}` }, STATUS_LABELS[t.status] || t.status),
      t.todo && h('li', { class: 'badge todo' }, 'Placeholder'),
      t.linkStatus === 'broken' && h('li', { class: 'badge broken' }, 'Link may be broken')
    ),
    h('p', { class: 'summary' }, t.summary),
    h('dl', { class: 'meta' },
      h('div', {}, h('dt', {}, 'For: '), h('dd', {}, t.audience.map(a => AUDIENCE_LABELS[a] || a).join(', '))),
      h('div', {}, h('dt', {}, 'Runs on: '), h('dd', {}, t.runsOn.join(', '))),
      h('div', {}, h('dt', {}, 'By: '), h('dd', {}, t.author)),
      h('div', {}, h('dt', { class: 'visually-hidden' }, 'Verification: '), h('dd', {}, verified))
    )
  );
}

function render() {
  const s = readState();
  const shown = tools.filter(t => matches(t, s));
  list.replaceChildren(...shown.map(card));
  if (!shown.length) {
    list.append(h('li', { class: 'empty' }, 'No tools match these filters. Try clearing the search or choosing "Reset filters".'));
  }
  const hidden = tools.length - shown.length;
  count.textContent = `Showing ${shown.length} of ${tools.length} tool${tools.length === 1 ? '' : 's'}` +
    (hidden && s.status.length && !s.status.includes('retired') && tools.some(t => t.status === 'retired') ? ' (retired tools are hidden; tick "Retired" to see them).' : '.');
  writeUrl(s);
}

function writeUrl(s) {
  const p = new URLSearchParams();
  if (s.q) p.set('q', search.value.trim());
  for (const k of ['audience', 'type']) if (s[k].length) p.set(k, s[k].join(','));
  if (s.status.join(',') !== DEFAULT_STATUS.join(',')) p.set('status', s.status.join(',') || 'any');
  if (s.system) p.set('system', s.system);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function readUrl() {
  const p = new URLSearchParams(location.search);
  if (p.has('q')) search.value = p.get('q');
  const set = (name, values) => form.querySelectorAll(`input[name="${name}"]`).forEach(i => { i.checked = values.includes(i.value); });
  if (p.has('audience')) set('audience', p.get('audience').split(','));
  if (p.has('type')) set('type', p.get('type').split(','));
  if (p.has('status')) set('status', p.get('status').split(','));
  if (p.has('system')) systemSelect.value = p.get('system');
}

function fillSystems() {
  const seen = new Map();
  for (const t of tools) for (const r of t.runsOn) {
    const key = r.toLowerCase();
    if (!seen.has(key)) seen.set(key, r);
  }
  const options = [...seen.values()].sort((a, b) => a.localeCompare(b));
  systemSelect.append(...options.map(o => h('option', { value: o }, o)));
}

function reset() {
  search.value = '';
  form.querySelectorAll('input[type="checkbox"]').forEach(i => {
    i.checked = i.name === 'status' && DEFAULT_STATUS.includes(i.value);
  });
  systemSelect.value = '';
  render();
}

async function init() {
  // On narrow screens start with filters collapsed so results are visible first.
  if (window.matchMedia('(max-width: 899px)').matches) document.querySelector('.filters')?.removeAttribute('open');
  try {
    const data = await loadIndex();
    tools = data.tools || [];
  } catch (e) {
    count.textContent = '';
    list.replaceChildren(h('li', { class: 'empty' }, `${e.message} If you are previewing locally, run "npm run build" and then "npm run serve".`));
    return;
  }
  fillSystems();
  readUrl();
  form.addEventListener('change', render);
  form.addEventListener('submit', e => e.preventDefault());
  search.addEventListener('input', render);
  resetBtn.addEventListener('click', reset);
  render();
}

init();
