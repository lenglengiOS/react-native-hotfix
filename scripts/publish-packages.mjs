#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const expectedVersion = JSON.parse(
  await readFile(path.join(root, 'packages/hotfix-protocol/package.json'), 'utf8'),
).version;
const packageOrder = [
  'react-native-hotfix-protocol',
  'react-native-hotfix-server',
  'react-native-hotfix-cli',
  'react-native-hotfix',
];

const gitStatus = execFileSync('git', ['status', '--porcelain'], {
  cwd: root,
  encoding: 'utf8',
});
if (gitStatus.trim()) {
  throw new Error('Commit or stash all changes before publishing.');
}

const tag = execFileSync('git', ['describe', '--tags', '--exact-match', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
});
const expectedTag = `v${expectedVersion}`;
if (tag.trim() !== expectedTag) {
  throw new Error(`HEAD must be tagged ${expectedTag}, found ${tag.trim() || 'no tag'}.`);
}

const status = spawnSync(
  'npm',
  ['whoami', '--registry', 'https://registry.npmjs.org/'],
  {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  },
);
if (status.status !== 0) {
  throw new Error('npm authentication is required. Run `npm login` first.');
}

execFileSync(process.execPath, ['scripts/release-check.mjs'], {
  cwd: root,
  stdio: 'inherit',
});

for (const name of packageOrder) {
  console.log(`\nPublishing ${name}...`);
  const publishArguments = [
    'publish',
    '--workspace',
    name,
    '--access',
    'public',
    '--registry',
    'https://registry.npmjs.org/',
  ];
  if (process.env.GITHUB_ACTIONS === 'true') {
    publishArguments.push('--provenance');
  }
  execFileSync(
    'npm',
    publishArguments,
    {
      cwd: root,
      stdio: 'inherit',
    },
  );
}

console.log('\nAll packages were published to npm.');
