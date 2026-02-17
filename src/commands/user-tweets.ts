import { Command } from 'commander';
import { getContext, handleError, outputResult } from '../cli/shared.js';
import { printTweets } from '../lib/output.js';
import { normalizeHandle } from '../lib/normalize-handle.js';
import { addPaginationOptions, getPaginationFlags } from '../cli/pagination.js';

export function registerUserTweetCommands(program: Command): void {
  const cmd = program
    .command('user-tweets <handle>')
    .description('Show tweets from a user');
  addPaginationOptions(cmd)
    .action(async (handle: string, options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const screenName = normalizeHandle(handle);
        const pagination = getPaginationFlags(options);
        const user = await ctx.client.getUserByScreenName(screenName);
        if (!user) throw new Error(`User @${screenName} not found`);
        const result = await ctx.client.getUserTweets(user.id, pagination.count, pagination.cursor);
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
