import { Command } from 'commander';
import { getContext, handleError, outputResult } from '../cli/shared.js';
import { printSuccess } from '../lib/output.js';
import { extractTweetId } from '../lib/extract-tweet-id.js';

export function registerPostCommands(program: Command): void {
  program
    .command('tweet <text>')
    .description('Post a new tweet')
    .option('-m, --media <paths...>', 'Media file paths to attach')
    .action(async (text: string, options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        let mediaIds: string[] | undefined;
        if (options.media?.length) {
          mediaIds = [];
          for (const path of options.media) {
            const ext = path.split('.').pop()?.toLowerCase();
            const mimeMap: Record<string, string> = {
              jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
              gif: 'image/gif', mp4: 'video/mp4', webp: 'image/webp',
            };
            const mime = mimeMap[ext || ''] || 'application/octet-stream';
            const id = await ctx.client.uploadMedia(path, mime);
            mediaIds.push(id);
          }
        }
        const result = await ctx.client.tweet(text, mediaIds);
        if (result?.errors?.length) {
          throw new Error(result.errors[0].message);
        }
        if (ctx.json) {
          outputResult(result, true);
        } else {
          const tweetId = result?.data?.create_tweet?.tweet_results?.result?.rest_id;
          if (tweetId) {
            printSuccess(`Tweet posted: https://x.com/i/status/${tweetId}`);
          } else {
            printSuccess('Tweet may not have posted — Twitter returned an empty response (possible anti-spam throttle). Check your profile to verify.');
          }
        }
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command('reply <tweet-id> <text>')
    .description('Reply to a tweet')
    .option('-m, --media <paths...>', 'Media file paths to attach')
    .action(async (tweetIdInput: string, text: string, options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const tweetId = extractTweetId(tweetIdInput);
        let mediaIds: string[] | undefined;
        if (options.media?.length) {
          mediaIds = [];
          for (const path of options.media) {
            const ext = path.split('.').pop()?.toLowerCase();
            const mimeMap: Record<string, string> = {
              jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
              gif: 'image/gif', mp4: 'video/mp4', webp: 'image/webp',
            };
            const mime = mimeMap[ext || ''] || 'application/octet-stream';
            const id = await ctx.client.uploadMedia(path, mime);
            mediaIds.push(id);
          }
        }
        const result = await ctx.client.reply(tweetId, text, mediaIds);
        if (result?.errors?.length) {
          throw new Error(result.errors[0].message);
        }
        if (ctx.json) {
          outputResult(result, true);
        } else {
          const replyId = result?.data?.create_tweet?.tweet_results?.result?.rest_id;
          if (replyId) {
            printSuccess(`Reply posted: https://x.com/i/status/${replyId}`);
          } else {
            printSuccess('Reply may not have posted — Twitter returned an empty response (possible anti-spam throttle). Check the thread to verify.');
          }
        }
      } catch (err) {
        handleError(err);
      }
    });
}
