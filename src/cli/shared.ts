import { TwitterClient } from '../lib/twitter-client.js';
import { resolveCredentials } from '../lib/cookies.js';
import { printError } from '../lib/output.js';

export interface CliContext {
  client: TwitterClient;
  json: boolean;
  verbose: boolean;
}

export function createClient(options: any): TwitterClient {
  const creds = resolveCredentials({
    authToken: options.authToken,
    ct0: options.ct0,
  });
  return new TwitterClient({
    credentials: creds,
    timeout: options.timeout ? parseInt(options.timeout, 10) : undefined,
  });
}

export function getContext(options: any): CliContext {
  const client = createClient(options);
  return {
    client,
    json: !!options.json,
    verbose: !!options.verbose,
  };
}

export function outputResult(data: any, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  }
}

export function handleError(err: unknown): never {
  if (err instanceof Error) {
    printError(err.message);
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
  } else {
    printError(String(err));
  }
  process.exit(1);
}
