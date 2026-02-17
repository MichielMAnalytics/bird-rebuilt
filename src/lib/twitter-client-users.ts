import { TwitterClientBase } from './twitter-client-base.js';
import { UserData, parseUserResult } from './twitter-client-utils.js';
import { buildArticleFeatures } from './twitter-client-features.js';

type Constructor<T = {}> = new (...args: any[]) => T;

export function UsersMixin<TBase extends Constructor<TwitterClientBase>>(Base: TBase) {
  return class extends Base {
    async getCurrentUser(): Promise<any> {
      return this.apiGet('/1.1/account/settings.json');
    }

    async getViewerUser(): Promise<UserData | null> {
      const features = buildArticleFeatures();
      const data = await this.graphqlGet('Viewer', {}, { features });
      const result = data?.data?.viewer?.user_results?.result;
      return parseUserResult(result);
    }
  };
}
