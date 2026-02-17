export interface Credentials {
  authToken: string;
  ct0: string;
}

export function resolveCredentials(options: { authToken?: string; ct0?: string }): Credentials {
  const authToken = options.authToken || process.env.AUTH_TOKEN || process.env.TWITTER_AUTH_TOKEN;
  const ct0 = options.ct0 || process.env.CT0 || process.env.TWITTER_CT0;

  if (!authToken || !ct0) {
    const missing: string[] = [];
    if (!authToken) missing.push('auth_token (--auth-token or AUTH_TOKEN env var)');
    if (!ct0) missing.push('ct0 (--ct0 or CT0 env var)');
    throw new Error(
      `Missing credentials: ${missing.join(', ')}\n\n` +
      'To get your cookies:\n' +
      '1. Open x.com in your browser\n' +
      '2. Open DevTools (F12) > Application > Cookies > https://x.com\n' +
      '3. Copy the values of "auth_token" and "ct0"\n' +
      '4. Set them as env vars: export AUTH_TOKEN=xxx CT0=xxx\n' +
      '   Or pass as flags: --auth-token xxx --ct0 xxx'
    );
  }

  return { authToken, ct0 };
}
