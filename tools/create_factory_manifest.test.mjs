import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createFactoryManifest } from './create_factory_manifest.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'stackchan-manifest-test-'));
  const flash = Buffer.from('factory-flash');
  await writeFile(join(root, 'factory.bin'), flash);
  await writeFile(join(root, 'sd.img'), 'micro-sd');
  await writeFile(join(root, 'esptool.txt'), 'flash-id');
  await writeFile(join(root, 'rollback.json'), JSON.stringify({
    schemaVersion: 1, kind: 'stackchan-rollback-proof', status: 'verified',
    evidenceType: 'structural-attestation', method: 'official-restore-path',
    verifiedAt: '2026-11-01T00:00:00Z', factoryFirmwareVersion: '1.6.0',
    factoryFlashSha256: digest(flash),
  }));
  return root;
}

const options = (root) => ({
  backupDirectory: root, model: 'StackChan/CoreS3', factoryFirmwareVersion: '1.6.0',
  factoryFlashPath: 'factory.bin', microSdImagePath: 'sd.img',
  esptoolReportPath: 'esptool.txt', rollbackProofPath: 'rollback.json',
});

test('creates a bounded manifest from pre-existing evidence without device access', async () => {
  const root = await fixture();
  try {
    const manifest = await createFactoryManifest(options(root));
    assert.equal(manifest.kind, 'stackchan-factory-preservation');
    assert.equal(manifest.artifacts.length, 4);
    assert.deepEqual(JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8')), manifest);
    await assert.rejects(createFactoryManifest(options(root)), /already exists/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects a rollback proof that is not bound to the supplied flash', async () => {
  const root = await fixture();
  try {
    await writeFile(join(root, 'rollback.json'), JSON.stringify({
      schemaVersion: 1, kind: 'stackchan-rollback-proof', status: 'verified',
      evidenceType: 'structural-attestation', factoryFirmwareVersion: '1.6.0',
      factoryFlashSha256: digest('different-flash'),
    }));
    await assert.rejects(createFactoryManifest(options(root)), /does not bind/);
    assert.equal(await readFile(join(root, 'manifest.json'), 'utf8').catch(() => null), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

