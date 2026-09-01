import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dom = new JSDOM('<!doctype html><div id="root"></div>', {url:'http://127.0.0.1:5182/server-review'});
globalThis.window=dom.window; globalThis.document=dom.window.document;
globalThis.HTMLElement=dom.window.HTMLElement; globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.BroadcastChannel=undefined;
const {createElement,act}=await import('react');
const {createRoot}=await import('react-dom/client');
let compiledDir, Screen, root;
const clone=value=>structuredClone(value);
const fixture=()=>({id:1,inquiryId:'fixture',text:'Original sample reply.',originalText:'Original sample reply.',version:1,revision:1,status:'pending',approval:null,linkStatus:'contact_matches',source:{subject:'CF-AI-TEST-001',enquiryText:'Fictional enquiry',replyTo:'sender@example.test',mailbox:'hello@cinematicflight.com',messageId:'<fixture@example.test>',folder:'INBOX',uid:2,uidValidity:100},history:[{action:'imported',version:1,revision:1,text:'Original sample reply.',actorId:1,at:'2026-08-31T00:00:00Z',note:'Fixture'}]});
function fakeApi(){
  const state={authenticated:true,record:fixture(),user:{id:1,email:'reviewer@example.test'},changes:[],logouts:0};
  const api={
    session:async()=>({authenticated:state.authenticated,user:state.user}),list:async()=>({data:[{id:1}]}),get:async()=>({record:clone(state.record)}),
    login:async()=>{state.authenticated=true;return {user:state.user};},logout:async()=>{state.logouts++;state.authenticated=false;return {};},
    change:async(id,expected,command)=>{state.changes.push(command);assert.equal(expected,state.record.version);const r=state.record;r.version++;if(command.action==='edited'){r.text=command.text;r.revision++;r.status='pending';r.approval=null;}if(command.action==='approved'){r.status='approved';r.approval={at:'2026-08-31T00:00:00Z'};}r.history.push({action:command.action,version:r.version,revision:r.revision,text:r.text,at:'2026-08-31T00:00:00Z',note:'Saved',actorId:1});return {record:clone(r)};},
  };return {state,api};
}
const button=text=>[...document.querySelectorAll('button')].find(el=>el.textContent.includes(text));
async function click(el){assert.ok(el,'control exists');await act(async()=>{el.click();});}
async function type(selector,value){await act(async()=>{const el=document.querySelector(selector);assert.ok(el);const proto=el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new window.Event('input',{bubbles:true}));});}
async function mount(api,props={}){root=createRoot(document.getElementById('root'));await act(async()=>root.render(createElement(Screen,{client:api,...props})));}
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
before(async()=>{
  const require=createRequire(import.meta.url);
  const result=await build({entryPoints:['src/ServerReviewInbox.jsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',loader:{'.css':'empty'},plugins:[{name:'shared-test-react',setup(b){b.onResolve({filter:/^react(?:-dom)?(?:\/.*)?$/},args=>({path:require.resolve(args.path),external:true}));}}]});
  compiledDir=await mkdtemp(join(tmpdir(),'cf-review-ui-test-'));
  const file=join(compiledDir,'screen.mjs');await writeFile(file,result.outputFiles[0].text);
  Screen=(await import(pathToFileURL(file).href)).default;
});
afterEach(async()=>{if(root)await act(async()=>root.unmount());root=null;document.getElementById('root').replaceChildren();});
after(async()=>{if(compiledDir)await rm(compiledDir,{recursive:true});dom.window.close();});

test('approval requires both confirmations and saves through API',async()=>{
  const {api,state}=fakeApi();await mount(api);
  assert.equal(button('Approve revision').disabled,true);
  await click(document.querySelectorAll('input[type=checkbox]')[0]);assert.equal(button('Approve revision').disabled,true);
  await click(document.querySelectorAll('input[type=checkbox]')[1]);await click(button('Approve revision'));
  assert.equal(state.changes[0].linkConfirmed,true);assert.equal(state.changes[0].text,'Original sample reply.');
  assert.ok(document.querySelector('.ri-status-approved'));
  assert.match(document.querySelector('.ri-status-approved').textContent,/Approved/);
  assert.match(document.body.textContent,/Nothing sent/);
});

test('approved label uses a green background with accessible text contrast',async()=>{
  const css=await readFile('src/review-inbox.css','utf8');
  const rule=css.match(/\.ri-status-approved\s*\{([^}]+)\}/)[1];
  const background=rule.match(/background:\s*(#[\da-f]{6})/i)[1];
  const foreground=rule.match(/(?:^|;)\s*color:\s*(#[\da-f]{6})/i)[1];
  const channels=hex=>hex.slice(1).match(/../g).map(c=>parseInt(c,16)/255);
  const [r,g,b]=channels(background);assert.ok(g>r&&g>b,'approved status is visibly green');
  const luminance=hex=>channels(hex).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
  const levels=[luminance(background),luminance(foreground)].sort((a,b)=>a-b);
  assert.ok((levels[1]+.05)/(levels[0]+.05)>=4.5,'small status text meets AA contrast');
});
test('edits persist in server response and do not carry previous approval',async()=>{
  const {api,state}=fakeApi();await mount(api);await type('#server-reply','Edited reply.');
  assert.equal(button('Approve revision').disabled,true);await click(button('Save edits'));
  assert.equal(state.record.text,'Edited reply.');assert.equal(state.record.revision,2);
  await click(button('Refresh from server'));assert.equal(document.querySelector('#server-reply').value,'Edited reply.');
});
test('session loss hides draft and restores unsaved work only for same owner',async()=>{
  const {api,state}=fakeApi();await mount(api);await type('#server-reply','Unsaved private work.');
  state.authenticated=false;await click(button('Refresh from server'));
  assert.equal(document.querySelector('#server-reply'),null);assert.doesNotMatch(document.body.textContent,/Unsaved private work/);
  await type('#server-password','test-password');await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(document.querySelector('#server-reply').value,'Unsaved private work.');
  state.authenticated=false;await click(button('Refresh from server'));state.user={id:2,email:'another@example.test'};
  await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(document.querySelector('#server-reply').value,'Original sample reply.');
});
test('rejection note blocks sign-out and survives refreshed revision',async()=>{
  const {api,state}=fakeApi();await mount(api);await click(button('Reject draft'));await type('#server-reason','Needs checking.');
  await click(button('Sign out'));assert.equal(state.logouts,0);
  state.record.version=2;state.record.revision=2;state.record.text='Other tab reply';await click(button('Refresh from server'));
  assert.equal(document.querySelector('#server-reason').value,'Needs checking.');assert.match(document.body.textContent,/newer version/);
});
test('older refresh cannot overwrite just-saved text',async()=>{
  const {api,state}=fakeApi();await mount(api);await type('#server-reply','Newer edit');
  const old=clone(state.record),pending=deferred();api.get=()=>pending.promise;
  await click(button('Refresh from server'));await click(button('Save edits'));
  await act(async()=>pending.resolve({record:old}));
  assert.equal(document.querySelector('#server-reply').value,'Newer edit');assert.match(document.body.textContent,/Revision 2/);
});
test('reload or tab close is guarded while a clean approval is still saving',async()=>{
  const {api,state}=fakeApi();await mount(api);
  await click(document.querySelectorAll('input[type=checkbox]')[0]);await click(document.querySelectorAll('input[type=checkbox]')[1]);
  const pending=deferred();api.change=()=>pending.promise;await act(async()=>button('Approve revision').click());
  const event=new window.Event('beforeunload',{cancelable:true});window.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
  await act(async()=>pending.resolve({record:clone(state.record)}));
});
test('refresh during logout cannot restore authenticated content',async()=>{
  const {api,state}=fakeApi();await mount(api);const pending=deferred();api.logout=()=>pending.promise;
  await click(button('Sign out'));await act(async()=>window.dispatchEvent(new window.Event('focus')));
  await act(async()=>{state.authenticated=false;pending.resolve({});});
  assert.equal(document.querySelector('#server-reply'),null);assert.ok(document.querySelector('#server-password'));
});
test('server outage hides saved content and retry recovers unsaved edits',async()=>{
  const {api}=fakeApi();await mount(api);await type('#server-reply','Recover me');
  const get=api.get;api.get=async()=>{throw Object.assign(new Error('Unavailable'),{status:503});};
  await click(button('Refresh from server'));assert.equal(document.querySelector('#server-content').style.display,'none');
  api.get=get;await click(button('Retry connection'));assert.equal(document.querySelector('#server-reply').value,'Recover me');
});
test('empty server queue renders without falling back to browser data',async()=>{
  const {api}=fakeApi();api.list=async()=>({data:[]});await mount(api);
  assert.match(document.body.textContent,/No server drafts yet/);assert.equal(document.querySelector('#server-reply'),null);
});
test('embedded production desk shows a deliberate disabled state without another login form',async()=>{
  const {api}=fakeApi();api.list=async()=>{throw Object.assign(new Error('The server review test is not enabled.'),{status:503});};
  await mount(api,{embedded:true});
  assert.equal(document.querySelector('#server-password'),null);
  assert.equal(document.querySelector('.ri-topbar'),null);
  assert.match(document.body.textContent,/installed but remains disabled/);
  assert.match(document.body.textContent,/Queue access is disabled; nothing can be imported or sent through this screen/);
  assert.doesNotMatch(document.body.textContent,/Saved on this Mac/);
});
test('embedded production desk keeps an authenticated empty queue explicit',async()=>{
  const {api}=fakeApi();api.list=async()=>({data:[]});
  await mount(api,{embedded:true});
  assert.match(document.body.textContent,/Controlled production test/);
  assert.match(document.body.textContent,/No review drafts yet/);
  assert.match(document.body.textContent,/No local or browser-only drafts are substituted/);
  assert.equal(document.querySelector('#server-password'),null);
});
test('embedded production desk uses Studio persistence language',async()=>{
  const {api}=fakeApi();await mount(api,{embedded:true});
  assert.match(document.body.textContent,/saved server-side under your signed-in Studio account/i);
  assert.match(document.body.textContent,/Saved in Studio/);
  assert.doesNotMatch(document.body.textContent,/Saved on local server/);
});
test('embedded production desk reports an expired owner session to the Studio shell',async()=>{
  const {api,state}=fakeApi();state.authenticated=false;let expired=0;
  await mount(api,{embedded:true,onSessionExpired:()=>{expired++;}});
  assert.equal(expired,1);
  assert.match(document.body.textContent,/Studio session ended/);
  assert.equal(document.querySelector('#server-password'),null);
});
test('external memory restores unsaved work after the same Studio owner signs in again',async()=>{
  const {api,state}=fakeApi();const workStore={current:{}};let expired=0;
  await mount(api,{embedded:true,workStore,onSessionExpired:()=>{expired++;}});await type('#server-reply','Owner recovery copy');
  state.authenticated=false;await click(button('Refresh from server'));assert.equal(expired,1);
  await act(async()=>root.unmount());root=null;state.authenticated=true;
  await mount(api,{embedded:true,workStore,onSessionExpired:()=>{expired++;}});
  assert.equal(document.querySelector('#server-reply').value,'Owner recovery copy');
});
test('write authentication failure preserves unsaved reply for re-login',async()=>{
  const {api,state}=fakeApi();await mount(api);await type('#server-reply','Recover failed save');
  api.change=async()=>{state.authenticated=false;throw Object.assign(new Error('Sign in'),{status:401});};
  await click(button('Save edits'));assert.equal(document.querySelector('#server-reply'),null);
  await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(document.querySelector('#server-reply').value,'Recover failed save');
  assert.equal(state.record.text,'Original sample reply.');
});

test('n8n provenance and missing UIDVALIDITY are shown honestly',async()=>{
  const {api,state}=fakeApi();state.record.source.importMethod='n8n-local';state.record.source.uidValidity=null;
  await mount(api);assert.match(document.body.textContent,/Imported from the manual n8n test/);
  assert.match(document.body.textContent,/UIDVALIDITY not verified/);
  assert.doesNotMatch(document.body.textContent,/Seeded fictional local fixture/);
});
test('new imported draft does not displace unsaved work; explicit switch is guarded',async()=>{
  const {api,state}=fakeApi();await mount(api);await type('#server-reply','Keep this work');
  const next={...clone(state.record),id:2,inquiryId:'imported',text:'New imported draft'};
  api.list=async()=>({data:[{id:2,inquiryId:'imported',status:'pending'},{id:1,inquiryId:'fixture',status:'pending'}]});
  api.get=async id=>({record:clone(Number(id)===2?next:state.record)});
  await click(button('Refresh from server'));assert.equal(document.querySelector('#server-reply').value,'Keep this work');
  await act(async()=>{const select=document.querySelector('select');select.value='2';select.dispatchEvent(new window.Event('change',{bubbles:true}));});
  assert.equal(document.querySelector('#server-reply').value,'Keep this work');assert.match(document.body.textContent,/before switching drafts/);
  await click(button('Discard unsaved work'));
  await act(async()=>{const select=document.querySelector('select');select.value='2';select.dispatchEvent(new window.Event('change',{bubbles:true}));});
  assert.equal(document.querySelector('#server-reply').value,'New imported draft');
});

function withAttachments(){
  const context=fakeApi(), text='<script>not executable</script>';
  context.state.record.attachments={checked:true,items:[
    {id:11,name:'notes.txt',contentType:'text/plain',byteSize:Buffer.byteLength(text),status:'ready'},
    {id:12,name:'more.txt',contentType:'text/plain',byteSize:4,status:'ready'},
    {id:13,name:'document.pdf',contentType:'application/pdf',byteSize:100,status:'unsupported'},
  ]};
  context.state.loads=[];
  context.api.attachment=async id=>{context.state.loads.push(id);const file=context.state.record.attachments.items.find(f=>f.id===id);return {...file,contentBase64:Buffer.from(id===11?text:'More').toString('base64')};};
  return context;
}
async function key(target,key,extra={}){await act(async()=>target.dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...extra})));}
test('attachment metadata distinguishes unchecked from checked empty',async()=>{
  const {api,state}=fakeApi();await mount(api);assert.match(document.body.textContent,/have not been checked/);
  state.record.attachments={checked:true,items:[]};await click(button('Refresh from server'));
  assert.match(document.body.textContent,/No attachments were reported/);
});
test('image attachment loads one small clickable thumbnail and reuses its private response',async()=>{
  const {api,state}=fakeApi();const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ1sAAAAASUVORK5CYII=','base64');
  state.record.attachments={checked:true,items:[{id:21,name:'sample.png',contentType:'image/png',byteSize:png.length,status:'ready'}]};state.loads=[];
  api.attachment=async id=>{state.loads.push(id);return {id,contentType:'image/png',byteSize:png.length,contentBase64:png.toString('base64')};};
  await mount(api);await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
  const thumbnail=document.querySelector('.ri-attachment-thumb');assert.ok(thumbnail);assert.equal(thumbnail.getAttribute('aria-label'),'Open sample.png preview');
  assert.match(thumbnail.querySelector('img').src,/^blob:/);assert.deepEqual(state.loads,[21]);
  await click(thumbnail);assert.ok(document.querySelector('[role=dialog] img'));assert.deepEqual(state.loads,[21]);assert.deepEqual(state.changes,[]);
});
test('attachment text preview is escaped, lazy and never approves files',async()=>{
  const {api,state}=withAttachments();await mount(api);assert.deepEqual(state.loads,[]);
  assert.equal(button('View document.pdf'),undefined);
  await click(button('Open full preview'));
  assert.deepEqual(state.loads,[11]);assert.equal(document.querySelector('[role=dialog] pre').textContent,'<script>not executable</script>');
  assert.equal(document.querySelector('[role=dialog] script'),null);assert.deepEqual(state.changes,[]);
  assert.match(document.querySelector('[role=dialog]').textContent,/Not reviewed · No AI analysis/);
});
test('preview traps focus, navigates by keyboard and restores focus on Escape',async()=>{
  const {api,state}=withAttachments();await mount(api);const trigger=button('Open full preview');trigger.focus();await click(trigger);
  const close=document.querySelector('[aria-label="Close attachment preview"]');assert.equal(document.activeElement,close);
  assert.ok(document.getElementById('root').hasAttribute('inert'));assert.equal(document.body.style.overflow,'hidden');
  await key(close,'Tab',{shiftKey:true});assert.equal(document.activeElement.getAttribute('aria-label'),'Next attachment');
  await key(document.activeElement,'Tab');assert.equal(document.activeElement,close);
  await key(close,'ArrowRight');assert.equal(document.querySelector('[role=dialog] pre').textContent,'More');assert.deepEqual(state.loads,[11,12]);
  await key(close,'Escape');assert.equal(document.querySelector('[role=dialog]'),null);assert.equal(document.activeElement,trigger);
  assert.equal(document.getElementById('root').hasAttribute('inert'),false);assert.equal(document.body.style.overflow,'');
});
test('preview ignores a late response after closing',async()=>{
  const {api}=withAttachments(), pending=deferred();api.attachment=()=>pending.promise;await mount(api);
  await click(button('Open full preview'));assert.match(document.querySelector('[role=dialog]').textContent,/Loading private/);
  await click(document.querySelector('[aria-label="Close attachment preview"]'));
  await act(async()=>pending.resolve({id:11,contentType:'text/plain',byteSize:1,contentBase64:'eA=='}));
  assert.equal(document.querySelector('[role=dialog]'),null);
});
test('preview errors can be retried and authentication loss closes private content',async()=>{
  const {api,state}=withAttachments();const load=api.attachment;let failing=true;api.attachment=async id=>{if(failing)throw new Error('Temporary failure');return load(id);};await mount(api);
  await click(button('Open full preview'));assert.match(document.querySelector('[role=dialog]').textContent,/Temporary failure/);
  failing=false;await click(button('Retry preview'));
  assert.ok(document.querySelector('[role=dialog] pre'));
  state.authenticated=false;await click(button('Refresh from server'));
  assert.equal(document.querySelector('[role=dialog]'),null);assert.equal(document.querySelector('#server-reply'),null);
});
