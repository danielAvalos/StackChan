#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve } from 'node:path';

const SHA256 = /^[a-f0-9]{64}$/;
const ROLES = Object.freeze(['factory-flash', 'microSD-image', 'esptool-report', 'rollback-proof']);

function fail(message) {
  const error = new Error(message);
  error.code = 'FACTORY_MANIFEST_INVALID';
  throw error;
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.length === 0) fail(`${field} must be a non-empty string`);
  return value;
}

function safeRelativePath(value, field) {
  requiredString(value, field);
  if (isAbsolute(value) || value.includes('\0')) fail(`${field} must be relative`);
  const parts = value.replaceAll('\\', '/').split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) fail(`${field} contains an unsafe path`);
  return value;
}

async function artifactInfo(root, path, role) {
  const safePath = safeRelativePath(path, `${role}.path`);
  const rootPath = resolve(root);
  const candidate = resolve(rootPath, safePath);
  if (relative(rootPath, candidate).startsWith('..')) fail(`${role}.path escapes the backup directory`);
  let rootReal;
  let candidateReal;
  try {
    [rootReal, candidateReal] = await Promise.all([realpath(rootPath), realpath(candidate)]);
  } catch {
    fail(`${role}.path does not exist`);
  }
  if (candidateReal !== rootReal && !candidateReal.startsWith(`${rootReal}/`)) fail(`${role}.path resolves outside the backup directory`);
  const info = await lstat(candidateReal);
  if (!info.isFile()) fail(`${role}.path must point to a regular file`);
  const hash = createHash('sha256');
  await new Promise((resolvePromise, reject) => {
    const stream = createReadStream(candidateReal);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.once('error', reject);
    stream.once('end', resolvePromise);
  });
  return { role, path: safePath, sizeBytes: info.size, sha256: hash.digest('hex') };
}

export async function createFactoryManifest({
  backupDirectory,
  model,
  factoryFirmwareVersion,
  factoryFlashPath,
  microSdImagePath,
  esptoolReportPath,
  rollbackProofPath,
}) {
  const root = resolve(requiredString(backupDirectory, 'backupDirectory'));
  requiredString(model, 'device.model');
  requiredString(factoryFirmwareVersion, 'device.factoryFirmwareVersion');
  const paths = { 'factory-flash': factoryFlashPath, 'microSD-image': microSdImagePath,
    'esptool-report': esptoolReportPath, 'rollback-proof': rollbackProofPath };
  const artifacts = [];
  for (const role of ROLES) artifacts.push(await artifactInfo(root, paths[role], role));

  const rollbackPath = resolve(root, rollbackProofPath);
  let rollbackProof;
  try {
    rollbackProof = JSON.parse(await readFile(rollbackPath, 'utf8'));
  } catch {
    fail('rollback-proof must be valid JSON');
  }
  const factoryFlash = artifacts.find(({ role }) => role === 'factory-flash');
  if (rollbackProof?.schemaVersion !== 1
    || rollbackProof?.kind !== 'stackchan-rollback-proof'
    || rollbackProof?.status !== 'verified'
    || rollbackProof?.evidenceType !== 'structural-attestation'
    || rollbackProof.factoryFirmwareVersion !== factoryFirmwareVersion
    || rollbackProof.factoryFlashSha256 !== factoryFlash.sha256
    || !SHA256.test(rollbackProof.factoryFlashSha256 ?? '')) {
    fail('rollback-proof does not bind to the supplied factory flash and firmware version');
  }

  const manifest = {
    schemaVersion: 1,
    kind: 'stackchan-factory-preservation',
    device: { model, factoryFirmwareVersion },
    artifacts,
  };
  const manifestPath = resolve(root, 'manifest.json');
  try {
    await lstat(manifestPath);
    fail('manifest.json already exists; refusing to overwrite it');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return manifest;
}

function parseArguments(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith('--') || value === undefined || value.startsWith('--')) fail('arguments must be --key value pairs');
    values[key.slice(2)] = value;
  }
  const required = ['backup-directory', 'model', 'factory-firmware-version', 'factory-flash', 'micro-sd-image', 'esptool-report', 'rollback-proof'];
  for (const key of required) requiredString(values[key], `--${key}`);
  return values;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    const values = parseArguments(process.argv.slice(2));
    const manifest = await createFactoryManifest({
      backupDirectory: values['backup-directory'], model: values.model,
      factoryFirmwareVersion: values['factory-firmware-version'],
      factoryFlashPath: values['factory-flash'], microSdImagePath: values['micro-sd-image'],
      esptoolReportPath: values['esptool-report'], rollbackProofPath: values['rollback-proof'],
    });
    console.log(JSON.stringify({ status: 'created', manifest: manifest.kind, path: `${values['backup-directory']}/manifest.json` }));
  } catch (error) {
    console.error(`${error.code ?? 'FACTORY_MANIFEST_INVALID'}: ${error.message}`);
    process.exitCode = 1;
  }
}
