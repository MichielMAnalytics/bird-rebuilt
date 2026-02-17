import { randomBytes, randomUUID } from 'node:crypto';
import { QUERY_IDS, TARGET_QUERY_ID_OPERATIONS, GRAPHQL_API_BASE, API_BASE } from './twitter-client-constants.js';
import { runtimeQueryIds } from './runtime-query-ids.js';

export interface TwitterCredentials {
  authToken: string;
  ct0: string;
}

export interface ClientOptions {
  credentials: TwitterCredentials;
  timeout?: number;
}

export class TwitterClientBase {
  authToken: string;
  ct0: string;
  cookieHeader: string;
  timeoutMs: number | undefined;
  clientUuid: string;
  clientDeviceId: string;
  clientUserId?: string;

  constructor(options: ClientOptions) {
    this.authToken = options.credentials.authToken;
    this.ct0 = options.credentials.ct0;
    this.cookieHeader = `auth_token=${this.authToken}; ct0=${this.ct0}`;
    this.timeoutMs = options.timeout;
    this.clientUuid = randomUUID();
    this.clientDeviceId = randomUUID();
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

  createTransactionId(): string {
    return randomBytes(16).toString('hex');
  }

  getBaseHeaders(): Record<string, string> {
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
      'x-client-transaction-id': this.createTransactionId(),
      'cookie': this.cookieHeader,
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'origin': 'https://x.com',
      'referer': 'https://x.com/',
      // Browser fingerprint headers
      'sec-ch-ua': '"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
    };
    if (this.clientUserId) {
      headers['x-twitter-client-user-id'] = this.clientUserId;
    }
    return headers;
  }

  getJsonHeaders(): Record<string, string> {
    return { ...this.getBaseHeaders(), 'content-type': 'application/json' };
  }

  getHeaders(): Record<string, string> {
    return this.getJsonHeaders();
  }

  async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    if (!this.timeoutMs || this.timeoutMs <= 0) {
      return fetch(url, init);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  // Alias for backward compatibility
  async fetchRaw(url: string, init: RequestInit): Promise<Response> {
    return this.fetchWithTimeout(url, init);
  }

  async ensureClientUserId(): Promise<void> {
    if (this.clientUserId) return;
    // Will be overridden by UsersMixin or PostingMixin
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
    const response = await this.fetchWithTimeout(url, {
      method: 'GET',
      headers: this.getHeaders(),
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
    const response = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: this.getJsonHeaders(),
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
    const response = await this.fetchWithTimeout(url, {
      method: 'GET',
      headers: this.getHeaders(),
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
    const headers = {
      ...this.getHeaders(),
      'Content-Type': contentType ?? 'application/x-www-form-urlencoded',
    };
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
