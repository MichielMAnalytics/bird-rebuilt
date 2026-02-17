import { Command } from 'commander';
import { getVersion } from '../lib/version.js';
import { registerPostCommands } from '../commands/post.js';
import { registerReadCommands } from '../commands/read.js';
import { registerSearchCommands } from '../commands/search.js';
import { registerCheckCommands } from '../commands/check.js';
import { registerBookmarkCommands } from '../commands/bookmarks.js';
import { registerHomeCommands } from '../commands/home.js';
import { registerUserTweetCommands } from '../commands/user-tweets.js';
import { registerFollowCommands } from '../commands/follow.js';
import { registerListCommands } from '../commands/lists.js';
import { registerQueryIdCommands } from '../commands/query-ids.js';
import { registerUserCommands } from '../commands/users.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('bird')
    .description('X/Twitter CLI client')
    .version(getVersion())
    .option('--auth-token <token>', 'Twitter auth_token cookie')
    .option('--ct0 <token>', 'Twitter ct0 cookie (CSRF token)')
    .option('--json', 'Output as JSON')
    .option('--verbose', 'Verbose output')
    .option('--timeout <ms>', 'Request timeout in ms');

  registerPostCommands(program);
  registerReadCommands(program);
  registerSearchCommands(program);
  registerCheckCommands(program);
  registerBookmarkCommands(program);
  registerHomeCommands(program);
  registerUserTweetCommands(program);
  registerFollowCommands(program);
  registerListCommands(program);
  registerQueryIdCommands(program);
  registerUserCommands(program);

  return program;
}
