import test, { after, afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://studio.cinematicflight.com/review-inbox'});
globalThis.window=dom.window;globalThis.document=dom.window.document;
globalThis.localStorage=dom.window.localStorage;
globalThis.HTMLElement=dom.window.HTMLElement;globalThis.Node=dom.window.Node;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createElement,act}=await import('react');
const {createRoot}=await import('react-dom/client');
let compiledDir,Dashboard,root;
const button=label=>[...document.querySelectorAll('button')].find(node=>node.getAttribute('aria-label')===label||node.textContent.includes(label));
const tick=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});

before(async()=>{
  const require=createRequire(import.meta.url);
  const result=await build({
    entryPoints:['src/SalesDashboard.jsx'],bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',loader:{'.css':'empty'},define:{'import.meta.env.VITE_APP_MODE':'"studio"'},
    plugins:[
      {name:'review-navigation-stubs',setup(bundle){
        bundle.onResolve({filter:/StudioReviewInbox\.jsx$/},()=>({path:'review-stub',namespace:'test'}));
        bundle.onLoad({filter:/.*/,namespace:'test'},()=>({loader:'jsx',contents:`import {useEffect} from 'react';export default function ReviewStub({onDirtyChange,onBusyChange}){useEffect(()=>{onDirtyChange(true);return()=>onDirtyChange(false)},[onDirtyChange]);return <section data-review-stub>Unsaved review<button data-start-save onClick={()=>onBusyChange(true)}>Start save</button></section>}`}));
        bundle.onResolve({filter:/lib\/studioData\.js$/},()=>({path:'studio-data-stub',namespace:'test-data'}));
        bundle.onLoad({filter:/.*/,namespace:'test-data'},()=>({loader:'js',contents:`export const loadInquiries=async()=>[];export const seedInquiries=async()=>{};export const saveInquiry=async()=>{};export const loadInquiryImages=async()=>[];export const uploadInquiryImages=async()=>[];export const deleteInquiryImage=async()=>{};export const loadPropertyFiles=async()=>[];export const savePropertyFiles=async()=>{};`}));
        bundle.onResolve({filter:/^react(?:-dom)?(?:\/.*)?$/},args=>({path:require.resolve(args.path),external:true}));
      }},
    ],
  });
  compiledDir=await mkdtemp(join(tmpdir(),'cf-studio-review-nav-'));
  const file=join(compiledDir,'dashboard.mjs');await writeFile(file,result.outputFiles[0].text);
  Dashboard=(await import(pathToFileURL(file).href)).SalesDashboard;
});

afterEach(async()=>{if(root)await act(async()=>root.unmount());root=null;document.getElementById('root').replaceChildren();window.history.replaceState({},'','/review-inbox');});
after(async()=>{if(compiledDir)await rm(compiledDir,{recursive:true});dom.window.close();});

async function mount({workStore,onSignOut=()=>{}}){
  root=createRoot(document.getElementById('root'));
  await act(async()=>root.render(createElement(Dashboard,{cloudUser:{id:1,email:'owner@example.test'},reviewWorkStore:workStore,onSignOut,onSessionExpired:()=>{}})));
  await tick();
}

test('Studio navigation cancels or confirms discarding only the current owner work',async()=>{
  const workStore={current:{'1:10':{text:'Owner one'},'2:20':{text:'Owner two'}}};
  await mount({workStore});assert.ok(document.querySelector('[data-review-stub]'));
  window.confirm=()=>false;await act(async()=>button('Daily Flight Deck').click());
  assert.ok(document.querySelector('[data-review-stub]'));assert.equal(window.location.pathname,'/review-inbox');
  window.confirm=()=>true;await act(async()=>button('Daily Flight Deck').click());
  assert.equal(document.querySelector('[data-review-stub]'),null);assert.equal(window.location.pathname,'/');
  assert.deepEqual(workStore.current,{'2:20':{text:'Owner two'}});
});

test('browser history and sign-out honor the unsaved Review Inbox guard',async()=>{
  const workStore={current:{'1:10':{text:'Owner one'}}};let signOuts=0;
  await mount({workStore,onSignOut:()=>{signOuts++;}});
  window.confirm=()=>false;window.history.pushState({},'','/');await act(async()=>window.dispatchEvent(new window.PopStateEvent('popstate')));
  assert.equal(window.location.pathname,'/review-inbox');assert.ok(document.querySelector('[data-review-stub]'));
  await act(async()=>button('Sign out').click());assert.equal(signOuts,0);assert.ok(workStore.current['1:10']);
  window.confirm=()=>true;await act(async()=>button('Sign out').click());assert.equal(signOuts,1);assert.deepEqual(workStore.current,{});
});

test('Studio cannot leave or sign out while a review mutation is in flight',async()=>{
  const workStore={current:{'1:10':{text:'Owner one'}}};let signOuts=0,confirms=0;
  await mount({workStore,onSignOut:()=>{signOuts++;}});window.confirm=()=>{confirms++;return true;};
  await act(async()=>document.querySelector('[data-start-save]').click());
  await act(async()=>button('Daily Flight Deck').click());assert.ok(document.querySelector('[data-review-stub]'));
  await act(async()=>button('Sign out').click());assert.equal(signOuts,0);assert.equal(confirms,0);assert.ok(workStore.current['1:10']);
  assert.match(document.body.textContent,/Wait for the review decision to finish saving/);
});
