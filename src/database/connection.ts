import { open, type DB } from '@op-engineering/op-sqlite';

const DB_NAME = 'dnd5e.db';

let db: DB | null = null;

export function getDB(): DB {
  if (!db) {
    db = open({ name: DB_NAME });
  }
  return db;
}

export function closeDB(): void {
  if (db) {
    db.close();
    db = null;
  }
}
