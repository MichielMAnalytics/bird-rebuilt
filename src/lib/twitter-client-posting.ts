import { TwitterClientBase } from './twitter-client-base.js';
import { MAX_TWEET_LENGTH } from './twitter-client-constants.js';
import { parseUserResult } from './twitter-client-utils.js';
import { buildTweetCreateFeatures, buildArticleFeatures } from './twitter-client-features.js';

type Constructor<T = {}> = new (...args: any[]) => T;

export function PostingMixin<TBase extends Constructor<TwitterClientBase>>(Base: TBase) {
  return class extends Base {
    async ensureClientUserId(): Promise<void> {
      if (this.clientUserId) return;
      try {
        const features = buildArticleFeatures();
        const data = await this.graphqlGet('Viewer', {}, { features });
        const result = data?.data?.viewer?.user_results?.result;
        const user = parseUserResult(result);
        if (user?.id) {
          this.clientUserId = user.id;
        }
      } catch {
        // Non-fatal — posting may still work without it
      }
    }

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

      return this.createTweet(variables);
    }

    async reply(tweetId: string, text: string, mediaIds?: string[]): Promise<any> {
      if (text.length > MAX_TWEET_LENGTH) {
        throw new Error(`Reply text exceeds maximum length of ${MAX_TWEET_LENGTH} characters`);
      }

      const variables: Record<string, any> = {
        tweet_text: text,
        dark_request: false,
        reply: {
          in_reply_to_tweet_id: tweetId,
          exclude_reply_user_ids: [],
        },
        media: {
          media_entities: (mediaIds ?? []).map((id) => ({ media_id: id, tagged_users: [] })),
          possibly_sensitive: false,
        },
        semantic_annotation_ids: [],
      };

      return this.createTweet(variables);
    }

    async createTweet(variables: Record<string, any>): Promise<any> {
      await this.ensureClientUserId();
      const features = buildTweetCreateFeatures();

      // First attempt
      try {
        const data = await this.graphqlPost('CreateTweet', variables, { features });
        return this.handleCreateTweetResponse(data, variables);
      } catch (err: any) {
        if (this.isQueryIdMismatch(err)) {
          // Stale query ID — refresh and retry
          await this.refreshQueryIds();
          try {
            const data = await this.graphqlPost('CreateTweet', variables, { features });
            return this.handleCreateTweetResponse(data, variables);
          } catch (retryErr: any) {
            // If retry also fails, try REST
            return await this.statusUpdateFallbackOrThrow(variables, retryErr);
          }
        }
        // Check for error 226 in response body
        return await this.statusUpdateFallbackOrThrow(variables, err);
      }
    }

    handleCreateTweetResponse(data: any, variables: Record<string, any>): any {
      if (!data.errors?.length) return data;

      // Error 226 = "looks automated" — try REST v1.1 fallback
      const has226 = data.errors.some(
        (e: any) => e.extensions?.code === 226 || e.code === 226
      );
      if (has226) {
        // Will be handled by caller's catch
        const err: any = new Error('Error 226: This request looks automated');
        err.is226 = true;
        err.data = data;
        throw err;
      }

      const msg = data.errors.map((e: any) => e.message).join('; ');
      throw new Error(msg);
    }

    async statusUpdateFallbackOrThrow(
      variables: Record<string, any>,
      err: any
    ): Promise<any> {
      // Check if this is a 226 error that might benefit from REST fallback
      const is226 =
        err?.is226 ||
        err?.message?.includes('226') ||
        err?.responseBody?.includes('226');
      if (is226) {
        const fallback = await this.statusUpdateFallback(variables);
        if (fallback) return fallback;
      }
      throw err;
    }

    async statusUpdateFallback(variables: Record<string, any>): Promise<any | null> {
      const text = variables.tweet_text;
      if (typeof text !== 'string') return null;

      const params = new URLSearchParams();
      params.set('status', text);

      const reply = variables.reply;
      if (reply?.in_reply_to_tweet_id) {
        params.set('in_reply_to_status_id', reply.in_reply_to_tweet_id);
        params.set('auto_populate_reply_metadata', 'true');
      }

      const mediaEntities = variables.media?.media_entities;
      if (Array.isArray(mediaEntities) && mediaEntities.length > 0) {
        const ids = mediaEntities.map((e: any) => e.media_id).filter(Boolean);
        if (ids.length > 0) params.set('media_ids', ids.join(','));
      }

      try {
        const data = await this.apiPost('/1.1/statuses/update.json', params.toString());
        const tweetId = data.id_str ?? String(data.id ?? '');
        return {
          data: {
            create_tweet: {
              tweet_results: {
                result: { rest_id: tweetId || undefined },
              },
            },
          },
        };
      } catch {
        return null;
      }
    }
  };
}
