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
 *   --skin       <tone>   Skin anchor for identity (default: 'fair skin')
 *                         e.g. 'pale skin' (tiefling), 'olive skin' (half-orc), 'dark grey skin' (drow)
 *   --denoise    <float>  Override FaceDetailer denoise 0.40–0.50 (default: 0.45)
 *   --resume              Skip already completed expressions
 *   --list                Print available expressions and exit
 *
 * Requirements: Node 18+
 * ComfyUI must be reachable at COMFY_URL with:
 *   checkpoints/  perfectdeliberate_v8.safetensors
 *   loras/        748cmSDXL.safetensors
 *                 thiccwithaq-artist-richy-v1_ixl.safetensors
 *                 USNR_STYLE_ILL_V1_lokr3-000024.safetensors
 *                 Detailer_NoobAI_Incrs_v1.safetensors
 *   ultralytics/bbox/  face_yolov8n.pt
 */
'use strict';

const fs   = require('fs');
const path = require('path');

// --- Config ------------------------------------------------------------------
const COMFY_URL     = 'http://192.168.0.17:8089';
const POLL_INTERVAL = 2_000;
const POLL_MAX      = 120;   // ~4 min max per expression

const CHARS_DIR = path.join(__dirname, '..', 'assets', 'images', 'characters');

// --- Node version guard ------------------------------------------------------
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) { console.error(`Node 18+ required (you have ${process.version})`); process.exit(1); }

// --- Quality tags ------------------------------------------------------------
const QUALITY_PREFIX = 'score_9, score_8_up, score_8, masterpiece, best quality, expressive eyes, perfect face, 748cmstyle, usnr';
const QUALITY_NEG    = 'score_6, score_5, score_4, civit_nsfw, ugly face, low res, blurry face, different person, different character, disfigured, deformed, bad anatomy, face markings, forehead mark, skin tattoo';

// --- Expression definitions (v2 — 9 expressions) ----------------------------
// Positive tags go AFTER the BREAK — FaceDetailer only repaints the face.
// Skin anchor ([SKIN_TONE], human woman) is injected by the runner below.
const EXPRESSIONS = {
  neutral: {
    label:    'Neutral',
    positive: 'calm neutral expression, relaxed face, soft eyes, composed, serene, (neutral expression:1.4), (calm face:1.3)',
    negative: `${QUALITY_NEG}, angry, happy, sad, smiling, crying`,
  },
  angry: {
    label:    'Angry',
    positive: 'clenched teeth, furrowed brows, narrowed bloodshot eyes, battle fury, rage, intense glare, (angry expression:1.4), (furrowed brows:1.35), (intense glare:1.3)',
    negative: `${QUALITY_NEG}, neutral expression, closed eyes, happy, sad, extra teeth, bad teeth, deformed teeth`,
  },
  sad: {
    label:    'Sad',
    positive: 'downcast eyes, trembling lips, sorrowful expression, tears welling, grief, (sad expression:1.4), (downcast eyes:1.35), (trembling lips:1.3)',
    negative: `${QUALITY_NEG}, neutral expression, angry, happy, smiling`,
  },
  surprised: {
    label:    'Surprised',
    positive: 'wide open eyes, raised eyebrows, open mouth, shock, astonishment, (surprised expression:1.4), (wide eyes:1.35), (open mouth:1.3)',
    negative: `${QUALITY_NEG}, neutral expression, angry, sad, calm, extra teeth, deformed teeth`,
  },
  determined: {
    label:    'Determined',
    positive: 'set jaw, focused gaze, firm lips, resolve, unwavering stare, steely eyes, (determined expression:1.4), (focused gaze:1.35), (set jaw:1.3)',
    negative: `${QUALITY_NEG}, neutral expression, laughing, crying`,
  },
  fearful: {
    label:    'Fearful',
    positive: 'wide fearful eyes, pale trembling, pupils dilated, terror, dread, shaking, (fearful expression:1.4), (wide fearful eyes:1.35), (trembling:1.3)',
    negative: `${QUALITY_NEG}, neutral expression, angry, happy, calm`,
  },
  disgusted: {
    label:    'Disgusted',
    positive: 'wrinkled nose, curled upper lip, narrowed eyes, contempt, revulsion, (disgusted expression:1.4), (wrinkled nose:1.35), (curled lip:1.3)',
    negative: `${QUALITY_NEG}, neutral expression, happy, neutral`,
  },
  seductive: {
    label:    'Seductive',
    positive: 'half-lidded eyes, slow smile, parted lips, smoldering gaze, alluring, magnetic presence, (seductive expression:1.4), (half-lidded eyes:1.35), (parted lips:1.3)',
    negative: `${QUALITY_NEG}, neutral expression, angry, scared`,
  },
  happy: {
    label:    'Happy',
    positive: 'bright smile, teeth showing, eyes curved with joy, warm expression, genuine laughter, (happy expression:1.4), (bright smile:1.35), (joyful eyes:1.3)',
    negative: `${QUALITY_NEG}, angry, sad, neutral expression, closed eyes`,
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
const SKIN_TONE  = getArg('--skin', 'fair skin');   // e.g. 'pale skin', 'olive skin'
const DENOISE    = parseFloat(getArg('--denoise', '0.45'));
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

// --- Workflow builder (v2 — FaceDetailer + Detailer LoRA) -------------------
// Node layout mirrors 03-expression-*.json canonical workflows.
// cfg=4.0 is CRITICAL — cfg>4.5 changes skin tone dramatically.
function buildExpressionWorkflow({ inputImage, positiveText, negativeText, denoise, seed, filenamePrefix }) {
  return {
    '1':  { class_type: 'CheckpointLoaderSimple',      inputs: { ckpt_name: 'perfectdeliberate_v8.safetensors' } },
    '2':  { class_type: 'LoraLoader',                  inputs: { model: ['1', 0], clip: ['1', 1], lora_name: '748cmSDXL.safetensors',                        strength_model: 0.5, strength_clip: 0.5 } },
    '3':  { class_type: 'LoraLoader',                  inputs: { model: ['2', 0], clip: ['2', 1], lora_name: 'thiccwithaq-artist-richy-v1_ixl.safetensors', strength_model: 0.7, strength_clip: 0.7 } },
    '4':  { class_type: 'LoraLoader',                  inputs: { model: ['3', 0], clip: ['3', 1], lora_name: 'USNR_STYLE_ILL_V1_lokr3-000024.safetensors',  strength_model: 0.6, strength_clip: 0.6 } },
    '5':  { class_type: 'LoraLoader',                  inputs: { model: ['4', 0], clip: ['4', 1], lora_name: 'Detailer_NoobAI_Incrs_v1.safetensors',         strength_model: 0.5, strength_clip: 0.5 } },
    '6':  { class_type: 'CLIPSetLastLayer',            inputs: { stop_at_clip_layer: -2, clip: ['5', 1] } },
    '7':  { class_type: 'CLIPTextEncode',              inputs: { text: positiveText,  clip: ['6', 0] } },
    '8':  { class_type: 'LoadImage',                   inputs: { image: inputImage } },
    '9':  { class_type: 'UltralyticsDetectorProvider', inputs: { model_name: 'bbox/face_yolov8n.pt' } },
    '10': { class_type: 'CLIPTextEncode',              inputs: { text: negativeText, clip: ['6', 0] } },
    '11': { class_type: 'FaceDetailer',                inputs: {
      guide_size: 768, guide_size_for: true, max_size: 1024,
      seed, steps: 20, cfg: 4.0, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise,
      feather: 5, noise_mask: true, force_inpaint: true,
      bbox_threshold: 0.5, bbox_dilation: 10, bbox_crop_factor: 3,
      sam_detection_hint: 'center-1', sam_dilation: 0, sam_threshold: 0.93,
      sam_bbox_expansion: 0, sam_mask_hint_threshold: 0.7, sam_mask_hint_use_negative: 'False',
      drop_size: 10, wildcard: '', cycle: 1, inpaint_model: false, noise_mask_feather: 20,
      tiled_encode: false, tiled_decode: false,
      image: ['8', 0], model: ['5', 0], clip: ['6', 0], vae: ['1', 2],
      positive: ['7', 0], negative: ['10', 0], bbox_detector: ['9', 0],
    } },
    '12': { class_type: 'SaveImage', inputs: { filename_prefix: filenamePrefix, images: ['11', 0] } },
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
  log(`Skin tone : ${SKIN_TONE}`);
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

    // Inject skin anchor into positive: [quality + skin + race_anchor] BREAK [expr_tags] [style]
    const positiveText = `${QUALITY_PREFIX}, ${SKIN_TONE}, human woman, BREAK, ${expr.positive}`;
    const negativeText = expr.negative ?? QUALITY_NEG;

    const workflow = buildExpressionWorkflow({
      inputImage:  INPUT_IMG,
      positiveText,
      negativeText,
      denoise:     DENOISE,
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
