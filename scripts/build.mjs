// Static build + validation for the BE TRAIL web card.
// No dependencies: copies src/ to dist/, injects SITE_URL, then checks
// that every local asset reference resolves and that the published text
// stays within the public-information boundary.
//
// Usage:
//   node scripts/build.mjs            build + validate
//   node scripts/build.mjs --check    validate src/ only
//
// Env:
//   SITE_URL   absolute URL with trailing slash (default: GitHub Pages URL)
//
// Optional local blocklist (never committed): scripts/.blocklist.local
// One term per line; lines starting with # are ignored.

import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const distDir = join(root, 'dist');
const checkOnly = process.argv.includes('--check');

let siteUrl = process.env.SITE_URL || 'https://matsupoker.github.io/be-trail-site/';
if (!siteUrl.endsWith('/')) siteUrl += '/';

const TEXT_EXT = new Set(['.html', '.css', '.js', '.json', '.txt', '.xml', '.webmanifest']);
const errors = [];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

async function loadBlocklist() {
  // Generic public-boundary rules that are safe to keep in a public repo.
  const terms = ['github.com', 'tel:'];
  const local = join(root, 'scripts', '.blocklist.local');
  if (existsSync(local)) {
    const lines = (await readFile(local, 'utf8')).split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (t && !t.startsWith('#')) terms.push(t);
    }
  } else {
    console.warn('! scripts/.blocklist.local not found — running generic boundary checks only');
  }
  return terms;
}

function localRefs(html) {
  const refs = new Set();
  for (const m of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) refs.add(m[1]);
  for (const m of html.matchAll(/\b(?:srcset|imagesrcset)="([^"]+)"/g)) {
    for (const part of m[1].split(',')) refs.add(part.trim().split(/\s+/)[0]);
  }
  for (const m of html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) refs.add(m[1]);
  return [...refs].filter((r) => r && !/^(?:[a-z]+:|#|\/\/|%SITE_URL%)/i.test(r));
}

async function validate(dir) {
  const files = await walk(dir);
  const terms = await loadBlocklist();

  for (const file of files) {
    const rel = relative(dir, file);
    if (!TEXT_EXT.has(extname(file))) continue;
    const text = await readFile(file, 'utf8');
    // The hosting URL itself is allowed; everything else is checked.
    const lower = text.replaceAll(siteUrl, '').toLowerCase();
    for (const term of terms) {
      if (lower.includes(term.toLowerCase())) errors.push(`boundary: "${term}" found in ${rel}`);
    }
    if (extname(file) === '.html' || extname(file) === '.css') {
      for (const ref of localRefs(text)) {
        const target = join(dirname(file), ref.split(/[?#]/)[0]);
        if (!existsSync(target)) errors.push(`missing asset: ${ref} (referenced in ${rel})`);
      }
    }
  }

  const html = await readFile(join(dir, 'index.html'), 'utf8');
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    if (!/\balt="[^"]*"/.test(tag)) errors.push(`img without alt: ${tag.slice(0, 80)}`);
    if (!/\bwidth="\d+"/.test(tag) || !/\bheight="\d+"/.test(tag)) errors.push(`img without width/height: ${tag.slice(0, 80)}`);
  }
  for (const needle of ['<title>', 'name="description"', 'property="og:image"', 'rel="icon"', 'lang="ja"']) {
    if (!html.includes(needle)) errors.push(`missing head element: ${needle}`);
  }
  return files.length;
}

async function build() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await cp(srcDir, distDir, { recursive: true });
  for (const file of await walk(distDir)) {
    if (!TEXT_EXT.has(extname(file))) continue;
    const text = await readFile(file, 'utf8');
    if (text.includes('%SITE_URL%')) await writeFile(file, text.replaceAll('%SITE_URL%', siteUrl));
  }
  await writeFile(join(distDir, '.nojekyll'), '');
}

const target = checkOnly ? srcDir : distDir;
if (!checkOnly) await build();
const count = await validate(target);

if (!checkOnly) {
  const html = await readFile(join(distDir, 'index.html'), 'utf8');
  if (html.includes('%SITE_URL%')) errors.push('SITE_URL placeholder left in dist/index.html');
  let bytes = 0;
  for (const f of await walk(distDir)) bytes += (await stat(f)).size;
  console.log(`dist: ${count} files, ${(bytes / 1024).toFixed(0)} KB, SITE_URL=${siteUrl}`);
}

if (errors.length) {
  console.error(`\n✗ ${errors.length} problem(s):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✓ ${checkOnly ? 'check' : 'build'} passed`);
