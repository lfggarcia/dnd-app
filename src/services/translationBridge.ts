import { getResource, getTranslation, getTranslationsForResource } from '../database';
import type { ApiEndpoint } from '../services/api5e';
import type { Lang } from '../i18n';

/**
 * Get a translated field for a D&D 5e resource.
 * Checks the translations table first (any language), then falls back
 * to the raw API resource data.
 */
export function getTranslatedField(
  endpoint: ApiEndpoint,
  indexKey: string,
  fieldPath: string,
  lang: Lang,
): string | null {
  // Check translations table first (works for all languages including EN)
  const translated = getTranslation(endpoint, indexKey, fieldPath, lang);
  if (translated) return translated;

  // Fallback to raw resource data
  const resource = getResource(endpoint, indexKey);
  if (!resource) return null;
  const data = (() => { try { return JSON.parse(resource.data); } catch { return null; } })();
  if (!data) return null;
  return resolveFieldPath(data, fieldPath);
}

/**
 * Get a resource with all available translations applied.
 * Returns the raw JSON with translated fields merged in.
 */
export function getTranslatedResource(
  endpoint: ApiEndpoint,
  indexKey: string,
  lang: Lang,
): Record<string, unknown> | null {
  const resource = getResource(endpoint, indexKey);
  if (!resource) return null;

  const data = (() => { try { return JSON.parse(resource.data) as Record<string, unknown>; } catch { return null; } })();

  if (!data) return null;
  if (lang === 'en') return data;

  // Get all translations for this resource + language
  const translations = getTranslationsForResource(endpoint, indexKey, lang);

  // Apply translations on top of English data
  const result = { ...data };
  for (const [path, value] of Object.entries(translations)) {
    setFieldPath(result, path, value);
  }

  return result;
}

/**
 * Get the translated name of a resource.
 * This is the most common use case.
 */
export function getTranslatedName(
  endpoint: ApiEndpoint,
  indexKey: string,
  lang: Lang,
): string {
  return getTranslatedField(endpoint, indexKey, 'name', lang) ?? indexKey;
}

// ─── Helpers ───────────────────────────────────────────────

function resolveFieldPath(obj: Record<string, unknown>, path: string): string | null {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : null;
}

function setFieldPath(obj: Record<string, unknown>, path: string, value: string): void {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] == null || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}
