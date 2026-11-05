# Contributing

**English** | [简体中文](CONTRIBUTING.zh-CN.md)

## Development setup

```sh
npm install
npm run test:hotfix
npm test
npm run lint
npx tsc --noEmit
```

Android development needs JDK 17. iOS development follows the React Native
0.87 minimum of Xcode 16.1.

## Changes to the protocol

Protocol changes require:

- an updated JSON Schema;
- server and client compatibility tests;
- an explicit migration story for previously installed clients;
- documentation of downgrade and rollout behavior.

Prefer adding a new protocol version over changing the meaning of protocol v1.

## Pull requests

Keep changes focused, include tests for behavior changes, and update the
relevant package README or `docs/` page. Security-sensitive changes should
describe the threat model and failure mode in the PR.
