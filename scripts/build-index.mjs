#!/usr/bin/env node
// Builds the deployable site into _site/:
//   - copies the HTML/CSS/JS pages and site.config.json
//   - copies each tool's folder (tool.json, README.md, hosted files)
//   - writes _site/catalog/index.json, the single file the pages read
// Add --check-links to also check linked-source URLs (used by the deploy workflow).

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, CATALOG_DIR, loadCatalog, readSiteConfig } from './lib/catalog.mjs';
import { checkLinks, summarize } from './check-links.mjs';

const OUT = path.join(ROOT, '_site');
const SITE_FILES = ['index.html', 'tool.html', 'about.html', 'disclaimer.html', 'license.html', 'contribute.html', '404.html', 'site.config.json'];
const SITE_DIRS = ['assets', 'schema'];
const withLinks = process.argv.includes('--check-links');

const { tools, errors } = loadCatalog();
if (errors.length) {
  console.error('The catalog has problems. Run `npm run validate` for details.');
  process.exit(1);
}
const config = readSiteConfig();
const repo = config.repoUrl.replace(/\/$/, '');
const branch = config.branch || 'main';
const today = new Date().toISOString().slice(0, 10);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'catalog'), { recursive: true });
for (const f of SITE_FILES) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
for (const d of SITE_DIRS) fs.cpSync(path.join(ROOT, d), path.join(OUT, d), { recursive: true });

// 404.html can be served from any depth, so give it an absolute <base>.
const basePath = normalizeBase(config.basePath);
const notFound = path.join(OUT, '404.html');
fs.writeFileSync(notFound, fs.readFileSync(notFound, 'utf8').replace('<!--BASE-->', `<base href="${basePath}">`));

const linkMap = withLinks ? await checkLinks(tools) : {};

const entries = tools.map(({ slug, dir, data, hasReadme }) => {
  // Copy only what we publish: tool.json, README.md and the listed files.
  const outDir = path.join(OUT, 'catalog', slug);
  const publish = ['tool.json', ...(hasReadme ? ['README.md'] : []), ...(data.files || [])];
  for (const f of publish) {
    const dest = path.join(outDir, f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(dir, f), dest);
  }

  const files = (data.files || []).map(f => ({
    path: f,
    name: path.posix.basename(f),
    url: `catalog/${slug}/${f.split('/').map(encodeURIComponent).join('/')}`,
    viewUrl: `${repo}/blob/${branch}/catalog/${slug}/${f.split('/').map(encodeURIComponent).join('/')}`
  }));
  const hosted = files.length > 0;
  const link = linkMap[slug];

  let lastVerified = null;
  let linkStatus = 'unchecked';
  if (link) {
    linkStatus = link.ok ? 'ok' : 'broken';
    if (link.ok) lastVerified = link.checked;
  } else if (!data.source && hosted) {
    // Hosted-only tools are verified by the build itself: every listed file exists.
    linkStatus = 'ok';
    lastVerified = today;
  }

  const { $schema, ...fields } = data;
  return {
    slug,
    ...fields,
    primaryFile: data.primaryFile || (data.files || [])[0] || null,
    hosting: data.source ? (hosted ? 'both' : 'linked') : 'hosted',
    hasReadme,
    files,
    folderUrl: `${repo}/tree/${branch}/catalog/${slug}`,
    sourceUrl: data.source || `${repo}/tree/${branch}/catalog/${slug}`,
    lastVerified,
    linkStatus
  };
});

entries.sort((a, b) => a.name.localeCompare(b.name));
const index = { generated: new Date().toISOString(), linkCheck: withLinks, count: entries.length, tools: entries };
fs.writeFileSync(path.join(OUT, 'catalog', 'index.json'), JSON.stringify(index, null, 2));

console.log(`Built _site/ with ${entries.length} tools${withLinks ? ' (links checked)' : ''}.`);
if (withLinks) {
  const text = summarize(linkMap);
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  for (const [slug, v] of Object.entries(linkMap)) {
    if (!v.ok && process.env.GITHUB_ACTIONS) console.log(`::warning file=catalog/${slug}/tool.json::Linked source for "${slug}" did not respond.`);
  }
}

function normalizeBase(p) {
  if (!p || p === '/') return '/';
  return '/' + p.replace(/^\/+|\/+$/g, '') + '/';
}
