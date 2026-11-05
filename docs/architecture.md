# Architecture

**English** | [简体中文](zh-CN/architecture.md)

## Trust boundary

The native client trusts exactly one RSA public key embedded in the application.
The private key exists only on the publisher/server. A server response is not
parsed as an update until its detached signature verifies over the exact
canonical payload bytes.

```text
Manifest JSON -> canonical UTF-8 payload -> RSA-SHA256 signature
                                      |
Client: verify signature -> parse payload -> verify compatibility
        -> download files -> verify hash/size -> atomic install
```

The server stores the payload in Base64 so native clients never need to
reimplement RFC 8785 canonical JSON.

## Manifest

Protocol v1 contains:

- a random update ID and creation timestamp;
- exact channel, platform, and runtime version;
- one launch bundle descriptor;
- all other asset descriptors;
- optional non-executable metadata;
- a launch-failure threshold.

Every descriptor contains a safe relative path, SHA-256 digest, exact size, and
content type. Paths are validated again by the server, downloader, installer,
and asset endpoint.

The JSON Schema is at
[`packages/hotfix-protocol/schema/update-manifest-1.schema.json`](../packages/hotfix-protocol/schema/update-manifest-1.schema.json).

## Native launch flow

Before the React Native instance starts, the host asks the native SDK for a
bundle URL/file path:

- iOS: `HotfixBundle.currentBundleURL(fallbackURL:)`
- Android: `HotfixBundle.getBundleFilePath(context)`

If no verified update has been activated, or the app is using Metro in a debug
build, the embedded/development bundle is returned.

Update storage uses an immutable directory per update:

```text
hotfix/
  updates/<update-id>/
    manifest.json
    main.jsbundle                 # iOS launch asset
    assets/...                    # iOS asset tree
    # or index.android.bundle and drawable-* asset directories
  state.json
```

Downloads are assembled under a hidden staging directory in the same filesystem.
The directory is renamed into `updates/<update-id>` only after all files verify.
State is written atomically.

The state machine keeps the current and previous successful update:

```text
installed -> pending on next launch -> ready after JS confirmation
                                  \-> previous/embedded after too many failed starts
```

The JavaScript root must be wrapped in `HotfixProvider`; its mount calls
`markReady()`. A launch can fail before JavaScript runs, so confirmation cannot
be safely inferred from bundle loading alone.

## Assets

The CLI invokes the React Native 0.87 Metro CLI with
`--unstable-transform-profile hermes`, then compiles the JS to Hermes bytecode.
The bundle and Metro assets are emitted into the same update directory.

React Native's asset resolver bases `file://` asset URLs on the active script
URL. Loading the update bundle from its isolated directory therefore resolves
Metro's `assets/...` (iOS) and `drawable-*` (Android) paths within that update
without process-global asset registration.

## Server

The server exposes:

- `GET /v1/check`
- `GET /v1/updates/:channel/:platform/:runtime/:update/:path`
- authenticated update staging, upload, commit, and activation endpoints

Published files have immutable URLs and year-long cache headers. Channel
pointers are atomically replaced after a complete upload. Rollout eligibility is
a stable hash of installation ID plus update ID, so retries do not flip a client
between rollout cohorts.

The provided server is intentionally single-node. For horizontal scaling, keep
the protocol/native clients and replace storage with PostgreSQL plus object
storage. The release transition must remain transactional.

## New Architecture

The client uses a codegen TurboModule with async methods:

- `getState`
- `downloadAndInstall`
- `markReady`
- `clearDownloads`

No UI Fabric component is required. Bundle selection is integrated into the
React Native 0.87 `ReactHost`/`RCTReactNativeFactory` startup path, which is
shared by the current New Architecture templates.
