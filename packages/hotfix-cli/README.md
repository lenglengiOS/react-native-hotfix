# react-native-hotfix-cli

**English** | [简体中文](README.zh-CN.md)

Builds Hermes bytecode for React Native 0.87 and publishes update manifests to
the self-hosted server.

## Install

```sh
npm install -D react-native-hotfix-cli@0.1.1
```

## Complete workflow

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

The generated public key must be built into the app. The private key must stay
on the server and never be shipped to a client.
