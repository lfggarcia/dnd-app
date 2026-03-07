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
 *   loras/          748cmSDXL.safetensors
 *                   thiccwithaq-artist-richy-v1_ixl.safetensors
 *                   USNR_STYLE_ILL_V1_lokr3-000024.safetensors
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

// Card-art composition — consistent framing for all enemy illustrations
const CARD_FRAMING  = 'RPG card character illustration, centered full body, portrait card format, character isolated against dark atmospheric background, dramatic side rim lighting, no cropping';

// --- Monster definitions -----------------------------------------------------
// Each entry: desc = what it IS, pose = dominant action/stance for card art.
// Keep poses specific but card-friendly (clear silhouette, front or 3/4 view).
const ENEMIES = {
  // ── Skeletons ──────────────────────────────────────────────────────────────
  skeleton: {
    desc:  'undead skeleton warrior, ancient rusted armor, cracked sword, hollow eye sockets',
    pose:  '3/4 view battle stance, sword raised',
    extra: 'bone dust particles, dark stone crypt background',
    humanoid: false,
  },
  skeleton_archer: {
    desc:  'undead skeleton archer, tattered hood, longbow drawn taut, bony fingers on bowstring',
    pose:  '3/4 view aiming pose, arrow nocked',
    extra: 'arrow glowing faintly, deep shadow background',
    humanoid: false,
  },
  skeleton_knight: {
    desc:  'elite undead skeleton knight, black ornate plate armor, tower shield, flanged mace',
    pose:  'front-facing imposing guard stance, shield raised',
    extra: 'ancient crypt columns, eerie blue torch light',
    humanoid: false,
  },
  skeleton_mage: {
    desc:  'undead skeleton sorcerer, torn dark robes, glowing hollow eye sockets, skull-topped staff',
    pose:  '3/4 casting pose, arcane particles swirling from staff',
    extra: 'glowing purple and black necromantic energy, bone fragments orbiting',
    humanoid: false,
  },

  // ── Goblins ────────────────────────────────────────────────────────────────
  goblin: {
    desc:  'small green goblin fighter, beady yellow eyes, jagged rusty blade, pointed ears',
    pose:  '3/4 crouched aggressive stance, blade forward',
    extra: 'muddy cave wall background, flickering torch',
    humanoid: false,
  },
  goblin_veteran: {
    desc:  'scarred veteran goblin warrior, patched leather armor, dual daggers, battle scars, cunning eyes',
    pose:  '3/4 readied guard stance, daggers drawn',
    extra: 'dim torchlight, cave tunnel background',
    humanoid: false,
  },
  goblin_raider: {
    desc:  'aggressive goblin raider, red war paint, twin curved scimitars, war-scarred face',
    pose:  '3/4 charging attack pose, scimitars raised',
    extra: 'bloodied war paint, dungeon ruins background',
    humanoid: false,
  },
  goblin_champion: {
    desc:  'large brutish goblin champion, massive spiked iron armor, enormous war axe, battle-worn',
    pose:  'front-facing power stance, axe on shoulder',
    extra: 'glowing battle trophies on armor, dark throne room background',
    humanoid: false,
  },
  goblin_shaman: {
    desc:  'goblin shaman, elaborate bone headdress, totem staff of skulls, tribal body markings',
    pose:  '3/4 ritual casting pose, staff raised',
    extra: 'eerie green glow, smoke and fire, dark cave ritual',
    humanoid: false,
  },

  // ── Undead ─────────────────────────────────────────────────────────────────
  zombie: {
    desc:  'shambling undead zombie, rotting tattered burial rags, outstretched grasping arms, decaying grey-blue flesh, sunken dead eyes',
    pose:  'front-facing lunging stance, arms outstretched',
    extra: 'visible necrotic decay, putrid dark mist, dungeon floor',
    humanoid: false,
  },
  ghoul: {
    desc:  'feral undead ghoul, elongated sharp claws, sunken glowing eyes, emaciated twisted body, torn grey skin',
    pose:  '3/4 crouching predatory stance, claws forward',
    extra: 'pale yellow glowing eyes, burial shroud remnants, crypt background',
    humanoid: false,
  },
  wight: {
    desc:  'ancient wight undead commander, corroded dark armor, hollow glowing blue eyes, gaunt withered face, lifedrain clawed gauntlet',
    pose:  'front-facing commanding stance, one gauntlet raised',
    extra: 'necrotic dark energy wisps, cold death aura, ancient crypt',
    humanoid: false,
  },

  // ── Creatures ──────────────────────────────────────────────────────────────
  rat: {
    desc:  'giant dungeon rat, sharp yellowed fangs, matted mangy grey fur, long scaly tail, beady red eyes',
    pose:  'front-facing hissing aggressive pose',
    extra: 'sewer tunnel stone background, dim torch glow',
    humanoid: false,
  },
  dire_rat: {
    desc:  'massive dire rat the size of a large dog, glowing blood-red eyes, scarred battle-worn fur, enormous fangs',
    pose:  '3/4 feral snarling pounce stance',
    extra: 'deep shadow background, dungeon stone floor',
    humanoid: false,
  },
  giant_spider: {
    desc:  'enormous dungeon giant spider, eight hairy legs, multiple glowing eyes cluster, venom dripping from fangs, dark chitinous body',
    pose:  'front-facing stalking stance, legs spread wide',
    extra: 'sticky web silk threads, dripping venom, cave darkness',
    humanoid: false,
  },
  dire_wolf: {
    desc:  'massive dire wolf, thick dark grey fur, bared snarling fangs, glowing yellow eyes, powerful muscular predator build',
    pose:  '3/4 snarling aggressive stance, hackles raised',
    extra: 'dark forest cave background, moonlight shadow',
    humanoid: false,
  },

  // ── Humanoid enemies ───────────────────────────────────────────────────────
  cultist: {
    desc:  'dark-robed male cultist, glowing arcane sigils on robes, ceremonial dagger, hood concealing shadowed face',
    pose:  '3/4 sinister summoning gesture, arms outstretched',
    extra: 'dark ritual eldritch fire, blood sigil ground, villain atmosphere',
    humanoid: true,
  },
  orc: {
    desc:  'large male orc warrior, muscular grey-green skin, prominent lower tusks, crude plate armor, heavy battle axe',
    pose:  '3/4 aggressive battle stance, axe raised',
    extra: 'tribal war paint, dungeon ruin background, savage warrior',
    humanoid: true,
  },
  hobgoblin: {
    desc:  'disciplined male hobgoblin soldier, orange skin, military-grade armor and round shield, shortsword, tactical posture',
    pose:  'front-facing disciplined soldier stance, shield ready',
    extra: 'military precision, organized dark armor, fortress background',
    humanoid: true,
  },
  knight: {
    desc:  'corrupted male fallen dark knight, cracked black plate armor, twisted corrupted holy symbol, greatsword',
    pose:  'front-facing heavy menacing stride, sword lowered',
    extra: 'dark necrotic aura, cursed black flame, forsaken fortress',
    humanoid: true,
  },

  // ── Demons & Bosses ────────────────────────────────────────────────────────
  demon: {
    desc:  'small dungeon imp demon, crimson red skin, leathery bat wings, sharp curved horn, pointed tail, razor claws',
    pose:  '3/4 hovering sneering pose, wings spread',
    extra: 'hellfire embers background, sulfur smoke, dark cave portal',
    humanoid: false,
  },
  troll: {
    desc:  'hulking troll monster, pale greenish warty skin, enormous claws, monstrous hunched build, visible regenerating wounds',
    pose:  'front-facing hunched towering stance, arms wide',
    extra: 'drooling maw, regenerating flesh glow, dark cave background',
    humanoid: false,
  },
  lich: {
    desc:  'ancient undead lich sorcerer, dark ornate bone crown, tattered ceremonial robes, skeletal hands adorned with cursed gemstone rings',
    pose:  '3/4 regal floating pose, death magic swirling from hands',
    extra: 'necrotic green-black death magic, bone fragments orbiting, throne room',
    humanoid: false,
  },

  // ── Extended Undead ────────────────────────────────────────────────────────
  banshee: {
    desc:  'wailing banshee spirit, translucent ethereal ghostly form, billowing tattered pale robes, hollow screaming face',
    pose:  'floating mid-air wailing pose, spectral arms outstretched',
    extra: 'ghostly mist trail, soul particles, haunted crypt background',
    humanoid: false,
  },
  mummy: {
    desc:  'ancient mummy wrapped in rotting bandages, glowing curse runes on wrappings, remnants of crumbling sarcophagus armor',
    pose:  '3/4 shuffling attack stance, bandaged arms raised',
    extra: 'desiccated dust particles, cursed green rune glow, tomb background',
    humanoid: false,
  },
  vampire: {
    desc:  'elegant vampire lord, dark noble coat with crimson lining, pale white skin, solid blood-red eyes, bared elongated fangs',
    pose:  'confident 3/4 aristocratic stance, cape billowing',
    extra: 'blood mist swirling at feet, gothic candelabra background',
    humanoid: true,
    gender: '1man,',
  },

  // ── Creatures ──────────────────────────────────────────────────────────────
  harpy: {
    desc:  'harpy monster, large feathered dark wings, vicious taloned feet, wild tangled hair, feral clawed hands',
    pose:  'mid-air diving attack pose, wings spread wide',
    extra: 'wind feathers scattering, storm cloud background',
    humanoid: false,
  },
  gnoll: {
    desc:  'gnoll hyena-headed humanoid warrior, spotted dark fur, monstrous hyena head with snarling jaws, crude jagged spear, bone trophy necklace',
    pose:  '3/4 aggressive forward lunge, spear raised',
    extra: 'bone fetishes, burning campfire background, smoke',
    humanoid: false,
  },
  werewolf: {
    desc:  'werewolf half-transformation, gray shaggy fur erupting through torn rough clothing, massive elongated claws, wolfen snarling face',
    pose:  'crouching predatory stance, claws slashing forward',
    extra: 'full moon glow, forest clearing background, glowing yellow eyes',
    humanoid: false,
  },

  // ── Humanoids ──────────────────────────────────────────────────────────────
  dark_knight: {
    desc:  'dark knight, black full plate armor with demonic skull visor, two-handed shadow blade trailing dark energy wisps, red eye glow from visor',
    pose:  'front-facing imposing battle stance, sword raised overhead',
    extra: 'shadow tendrils around weapon, dark stone fortress background',
    humanoid: true,
    gender: '1man,',
  },
  ogre: {
    desc:  'massive ogre, thick gray-green warty hide, crude oversized wooden club, dirty hide loincloth, massive gut, small beady eyes',
    pose:  'front-facing hulking stance, club resting on shoulder',
    extra: 'broken ground under feet, dark forest background',
    humanoid: false,
  },
  berserker: {
    desc:  'human berserker warrior, fur-trimmed battle armor, wild battle-rage eyes, blood smeared on face, twin handaxes raised',
    pose:  '3/4 wild berserker charge pose, axes swinging wide',
    extra: 'battle scars, torn war banner, snow-covered battlefield background',
    humanoid: true,
    gender: '1man,',
  },

  // ── Demons ─────────────────────────────────────────────────────────────────
  imp: {
    desc:  'tiny red imp demon, small leathery bat wings, barbed tail, mischievous grin revealing sharp teeth, small trident pitchfork',
    pose:  'hovering mid-air mischievous pose, pitchfork brandished',
    extra: 'hellfire embers sparks, dark sulfur smoke, shadowy dungeon background',
    humanoid: false,
  },

  // ── Boss ───────────────────────────────────────────────────────────────────
  dragon_wyrmling: {
    desc:  'young black dragon wyrmling, small fierce serpentine body, ebony scales, acid-dripping fanged jaws, sharp wing claws',
    pose:  '3/4 rearing attack pose, wings half-spread, jaws open',
    extra: 'acid drip splash, dark swamp lair background, bioluminescent moss',
    humanoid: false,
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
function buildMonsterPrompt({ desc, pose, extra, humanoid }) {
  const extras = extra ? `, ${extra}` : '';

  // Humanoid enemies (cultist, orc, knight…) need explicit male villain framing.
  // Non-humanoid creatures need "no human" to stop the model from adding people.
  const creatureTag = humanoid
    ? 'dark villain character, male, masculine, menacing warrior'
    : 'dark fantasy creature, monster, non-human, no humans, beast';

  const positive = [
    QUALITY_PREFIX,
    'BREAK',
    `${creatureTag}, ${desc}`,
    `${pose}`,
    extras,
    CARD_FRAMING,
    'usnr, 748cmstyle',
  ].filter(Boolean).join(', ');

  const negative = [
    QUALITY_NEG,
    // For non-humanoids: ban human figures entirely.
    // For humanoids: ban cute / bishounen / anime-girl interpretations.
    humanoid
      ? 'cute, chibi, anime girl, female, woman, bishounen, pretty boy, hero, protagonist'
      : 'human, person, anime girl, female, woman, cute, chibi, no creature',
    'multiple subjects, crowd, split panel, text bubble, ui element',
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
