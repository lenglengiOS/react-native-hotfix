# Release workflow

**English** | [简体中文](zh-CN/releasing.md)

## Build

```sh
npx hotfix build \
  --platform all \
  --channel production \
  --runtime-version 1.0.0 \
  --output .hotfix/dist
```

This runs Metro for each platform, emits Hermes bytecode, packages assets, and
writes an unsigned `manifest.json`. Source maps stay in the output directory but
are not uploaded or referenced by the manifest.

Use `--no-hermes` only for an app configured to use a compatible JavaScript
engine. The default and recommended path for the current demo is Hermes.

## Publish

```sh
HOTFIX_ADMIN_TOKEN=... npx hotfix publish \
  --server https://updates.example.com \
  --input .hotfix/dist/ios-1.0.0 \
  --rollout-percent 5
```

The publish command:

1. registers the expected manifest and file set;
2. uploads every file;
3. asks the server to verify size and hashes;
4. signs the canonical manifest;
5. atomically activates the channel pointer.

## Rollout

Change rollout for an already published immutable update:

```sh
HOTFIX_ADMIN_TOKEN=... npx hotfix activate \
  --server https://updates.example.com \
  --channel production \
  --platform ios \
  --runtime-version 1.0.0 \
  --update-id <id> \
  --rollout-percent 100
```

An activation with `--rollout-percent 0` pauses delivery. To roll back, activate
an earlier immutable update ID. Clients that have not downloaded the bad update
will remain on their current bundle.

## Recommended production sequence

1. Publish to an internal channel.
2. Test a clean install and a cold-start activation.
3. Test rollback by publishing a deliberately crashing internal update.
4. Start production at 1-5%.
5. Watch crash-free launches and rollback counters.
6. Increase to 25%, 50%, and 100% while metrics remain healthy.
7. Keep the previous known-good update available for manual activation.

## Runtime version rules

Bump `runtimeVersion` when any of these changes:

- React Native or Hermes runtime version;
- native module ABI or required native code;
- app code assumptions about native capabilities;
- bundle loading behavior.

Do not reuse a runtime version across incompatible native releases. The server
only returns an update for an exact runtime/channel/platform match.

## Publishing the SDK packages

The repository-level release script publishes packages in dependency order:

```sh
npm login --registry https://registry.npmjs.org/
npm run release:check
git tag v0.1.0
npm run release:publish
git push github master --follow-tags
```

`release:check` requires English/Chinese documentation pairs, matching package
versions, official npm registry configuration, and clean package contents.
`release:publish` refuses to run with uncommitted changes or without an exact
version tag.
