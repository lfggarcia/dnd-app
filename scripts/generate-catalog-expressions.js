#!/usr/bin/env node
/**
 * scripts/generate-catalog-expressions.js
 *
 * Batch expression generator for the full TORRE character catalog.
 * Reads assets/images/characters/catalog.json, iterates every entry
 * that has a portrait but no expressions, uploads the portrait to
 * ComfyUI and generates all 22 emotional expressions via FaceDetailer.
 *
 * After each character finishes, updates catalog.json with the
 * relative expression paths so the app can load them via require().
 *
 * Output structure (per entry):
 *   assets/images/characters/<class>/<key>/expression_<name>.png
 *   assets/images/characters/<class>/<key>/expressions.json   ← per-char manifest
 *   assets/images/characters/catalog.json                     ← updated with expressions
 *
 * Run:
 *   node scripts/generate-catalog-expressions.js
 *   node scripts/generate-catalog-expressions.js --resume
 *   node scripts/generate-catalog-expressions.js --key barbarian_human_1
 *   node scripts/generate-catalog-expressions.js --class fighter
 *   node scripts/generate-catalog-expressions.js --expression angry
 *
 * Requirements: Node 18+, ComfyUI at COMFY_URL (same setup as catalog script).
 */
'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const COMFY_URL     = process.env.COMFY_URL ?? 'http://192.168.0.17:8089';
const POLL_INTERVAL = 2_000;
const POLL_MAX      = 150; // ~5 min max per expression

const IMAGES_DIR   = path.join(__dirname, '..', 'assets', 'images', 'characters');
const CATALOG_FILE = path.join(IMAGES_DIR, 'catalog.json');

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) { console.error('Node 18+ required'); process.exit(1); }

// ---------------------------------------------------------------------------
// Quality tags (aligned with generate-expressions.js)
// ---------------------------------------------------------------------------
const QUALITY_PREFIX = 'score_9, score_8_up, score_8, masterpiece, best quality, expressive eyes, perfect face, 748cmstyle, usnr, kaogei';
const QUALITY_NEG    = 'score_6, score_5, score_4, civit_nsfw, ugly face, low res, blurry face, different person, different character, disfigured, deformed, bad anatomy, face markings, forehead mark, skin tattoo';

// ---------------------------------------------------------------------------
// Race → skin tone anchor (keeps identity stable during FaceDetailer inpaint)
// ---------------------------------------------------------------------------
const RACE_SKIN_TONE = {
  human:       'fair skin',
  elf:         'pale ethereal skin',
  dwarf:       'ruddy fair skin',
  halfling:    'warm fair skin',
  'half-elf':  'warm mixed-heritage skin',
  'half-orc':  'olive grey-green skin',
  gnome:       'fair gnome skin',
  tiefling:    'pale lavender skin',
  dragonborn:  'scaly draconic skin',
};

// ---------------------------------------------------------------------------
// 22 expression definitions (identical to generate-expressions.js v3)
// ---------------------------------------------------------------------------
const EXPRESSIONS = {
  neutral:     { label: 'Neutral',     denoise: 0.55, positive: 'completely relaxed facial muscles, soft steady gaze directly forward, mouth closed naturally, no tension anywhere in face', negative: `${QUALITY_NEG}, angry, happy, sad, smiling, crying, extreme expression` },
  angry:       { label: 'Angry',       denoise: 0.55, positive: 'inner brow corners sharply pulled down and together, deep vertical furrow between eyebrows, eyes narrowed to slits, jaw clenched, lips pressed tight, face tense', negative: `${QUALITY_NEG}, neutral expression, closed eyes, happy, sad, extra teeth, bad teeth, deformed teeth` },
  confident:   { label: 'Confident',   denoise: 0.55, positive: 'eyes closed serenely with small satisfied smile, eyebrows relaxed and high, face glowing with inner confidence, small serene smile, supremely self-assured expression', negative: `${QUALITY_NEG}, anxious, fearful, angry, sad` },
  confused:    { label: 'Confused',    denoise: 0.62, positive: 'head tilted hard to the left shoulder, LEFT eyebrow arched to maximum, RIGHT eyebrow pulled into frown, mouth twisted hard to one side half open with uncertainty, deep forehead furrow left side only', negative: `${QUALITY_NEG}, neutral expression, straight head, symmetric eyebrows, calm face` },
  despondent:  { label: 'Despondent',  denoise: 0.65, positive: 'lower lip pushed WAY out forming prominent visible pout, inner corners of eyebrows raised steeply creating sad brow angle, chin slightly dimpled and trembling, cheeks soft and full with pout, glossy wet eyes from held-back tears', negative: `${QUALITY_NEG}, happy, smiling, neutral expression, laughing, angry` },
  determined:  { label: 'Determined',  denoise: 0.55, positive: 'eyes narrowed with intense focused gaze, jaw set firmly forward, lips pressed into thin straight line, slight flare of nostrils, brow low and serious, face radiating iron will', negative: `${QUALITY_NEG}, neutral expression, laughing, crying, relaxed face` },
  disgusted:   { label: 'Disgusted',   denoise: 0.60, positive: 'eyes wide open directed DOWN with visible disgust, nose bridge wrinkling with horizontal creases bunny lines, mouth firmly pressed closed lips tight shut, one cheek raised from nose wrinkle, eyebrows pulled together and slightly down', negative: `${QUALITY_NEG}, happy, neutral, eyes closed, head tilted back, pleasure, ecstasy, open mouth, smiling` },
  fearful:     { label: 'Fearful',     denoise: 0.55, positive: 'eyes stretched extremely wide whites showing above and below iris, eyebrows raised and pulled together creating forehead wrinkles, mouth slightly open, lower lip trembling, face pale and frozen in terror', negative: `${QUALITY_NEG}, neutral expression, angry, happy, calm face, relaxed` },
  fierce:      { label: 'Fierce',      denoise: 0.68, positive: 'LEFT eye stretched wide open to maximum showing whites all around, RIGHT eye narrowed to predatory slit almost closed, wide unhinged villain grin showing all upper AND lower teeth fully, eyebrows pulling in opposite directions left up right down', negative: `${QUALITY_NEG}, symmetric eyes, neutral expression, calm face, closed mouth, sad` },
  flirty:      { label: 'Flirty',      denoise: 0.55, positive: 'one eyebrow raised high in playful arch, eyes heavy lidded and knowing, slight closed-mouth smile with one corner lifted into smirk, lips closed and defined, gentle head tilt, teasing confident expression', negative: `${QUALITY_NEG}, neutral expression, angry, scared, open mouth, sad` },
  happy:       { label: 'Happy',       denoise: 0.62, positive: 'cheeks raised and rounded pushing lower eyelids up, eyes curved into crescents, wide open smile showing upper teeth, corners of mouth pulled far back and up, face radiant with joy', negative: `${QUALITY_NEG}, angry, sad, neutral expression, closed eyes, closed mouth` },
  hollow:      { label: 'Hollow',      denoise: 0.55, positive: 'eyes open but staring through everything unseeing, pupils slightly dilated not focused on anything, face muscles completely slack and dropped, jaw hanging slightly open from zero muscle tone, face like nobody is home', negative: `${QUALITY_NEG}, focused gaze, happy, angry, intense expression, alert face` },
  incredulous: { label: 'Incredulous', denoise: 0.62, positive: 'one eyebrow raised to absolute maximum nearly touching hairline, opposite eyebrow aggressively pulled down in scowl, eyes wide on raised side, squinted on low side, mouth corners pulled sharply down, face screaming disbelief', negative: `${QUALITY_NEG}, neutral expression, symmetric eyebrows, calm, happy, smiling` },
  rage:        { label: 'Rage',        denoise: 0.68, positive: 'mouth stretched into WIDE unhinged grin showing every single tooth upper and lower rows fully bared, grin so wide it reaches near ears, eyes wide open with veins visible in whites from fury, eyebrows slanting sharply inward over nose in extreme frown WHILE mouth grins', negative: `${QUALITY_NEG}, closed mouth, neutral expression, calm face, sad expression, mild expression` },
  sad:         { label: 'Sad',         denoise: 0.55, positive: 'inner brow corners pulled upward making arch, lower lip jutting out trembling, eyes glistening with unshed tears, corners of mouth pulled sharply downward, face crumpled in sorrow', negative: `${QUALITY_NEG}, neutral expression, angry, happy, smiling, dry eyes` },
  sarcastic:   { label: 'Sarcastic',   denoise: 0.55, positive: 'one corner of mouth pulled up in sharp mocking smirk, one eyebrow raised slowly in contempt, other eyebrow flat and low, eyes heavy lidded with disdain, face radiating mockery and superiority', negative: `${QUALITY_NEG}, neutral expression, sad, scared, sincere expression, symmetric face` },
  seductive:   { label: 'Seductive',   denoise: 0.55, positive: 'one eye slightly more closed than the other in lazy wink, tip of tongue barely touching upper lip corner, chin slightly lowered, eyes looking up at viewer through lowered lashes, slow dangerous smile corner of mouth lifted', negative: `${QUALITY_NEG}, neutral expression, angry, scared, disgusted, sad` },
  serious:     { label: 'Serious',     denoise: 0.55, positive: 'lips closed in thin straight neutral line no curve up or down, slight brow furrow, eyes direct and cold, jaw set firmly, face composed with zero expression beyond controlled intensity', negative: `${QUALITY_NEG}, smiling, happy, laughing, extreme expression, relaxed brow` },
  shocked:     { label: 'Shocked',     denoise: 0.68, positive: 'eyes blown to maximum perfectly round circles with whites visible fully surrounding small iris in center, eyebrows shot straight up to absolute hairline, face frozen completely blank with terror, mouth hanging all the way open jaw dropped fully chin near chest, face drained of all color', negative: `${QUALITY_NEG}, calm, neutral, closed mouth, eyes not wide, relaxed brow` },
  surprised:   { label: 'Surprised',   denoise: 0.65, positive: 'both eyes blown wide open into huge perfect circles, eyebrows shooting up arching high above normal position, forehead creased horizontal from raised eyebrows, jaw dropped naturally mouth open relaxed, face expression of pure delighted surprise', negative: `${QUALITY_NEG}, neutral expression, angry, sad, calm, extra teeth, deformed teeth` },
  tired:       { label: 'Tired',       denoise: 0.55, positive: 'eyelids drooping so heavy eyes are barely visible as thin slits, head tilted forward with fatigue, face muscles completely relaxed and sagging, dark undereye shadows, mouth hanging open slightly from exhaustion', negative: `${QUALITY_NEG}, alert expression, wide open eyes, energetic, neutral alert face` },
  triumph:     { label: 'Triumph',     denoise: 0.62, positive: 'wide triumphant grin showing teeth, eyes bright and wide with victory, eyebrows raised in elation, chin slightly up, face radiating pride and power', negative: `${QUALITY_NEG}, sad, defeated, neutral expression, closed eyes, closed mouth` },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(msg) {
  const ts = new Date().toLocaleTimeString('es', { hour12: false });
  process.stdout.write(`[${ts}] ${msg}\n`);
}

function loadCatalog() {
  if (!fs.existsSync(CATALOG_FILE)) {
    console.error(`catalog.json not found at ${CATALOG_FILE}`);
    console.error('Run generate-character-catalog.js first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
}

function saveCatalog(catalog) {
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2));
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isValidPng = buf => buf.length > 5_000 && PNG_MAGIC.every((b, i) => buf[i] === b);

// ---------------------------------------------------------------------------
// ComfyUI API
// ---------------------------------------------------------------------------
async function uploadImageToComfy(filePath, overwrite = true) {
  const filename = path.basename(filePath);
  const fileContent = fs.readFileSync(filePath);
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
  const CRLF = '\r\n';

  const header = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="image"; filename="${filename}"`,
    'Content-Type: image/png',
    '',
    '',
  ].join(CRLF);
  const footer = `${CRLF}--${boundary}--${CRLF}`;
  const overwritePart = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="overwrite"',
    '',
    String(overwrite),
  ].join(CRLF) + CRLF;

  const body = Buffer.concat([
    Buffer.from(header),
    fileContent,
    Buffer.from(overwritePart + footer),
  ]);

  const r = await fetch(`${COMFY_URL}/upload/image`, {
    method:  'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
  if (!r.ok) throw new Error(`Upload failed ${r.status}: ${await r.text()}`);
  const { name }  = await r.json();
  return name; // filename as stored in ComfyUI input
}

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
    process.stdout.write(`\r     ${label} — ${s}s...   `);
  }
  throw new Error(`Timeout after ${(POLL_MAX * POLL_INTERVAL) / 1000}s`);
}

async function fetchOutputBlob(filename, subfolder = '') {
  const p = new URLSearchParams({ filename, subfolder, type: 'output' });
  const r = await fetch(`${COMFY_URL}/view?${p}`);
  if (!r.ok) throw new Error(`Image fetch ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// ---------------------------------------------------------------------------
// Workflow builder (FaceDetailer — mirrors generate-expressions.js exactly)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Generate all expressions for one catalog entry
// ---------------------------------------------------------------------------
async function generateExpressionsForEntry(entry, catalog, filterExpr) {
  const portraitAbsPath = path.join(__dirname, '..', entry.portraitPath);
  if (!fs.existsSync(portraitAbsPath)) {
    log(`  [SKIP] ${entry.key} — portrait file not found: ${entry.portraitPath}`);
    return;
  }

  const charDir = path.join(IMAGES_DIR, entry.charClass, entry.key);
  fs.mkdirSync(charDir, { recursive: true });

  const manifestFile = path.join(charDir, 'expressions.json');
  const manifest     = fs.existsSync(manifestFile)
    ? JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
    : {};

  const skinTone = RACE_SKIN_TONE[entry.race] ?? 'fair skin';

  // Upload portrait to ComfyUI input
  log(`  Uploading portrait to ComfyUI...`);
  let comfyInputName;
  try {
    comfyInputName = await uploadImageToComfy(portraitAbsPath);
    log(`  Uploaded as: ${comfyInputName}`);
  } catch (err) {
    log(`  ERROR uploading: ${err.message}`);
    return;
  }

  const expressionEntries = filterExpr
    ? Object.entries(EXPRESSIONS).filter(([k]) => k === filterExpr)
    : Object.entries(EXPRESSIONS);

  const expressionPaths = { ...(entry.expressions ?? {}) };

  for (const [exprKey, expr] of expressionEntries) {
    const outFile    = path.join(charDir, `expression_${exprKey}.png`);
    const relOutPath = `assets/images/characters/${entry.charClass}/${entry.key}/expression_${exprKey}.png`;

    // Skip already done expressions in resume mode
    if (args.includes('--resume') && fs.existsSync(outFile)) {
      log(`    [SKIP] ${expr.label} — already exists`);
      expressionPaths[exprKey] = relOutPath;
      continue;
    }

    const seed = Math.floor(Math.random() * 2 ** 32);
    const positiveText = `${QUALITY_PREFIX}, ${skinTone}, BREAK, ${expr.positive}`;
    const workflow     = buildExpressionWorkflow({
      inputImage:    comfyInputName,
      positiveText,
      negativeText:  expr.negative,
      denoise:       expr.denoise,
      seed,
      filenamePrefix: `${entry.key}_${exprKey}`,
    });

    log(`    ▶ ${expr.label} (denoise ${expr.denoise})`);

    let promptId;
    try {
      promptId = await queueWorkflow(workflow);
    } catch (err) {
      log(`    ✗ ${expr.label} — queue error: ${err.message}`);
      continue;
    }

    let result;
    try {
      result = await pollUntilDone(promptId, expr.label);
      process.stdout.write('\n');
    } catch (err) {
      process.stdout.write('\n');
      log(`    ✗ ${expr.label} — ${err.message}`);
      continue;
    }

    // Extract output image
    const outputs = result.entry?.outputs ?? {};
    let imageInfo = null;
    for (const nodeOut of Object.values(outputs)) {
      const imgs = nodeOut?.images;
      if (Array.isArray(imgs) && imgs.length > 0) { imageInfo = imgs[0]; break; }
    }
    if (!imageInfo) {
      log(`    ✗ ${expr.label} — no output image in history`);
      continue;
    }

    let imgBuf;
    try {
      imgBuf = await fetchOutputBlob(imageInfo.filename, imageInfo.subfolder);
    } catch (err) {
      log(`    ✗ ${expr.label} — download: ${err.message}`);
      continue;
    }

    if (!isValidPng(imgBuf)) {
      log(`    ✗ ${expr.label} — invalid PNG (${imgBuf.length} bytes)`);
      continue;
    }

    fs.writeFileSync(outFile, imgBuf);
    expressionPaths[exprKey] = relOutPath;
    manifest[exprKey] = {
      label:     expr.label,
      file:      `expression_${exprKey}.png`,
      seed,
      denoise:   expr.denoise,
      generated: new Date().toISOString(),
    };

    // Save per-char manifest after each expression (crash-safe)
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));

    // Update catalog.json after each expression (crash-safe)
    catalog[entry.key] = { ...entry, expressions: expressionPaths };
    saveCatalog(catalog);

    const secs = (result.elapsed / 1000).toFixed(1);
    log(`    ✓ ${expr.label} — saved (${secs}s, ${(imgBuf.length / 1024).toFixed(0)} KB)`);
  }

  // Final catalog update for this entry
  catalog[entry.key] = { ...entry, expressions: expressionPaths };
  saveCatalog(catalog);
  log(`  Expressions done for ${entry.key}`);
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args        = process.argv.slice(2);
const resume      = args.includes('--resume');
const filterKey   = args.includes('--key')        ? args[args.indexOf('--key')        + 1] : null;
const filterClass = args.includes('--class')      ? args[args.indexOf('--class')      + 1] : null;
const filterExpr  = args.includes('--expression') ? args[args.indexOf('--expression') + 1] : null;

if (filterExpr && !EXPRESSIONS[filterExpr]) {
  console.error(`Unknown expression "${filterExpr}". Available: ${Object.keys(EXPRESSIONS).join(', ')}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n=== TORRE · Catalog Expressions Batch Generator ===');
  console.log(`  Expressions : ${Object.keys(EXPRESSIONS).length} total`);
  console.log(`  Resume      : ${resume ? 'ON' : 'OFF'}`);
  console.log(`  Filter key  : ${filterKey ?? 'all'}`);
  console.log(`  Filter class: ${filterClass ?? 'all'}`);
  console.log(`  Filter expr : ${filterExpr ?? 'all'}`);
  console.log('');

  const catalog = loadCatalog();
  let targets = Object.values(catalog);

  if (filterKey)   targets = targets.filter(e => e.key === filterKey);
  if (filterClass) targets = targets.filter(e => e.charClass === filterClass);

  // If not filtering a specific expression, skip entries that already have all 22
  if (!filterExpr && !filterKey) {
    const totalExpressions = Object.keys(EXPRESSIONS).length;
    targets = targets.filter(e => {
      const done = e.expressions ? Object.keys(e.expressions).length : 0;
      return done < totalExpressions;
    });
  }

  if (targets.length === 0) {
    console.log('All catalog entries already have expressions. Use --key or --expression to regenerate specific ones.');
    return;
  }

  // Ping ComfyUI
  process.stdout.write('Connecting to ComfyUI... ');
  try {
    const ping = await fetch(`${COMFY_URL}/system_stats`);
    if (!ping.ok) throw new Error(`HTTP ${ping.status}`);
    console.log('OK');
  } catch (err) {
    console.error(`FAILED: ${err.message}`);
    console.error(`Make sure ComfyUI is running at ${COMFY_URL}`);
    process.exit(1);
  }
  console.log('');

  const t0 = Date.now();
  let done = 0;

  for (const entry of targets) {
    log(`\n[${entry.key.toUpperCase()}] (${++done}/${targets.length})`);
    log(`  Class: ${entry.charClass}  Race: ${entry.race}  Subclass: ${entry.subclass ?? 'none'}`);
    try {
      await generateExpressionsForEntry(entry, catalog, filterExpr);
    } catch (err) {
      log(`  FATAL for ${entry.key}: ${err.message}`);
      // Save catalog state even on error, then continue with next entry
      saveCatalog(catalog);
    }
  }

  const elapsed = (Date.now() - t0) / 1000;
  console.log(`\n=== Done in ${(elapsed / 60).toFixed(1)} min ===`);
  console.log(`Updated: ${path.relative(process.cwd(), CATALOG_FILE)}`);
  console.log('');
  console.log('Next step: update PORTRAIT_REQUIRE_MAP and EXPRESSION_REQUIRE_MAP');
  console.log('in src/services/characterCatalogService.ts');
}

main().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
