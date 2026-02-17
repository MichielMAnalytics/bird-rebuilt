import kleur from 'kleur';

export function formatTweet(tweet: any, options?: { verbose?: boolean }): string {
  const lines: string[] = [];
  const header = `${kleur.bold(tweet.authorName)} ${kleur.dim('@' + tweet.authorHandle)}`;
  const date = kleur.dim(new Date(tweet.createdAt).toLocaleString());

  lines.push(`${header} ${date}`);
  lines.push(tweet.text);

  if (tweet.media?.length) {
    for (const m of tweet.media) {
      lines.push(kleur.cyan(`[${m.type}] ${m.url}`));
      if (m.altText) lines.push(kleur.dim(`  Alt: ${m.altText}`));
    }
  }

  if (tweet.urls?.length) {
    for (const u of tweet.urls) {
      lines.push(kleur.blue(u.expandedUrl));
    }
  }

  if (tweet.quotedTweet) {
    lines.push(kleur.dim('--- Quoted Tweet ---'));
    lines.push(formatTweet(tweet.quotedTweet));
    lines.push(kleur.dim('--- End Quote ---'));
  }

  if (tweet.card?.title) {
    lines.push(kleur.dim(`[Card: ${tweet.card.title}]`));
  }

  const stats = [
    `${kleur.red('\u2665')} ${tweet.likeCount}`,
    `${kleur.green('\u27F3')} ${tweet.retweetCount}`,
    `${kleur.blue('\uD83D\uDCAC')} ${tweet.replyCount}`,
  ];
  if (tweet.viewCount) stats.push(`${kleur.dim('\uD83D\uDC41')} ${tweet.viewCount}`);
  if (tweet.bookmarkCount) stats.push(`${kleur.yellow('\uD83D\uDD16')} ${tweet.bookmarkCount}`);

  lines.push(stats.join('  '));
  lines.push(kleur.dim(`ID: ${tweet.id} | https://x.com/${tweet.authorHandle}/status/${tweet.id}`));

  return lines.join('\n');
}

export function formatUser(user: any): string {
  const lines: string[] = [];
  lines.push(`${kleur.bold(user.name)} ${kleur.dim('@' + user.screenName)}`);
  if (user.description) lines.push(user.description);
  if (user.location) lines.push(kleur.dim(`\uD83D\uDCCD ${user.location}`));
  lines.push(`Following: ${user.followingCount} | Followers: ${user.followersCount} | Tweets: ${user.tweetCount}`);
  lines.push(kleur.dim(`Joined: ${new Date(user.createdAt).toLocaleDateString()}`));
  if (user.isBlueVerified) lines.push(kleur.blue('\u2713 Verified'));
  lines.push(kleur.dim(`ID: ${user.id}`));
  return lines.join('\n');
}

export function printTweets(tweets: any[], options?: { verbose?: boolean }): void {
  if (tweets.length === 0) {
    console.log(kleur.dim('No tweets found.'));
    return;
  }
  for (let i = 0; i < tweets.length; i++) {
    if (i > 0) console.log(kleur.dim('\u2500'.repeat(60)));
    console.log(formatTweet(tweets[i], options));
  }
}

export function printError(message: string): void {
  console.error(kleur.red(`Error: ${message}`));
}

export function printSuccess(message: string): void {
  console.log(kleur.green(`\u2713 ${message}`));
}

export function printInfo(message: string): void {
  console.log(kleur.blue(`\u2139 ${message}`));
}
