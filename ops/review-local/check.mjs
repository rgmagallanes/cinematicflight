import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServerReviewApi } from '../../src/lib/serverReviewApi.js';

// Auth/read-only smoke check of the real local browser proxy. No draft changes.
let cookie = '';
const client = createServerReviewApi(async (path, options) => {
  assert.ok(path.startsWith('/review-api/index.php?'));
  const response = await fetch(`http://127.0.0.1:5182${path}`, {
    ...options, headers: { ...options.headers, Origin: 'http://127.0.0.1:5182', ...(cookie ? { Cookie: cookie } : {}) },
  });
  for (const value of response.headers.getSetCookie()) {
    if (value.startsWith('cinematic_flight_studio=')) cookie = value.split(';')[0];
  }
  return response;
});
assert.equal((await client.session()).authenticated, false);
await assert.rejects(client.list(), error => error.status === 401);
await client.login('reviewer@example.test', 'Local-review-test-only-2026');
assert.equal((await client.session()).authenticated, true);
const queue = await client.list();
assert.ok(queue.data.length > 0);
const fixture = queue.data.find(row => row.inquiryId === 'local-review-fixture');
assert.ok(fixture, 'original fixture remains available');
const { record } = await client.get(fixture.id);
assert.equal(record.inquiryId, 'local-review-fixture');
assert.equal(record.source.messageId, '<local-review-fixture@example.test>');
assert.equal(record.sendingEnabled, false);
assert.equal(record.sentMailSyncEnabled, false);
assert.ok(record.history.length >= 1);
const digest = createHash('sha256').update(JSON.stringify(record)).digest('hex');
if (process.argv[2]) {
  const expected = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const imported = queue.data.find(row => row.inquiryId === expected.inquiryId);
  assert.ok(imported, 'designated import is saved');
  const actual = (await client.get(imported.id)).record;
  assert.equal(actual.originalText, expected.draftReply);
  assert.equal(actual.model, expected.model);
  for (const [key, value] of Object.entries(expected.source)) assert.equal(actual.source[key], value);
  assert.equal(actual.source.importMethod, 'n8n-local');
  assert.equal(actual.sendingEnabled, false);
  assert.equal(actual.sentMailSyncEnabled, false);
  console.log(`Exact imported draft and email link verified: record ${actual.id}, ${actual.status}, version ${actual.version}.`);
}
await client.logout();
await assert.rejects(client.get(record.id), error => error.status === 401);
console.log(`Local proxy sign-in, linked draft read and sign-out passed. Record ${record.id}, version ${record.version}, snapshot ${digest}. No draft was changed.`);
