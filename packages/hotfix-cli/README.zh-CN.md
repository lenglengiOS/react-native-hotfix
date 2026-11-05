# react-native-hotfix-cli

[English](README.md) | **简体中文**

为 React Native 0.87 构建 Hermes 字节码，并将更新清单发布到自托管服务端。

```sh
hotfix keys generate --out .hotfix/keys
hotfix build --platform all --runtime-version 1.0.0
HOTFIX_ADMIN_TOKEN=change-me hotfix publish \
  --server http://localhost:3000 \
  --input .hotfix/dist/ios-1.0.0 \
  --rollout-percent 10
```

生成的公钥必须打包到 App 中。私钥必须保存在服务端，绝不能下发给客户端。
