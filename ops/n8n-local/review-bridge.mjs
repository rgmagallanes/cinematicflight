// Extend a saved workflow without altering its model request or existing guards.
export const bridgeId = 'CfHostingerReviewLocal001';
export const credentialId = 'CfLocalReviewImport001';
export const prepareImportCode = `const d = $input.first().json;
const selected = $('Require one exact test email').first().json;
const result = $('Find designated test subject').first().json;
const matches = Array.isArray(result.data) ? result.data.filter(m => m.uid === selected.uid && m.path === 'INBOX' && m.messageId === selected.messageId) : [];
if (matches.length !== 1) throw new Error('Original email identity is ambiguous. Nothing imported.');
const m = matches[0];
const expected = 's is a fictional test enquiry. We already have a property website. Can you add a cinematic experience without rebuilding everything? 12';
if (m.uid !== 5 || m.subject !== 'CF-AI-TEST-001' || m.messageId !== '<BAE4E5A8-D026-45A2-A51F-974B6C13648D@chardee.dev>' || m.from?.address !== 'me@chardee.dev' || !m.to?.some(a => a.address === 'hello@cinematicflight.com')) throw new Error('Not the designated owner test email.');
if (d.sourceUid !== m.uid || d.subject !== m.subject || d.mailbox !== 'hello@cinematicflight.com' || d.enquiryText !== expected || d.approvalRecorded !== false || d.sentToClient !== false || d.aiUsed !== true) throw new Error('Draft is not the designated unapproved test output.');
if (typeof d.draftReply !== 'string' || !d.draftReply.trim() || d.draftReply.length > 10000 || typeof d.model !== 'string' || !d.model.trim()) throw new Error('Missing reviewable draft or model.');
return [{json:{inquiryId:'local-n8n-test-005',draftReply:d.draftReply,model:d.model,sentToClient:false,approvalRecorded:false,source:{mailbox:d.mailbox,folder:m.path,uid:m.uid,uidValidity:null,messageId:m.messageId,from:m.from.address,replyTo:'me@chardee.dev',subject:m.subject,enquiryText:d.enquiryText}}}];`;

export function buildReviewBridge(saved) {
  if (saved.id !== 'CfHostingerDraftTest001' || saved.active || saved.isArchived) throw new Error('Expected the inactive designated test workflow.');
  const expectedTypes = ['n8n-nodes-base.stickyNote','n8n-nodes-base.manualTrigger','n8n-nodes-base.httpRequest','n8n-nodes-base.code'];
  if (saved.nodes.some(n => !expectedTypes.includes(n.type))) throw new Error('Unexpected workflow node type. Review before cloning.');
  const required = ['Start manually','Find designated test subject','Require one exact test email','Read test text only','Prepare approved test text','Nemotron - draft only','Review unsent draft'];
  for (const name of required) if (saved.nodes.filter(n => n.name === name).length !== 1) throw new Error('Missing unique node: ' + name);
  const workflow = {id:bridgeId,name:'Cinematic Flight — Test Email to Local Review',active:false,settings:{...saved.settings,saveManualExecutions:true,executionTimeout:180},nodes:structuredClone(saved.nodes),connections:structuredClone(saved.connections),pinData:{}};
  const note = workflow.nodes.find(n => n.type === 'n8n-nodes-base.stickyNote');
  if (note) note.parameters.content = '## Manual test email → local server review\nDesignated UID 5 only. Preserves the approved fictional-text check. Full runs call the model and then save the exact draft to local MariaDB.\n\nNo sending, mailbox changes, schedules, webhooks or production Studio writes. Approval happens separately in the local review inbox. Repeating the identical import is safe; a different generation for an already imported email is rejected without overwriting edits or decisions.\n\nUIDVALIDITY and Reply-To headers are not independently verified. This is review-only, not send-ready.';
  workflow.nodes.push({id:'local-review-envelope',name:'Prepare local review import',type:'n8n-nodes-base.code',typeVersion:2,position:[1800,80],parameters:{jsCode:prepareImportCode}});
  workflow.nodes.push({id:'local-review-save',name:'Save to local review inbox',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[2060,80],retryOnFail:false,onError:'stopWorkflow',parameters:{method:'POST',url:'http://host.docker.internal:5183/local-ingest',authentication:'genericCredentialType',genericAuthType:'httpBearerAuth',sendBody:true,specifyBody:'json',jsonBody:'={{ $json }}',options:{timeout:15000,redirect:{redirect:{followRedirects:false}},response:{response:{responseFormat:'json'}}}},credentials:{httpBearerAuth:{id:credentialId,name:'Local review — import designated test only'}}});
  workflow.connections['Review unsent draft']={main:[[{node:'Prepare local review import',type:'main',index:0}]]};
  workflow.connections['Prepare local review import']={main:[[{node:'Save to local review inbox',type:'main',index:0}]]};
  return workflow;
}
