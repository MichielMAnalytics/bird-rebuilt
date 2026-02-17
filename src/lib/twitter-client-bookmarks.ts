import { TwitterClientBase } from './twitter-client-base.js';

type Constructor<T = {}> = new (...args: any[]) => T;

export function BookmarksMixin<TBase extends Constructor<TwitterClientBase>>(Base: TBase) {
  return class extends Base {
    async unbookmark(tweetId: string): Promise<any> {
      try {
        return await this.graphqlPost('DeleteBookmark', { tweet_id: tweetId });
      } catch (err: any) {
        if (!this.isQueryIdMismatch(err)) throw err;
      }
      await this.refreshQueryIds();
      return await this.graphqlPost('DeleteBookmark', { tweet_id: tweetId });
    }
  };
}
