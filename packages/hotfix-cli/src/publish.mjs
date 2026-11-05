import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { validateManifest } from 'react-native-hotfix-protocol';

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }
  if (!response.ok) {
    throw new Error(
      `${options.method || 'GET'} ${url} failed (${response.status}): ${
        body?.error?.message || body?.message || response.statusText
      }`,
    );
  }
  return body;
}

export async function publishUpdate({
  server,
  token,
  inputDir,
  rolloutPercent = 100,
}) {
  const root = path.resolve(inputDir);
  const manifest = validateManifest(
    JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8')),
  );
  const serverUrl = server.replace(/\/$/, '');
  const headers = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };

  console.log(`Creating upload for ${manifest.id}...`);
  const upload = await requestJson(`${serverUrl}/v1/admin/updates`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ manifest, rolloutPercent }),
  });

  const descriptors = [manifest.launchAsset, ...manifest.assets];
  for (let index = 0; index < descriptors.length; index += 1) {
    const descriptor = descriptors[index];
    const filePath = path.join(root, ...descriptor.path.split('/'));
    const data = await readFile(filePath);
    console.log(
      `Uploading ${descriptor.path} (${index + 1}/${descriptors.length}, ${descriptor.size} bytes)...`,
    );
    await requestJson(
      `${serverUrl}/v1/admin/updates/${upload.uploadId}/files?path=${encodeURIComponent(
        descriptor.path,
      )}`,
      {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': descriptor.contentType,
          'content-length': String(data.length),
        },
        body: data,
      },
    );
  }

  const result = await requestJson(
    `${serverUrl}/v1/admin/updates/${upload.uploadId}/commit`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
  );
  console.log(
    `Published ${result.updateId} with key ${result.keyId} at ${result.rolloutPercent}% rollout.`,
  );
  return result;
}

export async function activateUpdate({
  server,
  token,
  channel,
  platform,
  runtimeVersion,
  updateId,
  rolloutPercent = 100,
}) {
  const serverUrl = server.replace(/\/$/, '');
  return requestJson(`${serverUrl}/v1/admin/channels/activate`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      channel,
      platform,
      runtimeVersion,
      updateId,
      rolloutPercent,
    }),
  });
}
