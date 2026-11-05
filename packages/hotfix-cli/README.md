# react-native-hotfix-cli

**English** | [简体中文](README.zh-CN.md)

Builds Hermes bytecode for React Native 0.87 and publishes update manifests to
the self-hosted server.

```sh
hotfix keys generate --out .hotfix/keys
hotfix build --platform all --runtime-version 1.0.0
HOTFIX_ADMIN_TOKEN=change-me hotfix publish \
  --server http://localhost:3000 \
  --input .hotfix/dist/ios-1.0.0 \
  --rollout-percent 10
```

The generated public key must be built into the app. The private key must stay
on the server and never be shipped to a client.
