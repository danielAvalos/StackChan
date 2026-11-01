#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';

const REQUIRED_ROLES = new Set(['factory-flash', 'microSD-image', 'esptool-report', 'rollback-proof']);
const SHA256 = /^[a-f0-9]{64}$/;

function fail(message) {
  const error = new Error(message);
  error.code = 'FACTORY_BACKUP_INVALID';
  throw error;
}

function assertString(value, field) {
  if (typeof value !== 'string' || value.length === 0) fail(`${field} must be a non-empty string`);
}

function assertSafeRelativePath(value, field) {
  assertString(value, field);
  if (isAbsolute(value) || value.includes('\0')) fail(`${field} must be relative`);
  const normalized = value.replaceAll('\\', '/');
  const parts = normalized.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) fail(`${field} contains an unsafe path`);
}

async function resolveBackupFile(root, relativePath, field) {
  assertSafeRelativePath(relativePath, field);
  const rootPath = resolve(root);
  const candidate = resolve(rootPath, relativePath);
  if (relative(rootPath, candidate).startsWith('..')) fail(`${field} escapes the backup directory`);
  let rootReal;
  let candidateReal;
  try {
    [rootReal, candidateReal] = await Promise.all([realpath(rootPath), realpath(candidate)]);
  } catch {
    fail(`${field} does not exist`);
  }
  if (candidateReal !== rootReal && !candidateReal.startsWith(`${rootReal}/`)) {
    fail(`${field} resolves outside the backup directory`);
  }
  const info = await lstat(candidateReal);
  if (!info.isFile()) fail(`${field} must point to a regular file`);
  return candidateReal;
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

export async function verifyFactoryBackup(backupDirectory) {
  assertString(backupDirectory, 'backupDirectory');
  const root = resolve(backupDirectory);
  const manifestPath = await resolveBackupFile(root, 'manifest.json', 'manifest');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    fail('manifest is not valid JSON');
  }
  if (manifest?.schemaVersion !== 1 || manifest?.kind !== 'stackchan-factory-preservation') {
    fail('manifest schema or kind is unsupported');
  }
  assertString(manifest.device?.model, 'device.model');
  assertString(manifest.device?.factoryFirmwareVersion, 'device.factoryFirmwareVersion');
  if (!Array.isArray(manifest.artifacts)) fail('artifacts must be an array');

  const seenRoles = new Set();
  const checked = [];
  for (const [index, artifact] of manifest.artifacts.entries()) {
    const prefix = `artifacts[${index}]`;
    assertString(artifact?.role, `${prefix}.role`);
    if (seenRoles.has(artifact.role)) fail(`${prefix}.role is duplicated`);
    seenRoles.add(artifact.role);
    assertString(artifact.path, `${prefix}.path`);
    if (!SHA256.test(artifact.sha256 ?? '')) fail(`${prefix}.sha256 must be lowercase SHA-256`);
    if (!Number.isSafeInteger(artifact.sizeBytes) || artifact.sizeBytes <= 0) fail(`${prefix}.sizeBytes is invalid`);
    const filePath = await resolveBackupFile(root, artifact.path, `${prefix}.path`);
    const info = await lstat(filePath);
    if (info.size !== artifact.sizeBytes) fail(`${prefix} size does not match the manifest`);
    const actualHash = await sha256File(filePath);
    if (actualHash !== artifact.sha256) fail(`${prefix} SHA-256 does not match the manifest`);
    checked.push({ role: artifact.role, file: basename(filePath), sizeBytes: info.size, sha256: actualHash });
  }
  for (const role of REQUIRED_ROLES) if (!seenRoles.has(role)) fail(`required artifact is missing: ${role}`);

  const factoryFlash = manifest.artifacts.find((artifact) => artifact.role === 'factory-flash');
  const rollbackArtifact = manifest.artifacts.find((artifact) => artifact.role === 'rollback-proof');
  let rollbackProof;
  try {
    const rollbackPath = await resolveBackupFile(root, rollbackArtifact.path, 'rollback-proof.path');
    rollbackProof = JSON.parse(await readFile(rollbackPath, 'utf8'));
  } catch {
    fail('rollback-proof must be valid JSON');
  }
  if (
    rollbackProof?.schemaVersion !== 1
    || rollbackProof?.kind !== 'stackchan-rollback-proof'
    || rollbackProof?.status !== 'verified'
  ) {
    fail('rollback-proof schema or status is unsupported');
  }
  assertString(rollbackProof.method, 'rollback-proof.method');
  assertString(rollbackProof.verifiedAt, 'rollback-proof.verifiedAt');
  if (!SHA256.test(rollbackProof.factoryFlashSha256 ?? '') || rollbackProof.factoryFlashSha256 !== factoryFlash.sha256) {
    fail('rollback-proof must bind to the verified factory-flash SHA-256');
  }
  if (rollbackProof.factoryFirmwareVersion !== manifest.device.factoryFirmwareVersion) {
    fail('rollback-proof firmware version does not match the manifest');
  }
  return Object.freeze({
    status: 'pass', schemaVersion: manifest.schemaVersion, kind: manifest.kind,
    model: manifest.device.model, factoryFirmwareVersion: manifest.device.factoryFirmwareVersion,
    artifacts: Object.freeze(checked.map((artifact) => Object.freeze(artifact))),
    rollbackProof: Object.freeze({
      status: rollbackProof.status,
      method: rollbackProof.method,
      verifiedAt: rollbackProof.verifiedAt,
    }),
  });
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const directory = process.argv[2];
  if (!directory || process.argv.length !== 3) {
    console.error('Usage: node tools/verify_factory_backup.mjs BACKUP_DIRECTORY');
    process.exitCode = 2;
  } else {
    verifyFactoryBackup(directory)
      .then((result) => console.log(JSON.stringify(result)))
      .catch((error) => {
        console.error(`${error.code ?? 'FACTORY_BACKUP_INVALID'}: ${error.message}`);
        process.exitCode = 1;
      });
  }
}
