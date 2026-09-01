import {credentialId} from './review-bridge.mjs';
export const attachmentWorkflowId='CfReviewAttachments006V3';
const base='https://api.mail.hostinger.com/api/v1/mailboxes/AC8400350301066fb9ff62506d23b2/folders/INBOX/messages/6';
export const manifestCode=`const m=$input.first().json.data;
if(!m || m.uid!==6 || m.path!=='INBOX' || m.subject!=='CF-AI-TEST-001' || m.messageId!=='<541F0970-249C-4C90-967E-CFA9BEBF4B66@chardee.dev>' || m.from?.address!=='me@chardee.dev' || !m.to?.some(a=>a.address==='hello@cinematicflight.com')) throw new Error('Not the designated test email. No files downloaded.');
if(!Array.isArray(m.attachments)||m.attachments.length>20)throw new Error('Missing attachment metadata or more than 20 files.');
const ids=new Set();
const attachments=m.attachments.map(a=>{
 if(typeof a.id!=='string'||!a.id||a.id.length>1024||ids.has(a.id)||typeof a.contentType!=='string'||!Number.isSafeInteger(a.sizeBytes)||a.sizeBytes<0||a.sizeBytes>2147483647||typeof a.inline!=='boolean')throw new Error('Unexpected attachment metadata.');
 ids.add(a.id);return {id:a.id,filename:a.filename??'Unnamed attachment',contentType:a.contentType.toLowerCase(),sizeBytes:a.sizeBytes,inline:a.inline};
});
return [{json:{operation:'manifest',inquiryId:'local-n8n-attachment-006',sentToClient:false,approvalRecorded:false,source:{mailbox:'hello@cinematicflight.com',folder:m.path,uid:m.uid,uidValidity:null,messageId:m.messageId,from:m.from.address,replyTo:'me@chardee.dev',subject:m.subject,enquiryText:'Please check the attached image and tell me what you think.'},attachments}}];`;
export const downloadsCode=`if($input.first().json.registered!==true)throw new Error('Attachment metadata was not saved.');
const body=$('Build attachment manifest').first().json;
const supported=new Set(['image/jpeg','image/png','image/webp','image/gif','text/plain']);
const files=body.attachments.filter(a=>supported.has(a.contentType)&&a.sizeBytes>0&&a.sizeBytes<=8388608);
if(files.reduce((n,a)=>n+a.sizeBytes,0)>41943040)throw new Error('Supported previews exceed 40 MB total. Metadata is saved; no files downloaded.');
return files.map(a=>({json:{operation:'file',inquiryId:body.inquiryId,source:body.source,sentToClient:false,approvalRecorded:false,attachmentId:a.id,expectedBytes:a.sizeBytes}}));`;
export const encodeCode=`const requests=$('Prepare attachment downloads').all();
const items=$input.all();
if(requests.length!==items.length)throw new Error('Attachment download pairing changed.');
const result=[];
for(let i=0;i<items.length;i++){
 const bytes=await this.helpers.getBinaryDataBuffer(i,'data');
 const request=requests[i].json;
 if(bytes.length<1||bytes.length>8388608||bytes.length>request.expectedBytes)throw new Error('Decoded attachment exceeds its provider-reported size; file not imported.');
 result.push({json:{...request,contentBase64:bytes.toString('base64')},pairedItem:{item:i}});
}
return result;`;
export function buildAttachmentSync(hostCredential){
 if(!hostCredential?.id)throw new Error('Hostinger credential reference required.');
 const code=(id,name,jsCode,x)=>({id,name,type:'n8n-nodes-base.code',typeVersion:2,position:[x,80],parameters:{jsCode}});
 const http=(id,name,url,x,credential,extra={})=>({id,name,type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[x,80],retryOnFail:false,onError:'stopWorkflow',parameters:{url,authentication:'genericCredentialType',genericAuthType:'httpBearerAuth',options:{timeout:20000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'json'}}},...extra},credentials:{httpBearerAuth:credential}});
 const local={id:credentialId,name:'Local review — import designated test only'};
 const post={method:'POST',sendBody:true,specifyBody:'json',jsonBody:'={{ $json }}'};
 const nodes=[
 {id:'attachment-note',name:'Attachment safety',type:'n8n-nodes-base.stickyNote',typeVersion:1,position:[0,-260],parameters:{width:900,height:240,content:'## Manual attachment sync — no AI\nOnly the designated UID 6 and original Message-ID. Registers up to 20 filenames/types/sizes, then downloads supported previews (JPEG/PNG/WebP/GIF/plain text, 8 MB per file, 40 MB total). Other types remain listed only.\n\nFiles are kept in private local storage, not sent to AI or added to public assets. No sending, mailbox writes, schedules or approval. New attachment metadata invalidates earlier approval. Files are not malware-scanned. Run the draft import first; no new model call is needed.'}},
 {id:'attachment-start',name:'Start manually',type:'n8n-nodes-base.manualTrigger',typeVersion:1,position:[0,80],parameters:{}},
 http('attachment-message','Read designated message metadata',base,240,hostCredential),
 code('attachment-manifest','Build attachment manifest',manifestCode,480),
 http('attachment-register','Register attachment list','http://host.docker.internal:5183/local-attachments',720,local,post),
 code('attachment-downloads','Prepare attachment downloads',downloadsCode,960),
 http('attachment-fetch','Download bounded attachment',"={{ '"+base+"/attachments/' + encodeURIComponent($json.attachmentId) }}",1200,hostCredential,{options:{timeout:20000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'file',outputPropertyName:'data'}}}}),
 code('attachment-encode','Prepare private file import',encodeCode,1440),
 http('attachment-save','Save private attachment','http://host.docker.internal:5183/local-attachments',1680,local,post),
 ];
 const connected=nodes.filter(n=>n.type!=='n8n-nodes-base.stickyNote');const connections={};
 connected.slice(0,-1).forEach((n,i)=>connections[n.name]={main:[[{node:connected[i+1].name,type:'main',index:0}]]});
 return {id:attachmentWorkflowId,name:'Cinematic Flight — Attachment previews (no AI)',active:false,nodes,connections,pinData:{},settings:{executionOrder:'v1',executionTimeout:300,saveManualExecutions:true}};
}
