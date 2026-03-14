/**
 * mapState.ts — Shared utilities for parsing FloorExplorationState from JSON strings.
 * CR-MS-01: centralised to avoid duplication across MapScreen and BattleScreen.
 */
import type { FloorExplorationState } from '../services/dungeonGraphService';

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
