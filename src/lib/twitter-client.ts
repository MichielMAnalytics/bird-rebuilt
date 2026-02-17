import { TwitterClientBase, ClientOptions } from './twitter-client-base.js';
import { PostingMixin } from './twitter-client-posting.js';
import { TweetDetailMixin } from './twitter-client-tweet-detail.js';
import { SearchMixin } from './twitter-client-search.js';
import { UserLookupMixin } from './twitter-client-user-lookup.js';
import { HomeMixin } from './twitter-client-home.js';
import { UserTweetsMixin } from './twitter-client-user-tweets.js';
import { EngagementMixin } from './twitter-client-engagement.js';
import { BookmarksMixin } from './twitter-client-bookmarks.js';
import { TimelinesMixin } from './twitter-client-timelines.js';
import { FollowMixin } from './twitter-client-follow.js';
import { ListsMixin } from './twitter-client-lists.js';
import { MediaMixin } from './twitter-client-media.js';
import { UsersMixin } from './twitter-client-users.js';
import { NewsMixin } from './twitter-client-news.js';

const Mixed = PostingMixin(
  TweetDetailMixin(
    SearchMixin(
      UserLookupMixin(
        HomeMixin(
          UserTweetsMixin(
            EngagementMixin(
              BookmarksMixin(
                TimelinesMixin(
                  FollowMixin(
                    ListsMixin(
                      MediaMixin(
                        UsersMixin(
                          NewsMixin(
                            TwitterClientBase
                          )
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  )
);

export class TwitterClient extends Mixed {
  constructor(options: ClientOptions) {
    super(options);
  }
}

export type { TwitterCredentials, ClientOptions } from './twitter-client-base.js';
