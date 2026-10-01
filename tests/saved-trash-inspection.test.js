import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectSavedGmailTrash, handleMessage, ready } from '../src/background/service-worker.js';
import { getInbox } from '../src/store/cache.js';

const acct={provider:'gmail',account:'inspection@example.test'};
const key='gmail:inspection%40example.test:abcdef';
function fixture() {
  const data={accounts:[acct],mailActions:{[key]:{
    state:'uncertain',action:'trash',id:'abcdef',item:{...acct,key},expiresAt:1234,
  }}};
  let writes=0;
  globalThis.chrome={storage:{local:{get:async k=>({[k]:structuredClone(data[k])}),set:async p=>{writes++;Object.assign(data,p);}}}};
  return {data,writes:()=>writes};
}

test('statically loaded console helper inspects a saved target without changing locks or cache',async()=>{
  await ready;
  const f=fixture(),before=structuredClone(f.data.mailActions),cache=structuredClone(getInbox());
  const calls=[];
  const expected={ok:true,status:200,returned:1,results:['verified-trash']};
  assert.deepEqual(await inspectSavedGmailTrash({inspect:async(account,ids)=>{calls.push({account,ids});return expected;}}),expected);
  assert.deepEqual(calls,[{account:acct.account,ids:['abcdef']}]);
  assert.deepEqual(f.data.mailActions,before);
  assert.deepEqual(getInbox(),cache);
  assert.equal(f.writes(),0);
  assert.equal(typeof globalThis.inspectSavedGmailTrash,'function','worker console helper requires no dynamic import');
});

test('console inspection skips non-Trash, completed and foreign records and inactive accounts',async()=>{
  const f=fixture();let calls=0;
  const inspect=async()=>{calls++;};
  const original=structuredClone(f.data.mailActions[key]);
  for(const change of [{action:'read'},{state:'undo'},{item:{provider:'outlook',account:acct.account,key}}]) {
    f.data.mailActions[key]={...original,...change};
    assert.equal((await inspectSavedGmailTrash({inspect})).code,'no-saved-target');
  }
  f.data.mailActions[key]=original;
  f.data.accounts=[];
  assert.equal((await inspectSavedGmailTrash({inspect})).code,'account-unavailable');
  f.data.accounts=[{...acct,enabled:false}];
  assert.equal((await inspectSavedGmailTrash({inspect})).code,'account-unavailable');
  assert.equal(calls,0);
  assert.equal(f.writes(),0);
});

test('sign-out while inspecting prevents attribution to the prior account generation',async()=>{
  const f=fixture();let finish;
  const run=inspectSavedGmailTrash({inspect:()=>new Promise(resolve=>finish=resolve)});
  await new Promise(resolve=>setTimeout(resolve,0));
  await handleMessage({type:'sign-out',...acct},{setBadge:async()=>{}});
  finish({ok:true,results:['verified-trash']});
  assert.deepEqual(await run,{ok:false,code:'account-changed',results:['not-confirmed']});
});
