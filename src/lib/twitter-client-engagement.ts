import { TwitterClientBase } from './twitter-client-base.js';

type Constructor<T = {}> = new (...args: any[]) => T;

export function EngagementMixin<TBase extends Constructor<TwitterClientBase>>(Base: TBase) {
  return class extends Base {
    async performEngagementMutation(
      operation: string,
      variables: Record<string, any>
    ): Promise<any> {
      try {
        return await this.graphqlPost(operation, variables);
      } catch (err: any) {
        if (!this.isQueryIdMismatch(err)) throw err;
      }
      // Stale query ID — refresh and retry
      await this.refreshQueryIds();
      return await this.graphqlPost(operation, variables);
    }

    async like(tweetId: string): Promise<any> {
      return this.performEngagementMutation('FavoriteTweet', { tweet_id: tweetId });
    }

    async unlike(tweetId: string): Promise<any> {
      return this.performEngagementMutation('UnfavoriteTweet', { tweet_id: tweetId });
    }

    async retweet(tweetId: string): Promise<any> {
      return this.performEngagementMutation('CreateRetweet', {
        tweet_id: tweetId,
        dark_request: false,
      });
    }

    async bookmark(tweetId: string): Promise<any> {
      return this.performEngagementMutation('CreateBookmark', { tweet_id: tweetId });
    }
  };
}
