import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const workflow = JSON.parse(readFileSync(new URL('../workflows/property-reading-demo.json', import.meta.url), 'utf8'));
const code = workflow.nodes.find(node => node.type === 'n8n-nodes-base.code').parameters.jsCode;
const fixture = Object.fromEntries(workflow.nodes.find(node => node.type === 'n8n-nodes-base.set').parameters.assignments.assignments.map(field => [field.name, field.value]));
const execute = (overrides = {}) => JSON.parse(JSON.stringify(runInNewContext(`(function () { ${code} })()`, {
  $input: { all: () => [{ json: { ...fixture, ...overrides } }] },
}, { timeout: 1000 })));

test('sample reading remains explicitly simulated and unsent', () => {
  const [{ json: result }] = execute();
  assert.match(result.draftReading, /SIMULATED DEMO/);
  assert.match(result.draftReading, /no photographs were opened/);
  assert.equal(result.aiUsed, false);
  assert.equal(result.apiCalls, 0);
  assert.equal(result.estimatedAiCostUsd, 0);
  assert.equal(result.imagesAnalysed, 0);
  assert.equal(result.approvalRecorded, false);
  assert.equal(result.savedToStudio, false);
  assert.equal(result.sentToClient, false);
  assert.equal(result.taskStatus, 'Awaiting owner review');
});

test('zero photos produces a missing-material draft', () => {
  const [{ json: result }] = execute({ photoCount: 0 });
  assert.equal(result.materialStatus, 'No photographs listed');
  assert.match(result.draftReply, /Please share/);
});

test('real data is rejected by the demo guard', () => {
  assert.throws(() => execute({ dataSource: 'production' }), /synthetic data only/);
});

test('missing name and invalid photo counts are rejected', () => {
  assert.throws(() => execute({ propertyName: ' ' }), /fictional property name/);
  for (const photoCount of [-1, 1.5, 51, 'not a number']) {
    assert.throws(() => execute({ photoCount }), /whole number/);
  }
});

test('workflow is inactive with only local manual-processing nodes', () => {
  assert.equal(workflow.active, false);
  const allowed = new Set(['stickyNote', 'manualTrigger', 'set', 'code', 'noOp'].map(type => `n8n-nodes-base.${type}`));
  for (const node of workflow.nodes) {
    assert.ok(allowed.has(node.type));
    assert.equal(node.credentials, undefined);
  }
  assert.doesNotMatch(code, /\b(fetch|require|import|httpRequest)\b/);
  assert.equal(workflow.connections['Review draft (stops here)'], undefined);
});
