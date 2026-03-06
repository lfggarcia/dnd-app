import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getResourcesByEndpoint,
  getResourceCount,
  getResource,
  searchResources,
  type Resource,
} from '../database';
import type { ApiEndpoint } from '../services/api5e';
import { syncEndpoint } from '../services/syncService';
import {
  getTranslatedName,
  getTranslatedResource,
  getTranslatedField,
} from '../services/translationBridge';
import { useI18n } from '../i18n';

// ─── useResourceList ────────────────────────────────────────

type UseResourceListResult<T = Record<string, unknown>> = {
  data: { index: string; name: string; raw: T }[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

/**
 * Hook to get all resources for an endpoint with translated names.
 * Auto-fetches from API if not yet synced.
 */
export function useResourceList(endpoint: ApiEndpoint): UseResourceListResult {
  const { lang } = useI18n();
  const [data, setData] = useState<UseResourceListResult['data']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Check if we have data locally
      let count = getResourceCount(endpoint);

      // If no data, sync from API
      if (count === 0) {
        await syncEndpoint(endpoint);
        count = getResourceCount(endpoint);
      }

      if (!mountedRef.current) return;

      const resources = getResourcesByEndpoint(endpoint);
      const items = resources.map((r) => ({
        index: r.index_key,
        name: getTranslatedName(endpoint, r.index_key, lang),
        raw: JSON.parse(r.data) as Record<string, unknown>,
      }));

      setData(items);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [endpoint, lang]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  return { data, loading, error, refresh: load };
}

// ─── useResourceDetail ──────────────────────────────────────

type UseResourceDetailResult<T = Record<string, unknown>> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

/**
 * Hook to get a single resource with translations applied.
 */
export function useResourceDetail(
  endpoint: ApiEndpoint,
  indexKey: string | null,
): UseResourceDetailResult {
  const { lang } = useI18n();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (!indexKey) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const loadDetail = async () => {
      try {
        let resource = getResource(endpoint, indexKey);

        // If not found, try syncing the endpoint
        if (!resource) {
          await syncEndpoint(endpoint);
          resource = getResource(endpoint, indexKey);
        }

        if (!mountedRef.current) return;

        if (!resource) {
          setError(`Resource not found: ${endpoint}/${indexKey}`);
          setData(null);
        } else {
          const translated = getTranslatedResource(endpoint, indexKey, lang);
          setData(translated);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    loadDetail();

    return () => {
      mountedRef.current = false;
    };
  }, [endpoint, indexKey, lang]);

  return { data, loading, error };
}

// ─── useResourceSearch ──────────────────────────────────────

/**
 * Hook to search resources by name within an endpoint.
 */
export function useResourceSearch(endpoint: ApiEndpoint, query: string) {
  const { lang } = useI18n();
  const [results, setResults] = useState<
    { index: string; name: string }[]
  >([]);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const resources = searchResources(endpoint, query);
    setResults(
      resources.map((r) => ({
        index: r.index_key,
        name: getTranslatedName(endpoint, r.index_key, lang),
      })),
    );
  }, [endpoint, query, lang]);

  return results;
}

// ─── Convenience Hooks ──────────────────────────────────────

export const useRaces = () => useResourceList('races');
export const useClasses = () => useResourceList('classes');
export const useSpells = () => useResourceList('spells');
export const useMonsters = () => useResourceList('monsters');
export const useEquipment = () => useResourceList('equipment');
export const useSkills = () => useResourceList('skills');
export const useConditions = () => useResourceList('conditions');
export const useAlignments = () => useResourceList('alignments');
export const useAbilityScores = () => useResourceList('ability-scores');
export const useBackgrounds = () => useResourceList('backgrounds');
export const useLanguages = () => useResourceList('languages');
export const useSubraces = () => useResourceList('subraces');
export const useSubclasses = () => useResourceList('subclasses');
export const useMagicSchools = () => useResourceList('magic-schools');
export const useDamageTypes = () => useResourceList('damage-types');
export const useFeats = () => useResourceList('feats');
export const useTraits = () => useResourceList('traits');
export const useMagicItems = () => useResourceList('magic-items');
