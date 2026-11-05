const PROTOCOL_VERSION = 1;
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const UPDATE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const RUNTIME_VERSION_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const CHANNEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const PLATFORMS = new Set(['ios', 'android']);

export const HOTFIX_PROTOCOL_VERSION = PROTOCOL_VERSION;

export function canonicalJson(value) {
  if (value === null || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Canonical JSON cannot contain non-finite numbers');
    }
    return JSON.stringify(value);
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }

  if (typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }

  throw new TypeError(`Unsupported canonical JSON value: ${typeof value}`);
}

export function assertSafeRelativePath(relativePath) {
  if (
    typeof relativePath !== 'string' ||
    relativePath.length === 0 ||
    relativePath.length > 512 ||
    relativePath.includes('\\') ||
    relativePath.startsWith('/') ||
    /[\u0000-\u001f]/.test(relativePath)
  ) {
    throw new TypeError(`Unsafe update file path: ${String(relativePath)}`);
  }

  const segments = relativePath.split('/');
  if (segments.some(segment => segment === '' || segment === '.' || segment === '..')) {
    throw new TypeError(`Unsafe update file path: ${relativePath}`);
  }

  return relativePath;
}

export function assertAssetDescriptor(asset, label = 'asset') {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
    throw new TypeError(`${label} must be an object`);
  }

  assertSafeRelativePath(asset.path);
  if (!HASH_PATTERN.test(asset.hash || '')) {
    throw new TypeError(`${label}.hash must use sha256:<64 lowercase hex>`);
  }
  if (!Number.isSafeInteger(asset.size) || asset.size < 0) {
    throw new TypeError(`${label}.size must be a non-negative integer`);
  }
  if (
    typeof asset.contentType !== 'string' ||
    asset.contentType.length === 0 ||
    asset.contentType.length > 160
  ) {
    throw new TypeError(`${label}.contentType must be a non-empty string`);
  }
}

export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new TypeError('Manifest must be an object');
  }
  if (manifest.protocolVersion !== PROTOCOL_VERSION) {
    throw new TypeError(`Unsupported protocolVersion: ${manifest.protocolVersion}`);
  }
  if (typeof manifest.id !== 'string' || !UPDATE_ID_PATTERN.test(manifest.id)) {
    throw new TypeError('Manifest id is invalid');
  }
  if (Number.isNaN(Date.parse(manifest.createdAt))) {
    throw new TypeError('Manifest createdAt must be an ISO-8601 timestamp');
  }
  if (
    typeof manifest.runtimeVersion !== 'string' ||
    !RUNTIME_VERSION_PATTERN.test(manifest.runtimeVersion)
  ) {
    throw new TypeError('Manifest runtimeVersion is invalid');
  }
  if (typeof manifest.channel !== 'string' || !CHANNEL_PATTERN.test(manifest.channel)) {
    throw new TypeError('Manifest channel is invalid');
  }
  if (!PLATFORMS.has(manifest.platform)) {
    throw new TypeError('Manifest platform must be ios or android');
  }

  assertAssetDescriptor(manifest.launchAsset, 'launchAsset');
  if (!Array.isArray(manifest.assets)) {
    throw new TypeError('Manifest assets must be an array');
  }

  const paths = new Set([manifest.launchAsset.path]);
  manifest.assets.forEach((asset, index) => {
    assertAssetDescriptor(asset, `assets[${index}]`);
    if (paths.has(asset.path)) {
      throw new TypeError(`Duplicate update file path: ${asset.path}`);
    }
    paths.add(asset.path);
  });

  if (
    manifest.metadata !== undefined &&
    (manifest.metadata === null ||
      typeof manifest.metadata !== 'object' ||
      Array.isArray(manifest.metadata))
  ) {
    throw new TypeError('Manifest metadata must be an object');
  }

  const maxFailedLaunches = manifest.rollback?.maxFailedLaunches;
  if (
    maxFailedLaunches !== undefined &&
    (!Number.isSafeInteger(maxFailedLaunches) ||
      maxFailedLaunches < 1 ||
      maxFailedLaunches > 10)
  ) {
    throw new TypeError('rollback.maxFailedLaunches must be an integer from 1 to 10');
  }

  return manifest;
}

export function createUpdateManifest({
  id,
  createdAt = new Date().toISOString(),
  runtimeVersion,
  channel,
  platform,
  launchAsset,
  assets,
  metadata = {},
  maxFailedLaunches = 2,
}) {
  const manifest = {
    protocolVersion: PROTOCOL_VERSION,
    id,
    createdAt,
    runtimeVersion,
    channel,
    platform,
    launchAsset,
    assets,
    metadata,
    rollback: {
      maxFailedLaunches,
    },
  };
  return validateManifest(manifest);
}

export function isCompatibleClient({
  manifest,
  runtimeVersion,
  channel,
  platform,
}) {
  return (
    manifest.runtimeVersion === runtimeVersion &&
    manifest.channel === channel &&
    manifest.platform === platform
  );
}

export function encodedAssetPath(relativePath) {
  return assertSafeRelativePath(relativePath)
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

export { PROTOCOL_VERSION };
