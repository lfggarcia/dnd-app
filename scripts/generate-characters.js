#!/usr/bin/env node
/**
 * scripts/generate-characters.js
 *
 * Character portrait batch generator -- Illustrious / PerfectDeliberate v8.
 * Generates one high-quality anime-style portrait per character archetype.
 * No animation frames -- Skia handles all animated effects at runtime.
 *
 * Output:
 *   assets/images/characters/<key>/portrait.png
 *   assets/images/characters/index.json          <- used by the app
 *   assets/images/characters/progress.json       <- resume state (auto-managed)
 *
 * Run:
 *   node scripts/generate-characters.js
 *   node scripts/generate-characters.js --resume              (skip completed)
 *   node scripts/generate-characters.js --character elf_ranger (single char)
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
const COMFY_URL     = 'http://192.168.0.17:8089';
const POLL_INTERVAL = 2_000;
const POLL_MAX      = 180;   // ~6 min max per image (hires pass takes longer)

const IMAGES_DIR    = path.join(__dirname, '..', 'assets', 'images', 'characters');
const PROGRESS_FILE = path.join(IMAGES_DIR, 'progress.json');
const INDEX_FILE    = path.join(IMAGES_DIR, 'index.json');

// --- Node version guard ------------------------------------------------------
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) { console.error(`Node 18+ required (you have ${process.version})`); process.exit(1); }

// --- Quality tags (Illustrious ecosystem) ------------------------------------
const QUALITY_PREFIX = 'score_9, score_8_up, score_8, masterpiece, best quality, newest, absurdres';
const QUALITY_NEG    = 'score_6, score_5, score_4, low quality, worst quality, blurry, deformed, bad anatomy, extra limbs, watermark, text, logo, signature, photorealistic';

// --- Character archetypes (DnD 5e classes) -----------------------------------
const CHARACTERS = {
  // Warriors
  human_fighter: {
    gender: 'female',
    desc:   'human female fighter, chain mail armor, longsword and kite shield, short brown hair, strong determined jaw, athletic build',
    pose:   'cowboy shot, confident battle stance, arms at ready',
    bg:     'stone dungeon corridor, dramatic torchlight',
  },
  elf_ranger: {
    gender: 'female',
    desc:   'female elf ranger, green leather armor, longbow slung over shoulder, pointed ears, long silver hair, hood',
    pose:   'cowboy shot, alert watchful stance, hand on quiver',
    bg:     'misty ancient forest ruins',
  },
  dwarf_paladin: {
    gender: 'female',
    desc:   'female dwarf paladin, gleaming full plate armor, warhammer, braided red hair, holy symbol on breastplate, stocky powerful build',
    pose:   'cowboy shot, resolute protective stance, weapon raised',
    bg:     'golden divine light, temple sanctuary',
  },
  half_orc_barbarian: {
    gender: 'female',
    desc:   'half-orc female barbarian, midriff-baring fur-trimmed war outfit, greatsword, green-grey skin, tribal war paint, small tusks, muscular',
    pose:   'cowboy shot, battle-rage stance, intense predatory eyes',
    bg:     'stormy ruins battlefield',
  },
  // Magic Users
  human_mage: {
    gender: 'female',
    desc:   'human female mage, midnight blue arcane robes, glowing crystal staff, long black hair, arcane tome at hip',
    pose:   'cowboy shot, casting decisive spell, arcane energy crackling from hand',
    bg:     'arcane tower study, floating books and scrolls',
  },
  elf_sorcerer: {
    gender: 'female',
    desc:   'high elf female sorcerer, elegant silver robes with arcane embroidery, sorcerous tattoos, long white hair, ethereal beauty',
    pose:   'cowboy shot, dramatic spell-casting pose, magical particles swirling',
    bg:     'mystical ley line nexus, aurora light',
  },
  tiefling_warlock: {
    gender: 'female',
    desc:   'tiefling female warlock, small curved ram horns, long thin tail, dark leather battle pact armor, pale ivory skin, violet glowing eyes',
    pose:   'cowboy shot, powerful dangerous stance, eldritch green fire in palm',
    bg:     'shadowy void realm, eldritch summoning circle',
  },
  gnome_artificer: {
    gender: 'female',
    desc:   'gnome female artificer, brass goggles pushed up on forehead, mechanical clockwork arm prosthetic, leather tool vest covered in gadgets, short stature',
    pose:   'cowboy shot, aiming wrist-mounted gadget forward, mischievous grin',
    bg:     'steampunk workshop, gears cogs and steam',
  },
  // Specialists
  halfling_rogue: {
    gender: 'female',
    desc:   'halfling female rogue, dark supple leather armor, dual daggers, hood partially up, curly brown hair, small nimble frame',
    pose:   'cowboy shot, crouched coiled sneaking stance, one dagger drawn',
    bg:     'shadowy city alleyway, moonlit cobblestones',
  },
  human_cleric: {
    gender: 'female',
    desc:   'human female cleric, white and gold ceremonial robes, ornate holy symbol staff, kind determined face, long blond hair',
    pose:   'cowboy shot, healing prayer gesture, soft divine light emanating from hands',
    bg:     'cathedral interior, stained glass window light',
  },
  half_elf_bard: {
    gender: 'female',
    desc:   'half-elf female bard, colorful performer costume with ruffles, lute, charismatic wide smile, short pointed ears, auburn hair',
    pose:   'cowboy shot, mid-performance pose, playing lute with flair',
    bg:     'warm tavern stage, lantern glow',
  },
  human_monk: {
    gender: 'female',
    desc:   'human female monk, simple white gi with dark sash, athletic lean build, hair in small topknot, ki energy visible as aura',
    pose:   'cowboy shot, focused martial arts ready stance, ki energy glowing in fists',
    bg:     'monastery rooftop at dawn, mountain mist',
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
// Identical node graph to generate-sprites.js (mirrors 01-base-sprite.json).
// For character portraits: portrait orientation 832x1216 -> 1248x1824 hires.
//
function buildCharacterWorkflow(positiveText, negativeText, seed) {
  return {
    '1':  { class_type: 'CheckpointLoaderSimple',  inputs: { ckpt_name: 'perfectdeliberate_v8.safetensors' } },
    '2':  { class_type: 'LoraLoader',              inputs: { model: ['1', 0], clip: ['1', 1], lora_name: '748cmSDXL.safetensors',                        strength_model: 0.5,  strength_clip: 0.5  } },
    '3':  { class_type: 'LoraLoader',              inputs: { model: ['2', 0], clip: ['2', 1], lora_name: 'thiccwithaq-artist-richy-v1_ixl.safetensors', strength_model: 0.55, strength_clip: 0.55 } },
    '4':  { class_type: 'LoraLoader',              inputs: { model: ['3', 0], clip: ['3', 1], lora_name: 'USNR_STYLE_ILL_V1_lokr3-000024.safetensors',  strength_model: 0.6,  strength_clip: 0.6  } },
    '5':  { class_type: 'LoraLoader',              inputs: { model: ['4', 0], clip: ['4', 1], lora_name: 'Detailer_NoobAI_Incrs_v1.safetensors',         strength_model: 0.7,  strength_clip: 0.7  } },
    '6':  { class_type: 'CLIPSetLastLayer',        inputs: { clip: ['5', 1], stop_at_clip_layer: -2 } },
    '7':  { class_type: 'CLIPTextEncode',          inputs: { text: positiveText, clip: ['6', 0] } },
    '8':  { class_type: 'CLIPTextEncode',          inputs: { text: negativeText, clip: ['6', 0] } },
    '9':  { class_type: 'EmptyLatentImage',        inputs: { width: 832, height: 1216, batch_size: 1 } },
    '10': { class_type: 'KSampler',                inputs: { seed, steps: 38, cfg: 4.0, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1.0,  model: ['5', 0], positive: ['7', 0], negative: ['8', 0], latent_image: ['9', 0] } },
    '11': { class_type: 'VAEDecodeTiled',          inputs: { samples: ['10', 0], vae: ['1', 2], tile_size: 512, overlap: 32, temporal_size: 64, temporal_overlap: 8 } },
    '12': { class_type: 'UpscaleModelLoader',      inputs: { model_name: 'remacri_original.safetensors' } },
    '13': { class_type: 'ImageUpscaleWithModel',   inputs: { upscale_model: ['12', 0], image: ['11', 0] } },
    '14': { class_type: 'ImageScale',              inputs: { upscale_method: 'lanczos', width: 1248, height: 1824, crop: 'disabled', image: ['13', 0] } },
    '15': { class_type: 'VAEEncodeTiled',          inputs: { pixels: ['14', 0], vae: ['1', 2], tile_size: 512, overlap: 32, temporal_size: 64, temporal_overlap: 8 } },
    '16': { class_type: 'KSampler',                inputs: { seed, steps: 20, cfg: 4.0, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 0.55, model: ['5', 0], positive: ['7', 0], negative: ['8', 0], latent_image: ['15', 0] } },
    '17': { class_type: 'VAEDecodeTiled',          inputs: { samples: ['16', 0], vae: ['1', 2], tile_size: 512, overlap: 32, temporal_size: 64, temporal_overlap: 8 } },
    '18': { class_type: 'SaveImage',               inputs: { filename_prefix: 'torre_character', images: ['17', 0] } },
  };
}

// --- Prompt builder ----------------------------------------------------------
function buildCharacterPrompt({ desc, pose, bg }) {
  const positive = [
    QUALITY_PREFIX,
    'BREAK',
    `1girl, solo, ${desc}, ${pose}`,
    `${bg}, dramatic lighting, highly detailed, expressive eyes, perfect face`,
    'usnr, 748cmstyle',
  ].join(', ');
  const negative = [
    QUALITY_NEG,
    'multiple people, crowd, deformed hands, bad hands, nsfw',
  ].join(', ');
  return { positive, negative };
}

// --- Generation --------------------------------------------------------------
async function generateCharacter(charKey, char) {
  const { positive, negative } = buildCharacterPrompt(char);
  const seed     = Math.floor(Math.random() * 2 ** 32);
  const workflow = buildCharacterWorkflow(positive, negative, seed);
  const promptId = await queueWorkflow(workflow);

  const { entry, elapsed } = await pollUntilDone(promptId, charKey);
  process.stdout.write('\n');

  const imgs = entry.outputs?.['18']?.images;
  if (!imgs?.length) throw new Error('No output in history');
  return { ...imgs[0], elapsed, seed };
}

async function processCharacter(charKey, char, progress, index) {
  const charDir = path.join(IMAGES_DIR, charKey);
  fs.mkdirSync(charDir, { recursive: true });

  if (progress[charKey]) {
    log(`  [SKIP] ${charKey}  (already done)`);
    if (!index[charKey]) index[charKey] = progress[charKey].path;
    return;
  }

  log(`  Generating portrait for ${charKey}...`);
  const result = await generateCharacter(charKey, char);

  const buf = await fetchOutputBlob(result.filename, result.subfolder);
  if (!isValidPng(buf)) throw new Error(`PNG invalid for ${charKey}`);

  const outPath = path.join(charDir, 'portrait.png');
  fs.writeFileSync(outPath, buf);

  const relPath     = `assets/images/characters/${charKey}/portrait.png`;
  progress[charKey] = { path: relPath, seed: result.seed };
  index[charKey]    = relPath;

  saveProgress(progress);
  saveIndex(index);

  log(`  Saved ${path.relative(process.cwd(), outPath)} (${(buf.length / 1024).toFixed(0)} KB, ${(result.elapsed / 1000).toFixed(1)}s)`);
}

// --- Entry point -------------------------------------------------------------
async function main() {
  const args      = process.argv.slice(2);
  const resume    = args.includes('--resume');
  const singleKey = args.includes('--character') ? args[args.indexOf('--character') + 1] : null;

  console.log('\n=== TORRE - Character Portrait Generator ===');
  console.log(`  Model     : PerfectDeliberate v8 + 4 LoRAs (Illustrious + Detailer)`);
  console.log(`  Resolution: 832x1216 base -> 1248x1824 hires (Remacri)`);
  console.log(`  Resume    : ${resume ? 'ON' : 'OFF'}`);
  console.log(`  Target    : ${singleKey ?? 'all characters'}`);
  console.log(`  Output    : ${path.relative(process.cwd(), IMAGES_DIR)}`);
  console.log('');

  process.stdout.write('Connecting to ComfyUI... ');
  const ping = await fetch(`${COMFY_URL}/system_stats`).catch(e => {
    throw new Error(`Cannot reach ComfyUI: ${e.message}`);
  });
  if (!ping.ok) throw new Error(`ComfyUI returned HTTP ${ping.status}`);
  console.log('OK\n');

  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const progress = resume ? loadProgress() : {};
  const index    = resume && fs.existsSync(INDEX_FILE)
    ? JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))
    : {};

  if (singleKey && !CHARACTERS[singleKey]) {
    throw new Error(`Unknown character "${singleKey}". Valid: ${Object.keys(CHARACTERS).join(', ')}`);
  }

  const targets  = singleKey ? { [singleKey]: CHARACTERS[singleKey] } : CHARACTERS;
  const charList = Object.entries(targets);
  const t0       = Date.now();

  log(`Starting: ${charList.length} characters`);
  log('Ctrl+C to pause - re-run with --resume to continue\n');

  let done = 0;
  for (const [key, char] of charList) {
    log(`\n[${key.toUpperCase()}] (${++done}/${charList.length})`);
    try {
      await processCharacter(key, char, progress, index);
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
