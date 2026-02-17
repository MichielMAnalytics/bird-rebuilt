export const BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

export const GRAPHQL_API_BASE = 'https://x.com/i/api/graphql';
export const GRAPHQL_POST_URL = 'https://x.com/i/api/graphql';
export const API_BASE = 'https://x.com/i/api';
export const UPLOAD_API_BASE = 'https://upload.x.com/i/media/upload.json';
export const STATUS_UPDATE_URL = 'https://x.com/i/api/1.1/statuses/update.json';

export const DEFAULT_TWEET_COUNT = 20;
export const DEFAULT_TIMEOUT_MS = 30000;
export const MAX_TWEET_LENGTH = 25000;

export const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const FALLBACK_QUERY_IDS: Record<string, string> = {
  CreateTweet: 'TAJw1rBsjAtdNgTdlo2oeg',
  CreateRetweet: 'ojPdsZsimiJrUGLR1sjUtA',
  DeleteRetweet: 'iQtK4dl5hBmXewYZuEOKVw',
  CreateFriendship: '8h9JVdV8dlSyqyRDJEPCsA',
  DestroyFriendship: 'ppXWuagMNXgvzx6WoXBW0Q',
  FavoriteTweet: 'lI07N6Otwv1PhnEgXILM7A',
  UnfavoriteTweet: 'ZYKSe-w7KEslx3JhSIk5LA',
  CreateBookmark: 'aoDbu3RHznuiSkQ9aNM67Q',
  DeleteBookmark: 'Wlmlj2-xzyS1GN3a6cj-mQ',
  TweetDetail: '97JF30KziU00483E_8elBA',
  SearchTimeline: 'M1jEez78PEfVfbQLvlWMvQ',
  UserArticlesTweets: '8zBy9h4L90aDL02RsBcCFg',
  UserTweets: 'Wms1GvIiHXAPBaCr9KblaA',
  Bookmarks: 'RV1g3b8n_SGOHwkqKYSCFw',
  BookmarkFolderTimeline: 'KJIQpsvxrTfRIlbaRIySHQ',
  Following: 'BEkNpEt5pNETESoqMsTEGA',
  Followers: 'kuFUYP9eV1FPoEy4N-pi7w',
  Likes: 'JR2gceKucIKcVNB_9JkhsA',
  ListLatestTweetsTimeline: '2TemLyqrMpTeAmysdbnVqw',
  ListByRestId: 'wXzyA5vM_aVkBL9G8Vp3kw',
  HomeTimeline: 'edseUwk9sP5Phz__9TIRnA',
  HomeLatestTimeline: 'iOEZpOdfekFsxSlPQCQtPg',
  ExploreSidebar: 'lpSN4M6qpimkF4nRFPE3nQ',
  ExplorePage: 'kheAINB_4pzRDqkzG3K-ng',
  GenericTimelineById: 'uGSr7alSjR9v6QJAIaqSKQ',
  TrendHistory: 'Sj4T-jSB9pr0Mxtsc1UKZQ',
  AboutAccountQuery: 'zs_jFPFT78rBpXv9Z3U2YQ',
};

// Merged query IDs: fallbacks overridden by query-ids.json
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const queryIdsFromFile: Record<string, string> = require('./query-ids.json');

export const QUERY_IDS: Record<string, string> = {
  ...FALLBACK_QUERY_IDS,
  ...queryIdsFromFile,
};

export const TARGET_QUERY_ID_OPERATIONS = Object.keys(FALLBACK_QUERY_IDS);
