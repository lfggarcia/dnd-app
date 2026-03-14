#!/usr/bin/env node
/**
 * compress-assets.js
 *
 * Compresses and converts all PNG assets under assets/images/ to WebP,
 * keeping originals untouched. Output files are written alongside the
 * source PNGs with the same base name and a .webp extension.
 *
 * Usage:
 *   node scripts/compress-assets.js [--quality 85] [--dry-run] [--force]
 *
 * Options:
 *   --quality  <n>   WebP quality 1-100 (default 85). For lossless use 100.
 *   --dry-run        Print what would be done without writing any files.
 *   --force          Re-convert even if the .webp already exists.
 *   --dir     <path> Root directory to scan (default: assets/images).
 *   --clean          Delete .webp files that no longer have a matching .png.
 *
 * After running this script you will also need to:
 *   1. Update require() paths in characterCatalogService.ts and
 *      monsterIllustrations.ts to use .webp instead of .png.
 *   2. Clear the Metro cache: `yarn start --reset-cache`.
 *
 * Requirements:
 *   npm install --save-dev sharp
 */

const path  = require('path');
const fs    = require('fs');
const sharp = require('sharp');

// ── CLI parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getFlag  = (name)         => args.includes(name);
const getParam = (name, def)    => {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
};

const QUALITY   = parseInt(getParam('--quality', '85'), 10);
const DRY_RUN   = getFlag('--dry-run');
const FORCE     = getFlag('--force');
const CLEAN     = getFlag('--clean');
const ROOT_DIR  = path.resolve(process.cwd(), getParam('--dir', 'assets/images'));

if (isNaN(QUALITY) || QUALITY < 1 || QUALITY > 100) {
  console.error('❌  --quality must be between 1 and 100');
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function walkDir(dir, cb) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, cb);
    else cb(full);
  }
}

function formatBytes(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(ROOT_DIR)) {
    console.error(`❌  Directory not found: ${ROOT_DIR}`);
    process.exit(1);
  }

  console.log(`\n🔍  Scanning ${ROOT_DIR} …`);
  console.log(`    quality=${QUALITY}  dry-run=${DRY_RUN}  force=${FORCE}\n`);

  const pngs = [];
  walkDir(ROOT_DIR, (file) => {
    if (file.toLowerCase().endsWith('.png')) pngs.push(file);
  });

  console.log(`📦  Found ${pngs.length} PNG files\n`);

  let converted  = 0;
  let skipped    = 0;
  let errors     = 0;
  let savedTotal = 0;

  for (const src of pngs) {
    const dest = src.replace(/\.png$/i, '.webp');

    if (!FORCE && fs.existsSync(dest)) {
      skipped++;
      continue;
    }

    const relSrc = path.relative(process.cwd(), src);

    if (DRY_RUN) {
      console.log(`  [DRY] ${relSrc} → .webp`);
      converted++;
      continue;
    }

    try {
      const srcSize  = fs.statSync(src).size;
      await sharp(src)
        .webp({ quality: QUALITY, effort: 4 })
        .toFile(dest);
      const destSize = fs.statSync(dest).size;
      const saved    = srcSize - destSize;
      savedTotal    += saved;
      const pct      = ((saved / srcSize) * 100).toFixed(1);
      const relDest  = path.relative(process.cwd(), dest);
      console.log(`  ✓  ${relSrc}`);
      console.log(`     ${formatBytes(srcSize)} → ${formatBytes(destSize)}  (${pct}% smaller)\n`);
      converted++;
    } catch (err) {
      console.error(`  ✗  ${relSrc}: ${err.message}`);
      errors++;
    }
  }

  // ── Clean orphan .webp files ──────────────────────────────────────────────

  if (CLEAN) {
    console.log('\n🧹  Cleaning orphaned .webp files …');
    const webps = [];
    walkDir(ROOT_DIR, (file) => {
      if (file.toLowerCase().endsWith('.webp')) webps.push(file);
    });
    for (const webp of webps) {
      const sibling = webp.replace(/\.webp$/i, '.png');
      if (!fs.existsSync(sibling)) {
        const rel = path.relative(process.cwd(), webp);
        if (DRY_RUN) {
          console.log(`  [DRY] would delete ${rel}`);
        } else {
          fs.unlinkSync(webp);
          console.log(`  🗑  Deleted ${rel}`);
        }
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log('\n────────────────────────────────────────');
  console.log(`✅  Converted : ${converted}`);
  console.log(`⏭  Skipped   : ${skipped}  (already .webp — use --force to redo)`);
  if (errors > 0) console.log(`❌  Errors    : ${errors}`);
  if (!DRY_RUN && savedTotal > 0) {
    console.log(`💾  Total saved: ${formatBytes(savedTotal)}`);
  }
  console.log('────────────────────────────────────────\n');

  if (converted > 0 && !DRY_RUN) {
    console.log('Next steps:');
    console.log('  1. Run: node scripts/update-require-webp.js    (auto-updates require paths)');
    console.log('  2. Run: yarn start --reset-cache\n');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
