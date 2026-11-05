import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertSafeRelativePath,
  canonicalJson,
  createUpdateManifest,
  encodedAssetPath,
  validateManifest,
} from '../src/index.mjs';

const sha256 = `sha256:${'a'.repeat(64)}`;

function validManifest() {
  return createUpdateManifest({
    id: 'update-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    runtimeVersion: '1.0.0',
    channel: 'production',
    platform: 'ios',
    launchAsset: {
      path: 'main.jsbundle',
      hash: sha256,
      size: 42,
      contentType: 'application/octet-stream',
    },
    assets: [],
  });
}

test('canonicalJson sorts object keys recursively', () => {
  assert.equal(
    canonicalJson({ z: 1, a: { y: true, b: null }, list: [2, 1] }),
    '{"a":{"b":null,"y":true},"list":[2,1],"z":1}',
  );
});

test('manifest validation accepts a valid manifest', () => {
  assert.equal(validateManifest(validManifest()).id, 'update-1');
});

test('manifest validation rejects duplicate files', () => {
  const manifest = validManifest();
  manifest.assets.push({ ...manifest.launchAsset });
  assert.throws(() => validateManifest(manifest), /Duplicate/);
});

test('unsafe paths are rejected', () => {
  for (const value of ['../secret', '/absolute', 'a//b', 'a\\b', 'a/./b']) {
    assert.throws(() => assertSafeRelativePath(value), /Unsafe/);
  }
});

test('asset paths are encoded segment by segment', () => {
  assert.equal(encodedAssetPath('assets/My image.png'), 'assets/My%20image.png');
});
