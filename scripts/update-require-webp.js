#!/usr/bin/env node
/**
 * update-require-webp.js
 *
 * After running compress-assets.js, this script patches all TypeScript/JS
 * source files so that require('…/portrait.png') becomes require('…/portrait.webp').
 *
 * Only replaces paths where the .webp sibling actually exists on disk, so it
 * is safe to run incrementally (e.g. after generating a new batch of portraits).
 *
 * Usage:
 *   node scripts/update-require-webp.js [--dry-run] [--dir src]
 *
 * Options:
 *   --dry-run     Show what would change without writing.
 *   --dir <path>  Source directory to scan (default: src).
 */

const path  = require('path');
const fs    = require('fs');

const args     = process.argv.slice(2);
const DRY_RUN  = args.includes('--dry-run');
const dirIdx   = args.indexOf('--dir');
const SRC_DIR  = path.resolve(process.cwd(), dirIdx !== -1 && args[dirIdx + 1] ? args[dirIdx + 1] : 'src');

// Match require('…something.png') or require("…something.png")
const REQUIRE_PNG = /require\(['"]([^'"]+\.png)['"]\)/g;

function walkDir(dir, cb) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, cb);
    else cb(full);
  }
}

function processFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) return;

  const original = fs.readFileSync(filePath, 'utf8');
  let updated    = original;
  let count      = 0;

  updated = original.replace(REQUIRE_PNG, (match, pngRelPath) => {
    // Resolve the PNG relative to the source file's directory
    const absSource   = path.resolve(path.dirname(filePath), pngRelPath);
    const absWebp     = absSource.replace(/\.png$/i, '.webp');

    if (!fs.existsSync(absWebp)) return match; // .webp not yet generated — skip

    const webpRelPath = pngRelPath.replace(/\.png$/i, '.webp');
    const quote       = match.includes("'") ? "'" : '"';
    count++;
    return `require(${quote}${webpRelPath}${quote})`;
  });

  if (count === 0) return;

  const rel = path.relative(process.cwd(), filePath);
  if (DRY_RUN) {
    console.log(`  [DRY] ${rel}  (${count} replacement${count > 1 ? 's' : ''})`);
    return;
  }

  fs.writeFileSync(filePath, updated, 'utf8');
  console.log(`  ✓  ${rel}  (${count} replacement${count > 1 ? 's' : ''})`);
}

console.log(`\n🔄  Scanning ${SRC_DIR} for require('….png') …\n`);
let filesChanged = 0;

walkDir(SRC_DIR, (file) => {
  const before = filesChanged;
  processFile(file);
  // crude way to count — processFile logs when it changes something
});

// Also patch the scripts directory itself (monsterIllustrations etc. live in src/)
walkDir(path.resolve(process.cwd(), 'src'), (file) => {
  processFile(file);
});

console.log('\n✅  Done.\n');
