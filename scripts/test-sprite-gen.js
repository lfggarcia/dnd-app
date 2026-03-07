#!/usr/bin/env node
/**
 * scripts/test-sprite-gen.js
 *
 * Integrity test: ONE base sprite (txt2img) + 4 idle frames (img2img).
 * Tests full animation-cycle consistency: f0→f1→f2→f3 all share the same base.
 * Saves all PNGs + a full request/response log.
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

// ── Model / LoRA config ────────────────────────────────────────────────────
// ⚠️  IMPORTANT: This LoRA is trained on Illustrious. Change CHECKPOINT_NAME
//    to an Illustrious-based model (e.g. 'illustriousXL_v01.safetensors').
//    Using a realistic checkpoint (perfectWorld) with this LoRA will give bad results.
const CHECKPOINT_NAME = 'perfectWorld_v6Baked.safetensors'; // ← swap to Illustrious checkpoint
const LORA_NAME       = 'epicSevenSprites_v1.safetensors';  // ← exact filename in ComfyUI/models/loras/
const LORA_STRENGTH   = 0.85;  // 0.0–1.0  (lower = less style influence, try 0.7–0.9)

// ── Visual appeal level ────────────────────────────────────────────────────
// Controls how revealing/visually attractive the character design is.
// 0.0 = fully clothed, SFW game art
// 0.25 = light fantasy appeal: stylized figure, elegant revealing armor (current)
// 0.5  = noticeably revealing, midriff/legs, bold design
// 1.0  = maximum — not recommended publicly
const VISUAL_APPEAL_LEVEL = 0.100;

// Prompt suffixes injected based on VISUAL_APPEAL_LEVEL
function appealPrompt() {
  if (VISUAL_APPEAL_LEVEL <= 0)   return '';
  if (VISUAL_APPEAL_LEVEL < 0.35) return ', elegant revealing dark fantasy armor, stylized attractive figure, tasteful exposed skin, alluring character design';
  if (VISUAL_APPEAL_LEVEL < 0.65) return ', revealing dark fantasy armor, bare midriff, exposed legs, bold seductive character design, suggestive pose';
  return ', skimpy fantasy armor, very revealing outfit, highly seductive pose, explicit character design';
}

// Animation frames: attack action — dramatic anatomical poses for maximum pose variation.
// Idle is the worst test case (micro-movements invisible at this scale).
// Attack gives the model unambiguous geometric instructions (arm angles, weapon angle)
// which is what img2img needs to produce perceptibly different frames.
const IDLE_FRAMES = [
  { id: 'f0', pose: 'attack windup, both feet planted wide, knees bent, right arm pulled back behind torso, weapon held horizontal at hip level, left arm raised for balance, body coiled ready to strike' },
  { id: 'f1', pose: 'attack release, right arm swinging forward at chest height, weapon angled 45 degrees downward, body rotating at waist, left foot stepping forward, torso twisted' },
  { id: 'f2', pose: 'attack impact, right arm fully extended forward, weapon pointing toward viewer, body lunging forward, left arm swung back as counterbalance, weight on front foot' },
  { id: 'f3', pose: 'attack followthrough, right arm swinging downward past hip, weapon tip pointing at ground, body upright recovering balance, weight shifting back to center' },
];

const NEGATIVE =
  '(worst quality, low quality:1.4), blurry, deformed, bad anatomy, extra limbs, ' +
  'watermark, text, logo, signature, multiple characters, duplicate, clone';

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

// Upload a PNG buffer to ComfyUI's input folder so LoadImage can access it.
// Returns the filename ComfyUI assigned (may differ if a name collision is resolved).
async function uploadToComfyInput(buf, desiredFilename) {
  const FormData = (await import('node:buffer')).Blob ? globalThis.FormData : undefined;
  // Node 18+ has FormData globally
  const form = new globalThis.FormData();
  form.append('image', new Blob([buf], { type: 'image/png' }), desiredFilename);
  form.append('overwrite', 'true');
  const r = await fetch(`${COMFY_URL}/upload/image`, { method: 'POST', body: form });
  const text = await r.text();
  log('UPLOAD_RESPONSE', text);
  if (!r.ok) throw new Error(`Upload failed ${r.status}: ${text}`);
  const parsed = JSON.parse(text);
  return parsed.name; // filename as stored in ComfyUI's input dir
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
function assertValidPng(buf, name) {
  if (buf.length < PNG_MAGIC.length || !PNG_MAGIC.every((b, i) => buf[i] === b))
    throw new Error(`${name}: invalid PNG magic bytes`);
  if (buf.length < 10_000)
    throw new Error(`${name}: file too small (${buf.length} B)`);
}

// ── Workflow builders ──────────────────────────────────────────────────────
// Node layout:
//   "1"  CheckpointLoaderSimple
//   "L"  LoraLoader          — injects LoRA into model + clip
//   "CS" CLIPSetLastLayer    — CLIP skip 2 (required by E7Sprites LoRA)
//   "2"  CLIPTextEncode positive
//   "3"  CLIPTextEncode negative
//   "4"  EmptyLatentImage    (txt2img) / "10"+"11" LoadImage+VAEEncode (img2img)
//   "5"  KSampler
//   "6"  VAEDecode  "7" ImageScaleToTotalPixels  "8" SaveImage

function buildTxt2Img(seed) {
  const positiveText =
    `E7SPRITES, (masterpiece, best quality), dark fantasy RPG sprite of an undead skeleton warrior, ` +
    `full body view, front-facing neutral idle stance, 2D game sprite art, epic seven art style, ` +
    `dark moody background, dramatic lighting, highly detailed, no text, no watermark` +
    appealPrompt();
  return {
    '1':  { inputs: { ckpt_name: CHECKPOINT_NAME }, class_type: 'CheckpointLoaderSimple' },
    'L':  { inputs: { lora_name: LORA_NAME, strength_model: LORA_STRENGTH, strength_clip: LORA_STRENGTH, model: ['1', 0], clip: ['1', 1] }, class_type: 'LoraLoader' },
    'CS': { inputs: { stop_at_clip_layer: -2, clip: ['L', 1] }, class_type: 'CLIPSetLastLayer' },
    '2':  { inputs: { text: positiveText, clip: ['CS', 0] }, class_type: 'CLIPTextEncode' },
    '3':  { inputs: { text: NEGATIVE, clip: ['CS', 0] }, class_type: 'CLIPTextEncode' },
    '4':  { inputs: { width: 512, height: 768, batch_size: 1 }, class_type: 'EmptyLatentImage' },
    '5':  {
      inputs: {
        seed, steps: 30, cfg: 7,
        sampler_name: 'euler_ancestral', scheduler: 'karras', denoise: 1,
        model: ['L', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0],
      },
      class_type: 'KSampler',
    },
    '6':  { inputs: { samples: ['5', 0], vae: ['1', 2] }, class_type: 'VAEDecode' },
    '7':  { inputs: { upscale_method: 'nearest-exact', megapixels: 1, resolution_steps: 1, image: ['6', 0] }, class_type: 'ImageScaleToTotalPixels' },
    '8':  { inputs: { filename_prefix: 'test-base', images: ['7', 0] }, class_type: 'SaveImage' },
  };
}

function buildImg2Img(baseFilename, prompt, seed) {
  return {
    '1':  { inputs: { ckpt_name: CHECKPOINT_NAME }, class_type: 'CheckpointLoaderSimple' },
    'L':  { inputs: { lora_name: LORA_NAME, strength_model: LORA_STRENGTH, strength_clip: LORA_STRENGTH, model: ['1', 0], clip: ['1', 1] }, class_type: 'LoraLoader' },
    'CS': { inputs: { stop_at_clip_layer: -2, clip: ['L', 1] }, class_type: 'CLIPSetLastLayer' },
    '2':  { inputs: { text: prompt, clip: ['CS', 0] }, class_type: 'CLIPTextEncode' },
    '3':  { inputs: { text: NEGATIVE, clip: ['CS', 0] }, class_type: 'CLIPTextEncode' },
    '10': { inputs: { image: baseFilename, upload: 'image' }, class_type: 'LoadImage' },
    '11': { inputs: { pixels: ['10', 0], vae: ['1', 2] }, class_type: 'VAEEncode' },
    '5':  {
      inputs: {
        seed, steps: 30, cfg: 7,
        sampler_name: 'euler_ancestral', scheduler: 'karras', denoise: 0.55,
        model: ['L', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['11', 0],
      },
      class_type: 'KSampler',
    },
    '6':  { inputs: { samples: ['5', 0], vae: ['1', 2] }, class_type: 'VAEDecode' },
    '7':  { inputs: { upscale_method: 'nearest-exact', megapixels: 1, resolution_steps: 1, image: ['6', 0] }, class_type: 'ImageScaleToTotalPixels' },
    '8':  { inputs: { filename_prefix: 'test-anim', images: ['7', 0] }, class_type: 'SaveImage' },
  };
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n=== Sprite Animation Integrity Test ===');
  console.log('  Enemy  : witcher woman');
  console.log('  Action : attack  (4 frames — windup → release → impact → followthrough)');
  console.log(`  Log    : ${path.relative(process.cwd(), logFile)}\n`);

  log('TEST_START', { enemy: 'witcher woman', action: 'attack', frames: IDLE_FRAMES.map(f => f.id), comfyUrl: COMFY_URL });

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

  // Upload base sprite to ComfyUI input folder so LoadImage can access it
  process.stdout.write('  Uploading to ComfyUI input ... ');
  const inputFilename = await uploadToComfyInput(baseBuf, `sprite_input_${Date.now()}.png`);
  console.log(`OK  (input/${inputFilename})`);

  // 3. PHASE 2 — img2img (all 4 idle frames, same base sprite)
  const BASE_PROMPT =
    'E7SPRITES, (masterpiece, best quality), dark fantasy RPG sprite of an witcher woman, ' +
    'exact same character as reference image, identical color palette, same eye color, same weapon design, ' +
    'same outfit and armor, consistent art style, 2D game sprite art, epic seven art style, ' +
    'dark moody background, dramatic lighting, highly detailed, no text, no watermark' +
    appealPrompt();

  const frameResults = [];

  // Sequential seeds anchored to the base seed: frames stay in the same "neighbourhood"
  // of the latent space, which dramatically reduces color/detail drift between frames.
  for (const [frameIdx, frame] of IDLE_FRAMES.entries()) {
    const seedFrame  = (seedBase + frameIdx + 1) >>> 0; // wrap at 32-bit
    const framePrompt = `${BASE_PROMPT}, ${frame.pose}`;
    const label       = `IMG2IMG:skeleton_idle_${frame.id}`;

    console.log(`\n[PHASE 2 — ${frame.id}] img2img  (seed ${seedFrame})`);
    console.log(`  Pose       : ${frame.pose.slice(0, 64)}…`);
    console.log(`  Input file : ${inputFilename}`);
    console.log(`  Denoise    : 0.40`);

    const pid = await queueWorkflow(label, buildImg2Img(inputFilename, framePrompt, seedFrame));
    console.log(`  prompt_id  : ${pid}`);

    const { entry, elapsed } = await pollUntilDone(`img2img-${frame.id}`, pid);
    console.log(`\n  Done in ${(elapsed / 1000).toFixed(1)}s`);

    const imgs = entry.outputs?.['8']?.images;
    if (!imgs?.length) throw new Error(`No images in img2img history for ${frame.id}`);
    const { filename: animFile, subfolder: animSub } = imgs[0];
    log(`IMG2IMG_OUTPUT :: ${frame.id}`, { filename: animFile, subfolder: animSub, seed: seedFrame, elapsed_s: (elapsed / 1000).toFixed(1) });
    console.log(`  ComfyUI file : ${animFile}`);

    process.stdout.write(`  Downloading ${frame.id} ... `);
    const frameBuf  = await fetchOutputBlob(animFile, animSub);
    const frameName = `skeleton_idle_${frame.id}.png`;
    assertValidPng(frameBuf, frameName);
    const framePath = path.join(OUT_DIR, frameName);
    fs.writeFileSync(framePath, frameBuf);
    console.log(`OK  (${(frameBuf.length / 1024).toFixed(1)} KB) -> ${path.relative(process.cwd(), framePath)}`);

    frameResults.push({ id: frame.id, elapsed, kb: frameBuf.length / 1024, path: framePath });
  }

  // 4. Summary
  const totalAnimMs = frameResults.reduce((s, f) => s + f.elapsed, 0);
  log('TEST_SUCCESS', {
    txt2img_s:    (t1 / 1000).toFixed(1),
    img2img_total_s: (totalAnimMs / 1000).toFixed(1),
    base_kb:      (baseBuf.length / 1024).toFixed(1),
    frames:       frameResults.map(f => ({ id: f.id, elapsed_s: (f.elapsed / 1000).toFixed(1), kb: f.kb.toFixed(1) })),
  });

  const sep = '─'.repeat(56);
  console.log(`\n${sep}`);
  console.log('TEST PASSED  —  full idle animation cycle');
  console.log(sep);
  console.log(`  Base sprite (txt2img) : ${(t1 / 1000).toFixed(1)}s  →  ${path.relative(process.cwd(), basePath)}`);
  for (const f of frameResults) {
    console.log(`  idle ${f.id} (img2img)  : ${(f.elapsed / 1000).toFixed(1)}s  →  ${path.relative(process.cwd(), f.path)}`);
  }
  console.log(`  Total                : ${((t1 + totalAnimMs) / 1000).toFixed(1)}s`);
  console.log(`  Full log             : ${path.relative(process.cwd(), logFile)}`);
  console.log('');
  console.log('  Review all 5 images (base + f0–f3) for visual consistency.');
  console.log('  Check: same character, same lighting, coherent motion, no drift.\n');
  logStream.end();
}

main().catch(err => {
  log('TEST_FAILED', err.message);
  logStream.end();
  console.error('\nTEST FAILED\n', err.message);
  process.exit(1);
});
