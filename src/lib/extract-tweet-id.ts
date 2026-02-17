export function extractTweetId(input: string): string {
  const trimmed = input.trim();
  // If it's just digits, return as-is
  if (/^\d+$/.test(trimmed)) return trimmed;
  // Try to extract from URL like https://x.com/user/status/1234567890
  const match = trimmed.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  if (match) return match[1];
  throw new Error(`Cannot extract tweet ID from: ${input}`);
}
