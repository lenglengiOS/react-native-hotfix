# 接入指南

[English](../getting-started.md) | **简体中文**

## 环境要求

- React Native `0.87.x`
- Node.js `22.11+`
- Android 使用 JDK 17
- Xcode `16.1+`，iOS `15.1+`

## 1. 安装包

本仓库使用 npm workspace。业务 App 后续可以直接安装 npm 包：

```sh
npm install react-native-hotfix
npm install -D react-native-hotfix-cli react-native-hotfix-server
```

## 2. 生成签名密钥

```sh
npx hotfix keys generate --out .hotfix/keys
```

只提交 `public.pem` 或 `public-key-der-base64.txt`。忽略
`.hotfix/keys/private.pem`，并将私钥保存在服务端的 Secret Manager 中。

## 3. 配置 App

客户端和发布更新时必须使用相同的 channel 与 runtime version。
`runtimeVersion` 表示原生兼容性约束，不是 JS 更新版本号。只要原生代码、
RN 与 Hermes 版本、Hermes 字节码格式或原生依赖发生不兼容变化，就必须更新
`runtimeVersion`。

### Android

在 `android/app/src/main/AndroidManifest.xml` 的 `<application>` 中添加：

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

修改 `MainApplication.kt`：

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

自动链接会注册 `HotfixPackage`。安装 SDK 后必须重新构建原生 App。

### iOS

在 `Info.plist` 中添加：

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

执行 `bundle exec pod install`，然后修改 factory delegate：

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

## 4. 包裹 React 根节点

`HotfixProvider` 必须在 React runtime 成功启动后挂载：

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

Provider 挂载后，原生层将当前 bundle 标记为 ready，并重置启动失败计数。

## 5. 检查更新

```tsx
import { useHotfix } from 'react-native-hotfix';

function UpdateButton() {
  const { checking, checkForUpdate } = useHotfix();

  async function onPress() {
    const result = await checkForUpdate();
    if (result.status === 'downloaded') {
      // 可提示用户在下次方便时关闭并重新打开 App。
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

也可以使用命令式 API：

```ts
const result = await Hotfix.checkForUpdate();
const state = await Hotfix.getState();
await Hotfix.clearDownloads();
```

## Debug 行为

可调试构建默认关闭 OTA 更新，以 Metro 为准。
`ENABLE_IN_DEBUG`/`HotfixEnableInDebug` 只用于集成测试。HTTP 明文请求必须
显式开启，并且只允许本地开发主机。
