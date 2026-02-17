import { TwitterClientBase } from './twitter-client-base.js';
import {
  UserData,
  parseUserResult,
  extractTimelineEntries,
  extractCursorFromEntries,
} from './twitter-client-utils.js';
import {
  DEFAULT_TWEET_COUNT,
} from './twitter-client-constants.js';
import { buildFollowingFeatures } from './twitter-client-features.js';

type Constructor<T = {}> = new (...args: any[]) => T;

export function FollowMixin<TBase extends Constructor<TwitterClientBase>>(Base: TBase) {
  return class extends Base {
    async follow(userId: string): Promise<any> {
      // REST first (more reliable for mutations)
      try {
        return await this.apiPost('/1.1/friendships/create.json', `user_id=${userId}`);
      } catch (err: any) {
        const code = this.extractTwitterErrorCode(err);
        if (code === 160) return { already_following: true };
        if (code === 162) throw new Error('Cannot follow: you are blocked by this user');
        if (code === 108) throw new Error('Cannot follow: user not found');
        // REST failed — try GraphQL fallback
      }

      // GraphQL fallback
      try {
        return await this.graphqlPost('CreateFriendship', { user_id: userId });
      } catch (err: any) {
        if (!this.isQueryIdMismatch(err)) throw err;
      }
      await this.refreshQueryIds();
      return await this.graphqlPost('CreateFriendship', { user_id: userId });
    }

    async unfollow(userId: string): Promise<any> {
      // REST first
      try {
        return await this.apiPost('/1.1/friendships/destroy.json', `user_id=${userId}`);
      } catch (err: any) {
        const code = this.extractTwitterErrorCode(err);
        if (code === 108) throw new Error('Cannot unfollow: user not found');
        // REST failed — try GraphQL fallback
      }

      // GraphQL fallback
      try {
        return await this.graphqlPost('DestroyFriendship', { user_id: userId });
      } catch (err: any) {
        if (!this.isQueryIdMismatch(err)) throw err;
      }
      await this.refreshQueryIds();
      return await this.graphqlPost('DestroyFriendship', { user_id: userId });
    }

    async getFollowersQueryIds(): Promise<string[]> {
      const primary = await this.getQueryId('Followers');
      return Array.from(new Set([primary, 'kuFUYP9eV1FPoEy4N-pi7w', 'SFYY3WsgwjlXSLlfnEUE4A']));
    }

    async getFollowingQueryIds(): Promise<string[]> {
      const primary = await this.getQueryId('Following');
      return Array.from(new Set([primary, 'BEkNpEt5pNETESoqMsTEGA', 'mWYeougg_ocJS2Vr1Vt28w']));
    }

    async getFollowers(
      userId: string,
      count?: number,
      cursor?: string
    ): Promise<{ users: UserData[]; cursor?: string }> {
      const features = buildFollowingFeatures();
      const variables: Record<string, any> = {
        userId,
        count: count ?? DEFAULT_TWEET_COUNT,
        includePromotedContent: false,
      };
      if (cursor) variables.cursor = cursor;

      const queryIds = await this.getFollowersQueryIds();

      // GraphQL with query ID loop
      for (const queryId of queryIds) {
        try {
          const data = await this.graphqlGet('Followers', variables, {
            queryId,
            features,
          });
          const timeline = data?.data?.user?.result?.timeline?.timeline;
          const entries = extractTimelineEntries(timeline);
          const users = extractUsersFromEntries(entries);
          const nextCursor = extractCursorFromEntries(entries);
          return { users, cursor: nextCursor };
        } catch (err: any) {
          if (this.isQueryIdMismatch(err)) continue;
          // Non-404 error — try REST fallback
          break;
        }
      }

      // REST fallback
      const params = new URLSearchParams({
        user_id: userId,
        count: String(count ?? DEFAULT_TWEET_COUNT),
      });
      if (cursor) params.set('cursor', cursor);

      try {
        const data = await this.apiGet(`/1.1/followers/list.json?${params.toString()}`);
        const users = (data?.users ?? [])
          .map((u: any) => this.parseRestFollowUser(u))
          .filter(Boolean) as UserData[];
        const nextCursor =
          data?.next_cursor_str && data.next_cursor_str !== '0'
            ? data.next_cursor_str
            : undefined;
        return { users, cursor: nextCursor };
      } catch {
        // Final attempt: refresh GraphQL IDs and try once more
        await this.refreshQueryIds();
        const data = await this.graphqlGet('Followers', variables, { features });
        const timeline = data?.data?.user?.result?.timeline?.timeline;
        const entries = extractTimelineEntries(timeline);
        const users = extractUsersFromEntries(entries);
        const nextCursor = extractCursorFromEntries(entries);
        return { users, cursor: nextCursor };
      }
    }

    async getFollowing(
      userId: string,
      count?: number,
      cursor?: string
    ): Promise<{ users: UserData[]; cursor?: string }> {
      const features = buildFollowingFeatures();
      const variables: Record<string, any> = {
        userId,
        count: count ?? DEFAULT_TWEET_COUNT,
        includePromotedContent: false,
      };
      if (cursor) variables.cursor = cursor;

      const queryIds = await this.getFollowingQueryIds();

      // GraphQL with query ID loop
      for (const queryId of queryIds) {
        try {
          const data = await this.graphqlGet('Following', variables, {
            queryId,
            features,
          });
          const timeline = data?.data?.user?.result?.timeline?.timeline;
          const entries = extractTimelineEntries(timeline);
          const users = extractUsersFromEntries(entries);
          const nextCursor = extractCursorFromEntries(entries);
          return { users, cursor: nextCursor };
        } catch (err: any) {
          if (this.isQueryIdMismatch(err)) continue;
          // Non-404 error — try REST fallback
          break;
        }
      }

      // REST fallback
      const params = new URLSearchParams({
        user_id: userId,
        count: String(count ?? DEFAULT_TWEET_COUNT),
      });
      if (cursor) params.set('cursor', cursor);

      try {
        const data = await this.apiGet(`/1.1/friends/list.json?${params.toString()}`);
        const users = (data?.users ?? [])
          .map((u: any) => this.parseRestFollowUser(u))
          .filter(Boolean) as UserData[];
        const nextCursor =
          data?.next_cursor_str && data.next_cursor_str !== '0'
            ? data.next_cursor_str
            : undefined;
        return { users, cursor: nextCursor };
      } catch {
        // Final attempt: refresh GraphQL IDs and try once more
        await this.refreshQueryIds();
        const data = await this.graphqlGet('Following', variables, { features });
        const timeline = data?.data?.user?.result?.timeline?.timeline;
        const entries = extractTimelineEntries(timeline);
        const users = extractUsersFromEntries(entries);
        const nextCursor = extractCursorFromEntries(entries);
        return { users, cursor: nextCursor };
      }
    }

    extractTwitterErrorCode(err: any): number | undefined {
      try {
        const body = err?.responseBody ?? '';
        const parsed = JSON.parse(body);
        return parsed?.errors?.[0]?.code;
      } catch {
        return undefined;
      }
    }

    parseRestFollowUser(data: any): UserData | null {
      if (!data) return null;
      return {
        id: data.id_str ?? String(data.id ?? ''),
        name: data.name ?? '',
        screenName: data.screen_name ?? '',
        description: data.description ?? '',
        followersCount: data.followers_count ?? 0,
        followingCount: data.friends_count ?? 0,
        tweetCount: data.statuses_count ?? 0,
        createdAt: data.created_at ?? '',
        verified: data.verified ?? false,
        isBlueVerified: false,
        profileImageUrl: data.profile_image_url_https ?? '',
        profileBannerUrl: data.profile_banner_url,
        location: data.location || undefined,
        url: data.entities?.url?.urls?.[0]?.expanded_url ?? data.url ?? undefined,
        pinnedTweetIds: data.pinned_tweet_ids_str,
      };
    }
  };
}

function extractUsersFromEntries(entries: any[]): UserData[] {
  const users: UserData[] = [];
  for (const entry of entries) {
    const entryId = entry.entryId ?? '';
    if (entryId.startsWith('user-')) {
      const userResult = entry.content?.itemContent?.user_results?.result;
      const user = parseUserResult(userResult);
      if (user) users.push(user);
    }
  }
  return users;
}
