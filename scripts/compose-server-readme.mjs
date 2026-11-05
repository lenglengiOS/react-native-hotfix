#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const packageRoot = path.join(root, 'packages/hotfix-server');

function bodyAfterHeader(markdown) {
  return markdown.replace(/^#[^\n]+\n\n(?:\[English\][^\n]+\n\n)?/, '');
}

const englishGuide = await readFile(
  path.join(root, 'docs/server-deployment.md'),
  'utf8',
);
const chineseGuide = await readFile(
  path.join(root, 'docs/zh-CN/server-deployment.md'),
  'utf8',
);

const english = `# React Native Hotfix Server

**English** | [简体中文](README.zh-CN.md)

Single-node, self-hosted update server for React Native Hotfix. This README is
also the complete private deployment guide.

## Install

\`\`\`sh
npm install react-native-hotfix-server@0.1.3
npm install -D react-native-hotfix-cli@0.1.3
\`\`\`

Generate signing keys, then start the server:

\`\`\`sh
npx hotfix keys generate --out .hotfix/keys

HOTFIX_PRIVATE_KEY=.hotfix/keys/private.pem \\
HOTFIX_ADMIN_TOKEN=replace-with-a-long-random-token \\
HOTFIX_STORAGE_DIR=.hotfix/server \\
npx hotfix-server
\`\`\`

Check health:

\`\`\`sh
curl http://127.0.0.1:3000/health
\`\`\`

The package exports \`createHotfixServer()\` and \`./signing\` for embedding the
service in a larger Node.js application.

# Private server deployment

${bodyAfterHeader(englishGuide)
  .replace(
    '(getting-started.md)',
    '(https://github.com/lenglengiOS/react-native-hotfix/blob/master/docs/getting-started.md)',
  )
  .trimEnd()}
`;

const chinese = `# React Native Hotfix Server

[English](README.md) | **简体中文**

React Native Hotfix 的单节点自托管更新服务端。本 README 同时是完整的服务端
私有化部署指南。

## 安装

\`\`\`sh
npm install react-native-hotfix-server@0.1.3
npm install -D react-native-hotfix-cli@0.1.3
\`\`\`

生成签名密钥后启动服务端：

\`\`\`sh
npx hotfix keys generate --out .hotfix/keys

HOTFIX_PRIVATE_KEY=.hotfix/keys/private.pem \\
HOTFIX_ADMIN_TOKEN=replace-with-a-long-random-token \\
HOTFIX_STORAGE_DIR=.hotfix/server \\
npx hotfix-server
\`\`\`

检查服务：

\`\`\`sh
curl http://127.0.0.1:3000/health
\`\`\`

该包导出 \`createHotfixServer()\` 和 \`./signing\`，可以嵌入现有 Node.js 应用。

# 服务端私有化部署

${bodyAfterHeader(chineseGuide)
  .replace(
    '(getting-started.md)',
    '(https://github.com/lenglengiOS/react-native-hotfix/blob/master/docs/zh-CN/getting-started.md)',
  )
  .trimEnd()}
`;

await writeFile(path.join(packageRoot, 'README.md'), english);
await writeFile(path.join(packageRoot, 'README.zh-CN.md'), chinese);
console.log('Generated react-native-hotfix-server README files.');
