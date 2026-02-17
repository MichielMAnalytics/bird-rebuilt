export interface TweetData {
  id: string;
  text: string;
  authorName: string;
  authorHandle: string;
  authorId: string;
  createdAt: string;
  replyCount: number;
  retweetCount: number;
  likeCount: number;
  viewCount: number;
  bookmarkCount: number;
  quoteCount: number;
  lang: string;
  isRetweet: boolean;
  isReply: boolean;
  inReplyToId?: string;
  quotedTweet?: TweetData;
  media?: MediaItem[];
  urls?: UrlItem[];
  card?: CardData;
  articleText?: string;
}

export interface MediaItem {
  type: 'photo' | 'video' | 'animated_gif';
  url: string;
  altText?: string;
  width?: number;
  height?: number;
  videoUrl?: string;
  durationMs?: number;
}

export interface UrlItem {
  url: string;
  expandedUrl: string;
  displayUrl: string;
}

export interface CardData {
  type: string;
  title?: string;
  description?: string;
  url?: string;
}

export interface UserData {
  id: string;
  name: string;
  screenName: string;
  description: string;
  followersCount: number;
  followingCount: number;
  tweetCount: number;
  createdAt: string;
  verified: boolean;
  isBlueVerified: boolean;
  profileImageUrl: string;
  profileBannerUrl?: string;
  location?: string;
  url?: string;
  pinnedTweetIds?: string[];
}

function parseMedia(mediaEntities: any[]): MediaItem[] {
  if (!Array.isArray(mediaEntities)) return [];
  return mediaEntities.map((m) => {
    const item: MediaItem = {
      type: m.type === 'animated_gif' ? 'animated_gif' : m.type === 'video' ? 'video' : 'photo',
      url: m.media_url_https ?? m.media_url ?? '',
      altText: m.ext_alt_text,
      width: m.original_info?.width,
      height: m.original_info?.height,
    };

    if (m.type === 'video' || m.type === 'animated_gif') {
      const variants = m.video_info?.variants ?? [];
      // Pick the highest bitrate mp4 variant
      const mp4Variants = variants
        .filter((v: any) => v.content_type === 'video/mp4')
        .sort((a: any, b: any) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
      if (mp4Variants.length > 0) {
        item.videoUrl = mp4Variants[0].url;
      }
      item.durationMs = m.video_info?.duration_millis;
    }

    return item;
  });
}

function parseUrls(urlEntities: any[]): UrlItem[] {
  if (!Array.isArray(urlEntities)) return [];
  return urlEntities.map((u) => ({
    url: u.url ?? '',
    expandedUrl: u.expanded_url ?? '',
    displayUrl: u.display_url ?? '',
  }));
}

function parseCard(cardLegacy: any): CardData | undefined {
  if (!cardLegacy) return undefined;
  const bindingValues = cardLegacy.binding_values ?? [];
  const getVal = (key: string): string | undefined => {
    const entry = bindingValues.find((bv: any) => bv.key === key);
    return entry?.value?.string_value;
  };
  return {
    type: cardLegacy.name ?? 'unknown',
    title: getVal('title'),
    description: getVal('description'),
    url: getVal('url') ?? getVal('card_url'),
  };
}

export function extractArticleText(card: any): string | undefined {
  if (!card) return undefined;
  const legacy = card.legacy ?? card;
  const bindingValues = legacy.binding_values ?? [];
  const entry = bindingValues.find(
    (bv: any) => bv.key === 'article_plain_text' || bv.key === 'unified_card'
  );
  return entry?.value?.string_value;
}

export function parseTweetResult(result: any): TweetData | null {
  if (!result) return null;

  const typename = result.__typename;

  // Handle tombstones (deleted/unavailable tweets)
  if (typename === 'TweetTombstone') return null;

  // Unwrap TweetWithVisibilityResults
  if (typename === 'TweetWithVisibilityResults') {
    result = result.tweet;
    if (!result) return null;
  }

  const legacy = result.legacy;
  if (!legacy) return null;

  // Author info — Twitter moved name/screen_name to user_results.result.core
  const userResult = result.core?.user_results?.result;
  const userLegacy = userResult?.legacy;
  const userCore = userResult?.core;
  const authorName = userCore?.name ?? userLegacy?.name ?? '';
  const authorHandle = userCore?.screen_name ?? userLegacy?.screen_name ?? '';
  const authorId = userResult?.rest_id ?? '';

  // Use note_tweet text if available (long tweets), otherwise full_text
  const noteTweetText = result.note_tweet?.note_tweet_results?.result?.text;
  const text = noteTweetText ?? legacy.full_text ?? '';

  // Check for retweet
  const isRetweet = !!legacy.retweeted_status_result?.result;
  const isReply = !!legacy.in_reply_to_status_id_str;

  // Media from extended_entities (preferred) or entities
  const mediaEntities =
    legacy.extended_entities?.media ?? legacy.entities?.media ?? [];
  const media = parseMedia(mediaEntities);

  // URLs
  const urlEntities = legacy.entities?.urls ?? [];
  const urls = parseUrls(urlEntities);

  // Card
  const card = parseCard(result.card?.legacy);

  // Article text
  const articleText = extractArticleText(result.card);

  // Quoted tweet
  let quotedTweet: TweetData | undefined;
  if (result.quoted_status_result?.result) {
    quotedTweet = parseTweetResult(result.quoted_status_result.result) ?? undefined;
  }

  // View count
  const viewCount = parseInt(result.views?.count ?? '0', 10) || 0;

  return {
    id: legacy.id_str ?? result.rest_id ?? '',
    text,
    authorName,
    authorHandle,
    authorId,
    createdAt: legacy.created_at ?? '',
    replyCount: legacy.reply_count ?? 0,
    retweetCount: legacy.retweet_count ?? 0,
    likeCount: legacy.favorite_count ?? 0,
    viewCount,
    bookmarkCount: legacy.bookmark_count ?? 0,
    quoteCount: legacy.quote_count ?? 0,
    lang: legacy.lang ?? 'en',
    isRetweet,
    isReply,
    inReplyToId: legacy.in_reply_to_status_id_str,
    quotedTweet,
    media: media.length > 0 ? media : undefined,
    urls: urls.length > 0 ? urls : undefined,
    card,
    articleText,
  };
}

export function parseUserResult(result: any): UserData | null {
  if (!result) return null;

  // Handle different wrappers
  if (result.__typename === 'UserUnavailable') return null;

  const legacy = result.legacy;
  if (!legacy) return null;

  // Twitter restructured: name/screen_name/created_at moved to result.core
  // avatar moved to result.avatar, bio to result.profile_bio, location to result.location
  const core = result.core ?? {};

  return {
    id: result.rest_id ?? '',
    name: core.name ?? legacy.name ?? '',
    screenName: core.screen_name ?? legacy.screen_name ?? '',
    description: result.profile_bio?.description ?? legacy.description ?? '',
    followersCount: legacy.followers_count ?? 0,
    followingCount: legacy.friends_count ?? 0,
    tweetCount: legacy.statuses_count ?? 0,
    createdAt: core.created_at ?? legacy.created_at ?? '',
    verified: result.verification?.verified ?? legacy.verified ?? false,
    isBlueVerified: result.is_blue_verified ?? false,
    profileImageUrl: result.avatar?.image_url ?? legacy.profile_image_url_https ?? '',
    profileBannerUrl: legacy.profile_banner_url,
    location: result.location?.location || legacy.location || undefined,
    url: legacy.entities?.url?.urls?.[0]?.expanded_url ?? legacy.url ?? undefined,
    pinnedTweetIds: legacy.pinned_tweet_ids_str,
  };
}

export function extractTimelineEntries(
  data: any,
  instructionType: string = 'TimelineAddEntries'
): any[] {
  const instructions = data?.instructions ?? [];
  const instruction = instructions.find(
    (inst: any) => inst.type === instructionType
  );
  return instruction?.entries ?? [];
}

export function extractTweetsFromEntries(entries: any[]): TweetData[] {
  const tweets: TweetData[] = [];
  for (const entry of entries) {
    const entryId = entry.entryId ?? '';
    // Standard tweet entries
    if (entryId.startsWith('tweet-') || entryId.startsWith('list-tweet-')) {
      const tweetResult =
        entry.content?.itemContent?.tweet_results?.result;
      const tweet = parseTweetResult(tweetResult);
      if (tweet) tweets.push(tweet);
    }
    // Profile conversation modules (pinned tweets, etc.)
    if (entryId.startsWith('profile-conversation-') || entryId.startsWith('conversationthread-')) {
      const items = entry.content?.items ?? [];
      for (const item of items) {
        const tweetResult =
          item.item?.itemContent?.tweet_results?.result;
        const tweet = parseTweetResult(tweetResult);
        if (tweet) tweets.push(tweet);
      }
    }
  }
  return tweets;
}

export function extractCursorFromEntries(
  entries: any[],
  cursorType: string = 'Bottom'
): string | undefined {
  for (const entry of entries) {
    const entryId = entry.entryId ?? '';
    if (entryId.startsWith(`cursor-bottom`) || entryId.startsWith(`cursor-${cursorType.toLowerCase()}`)) {
      return entry.content?.value ?? entry.content?.itemContent?.value;
    }
  }
  return undefined;
}
