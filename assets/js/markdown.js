// A small, safe Markdown renderer for tool descriptions and guides.
// Supports: headings, paragraphs, bold, italic, inline code, fenced code,
// links, images, ordered/unordered lists (nested items are flattened), blockquotes, rules,
// and simple tables. Raw HTML is never rendered; it shows as text.
// YAML front matter (--- … ---) at the top is shown as a code block.

import { h, safeHref } from './common.js';

// baseUrl: folder that relative links and images resolve against.
export function renderMarkdown(src, baseUrl = '') {
  const frag = document.createDocumentFragment();
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
  let i = 0;

  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) {
      frag.append(h('pre', { class: 'frontmatter', tabindex: '0' }, h('code', {}, lines.slice(0, end + 1).join('\n'))));
      i = end + 1;
    }
  }

  const resolve = url => {
    const u = safeHref(url);
    if (u === '#' || /^(https?:|mailto:|#|\/)/i.test(u)) return u;
    return baseUrl + u;
  };

  const inline = text => {
    const out = [];
    // Order matters: code first so its contents are not formatted.
    const re = /(`+)([\s\S]*?[^`])\1(?!`)|!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_|<(https?:\/\/[^>\s]+)>/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      if (m[1]) out.push(h('code', {}, m[2]));
      else if (m[4] !== undefined) out.push(h('img', { src: resolve(m[4]), alt: m[3], loading: 'lazy' }));
      else if (m[6] !== undefined) out.push(h('a', { href: resolve(m[6]) }, ...inline(m[5])));
      else if (m[7] || m[8]) out.push(h('strong', {}, ...inline(m[7] || m[8])));
      else if (m[9] || m[10]) out.push(h('em', {}, ...inline(m[9] || m[10])));
      else if (m[11]) out.push(h('a', { href: safeHref(m[11]) }, m[11]));
      last = re.lastIndex;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  };

  const isBlockStart = l => /^(#{1,6}\s|```|~~~|>|\s*([-*+]|\d+[.)])\s|(\*\s*){3,}$|(-\s*){3,}$|\|)/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    let m;
    if ((m = line.match(/^(```|~~~)\s*([\w-]*)/))) {
      const fence = m[1];
      const body = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(fence)) body.push(lines[i++]);
      i++;
      frag.append(h('pre', { tabindex: '0' }, h('code', m[2] ? { class: 'language-' + m[2] } : {}, body.join('\n'))));
      continue;
    }
    if ((m = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/))) {
      // Shift headings down one level: the page already has an <h1>/<h2>.
      const level = Math.min(6, m[1].length + 1);
      frag.append(h('h' + level, {}, ...inline(m[2])));
      i++;
      continue;
    }
    if (/^((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(line.trim())) { frag.append(h('hr')); i++; continue; }
    if (line.startsWith('>')) {
      const body = [];
      while (i < lines.length && lines[i].startsWith('>')) body.push(lines[i++].replace(/^>\s?/, ''));
      const bq = h('blockquote');
      bq.append(renderMarkdown(body.join('\n'), baseUrl));
      frag.append(bq);
      continue;
    }
    if ((m = line.match(/^\s*([-*+]|\d+[.)])\s+/))) {
      const ordered = /\d/.test(m[1]);
      const list = h(ordered ? 'ol' : 'ul');
      while (i < lines.length && (m = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/)) && /\d/.test(m[1]) === ordered) {
        let text = m[2];
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s/.test(lines[i])) text += ' ' + lines[i++].trim();
        const checkbox = text.match(/^\[( |x)\]\s+(.*)$/i);
        list.append(checkbox
          ? h('li', {}, checkbox[1].trim() ? '☑ ' : '☐ ', ...inline(checkbox[2]))
          : h('li', {}, ...inline(text)));
      }
      frag.append(list);
      continue;
    }
    if (line.startsWith('|') && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const cells = l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(line);
      i += 2;
      const table = h('table', {}, h('thead', {}, h('tr', {}, head.map(c => h('th', { scope: 'col' }, ...inline(c))))));
      const tbody = h('tbody');
      while (i < lines.length && lines[i].startsWith('|')) tbody.append(h('tr', {}, cells(lines[i++]).map(c => h('td', {}, ...inline(c)))));
      table.append(tbody);
      frag.append(h('div', { class: 'table-wrap' }, table));
      continue;
    }
    const para = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) para.push(lines[i++].trim());
    frag.append(h('p', {}, ...inline(para.join(' '))));
  }
  return frag;
}
