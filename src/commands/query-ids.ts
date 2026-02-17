import { Command } from 'commander';
import { handleError } from '../cli/shared.js';
import { printInfo } from '../lib/output.js';
import kleur from 'kleur';

// Import baked-in IDs
import defaultQueryIds from '../lib/query-ids.json' with { type: 'json' };

export function registerQueryIdCommands(program: Command): void {
  const qidCmd = program
    .command('query-ids')
    .description('Show or manage GraphQL query IDs');

  qidCmd
    .command('list')
    .description('List all known query IDs')
    .action(async () => {
      try {
        printInfo('Baked-in Query IDs:');
        for (const [op, id] of Object.entries(defaultQueryIds)) {
          console.log(`  ${kleur.bold(op)}: ${kleur.dim(id as string)}`);
        }
      } catch (err) {
        handleError(err);
      }
    });

  // Default action when just running "bird query-ids"
  qidCmd.action(async () => {
    printInfo('Baked-in Query IDs:');
    for (const [op, id] of Object.entries(defaultQueryIds)) {
      console.log(`  ${kleur.bold(op)}: ${kleur.dim(id as string)}`);
    }
  });
}
