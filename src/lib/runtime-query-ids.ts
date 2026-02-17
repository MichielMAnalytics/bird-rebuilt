import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

const DEFAULT_CACHE_FILENAME = 'query-ids-cache.json';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const DISCOVERY_PAGES = [
  'https://x.com/?lang=en',
  'https://x.com/explore',
  'https://x.com/notifications',
  'https://x.com/settings/profile',
];

const BUNDLE_URL_REGEX =
  /https:\/\/abs\.twimg\.com\/responsive-web\/client-web(?:-legacy)?\/[A-Za-z0-9.-]+\.js/g;

const QUERY_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

interface OperationPattern {
  regex: RegExp;
  operationGroup: number;
  queryIdGroup: number;
}

const OPERATION_PATTERNS: OperationPattern[] = [
  {
    regex: /e\.exports=\{queryId\s*:\s*["']([^"']+)["']\s*,\s*operationName\s*:\s*["']([^"']+)["']/gs,
    operationGroup: 2,
    queryIdGroup: 1,
  },
  {
    regex: /e\.exports=\{operationName\s*:\s*["']([^"']+)["']\s*,\s*queryId\s*:\s*["']([^"']+)["']/gs,
    operationGroup: 1,
    queryIdGroup: 2,
  },
  {
    regex: /operationName\s*[:=]\s*["']([^"']+)["'](.{0,4000}?)queryId\s*[:=]\s*["']([^"']+)["']/gs,
    operationGroup: 1,
    queryIdGroup: 3,
  },
  {
    regex: /queryId\s*[:=]\s*["']([^"']+)["'](.{0,4000}?)operationName\s*[:=]\s*["']([^"']+)["']/gs,
    operationGroup: 3,
    queryIdGroup: 1,
  },
];

const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Snapshot {
  fetchedAt: string;
  ttlMs: number;
  ids: Record<string, string>;
  discovery: {
    pages: string[];
    bundles: string[];
  };
}

export interface SnapshotInfo {
  snapshot: Snapshot;
  cachePath: string;
  ageMs: number;
  isFresh: boolean;
}

interface DiscoveredEntry {
  queryId: string;
  bundle: string;
}

type FetchImpl = typeof fetch;

export interface RuntimeQueryIdStoreOptions {
  fetchImpl?: FetchImpl;
  ttlMs?: number;
  cachePath?: string;
}

export interface RuntimeQueryIdStore {
  cachePath: string;
  ttlMs: number;
  getSnapshotInfo: () => Promise<SnapshotInfo | null>;
  getQueryId: (operationName: string) => Promise<string | null>;
  refresh: (
    operationNames: string[],
    opts?: { force?: boolean }
  ) => Promise<SnapshotInfo | null>;
  clearMemory: () => void;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function fetchText(fetchImpl: FetchImpl, url: string): Promise<string> {
  const response = await fetchImpl(url, { headers: HEADERS });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status} for ${url}: ${body.slice(0, 120)}`);
  }
  return response.text();
}

function resolveDefaultCachePath(): string {
  const override = process.env.BIRD_QUERY_IDS_CACHE;
  if (override && override.trim().length > 0) {
    return path.resolve(override.trim());
  }
  return path.join(homedir(), '.config', 'bird', DEFAULT_CACHE_FILENAME);
}

function parseSnapshot(raw: unknown): Snapshot | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const fetchedAt = typeof record.fetchedAt === 'string' ? record.fetchedAt : null;
  const ttlMs =
    typeof record.ttlMs === 'number' && Number.isFinite(record.ttlMs)
      ? record.ttlMs
      : null;
  const ids =
    record.ids && typeof record.ids === 'object' ? record.ids : null;
  const discovery =
    record.discovery && typeof record.discovery === 'object'
      ? record.discovery
      : null;

  if (!fetchedAt || !ttlMs || !ids || !discovery) {
    return null;
  }

  const disc = discovery as Record<string, unknown>;
  const pages = Array.isArray(disc.pages) ? disc.pages : null;
  const bundles = Array.isArray(disc.bundles) ? disc.bundles : null;

  if (!pages || !bundles) {
    return null;
  }

  const normalizedIds: Record<string, string> = {};
  for (const [key, value] of Object.entries(ids as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      normalizedIds[key] = value.trim();
    }
  }

  return {
    fetchedAt,
    ttlMs,
    ids: normalizedIds,
    discovery: {
      pages: pages.filter((p): p is string => typeof p === 'string'),
      bundles: bundles.filter((b): b is string => typeof b === 'string'),
    },
  };
}

async function readSnapshotFromDisk(cachePath: string): Promise<Snapshot | null> {
  try {
    const raw = await readFile(cachePath, 'utf8');
    return parseSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeSnapshotToDisk(
  cachePath: string,
  snapshot: Snapshot
): Promise<void> {
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
}

async function discoverBundles(fetchImpl: FetchImpl): Promise<string[]> {
  const bundles = new Set<string>();

  for (const page of DISCOVERY_PAGES) {
    try {
      const html = await fetchText(fetchImpl, page);
      for (const match of html.matchAll(BUNDLE_URL_REGEX)) {
        bundles.add(match[0]);
      }
    } catch {
      // ignore discovery page failures; other pages often work
    }
  }

  const discovered = [...bundles];
  if (discovered.length === 0) {
    throw new Error(
      'No client bundles discovered; x.com layout may have changed.'
    );
  }
  return discovered;
}

function extractOperations(
  bundleContents: string,
  bundleLabel: string,
  targets: Set<string>,
  discovered: Map<string, DiscoveredEntry>
): void {
  for (const pattern of OPERATION_PATTERNS) {
    pattern.regex.lastIndex = 0;
    while (true) {
      const match = pattern.regex.exec(bundleContents);
      if (match === null) {
        break;
      }

      const operationName = match[pattern.operationGroup];
      const queryId = match[pattern.queryIdGroup];

      if (!operationName || !queryId) {
        continue;
      }
      if (!targets.has(operationName)) {
        continue;
      }
      if (!QUERY_ID_REGEX.test(queryId)) {
        continue;
      }
      if (discovered.has(operationName)) {
        continue;
      }

      discovered.set(operationName, { queryId, bundle: bundleLabel });

      if (discovered.size === targets.size) {
        return;
      }
    }
  }
}

async function fetchAndExtract(
  fetchImpl: FetchImpl,
  bundleUrls: string[],
  targets: Set<string>
): Promise<Map<string, DiscoveredEntry>> {
  const discovered = new Map<string, DiscoveredEntry>();
  const CONCURRENCY = 6;

  for (let i = 0; i < bundleUrls.length; i += CONCURRENCY) {
    const chunk = bundleUrls.slice(i, i + CONCURRENCY);

    await Promise.all(
      chunk.map(async (url) => {
        if (discovered.size === targets.size) {
          return;
        }
        const label = url.split('/').at(-1) ?? url;
        try {
          const js = await fetchText(fetchImpl, url);
          extractOperations(js, label, targets, discovered);
        } catch {
          // ignore failed bundles
        }
      })
    );

    if (discovered.size === targets.size) {
      break;
    }
  }

  return discovered;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRuntimeQueryIdStore(
  options: RuntimeQueryIdStoreOptions = {}
): RuntimeQueryIdStore {
  const fetchImpl = options.fetchImpl ?? fetch;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const cachePath = options.cachePath
    ? path.resolve(options.cachePath)
    : resolveDefaultCachePath();

  let memorySnapshot: Snapshot | null = null;
  let loadOnce: Promise<Snapshot | null> | null = null;
  let refreshInFlight: Promise<SnapshotInfo | null> | null = null;

  const loadSnapshot = async (): Promise<Snapshot | null> => {
    if (memorySnapshot) {
      return memorySnapshot;
    }
    if (!loadOnce) {
      loadOnce = (async () => {
        const fromDisk = await readSnapshotFromDisk(cachePath);
        memorySnapshot = fromDisk;
        return fromDisk;
      })();
    }
    return loadOnce;
  };

  const getSnapshotInfo = async (): Promise<SnapshotInfo | null> => {
    const snapshot = await loadSnapshot();
    if (!snapshot) {
      return null;
    }
    const fetchedAtMs = new Date(snapshot.fetchedAt).getTime();
    const ageMs = Number.isFinite(fetchedAtMs)
      ? Math.max(0, Date.now() - fetchedAtMs)
      : Number.POSITIVE_INFINITY;
    const effectiveTtl = Number.isFinite(snapshot.ttlMs)
      ? snapshot.ttlMs
      : ttlMs;
    const isFresh = ageMs <= effectiveTtl;
    return { snapshot, cachePath, ageMs, isFresh };
  };

  const getQueryId = async (
    operationName: string
  ): Promise<string | null> => {
    const info = await getSnapshotInfo();
    if (!info) {
      return null;
    }
    return info.snapshot.ids[operationName] ?? null;
  };

  const refresh = async (
    operationNames: string[],
    opts: { force?: boolean } = {}
  ): Promise<SnapshotInfo | null> => {
    if (refreshInFlight) {
      return refreshInFlight;
    }

    refreshInFlight = (async () => {
      const current = await getSnapshotInfo();
      if (!opts.force && current?.isFresh) {
        return current;
      }

      const targets = new Set(operationNames);
      const bundleUrls = await discoverBundles(fetchImpl);
      const discovered = await fetchAndExtract(fetchImpl, bundleUrls, targets);

      if (discovered.size === 0) {
        return current ?? null;
      }

      const ids: Record<string, string> = {};
      for (const name of operationNames) {
        const entry = discovered.get(name);
        if (entry?.queryId) {
          ids[name] = entry.queryId;
        }
      }

      const snapshot: Snapshot = {
        fetchedAt: new Date().toISOString(),
        ttlMs,
        ids,
        discovery: {
          pages: [...DISCOVERY_PAGES],
          bundles: bundleUrls.map((url) => url.split('/').at(-1) ?? url),
        },
      };

      await writeSnapshotToDisk(cachePath, snapshot);
      memorySnapshot = snapshot;
      return getSnapshotInfo();
    })().finally(() => {
      refreshInFlight = null;
    });

    return refreshInFlight;
  };

  return {
    cachePath,
    ttlMs,
    getSnapshotInfo,
    getQueryId,
    refresh,
    clearMemory() {
      memorySnapshot = null;
      loadOnce = null;
    },
  };
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const runtimeQueryIds = createRuntimeQueryIdStore();
