/**
 * mapState.ts — Shared utilities for parsing FloorExplorationState from JSON strings.
 * CR-MS-01: centralised to avoid duplication across MapScreen and BattleScreen.
 */
import type { FloorExplorationState } from '../services/dungeonGraphService';
import { EXPRESSION_REQUIRE_MAP, PORTRAIT_REQUIRE_MAP } from '../services/portraitRequireMap';

export function isExplorationState(parsed: unknown): parsed is FloorExplorationState {
  if (!parsed || typeof parsed !== 'object') return false;
  return (
    'floorIndex' in parsed &&
    'visitedRoomIds' in parsed &&
    'revealedRoomIds' in parsed &&
    'currentRoomId' in parsed
  );
}

export function parseExplorationState(raw: string | null | undefined): FloorExplorationState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isExplorationState(parsed)) return parsed;
  } catch { /* ignore */ }
  return null;
}

function extractLastFolderNameFromUri(uri: string): string | null {
	const parts = uri.split('/');
	return parts.length > 0 ? parts[parts.length - 2] : null;
};

export function getPortraitsFromUri(uri: string | null | undefined): number {
	const key = extractLastFolderNameFromUri(uri ?? '');
	return PORTRAIT_REQUIRE_MAP[key ?? ''] ?? null;
}

export function getExpressionsFromUri(uri: string | null | undefined): Record<string, number> | null {
	const key = extractLastFolderNameFromUri(uri ?? '');
	return EXPRESSION_REQUIRE_MAP[key ?? ''] ?? null;
}

/**
 * FastImage-compatible image source: bundled asset (require number) or URI object.
 */
export type PortraitSource = number | { uri: string };

/**
 * Resolves a stored portrait path to a FastImage-compatible source.
 * - Catalog relative path ("assets/.../fighter_elf_2/portrait.webp") → PORTRAIT_REQUIRE_MAP lookup via folder key
 * - File / http URI → { uri: string }
 * Returns null if the path cannot be resolved.
 */
export function resolvePortraitSource(path: string | null | undefined): PortraitSource | null {
  if (!path) return null;
  const key = extractLastFolderNameFromUri(path);
  if (key) {
    const num = PORTRAIT_REQUIRE_MAP[key];
    if (num != null) return num;
  }
  if (path.startsWith('file://') || path.startsWith('http') || path.startsWith('data:')) {
    return { uri: path };
  }
  return null;
}

/**
 * Resolves a specific expression source from a portrait path.
 * The folder key is extracted from the path and used to look up EXPRESSION_REQUIRE_MAP.
 * Returns null if no catalog expression exists (caller should fall back to stored expression URI).
 */
export function resolveExpressionSource(
  portraitPath: string | null | undefined,
  expression: string,
): number | null {
  if (!portraitPath) return null;
  const key = extractLastFolderNameFromUri(portraitPath);
  if (!key) return null;
  return EXPRESSION_REQUIRE_MAP[key]?.[expression] ?? null;
}

/**
 * Returns the full expression require map for a portrait path, or null if not in catalog.
 */
export function getAvailableExpressions(portraitPath: string | null | undefined): Record<string, number> | null {
  if (!portraitPath) return null;
  const key = extractLastFolderNameFromUri(portraitPath);
  if (!key) return null;
  return EXPRESSION_REQUIRE_MAP[key] ?? null;
}
	