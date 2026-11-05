#!/usr/bin/env node

import { run } from '../src/cli.mjs';

run(process.argv.slice(2)).catch(error => {
  console.error(`hotfix: ${error.message}`);
  if (process.env.HOTFIX_DEBUG === '1' && error.stack) {
    console.error(error.stack);
  }
  process.exitCode = 1;
});
