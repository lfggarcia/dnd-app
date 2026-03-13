/**
 * imageStorageService — PF-01
 *
 * Saves character portrait and expression images to the local filesystem
 * so that SQLite only stores file URIs (not base64 blobs).
 *
 * Without this service: 4 chars × 23 images × ~3 MB ≈ 276 MB in DB → crash.
 * With this service:    file URIs in DB + ~18 MB in RNFS.DocumentDirectoryPath.
 *
 * PF-01 compression: images are resized to 512px wide at 70% JPEG quality
 * using @oguzhnatly/react-native-image-manipulator → reduces ~3 MB originals to ~150 KB.
 */
import RNFS from 'react-native-fs';
import RNImageManipulator from '@oguzhnatly/react-native-image-manipulator';

const PORTRAITS_DIR   = `${RNFS.DocumentDirectoryPath}/portraits`;
const EXPRESSIONS_DIR = `${RNFS.DocumentDirectoryPath}/expressions`;

// ── Helpers ────────────────────────────────────────────────

async function ensureDir(dir: string): Promise<void> {
  if (!(await RNFS.exists(dir))) {
    await RNFS.mkdir(dir);
  }
}

/** Strips the `data:image/...;base64,` header if present. */
function cleanBase64(raw: string): string {
  return raw.replace(/^data:image\/[a-z+]+;base64,/, '');
}

// ── Public API ─────────────────────────────────────────────

/**
 * Saves a base64 portrait image to the filesystem and returns the `file://` URI.
 *
 * @param characterId  Unique ID of the character (NI-09).
 * @param base64Data   Raw base64 string or `data:image/...` data URI.
 * @param expressionKey  Omit for the base portrait; pass e.g. `'angry'` for expressions.
 */
export async function savePortraitToFS(
  characterId: string,
  base64Data: string,
  expressionKey?: string,
): Promise<string> {
  const dir = expressionKey ? EXPRESSIONS_DIR : PORTRAITS_DIR;
  await ensureDir(dir);

  const filename = expressionKey
    ? `${characterId}_${expressionKey}.jpg`
    : `${characterId}_base.jpg`;
  const filePath = `${dir}/${filename}`;

  // Write original to a temp file first so the manipulator can read it
  const tempPath = `${dir}/${characterId}_tmp_${Date.now()}.jpg`;
  await RNFS.writeFile(tempPath, cleanBase64(base64Data), 'base64');

  // Compress to 512px wide, 70% JPEG (PF-01: ~3 MB → ~150 KB, 15× reduction)
  try {
    const result = await RNImageManipulator.manipulate(
      `file://${tempPath}`,
      [{ resize: { width: 512 } }],
      { compress: 0.7, format: 'jpeg' },
    );
    const compressedBase64 = await RNFS.readFile(result.uri.replace('file://', ''), 'base64');
    await RNFS.writeFile(filePath, compressedBase64, 'base64');
  } catch {
    // Compression unavailable — fall back to original (still saves to FS, not DB)
    await RNFS.moveFile(tempPath, filePath);
    return `file://${filePath}`;
  } finally {
    RNFS.unlink(tempPath).catch(() => undefined);
  }

  return `file://${filePath}`;
}

/**
 * Saves all expression variants for a character and returns a map of
 * `expressionKey → file://` URIs.
 */
export async function saveExpressionsToFS(
  characterId: string,
  expressions: Record<string, string>,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  await Promise.all(
    Object.entries(expressions).map(async ([key, base64]) => {
      result[key] = await savePortraitToFS(characterId, base64, key);
    }),
  );
  return result;
}

/**
 * Deletes all local images for a character (call on permanent death).
 */
export async function deleteCharacterImages(characterId: string): Promise<void> {
  try {
    const portraitPath = `${PORTRAITS_DIR}/${characterId}_base.jpg`;
    if (await RNFS.exists(portraitPath)) {
      await RNFS.unlink(portraitPath);
    }
    const exprDir = await RNFS.exists(EXPRESSIONS_DIR);
    if (exprDir) {
      const files = await RNFS.readDir(EXPRESSIONS_DIR);
      await Promise.all(
        files
          .filter(f => f.name.startsWith(`${characterId}_`))
          .map(f => RNFS.unlink(f.path)),
      );
    }
  } catch (e) {
    __DEV__ && console.warn('[imageStorageService] deleteCharacterImages failed', e);
  }
}

/**
 * Returns true if the local file still exists (safe to use as Image source).
 */
export async function portraitExists(localUri: string): Promise<boolean> {
  if (!localUri.startsWith('file://')) return false;
  return RNFS.exists(localUri.slice(7)); // strip 'file://'
}

/**
 * Resolves any portrait value (new file URI or legacy base64) to a source
 * object suitable for `<Image source={...} />`.
 *
 * Retrocompat: saves generated during v1 are raw base64 — still renderable.
 */
export function resolvePortraitSource(
  portrait: string | null | undefined,
): { uri: string } | null {
  if (!portrait) return null;
  if (portrait.startsWith('file://') || portrait.startsWith('http')) {
    return { uri: portrait };
  }
  // Legacy: raw base64 string from before PF-01
  const prefix = 'data:image/jpeg;base64,';
  if (portrait.startsWith('data:')) {
    return { uri: portrait };
  }
  return { uri: `${prefix}${portrait}` };
}
