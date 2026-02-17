#!/usr/bin/env node

import { createProgram } from './cli/program.js';
import { preprocessArgs } from './lib/cli-args.js';

const program = createProgram();
const args = preprocessArgs(process.argv);
program.parse(args);
