const BASE_URL = 'https://www.dnd5eapi.co/api/2014';

export const API_ENDPOINTS = [
  'ability-scores',
  'alignments',
  'backgrounds',
  'classes',
  'conditions',
  'damage-types',
  'equipment',
  'equipment-categories',
  'feats',
  'features',
  'languages',
  'magic-items',
  'magic-schools',
  'monsters',
  'proficiencies',
  'races',
  'rule-sections',
  'rules',
  'skills',
  'spells',
  'subclasses',
  'subraces',
  'traits',
  'weapon-properties',
] as const;

export type ApiEndpoint = (typeof API_ENDPOINTS)[number];

type ListResponse = {
  count: number;
  results: { index: string; name: string; url: string }[];
};

/**
 * Fetch the list of items for an endpoint.
 * Returns { count, results: [{ index, name, url }] }
 */
export async function fetchList(endpoint: ApiEndpoint): Promise<ListResponse> {
  const res = await fetch(`${BASE_URL}/${endpoint}`);
  if (!res.ok) {
    throw new Error(`API error ${res.status} on GET /${endpoint}`);
  }
  return res.json();
}

/**
 * Fetch a single resource detail by endpoint and index key.
 * Returns the full JSON object for that resource.
 */
export async function fetchDetail(
  endpoint: ApiEndpoint,
  indexKey: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/${endpoint}/${encodeURIComponent(indexKey)}`);
  if (!res.ok) {
    throw new Error(`API error ${res.status} on GET /${endpoint}/${indexKey}`);
  }
  return res.json();
}

/**
 * Fetch all detail records for an endpoint (list → detail for each).
 * Fetches in parallel batches to avoid overwhelming the API.
 */
export async function fetchAllDetails(
  endpoint: ApiEndpoint,
  onProgress?: (done: number, total: number) => void,
): Promise<{ index: string; name: string; data: Record<string, unknown> }[]> {
  const list = await fetchList(endpoint);
  const results: { index: string; name: string; data: Record<string, unknown> }[] = [];

  const BATCH_SIZE = 10;
  for (let i = 0; i < list.results.length; i += BATCH_SIZE) {
    const batch = list.results.slice(i, i + BATCH_SIZE);
    const details = await Promise.all(
      batch.map(async (item) => {
        const data = await fetchDetail(endpoint, item.index);
        return { index: item.index, name: item.name, data };
      }),
    );
    results.push(...details);
    onProgress?.(results.length, list.count);
  }

  return results;
}
