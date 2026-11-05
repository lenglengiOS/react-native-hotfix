# react-native-hotfix

[English](README.md) | **简体中文**

面向 React Native 0.87 和新架构的签名式自托管热更新客户端 SDK。

## 安装

```sh
npm install react-native-hotfix@0.1.1
npm install -D react-native-hotfix-cli@0.1.1 react-native-hotfix-server@0.1.1
```

SDK 加载更新前必须完成以下原生步骤：

1. 执行 `npx hotfix keys generate --out .hotfix/keys` 生成密钥。
2. 在 `AndroidManifest.xml` 和 `Info.plist` 配置公钥、更新地址、channel
   和 runtime version。
3. Android 将 `HotfixBundle.getBundleFilePath(context)` 传给 React Host。
4. iOS 在 React Native factory delegate 中覆盖 `bundleURL()`。
5. 使用 `HotfixProvider` 包裹 React 根节点，并重新构建原生 App。

完整的可复制原生代码、服务端启动、发布、冷启动验证、回滚测试和故障排查见
[中文接入指南](https://github.com/lenglengiOS/react-native-hotfix/blob/main/docs/zh-CN/getting-started.md)。

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

React 页面中可以调用 `useHotfix()` 获取当前状态、初始化结果、错误信息，以及
`checkForUpdate()` 操作。

## v0.1 提供的能力

- 在信任 JSON 内容前，由原生代码验证 RSA-SHA256 清单签名。
- 每个 bundle 和资源文件都会校验 SHA-256 与文件大小。
- 仅安装 `runtimeVersion`、channel 和 platform 完全匹配的更新。
- 下载先写入独立暂存目录，全部校验成功后原子激活。
- `HotfixProvider` 标记新 bundle 已成功启动。连续两次冷启动失败会自动
  回退到上一版本。
- 发布文件使用不可变内容路径，可直接通过 CDN 分发。

本 SDK 不能代替 App Store 或 Google Play 的审核。动态代码更新必须遵守目标
应用商店规则和当地法律。
