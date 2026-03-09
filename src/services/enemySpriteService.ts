// ─── Types ─────────────────────────────────────────────────────────────────
export type EnemyType =
  // Skeletons
  | 'skeleton'
  | 'skeleton_archer'
  | 'skeleton_knight'
  | 'skeleton_mage'
  // Goblins
  | 'goblin'
  | 'goblin_veteran'
  | 'goblin_raider'
  | 'goblin_champion'
  | 'goblin_shaman'
  // Undead
  | 'zombie'
  | 'ghoul'
  | 'wight'
  | 'banshee'
  | 'mummy'
  | 'vampire'
  // Creatures
  | 'rat'
  | 'dire_rat'
  | 'giant_spider'
  | 'dire_wolf'
  | 'harpy'
  | 'gnoll'
  | 'werewolf'
  // Humanoids
  | 'cultist'
  | 'orc'
  | 'hobgoblin'
  | 'knight'
  | 'dark_knight'
  | 'ogre'
  | 'berserker'
  // Demons & Bosses
  | 'demon'
  | 'imp'
  | 'troll'
  | 'lich'
  | 'dragon_wyrmling';

export type AnimationType = 'idle' | 'run' | 'attack' | 'damage' | 'death';

export interface SpriteSet {
  /** base64 data URI per animation state */
  idle: string;
  run: string;
  attack: string;
  damage: string;
  death: string;
}

export interface EnemySprite {
  /** base64 data URI of the generated sprite (base / idle) */
  uri: string;
  generatedAt: number;
  /** Full animation set — populated after preloadFloorSprites() */
  animations?: SpriteSet;
}

// ─── ComfyUI config ─────────────────────────────────────────────────────────
// Android emulator → 10.0.2.2 (NAT loopback to host Mac)
// iOS Simulator    → localhost (direct loopback to host Mac)
// Physical device (same WiFi) → 192.168.0.20
import { Platform } from 'react-native';

const COMFY_HOST = Platform.select({
  android: '10.0.2.2',    // Android emulator NAT loopback → host Mac
  ios: '192.168.0.17',    // iOS: direct LAN IP (simulator uses localhost but LAN IP also works)
  default: '192.168.0.17',
});
const COMFY_BASE_URL = `http://${COMFY_HOST}:8089`;
const COMFY_CLIENT_ID = 'dnd3-sprite-gen';
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 80;

// ─── Prompt builders ─────────────────────────────────────────────────────────
const ENEMY_DESC: Record<EnemyType, string> = {
  // Skeletons
  skeleton:          'undead skeleton warrior',
  skeleton_archer:   'undead skeleton archer with bow',
  skeleton_knight:   'armored undead skeleton knight with shield',
  skeleton_mage:     'undead skeleton mage holding a glowing staff',
  // Goblins
  goblin:            'small green goblin warrior with a rusty sword',
  goblin_veteran:    'scarred veteran goblin fighter with leather armor',
  goblin_raider:     'goblin raider with twin curved blades',
  goblin_champion:   'large powerful goblin champion with war axe',
  goblin_shaman:     'goblin shaman with magical totems and bone staff',
  // Undead
  zombie:            'shambling undead zombie with outstretched grasping arms',
  ghoul:             'feral undead ghoul with elongated claws and glowing eyes',
  wight:             'ancient wight undead commander in corroded dark armor',
  banshee:           'translucent wailing banshee spirit with ghostly flowing robes and hollow screaming face',
  mummy:             'ancient mummy wrapped in rotting bandages with glowing curse runes and crumbling sarcophagus armor',
  vampire:           'elegant vampire lord in dark noble coat with pale skin, crimson eyes and bared fangs',
  // Creatures
  rat:               'giant dungeon rat with sharp claws',
  dire_rat:          'massive dire rat with glowing red eyes',
  giant_spider:      'enormous dungeon giant spider with venom dripping fangs',
  dire_wolf:         'massive dire wolf with bared snarling fangs',
  harpy:             'harpy monster with large feathered wings, taloned claws, and wild matted hair',
  gnoll:             'gnoll hyena-headed humanoid warrior with spotted fur, jagged spear and hyena skull trophy',
  werewolf:          'werewolf half-transformed warrior, gray fur erupting through torn clothing, massive claws',
  // Humanoids
  cultist:           'dark robed cultist with glowing sigils',
  orc:               'large orc warrior with crude plate armor and battle axe',
  hobgoblin:         'disciplined hobgoblin soldier with military-grade armor',
  knight:            'corrupted armored dark knight',
  dark_knight:       'black-armored dark knight with a demonic visor, two-handed shadow blade trailing dark energy',
  ogre:              'massive ogre with thick gray-green hide, crude wooden club and dirty hide loincloth',
  berserker:         'armored human berserker warrior with wild eyes, battle rage, twin handaxes raised',
  // Demons & Bosses
  demon:             'small dungeon imp demon with claws',
  imp:               'tiny red winged imp demon with barbed tail, mischievous grin and small pitchfork',
  troll:             'hulking troll with enormous claws and regenerating wounds',
  lich:              'ancient undead lich sorcerer with dark crown',
  dragon_wyrmling:   'young black dragon wyrmling, small fierce serpentine dragon with acid-dripping jaws and dark scales',
};

const NEGATIVE_PROMPT =
  '(worst quality, low quality:1.4), photorealistic, photograph, 3d render, blurry, ' +
  'deformed, bad anatomy, extra limbs, watermark, text, logo, signature, nsfw';

const ANIM_PROMPT: Record<AnimationType, string> = {
  idle:   'standing neutral idle pose, calm, weight on both feet',
  run:    'running forward pose, dynamic motion, legs mid-stride',
  attack: 'attacking pose, weapon raised or lunging forward aggressively',
  damage: 'hit reaction pose, recoiling backward, showing pain',
  death:  'falling or collapsed death pose, motionless on ground',
};

function buildBasePrompt(enemy: EnemyType): string {
  const desc = ENEMY_DESC[enemy] ?? enemy.replace(/_/g, ' ');
  return [
    `(masterpiece, best quality), dark fantasy RPG sprite of a ${desc}.`,
    'Full body view, front-facing neutral stance.',
    'Digital painting, dungeon crawler game art style, D&D inspired.',
    'Dark moody background, dramatic lighting, highly detailed.',
    'No text, no watermark, no UI.',
  ].join(' ');
}

function buildAnimPrompt(enemy: EnemyType, anim: AnimationType): string {
  const desc = ENEMY_DESC[enemy] ?? enemy.replace(/_/g, ' ');
  return [
    `(masterpiece, best quality), dark fantasy RPG sprite of a ${desc},`,
    `${ANIM_PROMPT[anim]}.`,
    'Same character, same style, same color palette as reference image.',
    'Full body view, digital painting, dungeon crawler game art, D&D inspired.',
    'Dark moody background, dramatic lighting, highly detailed.',
    'No text, no watermark, no UI.',
  ].join(' ');
}

// ─── ComfyUI API helpers ─────────────────────────────────────────────────────
type ComfyPromptResponse = { prompt_id: string };
type ComfyHistoryImage = { filename: string; subfolder: string; type: string };
type ComfyHistoryEntry = {
  status?: { completed?: boolean; status_str?: string };
  outputs?: Record<string, { images?: ComfyHistoryImage[] }>;
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function queueWorkflow(workflow: Record<string, unknown>): Promise<string> {
  const response = await fetch(`${COMFY_BASE_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: COMFY_CLIENT_ID }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[ComfyUI] Queue error ${response.status}: ${text}`);
  }
  const json = (await response.json()) as ComfyPromptResponse;
  return json.prompt_id;
}

async function pollHistory(promptId: string): Promise<ComfyHistoryEntry> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const res = await fetch(`${COMFY_BASE_URL}/history/${promptId}`);
    if (!res.ok) continue;
    const history = (await res.json()) as Record<string, ComfyHistoryEntry>;
    const entry = history[promptId];
    if (entry?.status?.completed) return entry;
    if (entry?.status?.status_str === 'error') throw new Error('[ComfyUI] Generation failed on server');
  }
  throw new Error('[ComfyUI] Timeout waiting for sprite generation');
}

async function fetchImageAsBase64(filename: string, subfolder: string): Promise<string> {
  const params = new URLSearchParams({ filename, subfolder, type: 'output' });
  const res = await fetch(`${COMFY_BASE_URL}/view?${params.toString()}`);
  if (!res.ok) throw new Error(`[ComfyUI] Image fetch error ${res.status}`);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('[ComfyUI] Failed to read sprite blob'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Copy a ComfyUI output image into the input folder so img2img LoadImage can reference it.
 * Fetches the raw blob directly from /view (no base64 roundtrip) and POSTs to /upload/image.
 */
async function copyOutputToInput(filename: string, subfolder: string): Promise<string> {
  const viewParams = new URLSearchParams({ filename, subfolder, type: 'output' });
  const imageRes = await fetch(`${COMFY_BASE_URL}/view?${viewParams.toString()}`);
  if (!imageRes.ok) throw new Error(`[ComfyUI] Cannot fetch output image ${filename}`);
  const blob = await imageRes.blob();

  const formData = new FormData();
  // RN FormData typings omit the optional filename 3rd arg; it works at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (formData as any).append('image', blob, filename);
  formData.append('overwrite', 'true');

  const uploadRes = await fetch(`${COMFY_BASE_URL}/upload/image`, {
    method: 'POST',
    body: formData,
  });
  if (!uploadRes.ok) throw new Error(`[ComfyUI] Upload error ${uploadRes.status}`);
  const json = (await uploadRes.json()) as { name: string };
  return json.name;
}

// ─── Workflow builders ────────────────────────────────────────────────────────

/** Step 1: text→image — generate the base sprite */
function buildTxt2ImgWorkflow(prompt: string, seed: number): Record<string, unknown> {
  return {
    '1': { inputs: { ckpt_name: 'perfectWorld_v6Baked.safetensors' }, class_type: 'CheckpointLoaderSimple' },
    '2': { inputs: { text: prompt, clip: ['1', 1] }, class_type: 'CLIPTextEncode' },
    '3': { inputs: { text: NEGATIVE_PROMPT, clip: ['1', 1] }, class_type: 'CLIPTextEncode' },
    '4': { inputs: { width: 512, height: 768, batch_size: 1 }, class_type: 'EmptyLatentImage' },
    '5': {
      inputs: {
        seed, steps: 25, cfg: 7,
        sampler_name: 'dpm_2_ancestral', scheduler: 'karras', denoise: 1,
        model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0],
      },
      class_type: 'KSampler',
    },
    '6': { inputs: { samples: ['5', 0], vae: ['1', 2] }, class_type: 'VAEDecode' },
    '7': { inputs: { upscale_method: 'nearest-exact', megapixels: 1, resolution_steps: 1, image: ['6', 0] }, class_type: 'ImageScaleToTotalPixels' },
    '8': { inputs: { filename_prefix: 'dnd3-sprite-base', images: ['7', 0] }, class_type: 'SaveImage' },
  };
}

/** Step 2: image→image — generate animation variant from base sprite */
function buildImg2ImgWorkflow(
  prompt: string,
  seed: number,
  baseImageFilename: string,
  denoise = 0.65,
): Record<string, unknown> {
  return {
    '1': { inputs: { ckpt_name: 'perfectWorld_v6Baked.safetensors' }, class_type: 'CheckpointLoaderSimple' },
    '2': { inputs: { text: prompt, clip: ['1', 1] }, class_type: 'CLIPTextEncode' },
    '3': { inputs: { text: NEGATIVE_PROMPT, clip: ['1', 1] }, class_type: 'CLIPTextEncode' },
    '10': { inputs: { image: baseImageFilename, upload: 'image' }, class_type: 'LoadImage' },
    '11': { inputs: { pixels: ['10', 0], vae: ['1', 2] }, class_type: 'VAEEncode' },
    '5': {
      inputs: {
        seed, steps: 25, cfg: 7,
        sampler_name: 'dpm_2_ancestral', scheduler: 'karras', denoise,
        model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['11', 0],
      },
      class_type: 'KSampler',
    },
    '6': { inputs: { samples: ['5', 0], vae: ['1', 2] }, class_type: 'VAEDecode' },
    '7': { inputs: { upscale_method: 'nearest-exact', megapixels: 1, resolution_steps: 1, image: ['6', 0] }, class_type: 'ImageScaleToTotalPixels' },
    '8': { inputs: { filename_prefix: 'dnd3-sprite-anim', images: ['7', 0] }, class_type: 'SaveImage' },
  };
}

async function runWorkflowAndFetch(workflow: Record<string, unknown>): Promise<{ base64: string; filename: string; subfolder: string }> {
  const promptId = await queueWorkflow(workflow);
  const entry = await pollHistory(promptId);
  const images = entry.outputs?.['8']?.images;
  if (!images || images.length === 0) throw new Error('[ComfyUI] No sprite output found');
  const { filename, subfolder } = images[0];
  const base64 = await fetchImageAsBase64(filename, subfolder);
  return { base64, filename, subfolder };
}

// ─── In-memory sprite cache ─────────────────────────────────────────────────
const spriteCache = new Map<EnemyType, EnemySprite>();
/** Stores the ComfyUI output filename/subfolder for each base sprite — used by img2img */
const spriteComfyMeta = new Map<EnemyType, { filename: string; subfolder: string }>();

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Step 1: Generate the base (idle/neutral) sprite for an enemy via txt2img.
 * Returns and caches a single EnemySprite with just the base URI.
 * NEVER call during active combat — call from floor loading phase.
 */
export async function getEnemySprite(enemy: EnemyType): Promise<EnemySprite> {
  const cached = spriteCache.get(enemy);
  if (cached) return cached;

  const prompt = buildBasePrompt(enemy);
  const seed = Math.floor(Math.random() * 2 ** 32);

  __DEV__ && console.log('[Sprite] Generating base sprite for:', enemy);
  const { base64, filename, subfolder } = await runWorkflowAndFetch(buildTxt2ImgWorkflow(prompt, seed));

  spriteComfyMeta.set(enemy, { filename, subfolder });
  const sprite: EnemySprite = { uri: base64, generatedAt: Date.now() };
  spriteCache.set(enemy, sprite);
  return sprite;
}

/**
 * Step 2: Generate full animation set (idle/run/attack/damage/death) for an enemy.
 * Uses the cached base sprite as img2img reference. Mutates the cached entry.
 * NEVER call during active combat — call from floor loading phase after getEnemySprite().
 */
export async function generateAnimationSet(enemy: EnemyType): Promise<SpriteSet> {
  const base = await getEnemySprite(enemy);

  // Copy the base sprite from ComfyUI output → input so LoadImage can reference it
  const meta = spriteComfyMeta.get(enemy);
  if (!meta) throw new Error(`[ComfyUI] No ComfyUI file metadata for ${enemy} — call getEnemySprite() first`);
  const uploadedFilename = await copyOutputToInput(meta.filename, meta.subfolder);
  __DEV__ && console.log('[Sprite] Base sprite copied to ComfyUI input:', uploadedFilename);

  const animations: AnimationType[] = ['idle', 'run', 'attack', 'damage', 'death'];
  const result: Partial<SpriteSet> = {};

  // Run animations sequentially to avoid overloading the GPU
  for (const anim of animations) {
    __DEV__ && console.log('[Sprite] Generating animation:', anim, 'for', enemy);
    const prompt = buildAnimPrompt(enemy, anim);
    const seed = Math.floor(Math.random() * 2 ** 32);
    // idle: low denoise (stay close to base), combat anims: higher
    const denoise = anim === 'idle' ? 0.45 : 0.65;
    const { base64 } = await runWorkflowAndFetch(buildImg2ImgWorkflow(prompt, seed, uploadedFilename, denoise));
    result[anim] = base64;
  }

  const spriteSet = result as SpriteSet;

  // Update cache with full animation set
  spriteCache.set(enemy, { ...base, animations: spriteSet });
  return spriteSet;
}

/**
 * Pre-generate base sprites + full animation sets for all enemies on a floor.
 * Step 1 (txt2img base) runs first for every unique enemy,
 * then Step 2 (img2img animations) runs sequentially to avoid VRAM pressure.
 * Silently skips enemies whose generation fails.
 */
export async function preloadFloorSprites(enemies: EnemyType[]): Promise<void> {
  const unique = [...new Set(enemies)];

  // Step 1: generate all base sprites in parallel (txt2img)
  await Promise.allSettled(unique.map(e => getEnemySprite(e)));

  // Step 2: generate animation sets sequentially (img2img, VRAM sensitive)
  for (const e of unique) {
    try {
      await generateAnimationSet(e);
    } catch (err) {
      __DEV__ && console.warn('[Sprite] Animation set failed for', e, err);
    }
  }
}

/**
 * Check if a sprite is already in cache (no API call needed).
 */
export function hasCachedSprite(enemy: EnemyType): boolean {
  return spriteCache.has(enemy);
}

/**
 * Get sprite tier for a given cycle, respecting floor cap.
 * Implements: evolutionTier = floor(cycle / 5), capped by floor/10
 */
export function getEnemyEvolutionTier(cycle: number, floorNumber: number): number {
  const evolutionTier = Math.floor(cycle / 5);
  const maxTier = Math.floor(floorNumber / 10);
  return Math.min(evolutionTier, maxTier);
}

/**
 * Get the evolved enemy type for a base enemy given a cycle and floor.
 */
export function getEvolvedEnemyType(base: EnemyType, cycle: number, floorNumber: number): EnemyType {
  const tier = getEnemyEvolutionTier(cycle, floorNumber);
  const evolutionTable: Partial<Record<EnemyType, EnemyType[]>> = {
    skeleton:  ['skeleton', 'skeleton_archer', 'skeleton_knight', 'skeleton_mage'],
    goblin:    ['goblin', 'goblin_veteran', 'goblin_raider', 'goblin_champion'],
    zombie:    ['zombie', 'zombie', 'ghoul', 'wight'],
    rat:       ['rat', 'rat', 'dire_rat', 'dire_rat'],
    cultist:   ['cultist', 'cultist', 'dark_knight', 'dark_knight'],
    orc:       ['orc', 'orc', 'hobgoblin', 'ogre'],
    demon:     ['imp', 'imp', 'demon', 'demon'],
    harpy:     ['harpy', 'harpy', 'harpy', 'harpy'],
    gnoll:     ['gnoll', 'gnoll', 'gnoll', 'gnoll'],
    werewolf:  ['werewolf', 'werewolf', 'werewolf', 'werewolf'],
  };
  const chain = evolutionTable[base];
  if (!chain) return base;
  return chain[Math.min(tier, chain.length - 1)];
}
