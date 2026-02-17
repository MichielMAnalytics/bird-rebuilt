import { Command } from 'commander';
import { getContext, handleError, outputResult } from '../cli/shared.js';
import { formatTweet, printTweets, printInfo } from '../lib/output.js';
import { extractTweetId } from '../lib/extract-tweet-id.js';
import { addPaginationOptions, getPaginationFlags } from '../cli/pagination.js';

export function registerReadCommands(program: Command): void {
  program
    .command('read <tweet-id>')
    .description('Read a tweet by ID or URL')
    .action(async (tweetIdInput: string, options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const tweetId = extractTweetId(tweetIdInput);
        const tweet = await ctx.client.getTweet(tweetId);
        if (ctx.json) {
          outputResult(tweet, true);
        } else if (tweet) {
          console.log(formatTweet(tweet));
        } else {
          printInfo('Tweet not found or unavailable.');
        }
      } catch (err) {
        handleError(err);
      }
    });

  const repliesCmd = program
    .command('replies <tweet-id>')
    .description('List replies to a tweet');
  addPaginationOptions(repliesCmd)
    .action(async (tweetIdInput: string, options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const tweetId = extractTweetId(tweetIdInput);
        const pagination = getPaginationFlags(options);
        const result = await ctx.client.getReplies(tweetId, pagination.count);
        if (ctx.json) {
          outputResult(result, true);
        } else {
          printTweets(result.replies);
        }
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command('thread <tweet-id>')
    .description('Show conversation thread for a tweet')
    .action(async (tweetIdInput: string, options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const tweetId = extractTweetId(tweetIdInput);
        const thread = await ctx.client.getThread(tweetId);
        if (ctx.json) {
          outputResult(thread, true);
        } else {
          printTweets(thread);
        }
      } catch (err) {
        handleError(err);
      }
    });
}
