# React Native Hotfix

**English** | [简体中文](README.zh-CN.md)

Signed, self-hosted over-the-air updates for React Native 0.87 and the New Architecture. This README is the complete integration guide.

This guide integrates the published React Native Hotfix SDK into an existing
React Native 0.87 application, starts a local update server, publishes an
update, and verifies cold-start activation.

## What you will build

The final flow is:

```text
React Native app
  -> checks the update server
  -> downloads and verifies signed files
  -> installs the update atomically
  -> activates it on the next cold launch
  -> rolls back if the new bundle repeatedly fails to start
```

Only JavaScript and bundled application assets can be updated. Native code,
native dependencies, permissions, and React Native runtime changes require a
new store build.

## Requirements

- React Native `0.87.x`
- Node.js `22.11+`
- Android: JDK 17
- iOS: Xcode `16.1+`, iOS deployment target `15.1+`
- A publisher machine that can run the React Native build toolchain
- An HTTPS origin for production update files

Use the npm packages at the same version:

```text
react-native-hotfix@0.1.2
react-native-hotfix-cli@0.1.2
react-native-hotfix-server@0.1.2
react-native-hotfix-protocol@0.1.2
```

## Step 1: Install the SDK

Run the following commands in the React Native project root:

```sh
npm install react-native-hotfix@0.1.2
npm install -D react-native-hotfix-cli@0.1.2 react-native-hotfix-server@0.1.2
```

`react-native-hotfix` is the runtime client SDK. The CLI and server packages are
needed by developers and the update service, not by the mobile JavaScript
bundle.

For iOS, install the new Pod:

```sh
cd ios
bundle exec pod install
cd ..
```

For Android, autolinking discovers `HotfixPackage` during the native build.
You must rebuild the native application after installing the SDK.

## Step 2: Generate signing keys

Generate an RSA-3072 key pair:

```sh
npx hotfix keys generate --out .hotfix/keys
```

The command creates:

```text
.hotfix/keys/private.pem
.hotfix/keys/public.pem
.hotfix/keys/key-id.txt
.hotfix/keys/public-key-der-base64.txt
```

Copy the one-line Base64 value from `public-key-der-base64.txt` into the native
configuration below.

Never commit `private.pem`. Add these entries to `.gitignore`:

```gitignore
.hotfix/keys/
.hotfix/server/
.hotfix/dist/
```

The public key can be shipped in the app. The private key must exist only on
the publisher/server and should be stored in a secret manager or HSM in
production.

## Step 3: Choose a runtime version

Choose a value such as `1.0.0` and use exactly the same value in:

- the Android `RUNTIME_VERSION` metadata;
- the iOS `HotfixRuntimeVersion` key;
- the CLI `--runtime-version` argument.

`runtimeVersion` describes native compatibility. Increase it whenever native
code, React Native, Hermes, a native dependency, or startup behavior changes
incompatibly. Do not treat it as the JavaScript release version.

## Step 4: Configure Android

Edit `android/app/src/main/AndroidManifest.xml` and add the metadata inside the
`<application>` element:

```xml
<meta-data
  android:name="com.reactnativehotfix.MANIFEST_URL"
  android:value="http://10.0.2.2:3000/v1/check" />
<meta-data
  android:name="com.reactnativehotfix.PUBLIC_KEY"
  android:value="PASTE_PUBLIC_KEY_DER_BASE64_HERE" />
<meta-data
  android:name="com.reactnativehotfix.CHANNEL"
  android:value="production" />
<meta-data
  android:name="com.reactnativehotfix.RUNTIME_VERSION"
  android:value="1.0.0" />
<meta-data
  android:name="com.reactnativehotfix.ENABLE_IN_DEBUG"
  android:value="true" />
<meta-data
  android:name="com.reactnativehotfix.ALLOW_CLEARTEXT"
  android:value="true" />
```

`10.0.2.2` reaches the host machine from the standard Android emulator. For a
physical device, use a reachable HTTPS URL. Set `ENABLE_IN_DEBUG` and
`ALLOW_CLEARTEXT` to `false` for production.

If you test local HTTP in a custom Android manifest, also allow cleartext
traffic for that debug variant:

```xml
<application android:usesCleartextTraffic="true" ...>
```

Do not enable cleartext traffic in release builds.

Change `android/app/src/main/java/.../MainApplication.kt` so the React host uses
the verified downloaded bundle when one is active:

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

If your existing `PackageList` has custom packages, keep those custom entries.

## Step 5: Configure iOS

Add these keys to `ios/YourApp/Info.plist`:

```xml
<key>HotfixManifestURL</key>
<string>http://127.0.0.1:3000/v1/check</string>
<key>HotfixPublicKey</key>
<string>PASTE_PUBLIC_KEY_DER_BASE64_HERE</string>
<key>HotfixChannel</key>
<string>production</string>
<key>HotfixRuntimeVersion</key>
<string>1.0.0</string>
<key>HotfixEnableInDebug</key>
<true/>
<key>HotfixAllowCleartext</key>
<true/>
```

`127.0.0.1` works on the iOS Simulator. For a physical device, use a reachable
HTTPS URL. Set both debug/cleartext options to `false` for production.

Local HTTP testing also requires the normal React Native development ATS
configuration:

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsLocalNetworking</key>
  <true/>
</dict>
```

Modify the `RCTReactNativeFactoryDelegate` in `AppDelegate.swift`:

```swift
import Hotfix

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

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

This fallback guarantees that the embedded or Metro bundle is still used when
no verified update has been installed.

## Step 6: Wrap the React root

Mount `HotfixProvider` around the root application:

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

The provider calls `markReady()` after React starts. This confirms a successful
launch and resets the failed-launch counter. Without this confirmation, the
native SDK cannot distinguish a healthy update from a crash loop.

## Step 7: Start the update server locally

Keep the terminal open:

```sh
HOTFIX_PRIVATE_KEY=.hotfix/keys/private.pem \
HOTFIX_ADMIN_TOKEN=replace-with-a-long-random-token \
HOTFIX_STORAGE_DIR=.hotfix/server \
npx hotfix-server
```

The default listener is `0.0.0.0:3000`. Check it:

```sh
curl http://127.0.0.1:3000/health
```

Expected response:

```json
{"ok":true}
```

For production, set `HOTFIX_BASE_URL` to the public HTTPS origin:

```sh
HOTFIX_STORAGE_DIR=/var/lib/react-native-hotfix \
HOTFIX_PRIVATE_KEY=/run/secrets/hotfix-private.pem \
HOTFIX_ADMIN_TOKEN='<high-entropy-secret>' \
HOTFIX_BASE_URL=https://updates.example.com \
npx hotfix-server
```

Use the same origin in the app:

```text
https://updates.example.com/v1/check
```

The storage directory must be persistent. Put immutable `/v1/updates/*`
responses behind a CDN for production traffic.

## Step 8: Build the first update

Make a JavaScript-only change that is visible in the app. Then build both
platforms:

```sh
npx hotfix build \
  --platform all \
  --channel production \
  --runtime-version 1.0.0 \
  --output .hotfix/dist
```

Or build one platform:

```sh
npx hotfix build \
  --platform android \
  --channel production \
  --runtime-version 1.0.0 \
  --output .hotfix/dist
```

The output directories are:

```text
.hotfix/dist/ios-1.0.0/
.hotfix/dist/android-1.0.0/
```

Each directory contains the Hermes bundle, Metro assets, an unsigned
`manifest.json`, and source maps. Source maps are not uploaded.

The CLI uses the React Native 0.87 Metro bundle pipeline and compiles Hermes
bytecode by default. Use `--no-hermes` only when the app uses a compatible
non-Hermes JavaScript engine.

## Step 9: Publish the update

Publish each platform that you built:

```sh
HOTFIX_ADMIN_TOKEN=replace-with-a-long-random-token \
npx hotfix publish \
  --server http://127.0.0.1:3000 \
  --input .hotfix/dist/ios-1.0.0 \
  --rollout-percent 100
```

```sh
HOTFIX_ADMIN_TOKEN=replace-with-a-long-random-token \
npx hotfix publish \
  --server http://127.0.0.1:3000 \
  --input .hotfix/dist/android-1.0.0 \
  --rollout-percent 100
```

The server verifies file hashes, signs the canonical manifest with the private
key, stores an immutable release, and activates the matching
channel/runtime/platform.

For production, use an HTTPS server URL:

```sh
HOTFIX_ADMIN_TOKEN='<token>' \
npx hotfix publish \
  --server https://updates.example.com \
  --input .hotfix/dist/ios-1.0.0 \
  --rollout-percent 5
```

Start with a low rollout percentage. Use `npx hotfix activate` to increase the
rollout after validating the release.

## Step 10: Verify installation and cold-start activation

1. Build and install the native app that contains the SDK and native config.
2. Start the app once with the embedded bundle.
3. Call the update API or press **Check for update** in the included demo.
4. Confirm that `checkForUpdate()` returns `{ status: 'downloaded', ... }`.
5. Fully terminate the app process.
6. Start the app again without Metro or any special debugging launch.
7. Confirm that `getState().currentUpdate.id` is the published update ID.

Example UI action:

```tsx
import { useHotfix } from 'react-native-hotfix';

function UpdateButton() {
  const { checking, checkForUpdate } = useHotfix();

  return (
    <Button
      disabled={checking}
      title={checking ? 'Checking…' : 'Check for update'}
      onPress={() => {
        checkForUpdate().catch(console.error);
      }}
    />
  );
}
```

Example imperative check:

```ts
import { Hotfix } from 'react-native-hotfix';

const result = await Hotfix.checkForUpdate();
if (result.status === 'downloaded') {
  // The update is installed and will be used on the next cold launch.
}
```

### Recommended automatic check

After the provider has confirmed a successful launch, a production app can
check in the background:

```tsx
import { useEffect } from 'react';
import { useHotfix } from 'react-native-hotfix';

function useAutomaticUpdateCheck() {
  const { ready, checkForUpdate } = useHotfix();

  useEffect(() => {
    if (!ready) {
      return;
    }
    checkForUpdate().catch(error => {
      // Keep startup independent from update-server availability.
      console.warn('Hotfix check failed', error);
    });
  }, [ready, checkForUpdate]);
}
```

Call `useAutomaticUpdateCheck()` below `HotfixProvider`. Network failures and
server outages do not prevent the embedded or current bundle from starting.

In debug builds with Metro, Metro may continue to be the source of truth.
Use the documented debug flags only for integration testing, and validate
activation with a release-like build.

If the app already has the active update, the server returns `204 No Content`
and `checkForUpdate()` returns `no-update`.

## Step 11: Verify rollback

1. Publish an update that crashes before `HotfixProvider` mounts.
2. Cold-start it repeatedly.
3. After the configured failure threshold, the native launcher returns to the
   previous known-good update or the embedded bundle.
4. Inspect the state with `Hotfix.getState()`.

The default threshold is two failed launches. It can be changed in the
manifest's `rollback.maxFailedLaunches` by the publisher workflow.

## Step 12: Production operations

Before production:

- Use HTTPS only.
- Keep the private signing key in KMS, an HSM, or a secret manager.
- Put bundle files on immutable object storage behind a CDN.
- Persist server metadata and back it up.
- Set a strong admin token and rotate it independently of signing keys.
- Add authentication/rate limiting at the edge.
- Monitor signature failures, hash failures, rollback counts, and publish errors.
- Review App Store and Google Play requirements for dynamic code updates.

The included Node server is a single-node reference deployment. For multiple
instances, replace its local channel pointers with a transactional database
and shared object storage.

For Docker, systemd, private TLS, admin isolation, backup, and restore
instructions, see [Private server deployment](docs/server-deployment.md).

## JavaScript API

### `Hotfix.checkForUpdate()`

Checks the configured endpoint, downloads and verifies a compatible update,
then installs it for the next cold launch.

```ts
const result = await Hotfix.checkForUpdate();
```

Returned statuses:

- `downloaded`
- `no-update`
- `disabled`

### `Hotfix.getState()`

Returns the running update, downloaded update, launch status, failure count,
and rollback count.

```ts
const state = await Hotfix.getState();
```

### `Hotfix.markReady()`

Confirms that JavaScript launched successfully. `HotfixProvider` normally
calls this automatically.

### `Hotfix.clearDownloads()`

Removes old downloaded update directories while preserving the running update.

## Troubleshooting

**`NATIVE_MODULE_MISSING`**

Rebuild the native application after installing the package. On iOS run
`bundle exec pod install`; on Android rebuild with Gradle.

**Update check returns `disabled`**

The app is a debuggable build and `ENABLE_IN_DEBUG` or `HotfixEnableInDebug` is
false. Enable it only for integration testing.

**Update check returns `no-update`**

Verify that channel, platform, runtime version, server URL, and query headers
match the published release. Check `GET /health` and the server logs.

**Signature verification fails**

The app public key and server private key do not belong to the same pair, or
the app was not rebuilt after changing the public key.

**Cleartext HTTP is rejected**

Use HTTPS. For local development, enable the debug/cleartext flags and use a
local emulator URL.

**Update downloads but never activates**

The update is activated on a cold process start. Fully terminate the app; do
not rely on Fast Refresh or a Metro reload.

**Assets return 404**

Build all assets with the same `--platform` and publish the entire output
directory. Do not upload only the launch bundle.

## Packages

- `react-native-hotfix`: React Native client SDK and New Architecture TurboModule
- `react-native-hotfix-server`: signed-manifest and immutable-asset server
- `react-native-hotfix-cli`: Hermes build and publishing commands
- `react-native-hotfix-protocol`: manifest schema and shared validation

## More documentation

- [Architecture](docs/architecture.md)
- [Security model](docs/security.md)
- [Private server deployment](docs/server-deployment.md)
- [Release workflow](docs/releasing.md)
- [中文接入手册](docs/zh-CN/getting-started.md)

## Repository development

```sh
npm install
npm test
npm run test:hotfix
npm run lint
npx tsc --noEmit
npm run release:check
```

## License

[MIT](LICENSE)
