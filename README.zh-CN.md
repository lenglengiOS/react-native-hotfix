# React Native Hotfix

[English](README.md) | **简体中文**

面向 React Native 0.87 和新架构的自托管、签名式热更新系统。

本仓库既包含可直接运行的示例 App，也包含 npm workspace 形式的客户端 SDK、
构建/发布 CLI、协议包和更新服务端。整体设计参考 Expo Updates 的核心思路：
签名清单、明确的运行时兼容约束、按更新目录隔离资源、启动时选择 bundle，
以及启动失败自动回滚。本项目不依赖 Expo 或 Expo Updates。

> 状态：`0.1.1` 参考实现。协议和原生 API 已可使用，但在关键生产环境上线前，
> 仍需要扩大设备/CI 测试矩阵并完成独立的生产安全审查。

## 包结构

| 包 | 用途 |
| --- | --- |
| [`react-native-hotfix`](packages/react-native-hotfix) | React Native 客户端 SDK 与新架构 TurboModule |
| [`react-native-hotfix-cli`](packages/hotfix-cli) | Hermes bundle 构建与更新发布命令 |
| [`react-native-hotfix-server`](packages/hotfix-server) | 清单签名与不可变资源更新服务端 |
| [`react-native-hotfix-protocol`](packages/hotfix-protocol) | v1 清单 Schema、规范化与校验规则 |

## 工作原理

1. App 安装包内置正常的 React Native bundle。
2. CLI 生成平台对应的 Hermes 字节码、资源和更新清单。
3. 服务端校验上传内容，使用 RSA-SHA256 签名规范化清单，并按
   channel/runtime/platform 激活版本。
4. 客户端携带安装 ID 检查更新，实现稳定的百分比灰度。
5. 原生代码先验证清单签名，再解析清单，并校验每个文件的大小和 SHA-256。
6. 完整更新会被移动到不可变更新目录；下一次冷启动时选择该目录作为 JS bundle。
7. `HotfixProvider` 确认 JavaScript 成功启动。连续失败时自动回退到上一版本
   或安装包内置版本。

详细设计见[架构文档](docs/zh-CN/architecture.md)、[安全模型](docs/zh-CN/security.md)
和[发布流程](docs/zh-CN/releasing.md)。

## 集成到现有 React Native App

环境要求：Node.js 22.11+、JDK 17，以及 React Native 0.87 要求的 Xcode 16.1+。

```sh
npm install react-native-hotfix@0.1.1
npm install -D react-native-hotfix-cli@0.1.1 react-native-hotfix-server@0.1.1
npx hotfix keys generate --out .hotfix/keys
```

然后完成原生接入：

1. 在 `AndroidManifest.xml` 中加入公钥、服务端 URL、channel 和 runtime。
2. 在 `Info.plist` 中加入相同配置，并在 `AppDelegate.swift` 覆盖 `bundleURL()`。
3. 修改 Android `MainApplication.kt`，将
   `HotfixBundle.getBundleFilePath(applicationContext)` 传给 `getDefaultReactHost`。
4. 执行 `pod install`，并重新构建 Android 和 iOS 原生 App。
5. 使用 `HotfixProvider` 包裹 React 根节点。
6. 重新安装原生 App 后，才能测试第一次热更新。

完整的可复制配置见[接入指南](docs/zh-CN/getting-started.md)，其中包含
Android/iOS 文件、本地服务端、bundle 发布、冷启动验证、回滚测试、API 和
常见问题。

启动本地服务端：

```sh
HOTFIX_PRIVATE_KEY=.hotfix/keys/private.pem \
HOTFIX_ADMIN_TOKEN=replace-with-a-long-random-token \
HOTFIX_STORAGE_DIR=.hotfix/server \
npx hotfix-server
```

构建并发布更新：

```sh
npx hotfix build \
  --platform all \
  --channel production \
  --runtime-version 1.0.0 \
  --output .hotfix/dist

HOTFIX_ADMIN_TOKEN=replace-with-a-long-random-token \
npx hotfix publish \
  --server http://127.0.0.1:3000 \
  --input .hotfix/dist/ios-1.0.0 \
  --rollout-percent 5
```

Android 模拟器通过 `10.0.2.2:3000` 访问服务端，iOS 模拟器使用
`127.0.0.1:3000`。点击 **Check for update**，然后彻底关闭并冷启动 App，
即可激活已下载的 bundle。

## 运行仓库自带示例

```sh
npm install
npm run hotfix:setup
npm run server
```

`hotfix:setup` 会在需要时生成签名密钥，并把公钥写入示例 App 的原生配置。

## API 概览

```tsx
import { Hotfix, HotfixProvider, useHotfix } from 'react-native-hotfix';

<HotfixProvider>
  <App />
</HotfixProvider>;

const result = await Hotfix.checkForUpdate();
const state = await Hotfix.getState();
```

## 开发与验证

```sh
npm test
npm run test:hotfix
npm run lint
npx tsc --noEmit
npm run release:check
```

根目录 App 用于演示 SDK，`packages/` 下的包会分别发布到 npm。

## 发布 npm 包

```sh
npm login
npm run release:check
npm run release:publish
```

发布脚本会按照依赖顺序，将协议包、服务端、CLI 和客户端 SDK 发布到 npm
官方仓库。

GitHub Actions 发布前需要配置仓库 Secret `NPM_TOKEN`，然后推送版本 Tag：

```sh
git tag v0.1.1
git push github master --follow-tags
```

发布 Workflow 会执行完整检查，发布所有 npm 包并生成 provenance，同时创建
GitHub Release。

## 当前限制

- `v0.1` 在下次冷启动时应用更新，不会立即重新加载当前 React 实例。
- channel 指针和上传暂存针对单服务端进程设计。多节点部署需要共享事务存储
  或对象存储协调。
- 仍必须遵守 App Store 和 Google Play 对动态代码、审查和更新行为的规定。

## 许可证

[MIT](LICENSE)
