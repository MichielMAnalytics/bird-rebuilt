import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let defaultFeatureOverrides: Record<string, boolean> = {};
try {
  defaultFeatureOverrides = require('./features.json');
} catch {
  // features.json not found or invalid — use empty defaults
}

const CACHE_DIR = path.join(os.homedir(), '.config', 'bird');
const CACHE_PATH = path.join(CACHE_DIR, 'features.json');

interface FeatureOverridesConfig {
  global?: Record<string, boolean>;
  [setName: string]: Record<string, boolean> | undefined;
}

let cachedOverrides: FeatureOverridesConfig | null = null;

/**
 * Load feature overrides from three sources (in priority order):
 * 1. Bundled defaults (src/lib/features.json)
 * 2. File cache (~/.config/bird/features.json)
 * 3. Environment variable BIRD_FEATURE_OVERRIDES (JSON string)
 *
 * The file cache supports both flat (Record<string, boolean>) for backward
 * compatibility and structured ({ global: {...}, search: {...} }) formats.
 */
export function loadFeatureOverrides(): FeatureOverridesConfig {
  if (cachedOverrides) return cachedOverrides;

  const result: FeatureOverridesConfig = {};

  // 1. Bundled defaults go into global
  if (Object.keys(defaultFeatureOverrides).length > 0) {
    result.global = { ...defaultFeatureOverrides };
  }

  // 2. File cache
  try {
    if (fs.existsSync(CACHE_PATH)) {
      const raw = fs.readFileSync(CACHE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);

      if (parsed && typeof parsed === 'object') {
        // Detect flat vs structured format
        const isFlat = Object.values(parsed).every((v) => typeof v === 'boolean');
        if (isFlat) {
          // Flat format: treat all entries as global overrides
          result.global = { ...(result.global ?? {}), ...(parsed as Record<string, boolean>) };
        } else {
          // Structured format: merge each set
          for (const [key, value] of Object.entries(parsed)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              result[key] = { ...(result[key] ?? {}), ...(value as Record<string, boolean>) };
            }
          }
        }
      }
    }
  } catch {
    // Ignore cache read errors
  }

  // 3. Environment variable
  const envOverrides = process.env.BIRD_FEATURE_OVERRIDES;
  if (envOverrides) {
    try {
      const parsed = JSON.parse(envOverrides);
      if (parsed && typeof parsed === 'object') {
        const isFlat = Object.values(parsed).every((v) => typeof v === 'boolean');
        if (isFlat) {
          result.global = { ...(result.global ?? {}), ...(parsed as Record<string, boolean>) };
        } else {
          for (const [key, value] of Object.entries(parsed)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              result[key] = { ...(result[key] ?? {}), ...(value as Record<string, boolean>) };
            }
          }
        }
      }
    } catch {
      // Ignore malformed env var
    }
  }

  cachedOverrides = result;
  return result;
}

/**
 * Apply global + set-specific overrides to a base feature set.
 * Used by each build*Features() function in twitter-client-features.ts.
 */
export function applyFeatureOverrides(
  setName: string,
  base: Record<string, boolean>
): Record<string, boolean> {
  const overrides = loadFeatureOverrides();
  return {
    ...base,
    ...(overrides.global ?? {}),
    ...(overrides[setName] ?? {}),
  };
}

/**
 * Clear the in-memory overrides cache. Call this if the config file
 * or environment has changed and you need to reload.
 */
export function clearFeatureOverridesCache(): void {
  cachedOverrides = null;
}

/**
 * Save feature overrides to the file cache.
 * Kept for backward compatibility with existing callers.
 */
export function saveFeatureOverrides(overrides: Record<string, boolean>): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_PATH, JSON.stringify(overrides, null, 2), 'utf-8');
    clearFeatureOverridesCache();
  } catch (err) {
    throw new Error(`Failed to save feature overrides cache: ${err}`);
  }
}
