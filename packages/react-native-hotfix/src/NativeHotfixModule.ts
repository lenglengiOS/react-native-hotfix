import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  getState(): Promise<Object>;
  downloadAndInstall(): Promise<Object>;
  markReady(): Promise<Object>;
  clearDownloads(): Promise<Object>;
}

const NativeHotfixModule = TurboModuleRegistry.get<Spec>('NativeHotfixModule');

export default NativeHotfixModule;
