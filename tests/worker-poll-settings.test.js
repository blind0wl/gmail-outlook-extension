import test from 'node:test';
import assert from 'node:assert/strict';
let imports=0;
async function fixture({stored=60000,alarm={name:'mail-poll',periodInMinutes:1,scheduledTime:Date.now()+45000},failInit=false}={}) {
  const data=stored===undefined?{}:{pollIntervalMs:stored};const calls=[];let current=alarm;
  const failures={create:failInit?1:0,set:0,get:0,remove:0};
  const fail=key=>{if(failures[key]>0){failures[key]--;throw new Error('API unavailable');}};
  globalThis.chrome={storage:{local:{get:async key=>{fail('get');return {[key]:data[key]};},set:async values=>{fail('set');Object.assign(data,values);},remove:async key=>{fail('remove');delete data[key];}}},alarms:{get:async()=>current,create:async(name,info)=>{calls.push({name,...info});fail('create');current={name,...info,scheduledTime:info.when??Date.now()+info.delayInMinutes*60000};},clear:async()=>{current=undefined;}}};
  const worker=await import(`../src/background/service-worker.js?poll=${++imports}`);await worker.ready;
  return {worker,data,calls,failures,alarm:()=>current};
}
test('worker wakes preserve matching alarm deadlines and reconcile missing/mismatched alarms',async()=>{
  const existing=await fixture();assert.equal(existing.calls.length,0);
  for(const alarm of [undefined,{periodInMinutes:2,scheduledTime:123}]) {
    const f=await fixture({alarm:alarm??null});assert.equal(f.calls.length,1);assert.equal(f.alarm().periodInMinutes,1);assert.equal(f.calls[0].delayInMinutes,1);
  }
});
test('validated setting saves replace one alarm after the chosen delay without polling',async()=>{
  const f=await fixture();
  for(const value of [null,'120000',NaN,Infinity,29999,30001,18001000]) assert.deepEqual(await f.worker.handleMessage({type:'set-poll-interval',pollIntervalMs:value}),{ok:false,code:'invalid-interval'});
  assert.equal(f.calls.length,0);
  assert.deepEqual(await f.worker.handleMessage({type:'set-poll-interval',pollIntervalMs:31000}),{ok:true,pollIntervalMs:31000});
  assert.equal(f.data.pollIntervalMs,31000);assert.equal(f.calls.length,1);assert.equal(f.calls[0].name,'mail-poll');assert.equal(f.calls[0].delayInMinutes,31/60);assert.equal(f.calls[0].periodInMinutes,31/60);
});
test('storage or scheduling failures restore the previous preference and deadline',async()=>{
  for(const failure of ['set','create']) {
    const f=await fixture();const before=f.alarm().scheduledTime;f.failures[failure]=1;
    assert.deepEqual(await f.worker.handleMessage({type:'set-poll-interval',pollIntervalMs:120000}),{ok:false,code:'save-failed'});
    assert.equal(f.data.pollIntervalMs,60000);assert.equal(f.alarm().scheduledTime,before);assert.equal(f.alarm().periodInMinutes,1);
  }
});
test('rollback failure reports uncertainty and does not poison later saves',async()=>{
  const f=await fixture();f.failures.create=2;
  assert.deepEqual(await f.worker.handleMessage({type:'set-poll-interval',pollIntervalMs:120000}),{ok:false,code:'save-failed',uncertain:true});
  assert.deepEqual(await f.worker.handleMessage({type:'set-poll-interval',pollIntervalMs:180000}),{ok:true,pollIntervalMs:180000});
});
test('startup scheduling failure leaves unrelated messages usable and a save can repair scheduling',async()=>{
  const f=await fixture({alarm:null,failInit:true});assert.deepEqual(await f.worker.handleMessage({type:'unknown'}),{ok:false});
  assert.equal((await f.worker.handleMessage({type:'set-poll-interval',pollIntervalMs:120000})).ok,true);
});
test('concurrent saves are serialized and leave the last applied interval',async()=>{
  const f=await fixture();
  const results=await Promise.all([120000,30000,18000000].map(pollIntervalMs=>f.worker.handleMessage({type:'set-poll-interval',pollIntervalMs})));
  assert.ok(results.every(result=>result.ok));assert.equal(f.data.pollIntervalMs,18000000);assert.equal(f.alarm().periodInMinutes,300);
});
test('failed initial preference save removes an originally absent key and clears an absent alarm',async()=>{
  const f=await fixture();delete f.data.pollIntervalMs;
  await chrome.alarms.clear();f.failures.create=1;
  assert.equal((await f.worker.handleMessage({type:'set-poll-interval',pollIntervalMs:120000})).ok,false);
  assert.equal(Object.hasOwn(f.data,'pollIntervalMs'),false);assert.equal(f.alarm(),undefined);
});
test('a pending mailbox refresh does not delay or get cancelled by a settings save',async()=>{
  const f=await fixture();f.data.accounts=[{provider:'gmail',account:'slow@example.test'}];
  let finish,fetches=0;
  const polling=f.worker.handleMessage({type:'refresh'},{fetchers:{gmail:async()=>{fetches++;await new Promise(resolve=>finish=resolve);return [];}},getToken:async()=>null});
  while(!finish) await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal((await f.worker.handleMessage({type:'set-poll-interval',pollIntervalMs:120000})).ok,true);assert.equal(fetches,1);
  finish();assert.equal((await polling).ok,true);
});
