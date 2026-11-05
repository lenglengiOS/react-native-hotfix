# 架构

[English](../architecture.md) | **简体中文**

## 信任边界

原生客户端只信任打包在 App 内的一个 RSA 公钥。私钥只存在于发布端或服务端。
收到服务端响应后，必须先验证分离签名对应的规范化原始字节，验证通过后才允许
解析为更新清单。

```text
Manifest JSON -> 规范化 UTF-8 payload -> RSA-SHA256 签名
                                      |
客户端：验证签名 -> 解析 payload -> 检查兼容性
      -> 下载文件 -> 校验大小与哈希 -> 原子安装
```

服务端通过 Base64 保存原始 payload，因此原生客户端不需要重新实现 RFC 8785
规范化 JSON。

## 更新清单

协议 v1 包含：

- 随机更新 ID 和创建时间；
- 精确的 channel、platform 和 runtime version；
- 一个启动 bundle 描述；
- 其他资源文件描述；
- 可选的非可执行 metadata；
- 启动失败阈值。

每个文件描述都包含安全相对路径、SHA-256、精确大小和内容类型。服务端、下载器、
安装器和资源接口会分别再次检查路径。

JSON Schema 位于
[`packages/hotfix-protocol/schema/update-manifest-1.schema.json`](../../packages/hotfix-protocol/schema/update-manifest-1.schema.json)。

## 原生启动流程

在 React Native 实例启动前，宿主工程向原生 SDK 获取 bundle URL 或文件路径：

- iOS：`HotfixBundle.currentBundleURL(fallbackURL:)`
- Android：`HotfixBundle.getBundleFilePath(context)`

如果没有已激活且验证通过的更新，或者当前是可使用 Metro 的 Debug 构建，
SDK 会返回安装包内置或开发环境 bundle。

每次更新使用独立的不可变目录：

```text
hotfix/
  updates/<update-id>/
    manifest.json
    main.jsbundle                 # iOS 启动资源
    assets/...                    # iOS 资源目录
    # 或 index.android.bundle 和 drawable-* 资源目录
  state.json
```

下载文件先写入同一文件系统中的隐藏暂存目录。只有全部文件验证通过后，才会
重命名为 `updates/<update-id>`。状态文件使用原子写入。

状态机保存当前和上一个成功版本：

```text
已安装 -> 下次启动为 pending -> JS 确认后变为 ready
                           \-> 连续失败后回退到上一版本或内置 bundle
```

JavaScript 根节点必须包裹 `HotfixProvider`，组件挂载时调用 `markReady()`。
JavaScript 执行前就可能发生启动失败，因此不能只根据 bundle 加载成功判断
更新是否可靠。

## 资源文件

CLI 使用 React Native 0.87 Metro CLI，并指定
`--unstable-transform-profile hermes`，随后将 JS 编译为 Hermes 字节码。
Launcher bundle 与 Metro 资源会写入同一个更新目录。

React Native 的资源解析器会根据当前脚本 URL 生成 `file://` 资源地址。因此，
从独立更新目录加载 bundle 后，iOS 的 `assets/...` 和 Android 的
`drawable-*` 路径会自动解析到该更新目录，不需要全局注册资源。

## 服务端

服务端提供：

- `GET /v1/check`
- `GET /v1/updates/:channel/:platform/:runtime/:update/:path`
- 带鉴权的上传暂存、文件上传、提交和激活接口

已发布文件使用不可变 URL 和一年缓存响应头。完整上传后，channel 指针通过原子
替换切换。灰度判断使用安装 ID 与更新 ID 的稳定哈希，因此重试不会让客户端在
不同灰度分组之间跳动。

当前服务端刻意实现为单节点版本。水平扩容时应保持协议和原生客户端不变，
将存储替换为 PostgreSQL 加对象存储，并保证版本切换仍然具备事务性。

## 新架构

客户端使用 codegen TurboModule，异步方法包括：

- `getState`
- `downloadAndInstall`
- `markReady`
- `clearDownloads`

不需要 Fabric UI 组件。bundle 选择已接入 React Native 0.87 的
`ReactHost`/`RCTReactNativeFactory` 启动路径，与当前新架构模板保持一致。
