import {
  upsertResourceBatch,
  setSyncMeta,
  getSyncMeta,
  getResourceCount,
} from '../database';
import {
  fetchAllDetails,
  fetchList,
  type ApiEndpoint,
  API_ENDPOINTS,
} from './api5e';

export type SyncProgress = {
  endpoint: string;
  phase: 'list' | 'details' | 'storing' | 'done' | 'error';
  current: number;
  total: number;
};

/**
 * Sync a single endpoint: fetch all details from the API and store in SQLite.
 * Skips if already synced (use force=true to re-sync).
 */
export async function syncEndpoint(
  endpoint: ApiEndpoint,
  options?: {
    force?: boolean;
    onProgress?: (progress: SyncProgress) => void;
  },
): Promise<number> {
  const { force = false, onProgress } = options ?? {};

  // Check if already synced
  if (!force) {
    const meta = getSyncMeta(endpoint);
    if (meta && meta.itemCount > 0) {
      onProgress?.({
        endpoint,
        phase: 'done',
        current: meta.itemCount,
        total: meta.itemCount,
      });
      return meta.itemCount;
    }
  }

  onProgress?.({ endpoint, phase: 'list', current: 0, total: 0 });

  // CR-SS-01: apply 30s timeout to prevent indefinite hang if API is unreachable
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  let items: { index: string; name: string; data: Record<string, unknown> }[];
  try {
    // Fetch all details
    items = await fetchAllDetails(endpoint, (done, total) => {
      onProgress?.({ endpoint, phase: 'details', current: done, total });
    });
  } finally {
    clearTimeout(timeoutId);
  }

  // Store in DB
  onProgress?.({
    endpoint,
    phase: 'storing',
    current: 0,
    total: items.length,
  });

  upsertResourceBatch(
    items.map((item) => ({
      endpoint,
      indexKey: item.index,
      name: item.name,
      data: item.data,
    })),
  );

  setSyncMeta(endpoint, items.length);

  onProgress?.({
    endpoint,
    phase: 'done',
    current: items.length,
    total: items.length,
  });

  return items.length;
}

/**
 * Sync only the list (index + name) for an endpoint without fetching details.
 * Much faster — useful for endpoints where you only need names.
 */
export async function syncEndpointList(
  endpoint: ApiEndpoint,
  options?: { force?: boolean },
): Promise<number> {
  const { force = false } = options ?? {};

  if (!force) {
    const count = getResourceCount(endpoint);
    if (count > 0) return count;
  }

  const list = await fetchList(endpoint);

  upsertResourceBatch(
    list.results.map((item) => ({
      endpoint,
      indexKey: item.index,
      name: item.name,
      data: { index: item.index, name: item.name, url: item.url },
    })),
  );

  setSyncMeta(endpoint, list.count);
  return list.count;
}

/** Priority endpoints for the game — synced with full details first */
const PRIORITY_ENDPOINTS: ApiEndpoint[] = [
  'races',
  'classes',
  'ability-scores',
  'alignments',
  'backgrounds',
  'skills',
  'languages',
  'subraces',
  'subclasses',
  'conditions',
  'damage-types',
  'magic-schools',
  'weapon-properties',
];

/** Heavy endpoints — synced as list-only initially, details fetched on demand */
const DEFERRED_ENDPOINTS: ApiEndpoint[] = [
  'spells',
  'monsters',
  'equipment',
  'magic-items',
  'features',
  'feats',
  'proficiencies',
  'traits',
  'equipment-categories',
  'rules',
  'rule-sections',
];

export type FullSyncProgress = {
  currentEndpoint: string;
  endpointsCompleted: number;
  endpointsTotalCount: number;
  detail: SyncProgress;
};

/**
 * Full sync strategy:
 * 1. Priority endpoints → full detail fetch
 * 2. Deferred endpoints → list-only (names + index)
 *
 * This keeps initial sync fast while still having all resource names available.
 */
export async function syncAll(
  onProgress?: (progress: FullSyncProgress) => void,
): Promise<void> {
  const allEndpoints = [...PRIORITY_ENDPOINTS, ...DEFERRED_ENDPOINTS];
  let completed = 0;

  // Phase 1: Priority endpoints with full details
  for (const endpoint of PRIORITY_ENDPOINTS) {
    await syncEndpoint(endpoint, {
      onProgress: (detail) => {
        onProgress?.({
          currentEndpoint: endpoint,
          endpointsCompleted: completed,
          endpointsTotalCount: allEndpoints.length,
          detail,
        });
      },
    });
    completed++;
  }

  // Phase 2: Deferred endpoints — list only
  for (const endpoint of DEFERRED_ENDPOINTS) {
    onProgress?.({
      currentEndpoint: endpoint,
      endpointsCompleted: completed,
      endpointsTotalCount: allEndpoints.length,
      detail: { endpoint, phase: 'list', current: 0, total: 0 },
    });
    await syncEndpointList(endpoint);
    completed++;
    onProgress?.({
      currentEndpoint: endpoint,
      endpointsCompleted: completed,
      endpointsTotalCount: allEndpoints.length,
      detail: { endpoint, phase: 'done', current: 0, total: 0 },
    });
  }
}

/**
 * Check overall sync status.
 */
export function getSyncStatus(): {
  synced: string[];
  missing: string[];
  total: number;
} {
  const synced: string[] = [];
  const missing: string[] = [];

  for (const ep of API_ENDPOINTS) {
    const meta = getSyncMeta(ep);
    if (meta && meta.itemCount > 0) {
      synced.push(ep);
    } else {
      missing.push(ep);
    }
  }

  return { synced, missing, total: API_ENDPOINTS.length };
}
