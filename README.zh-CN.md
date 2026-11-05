# React Native Hotfix

[English](README.md) | **简体中文**

面向 React Native 0.87 和新架构的签名式自托管热更新 SDK。本 README 就是完整接入指南。

本文说明如何把已发布的 React Native Hotfix SDK 集成到现有的 React Native
0.87 项目，启动本地更新服务端，发布更新并验证冷启动生效。

## 最终效果

完整流程如下：

```text
React Native App
  -> 请求更新服务端
  -> 下载并验证签名文件
  -> 原子安装更新
  -> 下次冷启动时激活
  -> 新 bundle 持续启动失败时自动回滚
```

热更新只能更新 JavaScript 和应用资源。原生代码、原生依赖、权限以及 React
Native runtime 变化仍然必须通过应用商店发布新的原生版本。

## 环境要求

- React Native `0.87.x`
- Node.js `22.11+`
- Android：JDK 17
- iOS：Xcode `16.1+`，最低部署版本 `15.1+`
- 可运行 React Native 构建工具的发布机器
- 生产环境使用 HTTPS 文件源

请使用相同版本的 npm 包：

```text
react-native-hotfix@0.1.2
react-native-hotfix-cli@0.1.2
react-native-hotfix-server@0.1.2
react-native-hotfix-protocol@0.1.2
```

## 第 1 步：安装 SDK

在 React Native 项目根目录执行：

```sh
npm install react-native-hotfix@0.1.2
npm install -D react-native-hotfix-cli@0.1.2 react-native-hotfix-server@0.1.2
```

`react-native-hotfix` 是 App 运行时客户端 SDK。CLI 和服务端包供开发者与更新
服务使用，不会被放入移动端 JavaScript bundle。

iOS 需要安装新的 Pod：

```sh
cd ios
bundle exec pod install
cd ..
```

Android 会在原生构建阶段通过 autolinking 找到 `HotfixPackage`。安装 SDK 后
必须重新构建原生 App。

## 第 2 步：生成签名密钥

生成 RSA-3072 密钥对：

```sh
npx hotfix keys generate --out .hotfix/keys
```

命令会生成：

```text
.hotfix/keys/private.pem
.hotfix/keys/public.pem
.hotfix/keys/key-id.txt
.hotfix/keys/public-key-der-base64.txt
```

复制 `public-key-der-base64.txt` 中的单行 Base64 内容到下面的原生配置。

绝不能提交 `private.pem`，请在 `.gitignore` 中加入：

```gitignore
.hotfix/keys/
.hotfix/server/
.hotfix/dist/
```

公钥可以打包进 App。私钥只能放在发布端或服务端；生产环境应使用 Secret
Manager、KMS 或 HSM 保存。

## 第 3 步：确定 runtime version

例如使用 `1.0.0`，并在以下三个位置保持完全一致：

- Android 的 `RUNTIME_VERSION` metadata；
- iOS 的 `HotfixRuntimeVersion`；
- CLI 的 `--runtime-version`。

`runtimeVersion` 表示原生兼容关系，不是 JavaScript 版本号。原生代码、
React Native、Hermes、原生依赖或启动行为发生不兼容变化时，必须更新该值。

## 第 4 步：配置 Android

编辑 `android/app/src/main/AndroidManifest.xml`，在 `<application>` 内添加：

```xml
<meta-data
  android:name="com.reactnativehotfix.MANIFEST_URL"
  android:value="http://10.0.2.2:3000/v1/check" />
<meta-data
  android:name="com.reactnativehotfix.PUBLIC_KEY"
  android:value="粘贴_PUBLIC_KEY_DER_BASE64" />
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

标准 Android 模拟器通过 `10.0.2.2` 访问宿主机。真机必须使用可访问的 HTTPS
地址。生产环境将 `ENABLE_IN_DEBUG` 和 `ALLOW_CLEARTEXT` 都设为 `false`。

如果自定义 Android Manifest 并测试本地 HTTP，还需要在 Debug variant 中允许
明文流量：

```xml
<application android:usesCleartextTraffic="true" ...>
```

不要在 Release 构建中开启明文流量。

修改 `android/app/src/main/java/.../MainApplication.kt`，让 React Host 选择
已验证的下载 bundle：

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

如果项目中已有自定义 React Package，请保留原来的 PackageList 配置。

## 第 5 步：配置 iOS

在 `ios/YourApp/Info.plist` 中添加：

```xml
<key>HotfixManifestURL</key>
<string>http://127.0.0.1:3000/v1/check</string>
<key>HotfixPublicKey</key>
<string>粘贴_PUBLIC_KEY_DER_BASE64</string>
<key>HotfixChannel</key>
<string>production</string>
<key>HotfixRuntimeVersion</key>
<string>1.0.0</string>
<key>HotfixEnableInDebug</key>
<true/>
<key>HotfixAllowCleartext</key>
<true/>
```

`127.0.0.1` 适用于 iOS 模拟器。真机必须使用可访问的 HTTPS 地址。生产环境
将 debug 和 cleartext 配置都设为 `false`。

本地 HTTP 测试还需要标准 React Native 开发环境中的 ATS 配置：

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsLocalNetworking</key>
  <true/>
</dict>
```

修改 `AppDelegate.swift` 中的 `RCTReactNativeFactoryDelegate`：

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

这个 fallback 保证没有可用的验证更新时，App 仍会加载内置 bundle 或 Metro
bundle。

## 第 6 步：包裹 React 根节点

在最外层 App 周围挂载 `HotfixProvider`：

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

React 启动后 Provider 会调用 `markReady()`，确认启动成功并清除失败启动计数。
如果没有这个确认，原生层无法区分正常更新和 crash loop。

## 第 7 步：启动本地更新服务端

保持终端运行：

```sh
HOTFIX_PRIVATE_KEY=.hotfix/keys/private.pem \
HOTFIX_ADMIN_TOKEN=replace-with-a-long-random-token \
HOTFIX_STORAGE_DIR=.hotfix/server \
npx hotfix-server
```

默认监听 `0.0.0.0:3000`。检查服务：

```sh
curl http://127.0.0.1:3000/health
```

预期结果：

```json
{"ok":true}
```

生产环境使用公网 HTTPS 地址：

```sh
HOTFIX_STORAGE_DIR=/var/lib/react-native-hotfix \
HOTFIX_PRIVATE_KEY=/run/secrets/hotfix-private.pem \
HOTFIX_ADMIN_TOKEN='<高强度随机值>' \
HOTFIX_BASE_URL=https://updates.example.com \
npx hotfix-server
```

App 中的地址改为：

```text
https://updates.example.com/v1/check
```

存储目录必须持久化。生产部署应将不可变的 `/v1/updates/*` 响应放到 CDN。

## 第 8 步：构建第一个更新

先修改一个可以在 App 中看到效果的 JavaScript 文件，然后构建两个平台：

```sh
npx hotfix build \
  --platform all \
  --channel production \
  --runtime-version 1.0.0 \
  --output .hotfix/dist
```

也可以只构建一个平台：

```sh
npx hotfix build \
  --platform android \
  --channel production \
  --runtime-version 1.0.0 \
  --output .hotfix/dist
```

输出目录：

```text
.hotfix/dist/ios-1.0.0/
.hotfix/dist/android-1.0.0/
```

每个目录包含 Hermes bundle、Metro 资源、未签名 `manifest.json` 和 Source
Map。Source Map 不会上传。

CLI 使用 React Native 0.87 Metro 构建流程并默认编译 Hermes 字节码。只有
App 使用兼容的非 Hermes JavaScript 引擎时才使用 `--no-hermes`。

## 第 9 步：发布更新

对每个已构建平台分别执行发布：

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

服务端会校验文件哈希，使用私钥签名规范化清单，保存不可变版本，并激活对应
channel/runtime/platform。

生产环境使用 HTTPS：

```sh
HOTFIX_ADMIN_TOKEN='<token>' \
npx hotfix publish \
  --server https://updates.example.com \
  --input .hotfix/dist/ios-1.0.0 \
  --rollout-percent 5
```

首次发布建议使用低比例灰度，验证后通过 `npx hotfix activate` 提高比例。

## 第 10 步：验证安装与冷启动生效

1. 构建并安装包含 SDK 和原生配置的 App。
2. 第一次使用内置 bundle 启动。
3. 调用更新 API，或在示例中点击 **Check for update**。
4. 确认 `checkForUpdate()` 返回 `{ status: 'downloaded', ... }`。
5. 完全终止 App 进程。
6. 不连接 Metro，也不使用调试热重载，重新启动 App。
7. 确认 `getState().currentUpdate.id` 等于刚发布的更新 ID。

UI 调用示例：

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

命令式调用示例：

```ts
import { Hotfix } from 'react-native-hotfix';

const result = await Hotfix.checkForUpdate();
if (result.status === 'downloaded') {
  // 更新已安装，将在下次冷启动时使用。
}
```

### 推荐的自动检查方式

Provider 确认启动成功后，生产 App 可以在后台自动检查：

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
      // 更新服务不可用时不能影响 App 启动。
      console.warn('Hotfix check failed', error);
    });
  }, [ready, checkForUpdate]);
}
```

在 `HotfixProvider` 下方调用 `useAutomaticUpdateCheck()`。更新服务网络失败
不会阻止内置 bundle 或当前版本启动。

Debug 构建连接 Metro 时，Metro 仍可能作为 JS 来源。Debug 开关只用于集成测试，
正式验证应使用接近 Release 的构建。

如果 App 已经使用当前更新，服务端会返回 `204 No Content`，
`checkForUpdate()` 返回 `no-update`。

## 第 11 步：验证回滚

1. 发布一个在 `HotfixProvider` 挂载前就崩溃的更新。
2. 多次冷启动该版本。
3. 达到失败阈值后，原生启动器会回退到上一个稳定版本或内置 bundle。
4. 使用 `Hotfix.getState()` 检查状态。

默认阈值为两次启动失败。发布系统可调整清单中的
`rollback.maxFailedLaunches`。

## 第 12 步：生产部署

上线前至少需要：

- 只使用 HTTPS。
- 将签名私钥放入 KMS、HSM 或 Secret Manager。
- 将 bundle 放在不可变对象存储和 CDN 后面。
- 持久化并备份服务端元数据。
- 使用高强度管理 Token，并与签名密钥分开轮换。
- 在边缘层增加鉴权和限流。
- 监控签名失败、哈希失败、回滚次数和发布错误。
- 审查 App Store 和 Google Play 对动态代码更新的要求。

当前 Node 服务端是单节点参考实现。多实例部署需要将本地 channel 指针替换为
事务性数据库，并使用共享对象存储。

## JavaScript API

### `Hotfix.checkForUpdate()`

检查配置的服务端，下载并验证兼容更新，安装后等待下次冷启动。

```ts
const result = await Hotfix.checkForUpdate();
```

状态：

- `downloaded`
- `no-update`
- `disabled`

### `Hotfix.getState()`

返回当前运行版本、已下载版本、启动状态、失败次数和回滚次数。

```ts
const state = await Hotfix.getState();
```

### `Hotfix.markReady()`

确认 JavaScript 已成功启动。通常由 `HotfixProvider` 自动调用。

### `Hotfix.clearDownloads()`

清理旧下载目录，同时保留正在运行的更新。

## 常见问题

**`NATIVE_MODULE_MISSING`**

安装包后需要重新构建原生 App。iOS 执行 `bundle exec pod install`，Android
重新运行 Gradle 构建。

**检查更新返回 `disabled`**

当前是可调试构建，并且 `ENABLE_IN_DEBUG` 或 `HotfixEnableInDebug` 为 false。
只在集成测试时开启。

**检查更新返回 `no-update`**

检查 channel、platform、runtime version、服务端 URL 与发布版本是否一致，
同时确认 `/health` 和服务端日志。

**签名验证失败**

App 公钥与服务器私钥不是同一对，或者修改公钥后没有重新构建 App。

**HTTP 明文被拒绝**

使用 HTTPS。本地开发时开启 debug/cleartext 开关，并使用模拟器可访问地址。

**下载后没有生效**

更新只在进程完全冷启动后生效。彻底关闭 App，不要依赖 Fast Refresh 或
Metro reload。

**资源返回 404**

使用相同的 `--platform` 构建所有资源，并发布完整输出目录；不能只上传启动
bundle。

## npm 包

- `react-native-hotfix`：React Native 客户端 SDK 与新架构 TurboModule
- `react-native-hotfix-server`：清单签名与不可变资源服务端
- `react-native-hotfix-cli`：Hermes 构建和发布命令
- `react-native-hotfix-protocol`：清单 Schema 与共享校验

## 更多文档

- [架构说明](docs/zh-CN/architecture.md)
- [安全模型](docs/zh-CN/security.md)
- [发布流程](docs/zh-CN/releasing.md)
- [English integration guide](docs/getting-started.md)

## 仓库开发

```sh
npm install
npm test
npm run test:hotfix
npm run lint
npx tsc --noEmit
npm run release:check
```

## 许可证

[MIT](LICENSE)
