import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createPublicKey } from 'node:crypto';

import {
  generateSigningKeys,
} from 'react-native-hotfix-server/signing';

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export async function generateKeys({ outputDir, force = false, bits = 3072 }) {
  const root = path.resolve(outputDir);
  const privatePath = path.join(root, 'private.pem');
  const publicPath = path.join(root, 'public.pem');
  if (!force && ((await exists(privatePath)) || (await exists(publicPath)))) {
    throw new Error(`Refusing to overwrite keys in ${root}; pass --force to replace them`);
  }

  const keys = generateSigningKeys(bits);
  const publicDer = createPublicKey(keys.publicKey)
    .export({ type: 'spki', format: 'der' })
    .toString('base64');
  await mkdir(root, { recursive: true });
  await writeFile(privatePath, keys.privateKey, { encoding: 'utf8', mode: 0o600 });
  await writeFile(publicPath, keys.publicKey, 'utf8');
  await writeFile(path.join(root, 'key-id.txt'), `${keys.keyId}\n`, 'utf8');
  await writeFile(path.join(root, 'public-key-der-base64.txt'), `${publicDer}\n`, 'utf8');

  return {
    ...keys,
    privatePath,
    publicPath,
    publicDerBase64: publicDer,
  };
}
