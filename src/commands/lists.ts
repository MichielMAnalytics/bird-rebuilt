import { Command } from 'commander';
import { getContext, handleError, outputResult } from '../cli/shared.js';
import { printTweets, printInfo } from '../lib/output.js';
import { addPaginationOptions, getPaginationFlags } from '../cli/pagination.js';
import kleur from 'kleur';
import { normalizeHandle } from '../lib/normalize-handle.js';

export function registerListCommands(program: Command): void {
  program
    .command('lists [handle]')
    .description('Show lists for a user (default: yourself)')
    .action(async (handle: string | undefined, options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        let userId: string;

        if (handle) {
          const screenName = normalizeHandle(handle);
          const user = await ctx.client.getUserByScreenName(screenName);
          if (!user) throw new Error(`User @${screenName} not found`);
          userId = user.id;
        } else {
          const viewer = await ctx.client.getViewerUser();
          if (!viewer) throw new Error('Could not determine your user ID');
          userId = viewer.id;
        }

        const lists = await ctx.client.getLists(userId);
        if (ctx.json) {
          outputResult(lists, true);
        } else {
          if (lists.length === 0) {
            printInfo('No lists found.');
            return;
          }
          for (const list of lists) {
            console.log(`${kleur.bold(list.name)} ${kleur.dim(`(ID: ${list.id})`)}`);
            if (list.description) console.log(`  ${list.description}`);
            console.log(`  ${list.memberCount} members | ${list.subscriberCount} subscribers`);
            console.log(`  ${kleur.dim(list.isPrivate ? 'Private' : 'Public')}`);
            console.log('');
          }
        }
      } catch (err) {
        handleError(err);
      }
    });

  const listTimelineCmd = program
    .command('list-timeline <list-id>')
    .description('Show tweets from a list');
  addPaginationOptions(listTimelineCmd)
    .action(async (listId: string, options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const pagination = getPaginationFlags(options);
        const result = await ctx.client.getListTimeline(listId, pagination.count, pagination.cursor);
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
