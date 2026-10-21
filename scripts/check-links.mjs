#!/usr/bin/env node
// Checks that each linked tool's "source" (and "bookmarkletCode") URL still
// loads. Never fails: broken links are reported, not fatal.
// Run on its own with `npm run check-links`, or via `npm run build:check-links`.

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadCatalog } from './lib/catalog.mjs';

const TIMEOUT_MS = 15000;
const USER_AGENT = 'AcademicToolsCatalog-LinkCheck/1.0 (+https://github.com/LMC-CIS/Shared-Tools)';

async function tryFetch(url, method) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method, redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': USER_AGENT } });
    return { status: res.status };
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'timed out' : (e.cause?.code || e.message) };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkUrl(url) {
  let r = await tryFetch(url, 'HEAD');
  // Some servers reject HEAD; retry with GET before calling it broken.
  if (r.error || r.status >= 400) r = await tryFetch(url, 'GET');
  const ok = !r.error && r.status < 400;
  return { url, ok, detail: r.error || `HTTP ${r.status}` };
}

// Returns a map of slug -> { ok, checked, results[] }
export async function checkLinks(tools) {
  const out = {};
  const today = new Date().toISOString().slice(0, 10);
  await Promise.all(tools.map(async ({ slug, data }) => {
    const urls = [data.source, data.bookmarkletCode].filter(Boolean);
    if (!urls.length) return;
    const results = await Promise.all(urls.map(checkUrl));
    out[slug] = { ok: results.every(r => r.ok), checked: today, results };
  }));
  return out;
}

export function summarize(linkMap) {
  const entries = Object.entries(linkMap).sort(([a], [b]) => a.localeCompare(b));
  const broken = entries.filter(([, v]) => !v.ok);
  const md = ['## 🔗 Linked-source check', ''];
  if (!entries.length) md.push('No linked tools to check.');
  else if (!broken.length) md.push(`All ${entries.length} linked source URLs responded.`);
  else {
    md.push(`⚠️ Links for ${broken.length} of ${entries.length} linked tools did not respond. The site still deployed; these cards show a "link may be broken" note.`, '',
      '| Tool | URL | Result |', '|---|---|---|');
    for (const [slug, v] of broken) for (const r of v.results.filter(x => !x.ok)) md.push(`| \`${slug}\` | ${r.url} | ${r.detail} |`);
  }
  return md.join('\n') + '\n';
}

// Run directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { tools } = loadCatalog();
  const map = await checkLinks(tools);
  const text = summarize(map);
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  for (const [slug, v] of Object.entries(map)) {
    if (!v.ok && process.env.GITHUB_ACTIONS) console.log(`::warning file=catalog/${slug}/tool.json::Linked source for "${slug}" did not respond: ${v.results.filter(r => !r.ok).map(r => `${r.url} (${r.detail})`).join(', ')}`);
  }
}
