import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';

const SESSION_PATH = path.join(homedir(), '.config', 'bird', 'session.json');

interface SessionData {
  clientUuid: string;
  clientDeviceId: string;
  createdAt: string;
}

let cached: SessionData | null = null;

async function readSession(): Promise<SessionData | null> {
  try {
    const raw = await readFile(SESSION_PATH, 'utf8');
    const data = JSON.parse(raw);
    if (data?.clientUuid && data?.clientDeviceId) return data as SessionData;
  } catch {}
  return null;
}

async function writeSession(data: SessionData): Promise<void> {
  await mkdir(path.dirname(SESSION_PATH), { recursive: true });
  await writeFile(SESSION_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export async function getSessionIdentity(): Promise<{ clientUuid: string; clientDeviceId: string }> {
  if (cached) return cached;

  const existing = await readSession();
  if (existing) {
    cached = existing;
    return existing;
  }

  const fresh: SessionData = {
    clientUuid: randomUUID(),
    clientDeviceId: randomUUID(),
    createdAt: new Date().toISOString(),
  };

  await writeSession(fresh).catch(() => {});
  cached = fresh;
  return fresh;
}
