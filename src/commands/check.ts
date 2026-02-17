import { Command } from 'commander';
import { getContext, handleError, outputResult } from '../cli/shared.js';
import { printSuccess, printInfo, formatUser } from '../lib/output.js';

export function registerCheckCommands(program: Command): void {
  program
    .command('whoami')
    .description('Show the currently authenticated user')
    .action(async (options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const viewer = await ctx.client.getViewerUser();
        if (!viewer) throw new Error('Could not retrieve viewer user');
        if (ctx.json) {
          outputResult(viewer, true);
        } else {
          printSuccess(`Logged in as @${viewer.screenName}`);
          console.log(formatUser(viewer));
        }
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command('check')
    .description('Check authentication status')
    .action(async (options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const viewer = await ctx.client.getViewerUser();
        if (!viewer) throw new Error('Authentication failed');
        if (ctx.json) {
          outputResult({ authenticated: true, screen_name: viewer.screenName }, true);
        } else {
          printSuccess(`Authentication OK -- logged in as @${viewer.screenName}`);
        }
      } catch (err) {
        handleError(err);
      }
    });
}
