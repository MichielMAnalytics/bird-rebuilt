# bird-rebuilt

A full-featured X/Twitter CLI built on the undocumented GraphQL API with cookie-based auth. Read tweets, search, post, manage bookmarks, and more — all from your terminal.

## Credits

This project is a clean-room TypeScript rebuild of [@steipete](https://github.com/steipete)'s original [`bird`](https://www.npmjs.com/package/@steipete/bird) CLI. Peter's tool was indispensable — we literally couldn't live without it — and when it was taken down from GitHub, we rebuilt it from scratch so we could keep using it. All credit for the original idea, API approach, and CLI design goes to him.

## What changed from the original

This isn't a fork — it's a rewrite. Key differences:

- **No `@steipete/sweet-cookie` dependency.** The original used a macOS-specific cookie extraction library. We use manual cookie auth only (env vars or CLI flags). Works on any OS.
- **No `json5` dependency.** Plain JSON everywhere.
- **Updated for Twitter's 2026 API changes:**
  - User profile fields (`name`, `screen_name`, `created_at`) moved from `legacy` to a new `core` object in the GraphQL response. We handle both paths with fallbacks.
  - `SearchTimeline` and `Followers` endpoints switched from GET to POST.
  - The REST v1.1 `/account/settings.json` endpoint was deprecated. `whoami`/`check` now use the GraphQL `Viewer` query.
  - `ExplorePage` response structure changed (segmented timelines with an `initialTimeline`).
  - `timeline_v2` renamed to `timeline` in `UserTweets` and `Likes` responses.
  - Many new feature flags required (`grok`-related, `subscriptions`, `rweb_video_screen`, etc.).
  - Fresh GraphQL query IDs scraped from Twitter's current JS bundles.
- **Clean TypeScript source** with ES modules, mixin-based architecture, and zero native dependencies.

## Install

```bash
# Clone and build
git clone https://github.com/AzinAI/bird-rebuilt.git
cd bird-rebuilt
npm install
npm run build

# Or link globally
npm link
```

## Authentication

bird-rebuilt uses cookie-based auth. You need two values from your browser:

1. Open [x.com](https://x.com) and log in
2. Open DevTools (F12) > Application > Cookies > `https://x.com`
3. Copy the values of `auth_token` and `ct0`

Then either export them as env vars:

```bash
export AUTH_TOKEN=your_auth_token_here
export CT0=your_ct0_token_here
```

Or pass them as CLI flags:

```bash
bird --auth-token YOUR_TOKEN --ct0 YOUR_CT0 whoami
```

The credentials are not IP-bound — they work from any machine.

## Usage

```bash
# Check auth
bird whoami
bird check

# Read tweets
bird read https://x.com/user/status/123456789
bird replies 123456789
bird thread 123456789

# Post
bird tweet "Hello from the terminal"
bird reply 123456789 "nice post"

# Search
bird search "typescript graphql"
bird mentions

# Timelines
bird home
bird user-tweets @steipete
bird bookmarks
bird likes

# Social graph
bird follow @someone
bird unfollow @someone
bird following
bird followers

# Lists
bird lists
bird list-timeline 12345

# Discovery
bird news
bird trending

# User info
bird about @steipete

# Query ID management
bird query-ids
```

### Global flags

| Flag | Description |
|---|---|
| `--json` | Output raw JSON |
| `--auth-token <token>` | Auth token (or use `AUTH_TOKEN` env var) |
| `--ct0 <token>` | CSRF token (or use `CT0` env var) |
| `--timeout <ms>` | Request timeout |
| `--verbose` | Verbose output |

### Pagination

Most list commands support `--count <n>` and `--cursor <cursor>` for pagination.

## Architecture

Mixin-based TypeScript client composed from single-responsibility modules:

```
src/
  cli.ts                          # Entry point
  cli/                            # CLI framework (Commander.js)
  commands/                       # Subcommand handlers
  lib/
    twitter-client.ts             # Composed client (all mixins applied)
    twitter-client-base.ts        # Auth, headers, fetch, query IDs
    twitter-client-posting.ts     # tweet, reply
    twitter-client-search.ts      # search (POST)
    twitter-client-tweet-detail.ts # read, replies, thread
    twitter-client-user-tweets.ts # user profile tweets
    twitter-client-home.ts        # home timeline
    twitter-client-timelines.ts   # bookmarks, likes
    twitter-client-follow.ts      # follow, unfollow, followers (POST), following
    twitter-client-lists.ts       # lists, list timeline
    twitter-client-engagement.ts  # like, unlike, retweet, bookmark
    twitter-client-bookmarks.ts   # unbookmark
    twitter-client-users.ts       # viewer (GraphQL)
    twitter-client-user-lookup.ts # user lookup by screen name
    twitter-client-news.ts        # explore/trending
    twitter-client-media.ts       # chunked media upload
    twitter-client-features.ts    # GraphQL feature flags
    twitter-client-utils.ts       # Response parsing (tweets, users)
    twitter-client-constants.ts   # URLs, bearer token, defaults
    query-ids.json                # Baked-in GraphQL query IDs
```

## Query IDs

Twitter's GraphQL endpoints use rotating query IDs tied to their JS bundle versions. The baked-in IDs work as of February 2026. If they go stale (you'll see 404 errors), you can:

1. Scrape fresh ones from Twitter's main bundle:
   ```bash
   curl -s https://x.com | grep -o 'https://abs.twimg.com/responsive-web/client-web/main.[a-f0-9]*.js'
   # Then extract: grep -o 'queryId:"[^"]*",operationName:"[^"]*"' main.xxxxx.js
   ```
2. Update `src/lib/query-ids.json` and rebuild.
3. Or use the runtime cache: `bird query-ids` shows current IDs.

## Dependencies

Just two runtime dependencies:

- `commander` — CLI framework
- `kleur` — Terminal colors

Zero native/binary dependencies. Runs anywhere Node.js runs.

## License

MIT
# bird-rebuilt
