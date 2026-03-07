import { NANO_BANANA_API } from '@env';

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

  // Use highest base stat for physical flavor
  const topStat = (Object.entries(char.baseStats) as [string, number][])
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'STR';
  const statFlavor = STAT_FLAVOR[topStat] ?? '';

  return [
    `D&D 5e fantasy portrait of ${char.name}, a ${race} ${cls}.`,
    statFlavor ? `${statFlavor}.` : '',
    'Gritty dark dungeon crawler aesthetic.',
    'CRT terminal green tones (#00FF41), deep shadows, dramatic lighting.',
    'Close-up bust portrait, black background, no text.',
  ].filter(Boolean).join(' ');
}

// ─── Gemini API call ──────────────────────────────────────

const MODEL = 'gemini-2.0-flash-exp-image-generation';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

type GeminiPart = {
  text?: string;
  inlineData?: { mimeType: string; data: string };
};

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  error?: { code: number; message: string; status: string };
};

export async function generateCharacterPortrait(char: CharacterPortraitInput): Promise<string> {
  const prompt = buildCharacterPrompt(char);

  const response = await fetch(
    `${BASE_URL}/${MODEL}:generateContent?key=${NANO_BANANA_API}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[GeminiPortrait] HTTP error:', response.status, errorText);
    throw new Error(`Gemini HTTP ${response.status}: ${errorText}`);
  }

  const json = (await response.json()) as GeminiResponse;

  if (json.error) {
    console.error('[GeminiPortrait] API error:', json.error);
    throw new Error(`Gemini API ${json.error.code}: ${json.error.message}`);
  }

  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));

  if (!imagePart?.inlineData) {
    const textContent = parts.filter(p => p.text).map(p => p.text).join(' ');
    console.error('[GeminiPortrait] No image in response. Text:', textContent, 'Candidates:', JSON.stringify(json.candidates).substring(0, 400));
    throw new Error('No image returned by Gemini (see Metro logs for details)');
  }

  const { mimeType, data } = imagePart.inlineData;
  return `data:${mimeType};base64,${data}`;
}
