import NativeHotfixModule from './NativeHotfixModule';
import {
  HotfixError,
  type HotfixCheckResult,
  type HotfixState,
} from './types';

function nativeModule() {
  if (!NativeHotfixModule) {
    throw new HotfixError(
      'NATIVE_MODULE_MISSING',
      'NativeHotfixModule is unavailable. Rebuild the app after installing react-native-hotfix.',
    );
  }
  return NativeHotfixModule;
}

async function withNativeError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof HotfixError) {
      throw error;
    }
    throw new HotfixError(
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : String(error),
      error,
    );
  }
}

export const Hotfix = {
  version: '0.1.3',

  async getState(): Promise<HotfixState> {
    return withNativeError(async () => {
      return (await nativeModule().getState()) as unknown as HotfixState;
    });
  },

  async isEnabled(): Promise<boolean> {
    const state = await this.getState();
    return state.status !== 'no-update';
  },

  async checkForUpdate(): Promise<HotfixCheckResult> {
    return withNativeError(async () => {
      const result = (await nativeModule().downloadAndInstall()) as {
        status?: HotfixCheckResult['status'];
        update?: HotfixCheckResult['update'];
      };
      if (
        result.status !== 'no-update' &&
        result.status !== 'downloaded' &&
        result.status !== 'disabled'
      ) {
        throw new HotfixError(
          'INVALID_RESPONSE',
          'Native update check returned an invalid status.',
        );
      }
      return {
        status: result.status,
        update: result.update ?? null,
      };
    });
  },

  async markReady(): Promise<void> {
    await withNativeError(async () => {
      await nativeModule().markReady();
    });
  },

  async clearDownloads(): Promise<void> {
    await withNativeError(async () => {
      await nativeModule().clearDownloads();
    });
  },
};
