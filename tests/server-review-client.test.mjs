import test from 'node:test';
import assert from 'node:assert/strict';
import { createServerReviewApi } from '../src/lib/serverReviewApi.js';
import { readFileSync } from 'node:fs';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('server client uses only dedicated same-origin proxy and server CSRF', async () => {
  const calls=[];
  const api=createServerReviewApi(async (url, options) => { calls.push({url,options}); return json({csrfToken:'test-csrf',record:{id:1}}); });
  await api.session(); await api.change(1,4,{action:'approved',id:999,expectedVersion:999,text:'Exact text',confirmed:true,linkConfirmed:true});
  assert.equal(calls[0].url,'/review-api/index.php?action=session');
  const {options}=calls[1];
  assert.equal(options.credentials,'same-origin'); assert.equal(options.cache,'no-store');
  assert.equal(options.headers['X-CSRF-Token'],'test-csrf');
  assert.equal(JSON.parse(options.body).id,1); assert.equal(JSON.parse(options.body).expectedVersion,4);
  assert.equal(api.send,undefined); assert.equal(api.importDraft,undefined);
});
test('non-JSON, unavailable API and stale versions fail without fallback or retry', async () => {
  for (const response of [new Response('PHP unavailable'),json({error:'Changed'},409),json({error:'Unavailable'},503)]) {
    let calls=0;
    const api=createServerReviewApi(async()=>{calls++;return response;});
    await assert.rejects(api.list()); assert.equal(calls,1);
  }
});
test('authentication failure clears remembered CSRF token', async () => {
  const calls=[]; let count=0;
  const api=createServerReviewApi(async (url, options)=>{calls.push(options); count++; return count===1?json({csrfToken:'test'}):count===2?json({error:'Sign in'},401):json({});});
  await api.session(); await assert.rejects(api.get(1),e=>e.status===401);
  await api.change(1,1,{action:'reopened'});
  assert.equal(calls[2].headers['X-CSRF-Token'],'');
});
test('server review route and fixture initialization remain isolated', () => {
  const main=readFileSync('src/main.jsx','utf8');
  assert.match(main,/import\.meta\.env\.DEV && __LOCAL_REVIEW_SERVER__/);
  const config=readFileSync('vite.config.mjs','utf8');
  assert.match(config,/mode === 'review'/); assert.match(config,/127\.0\.0\.1:5183/);
  const compose=readFileSync('ops/review-local/compose.yaml','utf8');
  assert.match(compose,/127\.0\.0\.1:5183:8080/); assert.match(compose,/internal: true/);
  assert.match(compose,/cinematicflight_review_local_data/);
  const init=readFileSync('ops/review-local/init.php','utf8');
  assert.match(init,/if \(!\$lookup->fetchColumn\(\)\)/);
  const ui=readFileSync('src/ServerReviewInbox.jsx','utf8');
  assert.doesNotMatch(ui,/localStorage|indexedDB|importDraft|\.send\(/);
});
