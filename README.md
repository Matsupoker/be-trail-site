# BE TRAIL — Web Card

A quiet, one-page web card for BE TRAIL. Static HTML/CSS with a few lines of JS, deployed to GitHub Pages.

## Structure

```
src/                 site source (published as-is)
  index.html
  styles.css
  main.js            quiet reveal + email copy button
  assets/            logo and profile photo (optimized)
scripts/build.mjs    copies src/ → dist/, injects SITE_URL, validates assets and content
scripts/serve.mjs    local preview server for dist/
.github/workflows/   GitHub Pages deployment
```

## Commands

```bash
npm run build     # build + validate into dist/
npm run check     # validate src/ only
npm run preview   # serve dist/ at http://localhost:4173/
```

No dependencies to install. Node 20+.

## Deploy

Pushing to `main` runs `.github/workflows/pages.yml`.
One-time setup: repository **Settings → Pages → Source: GitHub Actions**.

`SITE_URL` (used for canonical / OG URLs) is taken from the Pages configuration in CI.
For a custom domain, set it there and rebuild.

## Content boundary

This repository is public. Only information intended for the public web card belongs here.
`scripts/build.mjs` fails the build on generic boundary violations, and additionally reads an
optional, never-committed `scripts/.blocklist.local` (one term per line) for local checks.
