import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

const COOKIE_PATH = path.join(homedir(), '.config', 'bird', 'cookies.json');
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CookieJarData {
  cookies: Record<string, string>;
  collectedAt: string;
}

let jar: Record<string, string> | null = null;
let collectedAt = 0;

async function readJar(): Promise<CookieJarData | null> {
  try {
    const raw = await readFile(COOKIE_PATH, 'utf8');
    const data = JSON.parse(raw);
    if (data?.cookies && typeof data.cookies === 'object') return data as CookieJarData;
  } catch {}
  return null;
}

async function writeJar(data: CookieJarData): Promise<void> {
  await mkdir(path.dirname(COOKIE_PATH), { recursive: true });
  await writeFile(COOKIE_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function parseSetCookieHeaders(headers: Headers): Record<string, string> {
  const cookies: Record<string, string> = {};
  const raw = headers.getSetCookie?.() ?? [];
  for (const cookie of raw) {
    const eqIdx = cookie.indexOf('=');
    if (eqIdx === -1) continue;
    const name = cookie.substring(0, eqIdx).trim();
    const rest = cookie.substring(eqIdx + 1);
    const semiIdx = rest.indexOf(';');
    const value = semiIdx === -1 ? rest.trim() : rest.substring(0, semiIdx).trim();
    if (name && value) cookies[name] = value;
  }
  return cookies;
}

export function updateJarFromResponse(headers: Headers): void {
  const incoming = parseSetCookieHeaders(headers);
  if (Object.keys(incoming).length === 0) return;
  if (!jar) jar = {};
  Object.assign(jar, incoming);
  // persist in background
  writeJar({ cookies: jar, collectedAt: new Date().toISOString() }).catch(() => {});
}

export async function collectBrowserCookies(): Promise<void> {
  const now = Date.now();
  // If we already collected recently, skip
  if (jar && (now - collectedAt) < MAX_AGE_MS) return;

  // Try loading from disk first
  if (!jar) {
    const fromDisk = await readJar();
    if (fromDisk) {
      const diskAge = now - new Date(fromDisk.collectedAt).getTime();
      if (diskAge < MAX_AGE_MS) {
        jar = fromDisk.cookies;
        collectedAt = now - diskAge;
        return;
      }
    }
  }

  // Fetch x.com homepage to collect Set-Cookie headers
  try {
    const response = await fetch('https://x.com/', {
      method: 'GET',
      headers: {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
      },
      redirect: 'follow',
    });

    if (!jar) jar = {};
    const incoming = parseSetCookieHeaders(response.headers);
    Object.assign(jar, incoming);
    collectedAt = Date.now();
    await writeJar({ cookies: jar, collectedAt: new Date().toISOString() }).catch(() => {});
  } catch {
    // Graceful degradation: if we can't collect, use whatever we have
    if (!jar) jar = {};
    collectedAt = Date.now();
  }
}

export function buildCookieHeader(authToken: string, ct0: string): string {
  const parts: string[] = [];

  // Add jar cookies first (browser-collected)
  if (jar) {
    for (const [name, value] of Object.entries(jar)) {
      // Don't duplicate auth_token and ct0 — we add them explicitly
      if (name === 'auth_token' || name === 'ct0') continue;
      parts.push(`${name}=${value}`);
    }
  }

  // Always include auth_token and ct0 (these are the user-provided ones)
  parts.push(`auth_token=${authToken}`);
  parts.push(`ct0=${ct0}`);

  return parts.join('; ');
}

export function getGuestId(): string | null {
  return jar?.['guest_id'] ?? jar?.['guest_id_marketing'] ?? null;
}
