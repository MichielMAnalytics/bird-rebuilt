import { TwitterClientBase } from './twitter-client-base.js';
import { GRAPHQL_API_BASE, GRAPHQL_POST_URL, STATUS_UPDATE_URL, MAX_TWEET_LENGTH } from './twitter-client-constants.js';
import { buildTweetCreateFeatures } from './twitter-client-features.js';

type Constructor<T = {}> = new (...args: any[]) => T;

export function PostingMixin<TBase extends Constructor<TwitterClientBase>>(Base: TBase) {
  return class extends Base {
    async tweet(text: string, mediaIds?: string[]): Promise<any> {
      if (text.length > MAX_TWEET_LENGTH) {
        throw new Error(`Tweet text exceeds maximum length of ${MAX_TWEET_LENGTH} characters`);
      }

      const variables: Record<string, any> = {
        tweet_text: text,
        dark_request: false,
        media: {
          media_entities: (mediaIds ?? []).map((id) => ({ media_id: id, tagged_users: [] })),
          possibly_sensitive: false,
        },
        semantic_annotation_ids: [],
      };
      const features = buildTweetCreateFeatures();
      return this.createTweet(variables, features);
    }

    async reply(tweetId: string, text: string, mediaIds?: string[]): Promise<any> {
      if (text.length > MAX_TWEET_LENGTH) {
        throw new Error(`Reply text exceeds maximum length of ${MAX_TWEET_LENGTH} characters`);
      }

      const variables: Record<string, any> = {
        tweet_text: text,
        reply: {
          in_reply_to_tweet_id: tweetId,
          exclude_reply_user_ids: [],
        },
        dark_request: false,
        media: {
          media_entities: (mediaIds ?? []).map((id) => ({ media_id: id, tagged_users: [] })),
          possibly_sensitive: false,
        },
        semantic_annotation_ids: [],
      };
      const features = buildTweetCreateFeatures();
      return this.createTweet(variables, features);
    }

    async createTweet(variables: Record<string, any>, features: Record<string, boolean>): Promise<any> {
      await this.ensureClientUserId();

      // Timing jitter: 2-5s random delay before write operations
      if (!this.noJitter) {
        await this.sleep(2000 + Math.random() * 3000);
      }

      let queryId = await this.getQueryId('CreateTweet');
      let urlWithOperation = `${GRAPHQL_API_BASE}/${queryId}/CreateTweet`;
      const buildBody = () => JSON.stringify({ variables, features, queryId });
      let body = buildBody();

      try {
        const headers = await this.getJsonHeadersAsync('POST', urlWithOperation);
        headers['referer'] = 'https://x.com/compose/post';
        let response = await this.fetchWithTimeout(urlWithOperation, {
          method: 'POST',
          headers,
          body,
        });

        // If 404, refresh query IDs and retry
        if (response.status === 404) {
          await this.refreshQueryIds();
          queryId = await this.getQueryId('CreateTweet');
          urlWithOperation = `${GRAPHQL_API_BASE}/${queryId}/CreateTweet`;
          body = buildBody();
          const retryHeaders = await this.getJsonHeadersAsync('POST', urlWithOperation);
          retryHeaders['referer'] = 'https://x.com/compose/post';
          response = await this.fetchWithTimeout(urlWithOperation, {
            method: 'POST',
            headers: retryHeaders,
            body,
          });

          // If still 404, try generic graphql POST endpoint
          if (response.status === 404) {
            const fallbackHeaders = await this.getJsonHeadersAsync('POST', GRAPHQL_POST_URL);
            fallbackHeaders['referer'] = 'https://x.com/compose/post';
            const retry = await this.fetchWithTimeout(GRAPHQL_POST_URL, {
              method: 'POST',
              headers: fallbackHeaders,
              body,
            });
            if (!retry.ok) {
              const text = await retry.text();
              return { success: false, error: `HTTP ${retry.status}: ${text.slice(0, 200)}` };
            }
            const data = await retry.json() as any;
            if (data.errors?.length > 0) {
              const fallback = await this.tryStatusUpdateFallback(data.errors, variables);
              if (fallback) return fallback;
              return { success: false, error: this.formatErrors(data.errors) };
            }
            const tweetId = data.data?.create_tweet?.tweet_results?.result?.rest_id;
            if (tweetId) return { success: true, tweetId };
            return { success: false, error: 'Tweet created but no ID returned' };
          }
        }

        if (!response.ok) {
          const text = await response.text();
          return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
        }

        const data = await response.json() as any;
        if (data.errors?.length > 0) {
          const fallback = await this.tryStatusUpdateFallback(data.errors, variables);
          if (fallback) return fallback;
          return { success: false, error: this.formatErrors(data.errors) };
        }

        const tweetId = data.data?.create_tweet?.tweet_results?.result?.rest_id;
        if (tweetId) return { success: true, tweetId };
        return { success: false, error: 'Tweet created but no ID returned' };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }

    formatErrors(errors: any[]): string {
      return errors
        .map((e: any) => (typeof e.code === 'number' ? `${e.message} (${e.code})` : e.message))
        .join(', ');
    }

    async tryStatusUpdateFallback(errors: any[], variables: Record<string, any>): Promise<any | null> {
      if (!errors.some((e: any) => e.code === 226)) return null;

      const text = typeof variables.tweet_text === 'string' ? variables.tweet_text : null;
      if (!text) return null;

      return this.postStatusUpdate(text, variables.reply?.in_reply_to_tweet_id, variables.media?.media_entities);
    }

    async postStatusUpdate(
      text: string,
      inReplyToTweetId?: string,
      mediaEntities?: any[]
    ): Promise<any> {
      const params = new URLSearchParams();
      params.set('status', text);

      if (inReplyToTweetId) {
        params.set('in_reply_to_status_id', inReplyToTweetId);
        params.set('auto_populate_reply_metadata', 'true');
      }

      if (Array.isArray(mediaEntities) && mediaEntities.length > 0) {
        const ids = mediaEntities
          .map((e: any) => e?.media_id)
          .filter(Boolean)
          .map(String);
        if (ids.length > 0) params.set('media_ids', ids.join(','));
      }

      try {
        const headers = await this.getBaseHeadersAsync('POST', STATUS_UPDATE_URL);
        headers['content-type'] = 'application/x-www-form-urlencoded';
        headers['referer'] = 'https://x.com/compose/post';
        const response = await this.fetchWithTimeout(STATUS_UPDATE_URL, {
          method: 'POST',
          headers,
          body: params.toString(),
        });

        if (!response.ok) {
          const text = await response.text();
          return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
        }

        const data = await response.json() as any;
        if (data.errors?.length > 0) {
          return { success: false, error: this.formatErrors(data.errors) };
        }

        const tweetId = typeof data.id_str === 'string' ? data.id_str : data.id !== undefined ? String(data.id) : undefined;
        if (tweetId) return { success: true, tweetId };
        return { success: false, error: 'Tweet created but no ID returned' };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  };
}
