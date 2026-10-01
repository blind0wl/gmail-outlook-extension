import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMailboxAction, ready } from '../src/background/service-worker.js';
import { reconcileAccount, getInbox } from '../src/store/cache.js';

function exact(id, labels) {
  const cs=Array(9).fill(null);
  cs[0]='cs';cs[1]=id;cs[3]=1;cs[8]=[id];
  const ms=Array(10).fill(null);
  ms[0]='ms';ms[1]=id;ms[9]=labels;
  return JSON.stringify([[cs,ms],'synthetic-trailer']);
}

test('fifteen queued Gmail Undos confirm delayed state without replaying writes or losing records', async () => {
  await ready;
  const originalFetch=globalThis.fetch,originalChrome=globalThis.chrome;
  const account={provider:'gmail',account:'owner@example.test'};
  const ids=Array.from({length:15},(_,i)=>(0xabcdef+i).toString(16));
  const records=Object.fromEntries(ids.map(id=>{
    const key='gmail:owner%40example.test:'+id;
    return [key,{state:'undo',action:'trash',id,folder:'inbox',expiresAt:Date.now()+600000,
      item:{...account,key,subject:'Synthetic mail',unread:true,date:Date.now()}}];
  }));
  const data={accounts:[account],mailActions:records};
  const posts=new Map(),afterReads=new Map();
  const globals=Array(10).fill(null);
  globals[2]=123456;globals[3]='gmail.main.20261001';globals[9]='synthetic-key';
  globalThis.chrome={cookies:{get:async()=>({value:'synthetic-cookie'})},storage:{local:{
    get:async key=>({[key]:data[key]}),set:async values=>Object.assign(data,values),
  }}};
  reconcileAccount(account,[],true);
  globalThis.fetch=async (url,options={})=>{
    const parsed=new URL(url);
    if (parsed.pathname.endsWith('/token')) return {ok:true,status:200,text:async()=>'synthetic-framework-token-12345678'};
    if (options.method==='POST') {
      const target=JSON.parse(options.body)[1][0][0][1][0].replace('thread-f:','');
      const id=BigInt(target).toString(16);
      assert.ok(ids.includes(id));
      posts.set(id,(posts.get(id)||0)+1);
      // Simulate a lost reply after Gmail accepted one of the restores.
      if (id===ids[7]) throw Error('synthetic response lost');
      return {ok:true,status:200,text:async()=>'unrecognized'};
    }
    if (parsed.searchParams.get('view')==='cv') {
      const id=parsed.searchParams.get('th');
      if (posts.has(id)) afterReads.set(id,(afterReads.get(id)||0)+1);
      return {ok:true,status:200,text:async()=>exact(id,afterReads.get(id)>1?['^i','^u']:['^k','^u'])};
    }
    return {ok:true,status:200,text:async()=>url.endsWith('/feed/atom')
      ? '<feed><title>Gmail - Inbox for owner@example.test</title><fullcount>0</fullcount></feed>'
      : 'GM_ID_KEY="synthetic-key";var GLOBALS='+JSON.stringify(globals)+';'};
  };
  try {
    const results=await Promise.all(Object.keys(records).map(key=>handleMailboxAction({key,action:'undo'},{setBadge:async()=>{}})));
    assert.ok(results.every(result=>result.ok),JSON.stringify(results));
    assert.equal(posts.size,15);
    assert.ok([...posts.values()].every(count=>count===1),'each restore is sent exactly once');
    assert.ok([...afterReads.values()].every(count=>count===2),'stale confirmation is read again');
    assert.equal(Object.keys(data.mailActions).length,0,'all confirmed Undo records removed');
    assert.equal(getInbox().filter(item=>item.account===account.account).length,15);
  } finally {globalThis.fetch=originalFetch;globalThis.chrome=originalChrome;}
});
