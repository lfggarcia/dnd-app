import { getDB } from './connection';

export type Resource = {
  id: number;
  endpoint: string;
  index_key: string;
  name: string;
  data: string;
};

export type Translation = {
  endpoint: string;
  index_key: string;
  field_path: string;
  lang: string;
  value: string;
};

// ─── Resources ───────────────────────────────────────────

export function upsertResource(
  endpoint: string,
  indexKey: string,
  name: string,
  data: object,
): void {
  const db = getDB();
  db.executeSync(
    `INSERT INTO resources (endpoint, index_key, name, data)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(endpoint, index_key)
     DO UPDATE SET name = excluded.name, data = excluded.data`,
    [endpoint, indexKey, name, JSON.stringify(data)],
  );
}

export function upsertResourceBatch(
  items: { endpoint: string; indexKey: string; name: string; data: object }[],
): void {
  const db = getDB();
  db.executeSync('BEGIN TRANSACTION');
  try {
    for (const item of items) {
      db.executeSync(
        `INSERT INTO resources (endpoint, index_key, name, data)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(endpoint, index_key)
         DO UPDATE SET name = excluded.name, data = excluded.data`,
        [item.endpoint, item.indexKey, item.name, JSON.stringify(item.data)],
      );
    }
    db.executeSync('COMMIT');
  } catch (error) {
    db.executeSync('ROLLBACK');
    throw error;
  }
}

export function getResource(
  endpoint: string,
  indexKey: string,
): Resource | null {
  const db = getDB();
  const result = db.executeSync(
    'SELECT * FROM resources WHERE endpoint = ? AND index_key = ?',
    [endpoint, indexKey],
  );
  return (result.rows?.[0] as Resource) ?? null;
}

export function getResourcesByEndpoint(endpoint: string): Resource[] {
  const db = getDB();
  const result = db.executeSync(
    'SELECT * FROM resources WHERE endpoint = ? ORDER BY name',
    [endpoint],
  );
  return (result.rows as Resource[]) ?? [];
}

export function getFirstResourceByEndpoint(endpoint: string): Resource | null {
  const db = getDB();
  const result = db.executeSync(
    'SELECT * FROM resources WHERE endpoint = ? ORDER BY name LIMIT 1',
    [endpoint],
  );
  return (result.rows?.[0] as Resource) ?? null;
}

export function getResourceCount(endpoint: string): number {
  const db = getDB();
  const result = db.executeSync(
    'SELECT COUNT(*) as cnt FROM resources WHERE endpoint = ?',
    [endpoint],
  );
  return (result.rows?.[0]?.cnt as number) ?? 0;
}

export function searchResources(
  endpoint: string,
  query: string,
): Resource[] {
  const db = getDB();
  const result = db.executeSync(
    'SELECT * FROM resources WHERE endpoint = ? AND name LIKE ? ORDER BY name',
    [endpoint, `%${query}%`],
  );
  return (result.rows as Resource[]) ?? [];
}

// ─── Translations ────────────────────────────────────────

export function upsertTranslation(
  endpoint: string,
  indexKey: string,
  fieldPath: string,
  lang: string,
  value: string,
): void {
  const db = getDB();
  db.executeSync(
    `INSERT INTO translations (endpoint, index_key, field_path, lang, value)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint, index_key, field_path, lang)
     DO UPDATE SET value = excluded.value`,
    [endpoint, indexKey, fieldPath, lang, value],
  );
}

export function upsertTranslationBatch(translations: Translation[]): void {
  const db = getDB();
  db.executeSync('BEGIN TRANSACTION');
  try {
    for (const t of translations) {
      db.executeSync(
        `INSERT INTO translations (endpoint, index_key, field_path, lang, value)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(endpoint, index_key, field_path, lang)
         DO UPDATE SET value = excluded.value`,
        [t.endpoint, t.index_key, t.field_path, t.lang, t.value],
      );
    }
    db.executeSync('COMMIT');
  } catch (error) {
    db.executeSync('ROLLBACK');
    throw error;
  }
}

export function getTranslation(
  endpoint: string,
  indexKey: string,
  fieldPath: string,
  lang: string,
): string | null {
  const db = getDB();
  const result = db.executeSync(
    `SELECT value FROM translations
     WHERE endpoint = ? AND index_key = ? AND field_path = ? AND lang = ?`,
    [endpoint, indexKey, fieldPath, lang],
  );
  return (result.rows?.[0]?.value as string) ?? null;
}

export function getTranslationsForResource(
  endpoint: string,
  indexKey: string,
  lang: string,
): Record<string, string> {
  const db = getDB();
  const result = db.executeSync(
    `SELECT field_path, value FROM translations
     WHERE endpoint = ? AND index_key = ? AND lang = ?`,
    [endpoint, indexKey, lang],
  );
  const map: Record<string, string> = {};
  if (result.rows) {
    for (const row of result.rows) {
      map[row.field_path as string] = row.value as string;
    }
  }
  return map;
}

// ─── Sync Meta ───────────────────────────────────────────

export function setSyncMeta(
  endpoint: string,
  itemCount: number,
): void {
  const db = getDB();
  db.executeSync(
    `INSERT INTO sync_meta (endpoint, last_synced_at, item_count)
     VALUES (?, datetime('now'), ?)
     ON CONFLICT(endpoint)
     DO UPDATE SET last_synced_at = datetime('now'), item_count = excluded.item_count`,
    [endpoint, itemCount],
  );
}

export function getSyncMeta(
  endpoint: string,
): { lastSyncedAt: string; itemCount: number } | null {
  const db = getDB();
  const result = db.executeSync(
    'SELECT last_synced_at, item_count FROM sync_meta WHERE endpoint = ?',
    [endpoint],
  );
  if (!result.rows?.[0]) return null;
  return {
    lastSyncedAt: result.rows[0].last_synced_at as string,
    itemCount: result.rows[0].item_count as number,
  };
}

export function getAllSyncMeta(): {
  endpoint: string;
  lastSyncedAt: string;
  itemCount: number;
}[] {
  const db = getDB();
  const result = db.executeSync('SELECT * FROM sync_meta ORDER BY endpoint');
  return (
    result.rows?.map((row) => ({
      endpoint: row.endpoint as string,
      lastSyncedAt: row.last_synced_at as string,
      itemCount: row.item_count as number,
    })) ?? []
  );
}
