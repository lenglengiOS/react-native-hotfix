# React Native Hotfix

**English** | [简体中文](README.zh-CN.md)

A self-hosted, signed over-the-air update system for React Native 0.87 and the
New Architecture.

This repository is both a runnable reference app and a npm workspace containing
the client SDK, build/publish CLI, protocol package, and update server. The
design follows the core ideas used by Expo Updates: signed manifests, explicit
runtime compatibility, downloaded asset trees, launch-time bundle selection,
and crash rollback. It does not depend on Expo or Expo Updates.

> Status: `0.1.0` reference implementation. The protocol and native APIs are
> usable, but the project still needs a broader device/CI matrix and a
> production deployment security review before critical production use.

## Packages

| Package | Purpose |
| --- | --- |
| [`react-native-hotfix`](packages/react-native-hotfix) | React Native client SDK and New Architecture TurboModule |
| [`react-native-hotfix-cli`](packages/hotfix-cli) | Hermes bundle build and publish commands |
| [`react-native-hotfix-server`](packages/hotfix-server) | Signed manifest and immutable asset server |
| [`react-native-hotfix-protocol`](packages/hotfix-protocol) | Manifest v1 schema, canonicalization, and validation |

## How it works

1. The app ships with a normal embedded React Native bundle.
2. The CLI produces a platform-specific Hermes bytecode bundle, assets, and an
   update manifest.
3. The server verifies every upload, signs the canonical manifest with
   RSA-SHA256, and activates it for a channel/runtime/platform.
4. The client fetches a release using an installation ID for deterministic
   percentage rollout.
5. Native code verifies the manifest signature before parsing it, then verifies
   every file size and SHA-256 digest.
6. The complete update is moved into an immutable update directory. The next
   cold launch selects that directory as the JavaScript bundle.
7. `HotfixProvider` confirms a successful JavaScript launch. Repeated failed
   launches automatically return to the previous bundle or the embedded bundle.

See [Architecture](docs/architecture.md), [Security](docs/security.md), and
[Release workflow](docs/releasing.md) for the detailed design. Chinese versions
are available under [`docs/zh-CN/`](docs/zh-CN/).

## Local quick start

Prerequisites: Node.js 22.11+, JDK 17, and Xcode 16.1+ for React Native 0.87.

```sh
npm install
npm run hotfix:setup
```

`hotfix:setup` generates a local signing key if needed and writes its public key
into this demo's native configuration. For a new project, follow
[Getting started](docs/getting-started.md).

Start the server:

```sh
HOTFIX_PRIVATE_KEY=.hotfix/keys/private.pem \
HOTFIX_ADMIN_TOKEN=replace-with-a-long-random-token \
npm run server
```

Build and publish an update:

```sh
npm run hotfix:build

HOTFIX_ADMIN_TOKEN=replace-with-a-long-random-token \
node packages/hotfix-cli/bin/hotfix.mjs publish \
  --server http://localhost:3000 \
  --input .hotfix/dist/ios-1.0.0 \
  --rollout-percent 10
```

Run Android against `10.0.2.2:3000` or iOS against `127.0.0.1:3000`, then tap
**Check for update**. Kill and cold-start the app to activate the downloaded
bundle.

## Development

```sh
npm test
npm run test:hotfix
npm run lint
npx tsc --noEmit
```

The root app demonstrates the SDK. The packages under `packages/` are published
independently. Run `npm run release:check` before publishing.

## Publishing the packages

```sh
npm login
npm run release:check
npm run release:publish
```

The publish script releases the protocol, server, CLI, and client packages in
dependency order through the official npm registry.

For the GitHub workflow, configure an `NPM_TOKEN` repository secret and push a
version tag:

```sh
git tag v0.1.0
git push github master --follow-tags
```

The release workflow runs the full checks, publishes all packages with npm
provenance, and creates a GitHub release.

## Important limitations

- `v0.1` activates downloaded updates on the next cold launch. It does not
  reload the running React instance.
- Channel pointers and upload staging target a single server process. Multi-node
  deployments need shared transactional storage or object-store coordination.
- App Store and Google Play policies still apply. OTA code updates are not a
  way to bypass review or platform security requirements.

## License

[MIT](LICENSE)
