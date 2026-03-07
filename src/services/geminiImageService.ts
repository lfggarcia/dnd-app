// ─── Public type ──────────────────────────────────────────
// Minimal fields needed to build a character portrait prompt.
// Both CharacterDraft (PartyScreen) and CharacterSave (gameRepository)
// satisfy this structurally.
export type CharacterPortraitInput = {
  name: string;
  race: string;
  charClass: string;
  subclass?: string;
  background?: string;
  alignment?: string;
  baseStats: { STR: number; DEX: number; CON: number; INT: number; WIS: number; CHA: number };
};

// ─── Prompt helpers ───────────────────────────────────────

const CLASS_HINTS: Record<string, string> = {
  barbarian: 'rage-fueled warrior',
  bard: 'charismatic performer',
  cleric: 'divine priest',
  druid: 'nature guardian',
  fighter: 'seasoned soldier',
  monk: 'disciplined monk',
  paladin: 'holy knight',
  ranger: 'wilderness hunter',
  rogue: 'cunning rogue',
  sorcerer: 'innate spellcaster',
  warlock: 'pact-bound warlock',
  wizard: 'arcane scholar',
};

const RACE_HINTS: Record<string, string> = {
  dragonborn: 'dragonborn with scales',
  dwarf: 'stocky dwarf',
  elf: 'pointed-eared elf',
  gnome: 'small gnome',
  'half-elf': 'half-elf',
  halfling: 'halfling',
  'half-orc': 'grey-skinned half-orc',
  human: 'human',
  tiefling: 'tiefling with horns',
};

const STAT_FLAVOR: Record<string, string> = {
  STR: 'powerfully built',
  DEX: 'lithe and agile',
  CON: 'hardy and sturdy',
  INT: 'sharp and intelligent-looking',
  WIS: 'with a wise perceptive gaze',
  CHA: 'with a striking charismatic presence',
};

function buildCharacterPrompt(char: CharacterPortraitInput): { positive: string; negative: string } {
  const race = RACE_HINTS[char.race] ?? char.race.replace(/-/g, ' ');
  const cls = CLASS_HINTS[char.charClass] ?? char.charClass;
  const sub = char.subclass ? ` ${char.subclass}` : '';

  const topStat = (Object.entries(char.baseStats) as [string, number][])
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'STR';
  const statFlavor = STAT_FLAVOR[topStat] ?? '';

  const positive = [
    'score_9, score_8_up, score_8, masterpiece, best quality, newest, absurdres',
    'BREAK',
    `1person, solo, ${race} ${cls}${sub}`,
    statFlavor,
    'dynamic portrait, detailed face, expressive eyes, dramatic lighting',
    'dark fantasy RPG, concept art, highly detailed fantasy illustration',
    'dark dungeon atmosphere, bust portrait, dark background',
    'usnr, 748cmstyle',
  ].filter(Boolean).join(', ');

  const negative = [
    'score_6, score_5, score_4, low quality, worst quality',
    'blurry, deformed, bad anatomy, extra limbs, watermark, text, logo, signature',
    'photorealistic, photograph, 3d render, nsfw, multiple people, crowd',
  ].join(', ');

  return { positive, negative };
}

// ─── ComfyUI config ───────────────────────────────────────

// ── ComfyUI URL ──────────────────────────────────────────
// EMULATOR: usa 10.0.2.2 (loopback de la Mac) + socat corriendo en la Mac:
//   brew install socat
//   socat TCP4-LISTEN:8089,fork,reuseaddr TCP4:192.168.0.20:8089
// DISPOSITIVO FÍSICO (mismo WiFi): usa la IP directa 192.168.0.20
const COMFY_BASE_URL = 'http://10.0.2.2:8089'; // ← emulador — cambiar a 192.168.0.20 en dispositivo físico
const COMFY_CLIENT_ID = 'dnd3-portrait-gen';
// Poll every 1.5s, up to 120s total
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 80;

// ─── Workflow builder ─────────────────────────────────────

// ─── Workflow builder — Illustrious / PerfectDeliberate v8 ───────────────────
//
// Node graph (API format):
//   [1] CheckpointLoaderSimple (perfectDeliberate_v8)
//   [2] LoraLoader 748cm (0.5)
//   [3] LoraLoader thiccwithaq (0.7)
//   [4] LoraLoader USNR (0.6)
//   [5] CLIPSetLastLayer (clip_skip -2)
//   [6] CLIPTextEncode (positive)
//   [7] CLIPTextEncode (negative)
//   [8] EmptyLatentImage 832x1216
//   [9] KSampler base (steps 38, cfg 4, dpmpp_2m karras, denoise 1.0)
//  [10] VAEDecode
//  [11] UpscaleModelLoader (4x_remacri)
//  [12] ImageUpscaleWithModel
//  [13] ImageScale -> 1248x1824 (lanczos)
//  [14] VAEEncode
//  [15] KSampler hires (steps 20, cfg 4, denoise 0.55)
//  [16] VAEDecode
//  [17] SaveImage -> dnd3-portrait
//
function buildWorkflow(positiveText: string, negativeText: string, seed: number): Record<string, unknown> {
  return {
    '1':  { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'perfectDeliberate_v8.safetensors' } },
    '2':  { class_type: 'LoraLoader',             inputs: { model: ['1', 0], clip: ['1', 1], lora_name: '748cm_ILL_v1.0.safetensors',            strength_model: 0.5, strength_clip: 0.5 } },
    '3':  { class_type: 'LoraLoader',             inputs: { model: ['2', 0], clip: ['2', 1], lora_name: 'thiccwithaq-artist-v1_ixl.safetensors', strength_model: 0.7, strength_clip: 0.7 } },
    '4':  { class_type: 'LoraLoader',             inputs: { model: ['3', 0], clip: ['3', 1], lora_name: 'USNR_STYLE_ILL_V1.0.safetensors',       strength_model: 0.6, strength_clip: 0.6 } },
    '5':  { class_type: 'CLIPSetLastLayer',       inputs: { clip: ['4', 1], stop_at_clip_layer: -2 } },
    '6':  { class_type: 'CLIPTextEncode',         inputs: { text: positiveText,  clip: ['5', 0] } },
    '7':  { class_type: 'CLIPTextEncode',         inputs: { text: negativeText,  clip: ['5', 0] } },
    '8':  { class_type: 'EmptyLatentImage',       inputs: { width: 832, height: 1216, batch_size: 1 } },
    '9':  { class_type: 'KSampler',               inputs: { seed, steps: 38, cfg: 4.0, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1.0,  model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['8', 0] } },
    '10': { class_type: 'VAEDecode',              inputs: { samples: ['9', 0],  vae: ['1', 2] } },
    '11': { class_type: 'UpscaleModelLoader',     inputs: { model_name: '4x_remacri.pth' } },
    '12': { class_type: 'ImageUpscaleWithModel',  inputs: { upscale_model: ['11', 0], image: ['10', 0] } },
    '13': { class_type: 'ImageScale',             inputs: { upscale_method: 'lanczos', width: 1248, height: 1824, crop: 'disabled', image: ['12', 0] } },
    '14': { class_type: 'VAEEncode',              inputs: { pixels: ['13', 0], vae: ['1', 2] } },
    '15': { class_type: 'KSampler',               inputs: { seed, steps: 20, cfg: 4.0, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 0.55, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['14', 0] } },
    '16': { class_type: 'VAEDecode',              inputs: { samples: ['15', 0], vae: ['1', 2] } },
    '17': { class_type: 'SaveImage',              inputs: { filename_prefix: 'dnd3-portrait', images: ['16', 0] } },
  };
}

// ─── ComfyUI API helpers ──────────────────────────────────

type ComfyPromptResponse = { prompt_id: string };

type ComfyHistoryEntry = {
  status?: { completed?: boolean; status_str?: string };
  outputs?: Record<string, { images?: Array<{ filename: string; subfolder: string; type: string }> }>;
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function queuePrompt(workflow: Record<string, unknown>): Promise<string> {
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
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const response = await fetch(`${COMFY_BASE_URL}/history/${promptId}`);
    if (!response.ok) { continue; }

    const history = (await response.json()) as Record<string, ComfyHistoryEntry>;
    const entry = history[promptId];

    if (entry?.status?.completed) {
      return entry;
    }
    if (entry?.status?.status_str === 'error') {
      throw new Error('[ComfyUI] Generation failed on server');
    }
  }

  throw new Error('[ComfyUI] Timeout waiting for image generation');
}

async function fetchImageAsBase64(filename: string, subfolder: string): Promise<string> {
  const params = new URLSearchParams({ filename, subfolder, type: 'output' });
  const response = await fetch(`${COMFY_BASE_URL}/view?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`[ComfyUI] Image fetch error ${response.status}`);
  }

  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = () => reject(new Error('[ComfyUI] Failed to read image blob'));
    reader.readAsDataURL(blob);
  });
}

// ─── Public API ───────────────────────────────────────────

export async function generateCharacterPortrait(char: CharacterPortraitInput): Promise<string> {
  const { positive, negative } = buildCharacterPrompt(char);
  const seed = Math.floor(Math.random() * 2 ** 32);
  const workflow = buildWorkflow(positive, negative, seed);

  console.log('[ComfyUI] Queuing portrait for:', char.name, '| seed:', seed);

  const promptId = await queuePrompt(workflow);
  console.log('[ComfyUI] Prompt queued:', promptId);

  const entry = await pollHistory(promptId);

  // Node "17" is the SaveImage node (PerfectDeliberate v8 / Illustrious workflow)
  const images = entry.outputs?.['17']?.images;
  if (!images || images.length === 0) {
    throw new Error('[ComfyUI] No output images found in history');
  }

  const { filename, subfolder } = images[0];
  console.log('[ComfyUI] Image ready:', filename);

  return fetchImageAsBase64(filename, subfolder);
}
