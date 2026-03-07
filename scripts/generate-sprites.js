#!/usr/bin/env node
/**
 * scripts/generate-sprites.js
 *
 * Overnight batch sprite generator.
 * Generates 4-frame animations for every enemy using ComfyUI:
 *   Phase 1 (txt2img)  — base sprite per enemy  (~8s each)
 *   Phase 2 (img2img)  — 5 actions × 4 frames   (~140s each)
 *
 * Output:
 *   assets/sprites/enemies/<enemy>/base.png
 *   assets/sprites/enemies/<enemy>/<animation>/frame_<0-3>.png
 *   assets/sprites/enemies/index.json          ← used by the app
 *   assets/sprites/enemies/progress.json       ← resume state (auto-managed)
 *
 * Run:
 *   node scripts/generate-sprites.js
 *   node scripts/generate-sprites.js --resume   (skip already completed)
 *   node scripts/generate-sprites.js --enemy skeleton   (single enemy)
 *
 * Requirements: Node 18+ (native fetch)
 * ComfyUI must be reachable at COMFY_URL below.
 * socat does NOT need to be running for this script (connects directly).
 */
'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────
const COMFY_URL     = 'http://192.168.0.20:8089';
const POLL_INTERVAL = 2_000;
const POLL_MAX      = 120;   // ~4 min max per image

const SPRITES_DIR   = path.join(__dirname, '..', 'assets', 'sprites', 'enemies');
const PROGRESS_FILE = path.join(SPRITES_DIR, 'progress.json');
const INDEX_FILE    = path.join(SPRITES_DIR, 'index.json');

const IMG2IMG_DENOISE_IDLE   = 0.45;  // stay very close to base
const IMG2IMG_DENOISE_ACTION = 0.65;  // more freedom for pose variation

// ─── Node version guard ───────────────────────────────────────────────────────
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) { console.error(`Node 18+ required (you have ${process.version})`); process.exit(1); }

// ─── Enemy definitions ────────────────────────────────────────────────────────
const ENEMIES = {
  skeleton:          'undead skeleton warrior with a rusty sword',
  skeleton_archer:   'undead skeleton archer holding a longbow',
  skeleton_knight:   'armored undead skeleton knight with shield and mace',
  skeleton_mage:     'undead skeleton sorcerer holding a glowing skull staff',
  goblin:            'small green goblin fighter with a jagged rusty blade',
  goblin_veteran:    'scarred veteran goblin in patched leather armor, dual daggers',
  goblin_raider:     'aggressive goblin raider with twin curved scimitars',
  goblin_champion:   'large brutish goblin champion wielding a heavy war axe',
  goblin_shaman:     'goblin shaman with bone headdress and magical staff of totems',
  rat:               'giant dungeon rat with sharp fangs and claws',
  dire_rat:          'massive dire rat the size of a dog, glowing red eyes',
  cultist:           'dark-robed cultist with glowing arcane sigils on their robe',
  knight:            'corrupted fallen dark knight in black plate armor',
  demon:             'small dungeon imp demon with leathery wings and claws',
  lich:              'ancient undead lich sorcerer wearing a dark crown, tattered robes',
};

const ANIMATIONS = ['idle', 'run', 'attack', 'damage', 'death'];

// 4-frame descriptions per animation — describes the pose at each frame step
const FRAME_DESCS = {
  idle: [
    'standing neutral idle pose, weight evenly distributed, arms relaxed at sides',
    'standing idle, subtle weight shift to the left, slight lean',
    'standing idle, chest slightly raised as if breathing in, eyes forward',
    'standing idle, weight settling back to center, returning to neutral',
  ],
  run: [
    'running pose, right leg leading forward, left arm swinging forward, leaning ahead',
    'running mid-stride, feet momentarily close together, full forward lean',
    'running pose, left leg leading forward, right arm swinging forward',
    'running push-off, rear leg fully extended, body at peak stride height',
  ],
  attack: [
    'attack wind-up, weapon raised high behind shoulder, body twisted back, coiled for strike',
    'attack mid-swing, weapon arcing forward with force, torso rotating, eyes on target',
    'attack full extension, weapon reaches its furthest point, arm fully extended at target',
    'attack follow-through, weapon lowering after strike, body recovering, feet resetting',
  ],
  damage: [
    'taking a hit, bracing for impact, arms slightly raised, forward-facing',
    'hit reaction, head snapping back, body recoiling, staggering backward',
    'full recoil from hit, hunched over, arms out for balance, grimacing in pain',
    'recovering from hit, straightening up slowly, guard coming back up',
  ],
  death: [
    'beginning to fall, knees weakening and buckling, body starting to tip',
    'mid-fall, body leaning steeply backward, arms flailing outward for balance',
    'hitting the ground, body impacting the floor, explosive collision',
    'collapsed and motionless on the ground, completely defeated, lying flat',
  ],
};

const NEGATIVE =
  '(worst quality, low quality:1.4), photorealistic, photograph, 3d render, ' +
  'blurry, deformed, bad anatomy, extra limbs, watermark, text, logo, signature, nsfw';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(msg) {
  const ts = new Date().toLocaleTimeString('es', { hour12: false });
  console.log(`[${ts}] ${msg}`);
}

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return {}; }
}

function saveProgress(progress) {
  fs.mkdirSync(SPRITES_DIR, { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function saveIndex(index) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

// ─── ComfyUI API ─────────────────────────────────────────────────────────────
async function queueWorkflow(workflow) {
  const r = await fetch(`${COMFY_URL}/prompt`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ prompt: workflow }),
  });
  if (!r.ok) throw new Error(`Queue ${r.status}: ${await r.text()}`);
  return (await r.json()).prompt_id;
}

async function pollUntilDone(promptId, label) {
  const t0 = Date.now();
  for (let i = 0; i < POLL_MAX; i++) {
    await sleep(POLL_INTERVAL);
    const r = await fetch(`${COMFY_URL}/history/${promptId}`);
    if (!r.ok) continue;
    const h     = await r.json();
    const entry = h[promptId];
    if (entry?.status?.completed)           return { entry, elapsed: Date.now() - t0 };
    if (entry?.status?.status_str === 'error') throw new Error('ComfyUI generation error');
    const s = Math.floor((Date.now() - t0) / 1000);
    process.stdout.write(`\r     ${label} — ${s}s elapsed...   `);
  }
  throw new Error(`Timeout after ${POLL_MAX * POLL_INTERVAL / 1000}s`);
}

async function fetchOutputBlob(filename, subfolder) {
  const p = new URLSearchParams({ filename, subfolder, type: 'output' });
  const r = await fetch(`${COMFY_URL}/view?${p}`);
  if (!r.ok) throw new Error(`Image fetch ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function copyOutputToInput(filename, subfolder) {
  const blob = await fetchOutputBlob(filename, subfolder);
  const form = new FormData();
  form.append('image', new Blob([blob], { type: 'image/png' }), filename);
  form.append('overwrite', 'true');
  const r = await fetch(`${COMFY_URL}/upload/image`, { method: 'POST', body: form });
  if (!r.ok) throw new Error(`Upload ${r.status}`);
  return (await r.json()).name;
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
function isValidPng(buf) {
  return buf.length > 10_000 && PNG_MAGIC.every((b, i) => buf[i] === b);
}

// ─── Workflow builders ────────────────────────────────────────────────────────
function buildTxt2Img(positiveText, seed) {
  return {
    '1': { inputs: { ckpt_name: 'perfectWorld_v6Baked.safetensors' }, class_type: 'CheckpointLoaderSimple' },
    '2': { inputs: { text: positiveText, clip: ['1', 1] },             class_type: 'CLIPTextEncode' },
    '3': { inputs: { text: NEGATIVE,     clip: ['1', 1] },             class_type: 'CLIPTextEncode' },
    '4': { inputs: { width: 512, height: 768, batch_size: 1 },         class_type: 'EmptyLatentImage' },
    '5': {
      inputs: {
        seed, steps: 25, cfg: 7,
        sampler_name: 'dpm_2_ancestral', scheduler: 'karras', denoise: 1,
        model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0],
      },
      class_type: 'KSampler',
    },
    '6': { inputs: { samples: ['5', 0], vae: ['1', 2] },                class_type: 'VAEDecode' },
    '7': {
      inputs: { upscale_method: 'nearest-exact', megapixels: 1, resolution_steps: 1, image: ['6', 0] },
      class_type: 'ImageScaleToTotalPixels',
    },
    '8': { inputs: { filename_prefix: 'dnd3-base', images: ['7', 0] }, class_type: 'SaveImage' },
  };
}

function buildImg2Img(positiveText, seed, baseImageFilename, denoise) {
  return {
    '1':  { inputs: { ckpt_name: 'perfectWorld_v6Baked.safetensors' }, class_type: 'CheckpointLoaderSimple' },
    '2':  { inputs: { text: positiveText, clip: ['1', 1] },             class_type: 'CLIPTextEncode' },
    '3':  { inputs: { text: NEGATIVE,     clip: ['1', 1] },             class_type: 'CLIPTextEncode' },
    '10': { inputs: { image: baseImageFilename },                        class_type: 'LoadImage' },
    '11': { inputs: { pixels: ['10', 0], vae: ['1', 2] },               class_type: 'VAEEncode' },
    '5': {
      inputs: {
        seed, steps: 25, cfg: 7,
        sampler_name: 'dpm_2_ancestral', scheduler: 'karras', denoise,
        model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['11', 0],
      },
      class_type: 'KSampler',
    },
    '6':  { inputs: { samples: ['5', 0], vae: ['1', 2] },               class_type: 'VAEDecode' },
    '7': {
      inputs: { upscale_method: 'nearest-exact', megapixels: 1, resolution_steps: 1, image: ['6', 0] },
      class_type: 'ImageScaleToTotalPixels',
    },
    '8':  { inputs: { filename_prefix: 'dnd3-anim', images: ['7', 0] }, class_type: 'SaveImage' },
  };
}

// ─── Generation logic ─────────────────────────────────────────────────────────

async function generateBase(enemyKey, desc) {
  const prompt =
    `(masterpiece, best quality), dark fantasy RPG dungeon crawler sprite of a ${desc}. ` +
    `Full body view, front-facing neutral stance. Digital painting, game art style, D&D inspired. ` +
    `Dark moody background, dramatic directional lighting, highly detailed. No text, no watermark, no UI.`;

  const seed     = Math.floor(Math.random() * 2 ** 32);
  const workflow = buildTxt2Img(prompt, seed);
  const promptId = await queueWorkflow(workflow);

  const { entry, elapsed } = await pollUntilDone(promptId, `${enemyKey} base`);
  process.stdout.write('\n');

  const imgs = entry.outputs?.['8']?.images;
  if (!imgs?.length) throw new Error('No output in history');
  return { ...imgs[0], elapsed };
}

async function generateAnimationFrame(enemyKey, desc, anim, frameIndex, baseInputFilename) {
  const frameDesc = FRAME_DESCS[anim][frameIndex];
  const denoise   = anim === 'idle' ? IMG2IMG_DENOISE_IDLE : IMG2IMG_DENOISE_ACTION;

  const prompt =
    `(masterpiece, best quality), dark fantasy RPG dungeon crawler sprite of a ${desc}, ` +
    `${frameDesc}. ` +
    `Same character as reference, same color palette, same art style. ` +
    `Full body view, digital painting, game art style, D&D inspired. ` +
    `Dark moody background, dramatic directional lighting, highly detailed. No text, no watermark, no UI.`;

  const seed     = Math.floor(Math.random() * 2 ** 32);
  const workflow = buildImg2Img(prompt, seed, baseInputFilename, denoise);
  const promptId = await queueWorkflow(workflow);

  const { entry, elapsed } = await pollUntilDone(
    promptId,
    `${enemyKey}/${anim}/frame_${frameIndex}`,
  );
  process.stdout.write('\n');

  const imgs = entry.outputs?.['8']?.images;
  if (!imgs?.length) throw new Error('No output in history');
  return { ...imgs[0], elapsed };
}

async function processEnemy(enemyKey, desc, progress, index) {
  const enemyDir = path.join(SPRITES_DIR, enemyKey);
  fs.mkdirSync(enemyDir, { recursive: true });

  if (!progress[enemyKey]) progress[enemyKey] = {};
  const ep = progress[enemyKey];

  // ── Phase 1: base sprite ──────────────────────────────────────────────────
  let baseComfyFile; // { filename, subfolder } on ComfyUI output

  if (ep.base) {
    log(`  [SKIP] ${enemyKey}/base  (already done)`);
    baseComfyFile = ep.base.comfyFile;
  } else {
    log(`  Generating base sprite for ${enemyKey}...`);
    const result = await generateBase(enemyKey, desc);

    const buf     = await fetchOutputBlob(result.filename, result.subfolder);
    if (!isValidPng(buf)) throw new Error(`Base sprite PNG invalid for ${enemyKey}`);

    const outPath = path.join(enemyDir, 'base.png');
    fs.writeFileSync(outPath, buf);

    baseComfyFile       = { filename: result.filename, subfolder: result.subfolder };
    ep.base             = { path: `assets/sprites/enemies/${enemyKey}/base.png`, comfyFile: baseComfyFile };
    saveProgress(progress);

    index[enemyKey]     = { base: ep.base.path, animations: {} };
    log(`  Saved ${path.relative(process.cwd(), outPath)} (${(buf.length / 1024).toFixed(0)} KB, ${(result.elapsed / 1000).toFixed(1)}s)`);
  }

  // Ensure index entry exists (resume path)
  if (!index[enemyKey]) {
    index[enemyKey] = { base: ep.base.path, animations: {} };
  }

  // ── Phase 2: img — upload base once for reuse ─────────────────────────────
  log(`  Uploading base sprite to ComfyUI input...`);
  const baseInputName = await copyOutputToInput(baseComfyFile.filename, baseComfyFile.subfolder);
  log(`  Uploaded as: ${baseInputName}`);

  // ── Phase 3: animation frames ─────────────────────────────────────────────
  for (const anim of ANIMATIONS) {
    if (!ep[anim]) ep[anim] = {};
    if (!index[enemyKey].animations[anim]) index[enemyKey].animations[anim] = [];

    const animDir = path.join(enemyDir, anim);
    fs.mkdirSync(animDir, { recursive: true });

    for (let f = 0; f < 4; f++) {
      const frameKey = `frame_${f}`;

      if (ep[anim][frameKey]) {
        log(`  [SKIP] ${enemyKey}/${anim}/${frameKey}  (already done)`);
        if (!index[enemyKey].animations[anim][f]) {
          index[enemyKey].animations[anim][f] = ep[anim][frameKey].path;
        }
        continue;
      }

      log(`  Generating ${enemyKey}/${anim}/${frameKey}...`);
      const result = await generateAnimationFrame(enemyKey, desc, anim, f, baseInputName);

      const buf     = await fetchOutputBlob(result.filename, result.subfolder);
      if (!isValidPng(buf)) throw new Error(`Anim PNG invalid: ${enemyKey}/${anim}/${frameKey}`);

      const outPath = path.join(animDir, `${frameKey}.png`);
      fs.writeFileSync(outPath, buf);

      const relPath = `assets/sprites/enemies/${enemyKey}/${anim}/${frameKey}.png`;
      ep[anim][frameKey] = { path: relPath };
      index[enemyKey].animations[anim][f] = relPath;

      saveProgress(progress);
      saveIndex(index);

      log(`  Saved ${path.relative(process.cwd(), outPath)} (${(buf.length / 1024).toFixed(0)} KB, ${(result.elapsed / 1000).toFixed(1)}s)`);
    }
  }

  log(`  === ${enemyKey} COMPLETE ===`);
}

// ─── Entry point ─────────────────────────────────────────────────────────────
async function main() {
  const args         = process.argv.slice(2);
  const resumeMode   = args.includes('--resume');
  const singleEnemy  = args[args.indexOf('--enemy') + 1];

  console.log('\n=== DnD3 Sprite Batch Generator ===');
  console.log(`  Resume mode : ${resumeMode ? 'ON' : 'OFF'}`);
  console.log(`  Single enemy: ${singleEnemy ?? 'all'}`);
  console.log(`  Output dir  : ${path.relative(process.cwd(), SPRITES_DIR)}`);
  console.log('');

  // Connectivity check
  process.stdout.write('Connecting to ComfyUI... ');
  const ping = await fetch(`${COMFY_URL}/system_stats`).catch(e => {
    throw new Error(`Cannot reach ComfyUI: ${e.message}`);
  });
  if (!ping.ok) throw new Error(`ComfyUI returned HTTP ${ping.status}`);
  console.log('OK\n');

  fs.mkdirSync(SPRITES_DIR, { recursive: true });

  const progress = resumeMode ? loadProgress() : {};
  const index    = resumeMode && fs.existsSync(INDEX_FILE)
    ? JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))
    : {};

  const enemiesToProcess = singleEnemy
    ? { [singleEnemy]: ENEMIES[singleEnemy] }
    : ENEMIES;

  if (singleEnemy && !ENEMIES[singleEnemy]) {
    throw new Error(`Unknown enemy "${singleEnemy}". Valid: ${Object.keys(ENEMIES).join(', ')}`);
  }

  const enemyList   = Object.entries(enemiesToProcess);
  const totalImages = enemyList.length * (1 + ANIMATIONS.length * 4);
  const t0          = Date.now();

  log(`Starting generation: ${enemyList.length} enemies, ${totalImages} total images`);
  log('Ctrl+C to pause — re-run with --resume to continue\n');

  let done = 0;

  for (const [enemyKey, desc] of enemyList) {
    log(`\n[${enemyKey.toUpperCase()}] (${++done}/${enemyList.length})`);
    try {
      await processEnemy(enemyKey, desc, progress, index);
    } catch (err) {
      log(`  ERROR on ${enemyKey}: ${err.message}`);
      log('  Saving progress and continuing with next enemy...');
      saveProgress(progress);
      saveIndex(index);
    }
  }

  saveIndex(index);
  const elapsed = (Date.now() - t0) / 1000;
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);

  console.log('\n=== Generation complete ===');
  console.log(`  Total time : ${h}h ${m}m`);
  console.log(`  Index      : ${path.relative(process.cwd(), INDEX_FILE)}`);
  console.log(`  Progress   : ${path.relative(process.cwd(), PROGRESS_FILE)}`);
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
