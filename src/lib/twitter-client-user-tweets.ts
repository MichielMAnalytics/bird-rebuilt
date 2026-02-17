import { TwitterClientBase } from './twitter-client-base.js';
import {
  TweetData,
  extractTimelineEntries,
  extractTweetsFromEntries,
  extractCursorFromEntries,
} from './twitter-client-utils.js';
import { DEFAULT_TWEET_COUNT } from './twitter-client-constants.js';
import { buildUserTweetsFeatures } from './twitter-client-features.js';

type Constructor<T = {}> = new (...args: any[]) => T;

export function UserTweetsMixin<TBase extends Constructor<TwitterClientBase>>(Base: TBase) {
  return class extends Base {
    async getUserTweetsQueryIds(): Promise<string[]> {
      const primary = await this.getQueryId('UserTweets');
      return Array.from(new Set([primary, 'Wms1GvIiHXAPBaCr9KblaA', 'eApPT8jppbYXlweF_ByTyA']));
    }

    async getUserTweets(
      userId: string,
      count?: number,
      cursor?: string
    ): Promise<{ tweets: TweetData[]; cursor?: string }> {
      const variables: Record<string, any> = {
        userId,
        count: count ?? DEFAULT_TWEET_COUNT,
        includePromotedContent: true,
        withQuickPromoteEligibilityTweetFields: true,
        withVoice: true,
        withV2Timeline: true,
      };
      if (cursor) variables.cursor = cursor;

      const fieldToggles = { withArticlePlainText: true };
      const features = buildUserTweetsFeatures();
      const queryIds = await this.getUserTweetsQueryIds();

      // Loop through query IDs
      for (const queryId of queryIds) {
        try {
          const data = await this.graphqlGet('UserTweets', variables, {
            queryId,
            features,
            fieldToggles,
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
      const freshId = await this.getQueryId('UserTweets');
      const data = await this.graphqlGet('UserTweets', variables, {
        queryId: freshId,
        features,
        fieldToggles,
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
