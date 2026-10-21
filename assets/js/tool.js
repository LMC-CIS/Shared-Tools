// Detail page: tool.html?id=<slug>
// Renders one tool's description, type-specific how-to, files, and facts.
// Hosted and linked tools use the same layout so they look identical to visitors.

import {
  h, safeHref, loadIndex, loadConfig, formatDate, contactHref,
  TYPE_LABELS, STATUS_LABELS, STATUS_HELP, AUDIENCE_LABELS
} from './common.js';
import { renderMarkdown } from './markdown.js';

const root = document.getElementById('tool-root');
const slug = new URLSearchParams(location.search).get('id');

async function init() {
  let data;
  try {
    data = await loadIndex();
  } catch (e) {
    return fail(`${e.message} If you are previewing locally, run "npm run build" and then "npm run serve".`);
  }
  const t = (data.tools || []).find(x => x.slug === slug);
  if (!t) return fail(slug ? `There is no tool called "${slug}" in the catalog. It may have been renamed or removed.` : 'No tool was selected.');
  const cfg = await loadConfig();
  document.title = `${t.name} · Academic Tools in Development`;
  root.replaceChildren(await renderTool(t, cfg));
  document.getElementById('tool-title')?.focus();
}

function fail(msg) {
  document.title = 'Tool not found · Academic Tools in Development';
  root.replaceChildren(
    h('h1', { id: 'tool-title', tabindex: '-1' }, 'Tool not found'),
    h('p', {}, msg),
    h('p', {}, h('a', { href: 'index.html' }, 'Back to all tools'))
  );
}

const fileUrl = (t, path) => t.files.find(f => f.path === path);
const isMarkdown = p => /\.(md|markdown|txt)$/i.test(p || '');

async function renderTool(t, cfg) {
  const frag = document.createDocumentFragment();
  frag.append(h('nav', { class: 'breadcrumb', 'aria-label': 'Breadcrumb' }, h('a', { href: 'index.html' }, '← All tools')));

  const header = h('header', { class: 'detail-header' },
    h('h1', { id: 'tool-title', tabindex: '-1' }, t.name),
    h('ul', { class: 'badges', 'aria-label': 'Labels' },
      h('li', { class: 'badge' }, TYPE_LABELS[t.type] || t.type),
      h('li', { class: `badge status-${t.status}` }, STATUS_LABELS[t.status] || t.status),
      t.todo && h('li', { class: 'badge todo' }, 'Placeholder'),
      t.linkStatus === 'broken' && h('li', { class: 'badge broken' }, 'Link may be broken')
    ),
    h('p', { class: 'summary' }, t.summary)
  );
  if (t.todo) header.append(notice('Placeholder entry.', 'This listing is a placeholder for a tool that is still being written. There is no working code here yet.'));
  if (t.status === 'retired') header.append(notice('Retired.', 'This tool is no longer recommended and is kept for reference only.'));
  if (t.status === 'unmaintained') header.append(notice('Unmaintained.', 'Nobody is updating this tool. It may stop working when the systems it depends on change.'));
  if (t.linkStatus === 'broken') header.append(notice('Source link problem.', 'The most recent automatic check could not reach this tool\'s source link. It may be temporarily down, moved, or removed.'));
  frag.append(header);

  const mainCol = h('div', { class: 'detail-main' });
  const desc = h('section', { class: 'section', 'aria-labelledby': 'h-desc' }, h('h2', { id: 'h-desc' }, 'Description'));
  if (t.hasReadme) {
    try {
      const res = await fetch(`catalog/${encodeURIComponent(t.slug)}/README.md`);
      if (!res.ok) throw new Error();
      desc.append(h('div', { class: 'prose' }, renderMarkdown(await res.text(), `catalog/${encodeURIComponent(t.slug)}/`)));
    } catch { desc.append(h('p', {}, t.summary)); }
  } else {
    desc.append(h('p', { class: 'prose' }, t.summary));
  }
  mainCol.append(desc);

  const howto = h('section', { class: 'section howto', 'aria-labelledby': 'h-howto' }, h('h2', { id: 'h-howto' }, 'How to use it'));
  await HOWTO[t.type in HOWTO ? t.type : 'other'](t, howto);
  howto.append(h('p', {}, 'Before using any tool, read the code or instructions yourself, and see the ', h('a', { href: 'disclaimer.html' }, 'disclaimer'), '.'));
  mainCol.append(howto);

  if (t.files.length) mainCol.append(filesSection(t));

  mainCol.append(h('section', { class: 'section', 'aria-labelledby': 'h-data' },
    h('h2', { id: 'h-data' }, 'Data handling'),
    h('p', { class: 'prose' }, t.dataHandling),
    h('p', { class: 'prose' }, 'You are responsible for following your institution\'s policies, including FERPA and student data privacy rules, when you use this tool.')
  ));

  frag.append(h('div', { class: 'detail' }, mainCol, factsPanel(t, cfg)));
  return frag;
}

function notice(title, text) {
  return h('div', { class: 'notice', role: 'note' }, h('strong', {}, title), ' ', text);
}

function factsPanel(t, cfg) {
  const row = (label, ...value) => [h('dt', {}, label), h('dd', {}, ...value)];
  const contact = contactHref(t.contact);
  const repo = (cfg.repoUrl || '').replace(/\/$/, '');
  const issue = repo && `${repo}/issues/new?title=${encodeURIComponent(`[${t.slug}] `)}`;
  return h('aside', { class: 'facts', 'aria-labelledby': 'h-facts' },
    h('h2', { id: 'h-facts' }, 'Details'),
    h('dl', {},
      row('Type', TYPE_LABELS[t.type] || t.type),
      row('For', t.audience.map(a => AUDIENCE_LABELS[a] || a).join(', ')),
      row('Runs on', t.runsOn.join(', ')),
      row('Version', t.version),
      row('Status', `${STATUS_LABELS[t.status] || t.status}. `, h('span', { class: 'muted' }, STATUS_HELP[t.status] || '')),
      row('Last tested', t.lastTested ? formatDate(t.lastTested) : 'Not yet tested'),
      row('Last verified', t.lastVerified ? formatDate(t.lastVerified) : (t.linkStatus === 'broken' ? 'Link check failed' : 'Not yet verified')),
      row('Author', t.author),
      row('Contact', contact ? h('a', { href: safeHref(contact) }, t.contact.replace(/^mailto:/i, '')) : '—'),
      row('License', t.license),
      row('Source', h('a', { href: safeHref(t.sourceUrl) }, 'View source code'))
    ),
    issue && h('p', {}, h('a', { href: safeHref(issue) }, 'Report a problem with this listing'))
  );
}

function filesSection(t) {
  return h('section', { class: 'section', 'aria-labelledby': 'h-files' },
    h('h2', { id: 'h-files' }, 'Files'),
    h('ul', { class: 'file-list' }, t.files.map(f => h('li', {},
      h('span', { class: 'fname' }, f.path),
      h('a', { href: safeHref(f.url), download: f.name }, 'Download', h('span', { class: 'visually-hidden' }, ` ${f.name}`)),
      h('a', { href: safeHref(f.viewUrl) }, 'View on GitHub', h('span', { class: 'visually-hidden' }, ` (${f.name})`))
    )))
  );
}

// Main action buttons shared by most types.
function actionButtons(t, { downloadLabel = 'Download' } = {}) {
  const row = h('div', { class: 'btn-row' });
  const primary = t.primaryFile && fileUrl(t, t.primaryFile);
  if (primary) row.append(h('a', { class: 'btn', href: safeHref(primary.url), download: primary.name }, `${downloadLabel} ${primary.name}`));
  row.append(h('a', { class: primary ? 'btn secondary' : 'btn', href: safeHref(t.sourceUrl) }, 'View source code'));
  return row;
}

async function markdownPreview(t, container, { open = false, label = 'Preview' } = {}) {
  const primary = t.primaryFile && fileUrl(t, t.primaryFile);
  if (!primary || !isMarkdown(primary.path)) return;
  try {
    const res = await fetch(primary.url);
    if (!res.ok) return;
    const body = renderMarkdown(await res.text(), primary.url.replace(/[^/]*$/, ''));
    const details = h('details', { class: 'preview' }, h('summary', {}, `${label}: ${primary.name}`), h('div', { class: 'prose' }, body));
    if (open) details.open = true;
    container.append(details);
  } catch { /* preview is optional */ }
}

const steps = (...items) => h('ol', {}, items.map(i => h('li', {}, ...[].concat(i))));

const HOWTO = {
  async bookmarklet(t, el) {
    el.append(h('p', {}, 'A bookmarklet is a bookmark that runs a small piece of JavaScript on the page you are viewing. It works in most desktop browsers.'));
    let code = null;
    const hosted = t.files.find(f => f.path === t.primaryFile && /\.js$/i.test(f.path)) || t.files.find(f => /\.js$/i.test(f.path));
    const codeUrl = hosted ? hosted.url : t.bookmarkletCode;
    try {
      const res = await fetch(codeUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      code = await res.text();
    } catch {
      el.append(notice('Could not load the bookmarklet code.', 'Use "View source code" below to get it, and add it as a bookmark by hand.'), actionButtons(t));
      return;
    }
    const href = bookmarkletHref(code);

    const drag = h('a', { class: 'bm-drag', draggable: 'true', title: 'Drag me to your bookmarks bar' }, `⋮⋮ ${t.name}`);
    drag.setAttribute('href', href); // set as an attribute; never built from HTML
    const dragNote = h('p', { class: 'muted', 'aria-live': 'polite' });
    drag.addEventListener('click', e => {
      e.preventDefault();
      dragNote.textContent = 'Drag this button to your bookmarks bar instead of clicking it. Or use "Copy the code instead" below.';
    });

    el.append(
      h('h3', {}, 'Install in three steps'),
      h('ol', { class: 'steps' },
        h('li', {}, h('strong', {}, 'Show your bookmarks bar.'), ILL_BAR(),
          ' Press ', h('kbd', {}, 'Ctrl'), '+', h('kbd', {}, 'Shift'), '+', h('kbd', {}, 'B'), ' (Windows, ChromeOS, Linux) or ', h('kbd', {}, '⌘'), '+', h('kbd', {}, 'Shift'), '+', h('kbd', {}, 'B'), ' (Mac).'),
        h('li', {}, h('strong', {}, 'Drag the button onto the bar.'), ILL_DRAG(), ' Press and hold the button below, then drop it on your bookmarks bar.'),
        h('li', {}, h('strong', {}, 'Use it.'), ILL_CLICK(), ` Go to the page it is meant for${t.runsOn.length ? ` (${t.runsOn.join(', ')})` : ''} and click the new bookmark.`)
      ),
      h('div', { class: 'btn-row' }, drag),
      dragNote
    );

    const textarea = h('textarea', { class: 'code', id: 'bm-code', readonly: true, rows: '6', spellcheck: 'false' });
    textarea.value = href;
    const status = h('span', { class: 'copy-status', role: 'status' });
    const copyBtn = h('button', { type: 'button', class: 'btn secondary' }, 'Copy code');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(href);
        status.textContent = 'Copied.';
      } catch {
        textarea.focus();
        textarea.select();
        status.textContent = 'Press Ctrl+C (or ⌘+C) to copy the selected code.';
      }
    });
    el.append(h('details', {},
      h('summary', {}, 'Can\'t drag? Copy the code instead'),
      steps(
        'Copy the code below.',
        'Create a new bookmark (right-click the bookmarks bar, then "Add page" or "Add bookmark").',
        `Name it "${t.name}" and paste the code into the URL (address) field. Save.`
      ),
      h('label', { for: 'bm-code', class: 'block' }, 'Bookmarklet code'),
      textarea,
      h('div', { class: 'btn-row' }, copyBtn, status)
    ));
    el.append(h('p', {}, 'To remove it later, right-click the bookmark and choose Delete.'));
    el.append(actionButtons(t));
  },

  async skill(t, el) {
    el.append(
      h('p', {}, 'An AI skill is a set of written instructions (usually a SKILL.md file) that an AI assistant follows for a specific task.'),
      steps(
        'Download the skill file(s) and read them so you know what the assistant will be told to do.',
        'Claude (web or desktop): open Settings, find the Skills section, and upload the skill. If it has more than one file, upload the folder as a .zip.',
        ['Claude Code: put the folder at ', h('code', {}, `~/.claude/skills/${t.slug}/`), ' with SKILL.md inside it.'],
        'Other assistants: paste the instructions into a custom-instructions or project setting, if your assistant has one.',
        'Do not paste identifiable student information into an AI tool unless your institution has approved that tool for it.'
      ),
      actionButtons(t)
    );
    await markdownPreview(t, el, { label: 'Read the skill' });
  },

  async guide(t, el) {
    el.append(
      h('p', {}, 'This is a written guide. Read it below, or download it to keep or adapt (it is a Markdown text file and opens in any text editor).'),
      actionButtons(t)
    );
    await markdownPreview(t, el, { open: true, label: 'Guide' });
  },

  async workflow(t, el) {
    el.append(
      h('p', {}, 'A workflow is a step-by-step process, sometimes with templates or small helper files. Follow the steps in the description and files.'),
      steps(
        'Read through all the steps once before starting.',
        'Download any templates or files you need.',
        `Work through the steps in ${t.runsOn.join(', ') || 'the listed systems'}, adapting them to your course or office.`
      ),
      actionButtons(t)
    );
    await markdownPreview(t, el, { label: 'Read the workflow' });
  },

  async app(t, el) {
    el.append(
      h('p', {}, 'This is a standalone app. The catalog does not host ready-to-run programs; it links to the source code so you can see exactly what it does.'),
      steps(
        'Open the source code and read its README for setup steps.',
        'Review the code, or ask someone you trust to, before running it.',
        'If you need to install anything on a college computer, check with your IT department first.'
      ),
      actionButtons(t)
    );
  },

  async extension(t, el) {
    el.append(
      h('p', {}, 'This is a browser extension that you load from its source code. It is not installed from an extension store.'),
      steps(
        'Download or clone the source code and unzip it to a folder.',
        ['In Chrome or Edge, go to ', h('code', {}, 'chrome://extensions'), ' (or ', h('code', {}, 'edge://extensions'), ').'],
        'Turn on "Developer mode".',
        'Choose "Load unpacked" and select the folder.',
        'To remove it, return to the extensions page and choose Remove.'
      ),
      h('p', {}, 'Your institution may block developer-mode extensions on managed computers.'),
      actionButtons(t)
    );
  },

  async other(t, el) {
    el.append(h('p', {}, 'See the description above and the files below for how to use this resource.'), actionButtons(t));
    await markdownPreview(t, el);
  }
};

// Turn readable JavaScript into a bookmark URL. If the file already starts with
// "javascript:", it is treated as a finished bookmark URL and used unchanged.
// Otherwise it is wrapped so it cannot replace the page, then URL-encoded.
export function bookmarkletHref(code) {
  const src = code.trim();
  if (/^javascript:/i.test(src)) return src;
  return 'javascript:' + encodeURIComponent(`(function(){\n${src}\n})();void 0;`);
}

// Small inline illustrations for the install steps (decorative).
function svg(markup) {
  const wrap = document.createElement('div');
  wrap.setAttribute('aria-hidden', 'true');
  // Static, hard-coded markup only.
  wrap.innerHTML = `<svg viewBox="0 0 200 90" focusable="false">${markup}</svg>`;
  return wrap;
}
const FRAME = '<rect class="ill-frame" x="4" y="4" width="192" height="82" rx="8"/><rect class="ill-bar" x="4" y="4" width="192" height="18" rx="8"/>';
const ILL_BAR = () => svg(`${FRAME}<rect class="ill-bar" x="4" y="22" width="192" height="14"/><rect class="ill-muted" x="12" y="26" width="26" height="6" rx="3"/><rect class="ill-muted" x="44" y="26" width="26" height="6" rx="3"/><rect class="ill-muted" x="76" y="26" width="26" height="6" rx="3"/>`);
const ILL_DRAG = () => svg(`${FRAME}<rect class="ill-bar" x="4" y="22" width="192" height="14"/><rect class="ill-muted" x="12" y="26" width="26" height="6" rx="3"/><rect class="ill-accent" x="120" y="26" width="30" height="6" rx="3" opacity="0.5"/><path class="ill-line" d="M62 66 C 90 66, 120 50, 134 36"/><rect class="ill-accent" x="30" y="58" width="56" height="16" rx="8"/>`);
const ILL_CLICK = () => svg(`${FRAME}<rect class="ill-bar" x="4" y="22" width="192" height="14"/><rect class="ill-muted" x="12" y="26" width="26" height="6" rx="3"/><rect class="ill-accent" x="44" y="26" width="30" height="6" rx="3"/><path class="ill-muted" d="M60 32 l0 22 l6 -6 l5 10 l4 -2 l-5 -10 l8 0 z"/><rect class="ill-muted" x="90" y="50" width="90" height="6" rx="3" opacity="0.5"/><rect class="ill-muted" x="90" y="62" width="70" height="6" rx="3" opacity="0.5"/>`);

init();
