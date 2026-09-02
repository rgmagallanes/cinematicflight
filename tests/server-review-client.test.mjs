import test from 'node:test';
import assert from 'node:assert/strict';
import { createServerReviewApi } from '../src/lib/serverReviewApi.js';
import { clearOwnerReviewWork } from '../src/lib/reviewWorkStore.js';
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
test('production review client uses only the same-origin Studio PHP API', async () => {
  const calls=[];
  const api=createServerReviewApi(async (url,options)=>{calls.push({url,options});return json({authenticated:true});},'/api/index.php');
  await api.session();
  assert.equal(calls[0].url,'/api/index.php?action=session');
  assert.equal(calls[0].options.credentials,'same-origin');
  assert.equal(api.send,undefined);
});
test('discarding review work clears only the signed-in owner recovery copies', () => {
  const store={current:{'1:10':{text:'Owner A'},'1:11':{text:'Owner A second'},'2:20':{text:'Owner B'}}};
  clearOwnerReviewWork(store,2);
  assert.deepEqual(store.current,{'1:10':{text:'Owner A'},'1:11':{text:'Owner A second'}});
  clearOwnerReviewWork(store,1);
  assert.deepEqual(store.current,{});
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
  assert.match(config,/mode === ["']review["']/); assert.match(config,/127\.0\.0\.1:5183/);
  const compose=readFileSync('ops/review-local/compose.yaml','utf8');
  assert.match(compose,/127\.0\.0\.1:5183:8080/); assert.match(compose,/internal: true/);
  assert.match(compose,/cinematicflight_review_local_data/);
  const init=readFileSync('ops/review-local/init.php','utf8');
  assert.match(init,/if \(!\$lookup->fetchColumn\(\)\)/);
  const ui=readFileSync('src/ServerReviewInbox.jsx','utf8');
  assert.doesNotMatch(ui,/localStorage|indexedDB|importDraft|\.send\(/);
  const dashboard=readFileSync('src/SalesDashboard.jsx','utf8');
  assert.match(dashboard,/cloudUser \? \[\.\.\.navItems, reviewNavItem\] : navItems/);
  assert.match(dashboard,/window\.location\.pathname === '\/review-inbox'/);
  assert.match(dashboard,/You have unsaved review work\. Discard it and leave the Review Inbox\?/);
  assert.match(dashboard,/clearOwnerReviewWork\(reviewWorkStore, cloudUser\?\.id\)/);
  const entry=readFileSync('src/StudioEntry.jsx','utf8');
  assert.match(entry,/reviewWorkStore = useRef\(\{\}\)/);
  assert.match(entry,/onSessionExpired=\{\(\) => setUser\(null\)\}/);
});
