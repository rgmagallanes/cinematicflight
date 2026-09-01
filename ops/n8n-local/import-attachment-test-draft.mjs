import {execFileSync} from 'node:child_process';

const docker='/Applications/Docker.app/Contents/Resources/bin/docker',container='cinematicflight-n8n';
const run=(args,input)=>execFileSync(docker,args,{encoding:'utf8',input,maxBuffer:20_000_000});
const saved=JSON.parse(run(['exec',container,'n8n','export:workflow','--id=CfHostingerReviewLocal001']))[0];
const host=saved.nodes.find(n=>n.name==='Find designated test subject')?.credentials?.httpBearerAuth;
const local=saved.nodes.find(n=>n.name==='Save to local review inbox')?.credentials?.httpBearerAuth;
const project=saved.shared?.find(s=>s.role==='workflow:owner')?.projectId;
if(!host?.id||!local?.id||!project)throw new Error('Required credential references or owner project are missing.');
const id='CfImportAttachmentDraft006V2';
let workflow;
try {workflow=JSON.parse(run(['exec',container,'n8n','export:workflow','--id='+id]))[0];}
catch {
 const expected='Please check the attached image and tell me what you think.';
 const reply='Thank you for sharing the images. They have been received for owner review, but no photographic assessment has been completed yet. We will inspect the available views and then identify what appears suitable for a cinematic property experience, along with any important views that may still be missing. Nothing has been approved or sent from this review workspace.';
 workflow={id,name:'Cinematic Flight — Import UID 6 attachment test draft (no AI)',active:false,pinData:{},settings:{executionOrder:'v1',executionTimeout:60,saveManualExecutions:true},nodes:[
  {id:'import-note',name:'Fixed UID 6 only',type:'n8n-nodes-base.stickyNote',typeVersion:1,position:[0,-220],parameters:{width:760,height:190,content:'## Import the designated UID 6 attachment test — no AI\nReads only its exact plain text, then imports a factual acknowledgement as a new pending record.\n\nNo model call, file download, send, mailbox write, approval, webhook or schedule.'}},
  {id:'import-start',name:'Start manually',type:'n8n-nodes-base.manualTrigger',typeVersion:1,position:[0,80],parameters:{}},
  {id:'import-text',name:'Read designated UID 6 text',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[250,80],retryOnFail:false,onError:'stopWorkflow',parameters:{url:'https://api.mail.hostinger.com/api/v1/mailboxes/AC8400350301066fb9ff62506d23b2/folders/INBOX/messages/6/text',authentication:'genericCredentialType',genericAuthType:'httpBearerAuth',options:{timeout:20000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'json'}}}},credentials:{httpBearerAuth:host}},
  {id:'import-envelope',name:'Verify fictional text and prepare pending record',type:'n8n-nodes-base.code',typeVersion:2,position:[520,80],parameters:{jsCode:`const raw=$input.first().json.data?.text;
const expected=${JSON.stringify(expected)};
if(typeof raw!=='string'||raw.length>20000||!raw.replace(/\\s+/g,' ').includes(expected))throw new Error('UID 6 does not contain the designated fictional test text. Nothing imported.');
return [{json:{inquiryId:'local-n8n-attachment-006',draftReply:${JSON.stringify(reply)},model:'fixed attachment-test acknowledgement — no AI call',sentToClient:false,approvalRecorded:false,source:{mailbox:'hello@cinematicflight.com',folder:'INBOX',uid:6,uidValidity:null,messageId:'<541F0970-249C-4C90-967E-CFA9BEBF4B66@chardee.dev>',from:'me@chardee.dev',replyTo:'me@chardee.dev',subject:'CF-AI-TEST-001',enquiryText:expected}}}];`}},
  {id:'import-save',name:'Save UID 6 pending record',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[790,80],retryOnFail:false,onError:'stopWorkflow',parameters:{method:'POST',url:'http://host.docker.internal:5183/local-ingest',authentication:'genericCredentialType',genericAuthType:'httpBearerAuth',sendBody:true,specifyBody:'json',jsonBody:'={{ $json }}',options:{timeout:15000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'json'}}}},credentials:{httpBearerAuth:local}},
 ],connections:{'Start manually':{main:[[{node:'Read designated UID 6 text',type:'main',index:0}]]},'Read designated UID 6 text':{main:[[{node:'Verify fictional text and prepare pending record',type:'main',index:0}]]},'Verify fictional text and prepare pending record':{main:[[{node:'Save UID 6 pending record',type:'main',index:0}]]}}};
 const dir='/tmp/cf-import-uid6-'+process.pid,path=dir+'/workflow.json';run(['exec',container,'mkdir','-m','700',dir]);
 try {run(['exec','-i',container,'node','-e','const fs=require("fs");let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>fs.writeFileSync(process.argv[1],s,{mode:0o600}));',path],JSON.stringify([workflow]));run(['exec',container,'n8n','import:workflow','--input='+path,'--projectId='+project]);}
 finally {run(['exec',container,'node','-e','require("fs").rmSync(process.argv[1],{recursive:true,force:true});',dir]);}
}
const output=run(['exec','-e','N8N_RUNNERS_BROKER_PORT=5689',container,'n8n','execute','--id='+id,'--rawOutput']);
const start=output.indexOf('{'),result=JSON.parse(output.slice(start,output.lastIndexOf('}')+1));
const receipt=result.data?.resultData?.runData?.['Save UID 6 pending record']?.at(-1)?.data?.main?.[0]?.[0]?.json;
if(!receipt?.savedToLocalReview||receipt.sendingEnabled!==false)throw new Error(result.data?.resultData?.error?.message||'UID 6 import failed.');
process.stdout.write(JSON.stringify(receipt)+'\n');
