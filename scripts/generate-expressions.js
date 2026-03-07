#!/usr/bin/env node
/**
 * scripts/generate-expressions.js
 *
 * Batch expression generator for D&D character portraits.
 * Uses FaceDetailer (ComfyUI Impact Pack) to re-inpaint the face
 * with a different emotional expression while preserving identity.
 *
 * Output:
 *   assets/images/characters/<character>/expression_<name>.png
 *   assets/images/characters/<character>/expressions.json   <- manifest
 *
 * Run:
 *   node scripts/generate-expressions.js --character <name> --input <image_name>
 *   node scripts/generate-expressions.js --character lyra --input portrait_lyra.png
 *   node scripts/generate-expressions.js --character lyra --input portrait_lyra.png --expression angry
 *   node scripts/generate-expressions.js --character lyra --input portrait_lyra.png --list
 *
 * Flags:
 *   --character  <name>   Character folder name (required)
 *   --input      <file>   Image filename in ComfyUI/input/ (required)
 *   --expression <name>   Generate only this expression (optional)
 *   --denoise    <float>  Override denoise value 0.35–0.80 (default: 0.7)
 *   --resume              Skip already completed expressions
 *   --list                Print available expressions and exit
 *
 * Requirements: Node 18+
 * ComfyUI must be reachable at COMFY_URL with:
 *   checkpoints/  perfectdeliberate_v8.safetensors
 *   loras/        748cmSDXL.safetensors
 *                 thiccwithaq-artist-richy-v1_ixl.safetensors
 *                 USNR_STYLE_ILL_V1_lokr3-000024.safetensors
 *   ultralytics/bbox/  face_yolov8n.pt
 */
'use strict';

const fs   = require('fs');
const path = require('path');

// --- Config ------------------------------------------------------------------
const COMFY_URL     = 'http://192.168.0.20:8089';
const POLL_INTERVAL = 2_000;
const POLL_MAX      = 120;   // ~4 min max per expression

const CHARS_DIR = path.join(__dirname, '..', 'assets', 'images', 'characters');

// --- Node version guard ------------------------------------------------------
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) { console.error(`Node 18+ required (you have ${process.version})`); process.exit(1); }

// --- Quality tags ------------------------------------------------------------
const QUALITY_PREFIX = 'score_9, score_8_up, score_8, masterpiece, best quality, expressive eyes, perfect face, 748cmstyle, usnr';
const QUALITY_NEG    = 'score_6, score_5, score_4, civit_nsfw, ugly face, low res, blurry face, different person, different character, neutral expression, closed eyes, disfigured, deformed, extra teeth, wrong anatomy, bad proportions';

// --- Expression definitions --------------------------------------------------
// Each expression: positive tags that go AFTER the BREAK (face-only region).
// Keep them face/expression-focused — FaceDetailer only repaints the face.
const EXPRESSIONS = {
  angry: {
    label:    'Angry',
    positive: 'clenched teeth, furrowed brows, wide bloodshot intense eyes, fierce battle expression, intense anger, veins on forehead, battle fury face, dramatic chiaroscuro lighting, deep shadows on face',
  },
  scared: {
    label:    'Scared',
    positive: 'wide terrified eyes, raised brows, cold sweat drops, pale trembling lips, horror expression, fear, mouth slightly open, desperate gaze',
  },
  determined: {
    label:    'Determined',
    positive: 'sharp focused eyes, calm intensity, set jaw, unwavering fierce gaze, confident expression, battle-ready focus, strong composed face',
  },
  smug: {
    label:    'Smug',
    positive: 'half-lidded eyes, twisted smirk, one corner of mouth raised, condescending gaze, sinister confidence, arrogant expression',
  },
  sad: {
    label:    'Sad',
    positive: 'tears streaming down face, downcast eyes, trembling chin, grief expression, sorrowful gaze, eyes glistening with tears, broken expression',
  },
  surprised: {
    label:    'Surprised',
    positive: 'wide open eyes, raised brows high, open mouth shock, jaw dropped, stunned expression, disbelief on face',
  },
  neutral: {
    label:    'Neutral',
    positive: 'calm composed face, relaxed expression, neutral gaze, stoic face, serene composure',
  },
  menacing: {
    label:    'Menacing',
    positive: 'cold predatory eyes, thin cruel smile, sinister threatening expression, dark malice in eyes, dangerous calculating gaze',
  },
  pain: {
    label:    'In Pain',
    positive: 'eyes screwed shut in pain, grimacing mouth open, teeth clenched in agony, face contorted in pain, suffering expression',
  },
};

// --- CLI args ----------------------------------------------------------------
const args = process.argv.slice(2);
const getArg = (flag, def = null) => {
  const i = args.indexOf(flag);
  return (i !== -1 && args[i + 1]) ? args[i + 1] : def;
};
const hasFlag = flag => args.includes(flag);

if (hasFlag('--list')) {
  console.log('\nAvailable expressions:');
  for (const [key, { label, positive }] of Object.entries(EXPRESSIONS)) {
    console.log(`  ${key.padEnd(12)} — ${label}`);
    console.log(`               tags: ${positive.slice(0, 70)}...`);
  }
  process.exit(0);
}

const CHARACTER  = getArg('--character');
const INPUT_IMG  = getArg('--input');
const ONLY_EXPR  = getArg('--expression');
const DENOISE    = parseFloat(getArg('--denoise', '0.7'));
const RESUME     = hasFlag('--resume');

if (!CHARACTER || !INPUT_IMG) {
  console.error('Usage: node scripts/generate-expressions.js --character <name> --input <image.png>');
  console.error('       node scripts/generate-expressions.js --list');
  process.exit(1);
}

if (isNaN(DENOISE) || DENOISE < 0.1 || DENOISE > 1.0) {
  console.error('--denoise must be a float between 0.1 and 1.0');
  process.exit(1);
}

// --- Output dir --------------------------------------------------------------
const OUT_DIR       = path.join(CHARS_DIR, CHARACTER);
const MANIFEST_FILE = path.join(OUT_DIR, 'expressions.json');

// --- Helpers -----------------------------------------------------------------
const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(msg) {
  const ts = new Date().toLocaleTimeString('es', { hour12: false });
  console.log(`[${ts}] ${msg}`);
}

function loadManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8')); }
  catch { return {}; }
}

function saveManifest(m) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(m, null, 2));
}

// --- ComfyUI API -------------------------------------------------------------
async function queueWorkflow(workflow) {
  const r = await fetch(`${COMFY_URL}/prompt`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ prompt: workflow }),
  });
  if (!r.ok) throw new Error(`Queue failed ${r.status}: ${await r.text()}`);
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
    process.stdout.write(`\r     ${label} — ${s}s elapsed...   `);
  }
  throw new Error(`Timeout after ${(POLL_MAX * POLL_INTERVAL) / 1000}s`);
}

async function fetchOutputBlob(filename, subfolder = '') {
  const p = new URLSearchParams({ filename, subfolder, type: 'output' });
  const r = await fetch(`${COMFY_URL}/view?${p}`);
  if (!r.ok) throw new Error(`Image fetch ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

function isValidPng(buf) {
  const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  return buf.length > 5_000 && PNG_MAGIC.every((b, i) => buf[i] === b);
}

// --- Workflow builder --------------------------------------------------------
// Uses the API-format workflow exported from ComfyUI with FaceDetailer.
// Base image must already be uploaded to ComfyUI/input/
function buildExpressionWorkflow({ inputImage, positiveExprTags, denoise, seed, filenamePrefix }) {
  const positiveText = `${QUALITY_PREFIX}, BREAK, ${positiveExprTags}`;

  return {
    '1': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: 'perfectdeliberate_v8.safetensors' },
    },
    '2': {
      class_type: 'LoraLoader',
      inputs: { lora_name: '748cmSDXL.safetensors', strength_model: 0.5, strength_clip: 0.5, model: ['1', 0], clip: ['1', 1] },
    },
    '3': {
      class_type: 'LoraLoader',
      inputs: { lora_name: 'thiccwithaq-artist-richy-v1_ixl.safetensors', strength_model: 0.7, strength_clip: 0.7, model: ['2', 0], clip: ['2', 1] },
    },
    '4': {
      class_type: 'LoraLoader',
      inputs: { lora_name: 'USNR_STYLE_ILL_V1_lokr3-000024.safetensors', strength_model: 0.6, strength_clip: 0.6, model: ['3', 0], clip: ['3', 1] },
    },
    '5': {
      class_type: 'CLIPSetLastLayer',
      inputs: { stop_at_clip_layer: -2, clip: ['4', 1] },
    },
    '6': {
      class_type: 'CLIPTextEncode',
      inputs: { text: positiveText, clip: ['5', 0] },
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: { text: QUALITY_NEG, clip: ['5', 0] },
    },
    '8': {
      class_type: 'LoadImage',
      inputs: { image: inputImage },
    },
    '9': {
      class_type: 'UltralyticsDetectorProvider',
      inputs: { model_name: 'bbox/face_yolov8n.pt' },
    },
    '10': {
      class_type: 'FaceDetailer',
      inputs: {
        guide_size:                768,
        guide_size_for:            true,
        max_size:                  1024,
        seed,
        steps:                     20,
        cfg:                       6,
        sampler_name:              'dpmpp_2m',
        scheduler:                 'karras',
        denoise,
        feather:                   5,
        noise_mask:                true,
        force_inpaint:             true,
        bbox_threshold:            0.5,
        bbox_dilation:             10,
        bbox_crop_factor:          3,
        sam_detection_hint:        'center-1',
        sam_dilation:              0,
        sam_threshold:             0.93,
        sam_bbox_expansion:        0,
        sam_mask_hint_threshold:   0.7,
        sam_mask_hint_use_negative:'False',
        drop_size:                 10,
        wildcard:                  '',
        cycle:                     1,
        inpaint_model:             false,
        noise_mask_feather:        20,
        tiled_encode:              false,
        tiled_decode:              false,
        image:          ['8',  0],
        model:          ['4',  0],
        clip:           ['5',  0],
        vae:            ['1',  2],
        positive:       ['6',  0],
        negative:       ['7',  0],
        bbox_detector:  ['9',  0],
      },
    },
    '11': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: filenamePrefix, images: ['10', 0] },
    },
  };
}

// --- Main --------------------------------------------------------------------
async function main() {
  const expressionEntries = ONLY_EXPR
    ? Object.entries(EXPRESSIONS).filter(([k]) => k === ONLY_EXPR)
    : Object.entries(EXPRESSIONS);

  if (ONLY_EXPR && expressionEntries.length === 0) {
    console.error(`Unknown expression "${ONLY_EXPR}". Run --list to see available options.`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = loadManifest();

  log(`Character : ${CHARACTER}`);
  log(`Input     : ${INPUT_IMG}`);
  log(`Denoise   : ${DENOISE}`);
  log(`Expressions: ${expressionEntries.map(([k]) => k).join(', ')}`);
  console.log('');

  for (const [exprKey, expr] of expressionEntries) {
    const outFile = path.join(OUT_DIR, `expression_${exprKey}.png`);

    if (RESUME && fs.existsSync(outFile)) {
      log(`⏭  ${expr.label} — already exists, skipping`);
      continue;
    }

    const filenamePrefix = `${CHARACTER}_${exprKey}`;
    const seed = Math.floor(Math.random() * 2 ** 32);

    log(`▶  ${expr.label} (seed ${seed})`);

    const workflow = buildExpressionWorkflow({
      inputImage:      INPUT_IMG,
      positiveExprTags: expr.positive,
      denoise:         DENOISE,
      seed,
      filenamePrefix,
    });

    let promptId;
    try {
      promptId = await queueWorkflow(workflow);
    } catch (err) {
      log(`✗  ${expr.label} — queue error: ${err.message}`);
      continue;
    }

    let result;
    try {
      result = await pollUntilDone(promptId, expr.label);
      process.stdout.write('\n');
    } catch (err) {
      process.stdout.write('\n');
      log(`✗  ${expr.label} — ${err.message}`);
      continue;
    }

    // Find output image in history
    const outputs = result.entry?.outputs ?? {};
    let imageInfo = null;
    for (const nodeOut of Object.values(outputs)) {
      const imgs = nodeOut?.images;
      if (Array.isArray(imgs) && imgs.length > 0) { imageInfo = imgs[0]; break; }
    }

    if (!imageInfo) {
      log(`✗  ${expr.label} — no output image in history`);
      continue;
    }

    let imgBuf;
    try {
      imgBuf = await fetchOutputBlob(imageInfo.filename, imageInfo.subfolder);
    } catch (err) {
      log(`✗  ${expr.label} — download error: ${err.message}`);
      continue;
    }

    if (!isValidPng(imgBuf)) {
      log(`✗  ${expr.label} — downloaded file is not a valid PNG`);
      continue;
    }

    fs.writeFileSync(outFile, imgBuf);

    manifest[exprKey] = {
      label:    expr.label,
      file:     `expression_${exprKey}.png`,
      seed,
      denoise:  DENOISE,
      generated: new Date().toISOString(),
    };
    saveManifest(manifest);

    const secs = (result.elapsed / 1000).toFixed(1);
    log(`✓  ${expr.label} — saved (${secs}s)`);
  }

  console.log('');
  log(`Done. Manifest: ${path.relative(process.cwd(), MANIFEST_FILE)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
