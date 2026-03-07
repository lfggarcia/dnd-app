import { Platform } from 'react-native';
import { getResource } from '../database';

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

// Rich race visual descriptors — physical appearance tokens for the image model
const RACE_VISUAL: Record<string, string> = {
  dragonborn: 'dragonborn woman, humanoid body, human face structure, reptilian scale texture on skin, slit vertical pupils, small curved horns on forehead, draconic features on human face, scale patches on cheeks and neck',
  draconido:  'draconido woman, humanoid body, human face structure, reptilian scale texture on skin, slit vertical pupils, small curved horns on forehead, draconic features on human face, scale patches on cheeks and neck',
  dwarf:      'dwarf woman, stocky powerful build, braided hair, wide shoulders',
  elf:        'elf woman, long pointed ears, ethereal graceful features, lithe slender build',
  gnome:      'gnome woman, tiny small stature, large bright curious eyes, button nose',
  'half-elf': 'half-elf woman, slightly pointed ears, delicate mixed-heritage features',
  halfling:   'halfling woman, very short petite stature, curly hair, nimble energetic',
  'half-orc': 'half-orc woman, grey-green tinted skin, prominent lower canines, strong powerful build',
  human:      'human woman',
  tiefling:   'tiefling woman, small curved horns on forehead, long slender tail, solid-color eyes',
};

// Class visual equipment and silhouette tokens
const CLASS_VISUAL: Record<string, string> = {
  barbarian: 'barbarian warrior, minimal hide or leather armor, large brutal melee weapon, tribal paint or markings',
  bard:      'bard performer, colorful flamboyant outfit, lute or instrument, decorative cape',
  cleric:    'cleric priest, holy symbol amulet, chainmail or robes, mace or staff, faint divine glow',
  druid:     'druid, nature-themed flowing robes, carved wooden staff, leaf and vine motifs',
  fighter:   'fighter soldier, plate armor or chainmail, sword and shield or greatsword, battle-worn gear',
  monk:      'monk martial artist, simple cloth gi wrappings, barefoot or sandals, rope belt, fighting stance',
  paladin:   'paladin holy knight, shining full plate armor, holy symbol, divine radiant aura',
  ranger:    'ranger hunter, worn leather armor, longbow on back, dark travel cloak, forest-adapted gear',
  rogue:     'rogue assassin, form-fitting dark leather armor, twin daggers at hip, hood or mask',
  sorcerer:  'sorcerer mage, flowing otherworldly robes, raw magical energy crackling around hands, arcane orb',
  warlock:   'warlock, dark eldritch robes, pact weapon, occult runes and symbols, shadowy void magic',
  wizard:    'wizard scholar, arcane patterned robes, spellbook tome, staff or wand, glowing magical sigils',
};

// Background visual context — affects attire style and props
const BACKGROUND_VISUAL: Record<string, string> = {
  acolyte:       'temple ceremonial robes, holy symbol pendant, devoted faithful expression',
  charlatan:     'flashy stylish disguise outfit, wry clever deceptive smile',
  criminal:      'rough dark street clothing, concealed blades, weathered street-worn look',
  entertainer:   'colorful theatrical performer costume, stage makeup, dramatic pose',
  'folk-hero':   'simple sturdy practical peasant clothing, humble determined expression',
  'guild-artisan':'quality craftsperson attire, artisan tools at belt, capable hands',
  hermit:        'worn simple meditation robes, calm contemplative serene expression',
  noble:         'fine embroidered expensive clothing, signet ring, dignified aristocratic bearing',
  outlander:     'rough primitive outdoor clothing, animal pelts, tribal accessories',
  sage:          'scholarly ink-stained robes, quill at belt, thoughtful intellectual expression',
  sailor:        'weathered practical sea clothing, rope coiled at belt, wind-worn look',
  soldier:       'military campaign gear, battle-worn armor, disciplined soldier bearing',
  urchin:        'ragged patched improvised clothing, scrappy street-survivor expression',
};

// Alignment — expression and attitude tokens
const ALIGNMENT_EXPRESSION: Record<string, string> = {
  'lawful-good':    'noble confident heroic expression, warm protective gaze',
  'neutral-good':   'kind warm compassionate smile, gentle eyes',
  'chaotic-good':   'wild free-spirited brave grin, daring eyes',
  'lawful-neutral': 'stoic disciplined determined expression, measuring gaze',
  neutral:          'calm balanced composed neutral expression',
  'chaotic-neutral':'unpredictable carefree independent smirk',
  'lawful-evil':    'cold calculating ruthless expression, sharp cruel eyes',
  'neutral-evil':   'sinister cunning ambitious smirk, predatory eyes',
  'chaotic-evil':   'wild unhinged menacing snarl, frenzied eyes',
};

// Expression presets — used for img2img batch expression generation
export const EXPRESSION_PRESETS: Record<string, string> = {
  neutral:   'calm composed neutral expression, relaxed face, steady gaze',
  happy:     'bright warm cheerful smile, happy sparkling joyful eyes',
  angry:     'fierce battle rage, furrowed brows, intense wrathful snarl',
  sad:       'melancholy sorrowful heavy heart, downcast glistening eyes',
  surprised: 'wide shocked eyes, open mouth, startled expression',
  wounded:   'pained grimace, weary exhausted, bloodied disheveled beaten',
};

const STAT_FLAVOR: Record<string, string> = {
  STR: 'powerfully muscular built',
  DEX: 'lithe agile graceful',
  CON: 'hardy sturdy resilient',
  INT: 'sharp intelligent-looking scholarly',
  WIS: 'wise perceptive calm gaze',
  CHA: 'striking charismatic magnetic presence',
};

function buildCharacterPrompt(char: CharacterPortraitInput): { positive: string; negative: string } {
  const race = RACE_VISUAL[char.race] ?? `${char.race.replace(/-/g, ' ')} woman`;
  const cls  = CLASS_VISUAL[char.charClass] ?? char.charClass;
  const sub  = char.subclass ? `${char.subclass.replace(/-/g, ' ')} ` : '';
  const bg   = char.background ? (BACKGROUND_VISUAL[char.background] ?? '') : '';
  const expression = char.alignment ? (ALIGNMENT_EXPRESSION[char.alignment] ?? '') : '';

  // Top 2 stats provide body + face flavor
  const sortedStats = (Object.entries(char.baseStats) as [string, number][])
    .sort((a, b) => b[1] - a[1]);
  const statFlavor1 = STAT_FLAVOR[sortedStats[0]?.[0] ?? 'STR'] ?? '';
  const statFlavor2 = STAT_FLAVOR[sortedStats[1]?.[0] ?? 'DEX'] ?? '';

  // Pull alignment description from DB (English) for extra personality flavor
  let alignSnippet = '';
  if (char.alignment) {
    try {
      const res = getResource('alignments', char.alignment);
      if (res) {
        const data = JSON.parse(res.data) as { desc?: string };
        if (data.desc) {
          // Use first 10 words as soft personality context
          alignSnippet = data.desc.split(/\s+/).slice(0, 10).join(' ');
        }
      }
    } catch { /* DB unavailable — skip */ }
  }

  // Pull race description snippet from DB (English) for physical flavor
  let raceSnippet = '';
  try {
    const res = getResource('races', char.race);
    if (res) {
      const data = JSON.parse(res.data) as { alignment?: string; age?: string; size_description?: string };
      // age or size_description give concise visual physical context
      raceSnippet = (data.size_description ?? '').split(/\s+/).slice(0, 8).join(' ');
    }
  } catch { /* skip */ }

  const positive = [
    'score_9, score_8_up, score_8, masterpiece, best quality, newest, absurdres',
    'BREAK',
    `1girl, sole_girl, ${race}`,
    `${sub}${cls}`,
    bg,
    expression,
    statFlavor1,
    statFlavor2,
    raceSnippet,
    alignSnippet,
    'cowboy shot, from head to knees, 3/4 body visible, dynamic confident pose, outfit and weapon clearly shown',
    'perfect face, detailed face, expressive eyes, dramatic cinematic lighting',
    'dark fantasy RPG, concept art, highly detailed fantasy illustration',
    'dark atmosphere, gothic background, volumetric lighting',
    'usnr, 748cmstyle',
  ].filter(Boolean).join(', ');

  // Extra negative tokens for non-humanoid races to force human body structure
  const isNonHumanoid = ['dragonborn', 'draconido'].includes(char.race);
  const raceNegative = isNonHumanoid
    ? 'dragon head, monster face, fully reptilian face, animal face, beast head, inhuman head, dragon muzzle, animal snout, non-human face, full dragon transformation,'
    : '';

  const negative = [
    'score_6, score_5, score_4, low quality, worst quality',
    raceNegative,
    'blurry, deformed, bad anatomy, extra limbs, watermark, text, logo, signature',
    'photorealistic, photograph, 3d render, nsfw, multiple people, crowd',
    'full body shot, full length, head to toe, zoomed out, distant shot',
    'cut off head, cropped face, bust only, head shot, close-up face only',
  ].filter(Boolean).join(', ');

  return { positive, negative };
}

// ─── ComfyUI config ───────────────────────────────────────

// ── ComfyUI URL ──────────────────────────────────────────
// Android emulator → 10.0.2.2 (NAT loopback to host Mac);
//   requires: socat TCP4-LISTEN:8089,fork,reuseaddr TCP4:192.168.0.20:8089
// iOS Simulator → localhost (direct loopback to host Mac)
// Physical device (same WiFi) → 192.168.0.20
const COMFY_HOST = Platform.select({
  android: '10.0.2.2',    // Android emulator NAT loopback → host Mac
  ios: '192.168.0.20',    // iOS: direct LAN IP (simulator + physical device)
  default: '192.168.0.20',
});
const COMFY_BASE_URL = `http://${COMFY_HOST}:8089`;
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
    '1':  { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'perfectdeliberate_v8.safetensors' } },
    '2':  { class_type: 'LoraLoader',             inputs: { model: ['1', 0], clip: ['1', 1], lora_name: '748cmSDXL.safetensors',                        strength_model: 0.5, strength_clip: 0.5 } },
    '3':  { class_type: 'LoraLoader',             inputs: { model: ['2', 0], clip: ['2', 1], lora_name: 'thiccwithaq-artist-richy-v1_ixl.safetensors', strength_model: 0.7, strength_clip: 0.7 } },
    '4':  { class_type: 'LoraLoader',             inputs: { model: ['3', 0], clip: ['3', 1], lora_name: 'USNR_STYLE_ILL_V1_lokr3-000024.safetensors',  strength_model: 0.6, strength_clip: 0.6 } },
    '5':  { class_type: 'CLIPSetLastLayer',       inputs: { clip: ['4', 1], stop_at_clip_layer: -2 } },
    '6':  { class_type: 'CLIPTextEncode',         inputs: { text: positiveText,  clip: ['5', 0] } },
    '7':  { class_type: 'CLIPTextEncode',         inputs: { text: negativeText,  clip: ['5', 0] } },
    '8':  { class_type: 'EmptyLatentImage',       inputs: { width: 832, height: 1216, batch_size: 1 } },
    '9':  { class_type: 'KSampler',               inputs: { seed, steps: 38, cfg: 4.0, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1.0,  model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['8', 0] } },
    '10': { class_type: 'VAEDecode',              inputs: { samples: ['9', 0],  vae: ['1', 2] } },
    '11': { class_type: 'UpscaleModelLoader',     inputs: { model_name: 'remacri_original.safetensors' } },
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

// ─── Expression batch generation ──────────────────────────────────────

type ComfyUploadResponse = { name: string; subfolder: string; type: string };

/**
 * Uploads a base64 data URI as an image to ComfyUI's /upload/image endpoint.
 * Returns the filename as stored in ComfyUI's input folder.
 */
async function uploadImageToComfy(base64DataUri: string): Promise<string> {
  const formData = new FormData();
  // React Native FormData pseudo-file pattern: pass the data URI as the image source
  (formData as any).append('image', {
    uri: base64DataUri,
    name: 'portrait_upload.png',
    type: 'image/png',
  });

  const response = await fetch(`${COMFY_BASE_URL}/upload/image`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[ComfyUI] Upload error ${response.status}: ${text}`);
  }

  const json = (await response.json()) as ComfyUploadResponse;
  console.log('[ComfyUI] Uploaded portrait as:', json.name);
  return json.name;
}

// ─── img2img expression workflow ───────────────────────────────────────
//
// Same checkpoint + LoRAs as the portrait workflow, but uses LoadImage → VAEEncode
// instead of EmptyLatentImage, keeping the face consistent (denoise 0.35).
//
// Node graph:
//   [1-4]  Checkpoint + 3x LoRA (identical weights to portrait workflow)
//   [5]    CLIPSetLastLayer -2
//   [6]    CLIPTextEncode positive  ← prompt with expression tokens
//   [7]    CLIPTextEncode negative
//   [8]    LoadImage            ← uploaded portrait filename
//   [9]    VAEEncode            ← encodes portrait into latent space
//   [10]   KSampler img2img     ← denoise 0.35 = preserves face, shifts expression
//   [11]   VAEDecode
//   [12]   SaveImage            ← prefix: dnd3-expression
//
function buildExpressionWorkflow(
  positiveText: string,
  negativeText: string,
  seed: number,
  uploadedFilename: string,
): Record<string, unknown> {
  return {
    '1':  { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'perfectdeliberate_v8.safetensors' } },
    '2':  { class_type: 'LoraLoader',             inputs: { model: ['1', 0], clip: ['1', 1], lora_name: '748cmSDXL.safetensors',                        strength_model: 0.5, strength_clip: 0.5 } },
    '3':  { class_type: 'LoraLoader',             inputs: { model: ['2', 0], clip: ['2', 1], lora_name: 'thiccwithaq-artist-richy-v1_ixl.safetensors', strength_model: 0.7, strength_clip: 0.7 } },
    '4':  { class_type: 'LoraLoader',             inputs: { model: ['3', 0], clip: ['3', 1], lora_name: 'USNR_STYLE_ILL_V1_lokr3-000024.safetensors',  strength_model: 0.6, strength_clip: 0.6 } },
    '5':  { class_type: 'CLIPSetLastLayer',       inputs: { clip: ['4', 1], stop_at_clip_layer: -2 } },
    '6':  { class_type: 'CLIPTextEncode',         inputs: { text: positiveText, clip: ['5', 0] } },
    '7':  { class_type: 'CLIPTextEncode',         inputs: { text: negativeText, clip: ['5', 0] } },
    '8':  { class_type: 'LoadImage',              inputs: { image: uploadedFilename, upload: 'image' } },
    '9':  { class_type: 'VAEEncode',              inputs: { pixels: ['8', 0], vae: ['1', 2] } },
    '10': { class_type: 'KSampler',               inputs: { seed, steps: 20, cfg: 4.0, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 0.35, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['9', 0] } },
    '11': { class_type: 'VAEDecode',              inputs: { samples: ['10', 0], vae: ['1', 2] } },
    '12': { class_type: 'SaveImage',              inputs: { filename_prefix: 'dnd3-expression', images: ['11', 0] } },
  };
}

function buildExpressionPrompt(char: CharacterPortraitInput, expressionTokens: string): { positive: string; negative: string } {
  const race = RACE_VISUAL[char.race] ?? `${char.race.replace(/-/g, ' ')} woman`;
  const cls  = CLASS_VISUAL[char.charClass] ?? char.charClass;

  const positive = [
    'score_9, score_8_up, score_8, masterpiece, best quality',
    'BREAK',
    `1girl, sole_girl, ${race}`,
    cls,
    expressionTokens,
    'same character, same face, same outfit, expression change only',
    'cowboy shot, from head to knees, 3/4 body visible',
    'perfect face, detailed face, expressive eyes, dramatic cinematic lighting',
    'dark fantasy RPG, concept art, highly detailed fantasy illustration',
    'dark atmosphere, gothic background',
    'usnr, 748cmstyle',
  ].filter(Boolean).join(', ');

  const isNonHumanoid = ['dragonborn', 'draconido'].includes(char.race);
  const raceNegative = isNonHumanoid
    ? 'dragon head, monster face, fully reptilian face, animal face,'
    : '';

  const negative = [
    'score_6, score_5, score_4, low quality, worst quality',
    raceNegative,
    'blurry, deformed, bad anatomy, extra limbs, watermark, text',
    'photorealistic, 3d render, nsfw, multiple people',
    'full body shot, full length, head to toe',
    'cut off head, cropped face, bust only',
  ].filter(Boolean).join(', ');

  return { positive, negative };
}

/**
 * Generates all expression variants (neutral, happy, angry, sad, surprised, wounded)
 * for a single character using img2img from their base portrait.
 *
 * @param char         Character data (race, class, etc.) for prompt building
 * @param portraitBase64  The character's existing portrait as a base64 data URI
 * @returns  Map of expressionKey → base64 data URI
 */
export async function generateCharacterExpressions(
  char: CharacterPortraitInput,
  portraitBase64: string,
): Promise<Record<string, string>> {
  console.log('[ComfyUI] Starting expression batch for:', char.name);

  // Upload the base portrait once; all expression passes reference the same file
  const uploadedFilename = await uploadImageToComfy(portraitBase64);

  const results: Record<string, string> = {};

  for (const [expressionKey, expressionTokens] of Object.entries(EXPRESSION_PRESETS)) {
    console.log(`[ComfyUI] Generating expression: ${expressionKey}`);

    const seed = Math.floor(Math.random() * 2 ** 32);
    const { positive, negative } = buildExpressionPrompt(char, expressionTokens);
    const workflow = buildExpressionWorkflow(positive, negative, seed, uploadedFilename);

    const promptId = await queuePrompt(workflow);
    const entry = await pollHistory(promptId);

    const images = entry.outputs?.['12']?.images;
    if (!images || images.length === 0) {
      console.warn(`[ComfyUI] No output for expression: ${expressionKey}, skipping`);
      continue;
    }

    const { filename, subfolder } = images[0];
    results[expressionKey] = await fetchImageAsBase64(filename, subfolder);
    console.log(`[ComfyUI] Expression ready: ${expressionKey} → ${filename}`);
  }

  console.log('[ComfyUI] Expression batch complete for:', char.name, '| variants:', Object.keys(results).join(', '));
  return results;
}
