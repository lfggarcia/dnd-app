import { NANO_BANANA_API } from '@env';

// ─── Types ─────────────────────────────────────────────────────────────────
export type EnemyType =
  | 'skeleton'
  | 'skeleton_archer'
  | 'skeleton_knight'
  | 'skeleton_mage'
  | 'goblin'
  | 'goblin_veteran'
  | 'goblin_raider'
  | 'goblin_champion'
  | 'goblin_shaman'
  | 'rat'
  | 'dire_rat'
  | 'cultist'
  | 'knight'
  | 'demon'
  | 'lich';

export interface EnemySprite {
  /** base64 data URI of the generated sprite */
  uri: string;
  generatedAt: number;
}

// ─── In-memory sprite cache ─────────────────────────────────────────────────
// Sprites are expensive to generate. We cache them for the app lifetime so
// FloorLoad generates once and combat reads from here.
const spriteCache = new Map<EnemyType, EnemySprite>();

// ─── Prompt builder ─────────────────────────────────────────────────────────
function buildSpritePrompt(enemy: EnemyType): string {
  const nameMap: Record<EnemyType, string> = {
    skeleton: 'undead skeleton warrior',
    skeleton_archer: 'undead skeleton archer with bow',
    skeleton_knight: 'armored undead skeleton knight',
    skeleton_mage: 'undead skeleton mage with staff',
    goblin: 'small green goblin warrior',
    goblin_veteran: 'scarred veteran goblin fighter',
    goblin_raider: 'goblin raider with twin blades',
    goblin_champion: 'large powerful goblin champion',
    goblin_shaman: 'goblin shaman with magical totems',
    rat: 'giant dungeon rat',
    dire_rat: 'massive dire rat with red eyes',
    cultist: 'dark robed cultist with sigils',
    knight: 'corrupted armored dark knight',
    demon: 'small dungeon imp demon',
    lich: 'ancient undead lich sorcerer',
  };

  const desc = nameMap[enemy] ?? enemy.replace(/_/g, ' ');
  return [
    `Pixel art sprite of a ${desc}.`,
    'Dark dungeon crawler aesthetic, D&D inspired.',
    'Full body, front-facing, neutral pose.',
    'Black background, CRT green tones.',
    'High detail, 512x512.',
    'No text, no watermarks.',
  ].join(' ');
}

// ─── API call (Gemini image gen) ────────────────────────────────────────────
const MODEL = 'gemini-2.0-flash-preview-image-generation';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

type GeminiPart = {
  text?: string;
  inlineData?: { mimeType: string; data: string };
};

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  error?: { code: number; message: string; status: string };
};

async function generateSpriteFromAPI(enemy: EnemyType): Promise<string> {
  const prompt = buildSpritePrompt(enemy);

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
    const err = await response.text();
    throw new Error(`Sprite API error ${response.status}: ${err}`);
  }

  const json = (await response.json()) as GeminiResponse;
  if (json.error) {
    throw new Error(`Sprite API error ${json.error.code}: ${json.error.message}`);
  }

  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));

  if (!imagePart?.inlineData) {
    throw new Error('No image in sprite API response');
  }

  const { mimeType, data } = imagePart.inlineData;
  return `data:${mimeType};base64,${data}`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get sprite for a given enemy type.
 * Returns cached sprite if available, otherwise generates one via Nano Banana.
 * NEVER call this during active combat — call from floor loading phase.
 */
export async function getEnemySprite(enemy: EnemyType): Promise<EnemySprite> {
  const cached = spriteCache.get(enemy);
  if (cached) return cached;

  const uri = await generateSpriteFromAPI(enemy);
  const sprite: EnemySprite = { uri, generatedAt: Date.now() };
  spriteCache.set(enemy, sprite);
  return sprite;
}

/**
 * Pre-generate sprites for all enemies on a floor.
 * Call this during the loading phase before combat starts.
 * Silently skips enemies whose generation fails.
 */
export async function preloadFloorSprites(enemies: EnemyType[]): Promise<void> {
  const unique = [...new Set(enemies)];
  await Promise.allSettled(unique.map(e => getEnemySprite(e)));
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
    rat:       ['rat', 'rat', 'dire_rat', 'dire_rat'],
    cultist:   ['cultist', 'cultist', 'knight', 'knight'],
  };
  const chain = evolutionTable[base];
  if (!chain) return base;
  return chain[Math.min(tier, chain.length - 1)];
}
