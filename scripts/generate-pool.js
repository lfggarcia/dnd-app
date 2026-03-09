#!/usr/bin/env node
/**
 * scripts/generate-pool.js
 *
 * Character pool generator — permutaciones de raza × clase.
 * Para cada combinación genera el retrato base (Flujo 1 v8) y las 9 expresiones
 * (Flujo 2 FaceDetailer). Produce "fichas" completas listas para probar.
 *
 * Output:
 *   assets/images/pool/<race>_<class>/portrait.png
 *   assets/images/pool/<race>_<class>/expression_<name>.png   (×9)
 *   assets/images/pool/<race>_<class>/manifest.json
 *   assets/images/pool/pool_index.json
 *
 * Usage:
 *   node scripts/generate-pool.js                             # all combos, 1 variation cada
 *   node scripts/generate-pool.js --variations 11            # 11 variaciones por race×class → keys: race_class_v01..v11
 *   node scripts/generate-pool.js --dry-run                  # preview combos SIN generar nada
 *   node scripts/generate-pool.js --limit 5                  # max N fichas
 *   node scripts/generate-pool.js --portrait-only            # solo retratos
 *   node scripts/generate-pool.js --expressions-only         # solo expresiones (requiere portrait.png)
 *   node scripts/generate-pool.js --character tiefling_warlock_v03  # ficha concreta por key
 *   node scripts/generate-pool.js --resume                   # salta fichas con done:true en pool_index
 *   node scripts/generate-pool.js --list                     # imprime todos los keys y sale
 *   node scripts/generate-pool.js --generate-asset-map       # solo regenera pool-asset-map.js (sin generar imgs)
 *
 * Requirements: Node 18+
 * ComfyUI must be reachable at COMFY_URL with:
 *   checkpoints/   perfectdeliberate_v8.safetensors
 *   loras/         748cmSDXL.safetensors
 *                  thiccwithaq-artist-richy-v1_ixl.safetensors
 *                  USNR_STYLE_ILL_V1_lokr3-000024.safetensors
 *                  Detailer_NoobAI_Incrs_v1.safetensors
 *   upscale_models/ remacri_original.safetensors
 *   ultralytics/bbox/ face_yolov8n.pt
 */
'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// --- Config ------------------------------------------------------------------
const COMFY_URL     = 'http://192.168.0.17:8089';
const POLL_INTERVAL = 2_000;
const POLL_MAX      = 200;  // ~6.5 min per portrait (hires takes longer)

const POOL_DIR  = path.join(__dirname, '..', 'assets', 'images', 'pool');
const INDEX_FILE = path.join(POOL_DIR, 'pool_index.json');

// --- Node version guard ------------------------------------------------------
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) { console.error(`Node 18+ required (${process.version})`); process.exit(1); }

// --- Quality tags (Illustrious ecosystem) ------------------------------------
const QUALITY_POS = 'score_9, score_8_up, score_8, masterpiece, best quality, newest, absurdres';
const QUALITY_NEG = 'score_6, score_5, score_4, low quality, worst quality, blurry, deformed, bad anatomy, extra limbs, missing fingers, fused fingers, watermark, text, logo, signature, photorealistic, photograph, 3d render';
const EXPR_QUALITY = 'score_9, score_8_up, score_8, masterpiece, best quality, expressive eyes, perfect face, 748cmstyle, usnr';
const EXPR_NEG_BASE = 'score_6, score_5, score_4, ugly face, low res, blurry face, different person, different character, disfigured, deformed, bad anatomy, face markings, forehead mark, skin tattoo';

// --- Pool permutation tables -------------------------------------------------

// Each race: { visual: string, skinAnchor: string }
const RACE_POOL = {
  human:      { visual: 'human woman',                                                                                                                    skinAnchor: 'fair skin'      },
  tiefling:   { visual: 'human woman, small curved black horns on forehead, long slender pointed tail, solid glowing violet eyes, slightly pointed ears',  skinAnchor: 'pale skin'      },
  elf:        { visual: 'human woman, long elegant pointed ears, ethereal refined features, delicate bone structure',                                      skinAnchor: 'fair skin'      },
  'half-elf': { visual: 'human woman, slightly pointed ears, delicate mixed-heritage features',                                                            skinAnchor: 'fair skin'      },
  'half-orc': { visual: 'human woman, slightly green-tinted complexion, strong jaw, subtle lower canines, powerful build',                                 skinAnchor: 'olive skin'     },
  dwarf:      { visual: 'human woman, stocky sturdy powerful build, braided hair, wide shoulders',                                                         skinAnchor: 'fair skin'      },
  halfling:   { visual: 'human woman, petite short stature, curly hair, small nimble frame, large bright eyes',                                            skinAnchor: 'fair skin'      },
  drow:       { visual: 'human woman, dark grey skin, white silver hair, long elegant pointed ears, bright violet eyes',                                   skinAnchor: 'dark grey skin' },
};

// Each class: { visual: string, outfit: string }
const CLASS_POOL = {
  fighter:  { visual: 'form-fitting battle top, tight armored pants, plate armor pieces, longsword and shield, battle-worn determined expression' },
  rogue:    { visual: 'form-fitting dark leather vest, tight leather pants, open dark jacket, twin daggers at belt, hood partially up, mysterious smile' },
  ranger:   { visual: 'form-fitting leather scout top, tight leather leggings, open travel cloak, longbow slung over shoulder, watchful alert eyes' },
  warlock:  { visual: 'form-fitting dark corset top, tight dark pants, dark flowing open coat, bare shoulders, eldritch rune accessories on clothing, shadowy magic aura' },
  wizard:   { visual: 'fitted arcane corset, tight scholarly pants, open robe coat, bare collarbone, glowing arcane sigils on coat, spellbook at hip' },
  bard:     { visual: 'fitted performer corset, tight colorful pants, open decorative cape, lute, charismatic wide smile, bare shoulders' },
  cleric:   { visual: 'fitted holy vestment top, tight divine pants, open sacred coat, holy symbol on chest, divine glow, kind determined face' },
  barbarian:{ visual: 'minimal fur-trimmed top, tight war pants, worn hide armor pieces, greatsword, battle rage energy, bare midriff' },
  sorcerer: { visual: 'form-fitting arcane top, tight otherworldly pants, open arcane coat, bare collarbone, arcane energy crackling, dragon sorcerer horns optional' },
  paladin:  { visual: 'fitted half-plate chest, tight dark pants, open cloak, holy rune on pauldron, radiant aura, resolute face' },
  druid:    { visual: 'fitted nature top, tight leaf-woven leggings, open nature cloak, carved wooden staff, leaf and vine motifs, bare midriff' },
  monk:     { visual: 'fitted cloth gi top, tight training pants, rope belt, open jacket, ki energy aura, focused martial stance' },
};

const ALIGNMENT_EXPRESSION_POOL = {
  'chaotic-neutral': 'unpredictable carefree independent smirk',
  'lawful-good':     'noble confident heroic expression',
  'neutral':         'calm balanced composed neutral',
  'chaotic-evil':    'wild unhinged dangerous snarl',
  'neutral-evil':    'sinister cunning ambitious smirk',
};

// 9 expressions — v2 (mirrors EXPRESSION_PRESETS in geminiImageService.ts)
const EXPRESSIONS = {
  neutral:    { label: 'Neutral',    positive: 'calm neutral expression, relaxed face, soft eyes, composed, serene, (neutral expression:1.4), (calm face:1.3)',                                                                          negative: `${EXPR_NEG_BASE}, angry, happy, sad, smiling, crying` },
  angry:      { label: 'Angry',      positive: 'clenched teeth, furrowed brows, narrowed bloodshot eyes, battle fury, rage, intense glare, (angry expression:1.4), (furrowed brows:1.35), (intense glare:1.3)',                          negative: `${EXPR_NEG_BASE}, neutral expression, closed eyes, happy, sad, extra teeth, bad teeth` },
  sad:        { label: 'Sad',        positive: 'downcast eyes, trembling lips, sorrowful expression, tears welling, grief, (sad expression:1.4), (downcast eyes:1.35), (trembling lips:1.3)',                                            negative: `${EXPR_NEG_BASE}, neutral expression, angry, happy, smiling` },
  surprised:  { label: 'Surprised',  positive: 'wide open eyes, raised eyebrows, open mouth, shock, astonishment, (surprised expression:1.4), (wide eyes:1.35), (open mouth:1.3)',                                                      negative: `${EXPR_NEG_BASE}, neutral expression, angry, sad, calm, extra teeth` },
  determined: { label: 'Determined', positive: 'set jaw, focused gaze, firm lips, resolve, unwavering stare, steely eyes, (determined expression:1.4), (focused gaze:1.35), (set jaw:1.3)',                                              negative: `${EXPR_NEG_BASE}, neutral expression, laughing, crying` },
  fearful:    { label: 'Fearful',    positive: 'wide fearful eyes, pale trembling, pupils dilated, terror, dread, shaking, (fearful expression:1.4), (wide fearful eyes:1.35), (trembling:1.3)',                                         negative: `${EXPR_NEG_BASE}, neutral expression, angry, happy, calm` },
  disgusted:  { label: 'Disgusted',  positive: 'wrinkled nose, curled upper lip, narrowed eyes, contempt, revulsion, (disgusted expression:1.4), (wrinkled nose:1.35), (curled lip:1.3)',                                               negative: `${EXPR_NEG_BASE}, neutral expression, happy` },
  seductive:  { label: 'Seductive',  positive: 'half-lidded eyes, slow smile, parted lips, smoldering gaze, alluring, magnetic presence, (seductive expression:1.4), (half-lidded eyes:1.35), (parted lips:1.3)',                       negative: `${EXPR_NEG_BASE}, neutral expression, angry, scared` },
  happy:      { label: 'Happy',      positive: 'bright smile, teeth showing, eyes curved with joy, warm expression, genuine laughter, (happy expression:1.4), (bright smile:1.35), (joyful eyes:1.3)',                                  negative: `${EXPR_NEG_BASE}, angry, sad, neutral expression, closed eyes` },
};

// --- Deterministic seeds (reproducible per key+variation+purpose) -----------
function deterministicSeed(key, purpose = 'portrait') {
  const hash = crypto.createHash('sha256').update(`${key}|${purpose}`).digest('hex');
  return parseInt(hash.slice(0, 8), 16);
}

function buildPermutations(numVariations = 1) {
  const chars = [];
  for (const [race, raceData] of Object.entries(RACE_POOL)) {
    for (const [cls, clsData] of Object.entries(CLASS_POOL)) {
      for (let v = 1; v <= numVariations; v++) {
        const suffix = numVariations > 1 ? `_v${String(v).padStart(2, '0')}` : '';
        const key    = `${race}_${cls}${suffix}`;
        const baseKey = `${race}_${cls}`;

        // Deterministic seeds: same key+variation always produces same images
        const seed = deterministicSeed(key, 'portrait');
        const expressionSeeds = Object.fromEntries(
          Object.keys(EXPRESSIONS).map(e => [e, deterministicSeed(key, e)])
        );

        chars.push({ key, baseKey, race, cls, variation: v, raceData, clsData, alignment: 'chaotic-neutral', seed, expressionSeeds });
      }
    }
  }
  return chars;
}

// --- Prompt builders ---------------------------------------------------------
function buildPortraitPrompt({ race, raceData, clsData }) {
  const { visual: raceVisual, skinAnchor } = raceData;
  const { visual: clsVisual } = clsData;

  const positive = [
    QUALITY_POS,
    'BREAK',
    `1girl, sole_girl, ${skinAnchor}, ${raceVisual}`,
    'large breasts, wide hips, hourglass figure, curvy toned body',
    clsVisual,
    'BREAK',
    'cowboy shot, face large and prominent, face in upper third of image, face fills upper frame, head and shoulders clearly visible, looking at viewer, 3/4 angle slight side view, upper body visible to waist, slight lean forward pose, face fully visible no obstruction, no hair over eyes, expressive detailed eyes, dramatic close-medium shot',
    'BREAK',
    'perfect face, highly detailed face, sharp defined facial features, sharp nose bridge, defined cheekbones, detailed lips, detailed eyelids, detailed iris texture, crisp clean lineart on face, no soft face, no blurry face, clean bare face, no face markings, no face tattoos, no face jewelry, no forehead mark, no forehead gem, face fully visible no hair over eyes, clean face edges, cinematic portrait lighting, rim light on face, soft key light on skin, face illuminated, dark fantasy RPG character portrait, concept art, highly detailed fantasy illustration, dark atmosphere, blurred background, bokeh depth of field, subject sharp foreground, usnr, 748cmstyle',
  ].join(', ');

  const isNonHumanoid = ['dragonborn', 'draconido'].includes(race);
  const raceNeg = isNonHumanoid ? 'dragon head, monster face, fully reptilian face, animal face,' : '';

  const negative = [
    QUALITY_NEG,
    raceNeg,
    'explicit nudity, genitals, nipples, multiple people, crowd',
    'full body shot, zoomed out, distant shot, cut off head, cropped face, face far away, small face, face secondary, face in shadow, dark face, obscured eyes, hair over eyes',
    'face tattoo, face markings, face paint, face jewelry, forehead gem, forehead mark, forehead tattoo, forehead symbol, facial runes, facial ornaments, skin markings, skin tattoos',
    'flat chest, shapeless body, soft face, blurry face, flat face, undefined features, ugly, poorly drawn',
  ].filter(Boolean).join(', ');

  return { positive, negative };
}

function buildExpressionPrompt(skinAnchor, exprData) {
  const positive = `${EXPR_QUALITY}, ${skinAnchor}, human woman, BREAK, ${exprData.positive}`;
  const negative = exprData.negative;
  return { positive, negative };
}

// --- Workflow builders -------------------------------------------------------
function buildPortraitWorkflow(positiveText, negativeText, seed) {
  return {
    '1':  { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'perfectdeliberate_v8.safetensors' } },
    '2':  { class_type: 'LoraLoader',             inputs: { model: ['1', 0], clip: ['1', 1], lora_name: '748cmSDXL.safetensors',                        strength_model: 0.5,  strength_clip: 0.5  } },
    '3':  { class_type: 'LoraLoader',             inputs: { model: ['2', 0], clip: ['2', 1], lora_name: 'thiccwithaq-artist-richy-v1_ixl.safetensors', strength_model: 0.55, strength_clip: 0.55 } },
    '4':  { class_type: 'LoraLoader',             inputs: { model: ['3', 0], clip: ['3', 1], lora_name: 'USNR_STYLE_ILL_V1_lokr3-000024.safetensors',  strength_model: 0.6,  strength_clip: 0.6  } },
    '5':  { class_type: 'LoraLoader',             inputs: { model: ['4', 0], clip: ['4', 1], lora_name: 'Detailer_NoobAI_Incrs_v1.safetensors',         strength_model: 0.7,  strength_clip: 0.7  } },
    '6':  { class_type: 'CLIPSetLastLayer',       inputs: { clip: ['5', 1], stop_at_clip_layer: -2 } },
    '7':  { class_type: 'CLIPTextEncode',         inputs: { text: positiveText, clip: ['6', 0] } },
    '8':  { class_type: 'CLIPTextEncode',         inputs: { text: negativeText, clip: ['6', 0] } },
    '9':  { class_type: 'EmptyLatentImage',       inputs: { width: 832, height: 1216, batch_size: 1 } },
    '10': { class_type: 'KSampler',               inputs: { seed, steps: 38, cfg: 4.0, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1.0,  model: ['5', 0], positive: ['7', 0], negative: ['8', 0], latent_image: ['9', 0] } },
    '11': { class_type: 'VAEDecodeTiled',         inputs: { samples: ['10', 0], vae: ['1', 2], tile_size: 512, overlap: 32, temporal_size: 64, temporal_overlap: 8 } },
    '12': { class_type: 'UpscaleModelLoader',     inputs: { model_name: 'remacri_original.safetensors' } },
    '13': { class_type: 'ImageUpscaleWithModel',  inputs: { upscale_model: ['12', 0], image: ['11', 0] } },
    '14': { class_type: 'ImageScale',             inputs: { upscale_method: 'lanczos', width: 1248, height: 1824, crop: 'disabled', image: ['13', 0] } },
    '15': { class_type: 'VAEEncodeTiled',         inputs: { pixels: ['14', 0], vae: ['1', 2], tile_size: 512, overlap: 32, temporal_size: 64, temporal_overlap: 8 } },
    '16': { class_type: 'KSampler',               inputs: { seed, steps: 20, cfg: 4.0, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 0.55, model: ['5', 0], positive: ['7', 0], negative: ['8', 0], latent_image: ['15', 0] } },
    '17': { class_type: 'VAEDecodeTiled',         inputs: { samples: ['16', 0], vae: ['1', 2], tile_size: 512, overlap: 32, temporal_size: 64, temporal_overlap: 8 } },
    '18': { class_type: 'SaveImage',              inputs: { filename_prefix: 'pool_portrait', images: ['17', 0] } },
  };
}

function buildExpressionWorkflow(inputImage, positiveText, negativeText, seed, filenamePrefix) {
  return {
    '1':  { class_type: 'CheckpointLoaderSimple',       inputs: { ckpt_name: 'perfectdeliberate_v8.safetensors' } },
    '2':  { class_type: 'LoraLoader',                   inputs: { model: ['1', 0], clip: ['1', 1], lora_name: '748cmSDXL.safetensors',                        strength_model: 0.5, strength_clip: 0.5 } },
    '3':  { class_type: 'LoraLoader',                   inputs: { model: ['2', 0], clip: ['2', 1], lora_name: 'thiccwithaq-artist-richy-v1_ixl.safetensors', strength_model: 0.7, strength_clip: 0.7 } },
    '4':  { class_type: 'LoraLoader',                   inputs: { model: ['3', 0], clip: ['3', 1], lora_name: 'USNR_STYLE_ILL_V1_lokr3-000024.safetensors',  strength_model: 0.6, strength_clip: 0.6 } },
    '5':  { class_type: 'LoraLoader',                   inputs: { model: ['4', 0], clip: ['4', 1], lora_name: 'Detailer_NoobAI_Incrs_v1.safetensors',         strength_model: 0.5, strength_clip: 0.5 } },
    '6':  { class_type: 'CLIPSetLastLayer',             inputs: { clip: ['5', 1], stop_at_clip_layer: -2 } },
    '7':  { class_type: 'CLIPTextEncode',               inputs: { text: positiveText, clip: ['6', 0] } },
    '8':  { class_type: 'LoadImage',                    inputs: { image: inputImage } },
    '9':  { class_type: 'UltralyticsDetectorProvider',  inputs: { model_name: 'bbox/face_yolov8n.pt' } },
    '10': { class_type: 'CLIPTextEncode',               inputs: { text: negativeText, clip: ['6', 0] } },
    '11': { class_type: 'FaceDetailer',                 inputs: {
      guide_size: 768, guide_size_for: true, max_size: 1024,
      seed, steps: 20, cfg: 4.0, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 0.45,
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

// --- Helpers -----------------------------------------------------------------
const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(msg) {
  const ts = new Date().toLocaleTimeString('es', { hour12: false });
  console.log(`[${ts}] ${msg}`);
}

function loadIndex() {
  try { return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')); }
  catch { return {}; }
}

function saveIndex(idx) {
  fs.mkdirSync(POOL_DIR, { recursive: true });
  fs.writeFileSync(INDEX_FILE, JSON.stringify(idx, null, 2));
}

function loadManifest(charDir) {
  const p = path.join(charDir, 'manifest.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return {}; }
}

function saveManifest(charDir, m) {
  fs.writeFileSync(path.join(charDir, 'manifest.json'), JSON.stringify(m, null, 2));
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
    process.stdout.write(`\r     ${label} — ${s}s…   `);
  }
  throw new Error(`Timeout after ${POLL_MAX * POLL_INTERVAL / 1000}s`);
}

async function fetchBlob(filename, subfolder = '') {
  const p = new URLSearchParams({ filename, subfolder, type: 'output' });
  const r = await fetch(`${COMFY_URL}/view?${p}`);
  if (!r.ok) throw new Error(`Fetch ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function isValidPng(buf) {
  return buf.length > 10_000 && PNG_MAGIC.every((b, i) => buf[i] === b);
}

async function uploadImageToComfy(imgBuf) {
  const form = new FormData();
  const blob = new Blob([imgBuf], { type: 'image/png' });
  form.append('image', blob, 'portrait.png');
  form.append('type', 'input');
  form.append('overwrite', 'true');
  const r = await fetch(`${COMFY_URL}/upload/image`, { method: 'POST', body: form });
  if (!r.ok) throw new Error(`Upload ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data.name;
}

// --- Generate portrait for one character -------------------------------------
async function generatePortrait(char, charDir, manifest) {
  const portraitPath = path.join(charDir, 'portrait.png');
  if (manifest.portrait?.done && fs.existsSync(portraitPath)) {
    log(`  [SKIP portrait] already exists`);
    return fs.readFileSync(portraitPath);
  }

  const { positive, negative } = buildPortraitPrompt(char);
  const seed     = char.seed;
  const workflow = buildPortraitWorkflow(positive, negative, seed);

  const promptId = await queueWorkflow(workflow);
  const { entry, elapsed } = await pollUntilDone(promptId, `${char.key} portrait`);
  process.stdout.write('\n');

  const outputs = entry?.outputs ?? {};
  let imgInfo = null;
  for (const n of Object.values(outputs)) {
    if (Array.isArray(n?.images) && n.images.length > 0) { imgInfo = n.images[0]; break; }
  }
  if (!imgInfo) throw new Error('No output in portrait history');

  const buf = await fetchBlob(imgInfo.filename, imgInfo.subfolder);
  if (!isValidPng(buf)) throw new Error('Invalid PNG from portrait');

  fs.writeFileSync(portraitPath, buf);
  manifest.portrait = { done: true, seed, elapsed, file: 'portrait.png', generated: new Date().toISOString() };
  log(`  ✓ portrait saved (${(buf.length / 1024).toFixed(0)} KB, ${(elapsed / 1000).toFixed(1)}s)`);
  return buf;
}

// --- Generate all expressions for one character ------------------------------
async function generateExpressions(char, charDir, portraitBuf, manifest) {
  const uploadedName = await uploadImageToComfy(portraitBuf);
  log(`  Uploaded portrait as: ${uploadedName}`);

  for (const [exprKey, exprData] of Object.entries(EXPRESSIONS)) {
    const outFile = path.join(charDir, `expression_${exprKey}.png`);

    if (manifest.expressions?.[exprKey]?.done && fs.existsSync(outFile)) {
      log(`  [SKIP ${exprKey}] already exists`);
      continue;
    }

    const seed     = char.expressionSeeds[exprKey];
    const { positive, negative } = buildExpressionPrompt(char.raceData.skinAnchor, exprData);
    const workflow = buildExpressionWorkflow(uploadedName, positive, negative, seed, `pool_${char.key}_${exprKey}`);

    log(`  ▶  ${exprData.label} (seed ${seed})`);
    let result;
    try {
      const promptId = await queueWorkflow(workflow);
      result = await pollUntilDone(promptId, exprData.label);
      process.stdout.write('\n');
    } catch (err) {
      process.stdout.write('\n');
      log(`  ✗  ${exprData.label}: ${err.message}`);
      continue;
    }

    const outputs = result.entry?.outputs ?? {};
    let imgInfo = null;
    for (const n of Object.values(outputs)) {
      if (Array.isArray(n?.images) && n.images.length > 0) { imgInfo = n.images[0]; break; }
    }
    if (!imgInfo) { log(`  ✗  ${exprData.label}: no output`); continue; }

    const buf = await fetchBlob(imgInfo.filename, imgInfo.subfolder);
    if (!isValidPng(buf)) { log(`  ✗  ${exprData.label}: invalid PNG`); continue; }

    fs.writeFileSync(outFile, buf);
    if (!manifest.expressions) manifest.expressions = {};
    manifest.expressions[exprKey] = {
      done: true, seed, elapsed: result.elapsed,
      file: `expression_${exprKey}.png`, generated: new Date().toISOString(),
    };
    log(`  ✓  ${exprData.label} (${(buf.length / 1024).toFixed(0)} KB, ${(result.elapsed / 1000).toFixed(1)}s)`);
  }
}

// --- Process one character ficha ---------------------------------------------
async function processCharacter(char, opts, index) {
  const charDir = path.join(POOL_DIR, char.key);
  fs.mkdirSync(charDir, { recursive: true });

  if (opts.resume && index[char.key]?.done) {
    log(`[SKIP] ${char.key} — fully completed`);
    return;
  }

  log(`\n[${char.key.toUpperCase()}] ${char.race} × ${char.cls}`);

  const manifest = loadManifest(charDir);
  let portraitBuf;

  if (!opts.expressionsOnly) {
    try {
      portraitBuf = await generatePortrait(char, charDir, manifest);
      saveManifest(charDir, manifest);
    } catch (err) {
      log(`  ERROR portrait: ${err.message}`);
      saveManifest(charDir, manifest);
      return;
    }
  } else {
    const p = path.join(charDir, 'portrait.png');
    if (!fs.existsSync(p)) { log(`  SKIP — portrait.png not found (run without --expressions-only first)`); return; }
    portraitBuf = fs.readFileSync(p);
    log(`  Using existing portrait`);
  }

  if (!opts.portraitOnly) {
    try {
      await generateExpressions(char, charDir, portraitBuf, manifest);
      saveManifest(charDir, manifest);
    } catch (err) {
      log(`  ERROR expressions: ${err.message}`);
    }
  }

  const expressions = manifest.expressions ? Object.keys(manifest.expressions).length : 0;
  const done = !!manifest.portrait?.done && expressions === Object.keys(EXPRESSIONS).length;
  index[char.key] = {
    key: char.key, race: char.race, cls: char.cls, variation: char.variation,
    portraitDone: !!manifest.portrait?.done,
    expressionsDone: expressions,
    done,
    generated: new Date().toISOString(),
  };
  saveIndex(index);
}

// --- Asset map generator -----------------------------------------------------
// Generates assets/images/pool/pool-asset-map.js
// React Native requires() can't be dynamic, so this static map is needed for the selector UI.
function generateAssetMap() {
  const indexPath = INDEX_FILE;
  if (!fs.existsSync(indexPath)) {
    console.error('pool_index.json not found. Run the generator first.');
    process.exit(1);
  }
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const entries = Object.values(index).filter(c => c.portraitDone);

  // Group by baseKey so the selector can show all variations for a race×class
  const byBase = {};
  for (const entry of entries) {
    const bk = entry.key.replace(/_v\d+$/, '');
    if (!byBase[bk]) byBase[bk] = [];
    byBase[bk].push(entry.key);
  }

  const lines = [
    '// AUTO-GENERATED by generate-pool.js --generate-asset-map',
    '// DO NOT EDIT MANUALLY',
    '/* eslint-disable */',
    '// @ts-nocheck',
    "/** @type {Record<string, {portrait: number, expressions: Record<string, number>}>} */",
    'const POOL_ASSET_MAP = {',
  ];

  for (const [key, entry] of Object.entries(index)) {
    if (!entry.portraitDone) continue;
    const dir = `${entry.race}_${entry.cls}${entry.variation && entry.variation > 1 ? `_v${String(entry.variation).padStart(2, '0')}` : (key.match(/_v\d+$/) ? key.match(/_v\d+$/)[0] : '')}`;
    const actualDir = key; // key IS the folder name
    const exprLines = Object.keys(EXPRESSIONS)
      .filter(e => fs.existsSync(path.join(POOL_DIR, actualDir, `expression_${e}.png`)))
      .map(e => `      ${e}: require('./${actualDir}/expression_${e}.png'),`)
      .join('\n');
    lines.push(`  '${key}': {`);
    if (fs.existsSync(path.join(POOL_DIR, actualDir, 'portrait.png'))) {
      lines.push(`    portrait: require('./${actualDir}/portrait.png'),`);
    }
    if (exprLines) {
      lines.push(`    expressions: {`);
      lines.push(exprLines);
      lines.push(`    },`);
    }
    lines.push(`  },`);
  }

  lines.push('};');
  lines.push('');
  lines.push('/** Groups all variation keys by base race_class key */');
  lines.push('const POOL_VARIATIONS = {');
  for (const [bk, keys] of Object.entries(byBase)) {
    lines.push(`  '${bk}': [${keys.map(k => `'${k}'`).join(', ')}],`);
  }
  lines.push('};');
  lines.push('');
  lines.push('module.exports = { POOL_ASSET_MAP, POOL_VARIATIONS };');

  const outPath = path.join(POOL_DIR, 'pool-asset-map.js');
  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`\nAsset map written: ${path.relative(process.cwd(), outPath)}`);
  console.log(`  Entries: ${entries.length} fichas with portraits`);
}

async function main() {
  const args         = process.argv.slice(2);
  const getArg       = (f, d = null) => { const i = args.indexOf(f); return (i !== -1 && args[i + 1]) ? args[i + 1] : d; };
  const hasFlag      = f => args.includes(f);

  const dryRun          = hasFlag('--dry-run');
  const listMode        = hasFlag('--list');
  const resume          = hasFlag('--resume');
  const portraitOnly    = hasFlag('--portrait-only');
  const expressionsOnly = hasFlag('--expressions-only');
  const assetMapOnly    = hasFlag('--generate-asset-map');
  const singleChar      = getArg('--character');
  const limit           = parseInt(getArg('--limit', '0'), 10);
  const numVariations   = parseInt(getArg('--variations', '1'), 10);

  if (assetMapOnly) {
    generateAssetMap();
    process.exit(0);
  }

  const allChars = buildPermutations(numVariations);

  if (listMode) {
    const varInfo = numVariations > 1 ? ` (${numVariations} variations each)` : '';
    console.log(`\n${'KEY'.padEnd(28)} RACE           CLASS`);
    console.log('─'.repeat(56));
    for (const c of allChars) {
      console.log(`${c.key.padEnd(28)} ${c.race.padEnd(14)} ${c.cls}`);
    }
    const exprTotal = allChars.length * Object.keys(EXPRESSIONS).length;
    console.log(`\nBase combos : ${Object.keys(RACE_POOL).length} races × ${Object.keys(CLASS_POOL).length} classes = ${Object.keys(RACE_POOL).length * Object.keys(CLASS_POOL).length}`);
    console.log(`Variations  : ×${numVariations}`);
    console.log(`Total fichas: ${allChars.length}${varInfo}`);
    console.log(`Total imgs  : ${allChars.length} portraits + ${exprTotal} expressions = ${allChars.length + exprTotal}`);
    process.exit(0);
  }

  let targets = singleChar
    ? allChars.filter(c => c.key === singleChar)
    : allChars;

  if (singleChar && targets.length === 0) {
    console.error(`Unknown character key "${singleChar}". Run --list to see options.`);
    process.exit(1);
  }

  if (limit > 0) targets = targets.slice(0, limit);

  const exprCount   = portraitOnly ? 0 : Object.keys(EXPRESSIONS).length;
  const imgPerChar  = (expressionsOnly ? 0 : 1) + exprCount;
  const totalImages = targets.length * imgPerChar;

  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║   TORRE — Pool Generator (Flujo 1+2 v8)        ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log(`  Fichas     : ${targets.length} (of ${allChars.length} total)`);
  console.log(`  Variations : ${numVariations} per race×class`);
  console.log(`  Per char   : ${expressionsOnly ? 0 : 1} portrait + ${exprCount} expressions = ${imgPerChar} imgs`);
  console.log(`  Total imgs : ${totalImages}`);
  console.log(`  Portraits  : ${expressionsOnly ? 'SKIP' : 'YES (v8 hires)'}`);
  console.log(`  Expressions: ${portraitOnly ? 'SKIP' : 'YES (9 — FaceDetailer cfg=4.0, denoise=0.45)'}`);
  console.log(`  Seeds      : DETERMINISTIC (sha256 per key)`);
  console.log(`  Resume     : ${resume ? 'ON' : 'OFF'}`);
  console.log(`  Output     : ${path.relative(process.cwd(), POOL_DIR)}`);
  console.log('');

  if (dryRun) {
    console.log('DRY RUN — no images will be generated. Fichas que se procesarían:\n');
    targets.forEach((c, i) => console.log(`  ${String(i + 1).padStart(3)}. ${c.key.padEnd(28)} seed=${c.seed}`));
    console.log('');
    process.exit(0);
  }

  process.stdout.write('Connecting to ComfyUI... ');
  const ping = await fetch(`${COMFY_URL}/system_stats`).catch(e => { throw new Error(`Cannot reach ComfyUI: ${e.message}`); });
  if (!ping.ok) throw new Error(`ComfyUI HTTP ${ping.status}`);
  console.log('OK\n');

  fs.mkdirSync(POOL_DIR, { recursive: true });
  const index = resume ? loadIndex() : {};
  const t0    = Date.now();

  log(`Starting: ${targets.length} fichas`);
  log('Ctrl+C to pause — re-run with --resume to continue\n');

  let done = 0;
  for (const char of targets) {
    log(`(${++done}/${targets.length})`);
    try {
      await processCharacter(char, { resume, portraitOnly, expressionsOnly }, index);
    } catch (err) {
      log(`FATAL error on ${char.key}: ${err.message}`);
      saveIndex(index);
    }
  }

  const total = (Date.now() - t0) / 1000;
  console.log(`\n═══ Done in ${(total / 60).toFixed(1)} min ═══`);
  console.log(`  Index: ${path.relative(process.cwd(), INDEX_FILE)}`);

  const completed = Object.values(index).filter(c => c.done).length;
  console.log(`  Completed fichas: ${completed}/${targets.length}`);

  if (!portraitOnly) {
    generateAssetMap();
  }
}

main().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
