# react-native-hotfix

[English](README.md) | **简体中文**

面向 React Native 0.87 和新架构的签名式自托管热更新客户端 SDK。

## 安装

```sh
npm install react-native-hotfix
```

iOS 需要执行 `pod install` 并重新构建原生 App。完整接入步骤见
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
