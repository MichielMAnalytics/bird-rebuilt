import { Command } from 'commander';
import { getContext, handleError, outputResult } from '../cli/shared.js';
import { formatUser, printInfo } from '../lib/output.js';
import { normalizeHandle } from '../lib/normalize-handle.js';

function printExploreTrends(data: any): void {
  // The explore page returns timelines; the initial one has inline instructions
  const initialTimeline = data?.body?.initialTimeline?.timeline?.timeline;
  const fallbackTimeline = data?.body?.timelines?.[0]?.timeline;
  const timeline = initialTimeline ?? fallbackTimeline;
  if (!timeline) {
    console.log('  Unable to parse explore data. Use --json for raw output.');
    return;
  }
  const instructions = timeline.instructions ?? [];
  const addEntries = instructions.find((i: any) => i.type === 'TimelineAddEntries');
  const entries = addEntries?.entries ?? [];
  let count = 0;
  for (const entry of entries) {
    // Trends can be in modules (items array) or direct items
    const items = entry.content?.items ?? [{ item: { itemContent: entry.content?.itemContent } }];
    for (const item of items) {
      const trend = item.item?.itemContent?.trend ?? item.item?.itemContent;
      if (trend?.name) {
        count++;
        const meta = trend.trendMetadata?.metaDescription ?? trend.social_context?.text ?? '';
        console.log(`  ${count}. ${trend.name}${meta ? ` — ${meta}` : ''}`);
      }
    }
  }
  if (count === 0) {
    console.log('  No trends found. Use --json for raw output.');
  }
}

export function registerUserCommands(program: Command): void {
  program
    .command('about <handle>')
    .description('Show detailed info about a user')
    .action(async (handle: string, options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const screenName = normalizeHandle(handle);
        const user = await ctx.client.getUserByScreenName(screenName);
        if (!user) throw new Error(`User @${screenName} not found`);
        if (ctx.json) {
          outputResult(user, true);
        } else {
          console.log(formatUser(user));
        }
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command('news')
    .description('Show trending/explore page')
    .action(async (options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const data = await ctx.client.getExplorePage();
        if (ctx.json) {
          outputResult(data, true);
        } else {
          printInfo('Trending / Explore:');
          printExploreTrends(data);
        }
      } catch (err) {
        handleError(err);
      }
    });

  program
    .command('trending')
    .description('Show trending topics (alias for news)')
    .action(async (options: any, command: Command) => {
      try {
        const ctx = getContext(command.optsWithGlobals());
        const data = await ctx.client.getExplorePage();
        if (ctx.json) {
          outputResult(data, true);
        } else {
          printInfo('Trending Topics:');
          printExploreTrends(data);
        }
      } catch (err) {
        handleError(err);
      }
    });
}
