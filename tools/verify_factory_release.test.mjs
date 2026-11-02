import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { verifyFactoryRelease } from './verify_factory_release.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'stackchan-factory-release-test-'));
  const bytes = Buffer.from('firmware-fixture');
  const file = '0123456789abcdef0123456789abcdef.bin';
  const manifest = {
    schemaVersion: 1,
    kind: 'stackchan-official-firmware-artifacts',
    product: 'StackChan-UserDemo',
    artifacts: [{
      version: '1.6.0', publishedAt: '2026-10-29', file,
      url: `https://m5burner-cdn.m5stack.com/firmware/${file}`,
      sizeBytes: bytes.length, sha256: hash(bytes), chip: 'esp32s3', flashSizeMB: 16,
    }],
  };
  await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
  await writeFile(join(root, file), bytes);
  return { root, manifest, file };
}

test('verifies the pinned artifact by version, size and SHA-256', async () => {
  const { root, file } = await fixture();
  try {
    const result = await verifyFactoryRelease(join(root, 'manifest.json'), '1.6.0', join(root, file));
    assert.deepEqual(result, {
      status: 'pass', version: '1.6.0', file, sizeBytes: 16, sha256: hash('firmware-fixture'),
      target: { chip: 'esp32s3', flashSizeMB: 16 },
    });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('rejects a tampered firmware file', async () => {
  const { root, file } = await fixture();
  try {
    await writeFile(join(root, file), 'tampered');
    await assert.rejects(verifyFactoryRelease(join(root, 'manifest.json'), '1.6.0', join(root, file)), /size does not match/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('rejects an unapproved URL or target metadata', async () => {
  const { root, manifest } = await fixture();
  try {
    manifest.artifacts[0].url = 'http://example.test/fixture.bin';
    await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest));
    await assert.rejects(verifyFactoryRelease(join(root, 'manifest.json'), '1.6.0', join(root, manifest.artifacts[0].file)), /approved HTTPS/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
