export type HotfixLaunchType = 'embedded' | 'update';

export type HotfixStatus = 'ready' | 'pending' | 'fallback' | 'no-update';

export interface HotfixUpdateInfo {
  readonly id: string;
  readonly createdAt: string;
  readonly runtimeVersion: string;
  readonly channel: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface HotfixState {
  readonly currentUpdate: HotfixUpdateInfo | null;
  readonly downloadedUpdate: HotfixUpdateInfo | null;
  readonly launchType: HotfixLaunchType;
  readonly status: HotfixStatus;
  readonly failedLaunches: number;
  readonly rollbackCount: number;
  readonly lastError: string | null;
}

export interface HotfixCheckResult {
  readonly status: 'no-update' | 'downloaded' | 'disabled';
  readonly update: HotfixUpdateInfo | null;
}

export interface HotfixHookResult {
  readonly ready: boolean;
  readonly state: HotfixState | null;
  readonly error: Error | null;
  readonly checking: boolean;
  readonly checkForUpdate: () => Promise<HotfixCheckResult>;
  readonly refresh: () => Promise<HotfixState>;
}

export type HotfixErrorCode =
  | 'NATIVE_MODULE_MISSING'
  | 'NOT_CONFIGURED'
  | 'INVALID_RESPONSE'
  | 'INVALID_SIGNATURE'
  | 'INCOMPATIBLE_UPDATE'
  | 'DOWNLOAD_FAILED'
  | 'INSTALL_FAILED'
  | 'INTERNAL_ERROR';

export class HotfixError extends Error {
  readonly code: HotfixErrorCode;

  constructor(code: HotfixErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'HotfixError';
    this.code = code;
  }
}
