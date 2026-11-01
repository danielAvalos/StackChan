import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { verifyFactoryBackup } from './verify_factory_backup.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'stackchan-factory-backup-test-'));
  const files = {
    flash: Buffer.from('factory-flash-fixture'),
    sd: Buffer.from('micro-sd-fixture'),
    report: Buffer.from('Detected flash size: 16 MB\n'),
  };
  await writeFile(join(root, 'factory-flash.bin'), files.flash);
  await writeFile(join(root, 'microsd.img'), files.sd);
  await writeFile(join(root, 'flash-id.txt'), files.report);
  const manifest = {
    schemaVersion: 1,
    kind: 'stackchan-factory-preservation',
    device: { model: 'StackChan/CoreS3', factoryFirmwareVersion: '1.6.0' },
    artifacts: [
      { role: 'factory-flash', path: 'factory-flash.bin', sizeBytes: files.flash.length, sha256: digest(files.flash) },
      { role: 'microSD-image', path: 'microsd.img', sizeBytes: files.sd.length, sha256: digest(files.sd) },
      { role: 'esptool-report', path: 'flash-id.txt', sizeBytes: files.report.length, sha256: digest(files.report) },
    ],
  };
  await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
  return { root, manifest };
}

test('validates complete factory flash, microSD and esptool evidence', async () => {
  const { root } = await fixture();
  try {
    const result = await verifyFactoryBackup(root);
    assert.equal(result.status, 'pass');
    assert.equal(result.factoryFirmwareVersion, '1.6.0');
    assert.deepEqual(result.artifacts.map(({ role }) => role), ['factory-flash', 'microSD-image', 'esptool-report']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects a modified artifact even when the manifest file remains valid JSON', async () => {
  const { root } = await fixture();
  try {
    const tampered = Buffer.from(await readFile(join(root, 'factory-flash.bin')));
    tampered[0] ^= 0xff;
    await writeFile(join(root, 'factory-flash.bin'), tampered);
    await assert.rejects(verifyFactoryBackup(root), /SHA-256 does not match/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects traversal and symlink escape paths', async () => {
  const { root, manifest } = await fixture();
  const outside = await mkdtemp(join(tmpdir(), 'stackchan-factory-backup-outside-'));
  try {
    await writeFile(join(outside, 'outside.bin'), 'outside');
    manifest.artifacts[0].path = '../' + outside.split('/').pop() + '/outside.bin';
    await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
    await assert.rejects(verifyFactoryBackup(root), /unsafe path|escapes/);

    manifest.artifacts[0].path = 'linked.bin';
    manifest.artifacts[0].sizeBytes = 7;
    manifest.artifacts[0].sha256 = digest('outside');
    await symlink(join(outside, 'outside.bin'), join(root, 'linked.bin'));
    await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
    await assert.rejects(verifyFactoryBackup(root), /resolves outside/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
