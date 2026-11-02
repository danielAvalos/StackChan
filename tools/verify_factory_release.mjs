#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const SHA256 = /^[a-f0-9]{64}$/;
const HTTPS_URL = /^https:\/\/m5burner-cdn\.m5stack\.com\/firmware\/[a-f0-9]{32}\.bin$/;

function fail(message) {
  const error = new Error(message);
  error.code = 'FACTORY_RELEASE_INVALID';
  throw error;
}

function assertString(value, field) {
  if (typeof value !== 'string' || value.length === 0) fail(`${field} must be a non-empty string`);
}

async function sha256File(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolvePromise, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.once('error', reject);
    stream.once('end', resolvePromise);
  });
  return hash.digest('hex');
}

async function loadManifest(manifestPath) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(resolve(manifestPath), 'utf8'));
  } catch {
    fail('manifest is not valid JSON');
  }
  if (manifest?.schemaVersion !== 1 || manifest?.kind !== 'stackchan-official-firmware-artifacts') {
    fail('manifest schema or kind is unsupported');
  }
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) fail('artifacts must be non-empty');
  const seen = new Set();
  for (const [index, artifact] of manifest.artifacts.entries()) {
    const prefix = `artifacts[${index}]`;
    assertString(artifact?.version, `${prefix}.version`);
    if (seen.has(artifact.version)) fail(`${prefix}.version is duplicated`);
    seen.add(artifact.version);
    assertString(artifact.file, `${prefix}.file`);
    assertString(artifact.url, `${prefix}.url`);
    if (!HTTPS_URL.test(artifact.url)) fail(`${prefix}.url is not an approved HTTPS firmware URL`);
    if (basename(artifact.url) !== artifact.file) fail(`${prefix}.file does not match URL`);
    if (!Number.isSafeInteger(artifact.sizeBytes) || artifact.sizeBytes <= 0) fail(`${prefix}.sizeBytes is invalid`);
    if (!SHA256.test(artifact.sha256 ?? '')) fail(`${prefix}.sha256 must be lowercase SHA-256`);
    if (artifact.chip !== 'esp32s3' || artifact.flashSizeMB !== 16) fail(`${prefix}.target metadata is unsupported`);
  }
  return manifest;
}

export async function verifyFactoryRelease(manifestPath, version, firmwarePath) {
  assertString(version, 'version');
  assertString(firmwarePath, 'firmwarePath');
  const manifest = await loadManifest(manifestPath);
  const artifact = manifest.artifacts.find((candidate) => candidate.version === version);
  if (!artifact) fail(`firmware version is not present: ${version}`);

  const filePath = resolve(firmwarePath);
  let info;
  try {
    info = await lstat(filePath);
  } catch {
    fail('firmware file does not exist');
  }
  if (!info.isFile()) fail('firmware path must be a regular file');
  if (info.size !== artifact.sizeBytes) fail('firmware size does not match the manifest');
  const actualHash = await sha256File(filePath);
  if (actualHash !== artifact.sha256) fail('firmware SHA-256 does not match the manifest');
  return Object.freeze({
    status: 'pass', version, file: basename(filePath), sizeBytes: info.size, sha256: actualHash,
    target: Object.freeze({ chip: artifact.chip, flashSizeMB: artifact.flashSizeMB }),
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const [manifestPath, version, firmwarePath] = process.argv.slice(2);
  if (!manifestPath || !version || !firmwarePath || process.argv.length !== 5) {
    console.error('Usage: node tools/verify_factory_release.mjs MANIFEST VERSION FIRMWARE_FILE');
    process.exitCode = 2;
  } else {
    verifyFactoryRelease(manifestPath, version, firmwarePath)
      .then((result) => console.log(JSON.stringify(result)))
      .catch((error) => {
        console.error(`${error.code ?? 'FACTORY_RELEASE_INVALID'}: ${error.message}`);
        process.exitCode = 1;
      });
  }
}
