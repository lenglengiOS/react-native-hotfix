# react-native-hotfix-cli

[English](README.md) | **简体中文**

为 React Native 0.87 构建 Hermes 字节码，并将更新清单发布到自托管服务端。

## 安装

```sh
npm install -D react-native-hotfix-cli@0.1.3
```

## 完整流程

```sh
npx hotfix keys generate --out .hotfix/keys

npx hotfix build \
  --platform all \
  --channel production \
  --runtime-version 1.0.0 \
  --output .hotfix/dist

HOTFIX_ADMIN_TOKEN=change-me \
npx hotfix publish \
  --server http://127.0.0.1:3000 \
  --input .hotfix/dist/ios-1.0.0 \
  --rollout-percent 5
```

生成的公钥必须打包到 App 中。私钥必须保存在服务端，绝不能下发给客户端。
