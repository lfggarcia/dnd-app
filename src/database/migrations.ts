import { getDB } from './connection';

const CURRENT_VERSION = 1;

const migrations: Record<number, string[]> = {
  1: [
    // Core resource table — stores raw JSON from the 5e API per endpoint
    `CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      index_key TEXT NOT NULL,
      name TEXT NOT NULL,
      data TEXT NOT NULL,
      UNIQUE(endpoint, index_key)
    )`,

    // Translations table — field-level i18n for every resource
    `CREATE TABLE IF NOT EXISTS translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      index_key TEXT NOT NULL,
      field_path TEXT NOT NULL,
      lang TEXT NOT NULL,
      value TEXT NOT NULL,
      UNIQUE(endpoint, index_key, field_path, lang)
    )`,

    // Sync metadata — tracks when each endpoint was last synced
    `CREATE TABLE IF NOT EXISTS sync_meta (
      endpoint TEXT PRIMARY KEY,
      last_synced_at TEXT NOT NULL,
      item_count INTEGER NOT NULL DEFAULT 0
    )`,

    // Indexes for fast lookups
    `CREATE INDEX IF NOT EXISTS idx_resources_endpoint ON resources(endpoint)`,
    `CREATE INDEX IF NOT EXISTS idx_resources_endpoint_index ON resources(endpoint, index_key)`,
    `CREATE INDEX IF NOT EXISTS idx_translations_lookup ON translations(endpoint, index_key, lang)`,
    `CREATE INDEX IF NOT EXISTS idx_translations_lang ON translations(lang)`,
  ],
};

export function runMigrations(): void {
  const db = getDB();

  db.executeSync(
    `CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    )`,
  );

  const result = db.executeSync('SELECT MAX(version) as v FROM schema_version');
  const currentVersion = (result.rows?.[0]?.v as number) ?? 0;

  for (let v = currentVersion + 1; v <= CURRENT_VERSION; v++) {
    const statements = migrations[v];
    if (statements) {
      db.executeSync('BEGIN TRANSACTION');
      try {
        for (const sql of statements) {
          db.executeSync(sql);
        }
        db.executeSync('INSERT INTO schema_version (version) VALUES (?)', [v]);
        db.executeSync('COMMIT');
      } catch (error) {
        db.executeSync('ROLLBACK');
        throw error;
      }
    }
  }
}
