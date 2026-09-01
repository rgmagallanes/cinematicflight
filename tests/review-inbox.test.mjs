import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import { createReviewRecord, createReviewStore, parseDraftImport, transitionReview, TEST_ENQUIRY } from '../src/lib/reviewInbox.js';

const sample = {subject:'CF-AI-TEST-001',mailbox:'hello@cinematicflight.com',sourceUid:2,enquiryText:TEST_ENQUIRY,draftReply:'A fictional AI reply requiring owner review.',model:'nvidia/nemotron-3.5-lightning-30b-a3b',sentToClient:false,approvalRecorded:false,aiUsed:true};
const payload = JSON.stringify([sample]);
const at = '2026-08-31T09:00:00.000Z';
const make = () => createReviewRecord(parseDraftImport(payload), at);

test('imports only one designated unapproved test draft and excludes extra fields', () => {
  assert.equal(parseDraftImport(payload).sourceUid, 2);
  assert.throws(() => parseDraftImport(JSON.stringify({...sample, sourceUid: 3})));
  assert.equal(parseDraftImport(JSON.stringify({...sample,secret:'excluded',status:'approved'})).secret,undefined);
  for(const value of ['not JSON',JSON.stringify([]),JSON.stringify([sample,sample]),JSON.stringify({...sample,approvalRecorded:true}),JSON.stringify({...sample,sourceUid:'2'}),JSON.stringify({...sample,enquiryText:'real client data'}),JSON.stringify({...sample,draftReply:' '}),JSON.stringify({...sample,sentToClient:true})]) assert.throws(()=>parseDraftImport(value));
});
test('approval snapshots the exact saved revision and requires confirmation', () => {
  const record=make();
  for (const command of [{action:'approved',text:record.text},{action:'approved',text:'different',confirmed:true}]) assert.throws(()=>transitionReview(record,1,command));
  const approved=transitionReview(record,1,{action:'approved',text:record.text,confirmed:true},at);
  assert.equal(approved.status,'approved');
  assert.deepEqual(approved.approval,{revision:1,text:record.text,at,actor:'Local owner'});
  assert.equal(record.status,'pending');
  assert.equal(record.history.length,1);
});
test('edits invalidate current approval but preserve the approved snapshot', () => {
  const record=make();
  const approved=transitionReview(record,1,{action:'approved',text:record.text,confirmed:true},at);
  const edited=transitionReview(approved,2,{action:'edited',text:'An improved reply.'},at);
  assert.equal(edited.status,'pending');
  assert.equal(edited.revision,2);
  assert.equal(edited.approval,null);
  assert.equal(edited.originalText,record.text);
  assert.equal(edited.history[1].text,record.text);
  assert.equal(edited.history[1].action,'approved');
  assert.equal(edited.history[2].text,'An improved reply.');
});
test('reject and reopen record reasons without changing text or sending', () => {
  const record=make();
  assert.throws(()=>transitionReview(record,1,{action:'rejected',text:record.text,note:' '}));
  const rejected=transitionReview(record,1,{action:'rejected',text:record.text,note:'Claims compatibility without checking.'});
  assert.equal(rejected.status,'rejected');
  assert.equal(rejected.history.at(-1).note,'Claims compatibility without checking.');
  assert.throws(()=>transitionReview(rejected,2,{action:'approved',text:record.text,confirmed:true}));
  const reopened=transitionReview(rejected,2,{action:'reopened'});
  assert.equal(reopened.status,'pending');
  assert.equal(reopened.revision,1);
  assert.equal(reopened.text,record.text);
  assert.equal(reopened.approval,null);
});
test('stale versions, blank saves and unknown commands are rejected', () => {
  const record=make();
  assert.throws(()=>transitionReview(record,0,{action:'edited',text:'edit'}),/another tab/);
  assert.throws(()=>transitionReview(record,1,{action:'edited',text:record.text}),/no changes/);
  assert.throws(()=>transitionReview(record,1,{action:'edited',text:' '}));
  assert.throws(()=>transitionReview(record,1,{action:'sent'}),/Unknown/);
});
test('IndexedDB saves survive connection close/reopen; repeated import preserves decisions', async () => {
  const factory=new IDBFactory();
  let store=createReviewStore(factory,'persist');
  const {record}=await store.importDraft(payload);
  await store.change(record.id,1,{action:'approved',text:record.text,confirmed:true});
  await store.close();
  store=createReviewStore(factory,'persist');
  const saved=(await store.list())[0];
  assert.equal(saved.status,'approved');
  const duplicate=await store.importDraft(payload);
  assert.equal(duplicate.duplicate,true);
  assert.equal(duplicate.record.status,'approved');
  assert.equal(duplicate.record.version,2);
  await assert.rejects(store.importDraft(JSON.stringify({...sample,draftReply:'A replacement generation.'})),/cannot overwrite/);
  assert.equal((await store.list()).length,1);
  await store.close();
});
test('concurrent tab decisions serialize, and only one succeeds', async () => {
  const factory=new IDBFactory();
  const tabA=createReviewStore(factory,'tabs');
  const tabB=createReviewStore(factory,'tabs');
  const {record}=await tabA.importDraft(payload);
  const outcomes=await Promise.allSettled([
    tabA.change(record.id,1,{action:'approved',text:record.text,confirmed:true}),
    tabB.change(record.id,1,{action:'rejected',text:record.text,note:'Not ready.'}),
  ]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(outcomes.filter(r=>r.status==='rejected').length,1);
  const saved=(await tabA.list())[0];
  assert.equal(saved.version,2);
  assert.equal(saved.history.length,2);
  await tabA.close(); await tabB.close();
});
test('simultaneous duplicate imports create exactly one record', async () => {
  const factory=new IDBFactory();
  const a=createReviewStore(factory,'duplicates'), b=createReviewStore(factory,'duplicates');
  const result=await Promise.all([a.importDraft(payload),b.importDraft(payload)]);
  assert.equal(result.filter(r=>r.duplicate).length,1);
  assert.equal((await a.list()).length,1);
  await a.close(); await b.close();
});
test('storage unavailability is reported, never silently replaced by volatile state', async () => {
  await assert.rejects(createReviewStore(null).list(),/storage is unavailable/);
});
test('review UI is development and loopback gated, with no network/model/send calls', () => {
  const main=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
  assert.match(main,/import\.meta\.env\.DEV && \['localhost', '127\.0\.0\.1', '\[::1\]'\]/);
  assert.match(main,/pathname === '\/review-inbox'/);
  for(const path of ['../src/ReviewInbox.jsx','../src/lib/reviewInbox.js']) {
    const source=readFileSync(new URL(path,import.meta.url),'utf8');
    assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|dangerouslySetInnerHTML|localStorage/);
  }
});
