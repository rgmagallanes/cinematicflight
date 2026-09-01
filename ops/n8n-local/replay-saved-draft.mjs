import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {bridgeId} from './review-bridge.mjs';
// One-off delivery of an already-generated execution export. No email/model nodes.
// The server's exact designation remains authoritative; no approval is imported.
const file=process.argv[2];
if(!file) throw new Error('Provide a private JSON file containing the approved import envelope.');
const payload=JSON.parse(await readFile(file,'utf8'));
if(payload.inquiryId!=='local-n8n-test-005'||payload.sentToClient!==false||payload.approvalRecorded!==false) throw new Error('Only the designated pending test payload is allowed.');
const docker='/Applications/Docker.app/Contents/Resources/bin/docker';
function run(args,input) {const r=spawnSync(docker,args,{input,encoding:'utf8',maxBuffer:4*1024*1024});if(r.status!==0)throw new Error('Local replay command failed: '+r.stderr.slice(-1200));return r.stdout;}
const bridge=JSON.parse(run(['exec','cinematicflight-n8n','n8n','export:workflow','--id='+bridgeId]))[0];
const send=structuredClone(bridge.nodes.find(n=>n.name==='Save to local review inbox'));
if(send.parameters.url!=='http://host.docker.internal:5183/local-ingest') throw new Error('Unexpected import destination.');
send.parameters.jsonBody=JSON.stringify(payload);
const workflow={id:'CfLocalReviewSaved005',name:'Cinematic Flight — Saved UID 5 draft to local review (no AI)',active:false,settings:{executionOrder:'v1',executionTimeout:30},nodes:[{id:'saved-start',name:'Start manually',type:'n8n-nodes-base.manualTrigger',typeVersion:1,position:[0,80],parameters:{}},send],connections:{'Start manually':{main:[[{node:send.name,type:'main',index:0}]]}},pinData:{}};
const dir=run(['exec','cinematicflight-n8n','mktemp','-d','/tmp/cf-review-replay-XXXXXX']).trim();
if(!/^\/tmp\/cf-review-replay-[\w]+$/.test(dir))throw new Error('Unexpected temporary path.');
try {
 const path=dir+'/workflow.json';
 run(['exec','-i','cinematicflight-n8n','node','-e','const fs=require("fs");let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>fs.writeFileSync(process.argv[1],s,{mode:0o600}));',path],JSON.stringify([workflow]));
 const project=bridge.shared?.find(s=>s.role==='workflow:owner')?.projectId;
 if(!project)throw new Error('Missing owner project.');
 run(['exec','cinematicflight-n8n','n8n','import:workflow','--input='+path,'--projectId='+project]);
 const output=run(['exec','-e','N8N_RUNNERS_BROKER_PORT=5689','cinematicflight-n8n','n8n','execute','--id='+workflow.id,'--rawOutput']);
 const start=output.indexOf('{');
 const result=JSON.parse(output.slice(start,output.lastIndexOf('}')+1));
 const receipt=result.data?.resultData?.runData?.[send.name]?.at(-1)?.data?.main?.[0]?.[0]?.json;
 if(!receipt?.savedToLocalReview || receipt.sendingEnabled!==false) throw new Error('Import receipt not found. Inspect n8n execution before retrying.');
 console.log(JSON.stringify(receipt));
} finally {
 run(['exec','cinematicflight-n8n','node','-e','const fs=require("fs");const p=process.argv[1]+"/workflow.json";if(fs.existsSync(p))fs.unlinkSync(p);fs.rmdirSync(process.argv[1]);',dir]);
}
