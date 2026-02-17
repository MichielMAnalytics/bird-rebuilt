import { Command } from 'commander';
import { getContext, handleError, outputResult } from '../cli/shared.js';
import { printTweets, printSuccess } from '../lib/output.js';
import { extractTweetId } from '../lib/extract-tweet-id.js';
import { addPaginationOptions, getPaginationFlags } from '../cli/pagination.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function registerBookmarkCommands(program: Command): void {
  const bookmarksCmd = program
    .command('bookmarks')
    .description('List your bookmarks');
  addPaginationOptions(bookmarksCmd)
    .action(async (options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const pagination = getPaginationFlags(options);
        const result = await ctx.client.getBookmarks(pagination.count, pagination.cursor);
        if (ctx.json) {
          outputResult(result, true);
        } else {
          printTweets(result.tweets);
        }
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command('unbookmark <tweet-id>')
    .description('Remove a tweet from bookmarks')
    .action(async (tweetIdInput: string, options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const tweetId = extractTweetId(tweetIdInput);
        await ctx.client.unbookmark(tweetId);
        if (ctx.json) {
          outputResult({ success: true, tweetId }, true);
        } else {
          printSuccess(`Bookmark removed for tweet ${tweetId}`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  const likesCmd = program
    .command('likes')
    .description('List your liked tweets');
  addPaginationOptions(likesCmd)
    .action(async (options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const pagination = getPaginationFlags(options);
        const viewer = await ctx.client.getViewerUser();
        if (!viewer) throw new Error('Could not determine your user ID');
        const result = await ctx.client.getLikes(viewer.id, pagination.count, pagination.cursor);
        if (ctx.json) {
          outputResult(result, true);
        } else {
          printTweets(result.tweets);
        }
      } catch (err) {
        handleError(err);
      }
    });
}
