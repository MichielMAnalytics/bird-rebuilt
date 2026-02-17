import { TwitterClientBase } from './twitter-client-base.js';
import { UserData, parseUserResult } from './twitter-client-utils.js';
import { buildArticleFeatures } from './twitter-client-features.js';

type Constructor<T = {}> = new (...args: any[]) => T;

export function UserLookupMixin<TBase extends Constructor<TwitterClientBase>>(Base: TBase) {
  return class extends Base {
    async getUserByScreenNameQueryIds(): Promise<string[]> {
      const primary = await this.getQueryId('UserByScreenName');
      return Array.from(new Set([primary, 'AWbeRIdkLtqTRN7yL_H8yw', 'xmU6X_CKcnQ5lSrCbAmJsg']));
    }

    async getUserByScreenName(screenName: string): Promise<UserData | null> {
      const variables = { screen_name: screenName };
      const features = buildArticleFeatures();
      const queryIds = await this.getUserByScreenNameQueryIds();

      // GraphQL with query ID loop
      for (const queryId of queryIds) {
        try {
          const data = await this.graphqlGet('UserByScreenName', variables, {
            queryId,
            features,
          });
          const result = data?.data?.user?.result;
          const user = parseUserResult(result);
          if (user) return user;
        } catch (err: any) {
          if (this.isQueryIdMismatch(err)) continue;
          // Non-404 error — try REST fallback
          break;
        }
      }

      // Refresh and try once more with GraphQL
      await this.refreshQueryIds();
      try {
        const data = await this.graphqlGet('UserByScreenName', variables, { features });
        const result = data?.data?.user?.result;
        const user = parseUserResult(result);
        if (user) return user;
      } catch {
        // Fall through to REST
      }

      // REST fallback — try x.com first, then api.twitter.com
      return await this.userLookupRest(screenName);
    }

    async getUserById(userId: string): Promise<UserData | null> {
      const variables = { userId, withSafetyModeUserFields: true };
      const features = buildArticleFeatures();

      try {
        const data = await this.graphqlGet('UserByRestId', variables, { features });
        const result = data?.data?.user?.result;
        const user = parseUserResult(result);
        if (user) return user;
      } catch (err: any) {
        if (this.isQueryIdMismatch(err)) {
          await this.refreshQueryIds();
          try {
            const data = await this.graphqlGet('UserByRestId', variables, { features });
            const result = data?.data?.user?.result;
            const user = parseUserResult(result);
            if (user) return user;
          } catch {
            // Fall through to REST
          }
        }
      }

      // REST fallback
      try {
        const data = await this.apiGet(`/1.1/users/show.json?user_id=${encodeURIComponent(userId)}`);
        return this.parseRestUser(data);
      } catch {
        return null;
      }
    }

    async userLookupRest(screenName: string): Promise<UserData | null> {
      try {
        const data = await this.apiGet(
          `/1.1/users/show.json?screen_name=${encodeURIComponent(screenName)}`
        );
        return this.parseRestUser(data);
      } catch {
        return null;
      }
    }

    parseRestUser(data: any): UserData | null {
      if (!data || data.errors) return null;
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
