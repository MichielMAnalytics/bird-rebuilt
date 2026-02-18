---
name: bird
description: |
  Interact with X/Twitter from the terminal using the bird-rebuilt CLI.
  Use when: (1) User says "/bird", (2) User wants to read, search, post, or reply on Twitter/X,
  (3) User wants to check their Twitter timeline, bookmarks, mentions, or followers,
  (4) An AI agent needs to interact with X/Twitter programmatically.
  Requires AUTH_TOKEN and CT0 environment variables to be set.
---

# Bird — X/Twitter CLI

Read, search, post, and interact with X/Twitter from the terminal.

## Setup

The bird CLI must be built and available on the system. The binary path is determined by the `BIRD_CLI` environment variable, or defaults to `bird` on PATH.

```bash
# Option A: env var pointing to the built CLI
export BIRD_CLI="node /path/to/bird-rebuilt/dist/cli.js"

# Option B: if installed globally or linked via npm
# npx or npm link makes `bird` available on PATH
```

Auth cookies must be set as env vars:

```bash
export AUTH_TOKEN=<your_auth_token>
export CT0=<your_ct0>
```

Get these from browser DevTools > Application > Cookies > x.com.

For brevity, all examples below use `bird` as shorthand. Replace with the value of `BIRD_CLI` if needed.

## Commands Reference

### Reading

```bash
# Read a specific tweet (accepts URL or ID)
bird read https://x.com/user/status/123456789
bird read 123456789

# Show replies to a tweet
bird replies 123456789 --count 10

# Show full conversation thread
bird thread 123456789
```

### Searching

```bash
# Search tweets
bird search "your query here" --count 20

# Search types: Latest (default), Top, People, Photos, Videos
bird search "AI agents" --type Top

# Find mentions of your account
bird mentions --count 10
```

### Posting

```bash
# Post a tweet
bird tweet "Hello from the terminal"

# Reply to a tweet
bird reply 123456789 "Great point!"
bird reply https://x.com/user/status/123456789 "Interesting thread"
```

### Timelines

```bash
# Home timeline
bird home --count 20

# A user's tweets
bird user-tweets @steipete --count 10

# Your bookmarks
bird bookmarks --count 10

# Your likes
bird likes --count 10
```

### Social Graph

```bash
# Follow / unfollow
bird follow @username
bird unfollow @username

# List who you follow / who follows you
bird following --count 20
bird followers --count 20

# List who someone else follows
bird following @username --count 20
```

### User Info

```bash
# Your own account
bird whoami

# Check auth is working
bird check

# Detailed info about any user
bird about @username
```

### Discovery

```bash
# Trending / explore page
bird news
bird trending
```

### Lists

```bash
# Your lists
bird lists

# Tweets from a specific list
bird list-timeline 12345 --count 20
```

### JSON Output

Add `--json` to any command for structured output (useful for agents parsing results):

```bash
bird search "AI agents" --json
bird read 123456789 --json
bird home --count 5 --json
```

## Common Agent Workflows

### Monitor mentions and reply
```bash
bird mentions --count 5
bird reply <tweet-id> "Thanks for the mention!"
```

### Research a topic
```bash
bird search "topic of interest" --count 20 --type Latest
bird thread <tweet-id>
```

### Engage with content
```bash
bird user-tweets @handle --count 10
bird reply <tweet-id> "Great insight"
```

## Pagination

Most list commands support:
- `--count <n>` — Number of results (default: 20)
- `--cursor <cursor>` — Continue from a previous page (cursor is returned in JSON output)

## Troubleshooting

- **404 errors**: Query IDs may be stale. The client auto-retries with fallback IDs and can scrape fresh ones from Twitter's JS bundles.
- **Auth errors**: Verify `AUTH_TOKEN` and `CT0` are set and valid. Cookies expire — refresh from browser if needed.
- **Rate limits**: The client auto-retries on 429 with exponential backoff. If persistent, wait a few minutes.
