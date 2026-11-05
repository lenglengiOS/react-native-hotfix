#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const keyPath = path.join(root, '.hotfix/keys/public-key-der-base64.txt');

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(keyPath))) {
  execFileSync(
    process.execPath,
    [
      'packages/hotfix-cli/bin/hotfix.mjs',
      'keys',
      'generate',
      '--out',
      '.hotfix/keys',
    ],
    { cwd: root, stdio: 'inherit' },
  );
}

const publicKey = (await readFile(keyPath, 'utf8')).trim();
if (!/^[A-Za-z0-9+/]+={0,2}$/.test(publicKey)) {
  throw new Error('Generated public key is not valid Base64');
}

const androidManifestPath = path.join(
  root,
  'android/app/src/main/AndroidManifest.xml',
);
const androidManifest = await readFile(androidManifestPath, 'utf8');
const androidPattern =
  /(android:name="com\.reactnativehotfix\.PUBLIC_KEY"\s+android:value=")[^"]+/;
if (!androidPattern.test(androidManifest)) {
  throw new Error('Android hotfix public key metadata was not found');
}
await writeFile(
  androidManifestPath,
  androidManifest.replace(androidPattern, `$1${publicKey}`),
);

const iosPlistPath = path.join(root, 'ios/AwesomeProject/Info.plist');
const iosPlist = await readFile(iosPlistPath, 'utf8');
const iosPattern =
  /(<key>HotfixPublicKey<\/key>\s*<string>)[^<]+(<\/string>)/;
if (!iosPattern.test(iosPlist)) {
  throw new Error('iOS HotfixPublicKey was not found');
}
await writeFile(
  iosPlistPath,
  iosPlist.replace(iosPattern, `$1${publicKey}$2`),
);

console.log('Updated Android and iOS native configuration with the demo public key.');
