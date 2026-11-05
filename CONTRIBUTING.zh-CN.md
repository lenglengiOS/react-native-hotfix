# 参与贡献

[English](CONTRIBUTING.md) | **简体中文**

## 开发环境

```sh
npm install
npm run test:hotfix
npm test
npm run lint
npx tsc --noEmit
```

Android 开发需要 JDK 17。iOS 开发遵循 React Native 0.87 的最低要求，
即 Xcode 16.1。

## 修改协议

协议变更必须同时包含：

- 更新后的 JSON Schema；
- 服务端与客户端兼容性测试；
- 已安装旧版本客户端的明确迁移方案；
- 降级和灰度行为说明。

优先生成新的协议版本，而不是改变协议 v1 已有字段的含义。

## Pull Request

每个 PR 应保持聚焦。行为变更需要附带测试，并更新相关包 README 或 `docs/`
文档。安全相关修改应在 PR 中说明威胁模型和失败后的行为。
