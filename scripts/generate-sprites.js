#!/usr/bin/env node
/**
 * scripts/generate-sprites.js
 *
 * Monster illustration batch generator -- Illustrious / PerfectDeliberate v8.
 * Generates one high-quality anime-style illustration per monster type.
 * No animation frames -- Skia handles all animated effects at runtime.
 *
 * Output:
 *   assets/images/monsters/<enemy>/illustration.png
 *   assets/images/monsters/index.json          <- used by the app
 *   assets/images/monsters/progress.json       <- resume state (auto-managed)
 *
 * Run:
 *   node scripts/generate-sprites.js
 *   node scripts/generate-sprites.js --resume        (skip already completed)
 *   node scripts/generate-sprites.js --enemy goblin  (single enemy)
 *
 * Requirements: Node 18+ (native fetch)
 * ComfyUI must be reachable at COMFY_URL with the following models installed:
 *   checkpoints/    perfectDeliberate_v8.safetensors
 *   loras/          748cm_ILL_v1.0.safetensors
 *                   thiccwithaq-artist-v1_ixl.safetensors
 *                   USNR_STYLE_ILL_V1.0.safetensors
 *   upscale_models/ 4x_remacri.pth
 */
'use strict';

const fs   = require('fs');
const path = require('path');

// --- Config ------------------------------------------------------------------
const COMFY_URL     = 'http://192.168.0.20:8089';
const POLL_INTERVAL = 2_000;
const POLL_MAX      = 180;   // ~6 min max per image (hires pass takes longer)

const IMAGES_DIR    = path.join(__dirname, '..', 'assets', 'images', 'monsters');
const PROGRESS_FILE = path.join(IMAGES_DIR, 'progress.json');
const INDEX_FILE    = path.join(IMAGES_DIR, 'index.json');

// --- Node version guard ------------------------------------------------------
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) { console.error(`Node 18+ required (you have ${process.version})`); process.exit(1); }

// --- Quality tags (Illustrious ecosystem) ------------------------------------
const QUALITY_PREFIX = 'score_9, score_8_up, score_8, masterpiece, best quality, newest, absurdres';
const QUALITY_NEG    = 'score_6, score_5, score_4, low quality, worst quality, ugly, blurry, deformed, bad anatomy, extra limbs, watermark, text, logo, signature, photorealistic, photograph, 3d render';

// --- Monster definitions -----------------------------------------------------
const ENEMIES = {
  skeleton: {
    desc:  'undead skeleton warrior, ancient rusted armor, cracked sword',
    pose:  'menacing battle stance, dark dungeon corridor',
    extra: '',
  },
  skeleton_archer: {
    desc:  'undead skeleton archer, tattered hood, longbow drawn taut',
    pose:  'aiming pose, arrow nocked, deep shadows',
    extra: '',
  },
  skeleton_knight: {
    desc:  'elite undead skeleton knight, black ornate plate armor, tower shield, flanged mace',
    pose:  'imposing guard stance, ancient crypt',
    extra: '',
  },
  skeleton_mage: {
    desc:  'undead skeleton sorcerer, torn dark robes, glowing eye sockets, skull-topped staff',
    pose:  'casting dark necromancy spell, arcane particles swirling',
    extra: 'glowing purple and black magic energy',
  },
  goblin: {
    desc:  'small green goblin fighter, beady yellow eyes, jagged rusty blade',
    pose:  'crouched aggressive stance, muddy cave',
    extra: '',
  },
  goblin_veteran: {
    desc:  'scarred veteran goblin, patched leather armor, dual daggers, battle scars',
    pose:  'cunning readied stance, flickering torchlight',
    extra: '',
  },
  goblin_raider: {
    desc:  'aggressive goblin raider, red war paint, twin curved scimitars',
    pose:  'charging berserker attack pose',
    extra: '',
  },
  goblin_champion: {
    desc:  'large brutish goblin champion, spiked heavy iron armor, massive war axe',
    pose:  'dominant power stance, arms spread wide',
    extra: '',
  },
  goblin_shaman: {
    desc:  'goblin shaman, elaborate bone headdress, totem staff of skulls, tribal markings',
    pose:  'ritual casting pose, mystic smoke rising',
    extra: 'eerie green glow, fire ritual',
  },
  rat: {
    desc:  'giant dungeon rat, sharp fangs, matted mangy grey fur, long tail',
    pose:  'hissing aggressive pose, sewer tunnel',
    extra: '',
  },
  dire_rat: {
    desc:  'massive dire rat the size of a large dog, glowing red eyes, scarred battle fur',
    pose:  'feral snarling pounce stance',
    extra: '',
  },
  cultist: {
    desc:  'dark-robed cultist, glowing arcane sigils on robes, ceremonial dagger, hood shadowing face',
    pose:  'sinister summoning gesture, arms outstretched',
    extra: 'dark ritual energy, eldritch fire',
  },
  knight: {
    desc:  'corrupted fallen dark knight, cracked black plate armor, twisted corrupted holy symbol',
    pose:  'heavy menacing stride forward, aura of darkness',
    extra: 'dark necrotic aura',
  },
  demon: {
    desc:  'small dungeon imp demon, red skin, leathery bat wings, sharp horn, pointed tail, claws',
    pose:  'hovering sneering pose, tail coiled',
    extra: '',
  },
  lich: {
    desc:  'ancient undead lich sorcerer, dark bone crown, tattered ceremonial robes, skeletal hands adorned with cursed gems',
    pose:  'regal floating throne pose, death magic swirling around hands',
    extra: 'necrotic green-black death magic, bone fragments orbiting',
  },
};

// --- Helpers -----------------------------------------------------------------
const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(msg) {
  const ts = new Date().toLocaleTimeString('es', { hour12: false });
  console.log(`[${ts}] ${msg}`);
}

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return {}; }
}

function saveProgress(p) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

function saveIndex(idx) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(idx, null, 2));
}

// --- ComfyUI API -------------------------------------------------------------
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
    if (entry?.status?.completed)              return { entry, elapsed: Date.now() - t0 };
    if (entry?.status?.status_str === 'error') throw new Error('ComfyUI generation error');
    const s = Math.floor((Date.now() - t0) / 1000);
    process.stdout.write(`\r     ${label} - ${s}s elapsed...   `);
  }
  throw new Error(`Timeout after ${POLL_MAX * POLL_INTERVAL / 1000}s`);
}

async function fetchOutputBlob(filename, subfolder) {
  const p = new URLSearchParams({ filename, subfolder, type: 'output' });
  const r = await fetch(`${COMFY_URL}/view?${p}`);
  if (!r.ok) throw new Error(`Image fetch ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
function isValidPng(buf) {
  return buf.length > 10_000 && PNG_MAGIC.every((b, i) => buf[i] === b);
}

// --- Workflow builder — Illustrious + PerfectDeliberate v8 -------------------
//
// Node graph mirrors 01-base-sprite.json:
//   [1]  CheckpointLoaderSimple
//    |-> [2]  LoraLoader (748cm 0.5)
//         |-> [3]  LoraLoader (ThiccWithaQ 0.7)
//              |-> [4]  LoraLoader (USNR 0.6)
//                   |-clip-> [5] CLIPSetLastLayer(-2) -> [6] positive
//                   |                               |-> [7] negative
//                   |-model-> [9] KSampler -> [10] VAEDecode
//                                               |-> [11/12] Remacri upscale
//                                                    |-> [13] ImageScale 1248x1824
//                                                         |-> [14] VAEEncode
//                                                              |-> [15] KSampler (hires)
//                                                                   |-> [16] VAEDecode
//                                                                        |-> [17] SaveImage
//
function buildMonsterWorkflow(positiveText, negativeText, seed) {
  return {
    '1':  { class_type: 'CheckpointLoaderSimple',  inputs: { ckpt_name: 'perfectdeliberate_v8.safetensors' } },
    '2':  { class_type: 'LoraLoader',              inputs: { model: ['1', 0], clip: ['1', 1], lora_name: '748cmSDXL.safetensors',                        strength_model: 0.5, strength_clip: 0.5 } },
    '3':  { class_type: 'LoraLoader',              inputs: { model: ['2', 0], clip: ['2', 1], lora_name: 'thiccwithaq-artist-richy-v1_ixl.safetensors', strength_model: 0.7, strength_clip: 0.7 } },
    '4':  { class_type: 'LoraLoader',              inputs: { model: ['3', 0], clip: ['3', 1], lora_name: 'USNR_STYLE_ILL_V1_lokr3-000024.safetensors',  strength_model: 0.6, strength_clip: 0.6 } },
    '5':  { class_type: 'CLIPSetLastLayer',        inputs: { clip: ['4', 1], stop_at_clip_layer: -2 } },
    '6':  { class_type: 'CLIPTextEncode',          inputs: { text: positiveText, clip: ['5', 0] } },
    '7':  { class_type: 'CLIPTextEncode',          inputs: { text: negativeText, clip: ['5', 0] } },
    '8':  { class_type: 'EmptyLatentImage',        inputs: { width: 832, height: 1216, batch_size: 1 } },
    '9':  { class_type: 'KSampler',                inputs: { seed, steps: 38, cfg: 4.0, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1.0,  model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['8', 0] } },
    '10': { class_type: 'VAEDecode',               inputs: { samples: ['9', 0],  vae: ['1', 2] } },
    '11': { class_type: 'UpscaleModelLoader',      inputs: { model_name: 'remacri_original.safetensors' } },
    '12': { class_type: 'ImageUpscaleWithModel',   inputs: { upscale_model: ['11', 0], image: ['10', 0] } },
    '13': { class_type: 'ImageScale',              inputs: { upscale_method: 'lanczos', width: 1248, height: 1824, crop: 'disabled', image: ['12', 0] } },
    '14': { class_type: 'VAEEncode',               inputs: { pixels: ['13', 0], vae: ['1', 2] } },
    '15': { class_type: 'KSampler',                inputs: { seed, steps: 20, cfg: 4.0, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 0.55, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['14', 0] } },
    '16': { class_type: 'VAEDecode',               inputs: { samples: ['15', 0], vae: ['1', 2] } },
    '17': { class_type: 'SaveImage',               inputs: { filename_prefix: 'torre_monster', images: ['16', 0] } },
  };
}

// --- Prompt builder ----------------------------------------------------------
function buildMonsterPrompt({ desc, pose, extra }) {
  const extras   = extra ? `, ${extra}` : '';
  const positive = [
    QUALITY_PREFIX,
    'BREAK',
    `dark fantasy dungeon creature, ${desc}, ${pose}${extras}`,
    'dramatic cinematic lighting, detailed illustration, full body, solo',
    'usnr, 748cmstyle',
  ].join(', ');
  const negative = [
    QUALITY_NEG,
    'multiple subjects, crowd, human face, anime girl, female character, cute, chibi',
  ].join(', ');
  return { positive, negative };
}

// --- Generation --------------------------------------------------------------
async function generateMonster(enemyKey, enemy) {
  const { positive, negative } = buildMonsterPrompt(enemy);
  const seed     = Math.floor(Math.random() * 2 ** 32);
  const workflow = buildMonsterWorkflow(positive, negative, seed);
  const promptId = await queueWorkflow(workflow);

  const { entry, elapsed } = await pollUntilDone(promptId, enemyKey);
  process.stdout.write('\n');

  const imgs = entry.outputs?.['17']?.images;
  if (!imgs?.length) throw new Error('No output in history');
  return { ...imgs[0], elapsed, seed };
}

async function processEnemy(enemyKey, enemy, progress, index) {
  const enemyDir = path.join(IMAGES_DIR, enemyKey);
  fs.mkdirSync(enemyDir, { recursive: true });

  if (progress[enemyKey]) {
    log(`  [SKIP] ${enemyKey}  (already done)`);
    if (!index[enemyKey]) index[enemyKey] = progress[enemyKey].path;
    return;
  }

  log(`  Generating illustration for ${enemyKey}...`);
  const result = await generateMonster(enemyKey, enemy);

  const buf = await fetchOutputBlob(result.filename, result.subfolder);
  if (!isValidPng(buf)) throw new Error(`PNG invalid for ${enemyKey}`);

  const outPath = path.join(enemyDir, 'illustration.png');
  fs.writeFileSync(outPath, buf);

  const relPath      = `assets/images/monsters/${enemyKey}/illustration.png`;
  progress[enemyKey] = { path: relPath, seed: result.seed };
  index[enemyKey]    = relPath;

  saveProgress(progress);
  saveIndex(index);

  log(`  Saved ${path.relative(process.cwd(), outPath)} (${(buf.length / 1024).toFixed(0)} KB, ${(result.elapsed / 1000).toFixed(1)}s)`);
}

// --- Entry point -------------------------------------------------------------
async function main() {
  const args        = process.argv.slice(2);
  const resumeMode  = args.includes('--resume');
  const singleEnemy = args.includes('--enemy') ? args[args.indexOf('--enemy') + 1] : null;

  console.log('\n=== TORRE - Monster Illustration Generator ===');
  console.log(`  Model       : PerfectDeliberate v8 + 3 LoRAs (Illustrious)`);
  console.log(`  Resolution  : 832x1216 base -> 1248x1824 hires (Remacri)`);
  console.log(`  Resume mode : ${resumeMode ? 'ON' : 'OFF'}`);
  console.log(`  Target      : ${singleEnemy ?? 'all monsters'}`);
  console.log(`  Output dir  : ${path.relative(process.cwd(), IMAGES_DIR)}`);
  console.log('');

  process.stdout.write('Connecting to ComfyUI... ');
  const ping = await fetch(`${COMFY_URL}/system_stats`).catch(e => {
    throw new Error(`Cannot reach ComfyUI: ${e.message}`);
  });
  if (!ping.ok) throw new Error(`ComfyUI returned HTTP ${ping.status}`);
  console.log('OK\n');

  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const progress = resumeMode ? loadProgress() : {};
  const index    = resumeMode && fs.existsSync(INDEX_FILE)
    ? JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))
    : {};

  if (singleEnemy && !ENEMIES[singleEnemy]) {
    throw new Error(`Unknown enemy "${singleEnemy}". Valid: ${Object.keys(ENEMIES).join(', ')}`);
  }

  const targets   = singleEnemy ? { [singleEnemy]: ENEMIES[singleEnemy] } : ENEMIES;
  const enemyList = Object.entries(targets);
  const t0        = Date.now();

  log(`Starting: ${enemyList.length} monsters, 1 illustration each`);
  log('Ctrl+C to pause - re-run with --resume to continue\n');

  let done = 0;
  for (const [key, enemy] of enemyList) {
    log(`\n[${key.toUpperCase()}] (${++done}/${enemyList.length})`);
    try {
      await processEnemy(key, enemy, progress, index);
    } catch (err) {
      log(`  ERROR: ${err.message}`);
      saveProgress(progress);
      saveIndex(index);
    }
  }

  const total = (Date.now() - t0) / 1000;
  console.log(`\n=== Done in ${(total / 60).toFixed(1)} min ===`);
  console.log(`  Index: ${path.relative(process.cwd(), INDEX_FILE)}`);
}

main().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
