import { randomUUID } from 'node:crypto';
import {
  access,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { createUpdateManifest } from 'react-native-hotfix-protocol';

import { describeFile, walkFiles } from './files.mjs';

const PLATFORM_BUNDLE_NAMES = {
  ios: 'main.jsbundle',
  android: 'index.android.bundle',
};

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: options.stdio || 'inherit',
      env: process.env,
    });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

async function findHermesc(projectRoot) {
  const candidates =
    process.platform === 'darwin'
      ? [
          path.join(projectRoot, 'node_modules/react-native/sdks/hermesc/osx-bin/hermesc'),
          path.join(projectRoot, 'node_modules/hermes-compiler/hermesc/osx-bin/hermesc'),
        ]
      : process.platform === 'win32'
        ? [
            path.join(
              projectRoot,
              'node_modules/react-native/sdks/hermesc/win64-bin/hermesc.exe',
            ),
            path.join(
              projectRoot,
              'node_modules/hermes-compiler/hermesc/win64-bin/hermesc.exe',
            ),
          ]
        : [
            path.join(
              projectRoot,
              'node_modules/react-native/sdks/hermesc/linux64-bin/hermesc',
            ),
            path.join(
              projectRoot,
              'node_modules/hermes-compiler/hermesc/linux64-bin/hermesc',
            ),
          ];

  for (const candidate of candidates) {
    if (await exists(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    'Hermes compiler was not found. Pass --no-hermes for JSC or run `npm install` first.',
  );
}

async function readMetadata(metadataPath) {
  if (!metadataPath) {
    return {};
  }
  return JSON.parse(await readFile(path.resolve(metadataPath), 'utf8'));
}

async function buildPlatform({
  platform,
  channel,
  runtimeVersion,
  projectRoot,
  outputRoot,
  entryFile,
  hermes,
  metadata,
}) {
  const finalDir = path.join(outputRoot, `${platform}-${runtimeVersion}`);
  const workDir = path.join(outputRoot, `.build-${platform}-${randomUUID()}`);
  const jsBundleName = `.source-${platform}.js`;
  const sourceBundle = path.join(workDir, jsBundleName);
  const launchAssetName = PLATFORM_BUNDLE_NAMES[platform];
  const launchAsset = path.join(workDir, launchAssetName);
  const sourceMap = path.join(workDir, `${launchAssetName}.map`);

  await mkdir(workDir, { recursive: true });
  try {
    const cli = path.join(projectRoot, 'node_modules/react-native/cli.js');
    const bundleArgs = [
      cli,
      'bundle',
      '--platform',
      platform,
      '--dev',
      'false',
      '--minify',
      'true',
      '--entry-file',
      entryFile,
      '--bundle-output',
      sourceBundle,
      '--assets-dest',
      workDir,
      '--sourcemap-output',
      sourceMap,
      '--sourcemap-sources-root',
      projectRoot,
      '--unstable-transform-profile',
      'hermes',
    ];
    await run(process.execPath, bundleArgs, { cwd: projectRoot });

    if (hermes) {
      const hermesc = await findHermesc(projectRoot);
      const bytecode = path.join(workDir, `.${launchAssetName}.hbc`);
      await run(hermesc, [
        '-emit-binary',
        '-O',
        '-w',
        '-g1',
        '-out',
        bytecode,
        sourceBundle,
      ]);
      await rm(sourceBundle, { force: true });
      await rename(bytecode, launchAsset);
    } else {
      await rename(sourceBundle, launchAsset);
    }

    const files = await walkFiles(workDir);
    const descriptors = [];
    for (const file of files) {
      if (file === sourceMap || file.endsWith('.map')) {
        continue;
      }
      descriptors.push(await describeFile(workDir, file));
    }
    const launchDescriptor = descriptors.find(
      descriptor => descriptor.path === launchAssetName,
    );
    if (!launchDescriptor) {
      throw new Error(`Bundler did not produce ${launchAssetName}`);
    }

    const manifest = createUpdateManifest({
      id: randomUUID(),
      runtimeVersion,
      channel,
      platform,
      launchAsset: launchDescriptor,
      assets: descriptors.filter(
        descriptor => descriptor.path !== launchAssetName,
      ),
      metadata,
      maxFailedLaunches: 2,
    });

    const serializedManifest = `${JSON.stringify(manifest, null, 2)}\n`;
    await writeFile(
      path.join(workDir, 'manifest.json'),
      serializedManifest,
      'utf8',
    );

    await rm(finalDir, { recursive: true, force: true });
    await rename(workDir, finalDir);
    return {
      platform,
      directory: finalDir,
      manifest,
      sourceMap: path.join(finalDir, `${launchAssetName}.map`),
    };
  } catch (error) {
    await rm(workDir, { recursive: true, force: true });
    throw error;
  }
}

export async function buildUpdates({
  platforms,
  channel,
  runtimeVersion,
  projectRoot,
  outputRoot,
  entryFile = 'index.js',
  hermes = true,
  metadataPath,
}) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const resolvedOutput = path.resolve(outputRoot);
  await mkdir(resolvedOutput, { recursive: true });
  const metadata = await readMetadata(metadataPath);
  const results = [];
  for (const platform of platforms) {
    if (!PLATFORM_BUNDLE_NAMES[platform]) {
      throw new TypeError(`Unsupported platform: ${platform}`);
    }
    console.log(`Building ${platform} update for runtime ${runtimeVersion}...`);
    results.push(
      await buildPlatform({
        platform,
        channel,
        runtimeVersion,
        projectRoot: resolvedProjectRoot,
        outputRoot: resolvedOutput,
        entryFile,
        hermes,
        metadata,
      }),
    );
  }

  for (const result of results) {
    console.log(
      `Created ${result.manifest.id} at ${path.relative(process.cwd(), result.directory)}`,
    );
  }
  return results;
}
