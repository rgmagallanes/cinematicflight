import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAttachmentSync,manifestCode,downloadsCode,encodeCode} from '../attachment-sync.mjs';
const meta={uid:6,path:'INBOX',subject:'CF-AI-TEST-001',messageId:'<541F0970-249C-4C90-967E-CFA9BEBF4B66@chardee.dev>',from:{address:'me@chardee.dev'},to:[{address:'hello@cinematicflight.com'}],attachments:[]};
const runManifest=m=>new Function('$input',manifestCode)({first:()=>({json:{data:m}})})[0].json;
test('attachment graph has no AI or mail writes, and fixed destinations',()=>{
 const w=buildAttachmentSync({id:'host-ref'});assert.equal(w.active,false);assert.deepEqual(w.pinData,{});
 const http=w.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest');assert.equal(http.length,4);
 for(const n of http){assert.equal(n.parameters.options.redirect.redirect.followRedirects,false);assert.equal(n.retryOnFail,false);if(n.parameters.url.includes('hostinger'))assert.notEqual(n.parameters.method,'POST');}
 assert.equal(w.nodes.filter(n=>n.type.includes('Trigger')).length,1);assert.doesNotMatch(JSON.stringify(w),/integrate\.api\.nvidia|\/send["'/]/);
});
test('missing metadata is unknown, not an empty attachment list',()=>{const m={...meta};delete m.attachments;assert.throws(()=>runManifest(m));assert.equal(runManifest(meta).attachments.length,0);});
test('rejects other message identities and maps only documented fields',()=>{
 assert.throws(()=>runManifest({...meta,uid:5}));assert.throws(()=>runManifest({...meta,messageId:'<other@example.test>'}));
 const m={...meta,attachments:[{id:'opaque/a',filename:'a.png',contentType:'image/png',sizeBytes:4,inline:false,url:'https://evil.example/'}]};
 assert.deepEqual(runManifest(m).attachments,[{id:'opaque/a',filename:'a.png',contentType:'image/png',sizeBytes:4,inline:false}]);
 assert.throws(()=>runManifest({...m,attachments:[...m.attachments,...m.attachments]}));
});
test('download selection excludes oversized and executable content',()=>{
 const body=runManifest({...meta,attachments:[{id:'a',filename:'a.png',contentType:'image/png',sizeBytes:4,inline:false},{id:'b',filename:'b.html',contentType:'text/html',sizeBytes:4,inline:false},{id:'c',filename:'c.jpg',contentType:'image/jpeg',sizeBytes:8388609,inline:false}]});
 const out=new Function('$input','$',downloadsCode)({first:()=>({json:{registered:true}})},()=>({first:()=>({json:body})}));assert.equal(out.length,1);assert.equal(out[0].json.attachmentId,'a');
});
test('binary import validates byte count and preserves pairing',async()=>{
 const fn=new (Object.getPrototypeOf(async function(){}).constructor)('$input','$',encodeCode);
 const out=await fn.call({helpers:{getBinaryDataBuffer:async()=>Buffer.from('test')}},{all:()=>[{}]},()=>({all:()=>[{json:{attachmentId:'a',expectedBytes:4}}]}));
 assert.equal(out[0].json.contentBase64,'dGVzdA==');assert.equal(out[0].pairedItem.item,0);
 const smaller=await fn.call({helpers:{getBinaryDataBuffer:async()=>Buffer.from('test')}},{all:()=>[{}]},()=>({all:()=>[{json:{attachmentId:'a',expectedBytes:8}}]}));assert.equal(smaller[0].json.contentBase64,'dGVzdA==');
 await assert.rejects(fn.call({helpers:{getBinaryDataBuffer:async()=>Buffer.from('longer')}},{all:()=>[{}]},()=>({all:()=>[{json:{expectedBytes:4}}]})));
});
