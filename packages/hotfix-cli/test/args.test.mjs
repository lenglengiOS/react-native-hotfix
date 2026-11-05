import assert from 'node:assert/strict';
import test from 'node:test';

import { parseArgs, requireOption } from '../src/args.mjs';

test('parses options, booleans, and --no flags', () => {
  const parsed = parseArgs([
    'build',
    '--platform',
    'ios',
    '--no-hermes',
    '--runtime-version=1.0.0',
  ]);
  assert.deepEqual(parsed.positional, ['build']);
  assert.equal(parsed.options.platform, 'ios');
  assert.equal(parsed.options.hermes, false);
  assert.equal(parsed.options['runtime-version'], '1.0.0');
});

test('required options reject missing values', () => {
  assert.throws(() => requireOption({}, 'server'), /--server is required/);
});
