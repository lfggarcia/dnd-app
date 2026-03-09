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
 *   --denoise    <float>  Override ALL expressions with this denoise value (default: use per-expression)
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
 *                 Face_Enhancer_Illustrious.safetensors
 *                 Best_Facial_Expression_Helper_XTREME_ILLU-000005.safetensors
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
const QUALITY_PREFIX = 'score_9, score_8_up, score_8, masterpiece, best quality, expressive eyes, perfect face, 748cmstyle, usnr, kaogei';
const QUALITY_NEG    = 'score_6, score_5, score_4, civit_nsfw, ugly face, low res, blurry face, different person, different character, disfigured, deformed, bad anatomy, face markings, forehead mark, skin tattoo';

// --- Expression definitions (v3 — 22 expressions, physical geometry descriptions) -----
// Prompts use physical muscle/geometry positions (not abstract emotion tokens).
// denoise is calibrated per expression; max is 0.68 (above this loses character identity).
// --denoise flag overrides all when specified.
const EXPRESSIONS = {
  neutral: {
    label:    'Neutral',
    positive: 'completely relaxed facial muscles, soft steady gaze directly forward, mouth closed naturally, no tension anywhere in face',
    negative: `${QUALITY_NEG}, angry, happy, sad, smiling, crying, extreme expression`,
    denoise:  0.55,
  },
  angry: {
    label:    'Angry',
    positive: 'inner brow corners sharply pulled down and together, deep vertical furrow between eyebrows, eyes narrowed to slits, jaw clenched, lips pressed tight, face tense',
    negative: `${QUALITY_NEG}, neutral expression, closed eyes, happy, sad, extra teeth, bad teeth, deformed teeth`,
    denoise:  0.55,
  },
  confident: {
    label:    'Confident',
    positive: 'eyes closed serenely with small satisfied smile, eyebrows relaxed and high, face glowing with inner confidence, small serene smile, supremely self-assured expression',
    negative: `${QUALITY_NEG}, anxious, fearful, angry, sad`,
    denoise:  0.55,
  },
  confused: {
    label:    'Confused',
    positive: 'head tilted hard to the left shoulder, LEFT eyebrow arched to maximum, RIGHT eyebrow pulled into frown, mouth twisted hard to one side half open with uncertainty, deep forehead furrow left side only',
    negative: `${QUALITY_NEG}, neutral expression, straight head, symmetric eyebrows, calm face`,
    denoise:  0.62,
  },
  despondent: {
    label:    'Despondent',
    positive: 'lower lip pushed WAY out forming prominent visible pout, inner corners of eyebrows raised steeply creating sad brow angle, chin slightly dimpled and trembling, cheeks soft and full with pout, glossy wet eyes from held-back tears',
    negative: `${QUALITY_NEG}, happy, smiling, neutral expression, laughing, angry`,
    denoise:  0.65,
  },
  determined: {
    label:    'Determined',
    positive: 'eyes narrowed with intense focused gaze, jaw set firmly forward, lips pressed into thin straight line, slight flare of nostrils, brow low and serious, face radiating iron will',
    negative: `${QUALITY_NEG}, neutral expression, laughing, crying, relaxed face`,
    denoise:  0.55,
  },
  disgusted: {
    label:    'Disgusted',
    positive: 'eyes wide open directed DOWN with visible disgust, nose bridge wrinkling with horizontal creases bunny lines, mouth firmly pressed closed lips tight shut, one cheek raised from nose wrinkle, eyebrows pulled together and slightly down',
    negative: `${QUALITY_NEG}, happy, neutral, eyes closed, head tilted back, pleasure, ecstasy, open mouth, smiling`,
    denoise:  0.60,
  },
  fearful: {
    label:    'Fearful',
    positive: 'eyes stretched extremely wide whites showing above and below iris, eyebrows raised and pulled together creating forehead wrinkles, mouth slightly open, lower lip trembling, face pale and frozen in terror',
    negative: `${QUALITY_NEG}, neutral expression, angry, happy, calm face, relaxed`,
    denoise:  0.55,
  },
  fierce: {
    label:    'Fierce',
    positive: 'LEFT eye stretched wide open to maximum showing whites all around, RIGHT eye narrowed to predatory slit almost closed, wide unhinged villain grin showing all upper AND lower teeth fully, eyebrows pulling in opposite directions left up right down',
    negative: `${QUALITY_NEG}, symmetric eyes, neutral expression, calm face, closed mouth, sad`,
    denoise:  0.68,
  },
  flirty: {
    label:    'Flirty',
    positive: 'one eyebrow raised high in playful arch, eyes heavy lidded and knowing, slight closed-mouth smile with one corner lifted into smirk, lips closed and defined, gentle head tilt, teasing confident expression',
    negative: `${QUALITY_NEG}, neutral expression, angry, scared, open mouth, sad`,
    denoise:  0.55,
  },
  happy: {
    label:    'Happy',
    positive: 'cheeks raised and rounded pushing lower eyelids up, eyes curved into crescents, wide open smile showing upper teeth, corners of mouth pulled far back and up, face radiant with joy',
    negative: `${QUALITY_NEG}, angry, sad, neutral expression, closed eyes, closed mouth`,
    denoise:  0.62,
  },
  hollow: {
    label:    'Hollow',
    positive: 'eyes open but staring through everything unseeing, pupils slightly dilated not focused on anything, face muscles completely slack and dropped, jaw hanging slightly open from zero muscle tone, face like nobody is home',
    negative: `${QUALITY_NEG}, focused gaze, happy, angry, intense expression, alert face`,
    denoise:  0.55,
  },
  incredulous: {
    label:    'Incredulous',
    positive: 'one eyebrow raised to absolute maximum nearly touching hairline, opposite eyebrow aggressively pulled down in scowl, eyes wide on raised side, squinted on low side, mouth corners pulled sharply down, face screaming disbelief',
    negative: `${QUALITY_NEG}, neutral expression, symmetric eyebrows, calm, happy, smiling`,
    denoise:  0.62,
  },
  rage: {
    label:    'Rage',
    positive: 'mouth stretched into WIDE unhinged grin showing every single tooth upper and lower rows fully bared, grin so wide it reaches near ears, eyes wide open with veins visible in whites from fury, eyebrows slanting sharply inward over nose in extreme frown WHILE mouth grins',
    negative: `${QUALITY_NEG}, closed mouth, neutral expression, calm face, sad expression, mild expression`,
    denoise:  0.68,
  },
  sad: {
    label:    'Sad',
    positive: 'inner brow corners pulled upward making arch, lower lip jutting out trembling, eyes glistening with unshed tears, corners of mouth pulled sharply downward, face crumpled in sorrow',
    negative: `${QUALITY_NEG}, neutral expression, angry, happy, smiling, dry eyes`,
    denoise:  0.55,
  },
  sarcastic: {
    label:    'Sarcastic',
    positive: 'one corner of mouth pulled up in sharp mocking smirk, one eyebrow raised slowly in contempt, other eyebrow flat and low, eyes heavy lidded with disdain, face radiating mockery and superiority',
    negative: `${QUALITY_NEG}, neutral expression, sad, scared, sincere expression, symmetric face`,
    denoise:  0.55,
  },
  seductive: {
    label:    'Seductive',
    positive: 'one eye slightly more closed than the other in lazy wink, tip of tongue barely touching upper lip corner, chin slightly lowered, eyes looking up at viewer through lowered lashes, slow dangerous smile corner of mouth lifted',
    negative: `${QUALITY_NEG}, neutral expression, angry, scared, disgusted, sad`,
    denoise:  0.55,
  },
  serious: {
    label:    'Serious',
    positive: 'lips closed in thin straight neutral line no curve up or down, slight brow furrow, eyes direct and cold, jaw set firmly, face composed with zero expression beyond controlled intensity',
    negative: `${QUALITY_NEG}, smiling, happy, laughing, extreme expression, relaxed brow`,
    denoise:  0.55,
  },
  shocked: {
    label:    'Shocked',
    positive: 'eyes blown to maximum perfectly round circles with whites visible fully surrounding small iris in center, eyebrows shot straight up to absolute hairline, face frozen completely blank with terror, mouth hanging all the way open jaw dropped fully chin near chest, face drained of all color',
    negative: `${QUALITY_NEG}, calm, neutral, closed mouth, eyes not wide, relaxed brow`,
    denoise:  0.68,
  },
  surprised: {
    label:    'Surprised',
    positive: 'both eyes blown wide open into huge perfect circles, eyebrows shooting up arching high above normal position, forehead creased horizontal from raised eyebrows, jaw dropped naturally mouth open relaxed, face expression of pure delighted surprise',
    negative: `${QUALITY_NEG}, neutral expression, angry, sad, calm, extra teeth, deformed teeth`,
    denoise:  0.65,
  },
  tired: {
    label:    'Tired',
    positive: 'eyelids drooping so heavy eyes are barely visible as thin slits, head tilted forward with fatigue, face muscles completely relaxed and sagging, dark undereye shadows, mouth hanging open slightly from exhaustion',
    negative: `${QUALITY_NEG}, alert expression, wide open eyes, energetic, neutral alert face`,
    denoise:  0.55,
  },
  triumph: {
    label:    'Triumph',
    positive: 'wide triumphant grin showing teeth, eyes bright and wide with victory, eyebrows raised in elation, chin slightly up, face radiating pride and power',
    negative: `${QUALITY_NEG}, sad, defeated, neutral expression, closed eyes, closed mouth`,
    denoise:  0.62,
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

const CHARACTER     = getArg('--character');
const INPUT_IMG     = getArg('--input');
const ONLY_EXPR     = getArg('--expression');
const SKIN_TONE     = getArg('--skin', 'fair skin');   // e.g. 'pale skin', 'olive skin'
const DENOISE_RAW   = getArg('--denoise');             // optional global override
const DENOISE_OVERRIDE = DENOISE_RAW !== null ? parseFloat(DENOISE_RAW) : null;
const RESUME        = hasFlag('--resume');

if (!CHARACTER || !INPUT_IMG) {
  console.error('Usage: node scripts/generate-expressions.js --character <name> --input <image.png>');
  console.error('       node scripts/generate-expressions.js --list');
  process.exit(1);
}

if (DENOISE_OVERRIDE !== null && (isNaN(DENOISE_OVERRIDE) || DENOISE_OVERRIDE < 0.1 || DENOISE_OVERRIDE > 1.0)) {
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

// --- Workflow builder (v3 — 6-LoRA stack + FaceDetailer, guide_size=512) ---
// Matches SUPER-expressions-all-api.json shared node layout.
// cfg=4.0 is CRITICAL — cfg>4.5 changes skin tone dramatically.
function buildExpressionWorkflow({ inputImage, positiveText, negativeText, denoise, seed, filenamePrefix }) {
  return {
    '1':  { class_type: 'CheckpointLoaderSimple',      inputs: { ckpt_name: 'perfectdeliberate_v8.safetensors' } },
    '2':  { class_type: 'LoraLoader',                  inputs: { model: ['1', 0],  clip: ['1', 1],  lora_name: '748cmSDXL.safetensors',                                        strength_model: 0.50, strength_clip: 0.50 } },
    '3':  { class_type: 'LoraLoader',                  inputs: { model: ['2', 0],  clip: ['2', 1],  lora_name: 'thiccwithaq-artist-richy-v1_ixl.safetensors',                 strength_model: 0.70, strength_clip: 0.70 } },
    '4':  { class_type: 'LoraLoader',                  inputs: { model: ['3', 0],  clip: ['3', 1],  lora_name: 'USNR_STYLE_ILL_V1_lokr3-000024.safetensors',                   strength_model: 0.60, strength_clip: 0.60 } },
    '5':  { class_type: 'LoraLoader',                  inputs: { model: ['4', 0],  clip: ['4', 1],  lora_name: 'Detailer_NoobAI_Incrs_v1.safetensors',                         strength_model: 0.50, strength_clip: 0.50 } },
    '6':  { class_type: 'LoraLoader',                  inputs: { model: ['5', 0],  clip: ['5', 1],  lora_name: 'Face_Enhancer_Illustrious.safetensors',                        strength_model: 0.45, strength_clip: 0.45 } },
    '7':  { class_type: 'LoraLoader',                  inputs: { model: ['6', 0],  clip: ['6', 1],  lora_name: 'Best_Facial_Expression_Helper_XTREME_ILLU-000005.safetensors', strength_model: 0.35, strength_clip: 0.35 } },
    '8':  { class_type: 'CLIPSetLastLayer',            inputs: { stop_at_clip_layer: -2, clip: ['7', 1] } },
    '9':  { class_type: 'CLIPTextEncode',              inputs: { text: positiveText,  clip: ['8', 0] } },
    '10': { class_type: 'LoadImage',                   inputs: { image: inputImage } },
    '11': { class_type: 'UltralyticsDetectorProvider', inputs: { model_name: 'bbox/face_yolov8n.pt' } },
    '12': { class_type: 'CLIPTextEncode',              inputs: { text: negativeText, clip: ['8', 0] } },
    '13': { class_type: 'FaceDetailer',                inputs: {
      guide_size: 512, guide_size_for: true, max_size: 1024,
      seed, steps: 20, cfg: 4.0, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise,
      feather: 5, noise_mask: true, force_inpaint: true,
      bbox_threshold: 0.5, bbox_dilation: 10, bbox_crop_factor: 3,
      sam_detection_hint: 'center-1', sam_dilation: 0, sam_threshold: 0.93,
      sam_bbox_expansion: 0, sam_mask_hint_threshold: 0.7, sam_mask_hint_use_negative: 'False',
      drop_size: 10, wildcard: '', cycle: 1, inpaint_model: false, noise_mask_feather: 20,
      tiled_encode: false, tiled_decode: false,
      image: ['10', 0], model: ['7', 0], clip: ['8', 0], vae: ['1', 2],
      positive: ['9', 0], negative: ['12', 0], bbox_detector: ['11', 0],
    } },
    '14': { class_type: 'SaveImage', inputs: { filename_prefix: filenamePrefix, images: ['13', 0] } },
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
  log(`Denoise   : ${DENOISE_OVERRIDE !== null ? `${DENOISE_OVERRIDE} (global override)` : 'per-expression'}`);
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
    const actualDenoise = DENOISE_OVERRIDE ?? expr.denoise;

    log(`▶  ${expr.label} (seed ${seed}, denoise ${actualDenoise})`);

    // Inject skin anchor into positive: [quality + skin + race_anchor] BREAK [expr_tags]
    const positiveText = `${QUALITY_PREFIX}, ${SKIN_TONE}, human woman, BREAK, ${expr.positive}`;
    const negativeText = expr.negative;

    const workflow = buildExpressionWorkflow({
      inputImage:  INPUT_IMG,
      positiveText,
      negativeText,
      denoise:     actualDenoise,
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
      denoise:  actualDenoise,
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
