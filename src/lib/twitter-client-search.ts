import { TwitterClientBase } from './twitter-client-base.js';
import {
  TweetData,
  extractTimelineEntries,
  extractTweetsFromEntries,
  extractCursorFromEntries,
} from './twitter-client-utils.js';
import { DEFAULT_TWEET_COUNT } from './twitter-client-constants.js';
import { buildSearchFeatures } from './twitter-client-features.js';

type Constructor<T = {}> = new (...args: any[]) => T;

export function SearchMixin<TBase extends Constructor<TwitterClientBase>>(Base: TBase) {
  return class extends Base {
    async search(
      query: string,
      count?: number,
      cursor?: string,
      searchType?: string
    ): Promise<{ tweets: TweetData[]; cursor?: string }> {
      const variables: Record<string, any> = {
        rawQuery: query,
        count: count ?? DEFAULT_TWEET_COUNT,
        querySource: 'typed_query',
        product: searchType ?? 'Latest',
      };
      if (cursor) variables.cursor = cursor;

      const features = buildSearchFeatures();
      const fieldToggles = {
        withArticleRichContentState: true,
        withArticlePlainText: false,
        withGrokAnalyze: false,
        withDisallowedReplyControls: false,
      };

      const queryIds = await this.getSearchTimelineQueryIds();

      // Loop through query IDs.
      // NOTE: SearchTimeline switched from GET to POST in Twitter's 2026 API.
      // Using graphqlGet here returns HTTP 404 (which isQueryIdMismatch
      // misreads as a stale query ID, exhausting the loop). Must POST.
      for (const queryId of queryIds) {
        try {
          const data = await this.graphqlPost('SearchTimeline', variables, {
            queryId,
            features,
            fieldToggles,
          });
          const timeline =
            data?.data?.search_by_raw_query?.search_timeline?.timeline;
          const entries = extractTimelineEntries(timeline);
          const tweets = extractTweetsFromEntries(entries);
          const nextCursor = extractCursorFromEntries(entries);
          return { tweets, cursor: nextCursor };
        } catch (err: any) {
          if (this.isQueryIdMismatch(err)) continue;
          // Also check for search-specific mismatch signals
          const body = err?.responseBody ?? '';
          if (
            typeof body === 'string' &&
            (body.includes('rawQuery must be defined') ||
              body.includes('GRAPHQL_VALIDATION_FAILED'))
          ) {
            continue;
          }
          throw err;
        }
      }

      // All IDs exhausted — refresh and retry
      await this.refreshQueryIds();
      const freshId = await this.getQueryId('SearchTimeline');
      const data = await this.graphqlPost('SearchTimeline', variables, {
        queryId: freshId,
        features,
        fieldToggles,
      });
      const timeline =
        data?.data?.search_by_raw_query?.search_timeline?.timeline;
      const entries = extractTimelineEntries(timeline);
      const tweets = extractTweetsFromEntries(entries);
      const nextCursor = extractCursorFromEntries(entries);
      return { tweets, cursor: nextCursor };
    }
  };
}
