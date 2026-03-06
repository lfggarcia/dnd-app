import { useState, useEffect, useCallback, useRef } from 'react';
import { runMigrations } from '../database';
import { seedSpanishTranslations } from '../services/translationSeed';
import { seedCustomSubclasses } from '../services/subclassSeed';
import { seedCustomBackgrounds } from '../services/backgroundSeed';
import { syncAll, getSyncStatus, type FullSyncProgress } from '../services/syncService';

type DbStatus = 'initializing' | 'ready' | 'syncing' | 'error';

type UseDatabase = {
  status: DbStatus;
  error: string | null;
  progress: FullSyncProgress | null;
  syncNow: () => Promise<void>;
  syncStatus: { synced: string[]; missing: string[]; total: number } | null;
};

/**
 * Hook to initialize the database on app startup.
 * Runs migrations and seeds translations.
 * Call syncNow() to trigger API data fetch.
 */
export function useDatabase(): UseDatabase {
  const [status, setStatus] = useState<DbStatus>('initializing');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<FullSyncProgress | null>(null);
  const [syncStat, setSyncStat] = useState<UseDatabase['syncStatus']>(null);
  const initializedRef = useRef(false);

  // Initialize DB on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      runMigrations();
      seedSpanishTranslations();
      seedCustomSubclasses();
      seedCustomBackgrounds();
      setStatus('ready');
      setSyncStat(getSyncStatus());
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'DB initialization failed');
    }
  }, []);

  // Manual sync trigger
  const syncNow = useCallback(async () => {
    if (status === 'syncing') return;
    setStatus('syncing');
    setError(null);

    try {
      await syncAll((p) => setProgress(p));
      setStatus('ready');
      setSyncStat(getSyncStatus());
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setProgress(null);
    }
  }, [status]);

  return { status, error, progress, syncNow, syncStatus: syncStat };
}
