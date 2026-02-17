export function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, '').trim();
}
