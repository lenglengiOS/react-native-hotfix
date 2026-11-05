# react-native-hotfix

**English** | [简体中文](README.zh-CN.md)

Signed, self-hosted over-the-air updates for React Native 0.87 and the New
Architecture.

## Install

```sh
npm install react-native-hotfix@0.1.3
npm install -D react-native-hotfix-cli@0.1.3 react-native-hotfix-server@0.1.3
```

Before the SDK can load updates, complete these native steps:

1. Generate a key pair with `npx hotfix keys generate --out .hotfix/keys`.
2. Configure the public key, update URL, channel, and runtime version in
   `AndroidManifest.xml` and `Info.plist`.
3. Pass `HotfixBundle.getBundleFilePath(context)` to the Android React host.
4. Override `bundleURL()` in the iOS React Native factory delegate.
5. Wrap the React root with `HotfixProvider` and rebuild the native apps.

The complete [integration guide](https://github.com/lenglengiOS/react-native-hotfix/blob/main/docs/getting-started.md)
contains copy-paste native code, server setup, publishing, cold-start testing,
rollback verification, and troubleshooting.

## JavaScript API

```tsx
import { Hotfix, HotfixProvider, useHotfix } from 'react-native-hotfix';

function App() {
  return (
    <HotfixProvider>
      <Application />
    </HotfixProvider>
  );
}

const result = await Hotfix.checkForUpdate();
const state = await Hotfix.getState();
await Hotfix.clearDownloads();
```

`useHotfix()` exposes the current state, readiness, error, and a
`checkForUpdate()` action for React screens.

## What v0.1 guarantees

- RSA-SHA256 manifests are verified in native code before JSON is trusted.
- Every bundle and asset is checked against its SHA-256 digest and size.
- Only exact `runtimeVersion`, channel, and platform matches are installed.
- Downloads are staged in a separate directory and activated atomically.
- A new bundle is marked ready by `HotfixProvider`. Two failed cold starts
  automatically return the app to its previous bundle.
- Release files use immutable content paths and can be served from a CDN.

This is not a substitute for App Store or Google Play review. A code update
must still comply with the target store's rules and the local law.
