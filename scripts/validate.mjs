#!/usr/bin/env node
// Checks every catalog/<slug>/tool.json against schema/tool.schema.json plus a
// few extra rules (files exist, no binaries, no obvious secrets).
// Exits with code 1 if anything needs fixing, so pull request checks fail.

import fs from 'node:fs';
import { loadCatalog } from './lib/catalog.mjs';

const { tools, errors, warnings } = loadCatalog();

const lines = [];
if (errors.length) {
  lines.push(`Found ${errors.length} problem${errors.length === 1 ? '' : 's'} to fix:`, '');
  errors.forEach((e, i) => lines.push(`  ${i + 1}. ${e}`));
  lines.push('');
}
if (warnings.length) {
  lines.push(`Please double-check (these do not block merging):`, '');
  warnings.forEach(w => lines.push(`  - ${w}`));
  lines.push('');
}
if (!errors.length) {
  lines.push(`All ${tools.length} catalog entr${tools.length === 1 ? 'y looks' : 'ies look'} good.`);
}
console.log(lines.join('\n'));

// Also show the result on the GitHub Actions run page.
if (process.env.GITHUB_STEP_SUMMARY) {
  const md = [errors.length ? '## ❌ Catalog check failed' : '## ✅ Catalog check passed', ''];
  if (errors.length) md.push('Fix these, then commit again:', '', ...errors.map(e => `- ${e}`), '');
  if (warnings.length) md.push('Please double-check (not blocking):', '', ...warnings.map(w => `- ${w}`), '');
  if (!errors.length) md.push(`${tools.length} entries checked.`);
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.join('\n') + '\n');
}
// Inline annotations on the pull request's "Files changed" tab.
if (process.env.GITHUB_ACTIONS) {
  for (const e of errors) {
    const file = (e.match(/^(catalog\/[^\s:]+?)(?=[\s:(])/) || [])[1];
    console.log(`::error${file ? ` file=${file}` : ''}::${e.replace(/\n/g, ' ')}`);
  }
}

process.exit(errors.length ? 1 : 0);
