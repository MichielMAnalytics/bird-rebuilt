import { TwitterClientBase } from './twitter-client-base.js';
import {
  TweetData,
  extractTimelineEntries,
  extractTweetsFromEntries,
  extractCursorFromEntries,
} from './twitter-client-utils.js';
import { DEFAULT_TWEET_COUNT } from './twitter-client-constants.js';
import { buildBookmarksFeatures, buildLikesFeatures } from './twitter-client-features.js';

type Constructor<T = {}> = new (...args: any[]) => T;

export function TimelinesMixin<TBase extends Constructor<TwitterClientBase>>(Base: TBase) {
  return class extends Base {
    async getBookmarksQueryIds(): Promise<string[]> {
      const primary = await this.getQueryId('Bookmarks');
      return Array.from(new Set([primary, 'RV1g3b8n_SGOHwkqKYSCFw']));
    }

    async getLikesQueryIds(): Promise<string[]> {
      const primary = await this.getQueryId('Likes');
      return Array.from(new Set([primary, 'JR2gceKucIKcVNB_9JkhsA', 'ETJflBunfqNa1uE1mBPCaw']));
    }

    async getBookmarks(
      count?: number,
      cursor?: string
    ): Promise<{ tweets: TweetData[]; cursor?: string }> {
      const features = buildBookmarksFeatures();
      const variables: Record<string, any> = {
        count: count ?? DEFAULT_TWEET_COUNT,
        includePromotedContent: false,
      };
      if (cursor) variables.cursor = cursor;

      const queryIds = await this.getBookmarksQueryIds();

      // Try with full variables first, loop through query IDs
      for (const queryId of queryIds) {
        try {
          const data = await this.graphqlGet('Bookmarks', variables, {
            queryId,
            features,
          });
          const timeline = data?.data?.bookmark_timeline_v2?.timeline;
          const entries = extractTimelineEntries(timeline);
          const tweets = extractTweetsFromEntries(entries);
          const nextCursor = extractCursorFromEntries(entries);
          return { tweets, cursor: nextCursor };
        } catch (err: any) {
          if (this.isQueryIdMismatch(err)) continue;
          // On 400, try with minimal variables (bookmark variable negotiation)
          if (err?.httpStatus === 400) {
            try {
              const minimalVars: Record<string, any> = {
                count: count ?? DEFAULT_TWEET_COUNT,
              };
              if (cursor) minimalVars.cursor = cursor;
              const data = await this.graphqlGet('Bookmarks', minimalVars, {
                queryId,
                features,
              });
              const timeline = data?.data?.bookmark_timeline_v2?.timeline;
              const entries = extractTimelineEntries(timeline);
              const tweets = extractTweetsFromEntries(entries);
              const nextCursor = extractCursorFromEntries(entries);
              return { tweets, cursor: nextCursor };
            } catch (innerErr: any) {
              if (this.isQueryIdMismatch(innerErr)) continue;
              throw innerErr;
            }
          }
          throw err;
        }
      }

      // All IDs exhausted — refresh and retry
      await this.refreshQueryIds();
      const freshId = await this.getQueryId('Bookmarks');
      const data = await this.graphqlGet('Bookmarks', variables, {
        queryId: freshId,
        features,
      });
      const timeline = data?.data?.bookmark_timeline_v2?.timeline;
      const entries = extractTimelineEntries(timeline);
      const tweets = extractTweetsFromEntries(entries);
      const nextCursor = extractCursorFromEntries(entries);
      return { tweets, cursor: nextCursor };
    }

    async getLikes(
      userId: string,
      count?: number,
      cursor?: string
    ): Promise<{ tweets: TweetData[]; cursor?: string }> {
      const features = buildLikesFeatures();
      const variables: Record<string, any> = {
        userId,
        count: count ?? DEFAULT_TWEET_COUNT,
        includePromotedContent: false,
      };
      if (cursor) variables.cursor = cursor;

      const queryIds = await this.getLikesQueryIds();

      for (const queryId of queryIds) {
        try {
          const data = await this.graphqlGet('Likes', variables, {
            queryId,
            features,
          });
          const timeline =
            data?.data?.user?.result?.timeline_v2?.timeline ??
            data?.data?.user?.result?.timeline?.timeline;
          const entries = extractTimelineEntries(timeline);
          const tweets = extractTweetsFromEntries(entries);
          const nextCursor = extractCursorFromEntries(entries);
          return { tweets, cursor: nextCursor };
        } catch (err: any) {
          if (this.isQueryIdMismatch(err)) continue;
          throw err;
        }
      }

      // All IDs exhausted — refresh and retry
      await this.refreshQueryIds();
      const freshId = await this.getQueryId('Likes');
      const data = await this.graphqlGet('Likes', variables, {
        queryId: freshId,
        features,
      });
      const timeline =
        data?.data?.user?.result?.timeline_v2?.timeline ??
        data?.data?.user?.result?.timeline?.timeline;
      const entries = extractTimelineEntries(timeline);
      const tweets = extractTweetsFromEntries(entries);
      const nextCursor = extractCursorFromEntries(entries);
      return { tweets, cursor: nextCursor };
    }
  };
}
