#!/usr/bin/env node
/**
 * scripts/test-sprite-gen.js
 *
 * Integrity test: ONE base sprite (txt2img) + ONE idle frame (img2img).
 * Saves both PNGs + a full request/response log.
 *
 * Run: node scripts/test-sprite-gen.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const COMFY_URL     = 'http://192.168.0.20:8089';
const POLL_INTERVAL = 2_000;
const POLL_MAX      = 150;
const OUT_DIR       = path.join(__dirname, '..', 'assets', 'sprites', '_test');

const NEGATIVE =
  '(worst quality, low quality:1.4), photorealistic, photograph, 3d render, ' +
  'blurry, deformed, bad anatomy, extra limbs, watermark, text, logo, signature, nsfw';

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) { console.error('Node 18+ required'); process.exit(1); }

// ── Logger ─────────────────────────────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });
const logFile   = path.join(OUT_DIR, `run_${Date.now()}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(label, data) {
  const ts   = new Date().toISOString();
  const body = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  logStream.write(`\n${'\u2500'.repeat(70)}\n[${ts}] ${label}\n${body}\n`);
  if (!label.startsWith('REQUEST_BODY') && !label.startsWith('HISTORY_ENTRY')) {
    console.log(`  log: ${label}`);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function queueWorkflow(label, workflow) {
  const body = JSON.stringify({ prompt: workflow });
  log(`REQUEST_BODY :: ${label}`, body);
  const r = await fetch(`${COMFY_URL}/prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
  });
  const text = await r.text();
  log(`QUEUE_RESPONSE :: ${label}`, text);
  if (!r.ok) throw new Error(`Queue failed ${r.status}: ${text}`);
  return JSON.parse(text).prompt_id;
}

async function pollUntilDone(label, promptId) {
  const t0 = Date.now();
  for (let i = 0; i < POLL_MAX; i++) {
    await sleep(POLL_INTERVAL);
    const r = await fetch(`${COMFY_URL}/history/${promptId}`);
    if (!r.ok) continue;
    const history = await r.json();
    const entry   = history[promptId];
    const elapsed = Date.now() - t0;
    process.stdout.write(`\r  [${label}] ${Math.floor(elapsed / 1000)}s...   `);
    if (entry?.status?.status_str === 'error') {
      log(`POLL_ERROR :: ${label}`, entry);
      throw new Error(`ComfyUI error on step: ${label}`);
    }
    if (entry?.status?.completed) {
      log(`HISTORY_ENTRY :: ${label} (${(elapsed / 1000).toFixed(1)}s)`, entry);
      return { entry, elapsed };
    }
  }
  throw new Error(`Timeout waiting for: ${label}`);
}

async function fetchOutputBlob(filename, subfolder) {
  const p = new URLSearchParams({ filename, subfolder, type: 'output' });
  const r = await fetch(`${COMFY_URL}/view?${p}`);
  if (!r.ok) throw new Error(`Image download failed ${r.status} — ${filename}`);
  return Buffer.from(await r.arrayBuffer());
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
function assertValidPng(buf, name) {
  if (buf.length < PNG_MAGIC.length || !PNG_MAGIC.every((b, i) => buf[i] === b))
    throw new Error(`${name}: invalid PNG magic bytes`);
  if (buf.length < 10_000)
    throw new Error(`${name}: file too small (${buf.length} B)`);
}

// ── Workflow builders ──────────────────────────────────────────────────────
function buildTxt2Img(seed) {
  return {
    '1': { inputs: { ckpt_name: 'perfectWorld_v6Baked.safetensors' }, class_type: 'CheckpointLoaderSimple' },
    '2': {
      inputs: {
        text:
          '(masterpiece, best quality), dark fantasy RPG sprite of an undead skeleton warrior, ' +
          'full body view, front-facing neutral idle stance, digital painting, ' +
          'dungeon crawler game art style, dark moody background, dramatic lighting, ' +
          'highly detailed, no text, no watermark, no border',
        clip: ['1', 1],
      },
      class_type: 'CLIPTextEncode',
    },
    '3': { inputs: { text: NEGATIVE, clip: ['1', 1] }, class_type: 'CLIPTextEncode' },
    '4': { inputs: { width: 512, height: 768, batch_size: 1 }, class_type: 'EmptyLatentImage' },
    '5': {
      inputs: {
        seed, steps: 25, cfg: 7,
        sampler_name: 'dpm_2_ancestral', scheduler: 'karras', denoise: 1,
        model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0],
      },
      class_type: 'KSampler',
    },
    '6': { inputs: { samples: ['5', 0], vae: ['1', 2] }, class_type: 'VAEDecode' },
    '7': { inputs: { upscale_method: 'nearest-exact', megapixels: 1, resolution_steps: 1, image: ['6', 0] }, class_type: 'ImageScaleToTotalPixels' },
    '8': { inputs: { filename_prefix: 'test-base', images: ['7', 0] }, class_type: 'SaveImage' },
  };
}

function buildImg2Img(baseFilename, prompt, seed) {
  return {
    '1': { inputs: { ckpt_name: 'perfectWorld_v6Baked.safetensors' }, class_type: 'CheckpointLoaderSimple' },
    '2': { inputs: { text: prompt, clip: ['1', 1] }, class_type: 'CLIPTextEncode' },
    '3': { inputs: { text: NEGATIVE, clip: ['1', 1] }, class_type: 'CLIPTextEncode' },
    '10': { inputs: { image: baseFilename, upload: 'image' }, class_type: 'LoadImage' },
    '11': { inputs: { pixels: ['10', 0], vae: ['1', 2] }, class_type: 'VAEEncode' },
    '5': {
      inputs: {
        seed, steps: 25, cfg: 7,
        sampler_name: 'dpm_2_ancestral', scheduler: 'karras', denoise: 0.65,
        model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['11', 0],
      },
      class_type: 'KSampler',
    },
    '6': { inputs: { samples: ['5', 0], vae: ['1', 2] }, class_type: 'VAEDecode' },
    '7': { inputs: { upscale_method: 'nearest-exact', megapixels: 1, resolution_steps: 1, image: ['6', 0] }, class_type: 'ImageScaleToTotalPixels' },
    '8': { inputs: { filename_prefix: 'test-anim', images: ['7', 0] }, class_type: 'SaveImage' },
  };
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n=== Sprite Pipeline Integrity Test ===');
  console.log('  Enemy  : skeleton');
  console.log('  Action : idle (frame 0 only)');
  console.log(`  Log    : ${path.relative(process.cwd(), logFile)}\n`);

  log('TEST_START', { enemy: 'skeleton', action: 'idle', frame: 0, comfyUrl: COMFY_URL });

  // 1. Connectivity
  process.stdout.write('1. Connecting to ComfyUI ... ');
  let sysStats;
  try {
    const r = await fetch(`${COMFY_URL}/system_stats`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    sysStats = await r.json();
  } catch (e) {
    throw new Error(`${e.message}\n   Is ComfyUI running?  curl ${COMFY_URL}/system_stats`);
  }
  log('SYSTEM_STATS', sysStats);
  console.log(`OK  (Python ${sysStats.system?.python_version ?? '?'})`);

  // 2. PHASE 1 — txt2img
  const seedBase = Math.floor(Math.random() * 2 ** 32);
  console.log(`\n[PHASE 1] txt2img — base sprite  (seed ${seedBase})`);
  const pid1 = await queueWorkflow('TXT2IMG:skeleton_base', buildTxt2Img(seedBase));
  console.log(`  prompt_id: ${pid1}`);

  const { entry: e1, elapsed: t1 } = await pollUntilDone('txt2img', pid1);
  console.log(`\n  Done in ${(t1 / 1000).toFixed(1)}s`);

  const baseImgs = e1.outputs?.['8']?.images;
  if (!baseImgs?.length) throw new Error('No images in txt2img history');
  const { filename: baseFile, subfolder: baseSub } = baseImgs[0];
  log('TXT2IMG_OUTPUT', { filename: baseFile, subfolder: baseSub });
  console.log(`  ComfyUI file : ${baseFile}`);

  process.stdout.write('  Downloading base sprite ... ');
  const baseBuf = await fetchOutputBlob(baseFile, baseSub);
  assertValidPng(baseBuf, 'skeleton_base');
  const basePath = path.join(OUT_DIR, 'skeleton_base.png');
  fs.writeFileSync(basePath, baseBuf);
  console.log(`OK  (${(baseBuf.length / 1024).toFixed(1)} KB) -> ${path.relative(process.cwd(), basePath)}`);

  // 3. PHASE 2 — img2img
  const seedAnim   = Math.floor(Math.random() * 2 ** 32);
  const idlePrompt =
    '(masterpiece, best quality), dark fantasy RPG sprite of an undead skeleton warrior, ' +
    'idle neutral standing pose, relaxed stance, hands at sides, weight evenly distributed, ' +
    'same character as reference, consistent art style, digital painting, dungeon crawler game art, ' +
    'dark moody background, dramatic lighting, highly detailed, no text, no watermark';

  console.log(`\n[PHASE 2] img2img — idle frame 0  (seed ${seedAnim})`);
  console.log(`  Base file : ${baseFile}`);
  console.log(`  Denoise   : 0.65`);

  const pid2 = await queueWorkflow('IMG2IMG:skeleton_idle_f0', buildImg2Img(baseFile, idlePrompt, seedAnim));
  console.log(`  prompt_id: ${pid2}`);

  const { entry: e2, elapsed: t2 } = await pollUntilDone('img2img', pid2);
  console.log(`\n  Done in ${(t2 / 1000).toFixed(1)}s`);

  const animImgs = e2.outputs?.['8']?.images;
  if (!animImgs?.length) throw new Error('No images in img2img history');
  const { filename: animFile, subfolder: animSub } = animImgs[0];
  log('IMG2IMG_OUTPUT', { filename: animFile, subfolder: animSub });
  console.log(`  ComfyUI file : ${animFile}`);

  process.stdout.write('  Downloading idle frame ... ');
  const animBuf = await fetchOutputBlob(animFile, animSub);
  assertValidPng(animBuf, 'skeleton_idle_f0');
  const animPath = path.join(OUT_DIR, 'skeleton_idle_f0.png');
  fs.writeFileSync(animPath, animBuf);
  console.log(`OK  (${(animBuf.length / 1024).toFixed(1)} KB) -> ${path.relative(process.cwd(), animPath)}`);

  // 4. Summary
  log('TEST_SUCCESS', {
    txt2img_s: (t1 / 1000).toFixed(1),
    img2img_s: (t2 / 1000).toFixed(1),
    base_kb:   (baseBuf.length / 1024).toFixed(1),
    anim_kb:   (animBuf.length / 1024).toFixed(1),
  });

  const sep = '─'.repeat(52);
  console.log(`\n${sep}`);
  console.log('TEST PASSED');
  console.log(sep);
  console.log(`  txt2img  : ${(t1 / 1000).toFixed(1)}s`);
  console.log(`  img2img  : ${(t2 / 1000).toFixed(1)}s`);
  console.log(`  Base PNG : ${path.relative(process.cwd(), basePath)}`);
  console.log(`  Anim PNG : ${path.relative(process.cwd(), animPath)}`);
  console.log(`  Full log : ${path.relative(process.cwd(), logFile)}`);
  console.log('');
  console.log('  Share both images for quality review.');
  console.log('  We will tune params before the full overnight run.\n');
  logStream.end();
}

main().catch(err => {
  log('TEST_FAILED', err.message);
  logStream.end();
  console.error('\nTEST FAILED\n', err.message);
  process.exit(1);
});
