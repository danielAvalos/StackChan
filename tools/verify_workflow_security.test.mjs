import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const workflowPath = path.join(root, '.github', 'workflows', 'upstream-sync.yml');

function readWorkflow() {
  return fs.readFileSync(workflowPath, 'utf8');
}

test('upstream sync keeps validation read-only and isolates publication authority', () => {
  const workflow = readWorkflow();
  const syncSection = workflow.match(/\n  sync:\n([\s\S]*?)\n  publish:\n/)?.[1];
  const publishSection = workflow.match(/\n  publish:\n([\s\S]*)$/)?.[1];

  assert.ok(syncSection, 'sync job section is present');
  assert.ok(publishSection, 'publish job section is present');
  assert.match(workflow, /^permissions:\n  contents: read\n/m);
  assert.match(workflow, /actions\/checkout@11d5960a326750d5838078e36cf38b85af6772625 # v4\.4\.0/);
  assert.match(workflow, /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4\.6\.2/);
  assert.match(workflow, /actions\/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4\.3\.0/);
  assert.doesNotMatch(workflow, /uses:\s+actions\/(checkout|upload-artifact|download-artifact)@v\d/);
  assert.doesNotMatch(syncSection, /contents:\s*write/);
  assert.doesNotMatch(syncSection, /pull-requests:\s*write/);
  assert.match(syncSection, /git bundle create/);
  assert.match(syncSection, /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4\.6\.2/);
  assert.match(publishSection, /needs: sync/);
  assert.match(publishSection, /persist-credentials: false/);
  assert.match(publishSection, /permissions:\n      contents: write\n      pull-requests: write/);
  assert.match(publishSection, /git bundle verify/);
  assert.match(publishSection, /git push origin "\$sync_sha:refs\/heads\/\$SYNC_BRANCH"/);
});
