import { Command } from 'commander';
import { getContext, handleError, outputResult } from '../cli/shared.js';
import { printTweets } from '../lib/output.js';
import { addPaginationOptions, getPaginationFlags } from '../cli/pagination.js';

export function registerSearchCommands(program: Command): void {
  const searchCmd = program
    .command('search <query>')
    .description('Search tweets')
    .option('--type <type>', 'Search type: Latest, Top, People, Photos, Videos', 'Latest');
  addPaginationOptions(searchCmd)
    .action(async (query: string, options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const pagination = getPaginationFlags(options);
        const result = await ctx.client.search(query, pagination.count, pagination.cursor, options.type);
        if (ctx.json) {
          outputResult(result, true);
        } else {
          printTweets(result.tweets || []);
        }
      } catch (err) {
        handleError(err);
      }
    });

  const mentionsCmd = program
    .command('mentions')
    .description('Find mentions of your account');
  addPaginationOptions(mentionsCmd)
    .action(async (options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const pagination = getPaginationFlags(options);
        // Get current user first, then search for mentions
        const viewer = await ctx.client.getViewerUser();
        if (!viewer) throw new Error('Could not determine your screen name');
        const query = `@${viewer.screenName}`;
        const result = await ctx.client.search(query, pagination.count, pagination.cursor, 'Latest');
        if (ctx.json) {
          outputResult(result, true);
        } else {
          printTweets(result.tweets || []);
        }
      } catch (err) {
        handleError(err);
      }
    });
}
