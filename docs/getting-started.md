# Getting started

**English** | [简体中文](zh-CN/getting-started.md)

## Requirements

- React Native `0.87.x`
- Node.js `22.11+`
- JDK 17 for Android
- Xcode `16.1+` and iOS `15.1+`

## 1. Install packages

This repository uses npm workspaces. A consuming app can later install the
published packages:

```sh
npm install react-native-hotfix
npm install -D react-native-hotfix-cli react-native-hotfix-server
```

## 2. Generate signing keys

```sh
npx hotfix keys generate --out .hotfix/keys
```

Commit only `public.pem` or `public-key-der-base64.txt`. Ignore
`.hotfix/keys/private.pem` and keep it in a secret manager on the server.

## 3. Configure the app

Use the same channel and runtime version on the client and when publishing.
`runtimeVersion` is a compatibility contract, not the JS update version. Change
it whenever native code, the RN version, Hermes format, or a native dependency
changes incompatibly.

### Android

Add metadata under `<application>` in `android/app/src/main/AndroidManifest.xml`:

```xml
<meta-data
  android:name="com.reactnativehotfix.MANIFEST_URL"
  android:value="https://updates.example.com/v1/check" />
<meta-data
  android:name="com.reactnativehotfix.PUBLIC_KEY"
  android:value="BASE64_SPKI_PUBLIC_KEY" />
<meta-data
  android:name="com.reactnativehotfix.CHANNEL"
  android:value="production" />
<meta-data
  android:name="com.reactnativehotfix.RUNTIME_VERSION"
  android:value="1.0.0" />
<meta-data
  android:name="com.reactnativehotfix.ENABLE_IN_DEBUG"
  android:value="false" />
<meta-data
  android:name="com.reactnativehotfix.ALLOW_CLEARTEXT"
  android:value="false" />
```

Change `MainApplication.kt`:

```kotlin
import com.reactnativehotfix.HotfixBundle

override val reactHost: ReactHost by lazy {
  getDefaultReactHost(
    context = applicationContext,
    jsBundleFilePath = HotfixBundle.getBundleFilePath(applicationContext),
    packageList = PackageList(this).packages,
  )
}
```

Autolinking registers `HotfixPackage`. Rebuild the native app after adding the
library.

### iOS

Add these keys to `Info.plist`:

```xml
<key>HotfixManifestURL</key>
<string>https://updates.example.com/v1/check</string>
<key>HotfixPublicKey</key>
<string>BASE64_SPKI_PUBLIC_KEY</string>
<key>HotfixChannel</key>
<string>production</string>
<key>HotfixRuntimeVersion</key>
<string>1.0.0</string>
<key>HotfixEnableInDebug</key>
<false/>
<key>HotfixAllowCleartext</key>
<false/>
```

Run `bundle exec pod install`, then change the factory delegate:

```swift
import Hotfix

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func bundleURL() -> URL? {
#if DEBUG
    let fallback =
      RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    let fallback = Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
    return HotfixBundle.currentBundleURL(withFallbackURL: fallback)
  }
}
```

## 4. Wrap the React root

`HotfixProvider` must mount after the React runtime has successfully started:

```tsx
import { HotfixProvider } from 'react-native-hotfix';

export default function App() {
  return (
    <HotfixProvider>
      <YourApplication />
    </HotfixProvider>
  );
}
```

On provider mount, the native layer marks the launched bundle ready and resets
its failed-launch counter.

## 5. Check for updates

```tsx
import { useHotfix } from 'react-native-hotfix';

function UpdateButton() {
  const { checking, checkForUpdate } = useHotfix();

  async function onPress() {
    const result = await checkForUpdate();
    if (result.status === 'downloaded') {
      // Prompt the user to close/reopen the app on the next convenient launch.
      console.log('Ready on next launch', result.update);
    }
  }

  return (
    <Button
      disabled={checking}
      title={checking ? 'Checking' : 'Check for update'}
      onPress={onPress}
    />
  );
}
```

The imperative API is also available:

```ts
const result = await Hotfix.checkForUpdate();
const state = await Hotfix.getState();
await Hotfix.clearDownloads();
```

## Debug behavior

OTA updates are disabled by default in debuggable builds so Metro remains the
source of truth. `ENABLE_IN_DEBUG`/`HotfixEnableInDebug` exists for integration
testing. Cleartext HTTP requires an explicit opt-in and a local host.
