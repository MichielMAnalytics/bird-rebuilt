import { TwitterClientBase } from './twitter-client-base.js';
import {
  TweetData,
  extractTimelineEntries,
  extractTweetsFromEntries,
  extractCursorFromEntries,
} from './twitter-client-utils.js';
import { DEFAULT_TWEET_COUNT } from './twitter-client-constants.js';
import { buildHomeTimelineFeatures } from './twitter-client-features.js';

type Constructor<T = {}> = new (...args: any[]) => T;

export function HomeMixin<TBase extends Constructor<TwitterClientBase>>(Base: TBase) {
  return class extends Base {
    async getHomeTimelineQueryIds(): Promise<string[]> {
      const primary = await this.getQueryId('HomeTimeline');
      return Array.from(new Set([primary, 'edseUwk9sP5Phz__9TIRnA', 'y_gEr8-rsIu-XEOVAkh00A']));
    }

    async getHomeLatestTimelineQueryIds(): Promise<string[]> {
      const primary = await this.getQueryId('HomeLatestTimeline');
      return Array.from(new Set([primary, 'iOEZpOdfekFsxSlPQCQtPg', 'ZBbXrl0kKr-kV7EjJGMCLQ']));
    }

    async getHomeTimeline(
      count?: number,
      cursor?: string
    ): Promise<{ tweets: TweetData[]; cursor?: string }> {
      const variables: Record<string, any> = {
        count: count ?? DEFAULT_TWEET_COUNT,
        includePromotedContent: true,
        latestControlAvailable: true,
        requestContext: 'launch',
      };
      if (cursor) variables.cursor = cursor;

      const features = buildHomeTimelineFeatures();

      // Try HomeTimeline first
      try {
        return await this.fetchHomeTimelineOp('HomeTimeline', variables, features);
      } catch {
        // Fall through to HomeLatestTimeline
      }

      return await this.fetchHomeTimelineOp('HomeLatestTimeline', variables, features);
    }

    async fetchHomeTimelineOp(
      operation: string,
      variables: Record<string, any>,
      features: Record<string, boolean>
    ): Promise<{ tweets: TweetData[]; cursor?: string }> {
      const queryIds =
        operation === 'HomeLatestTimeline'
          ? await this.getHomeLatestTimelineQueryIds()
          : await this.getHomeTimelineQueryIds();

      // Loop through query IDs
      for (const queryId of queryIds) {
        try {
          const data = await this.graphqlGet(operation, variables, {
            queryId,
            features,
          });
          const timeline = data?.data?.home?.home_timeline_urt;
          const entries = extractTimelineEntries(timeline);
          const tweets = extractTweetsFromEntries(entries);
          const nextCursor = extractCursorFromEntries(entries);
          return { tweets, cursor: nextCursor };
        } catch (err: any) {
          if (this.isQueryIdMismatch(err)) continue;
          // Also detect "query: unspecified" as a stale query ID signal
          const body = err?.responseBody ?? '';
          if (typeof body === 'string' && body.includes('query: unspecified')) {
            continue;
          }
          throw err;
        }
      }

      // All IDs exhausted — refresh and retry
      await this.refreshQueryIds();
      const freshId = await this.getQueryId(operation);
      const data = await this.graphqlGet(operation, variables, {
        queryId: freshId,
        features,
      });
      const timeline = data?.data?.home?.home_timeline_urt;
      const entries = extractTimelineEntries(timeline);
      const tweets = extractTweetsFromEntries(entries);
      const nextCursor = extractCursorFromEntries(entries);
      return { tweets, cursor: nextCursor };
    }
  };
}
