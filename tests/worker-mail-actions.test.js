import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeMessages, getInbox, reconcileAccount } from '../src/store/cache.js';
import { handleMailboxAction, ready } from '../src/background/service-worker.js';

const account={provider:'outlook',account:'owner@example.test'};
const key='outlook:owner%40example.test:one';
const item={...account,key,from:'Sender',subject:'Message',snippet:'Preview',date:Date.now(),unread:true};
function fixture() {
  const data={accounts:[account],mailActions:{}};
  globalThis.chrome={storage:{local:{get:async k=>({[k]:data[k]}),set:async p=>Object.assign(data,p)}}};
  reconcileAccount(account,[],true);mergeMessages([item]);
  return data;
}
const deps={getToken:async()=> 'token',inspect:async()=>({id:'one',isRead:false,parentFolderId:'original'}),setBadge:async()=>{}};

test('Gmail Trash is blocked before provider access and preserves mail and recovery records',async()=>{
  await ready;
  const data=fixture();
  const gmail={provider:'gmail',account:'blocked@example.test'};
  const gmailItem={...item,...gmail,key:'gmail:blocked%40example.test:abcdef'};
  data.accounts.push(gmail);
  mergeMessages([gmailItem]);
  const lock={state:'uncertain',action:'trash',item:{...gmail,key:gmailItem.key},expiresAt:1234};
  data.mailActions[gmailItem.key]=lock;
  let accesses=0;
  const noAccess={...deps,getToken:async()=>{accesses++;},mutate:async()=>{accesses++;}};
  for(let i=0;i<2;i++) {
    assert.deepEqual(await handleMailboxAction({key:gmailItem.key,action:'trash'},noAccess),{ok:false,code:'gmail-trash-unavailable'});
  }
  assert.equal(accesses,0);
  assert.deepEqual(data.mailActions[gmailItem.key],lock);
  assert.ok(getInbox().some(i=>i.key===gmailItem.key));
  assert.equal((await handleMailboxAction({key:gmailItem.key,action:'acknowledge',expectedExpiresAt:1234},noAccess)).ok,true);
  assert.equal(accesses,0);
  assert.equal(data.mailActions[gmailItem.key],undefined);
  assert.deepEqual(await handleMailboxAction({key:gmailItem.key,action:'trash'},noAccess),{ok:false,code:'gmail-trash-unavailable'});
  assert.equal(accesses,0);
  assert.equal((await handleMailboxAction({key:gmailItem.key,action:'read'},{...deps,mutate:async()=>({id:'abcdef'})})).ok,true);
  assert.equal((await handleMailboxAction({key,action:'trash'},{...deps,mutate:async()=>({id:'moved'})})).ok,true);
});

test('mailbox Trash persists Undo with returned move ID and restores original folder',async()=>{
  await ready;
  const data=fixture();const calls=[];
  const mutate=async(a,id,action,folder)=>{calls.push({id,action,folder});return {id:action==='trash'?'moved':'restored'};};
  const result=await handleMailboxAction({type:'mail-action',key,action:'trash'},{...deps,mutate});
  assert.equal(result.ok,true);assert.equal(getInbox().some(i=>i.key===key),false);
  const undo=Object.values(data.mailActions)[0];assert.equal(undo.id,'moved');assert.equal(undo.folder,'original');
  const restored=await handleMailboxAction({type:'mail-action',key,action:'undo'},{...deps,mutate});
  assert.equal(restored.ok,true);assert.equal(calls[1].id,'moved');assert.equal(calls[1].folder,'original');
  assert.ok(getInbox().some(i=>i.key.endsWith(':restored')));
});

test('mailbox actions reject unknown mail and duplicate in-flight clicks',async()=>{
  const data=fixture();let finish;let calls=0;
  const mutate=async()=>{calls++;await new Promise(r=>finish=r);return {id:'one',isRead:true};};
  const first=handleMailboxAction({type:'mail-action',key,action:'read'},{...deps,mutate});
  await new Promise(r=>setTimeout(r,0));
  const duplicate=await handleMailboxAction({type:'mail-action',key,action:'read'},{...deps,mutate});
  assert.equal(duplicate.ok,false);assert.equal(calls,1);finish();await first;
  assert.equal(getInbox().find(i=>i.key===key).unread,false);
  const foreign=await handleMailboxAction({type:'mail-action',key:'unknown',action:'trash'},{...deps,mutate});
  assert.equal(foreign.ok,false);assert.equal(calls,1);
  assert.deepEqual(data.mailActions,{});
});

test('uncertain writes survive restart and are never blindly replayed',async()=>{
  const data=fixture();let calls=0;
  const mutate=async()=>{calls++;throw Object.assign(Error(),{uncertain:true});};
  assert.equal((await handleMailboxAction({type:'mail-action',key,action:'trash'},{...deps,mutate})).code,'check-mailbox');
  assert.equal(Object.values(data.mailActions)[0].state,'uncertain');
  assert.equal((await handleMailboxAction({type:'mail-action',key,action:'trash'},{...deps,mutate})).ok,false);
  assert.equal(calls,1);assert.ok(getInbox().some(i=>i.key===key));
});

test('expired Undo never sends a provider mutation',async()=>{
  const data=fixture();let calls=0;
  data.mailActions[key]={state:'undo',id:'moved',folder:'original',item,expiresAt:Date.now()-1};
  const result=await handleMailboxAction({key,action:'undo'},{...deps,mutate:async()=>calls++});
  assert.equal(result.code,'undo-expired');assert.equal(calls,0);
});

test('sign-out during a mailbox write cannot commit stale cache state',async()=>{
  const {handleMessage}=await import('../src/background/service-worker.js');
  const gmail={provider:'gmail',account:'race@example.test'};
  const raceKey='gmail:race%40example.test:abcdef';
  const data={accounts:[gmail],mailActions:{}};
  globalThis.chrome={storage:{local:{get:async k=>({[k]:data[k]}),set:async p=>Object.assign(data,p)}}};
  mergeMessages([{...item,...gmail,key:raceKey}]);
  let finish;
  const run=handleMailboxAction({key:raceKey,action:'read'},{...deps,mutate:async()=>{await new Promise(r=>finish=r);return {id:'abcdef'};}});
  await new Promise(r=>setTimeout(r,0));
  await handleMessage({type:'sign-out',...gmail},{setBadge:async()=>{}});
  finish();const result=await run;
  assert.equal(result.ok,false);assert.ok(getInbox().some(i=>i.key===raceKey));
});

test('expired Undo records are removed and restart locks retain no mail content',async()=>{
  const {pruneMailActions}=await import('../src/background/service-worker.js');
  const data=fixture();
  data.mailActions={expired:{state:'undo',expiresAt:1,item},unknown:{state:'uncertain',item}};
  await pruneMailActions();
  assert.equal(data.mailActions.expired,undefined);
  assert.deepEqual(data.mailActions.unknown.item,{key,provider:account.provider,account:account.account});
});

test('completed action cannot resurrect another account’s removed journal entries',async()=>{
  const {handleMessage}=await import('../src/background/service-worker.js');
  const data=fixture();
  const other={provider:'gmail',account:'removed@example.test'};
  data.accounts.push(other);
  data.mailActions.other={state:'undo',expiresAt:Date.now()+60000,item:{...item,...other}};
  let finish;
  const run=handleMailboxAction({key,action:'trash'},{...deps,mutate:async()=>{await new Promise(r=>finish=r);return {id:'moved'};}});
  await new Promise(r=>setTimeout(r,0));
  await handleMessage({type:'remove-account',...other},{setBadge:async()=>{}});
  finish();await run;
  assert.equal(data.mailActions.other,undefined);
  assert.equal(data.mailActions[key].state,'undo');
});

test('sign-out during the final journal read prevents confirmed cache commit',async()=>{
  const {handleMessage}=await import('../src/background/service-worker.js');
  const gmail={provider:'gmail',account:'commit-race@example.test'};
  const raceKey='gmail:commit-race%40example.test:abcdef';
  const data={accounts:[gmail],mailActions:{}};
  let defer=false,resolveRead;
  globalThis.chrome={storage:{local:{get:async k=>{
    if(k==='mailActions'&&defer){defer=false;await new Promise(r=>resolveRead=r);}
    return {[k]:data[k]};
  },set:async p=>Object.assign(data,p)}}};
  mergeMessages([{...item,...gmail,key:raceKey}]);
  const run=handleMailboxAction({key:raceKey,action:'read'},{...deps,mutate:async()=>{defer=true;return {id:'abcdef'};}});
  await new Promise(r=>setTimeout(r,0));
  const signout=handleMessage({type:'sign-out',...gmail},{setBadge:async()=>{}});
  await new Promise(r=>setTimeout(r,0));
  resolveRead();await signout;
  const result=await run;
  assert.equal(result.ok,false);assert.ok(getInbox().some(i=>i.key===raceKey));
});

test('verified unread-inbox absence clears stale card but keeps an unconfirmed write locked',async()=>{
  const gmail={provider:'gmail',account:'reconciled@example.test'};
  const gmailKey='gmail:reconciled%40example.test:abcdef';
  const data={accounts:[gmail],mailActions:{}};
  globalThis.chrome={storage:{local:{get:async k=>({[k]:data[k]}),set:async p=>Object.assign(data,p)}}};
  mergeMessages([{...item,...gmail,key:gmailKey}]);
  const result=await handleMailboxAction({key:gmailKey,action:'read'},{...deps,mutate:async()=>{throw Object.assign(Error(),{uncertain:true,unreadInboxAbsent:true});}});
  assert.equal(result.code,'check-mailbox');
  assert.equal(getInbox().some(i=>i.key===gmailKey),false);
  assert.equal(data.mailCache.some(i=>i.key===gmailKey),false);
  assert.equal(data.mailActions[gmailKey].state,'uncertain');
  assert.equal(data.mailActions[gmailKey].item.subject,undefined);
});

test('checking an uncertain conversation succeeds with an unrelated action queued',async()=>{
  const data=fixture();
  const other={...item,key:'outlook:owner%40example.test:two'};
  mergeMessages([other]);
  data.mailActions[key]={state:'uncertain',item:{key,...account}};
  let calls=0;
  const checked=handleMailboxAction({key,action:'acknowledge'},deps);
  const unrelated=handleMailboxAction({key:other.key,action:'trash'},{...deps,mutate:async()=>{calls++;return {id:'moved-two'};}});
  assert.equal((await checked).ok,true);
  assert.equal((await unrelated).ok,true);
  assert.equal(data.mailActions[key],undefined);
  assert.equal(data.mailActions[other.key].state,'undo');
  assert.equal(calls,1,'acknowledgement must never send a provider write');
});

test('account recovery cannot acknowledge a newer lock created after its snapshot',async()=>{
  const data=fixture();
  const newer={state:'uncertain',item:{key,...account},expiresAt:2000};
  data.mailActions[key]=newer;
  const result=await handleMailboxAction({key,action:'acknowledge',expectedExpiresAt:1000},deps);
  assert.equal(result.ok,false);
  assert.deepEqual(data.mailActions[key],newer);
  assert.equal((await handleMailboxAction({key,action:'acknowledge',expectedExpiresAt:2000},deps)).ok,true);
  assert.equal(data.mailActions[key],undefined);
});

test('account recovery preserves Undo when a captured pending Trash has completed',async()=>{
  const data=fixture();
  const undo={state:'undo',item,id:'moved',expiresAt:2000};
  data.mailActions[key]=undo;
  const result=await handleMailboxAction({key,action:'acknowledge',expectedExpiresAt:2000},deps);
  assert.equal(result.ok,false);
  assert.deepEqual(data.mailActions[key],undo);
});

test('repeated Gmail read stays isolated after one uncertain result and explicit recovery',async()=>{
  const gmail={provider:'gmail',account:'repeated@example.test'};
  const other={provider:'gmail',account:'other-repeated@example.test'};
  const data={accounts:[gmail,other],mailActions:{}};
  globalThis.chrome={storage:{local:{get:async k=>({[k]:data[k]}),set:async p=>Object.assign(data,p)}}};
  const messages=['aa','bb','cc','dd','ee','ff'].map(id=>({...item,...gmail,key:`gmail:repeated%40example.test:${id}`}));
  const foreign={...item,...other,key:'gmail:other-repeated%40example.test:ab'};
  reconcileAccount(gmail,[],true);reconcileAccount(other,[],true);
  mergeMessages([...messages,foreign]);
  const calls=[];
  const mutate=async(a,id)=>{
    calls.push({account:a.account,id});
    if(id==='cc')throw Object.assign(Error(),{uncertain:true});
    return {id};
  };
  for(const message of messages) {
    const result=await handleMailboxAction({key:message.key,action:'read'},{...deps,mutate});
    assert.equal(result.ok,!message.key.endsWith(':cc'));
  }
  const locked=messages[2].key;
  assert.equal((await handleMailboxAction({key:locked,action:'read'},{...deps,mutate})).code,'check-mailbox');
  assert.equal((await handleMailboxAction({key:foreign.key,action:'read'},{...deps,mutate})).ok,true);
  assert.equal(calls.length,7,'locked conversation was not replayed');
  assert.equal((await handleMailboxAction({key:locked,action:'acknowledge'},deps)).ok,true);
  assert.equal(data.mailActions[locked],undefined);
  assert.equal(calls.length,7,'explicit recovery clears only the lock');
  assert.equal(data.mailActions[foreign.key],undefined);
});
