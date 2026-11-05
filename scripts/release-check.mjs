#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const packageDirectories = [
  'packages/hotfix-protocol',
  'packages/hotfix-server',
  'packages/hotfix-cli',
  'packages/react-native-hotfix',
];
const forbiddenPathFragments = [
  '/android/build/',
  '/ios/build/',
  '/.hotfix/',
  '/node_modules/',
  'private.pem',
  '.env',
];
const ignoredDocumentationDirectories = new Set([
  '.git',
  '.hotfix',
  'node_modules',
  'Pods',
  'build',
  'vendor',
  'zh-CN',
]);

async function assertBilingualDocumentation(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDocumentationDirectories.has(entry.name)) {
        await assertBilingualDocumentation(path.join(directory, entry.name));
      }
      continue;
    }
    if (!entry.name.endsWith('.md') || entry.name.endsWith('.zh-CN.md')) {
      continue;
    }
    const englishPath = path.join(directory, entry.name);
    const chinesePaths = [
      path.join(directory, entry.name.replace(/\.md$/, '.zh-CN.md')),
      path.join(directory, 'zh-CN', entry.name),
    ];
    let found = false;
    for (const chinesePath of chinesePaths) {
      try {
        await readFile(chinesePath);
        found = true;
        break;
      } catch {
        // Try the next supported bilingual layout.
      }
    }
    if (!found) {
      throw new Error(`Missing Chinese documentation for ${path.relative(root, englishPath)}`);
    }
  }
}

await assertBilingualDocumentation(root);

let expectedVersion;
const packages = [];
for (const directory of packageDirectories) {
  const packagePath = path.join(root, directory, 'package.json');
  const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
  expectedVersion ??= manifest.version;
  if (manifest.version !== expectedVersion) {
    throw new Error(
      `Package versions must match: ${manifest.name}@${manifest.version} != ${expectedVersion}`,
    );
  }
  if (!manifest.publishConfig || manifest.publishConfig.registry !== 'https://registry.npmjs.org/') {
    throw new Error(`${manifest.name} must publish to the npm public registry`);
  }
  for (const requiredFile of ['README.md', 'README.zh-CN.md', 'LICENSE']) {
    await readFile(path.join(root, directory, requiredFile));
  }
  packages.push({ directory, manifest });
}

const cache = path.join(os.tmpdir(), 'react-native-hotfix-npm-cache');
for (const { manifest } of packages) {
  const output = execFileSync(
    'npm',
    [
      'pack',
      '--dry-run',
      '--json',
      '--ignore-scripts',
      '--workspace',
      manifest.name,
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, npm_config_cache: cache },
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );
  const [{ files, entryCount, name, version }] = JSON.parse(output);
  const forbidden = files
    .map(file => `/${file.path}`)
    .filter(file => forbiddenPathFragments.some(fragment => file.includes(fragment)));
  if (forbidden.length > 0) {
    throw new Error(`${name} contains forbidden files:\n${forbidden.join('\n')}`);
  }
  console.log(
    `${name}@${version}: ${entryCount} files, ${files.length === entryCount ? 'clean' : 'check output'}`,
  );
}

console.log(`Release candidate ${expectedVersion} passed package checks.`);
