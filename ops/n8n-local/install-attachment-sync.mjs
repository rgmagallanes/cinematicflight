import {spawnSync} from 'node:child_process';
import {buildAttachmentSync,attachmentWorkflowId} from './attachment-sync.mjs';
const docker='/Applications/Docker.app/Contents/Resources/bin/docker';
function run(args,input){const r=spawnSync(docker,args,{input,encoding:'utf8',maxBuffer:4*1024*1024});if(r.status!==0)throw new Error('Local workflow operation failed: '+args.slice(0,4).join(' '));return r.stdout;}
const saved=JSON.parse(run(['exec','cinematicflight-n8n','n8n','export:workflow','--id=CfHostingerReviewLocal001']))[0];
const project=saved.shared?.find(s=>s.role==='workflow:owner')?.projectId;
if(!project)throw new Error('Owner project is missing.');
const existing=JSON.parse(run(['exec','cinematicflight-n8n','n8n','export:workflow','--projectId='+project]));
if(existing.some(w=>w.id===attachmentWorkflowId))throw new Error('Attachment workflow already exists; refusing to overwrite changes.');
const credential=saved.nodes.find(n=>n.name==='Find designated test subject')?.credentials?.httpBearerAuth;
const workflow=buildAttachmentSync(credential);
const dir=run(['exec','cinematicflight-n8n','mktemp','-d','/tmp/cf-attachments-install-XXXXXX']).trim();
if(!/^\/tmp\/cf-attachments-install-\w+$/.test(dir))throw new Error('Unexpected temp path.');
try{
 const path=dir+'/workflow.json';
 run(['exec','-i','cinematicflight-n8n','node','-e','const fs=require("fs");let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>fs.writeFileSync(process.argv[1],s,{mode:0o600}));',path],JSON.stringify([workflow]));
 run(['exec','cinematicflight-n8n','n8n','import:workflow','--input='+path,'--projectId='+project]);
 const check=JSON.parse(run(['exec','cinematicflight-n8n','n8n','export:workflow','--id='+attachmentWorkflowId]))[0];
 if(check.active||check.nodes.length!==workflow.nodes.length)throw new Error('Installed workflow verification failed.');
 console.log('Installed inactive attachment sync '+attachmentWorkflowId+'. No files, emails or AI calls executed.');
}finally{run(['exec','cinematicflight-n8n','node','-e','const fs=require("fs");const p=process.argv[1]+"/workflow.json";if(fs.existsSync(p))fs.unlinkSync(p);fs.rmdirSync(process.argv[1]);',dir]);}
