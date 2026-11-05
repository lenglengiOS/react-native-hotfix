export const HOTFIX_PROTOCOL_VERSION: 1;
export const PROTOCOL_VERSION: 1;

export type HotfixPlatform = 'ios' | 'android';

export interface HotfixAssetDescriptor {
  path: string;
  hash: `sha256:${string}`;
  size: number;
  contentType: string;
}

export interface HotfixManifest {
  protocolVersion: 1;
  id: string;
  createdAt: string;
  runtimeVersion: string;
  channel: string;
  platform: HotfixPlatform;
  launchAsset: HotfixAssetDescriptor;
  assets: HotfixAssetDescriptor[];
  metadata: Record<string, unknown>;
  rollback: {
    maxFailedLaunches: number;
  };
}

export function canonicalJson(value: unknown): string;
export function assertSafeRelativePath(relativePath: string): string;
export function assertAssetDescriptor(
  asset: HotfixAssetDescriptor,
  label?: string,
): void;
export function validateManifest(manifest: HotfixManifest): HotfixManifest;
export function createUpdateManifest(input: {
  id: string;
  createdAt?: string;
  runtimeVersion: string;
  channel: string;
  platform: HotfixPlatform;
  launchAsset: HotfixAssetDescriptor;
  assets: HotfixAssetDescriptor[];
  metadata?: Record<string, unknown>;
  maxFailedLaunches?: number;
}): HotfixManifest;
export function isCompatibleClient(input: {
  manifest: HotfixManifest;
  runtimeVersion: string;
  channel: string;
  platform: HotfixPlatform;
}): boolean;
export function encodedAssetPath(relativePath: string): string;
