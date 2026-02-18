import { randomBytes, randomUUID } from 'node:crypto';
import { QUERY_IDS, TARGET_QUERY_ID_OPERATIONS, GRAPHQL_API_BASE, API_BASE } from './twitter-client-constants.js';
import { runtimeQueryIds } from './runtime-query-ids.js';
import { getSessionIdentity } from './session-store.js';
import { collectBrowserCookies, buildCookieHeader, updateJarFromResponse } from './cookie-jar.js';
import { createTransactionId, initTransactionClient } from './transaction-id.js';
import { generateXpff } from './xpff.js';

export interface TwitterCredentials {
  authToken: string;
  ct0: string;
}

export interface ClientOptions {
  credentials: TwitterCredentials;
  timeout?: number;
  noJitter?: boolean;
}

export class TwitterClientBase {
  authToken: string;
  ct0: string;
  cookieHeader: string;
  timeoutMs: number | undefined;
  noJitter: boolean;
  clientUuid: string;
  clientDeviceId: string;
  clientUserId?: string;
  /** @internal */ _initialized = false;
  /** @internal */ _initPromise: Promise<void> | null = null;

  constructor(options: ClientOptions) {
    this.authToken = options.credentials.authToken;
    this.ct0 = options.credentials.ct0;
    this.cookieHeader = `auth_token=${this.authToken}; ct0=${this.ct0}`;
    this.timeoutMs = options.timeout;
    this.noJitter = options.noJitter ?? false;
    this.clientUuid = randomUUID();
    this.clientDeviceId = randomUUID();
  }

  async init(): Promise<void> {
    if (this._initialized) return;
    if (!this._initPromise) {
      this._initPromise = (async () => {
        // Load persisted session identity (stops UUID rotation)
        try {
          const session = await getSessionIdentity();
          this.clientUuid = session.clientUuid;
          this.clientDeviceId = session.clientDeviceId;
        } catch {}

        // Collect browser cookies from x.com
        try {
          await collectBrowserCookies();
          this.cookieHeader = buildCookieHeader(this.authToken, this.ct0);
        } catch {}

        // Initialize transaction ID client (fetches x.com homepage + ondemand.s JS)
        try {
          await initTransactionClient();
        } catch {}

        this._initialized = true;
      })();
    }
    await this._initPromise;
  }

  /** @internal */
  async ensureInit(): Promise<void> {
    if (!this._initialized) await this.init();
  }

  async sleep(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  async getQueryId(operationName: string): Promise<string> {
    const cached = await runtimeQueryIds.getQueryId(operationName);
    return cached ?? QUERY_IDS[operationName];
  }

  async refreshQueryIds(): Promise<void> {
    try {
      await runtimeQueryIds.refresh(TARGET_QUERY_ID_OPERATIONS, { force: true });
    } catch {
      // ignore refresh failures
    }
  }

  async withRefreshedQueryIdsOn404<T extends { success: boolean; had404?: boolean }>(
    attempt: () => Promise<T>
  ): Promise<{ result: T; refreshed: boolean }> {
    const firstAttempt = await attempt();
    if (firstAttempt.success || !firstAttempt.had404) {
      return { result: firstAttempt, refreshed: false };
    }
    await this.refreshQueryIds();
    const secondAttempt = await attempt();
    return { result: secondAttempt, refreshed: true };
  }

  async getTweetDetailQueryIds(): Promise<string[]> {
    const primary = await this.getQueryId('TweetDetail');
    return Array.from(new Set([primary, '97JF30KziU00483E_8elBA', 'aFvUsJm2c-oDkJV75blV6g']));
  }

  async getSearchTimelineQueryIds(): Promise<string[]> {
    const primary = await this.getQueryId('SearchTimeline');
    return Array.from(new Set([primary, 'M1jEez78PEfVfbQLvlWMvQ', '5h0kNbk3ii97rmfY6CdgAA', 'Tp1sewRU1AsZpBWhqCZicQ']));
  }

  getBaseHeaders(opts?: { method?: string; path?: string; transactionId?: string }): Record<string, string> {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    const headers: Record<string, string> = {
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9',
      'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
      'x-csrf-token': this.ct0,
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-active-user': 'yes',
      'x-twitter-client-language': 'en',
      'x-client-uuid': this.clientUuid,
      'x-twitter-client-deviceid': this.clientDeviceId,
      'x-client-transaction-id': opts?.transactionId ?? randomBytes(16).toString('hex'),
      'cookie': this.cookieHeader,
      'user-agent': ua,
      'origin': 'https://x.com',
      'referer': 'https://x.com/',
    };
    if (this.clientUserId) {
      headers['x-twitter-client-user-id'] = this.clientUserId;
    }
    // Add X-XP-Forwarded-For if we have a guest_id
    const xpff = generateXpff(ua);
    if (xpff) {
      headers['x-xp-forwarded-for'] = xpff;
    }
    return headers;
  }

  async getBaseHeadersAsync(method: string, urlOrPath: string): Promise<Record<string, string>> {
    await this.ensureInit();
    let apiPath: string;
    try {
      apiPath = new URL(urlOrPath).pathname;
    } catch {
      apiPath = urlOrPath;
    }
    const transactionId = await createTransactionId(method, apiPath);
    return this.getBaseHeaders({ method, path: apiPath, transactionId });
  }

  async getJsonHeadersAsync(method: string, url: string): Promise<Record<string, string>> {
    const base = await this.getBaseHeadersAsync(method, url);
    return { ...base, 'content-type': 'application/json' };
  }

  // Sync versions for backward compat (uses random transaction ID)
  getJsonHeaders(): Record<string, string> {
    return { ...this.getBaseHeaders(), 'content-type': 'application/json' };
  }

  getHeaders(): Record<string, string> {
    return this.getJsonHeaders();
  }

  async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    let response: Response;
    if (!this.timeoutMs || this.timeoutMs <= 0) {
      response = await fetch(url, init);
    } else {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        response = await fetch(url, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    }
    // Capture Set-Cookie from every response to keep jar fresh
    try { updateJarFromResponse(response.headers); } catch {}
    return response;
  }

  // Alias for backward compatibility
  async fetchRaw(url: string, init: RequestInit): Promise<Response> {
    return this.fetchWithTimeout(url, init);
  }

  async ensureClientUserId(): Promise<void> {
    if (this.clientUserId) return;
    // Use REST endpoint like steipete — avoids GraphQL rate limit buckets
    const urls = [
      'https://x.com/i/api/account/settings.json',
      'https://api.twitter.com/1.1/account/settings.json',
      'https://x.com/i/api/account/verify_credentials.json?skip_status=true&include_entities=false',
    ];
    for (const url of urls) {
      try {
        const headers = await this.getJsonHeadersAsync('GET', url);
        const response = await this.fetchWithTimeout(url, {
          method: 'GET',
          headers,
        });
        if (!response.ok) continue;
        const data = await response.json() as any;
        const userId =
          data?.user_id ?? data?.user_id_str ?? data?.user?.id_str ?? data?.user?.id;
        if (userId) {
          this.clientUserId = String(userId);
          return;
        }
      } catch {
        continue;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // GraphQL + REST convenience helpers (no fallback logic — mixins own that)
  // ---------------------------------------------------------------------------

  async graphqlGet(
    operation: string,
    variables: Record<string, any>,
    opts?: {
      queryId?: string;
      features?: Record<string, boolean>;
      fieldToggles?: Record<string, boolean>;
    }
  ): Promise<any> {
    const qid = opts?.queryId ?? await this.getQueryId(operation);
    const params = new URLSearchParams();
    params.set('variables', JSON.stringify(variables));
    if (opts?.features) params.set('features', JSON.stringify(opts.features));
    if (opts?.fieldToggles) params.set('fieldToggles', JSON.stringify(opts.fieldToggles));
    const url = `${GRAPHQL_API_BASE}/${qid}/${operation}?${params.toString()}`;
    const headers = await this.getJsonHeadersAsync('GET', url);
    const response = await this.fetchWithTimeout(url, {
      method: 'GET',
      headers,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const err: any = new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
      err.httpStatus = response.status;
      err.responseBody = text;
      throw err;
    }
    return response.json();
  }

  async graphqlPost(
    operation: string,
    variables: Record<string, any>,
    opts?: {
      queryId?: string;
      features?: Record<string, boolean>;
      fieldToggles?: Record<string, boolean>;
    }
  ): Promise<any> {
    const qid = opts?.queryId ?? await this.getQueryId(operation);
    const url = `${GRAPHQL_API_BASE}/${qid}/${operation}`;
    const body: Record<string, any> = { variables, queryId: qid };
    if (opts?.features) body.features = opts.features;
    if (opts?.fieldToggles) body.fieldToggles = opts.fieldToggles;
    const headers = await this.getJsonHeadersAsync('POST', url);
    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const err: any = new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
      err.httpStatus = response.status;
      err.responseBody = text;
      throw err;
    }
    return response.json();
  }

  async apiGet(urlPath: string): Promise<any> {
    const url = `${API_BASE}${urlPath}`;
    const headers = await this.getJsonHeadersAsync('GET', url);
    const response = await this.fetchWithTimeout(url, {
      method: 'GET',
      headers,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const err: any = new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
      err.httpStatus = response.status;
      err.responseBody = text;
      throw err;
    }
    return response.json();
  }

  async apiPost(urlPath: string, body: string, contentType?: string): Promise<any> {
    const url = `${API_BASE}${urlPath}`;
    const headers = await this.getJsonHeadersAsync('POST', url);
    headers['Content-Type'] = contentType ?? 'application/x-www-form-urlencoded';
    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const err: any = new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
      err.httpStatus = response.status;
      err.responseBody = text;
      throw err;
    }
    return response.json();
  }

  isQueryIdMismatch(err: any): boolean {
    const status = err?.httpStatus;
    const body = err?.responseBody ?? '';
    if (status === 404) return true;
    if (
      typeof body === 'string' &&
      (body.includes('query: unspecified') || body.includes('GRAPHQL_VALIDATION_FAILED'))
    ) {
      return true;
    }
    return false;
  }
}
