import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildReviewBridge,prepareImportCode} from '../review-bridge.mjs';
const original=JSON.parse(await readFile(new URL('../workflows/hostinger-test-email-draft.json',import.meta.url),'utf8'));
const source={uid:5,path:'INBOX',subject:'CF-AI-TEST-001',messageId:'<BAE4E5A8-D026-45A2-A51F-974B6C13648D@chardee.dev>',from:{address:'me@chardee.dev'},to:[{address:'hello@cinematicflight.com'}]};
const draft={sourceUid:5,subject:source.subject,mailbox:'hello@cinematicflight.com',enquiryText:'s is a fictional test enquiry. We already have a property website. Can you add a cinematic experience without rebuilding everything? 12',draftReply:'A test draft, not an AI call.',model:'fixture',approvalRecorded:false,sentToClient:false,aiUsed:true};
function prepare(d=draft,m=source,extra=[]) {return new Function('$input','$',prepareImportCode)({first:()=>({json:d})},name=>({first:()=>({json:name==='Require one exact test email'?{...m}: {data:[m,...extra]}})}))[0].json;}
test('clone preserves original and model configuration; new route is manual and local',()=>{
 const before=JSON.stringify(original),w=buildReviewBridge(original);
 assert.equal(JSON.stringify(original),before);assert.equal(w.active,false);assert.deepEqual(w.pinData,{});
 assert.deepEqual(w.nodes.find(n=>n.name==='Nemotron - draft only'),original.nodes.find(n=>n.name==='Nemotron - draft only'));
 const http=w.nodes.at(-1);assert.equal(http.parameters.url,'http://host.docker.internal:5183/local-ingest');assert.equal(http.retryOnFail,false);assert.equal(http.parameters.options.redirect.redirect.followRedirects,false);
 assert.equal(w.nodes.filter(n=>n.type.includes('Trigger')).length,1);
});
test('builds exact pending envelope without inventing UIDVALIDITY',()=>{const p=prepare();assert.equal(p.source.uidValidity,null);assert.equal(p.source.messageId,source.messageId);assert.equal(p.draftReply,draft.draftReply);assert.equal(p.approvalRecorded,false);});
test('rejects sender, uid, message identity, subject, recipient and body substitution',()=>{
 for(const m of [{...source,uid:4},{...source,from:{address:'other@example.test'}},{...source,messageId:'<other@example.test>'},{...source,subject:'other'},{...source,to:[]}]) assert.throws(()=>prepare(draft,m));
 for(const d of [{...draft,enquiryText:'A customer enquiry'},{...draft,sourceUid:2},{...draft,sentToClient:true},{...draft,approvalRecorded:true},{...draft,draftReply:''}]) assert.throws(()=>prepare(d));
 assert.throws(()=>prepare(draft,source,[source]));
});
