import { TwitterClientBase } from './twitter-client-base.js';
import {
  TweetData,
  extractTimelineEntries,
  extractTweetsFromEntries,
  extractCursorFromEntries,
} from './twitter-client-utils.js';
import { DEFAULT_TWEET_COUNT } from './twitter-client-constants.js';
import { buildListsFeatures } from './twitter-client-features.js';

type Constructor<T = {}> = new (...args: any[]) => T;

export interface ListData {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  subscriberCount: number;
  isPrivate: boolean;
  createdAt?: string;
}

export function ListsMixin<TBase extends Constructor<TwitterClientBase>>(Base: TBase) {
  return class extends Base {
    async getLists(userId: string): Promise<ListData[]> {
      const variables = {
        userId,
        count: 100,
      };
      const features = buildListsFeatures();

      try {
        const data = await this.graphqlGet('ListsManagementPageTimeline', variables, { features });
        const timeline = data?.data?.user?.result?.timeline?.timeline;
        const entries = extractTimelineEntries(timeline);
        return extractListsFromEntries(entries);
      } catch (err: any) {
        if (!this.isQueryIdMismatch(err)) throw err;
      }

      await this.refreshQueryIds();
      const data = await this.graphqlGet('ListsManagementPageTimeline', variables, { features });
      const timeline = data?.data?.user?.result?.timeline?.timeline;
      const entries = extractTimelineEntries(timeline);
      return extractListsFromEntries(entries);
    }

    async getListTimeline(
      listId: string,
      count?: number,
      cursor?: string
    ): Promise<{ tweets: TweetData[]; cursor?: string }> {
      const variables: Record<string, any> = {
        listId,
        count: count ?? DEFAULT_TWEET_COUNT,
      };
      if (cursor) variables.cursor = cursor;
      const features = buildListsFeatures();

      try {
        const data = await this.graphqlGet('ListLatestTweetsTimeline', variables, { features });
        const timeline = data?.data?.list?.tweets_timeline?.timeline;
        const entries = extractTimelineEntries(timeline);
        const tweets = extractTweetsFromEntries(entries);
        const nextCursor = extractCursorFromEntries(entries);
        return { tweets, cursor: nextCursor };
      } catch (err: any) {
        if (!this.isQueryIdMismatch(err)) throw err;
      }

      await this.refreshQueryIds();
      const data = await this.graphqlGet('ListLatestTweetsTimeline', variables, { features });
      const timeline = data?.data?.list?.tweets_timeline?.timeline;
      const entries = extractTimelineEntries(timeline);
      const tweets = extractTweetsFromEntries(entries);
      const nextCursor = extractCursorFromEntries(entries);
      return { tweets, cursor: nextCursor };
    }
  };
}

function extractListsFromEntries(entries: any[]): ListData[] {
  const lists: ListData[] = [];
  for (const entry of entries) {
    const entryId = entry.entryId ?? '';
    if (entryId.startsWith('list-')) {
      const listResult = entry.content?.itemContent?.list;
      if (listResult) {
        lists.push({
          id: listResult.id_str ?? listResult.id ?? '',
          name: listResult.name ?? '',
          description: listResult.description || undefined,
          memberCount: listResult.member_count ?? 0,
          subscriberCount: listResult.subscriber_count ?? 0,
          isPrivate: listResult.mode === 'Private',
          createdAt: listResult.created_at,
        });
      }
    }
  }
  return lists;
}
