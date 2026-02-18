import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { getGuestId } from './cookie-jar.js';

const BASE_KEY = '0e6be1f1e21ffc33590b888fd4dc81b19713e570e805d4e5df80a493c9571a05';
const VALIDITY_MS = 5 * 60 * 1000; // 5 minutes

let cachedHeader: string | null = null;
let cachedAt = 0;

export function generateXpff(userAgent: string): string | null {
  const now = Date.now();
  if (cachedHeader && (now - cachedAt) < VALIDITY_MS) return cachedHeader;

  const guestId = getGuestId();
  if (!guestId) return null;

  try {
    const payload = JSON.stringify({
      userAgent,
      webdriver: false,
      hasBeenActive: true,
      created_at: Math.floor(now / 1000),
    });

    // Key = SHA-256(base_key + guest_id)
    const keyMaterial = BASE_KEY + guestId;
    const key = createHash('sha256').update(keyMaterial).digest();

    // AES-256-GCM
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Output: hex(IV + ciphertext + auth_tag)
    cachedHeader = Buffer.concat([iv, encrypted, authTag]).toString('hex');
    cachedAt = now;
    return cachedHeader;
  } catch {
    return null;
  }
}
