import path from 'node:path';

import { integerOption, parseArgs, requireOption } from './args.mjs';
import { buildUpdates } from './build.mjs';
import { generateKeys } from './keys.mjs';
import { activateUpdate, publishUpdate } from './publish.mjs';

const HELP = `React Native Hotfix CLI

Usage:
  hotfix keys generate --out .hotfix/keys [--force] [--bits 3072]
  hotfix build --platform all --runtime-version 1.0.0 [options]
  hotfix publish --server URL --input DIR [options]
  hotfix activate --server URL --channel production --platform ios \\
    --runtime-version 1.0.0 --update-id ID [--rollout-percent 10]

Build options:
  --platform <ios|android|all>   Platforms to build (default: all)
  --channel <name>               Release channel (default: production)
  --runtime-version <version>    Native runtime compatibility key (required)
  --entry-file <path>            Metro entry file (default: index.js)
  --output <dir>                 Output root (default: .hotfix/dist)
  --metadata <json>              Extra manifest metadata file
  --no-hermes                    Emit a plain JavaScript bundle

Publish options:
  --token <token>                Admin token; defaults to HOTFIX_ADMIN_TOKEN
  --rollout-percent <0-100>      Initial rollout (default: 100)
`;

function platforms(value = 'all') {
  return value === 'all' ? ['ios', 'android'] : [value];
}

function validateRollout(options) {
  const rolloutPercent = integerOption(options, 'rollout-percent', 100);
  if (rolloutPercent < 0 || rolloutPercent > 100) {
    throw new TypeError('--rollout-percent must be from 0 to 100');
  }
  return rolloutPercent;
}

export async function run(argv) {
  const { options, positional } = parseArgs(argv);
  const [command, subcommand] = positional;

  if (!command || options.help) {
    console.log(HELP);
    return;
  }

  if (command === 'keys' && subcommand === 'generate') {
    const result = await generateKeys({
      outputDir: options.out || '.hotfix/keys',
      force: Boolean(options.force),
      bits: integerOption(options, 'bits', 3072),
    });
    console.log(`Private key: ${result.privatePath}`);
    console.log(`Public key:  ${result.publicPath}`);
    console.log(`Key ID:      ${result.keyId}`);
    console.log(`SPKI base64: ${result.publicDerBase64}`);
    return;
  }

  if (command === 'build') {
    const runtimeVersion = requireOption(options, 'runtime-version');
    await buildUpdates({
      platforms: platforms(options.platform || 'all'),
      channel: options.channel || 'production',
      runtimeVersion,
      projectRoot: path.resolve(options['project-root'] || process.cwd()),
      outputRoot: path.resolve(options.output || '.hotfix/dist'),
      entryFile: options['entry-file'] || 'index.js',
      hermes: options.hermes !== false,
      metadataPath: options.metadata,
    });
    return;
  }

  if (command === 'publish') {
    await publishUpdate({
      server: requireOption(options, 'server'),
      token: options.token || process.env.HOTFIX_ADMIN_TOKEN,
      inputDir: requireOption(options, 'input'),
      rolloutPercent: validateRollout(options),
    });
    return;
  }

  if (command === 'activate') {
    const result = await activateUpdate({
      server: requireOption(options, 'server'),
      token: options.token || process.env.HOTFIX_ADMIN_TOKEN,
      channel: requireOption(options, 'channel'),
      platform: requireOption(options, 'platform'),
      runtimeVersion: requireOption(options, 'runtime-version'),
      updateId: requireOption(options, 'update-id'),
      rolloutPercent: validateRollout(options),
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  throw new TypeError(`Unknown command: ${[command, subcommand].filter(Boolean).join(' ')}`);
}
