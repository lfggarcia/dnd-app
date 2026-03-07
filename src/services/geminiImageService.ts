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

function buildCharacterPrompt(char: CharacterPortraitInput): string {
  const race = RACE_HINTS[char.race] ?? char.race.replace(/-/g, ' ');
  const cls = CLASS_HINTS[char.charClass] ?? char.charClass;
  const sub = char.subclass ? ` ${char.subclass}` : '';

  const topStat = (Object.entries(char.baseStats) as [string, number][])
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'STR';
  const statFlavor = STAT_FLAVOR[topStat] ?? '';

  return [
    `Dark fantasy RPG character portrait of a ${race} ${cls}${sub}, ${char.name}.`,
    statFlavor ? `${statFlavor}.` : '',
    'Painted concept art style, stylized oil painting, detailed brushwork.',
    'Diablo IV art style, Baldur\'s Gate 3 character portrait aesthetic.',
    'Dramatic chiaroscuro lighting, deep shadows, glowing eyes, battle-worn armor.',
    'Dark dungeon atmosphere, moody color grading, highly detailed fantasy illustration.',
    'Bust portrait, black background, no text, no watermark, no UI elements.',
  ].filter(Boolean).join(' ');
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

function buildWorkflow(prompt: string, seed: number): Record<string, unknown> {
  return {
    '9': {
      inputs: { filename_prefix: 'dnd3-portrait', images: ['62', 0] },
      class_type: 'SaveImage',
    },
    '62': {
      inputs: { upscale_method: 'nearest-exact', megapixels: 1, resolution_steps: 1, image: ['57:8', 0] },
      class_type: 'ImageScaleToTotalPixels',
    },
    '57:30': {
      inputs: { clip_name: 'qwen_3_4b.safetensors', type: 'lumina2', device: 'default' },
      class_type: 'CLIPLoader',
    },
    '57:29': {
      inputs: { vae_name: 'ae.safetensors' },
      class_type: 'VAELoader',
    },
    '57:33': {
      inputs: { conditioning: ['57:27', 0] },
      class_type: 'ConditioningZeroOut',
    },
    '57:8': {
      inputs: { samples: ['57:3', 0], vae: ['57:29', 0] },
      class_type: 'VAEDecode',
    },
    '57:28': {
      inputs: { unet_name: 'z_image_turbo_bf16.safetensors', weight_dtype: 'default' },
      class_type: 'UNETLoader',
    },
    '57:27': {
      inputs: { text: prompt, clip: ['57:30', 0] },
      class_type: 'CLIPTextEncode',
    },
    '57:13': {
      inputs: { width: 512, height: 512, batch_size: 1 },
      class_type: 'EmptySD3LatentImage',
    },
    '57:11': {
      inputs: { shift: 3, model: ['57:28', 0] },
      class_type: 'ModelSamplingAuraFlow',
    },
    '57:3': {
      inputs: {
        seed,
        steps: 8,
        cfg: 1,
        sampler_name: 'res_multistep',
        scheduler: 'simple',
        denoise: 1,
        model: ['57:11', 0],
        positive: ['57:27', 0],
        negative: ['57:33', 0],
        latent_image: ['57:13', 0],
      },
      class_type: 'KSampler',
    },
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
  const prompt = buildCharacterPrompt(char);
  const seed = Math.floor(Math.random() * 2 ** 32);
  const workflow = buildWorkflow(prompt, seed);

  console.log('[ComfyUI] Queuing portrait for:', char.name, '| seed:', seed);

  const promptId = await queuePrompt(workflow);
  console.log('[ComfyUI] Prompt queued:', promptId);

  const entry = await pollHistory(promptId);

  // Node "9" is the SaveImage node
  const images = entry.outputs?.['9']?.images;
  if (!images || images.length === 0) {
    throw new Error('[ComfyUI] No output images found in history');
  }

  const { filename, subfolder } = images[0];
  console.log('[ComfyUI] Image ready:', filename);

  return fetchImageAsBase64(filename, subfolder);
}
