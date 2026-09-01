import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const wf=JSON.parse(readFileSync(new URL('../workflows/hostinger-test-email-draft.json',import.meta.url),'utf8'));
const node=name=>wf.nodes.find(n=>n.name===name);
const sentence='This is a fictional test enquiry. We already have a property website. Can you add a cinematic experience without rebuilding everything?';
const match={subject:'CF-AI-TEST-001',uid:42,path:'INBOX',flags:[]};
function run(name,json,refs={}) {return vm.runInNewContext('(function(){'+node(name).parameters.jsCode+'})()',{$input:{first:()=>({json})},$:n=>({first:()=>({json:refs[n]})})})[0].json;}
test('only one exact test match can reach the body-fetch node',()=>{
  assert.equal(run('Require one exact test email',{data:[match],pagination:{total:1}}).uid,42);
  for (const input of [{data:[]},{data:[match,match]},{data:[match],pagination:{total:2}},{data:[{...match,subject:'Re: CF-AI-TEST-001'}]},{data:[{...match,path:'Trash'}]},{data:[{...match,uid:'../send'}]}]) assert.throws(()=>run('Require one exact test email',input));
});
test('only designated fictional sentences go to the model, not signatures or metadata',()=>{
  const prepared=run('Prepare approved test text',{data:{text:sentence+'\n\nRichard\nprivate@example.com',html:'private HTML'},from:'sender@example.com'});
  assert.equal(prepared.sentText,sentence);
  const sent=JSON.parse(prepared.requestBody.messages[1].content);
  assert.deepEqual(JSON.parse(JSON.stringify(sent)),{enquiryText:sentence});
  assert.equal(prepared.requestBody.max_tokens,700);
  assert.equal(prepared.requestBody.stream,false);
  assert.ok(!JSON.stringify(prepared).includes('private@example.com'));
});
test('unexpected or missing test text prevents model call',()=>{
  for(const input of [{},{data:{html:'only HTML'}},{data:{text:'a real unrelated enquiry'}},{data:{text:'x'.repeat(20001)}}]) assert.throws(()=>run('Prepare approved test text',input));
});
test('draft result remains unapproved and unsent',()=>{
  const refs={'Require one exact test email':match,'Prepare approved test text':{sentText:sentence}};
  const response={choices:[{finish_reason:'stop',message:{content:'A draft for your review.'}}],model:'test'};
  const output=run('Review unsent draft',response,refs);
  assert.equal(output.sentToClient,false);
  assert.equal(output.approvalRecorded,false);
  assert.equal(output.savedToStudio,false);
  assert.equal(output.mailboxWriteOperations,0);
  assert.equal(output.attachmentsRead,0);
  assert.throws(()=>run('Review unsent draft',{choices:[{finish_reason:'length',message:{content:'partial'}}]},refs));
});
test('graph contains only bounded search, text retrieval and model requests',()=>{
  const http=wf.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest');
  assert.equal(http.length,3);
  assert.equal(http[0].parameters.method,'POST');
  assert.ok(http[0].parameters.url.endsWith('/folders/INBOX/messages/search'));
  assert.deepEqual(JSON.parse(http[0].parameters.jsonBody),{subject:'CF-AI-TEST-001'});
  assert.equal(http[1].parameters.method,'GET');
  assert.ok(http[1].parameters.url.endsWith("+ '/text' }}"));
  assert.equal(http[2].parameters.url,'https://integrate.api.nvidia.com/v1/chat/completions');
  for(const h of http) {assert.equal(h.retryOnFail,false);assert.equal(h.parameters.options.redirect.redirect.followRedirects,false);}
  for(const n of wf.nodes) assert.equal(n.credentials,undefined);
  assert.equal(wf.active,false);
  assert.equal(wf.connections['Review unsent draft'],undefined);
  const names=wf.nodes.slice(1).map(n=>n.name);
  for(let i=0;i<names.length-1;i++) assert.equal(wf.connections[names[i]].main[0][0].node,names[i+1]);
});
