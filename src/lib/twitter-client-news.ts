import { TwitterClientBase } from './twitter-client-base.js';
import { buildExploreFeatures } from './twitter-client-features.js';

type Constructor<T = {}> = new (...args: any[]) => T;

export function NewsMixin<TBase extends Constructor<TwitterClientBase>>(Base: TBase) {
  return class extends Base {
    async getExplorePage(): Promise<any> {
      const features = buildExploreFeatures();
      try {
        const data = await this.graphqlGet('ExplorePage', {}, { features });
        return data?.data?.explore_page;
      } catch (err: any) {
        if (!this.isQueryIdMismatch(err)) throw err;
      }
      // Stale query ID — refresh and retry
      await this.refreshQueryIds();
      const data = await this.graphqlGet('ExplorePage', {}, { features });
      return data?.data?.explore_page;
    }
  };
}
