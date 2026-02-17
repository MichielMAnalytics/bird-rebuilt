import { Command } from 'commander';
import { getContext, handleError, outputResult } from '../cli/shared.js';
import { printTweets } from '../lib/output.js';
import { addPaginationOptions, getPaginationFlags } from '../cli/pagination.js';

export function registerHomeCommands(program: Command): void {
  const homeCmd = program
    .command('home')
    .description('Show home timeline');
  addPaginationOptions(homeCmd)
    .action(async (options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const pagination = getPaginationFlags(options);
        const result = await ctx.client.getHomeTimeline(pagination.count, pagination.cursor);
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
