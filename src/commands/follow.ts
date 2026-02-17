import { Command } from 'commander';
import { getContext, handleError, outputResult } from '../cli/shared.js';
import { formatUser, printSuccess, printInfo } from '../lib/output.js';
import { normalizeHandle } from '../lib/normalize-handle.js';
import { addPaginationOptions, getPaginationFlags } from '../cli/pagination.js';

export function registerFollowCommands(program: Command): void {
  program
    .command('follow <handle>')
    .description('Follow a user')
    .action(async (handle: string, options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const screenName = normalizeHandle(handle);
        const user = await ctx.client.getUserByScreenName(screenName);
        if (!user) throw new Error(`User @${screenName} not found`);
        await ctx.client.follow(user.id);
        if (ctx.json) {
          outputResult({ success: true, userId: user.id, screenName }, true);
        } else {
          printSuccess(`Now following @${screenName}`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command('unfollow <handle>')
    .description('Unfollow a user')
    .action(async (handle: string, options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const screenName = normalizeHandle(handle);
        const user = await ctx.client.getUserByScreenName(screenName);
        if (!user) throw new Error(`User @${screenName} not found`);
        await ctx.client.unfollow(user.id);
        if (ctx.json) {
          outputResult({ success: true, userId: user.id, screenName }, true);
        } else {
          printSuccess(`Unfollowed @${screenName}`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  const followingCmd = program
    .command('following [handle]')
    .description('List accounts a user follows (default: yourself)');
  addPaginationOptions(followingCmd)
    .action(async (handle: string | undefined, options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const pagination = getPaginationFlags(options);
        let userId: string;
        let displayName: string;

        if (handle) {
          const screenName = normalizeHandle(handle);
          const user = await ctx.client.getUserByScreenName(screenName);
          if (!user) throw new Error(`User @${screenName} not found`);
          userId = user.id;
          displayName = `@${screenName}`;
        } else {
          const viewer = await ctx.client.getViewerUser();
          if (!viewer) throw new Error('Could not determine your user ID');
          userId = viewer.id;
          displayName = 'You';
        }

        const result = await ctx.client.getFollowing(userId, pagination.count, pagination.cursor);
        if (ctx.json) {
          outputResult(result, true);
        } else {
          printInfo(`${displayName} following:`);
          for (const user of result.users) {
            console.log(formatUser(user));
            console.log('');
          }
        }
      } catch (err) {
        handleError(err);
      }
    });

  const followersCmd = program
    .command('followers [handle]')
    .description('List followers (default: yourself)');
  addPaginationOptions(followersCmd)
    .action(async (handle: string | undefined, options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const pagination = getPaginationFlags(options);
        let userId: string;
        let displayName: string;

        if (handle) {
          const screenName = normalizeHandle(handle);
          const user = await ctx.client.getUserByScreenName(screenName);
          if (!user) throw new Error(`User @${screenName} not found`);
          userId = user.id;
          displayName = `@${screenName}`;
        } else {
          const viewer = await ctx.client.getViewerUser();
          if (!viewer) throw new Error('Could not determine your user ID');
          userId = viewer.id;
          displayName = 'You';
        }

        const result = await ctx.client.getFollowers(userId, pagination.count, pagination.cursor);
        if (ctx.json) {
          outputResult(result, true);
        } else {
          printInfo(`${displayName}'s followers:`);
          for (const user of result.users) {
            console.log(formatUser(user));
            console.log('');
          }
        }
      } catch (err) {
        handleError(err);
      }
    });
}
