import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const wf = JSON.parse(readFileSync(new URL('../workflows/hostinger-connection-check.json', import.meta.url), 'utf8'));
const code = wf.nodes.find(n => n.type === 'n8n-nodes-base.code').parameters.jsCode;
const run = json => vm.runInNewContext('(function(){' + code + '})()', {$input: {first: () => ({json})}})[0].json;
test('exact mailbox metadata is accepted with no message actions', () => {
  const result = run({data:{mailboxes:[{address:'hello@cinematicflight.com',resourceId:'test-only'}]}});
  assert.equal(result.connectionVerified, true);
  for (const key of ['emailsRead','messagesSent','mailboxChanges','aiCalls']) assert.equal(result[key],0);
});
test('unexpected scopes or response shapes fail closed', () => {
  for (const json of [{}, {data:{mailboxes:[]}}, {data:{mailboxes:[{address:'other@example.com',resourceId:'x'}]}}, {data:{mailboxes:[{address:'hello@cinematicflight.com',resourceId:'x'},{address:'other@example.com',resourceId:'y'}]}}, {data:{mailboxes:[{address:'hello@cinematicflight.com'}]}}]) assert.throws(()=>run(json));
});
test('network node is fixed GET account metadata with no redirects or retries', () => {
  const requests = wf.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest');
  assert.equal(requests.length,1);
  const n=requests[0];
  assert.equal(n.parameters.method,'GET');
  assert.equal(n.parameters.url,'https://api.mail.hostinger.com/api/v1/me');
  assert.equal(n.parameters.options.redirect.redirect.followRedirects,false);
  assert.equal(n.retryOnFail,false);
  assert.equal(wf.active,false);
  assert.equal(wf.connections['Connection result - stops here'],undefined);
  for (const item of wf.nodes) assert.equal(item.credentials,undefined);
});
