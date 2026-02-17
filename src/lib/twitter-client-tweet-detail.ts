import { TwitterClientBase } from './twitter-client-base.js';
import {
  TweetData,
  parseTweetResult,
  extractCursorFromEntries,
} from './twitter-client-utils.js';
import { buildTweetDetailFeatures, buildArticleFieldToggles } from './twitter-client-features.js';

type Constructor<T = {}> = new (...args: any[]) => T;

export function TweetDetailMixin<TBase extends Constructor<TwitterClientBase>>(Base: TBase) {
  return class extends Base {
    async getTweet(tweetId: string): Promise<TweetData | null> {
      const features = buildTweetDetailFeatures();
      const fieldToggles = buildArticleFieldToggles();
      const variables = {
        focalTweetId: tweetId,
        with_rux_injections: false,
        rankingMode: 'Relevance',
        includePromotedContent: true,
        withCommunity: true,
        withQuickPromoteEligibilityTweetFields: true,
        withBirdwatchNotes: true,
        withVoice: true,
      };

      const queryIds = await this.getTweetDetailQueryIds();

      // Loop through query IDs, trying GET then POST for each
      for (const queryId of queryIds) {
        // Try GET (faster, may be CDN-cached)
        try {
          const data = await this.graphqlGet('TweetDetail', variables, {
            queryId,
            features,
            fieldToggles,
          });
          const tweet = this.extractFocalTweet(data, tweetId);
          if (tweet) return tweet;
        } catch (err: any) {
          if (this.isQueryIdMismatch(err)) continue;
          // Non-404 GET error — fall through to POST
        }

        // Try POST with same query ID
        try {
          const data = await this.graphqlPost('TweetDetail', variables, {
            queryId,
            features,
            fieldToggles,
          });
          const tweet = this.extractFocalTweet(data, tweetId);
          if (tweet) return tweet;
        } catch (err: any) {
          if (this.isQueryIdMismatch(err)) continue;
          // Non-recoverable POST error — still try next ID
        }
      }

      // All IDs exhausted — refresh and try once more
      await this.refreshQueryIds();
      const freshId = await this.getQueryId('TweetDetail');
      try {
        const data = await this.graphqlGet('TweetDetail', variables, {
          queryId: freshId,
          features,
          fieldToggles,
        });
        const tweet = this.extractFocalTweet(data, tweetId);
        if (tweet) return tweet;
      } catch {
        // Fall through to RestId fallback
      }

      // Final fallback: TweetResultByRestId (simpler, no thread context)
      try {
        return await this.getTweetByRestId(tweetId);
      } catch {
        return null;
      }
    }

    async getTweetByRestId(tweetId: string): Promise<TweetData | null> {
      const variables = {
        tweetId,
        withCommunity: false,
        includePromotedContent: false,
        withVoice: false,
      };

      try {
        const data = await this.graphqlGet('TweetResultByRestId', variables);
        const result = data?.data?.tweetResult?.result;
        return parseTweetResult(result);
      } catch (err: any) {
        if (!this.isQueryIdMismatch(err)) throw err;
      }

      await this.refreshQueryIds();
      const data = await this.graphqlGet('TweetResultByRestId', variables);
      const result = data?.data?.tweetResult?.result;
      return parseTweetResult(result);
    }

    extractFocalTweet(data: any, tweetId: string): TweetData | null {
      const instructions =
        data?.data?.threaded_conversation_with_injections_v2?.instructions ?? [];
      const addEntriesInst = instructions.find(
        (inst: any) => inst.type === 'TimelineAddEntries'
      );
      const entries = addEntriesInst?.entries ?? [];

      for (const entry of entries) {
        const entryId = entry.entryId ?? '';
        if (entryId === `tweet-${tweetId}`) {
          const tweetResult = entry.content?.itemContent?.tweet_results?.result;
          return parseTweetResult(tweetResult);
        }
      }
      return null;
    }

    async getReplies(
      tweetId: string,
      count?: number,
      cursor?: string
    ): Promise<{ replies: TweetData[]; cursor?: string }> {
      const features = buildTweetDetailFeatures();
      const fieldToggles = buildArticleFieldToggles();
      const variables: Record<string, any> = {
        focalTweetId: tweetId,
        with_rux_injections: false,
        rankingMode: 'Relevance',
        includePromotedContent: true,
        withCommunity: true,
        withQuickPromoteEligibilityTweetFields: true,
        withBirdwatchNotes: true,
        withVoice: true,
      };
      if (cursor) variables.cursor = cursor;
      if (count) variables.count = count;

      let data: any;
      try {
        data = await this.graphqlGet('TweetDetail', variables, { features, fieldToggles });
      } catch (err: any) {
        if (!this.isQueryIdMismatch(err)) throw err;
        await this.refreshQueryIds();
        data = await this.graphqlGet('TweetDetail', variables, { features, fieldToggles });
      }

      const instructions =
        data?.data?.threaded_conversation_with_injections_v2?.instructions ?? [];
      const addEntriesInst = instructions.find(
        (inst: any) => inst.type === 'TimelineAddEntries'
      );
      const entries = addEntriesInst?.entries ?? [];

      const replies: TweetData[] = [];
      for (const entry of entries) {
        const entryId = entry.entryId ?? '';
        if (entryId === `tweet-${tweetId}`) continue;
        if (entryId.startsWith('conversationthread-')) {
          const items = entry.content?.items ?? [];
          for (const item of items) {
            const tweetResult = item.item?.itemContent?.tweet_results?.result;
            const tweet = parseTweetResult(tweetResult);
            if (tweet) replies.push(tweet);
          }
        }
      }

      const nextCursor = extractCursorFromEntries(entries);
      return { replies, cursor: nextCursor };
    }

    async getThread(tweetId: string): Promise<TweetData[]> {
      const features = buildTweetDetailFeatures();
      const fieldToggles = buildArticleFieldToggles();
      const variables = {
        focalTweetId: tweetId,
        with_rux_injections: false,
        rankingMode: 'Relevance',
        includePromotedContent: true,
        withCommunity: true,
        withQuickPromoteEligibilityTweetFields: true,
        withBirdwatchNotes: true,
        withVoice: true,
      };

      let data: any;
      try {
        data = await this.graphqlGet('TweetDetail', variables, { features, fieldToggles });
      } catch (err: any) {
        if (!this.isQueryIdMismatch(err)) throw err;
        await this.refreshQueryIds();
        data = await this.graphqlGet('TweetDetail', variables, { features, fieldToggles });
      }

      const instructions =
        data?.data?.threaded_conversation_with_injections_v2?.instructions ?? [];
      const addEntriesInst = instructions.find(
        (inst: any) => inst.type === 'TimelineAddEntries'
      );
      const entries = addEntriesInst?.entries ?? [];

      const thread: TweetData[] = [];
      let reachedFocal = false;

      for (const entry of entries) {
        const entryId = entry.entryId ?? '';
        if (entryId === `tweet-${tweetId}`) {
          const tweetResult = entry.content?.itemContent?.tweet_results?.result;
          const tweet = parseTweetResult(tweetResult);
          if (tweet) thread.push(tweet);
          reachedFocal = true;
          break;
        }

        if (entryId.startsWith('tweet-')) {
          const tweetResult = entry.content?.itemContent?.tweet_results?.result;
          const tweet = parseTweetResult(tweetResult);
          if (tweet) thread.push(tweet);
        }

        if (entryId.startsWith('conversationthread-') && !reachedFocal) {
          const items = entry.content?.items ?? [];
          for (const item of items) {
            const tweetResult = item.item?.itemContent?.tweet_results?.result;
            const tweet = parseTweetResult(tweetResult);
            if (tweet) thread.push(tweet);
          }
        }
      }

      return thread;
    }
  };
}
