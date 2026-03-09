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

// Expression presets — 22 expressions using physical muscle/geometry descriptions
// (abstract emotion tokens replaced per EXPRESSIONS_WORKFLOW_v1.md section 5)
// denoise is calibrated per expression; do NOT exceed 0.68 (loses identity above that)
type ExpressionPreset = { positive: string; negative: string; denoise: number };
export const EXPRESSION_PRESETS: Record<string, ExpressionPreset> = {
  neutral: {
    positive: 'completely relaxed facial muscles, soft steady gaze directly forward, mouth closed naturally, no tension anywhere in face',
    negative: 'angry, happy, sad, smiling, crying, extreme expression',
    denoise: 0.55,
  },
  angry: {
    positive: 'inner brow corners sharply pulled down and together, deep vertical furrow between eyebrows, eyes narrowed to slits, jaw clenched, lips pressed tight, face tense',
    negative: 'neutral expression, closed eyes, happy, sad, extra teeth, bad teeth, deformed teeth',
    denoise: 0.55,
  },
  confident: {
    positive: 'eyes closed serenely with small satisfied smile, eyebrows relaxed and high, face glowing with inner confidence, small serene smile, supremely self-assured expression',
    negative: 'anxious, fearful, angry, sad, extreme expression',
    denoise: 0.55,
  },
  confused: {
    positive: 'head tilted hard to the left shoulder, LEFT eyebrow arched to maximum, RIGHT eyebrow pulled into frown, mouth twisted hard to one side half open with uncertainty, deep forehead furrow left side only',
    negative: 'neutral expression, straight head, symmetric eyebrows, calm face',
    denoise: 0.62,
  },
  despondent: {
    positive: 'lower lip pushed WAY out forming prominent visible pout, inner corners of eyebrows raised steeply creating sad brow angle, chin slightly dimpled and trembling, cheeks soft and full with pout, glossy wet eyes from held-back tears',
    negative: 'happy, smiling, neutral expression, laughing, angry',
    denoise: 0.65,
  },
  determined: {
    positive: 'eyes narrowed with intense focused gaze, jaw set firmly forward, lips pressed into thin straight line, slight flare of nostrils, brow low and serious, face radiating iron will',
    negative: 'neutral expression, laughing, crying, relaxed face',
    denoise: 0.55,
  },
  disgusted: {
    positive: 'eyes wide open directed DOWN with visible disgust, nose bridge wrinkling with horizontal creases bunny lines, mouth firmly pressed closed lips tight shut, one cheek raised from nose wrinkle, eyebrows pulled together and slightly down',
    negative: 'happy, neutral, eyes closed, head tilted back, pleasure, ecstasy, open mouth, smiling',
    denoise: 0.60,
  },
  fearful: {
    positive: 'eyes stretched extremely wide whites showing above and below iris, eyebrows raised and pulled together creating forehead wrinkles, mouth slightly open, lower lip trembling, face pale and frozen in terror',
    negative: 'neutral expression, angry, happy, calm face, relaxed',
    denoise: 0.55,
  },
  fierce: {
    positive: 'LEFT eye stretched wide open to maximum showing whites all around, RIGHT eye narrowed to predatory slit almost closed, wide unhinged villain grin showing all upper AND lower teeth fully, eyebrows pulling in opposite directions left up right down',
    negative: 'symmetric eyes, neutral expression, calm face, closed mouth, sad',
    denoise: 0.68,
  },
  flirty: {
    positive: 'one eyebrow raised high in playful arch, eyes heavy lidded and knowing, slight closed-mouth smile with one corner lifted into smirk, lips closed and defined, gentle head tilt, teasing confident expression',
    negative: 'neutral expression, angry, scared, open mouth, sad',
    denoise: 0.55,
  },
  happy: {
    positive: 'cheeks raised and rounded pushing lower eyelids up, eyes curved into crescents, wide open smile showing upper teeth, corners of mouth pulled far back and up, face radiant with joy',
    negative: 'angry, sad, neutral expression, closed eyes, closed mouth',
    denoise: 0.62,
  },
  hollow: {
    positive: 'eyes open but staring through everything unseeing, pupils slightly dilated not focused on anything, face muscles completely slack and dropped, jaw hanging slightly open from zero muscle tone, face like nobody is home',
    negative: 'focused gaze, happy, angry, intense expression, alert face',
    denoise: 0.55,
  },
  incredulous: {
    positive: 'one eyebrow raised to absolute maximum nearly touching hairline, opposite eyebrow aggressively pulled down in scowl, eyes wide on raised side, squinted on low side, mouth corners pulled sharply down, face screaming disbelief',
    negative: 'neutral expression, symmetric eyebrows, calm, happy, smiling',
    denoise: 0.62,
  },
  rage: {
    positive: 'mouth stretched into WIDE unhinged grin showing every single tooth upper and lower rows fully bared, grin so wide it reaches near ears, eyes wide open with veins visible in whites from fury, eyebrows slanting sharply inward over nose in extreme frown WHILE mouth grins',
    negative: 'closed mouth, neutral expression, calm face, sad expression, mild expression',
    denoise: 0.68,
  },
  sad: {
    positive: 'inner brow corners pulled upward making arch, lower lip jutting out trembling, eyes glistening with unshed tears, corners of mouth pulled sharply downward, face crumpled in sorrow',
    negative: 'neutral expression, angry, happy, smiling, dry eyes',
    denoise: 0.55,
  },
  sarcastic: {
    positive: 'one corner of mouth pulled up in sharp mocking smirk, one eyebrow raised slowly in contempt, other eyebrow flat and low, eyes heavy lidded with disdain, face radiating mockery and superiority',
    negative: 'neutral expression, sad, scared, sincere expression, symmetric face',
    denoise: 0.55,
  },
  seductive: {
    positive: 'one eye slightly more closed than the other in lazy wink, tip of tongue barely touching upper lip corner, chin slightly lowered, eyes looking up at viewer through lowered lashes, slow dangerous smile corner of mouth lifted',
    negative: 'neutral expression, angry, scared, disgusted, sad',
    denoise: 0.55,
  },
  serious: {
    positive: 'lips closed in thin straight neutral line no curve up or down, slight brow furrow, eyes direct and cold, jaw set firmly, face composed with zero expression beyond controlled intensity',
    negative: 'smiling, happy, laughing, extreme expression, relaxed brow',
    denoise: 0.55,
  },
  shocked: {
    positive: 'eyes blown to maximum perfectly round circles with whites visible fully surrounding small iris in center, eyebrows shot straight up to absolute hairline, face frozen completely blank with terror, mouth hanging all the way open jaw dropped fully chin near chest, face drained of all color',
    negative: 'calm, neutral, closed mouth, eyes not wide, relaxed brow',
    denoise: 0.68,
  },
  surprised: {
    positive: 'both eyes blown wide open into huge perfect circles, eyebrows shooting up arching high above normal position, forehead creased horizontal from raised eyebrows, jaw dropped naturally mouth open relaxed, face expression of pure delighted surprise',
    negative: 'neutral expression, angry, sad, calm, extra teeth, deformed teeth',
    denoise: 0.65,
  },
  tired: {
    positive: 'eyelids drooping so heavy eyes are barely visible as thin slits, head tilted forward with fatigue, face muscles completely relaxed and sagging, dark undereye shadows, mouth hanging open slightly from exhaustion',
    negative: 'alert expression, wide open eyes, energetic, neutral alert face',
    denoise: 0.55,
  },
  triumph: {
    positive: 'wide triumphant grin showing teeth, eyes bright and wide with victory, eyebrows raised in elation, chin slightly up, face radiating pride and power',
    negative: 'sad, defeated, neutral expression, closed eyes, closed mouth',
    denoise: 0.62,
  },
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
      raceSnippet = (data.size_description ?? '').split(/\s+/).slice(0, 8).join(' ');
    }
  } catch { /* skip */ }

  const positive = [
    'score_9, score_8_up, score_8, masterpiece, best quality, newest, absurdres',
    'BREAK',
    `1girl, sole_girl, ${race}`,
    'large breasts, wide hips, hourglass figure, curvy toned body',
    `${sub}${cls}`,
    bg,
    expression,
    statFlavor1,
    statFlavor2,
    raceSnippet,
    alignSnippet,
    'BREAK',
    'cowboy shot, face large and prominent, face in upper third of image, face fills upper frame, head and shoulders clearly visible, looking at viewer, 3/4 angle slight side view, upper body visible to waist, slight lean forward pose, face fully visible no obstruction, no hair over eyes, expressive detailed eyes, dramatic close-medium shot',
    'BREAK',
    'perfect face, highly detailed face, sharp defined facial features, sharp nose bridge, defined cheekbones, detailed lips, detailed eyelids, detailed iris texture, crisp clean lineart on face, no soft face, no blurry face, clean bare face, no face markings, no face tattoos, no face jewelry, no forehead mark, no forehead gem, face fully visible no hair over eyes, clean face edges, cinematic portrait lighting, rim light on face, soft key light on skin, face illuminated, dark fantasy RPG character portrait, concept art, highly detailed fantasy illustration, dark atmosphere, blurred background, bokeh depth of field, subject sharp foreground, usnr, 748cmstyle',
  ].filter(Boolean).join(', ');

  const isNonHumanoid = ['dragonborn', 'draconido'].includes(char.race);
  const raceNegative = isNonHumanoid
    ? 'dragon head, monster face, fully reptilian face, animal face, beast head, inhuman head, dragon muzzle, animal snout, non-human face, full dragon transformation,'
    : '';

  const negative = [
    'score_6, score_5, score_4, low quality, worst quality',
    raceNegative,
    'blurry, deformed, bad anatomy, extra limbs, missing fingers, fused fingers, watermark, text, logo, signature, photorealistic, photograph, 3d render',
    'explicit nudity, genitals, nipples, multiple people, crowd',
    'full body shot, zoomed out, distant shot, cut off head, cropped face, face far away, small face, face secondary, face in shadow, dark face, obscured eyes, hair over eyes',
    'face tattoo, face markings, face paint, face jewelry, nose ring, face piercing, forehead gem, forehead mark, forehead tattoo, forehead symbol, facial runes, facial ornaments, skin markings, skin tattoos',
    'flat chest, shapeless body, soft face, blurry face, flat face, undefined features, painterly face, ugly, poorly drawn',
  ].filter(Boolean).join(', ');

  return { positive, negative };
}

// ─── ComfyUI config ───────────────────────────────────────

// ── ComfyUI URL ──────────────────────────────────────────
// Android emulator → 10.0.2.2 (NAT loopback to host Mac);
//   requires: socat TCP4-LISTEN:8089,fork,reuseaddr TCP4:192.168.0.17:8089
// iOS Simulator → localhost (direct loopback to host Mac)
// Physical device (same WiFi) → 192.168.0.20
const COMFY_HOST = Platform.select({
  android: '10.0.2.2',    // Android emulator NAT loopback → host Mac
  ios: '192.168.0.17',    // iOS: direct LAN IP (simulator + physical device)
  default: '192.168.0.17',
});
const COMFY_BASE_URL = `http://${COMFY_HOST}:8089`;
const COMFY_CLIENT_ID = 'dnd3-portrait-gen';
// Poll every 1.5s, up to 120s total
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 80;

// ─── Workflow builder ─────────────────────────────────────

// ─── Workflow builder — Illustrious / PerfectDeliberate v8 ───────────────────
//
// Node graph (API format) — matches 02-portadas-hires-v8-api.json:
//   [1]  CheckpointLoaderSimple (perfectDeliberate_v8)
//   [2]  LoraLoader 748cm (0.50)
//   [3]  LoraLoader thiccwithaq (0.55 — face dominant in Flow 1)
//   [4]  LoraLoader USNR (0.60)
//   [5]  LoraLoader Detailer_NoobAI_Incrs_v1 (0.70)
//   [19] LoraLoader Face_Enhancer_Illustrious (0.45)
//   [20] LoraLoader Best_Facial_Expression_Helper (kaogei) (0.35)
//   [6]  CLIPSetLastLayer (clip_skip -2) — clip from [20]
//   [7]  CLIPTextEncode (positive)
//   [8]  CLIPTextEncode (negative)
//   [9]  EmptyLatentImage 832x1216
//  [10]  KSampler base (38 steps, cfg 4, dpmpp_2m karras, denoise 1.0) — model from [20]
//  [11]  VAEDecodeTiled tile=512 overlap=32
//  [12]  UpscaleModelLoader (remacri)
//  [13]  ImageUpscaleWithModel
//  [14]  ImageScale -> 1248x1824 lanczos
//  [15]  VAEEncodeTiled tile=512 overlap=32
//  [16]  KSampler hires (20 steps, cfg 4, denoise 0.55) — model from [20]
//  [17]  VAEDecodeTiled tile=512 overlap=32
//  [18]  SaveImage -> dnd_portrait
//
function buildWorkflow(positiveText: string, negativeText: string, seed: number): Record<string, unknown> {
  return {
    '1':  { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'perfectdeliberate_v8.safetensors' } },
    '2':  { class_type: 'LoraLoader',             inputs: { model: ['1', 0],  clip: ['1', 1],  lora_name: '748cmSDXL.safetensors',                                        strength_model: 0.50, strength_clip: 0.50 } },
    '3':  { class_type: 'LoraLoader',             inputs: { model: ['2', 0],  clip: ['2', 1],  lora_name: 'thiccwithaq-artist-richy-v1_ixl.safetensors',                 strength_model: 0.55, strength_clip: 0.55 } },
    '4':  { class_type: 'LoraLoader',             inputs: { model: ['3', 0],  clip: ['3', 1],  lora_name: 'USNR_STYLE_ILL_V1_lokr3-000024.safetensors',                   strength_model: 0.60, strength_clip: 0.60 } },
    '5':  { class_type: 'LoraLoader',             inputs: { model: ['4', 0],  clip: ['4', 1],  lora_name: 'Detailer_NoobAI_Incrs_v1.safetensors',                         strength_model: 0.70, strength_clip: 0.70 } },
    '19': { class_type: 'LoraLoader',             inputs: { model: ['5', 0],  clip: ['5', 1],  lora_name: 'Face_Enhancer_Illustrious.safetensors',                        strength_model: 0.45, strength_clip: 0.45 } },
    '20': { class_type: 'LoraLoader',             inputs: { model: ['19', 0], clip: ['19', 1], lora_name: 'Best_Facial_Expression_Helper_XTREME_ILLU-000005.safetensors', strength_model: 0.35, strength_clip: 0.35 } },
    '6':  { class_type: 'CLIPSetLastLayer',       inputs: { clip: ['20', 1], stop_at_clip_layer: -2 } },
    '7':  { class_type: 'CLIPTextEncode',         inputs: { text: positiveText, clip: ['6', 0] } },
    '8':  { class_type: 'CLIPTextEncode',         inputs: { text: negativeText, clip: ['6', 0] } },
    '9':  { class_type: 'EmptyLatentImage',       inputs: { width: 832, height: 1216, batch_size: 1 } },
    '10': { class_type: 'KSampler',               inputs: { seed, steps: 38, cfg: 4.0, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1.0,  model: ['20', 0], positive: ['7', 0], negative: ['8', 0], latent_image: ['9', 0] } },
    '11': { class_type: 'VAEDecodeTiled',         inputs: { samples: ['10', 0], vae: ['1', 2], tile_size: 512, overlap: 32, temporal_size: 64, temporal_overlap: 8 } },
    '12': { class_type: 'UpscaleModelLoader',     inputs: { model_name: 'remacri_original.safetensors' } },
    '13': { class_type: 'ImageUpscaleWithModel',  inputs: { upscale_model: ['12', 0], image: ['11', 0] } },
    '14': { class_type: 'ImageScale',             inputs: { upscale_method: 'lanczos', width: 1248, height: 1824, crop: 'disabled', image: ['13', 0] } },
    '15': { class_type: 'VAEEncodeTiled',         inputs: { pixels: ['14', 0], vae: ['1', 2], tile_size: 512, overlap: 32, temporal_size: 64, temporal_overlap: 8 } },
    '16': { class_type: 'KSampler',               inputs: { seed, steps: 20, cfg: 4.0, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 0.55, model: ['20', 0], positive: ['7', 0], negative: ['8', 0], latent_image: ['15', 0] } },
    '17': { class_type: 'VAEDecodeTiled',         inputs: { samples: ['16', 0], vae: ['1', 2], tile_size: 512, overlap: 32, temporal_size: 64, temporal_overlap: 8 } },
    '18': { class_type: 'SaveImage',              inputs: { filename_prefix: 'dnd_portrait', images: ['17', 0] } },
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

  __DEV__ && console.log('[ComfyUI] Queuing portrait for:', char.name, '| seed:', seed);

  const promptId = await queuePrompt(workflow);
  __DEV__ && console.log('[ComfyUI] Prompt queued:', promptId);

  const entry = await pollHistory(promptId);

  // Node "18" is the SaveImage node (PerfectDeliberate v8 / hires workflow)
  const images = entry.outputs?.['18']?.images;
  if (!images || images.length === 0) {
    throw new Error('[ComfyUI] No output images found in history');
  }

  const { filename, subfolder } = images[0];
  __DEV__ && console.log('[ComfyUI] Image ready:', filename);

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
  __DEV__ && console.log('[ComfyUI] Uploaded portrait as:', json.name);
  return json.name;
}

// ─── img2img expression workflow ───────────────────────────────────────
//
// 6-LoRA stack identical to portrait workflow (coherence rule).
// Uses FaceDetailer to inpaint only the face at calibrated denoise per expression.
//
// Node graph — matches SUPER-expressions-all-api.json shared node layout:
//   [1]  Checkpoint
//   [2]  LoRA 748cm (0.50)
//   [3]  LoRA thiccwithaq (0.70 — higher than Flow 1 for full face freedom)
//   [4]  LoRA USNR (0.60)
//   [5]  LoRA Detailer_NoobAI_Incrs_v1 (0.50)
//   [6]  LoRA Face_Enhancer_Illustrious (0.45)
//   [7]  LoRA Best_Facial_Expression_Helper (kaogei) (0.35)
//   [8]  CLIPSetLastLayer -2
//   [9]  CLIPTextEncode positive
//  [10]  LoadImage (uploaded portrait)
//  [11]  UltralyticsDetectorProvider (face_yolov8n.pt)
//  [12]  CLIPTextEncode negative
//  [13]  FaceDetailer — guide_size 512, cfg 4.0, denoise per-expression
//  [14]  SaveImage
//
function buildExpressionWorkflow(
  positiveText: string,
  negativeText: string,
  seed: number,
  uploadedFilename: string,
  denoise: number,
): Record<string, unknown> {
  return {
    '1':  { class_type: 'CheckpointLoaderSimple',      inputs: { ckpt_name: 'perfectdeliberate_v8.safetensors' } },
    '2':  { class_type: 'LoraLoader',                  inputs: { model: ['1', 0],  clip: ['1', 1],  lora_name: '748cmSDXL.safetensors',                                        strength_model: 0.50, strength_clip: 0.50 } },
    '3':  { class_type: 'LoraLoader',                  inputs: { model: ['2', 0],  clip: ['2', 1],  lora_name: 'thiccwithaq-artist-richy-v1_ixl.safetensors',                 strength_model: 0.70, strength_clip: 0.70 } },
    '4':  { class_type: 'LoraLoader',                  inputs: { model: ['3', 0],  clip: ['3', 1],  lora_name: 'USNR_STYLE_ILL_V1_lokr3-000024.safetensors',                   strength_model: 0.60, strength_clip: 0.60 } },
    '5':  { class_type: 'LoraLoader',                  inputs: { model: ['4', 0],  clip: ['4', 1],  lora_name: 'Detailer_NoobAI_Incrs_v1.safetensors',                         strength_model: 0.50, strength_clip: 0.50 } },
    '6':  { class_type: 'LoraLoader',                  inputs: { model: ['5', 0],  clip: ['5', 1],  lora_name: 'Face_Enhancer_Illustrious.safetensors',                        strength_model: 0.45, strength_clip: 0.45 } },
    '7':  { class_type: 'LoraLoader',                  inputs: { model: ['6', 0],  clip: ['6', 1],  lora_name: 'Best_Facial_Expression_Helper_XTREME_ILLU-000005.safetensors', strength_model: 0.35, strength_clip: 0.35 } },
    '8':  { class_type: 'CLIPSetLastLayer',            inputs: { clip: ['7', 1], stop_at_clip_layer: -2 } },
    '9':  { class_type: 'CLIPTextEncode',              inputs: { text: positiveText, clip: ['8', 0] } },
    '10': { class_type: 'LoadImage',                   inputs: { image: uploadedFilename } },
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
    '14': { class_type: 'SaveImage', inputs: { filename_prefix: 'dnd3-expression', images: ['13', 0] } },
  };
}

function buildExpressionPrompt(
  char: CharacterPortraitInput,
  expressionPositive: string,
  expressionNegative: string,
): { positive: string; negative: string } {
  const skinAnchorMap: Record<string, string> = {
    tiefling:   'pale skin',
    drow:       'dark grey skin',
    'half-orc': 'olive skin',
  };
  const skinAnchor = skinAnchorMap[char.race] ?? 'fair skin';

  const positive = [
    'score_9, score_8_up, score_8, masterpiece, best quality',
    skinAnchor,
    'human woman',
    'BREAK',
    expressionPositive,
    'expressive eyes, perfect face, 748cmstyle, usnr, kaogei',
  ].join(', ');

  const negative = [
    'score_6, score_5, score_4, ugly face, low res, blurry face',
    'different person, different character',
    expressionNegative,
    'disfigured, deformed, bad anatomy, face markings, forehead mark, skin tattoo',
  ].join(', ');

  return { positive, negative };
}

/**
 * Generates all 22 expression variants for a single character using FaceDetailer
 * img2img from their base portrait. Each expression uses a calibrated denoise value.
 *
 * @param char         Character data (race, class, etc.) for prompt building
 * @param portraitBase64  The character's existing portrait as a base64 data URI
 * @returns  Map of expressionKey → base64 data URI
 */
export async function generateCharacterExpressions(
  char: CharacterPortraitInput,
  portraitBase64: string,
): Promise<Record<string, string>> {
  __DEV__ && console.log('[ComfyUI] Starting expression batch for:', char.name);

  // Upload the base portrait once; all expression passes reference the same file
  const uploadedFilename = await uploadImageToComfy(portraitBase64);

  const results: Record<string, string> = {};

  for (const [expressionKey, preset] of Object.entries(EXPRESSION_PRESETS)) {
    __DEV__ && console.log(`[ComfyUI] Generating expression: ${expressionKey}`);

    const seed = Math.floor(Math.random() * 2 ** 32);
    const { positive, negative } = buildExpressionPrompt(char, preset.positive, preset.negative);
    const workflow = buildExpressionWorkflow(positive, negative, seed, uploadedFilename, preset.denoise);

    const promptId = await queuePrompt(workflow);
    const entry = await pollHistory(promptId);

    const images = entry.outputs?.['14']?.images;
    if (!images || images.length === 0) {
      __DEV__ && console.warn(`[ComfyUI] No output for expression: ${expressionKey}, skipping`);
      continue;
    }

    const { filename, subfolder } = images[0];
    results[expressionKey] = await fetchImageAsBase64(filename, subfolder);
    __DEV__ && console.log(`[ComfyUI] Expression ready: ${expressionKey} → ${filename}`);
  }

  __DEV__ && console.log('[ComfyUI] Expression batch complete for:', char.name, '| variants:', Object.keys(results).join(', '));
  return results;
}
