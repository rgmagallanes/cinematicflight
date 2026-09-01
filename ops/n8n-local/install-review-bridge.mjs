import {spawnSync} from 'node:child_process';
import {buildReviewBridge,credentialId,bridgeId} from './review-bridge.mjs';

// Docker operations only. Secrets stay in process memory and short-lived container
// files; never print/export provider credentials or alter the original workflow.
const docker='/Applications/Docker.app/Contents/Resources/bin/docker';
function run(args,input) {
  const r=spawnSync(docker,args,{input,encoding:'utf8',maxBuffer:4*1024*1024});
  if(r.status!==0) throw new Error('Docker operation failed: '+args.slice(0,4).join(' '));
  return r.stdout;
}
const original=JSON.parse(run(['exec','cinematicflight-n8n','n8n','export:workflow','--id=CfHostingerDraftTest001']))[0];
const projectId=original.shared?.find(s=>s.role==='workflow:owner')?.projectId;
if(!projectId) throw new Error('Workflow owner project is missing.');
const all=JSON.parse(run(['exec','cinematicflight-n8n','n8n','export:workflow','--projectId='+projectId]));
if(all.some(w=>w.id===bridgeId)) throw new Error('Bridge already exists. Refusing to overwrite user changes.');
const workflow=buildReviewBridge(original);
const token=run(['exec','cinematicflight-review-local-api-1','php','-r','echo file_get_contents("/run/review-private/ingest-token");']).trim();
if(!/^[a-f0-9]{64}$/.test(token)) throw new Error('Local import secret not initialized.');
const credential={id:credentialId,name:'Local review — import designated test only',type:'httpBearerAuth',data:{token,allowedHttpRequestDomains:'domains',allowedDomains:'host.docker.internal'}};
const dir=run(['exec','cinematicflight-n8n','mktemp','-d','/tmp/cf-review-install-XXXXXX']).trim();
if(!/^\/tmp\/cf-review-install-[\w]+$/.test(dir)) throw new Error('Unexpected temporary path.');
try {
  for(const [name,data] of [['credential',credential],['workflow',workflow]]) {
    const path=dir+'/'+name+'.json';
    run(['exec','-i','cinematicflight-n8n','node','-e','const fs=require("fs");let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>fs.writeFileSync(process.argv[1],s,{mode:0o600}));',path],JSON.stringify([data]));
    run(['exec','cinematicflight-n8n','n8n',name==='credential'?'import:credentials':'import:workflow','--input='+path,'--projectId='+projectId]);
  }
  const installed=JSON.parse(run(['exec','cinematicflight-n8n','n8n','export:workflow','--id='+bridgeId]))[0];
  if(installed.active || installed.nodes.length!==workflow.nodes.length) throw new Error('Installed bridge verification failed.');
  const unchanged=JSON.parse(run(['exec','cinematicflight-n8n','n8n','export:workflow','--id='+original.id]))[0];
  if(unchanged.versionId!==original.versionId) throw new Error('Original workflow changed concurrently. Please review.');
  console.log('Installed inactive local review workflow '+bridgeId+'. Original workflow unchanged. No execution or AI call made.');
} finally {
  run(['exec','cinematicflight-n8n','node','-e','const fs=require("fs");for(const f of ["credential.json","workflow.json"]) {const p=process.argv[1]+"/"+f;if(fs.existsSync(p))fs.unlinkSync(p);}fs.rmdirSync(process.argv[1]);',dir]);
}
