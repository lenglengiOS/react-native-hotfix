# 发布流程

[English](../releasing.md) | **简体中文**

## 构建

```sh
npx hotfix build \
  --platform all \
  --channel production \
  --runtime-version 1.0.0 \
  --output .hotfix/dist
```

该命令为每个平台运行 Metro，生成 Hermes 字节码，打包资源，并写入未签名的
`manifest.json`。Source Map 保留在输出目录，但不会上传，也不会写入清单。

只有 App 明确配置了兼容的 JavaScript 引擎时才使用 `--no-hermes`。当前示例
默认并推荐使用 Hermes。

## 发布

```sh
HOTFIX_ADMIN_TOKEN=... npx hotfix publish \
  --server https://updates.example.com \
  --input .hotfix/dist/ios-1.0.0 \
  --rollout-percent 5
```

发布命令会：

1. 注册预期清单和文件集合；
2. 上传所有文件；
3. 要求服务端复核大小和哈希；
4. 签名规范化清单；
5. 原子切换 channel 指针。

## 灰度

调整已发布不可变版本的灰度比例：

```sh
HOTFIX_ADMIN_TOKEN=... npx hotfix activate \
  --server https://updates.example.com \
  --channel production \
  --platform ios \
  --runtime-version 1.0.0 \
  --update-id <id> \
  --rollout-percent 100
```

`--rollout-percent 0` 可以暂停分发。回滚时应重新激活之前的不可变更新 ID。
尚未下载错误版本的客户端会继续使用当前 bundle。

## 推荐生产流程

1. 先发布到内部 channel。
2. 测试全新安装和冷启动激活。
3. 发布一个故意崩溃的内部更新，验证回滚。
4. 生产环境从 1-5% 灰度开始。
5. 观察无崩溃启动率和回滚计数。
6. 指标健康后依次提高到 25%、50% 和 100%。
7. 保留上一个 known-good 版本，供手动激活回滚。

## Runtime Version 规则

以下任意变化发生时都需要更新 `runtimeVersion`：

- React Native 或 Hermes runtime 版本；
- 原生模块 ABI 或必要的原生代码；
- App 对原生能力依赖方式的假设；
- bundle 加载行为。

不要在原生不兼容的版本之间复用 runtime version。服务端只会返回
runtime/channel/platform 完全匹配的更新。

## 发布 SDK npm 包

仓库根目录的发布脚本会按依赖顺序执行：

```sh
npm login --registry https://registry.npmjs.org/
npm run release:check
git tag v0.1.1
npm run release:publish
git push github master --follow-tags
```

`release:check` 会检查中英文文档是否成对、所有包版本是否一致、是否配置 npm
官方仓库，以及发布包中是否混入构建产物或敏感文件。`release:publish` 在工作区
存在未提交修改，或 HEAD 没有精确版本 Tag 时会拒绝发布。
