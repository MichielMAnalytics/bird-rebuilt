import { randomBytes } from 'node:crypto';
import ClientTransaction, { handleXMigration } from 'x-client-transaction-id';

let clientTransaction: ClientTransaction | null = null;
let initPromise: Promise<void> | null = null;
let lastInitAt = 0;
const TTL_MS = 30 * 60 * 1000; // 30 minutes

async function ensureInitialized(): Promise<void> {
  const now = Date.now();
  const isStale = now - lastInitAt > TTL_MS;

  if (clientTransaction && !isStale) return;

  if (!initPromise || isStale) {
    initPromise = (async () => {
      try {
        const document = await handleXMigration();
        clientTransaction = await ClientTransaction.create(document);
        lastInitAt = Date.now();
      } catch (err) {
        console.error('[transaction-id] Failed to initialize:', (err as Error).message);
        // Keep old instance if we had one; otherwise leave null for fallback
      }
    })();
  }

  await initPromise;
}

export async function createTransactionId(method: string, path: string): Promise<string> {
  try {
    await ensureInitialized();
    if (clientTransaction) {
      return await clientTransaction.generateTransactionId(method, path);
    }
  } catch {}

  // Fallback: random hex (current behavior)
  return randomBytes(16).toString('hex');
}

export async function initTransactionClient(): Promise<void> {
  await ensureInitialized();
}
