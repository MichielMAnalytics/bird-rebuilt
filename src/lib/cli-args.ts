export function preprocessArgs(argv: string[]): string[] {
  const args = [...argv];
  // If the first non-flag argument looks like a tweet URL or ID, insert "read" command
  if (args.length >= 3) {
    const firstArg = args[2]; // argv[0]=node, argv[1]=script, argv[2]=first real arg
    if (firstArg && !firstArg.startsWith('-') && !isKnownCommand(firstArg)) {
      if (looksLikeTweetRef(firstArg)) {
        args.splice(2, 0, 'read');
      }
    }
  }
  return args;
}

function isKnownCommand(arg: string): boolean {
  const commands = [
    'tweet', 'reply', 'read', 'replies', 'thread', 'search', 'mentions',
    'bookmarks', 'unbookmark', 'likes', 'home', 'user-tweets', 'following',
    'followers', 'lists', 'list-timeline', 'news', 'trending', 'whoami',
    'check', 'query-ids', 'about', 'follow', 'unfollow', 'help'
  ];
  return commands.includes(arg);
}

function looksLikeTweetRef(arg: string): boolean {
  // Pure digit string (tweet ID)
  if (/^\d{10,}$/.test(arg)) return true;
  // Twitter/X URL
  if (/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/.test(arg)) return true;
  return false;
}
