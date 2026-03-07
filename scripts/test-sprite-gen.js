#!/usr/bin/env node
/**
 * scripts/test-sprite-gen.js
 *
 * Quick integrity test — generates ONE txt2img base sprite (skeleton) and verifies
 * the PNG before you kick off the full overnight generation.
 *
 * Requirements: Node 18+ (native fetch)
 * Run from project root:
 *   node scripts/test-sprite-gen.js
 *
 * NOTE: Connects directly to ComfyUI at 192.168.0.20:8089
 *       socat does NOT need to be running for this script.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────
const COMFY_URL      = 'http://192.168.0.20:8089';
const POLL_INTERVAL  = 2_000;   // ms between history polls
const POLL_MAX       = 90;      // max ~3 minutes
const OUT_DIR        = path.join(__dirname, '..', 'assets', 'sprites', '_test');

const NEGATIVE =
  '(worst quality, low quality:1.4), photorealistic, photograph, 3d render, ' +
  'blurry, deformed, bad anatomy, extra limbs, watermark, text, logo, signature, nsfw';

// ─── Node version guard ───────────────────────────────────────────────────────
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error(`Node 18+ required (you have ${process.version})`);
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function queueWorkflow(workflow) {
  const r = await fetch(`${COMFY_URL}/prompt`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ prompt: workflow }),
  });
  if (!r.ok) throw new Error(`Queue failed ${r.status}: ${await r.text()}`);
  return (await r.json()).prompt_id;
}

async function pollUntilDone(promptId) {
  const t0 = Date.now();
  for (let i = 0; i < POLL_MAX; i++) {
    await sleep(POLL_INTERVAL);
    const r = await fetch(`${COMFY_URL}/history/${promptId}`);
    if (!r.ok) continue;
    const history = await r.json();
    const entry   = history[promptId];
    if (entry?.status?.completed)                       return { entry, elapsed: Date.now() - t0 };
    if (entry?.status?.status_str === 'error')          throw new Error('ComfyUI reported a generation error');
    process.stdout.write(`\r   Generating... ${Math.floor((Date.now() - t0) / 1000)}s elapsed   `);
  }
  throw new Error(`Timed out after ${(POLL_MAX * POLL_INTERVAL / 1000)}s`);
}

async function fetchOutputBlob(filename, subfolder) {
  const p = new URLSearchParams({ filename, subfolder, type: 'output' });
  const r = await fetch(`${COMFY_URL}/view?${p}`);
  if (!r.ok) throw new Error(`Image fetch failed ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
function isValidPng(buf) {
  if (buf.length < PNG_MAGIC.length) return false;
  return PNG_MAGIC.every((b, i) => buf[i] === b);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n=== Sprite Generation Integrity Test ===\n');

  // 1. Connectivity ----------------------------------------------------------
  process.stdout.write('1. Connecting to ComfyUI ... ');
  let stats;
  try {
    const r = await fetch(`${COMFY_URL}/system_stats`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    stats = await r.json();
  } catch (e) {
    throw new Error(
      `${e.message}\n   Is ComfyUI running? Check: curl ${COMFY_URL}/system_stats`
    );
  }
  console.log(`OK  (Python ${stats.system?.python_version ?? '?'})`);

  // 2. Queue txt2img ---------------------------------------------------------
  const seed = Math.floor(Math.random() * 2 ** 32);
  process.stdout.write(`2. Queuing test sprite (seed ${seed}) ... `);

  const workflow = {
    '1': {
      inputs:     { ckpt_name: 'perfectWorld_v6Baked.safetensors' },
      class_type: 'CheckpointLoaderSimple',
    },
    '2': {
      inputs: {
        text: '(masterpiece, best quality), dark fantasy RPG sprite of an undead skeleton warrior. ' +
              'Full body view, front-facing neutral stance. Digital painting, dungeon crawler game art ' +
              'style, D&D inspired. Dark moody background, dramatic lighting, highly detailed. No text, no watermark.',
        clip: ['1', 1],
      },
      class_type: 'CLIPTextEncode',
    },
    '3': { inputs: { text: NEGATIVE, clip: ['1', 1] }, class_type: 'CLIPTextEncode' },
    '4': { inputs: { width: 512, height: 768, batch_size: 1 }, class_type: 'EmptyLatentImage' },
    '5': {
      inputs: {
        seed, steps: 25, cfg: 7,
        sampler_name: 'dpm_2_ancestral',
        scheduler:    'karras',
        denoise:      1,
        model:         ['1', 0],
        positive:      ['2', 0],
        negative:      ['3', 0],
        latent_image:  ['4', 0],
      },
      class_type: 'KSampler',
    },
    '6': { inputs: { samples: ['5', 0], vae: ['1', 2] }, class_type: 'VAEDecode' },
    '7': {
      inputs: { upscale_method: 'nearest-exact', megapixels: 1, resolution_steps: 1, image: ['6', 0] },
      class_type: 'ImageScaleToTotalPixels',
    },
    '8': { inputs: { filename_prefix: 'sprite-test', images: ['7', 0] }, class_type: 'SaveImage' },
  };

  const promptId = await queueWorkflow(workflow);
  console.log(`OK  →  prompt_id: ${promptId}`);

  // 3. Poll ------------------------------------------------------------------
  process.stdout.write('3. Waiting for generation ...');
  const { entry, elapsed } = await pollUntilDone(promptId);
  console.log(`\n   Done in ${(elapsed / 1000).toFixed(1)}s`);

  // 4. Fetch image -----------------------------------------------------------
  const imgs = entry.outputs?.['8']?.images;
  if (!imgs?.length) throw new Error('No output images found in history entry');
  const { filename, subfolder } = imgs[0];

  process.stdout.write(`4. Fetching "${filename}" ... `);
  const buf = await fetchOutputBlob(filename, subfolder);
  console.log(`OK  (${(buf.length / 1024).toFixed(1)} KB)`);

  // 5. Save ------------------------------------------------------------------
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'skeleton_base_test.png');
  fs.writeFileSync(outPath, buf);

  // 6. Verify PNG integrity --------------------------------------------------
  process.stdout.write('5. Verifying PNG integrity ... ');
  if (!isValidPng(buf))      throw new Error('Invalid PNG — bad magic bytes (corrupted download?)');
  if (buf.length < 10_000)   throw new Error(`File too small (${buf.length} B) — image appears empty`);
  console.log('OK\n');

  // 7. Time estimates --------------------------------------------------------
  const IMG2IMG_EST_S    = 140;   // seconds per img2img frame (per ComfyUI log)
  const ENEMIES          = 15;
  const ANIMATIONS       = 5;
  const FRAMES_PER_ANIM  = 4;
  const totalFrames      = ENEMIES * (1 + ANIMATIONS * FRAMES_PER_ANIM); // 315
  const totalTimeS       = ENEMIES * elapsed / 1000 + ENEMIES * ANIMATIONS * FRAMES_PER_ANIM * IMG2IMG_EST_S;

  const h   = Math.floor(totalTimeS / 3600);
  const m   = Math.floor((totalTimeS % 3600) / 60);

  console.log('--- Test PASSED ---');
  console.log(`  Saved to : ${path.relative(process.cwd(), outPath)}`);
  console.log(`  txt2img  : ${(elapsed / 1000).toFixed(1)}s / image`);
  console.log(`  img2img  : ~${IMG2IMG_EST_S}s / frame (estimated)`);
  console.log(`  Total    : ${totalFrames} images (${ENEMIES} enemies × ${1 + ANIMATIONS * FRAMES_PER_ANIM})`);
  console.log(`  Est. time: ~${h}h ${m}m  (leave it overnight)`);
  console.log('\n  Open the saved PNG to visually confirm quality.');
  console.log('  If it looks good, run: node scripts/generate-sprites.js\n');
}

main().catch(err => {
  console.error('\n--- Test FAILED ---');
  console.error(err.message);
  process.exit(1);
});
