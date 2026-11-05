import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

const CONTENT_TYPES = new Map([
  ['.bundle', 'application/octet-stream'],
  ['.jsbundle', 'application/octet-stream'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.ttf', 'font/ttf'],
  ['.otf', 'font/otf'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.mp3', 'audio/mpeg'],
  ['.mp4', 'video/mp4'],
  ['.json', 'application/json'],
  ['.xml', 'application/xml'],
]);

export function contentTypeFor(filePath) {
  return CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
}

export async function sha256File(filePath) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(filePath), hash);
  return `sha256:${hash.digest('hex')}`;
}

export async function describeFile(root, filePath, relativePath = path.relative(root, filePath)) {
  const normalized = relativePath.split(path.sep).join('/');
  const metadata = await stat(filePath);
  return {
    path: normalized,
    hash: await sha256File(filePath),
    size: metadata.size,
    contentType: contentTypeFor(normalized),
  };
}

export async function walkFiles(root) {
  const files = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(filePath);
      } else if (entry.isFile()) {
        files.push(filePath);
      }
    }
  }

  await visit(root);
  return files;
}
