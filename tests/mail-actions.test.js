import test from 'node:test';
import assert from 'node:assert/strict';

function exactState(url, labels) {
  const cs = Array(9).fill(null);
  cs[0] = 'cs'; cs[1] = new URL(url).searchParams.get('th'); cs[3] = 1; cs[8] = ['aa01'];
  const ms = Array(10).fill(null);
  ms[0] = 'ms'; ms[1] = 'aa01'; ms[9] = labels;
  return JSON.stringify([[cs, ms], 'synthetic-trailer']);
}

test('Graph mailbox actions use account token, escaped message ID and recoverable folder moves', async () => {
  const { mutateOutlookMessage } = await import('../src/providers/mail-actions.js');
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({url, ...options});
    return {ok:true, json:async()=>({id:'moved',isRead:true,parentFolderId:'deleteditems'})};
  };
  await mutateOutlookMessage('token','id/with?chars','read');
  assert.equal(calls[0].method,'PATCH');
  assert.deepEqual(JSON.parse(calls[0].body),{isRead:true});
  assert.match(calls[0].url,/id%2Fwith%3Fchars$/);
  assert.equal(calls[0].redirect,'error');
  const moved = await mutateOutlookMessage('token','id','trash');
  assert.equal(moved.id,'moved');
  assert.deepEqual(JSON.parse(calls[1].body),{destinationId:'deleteditems'});
  await mutateOutlookMessage('token','moved','undo','folder');
  assert.deepEqual(JSON.parse(calls[2].body),{destinationId:'folder'});
});

test('Gmail resolves the owning browser slot before sending a conversation mutation', async () => {
  const { mutateGmailConversation } = await import('../src/providers/mail-actions.js');
  const calls=[];
  globalThis.chrome={cookies:{get:async()=>({value:'csrf'})}};
  globalThis.fetch=async(url,options)=>{
    calls.push({url,...options});
    if(new URL(url).searchParams.get('view')==='cv')return {ok:true,status:200,text:async()=>exactState(url,['^i'])};
    if(url.endsWith('/feed/atom'))return {ok:true,status:200,text:async()=>`<feed><title>Gmail - Inbox for ${url.includes('/u/0/')?'other@example.test':'owner@example.test'}</title><fullcount>1</fullcount></feed>`};
    if(options.method==='POST')return {ok:true,status:200,text:async()=>`["ar",1,"OK"]`};
    return {ok:true,status:200,text:async()=>`var GM_ID_KEY = "identity-key";`};
  };
  await mutateGmailConversation('owner@example.test','abcdef123','read');
  const post=calls.find(c=>c.method==='POST');
  assert.match(post.url,/\/u\/1\/s\//);
  assert.equal(post.credentials,'include');
  assert.ok(post.body.get('s_jr').includes('abcdef123'));
  assert.equal(calls.filter(c=>c.method==='POST').length,1);
  await assert.rejects(mutateGmailConversation('owner@example.test','bad/id','trash'));
});

test('Gmail rejects ambiguous responses without claiming success or exposing page content',async()=>{
  const {mutateGmailConversation}=await import('../src/providers/mail-actions.js');
  globalThis.chrome={cookies:{get:async()=>({value:'private-session'})}};
  let posts=0;
  globalThis.fetch=async(url,options)=>({ok:true,status:200,text:async()=>{
    if(options.method==='POST'){posts++;return '<html>Private mail and credentials</html>';}
    if(url.endsWith('/feed/atom'))return '<feed><title>Gmail - Inbox for owner@example.test</title></feed>';
    return 'GM_ID_KEY="key"';
  }});
  await assert.rejects(mutateGmailConversation('owner@example.test','123abc','trash'),e=>e.uncertain===true && !e.message.includes('Private'));
  assert.equal(posts,1);
});

test('Graph forbidden responses require sign-in and never leak provider body',async()=>{
  const {mutateOutlookMessage}=await import('../src/providers/mail-actions.js');
  globalThis.fetch=async()=>({ok:false,status:403,json:async()=>({private:'mail'})});
  await assert.rejects(mutateOutlookMessage('token','id','trash'),e=>e.code==='sign-in' && e.uncertain===false);
});

test('Gmail rechecks worker authorization immediately before a session POST',async()=>{
  const {mutateGmailConversation}=await import('../src/providers/mail-actions.js');
  let posts=0;
  globalThis.chrome={cookies:{get:async()=>({value:'csrf'})}};
  globalThis.fetch=async(url,options)=>{
    if(options.method==='POST')posts++;
    return {ok:true,status:200,text:async()=>url.endsWith('/feed/atom')?'<feed><title>Gmail - Inbox for owner@example.test</title></feed>':'GM_ID_KEY="key"'};
  };
  await assert.rejects(mutateGmailConversation('owner@example.test','abcdef','trash',()=>{throw Error('signed out');}));
  assert.equal(posts,0);
});

test('Gmail Undo confirms complete Inbox restoration, including read conversations',async()=>{
  const {mutateGmailConversation}=await import('../src/providers/mail-actions.js');
  globalThis.chrome={cookies:{get:async()=>({value:'csrf'})}};
  let posted = false;
  const globals = Array(10).fill(null); globals[2] = 123456; globals[3] = 'gmail.main.20261001'; globals[9] = 'key';
  globalThis.fetch = async (url, options) => {
    if (url.includes('/token?')) return { ok: true, text: async () => 'synthetic-framework-token-12345678' };
    if (options.method === 'POST') posted = true;
    return { ok: true, status: 200, text: async () => options.method === 'POST' ? '["ar",1,"OK"]'
      : new URL(url).searchParams.get('view') === 'cv' ? exactState(url, [posted ? '^i' : '^k'])
      : url.endsWith('/feed/atom') ? '<feed><title>Gmail - Inbox for owner@example.test</title></feed>'
      : 'GM_ID_KEY="key";var GLOBALS=' + JSON.stringify(globals) + ';' };
  };
  assert.deepEqual(await mutateGmailConversation('owner@example.test','abcdef','undo'),{id:'abcdef'});
});

test('unrecognized Gmail acknowledgement reconciles only a complete owning unread feed, without replaying the write',async()=>{
  const {mutateGmailConversation}=await import('../src/providers/mail-actions.js');
  globalThis.chrome={cookies:{get:async()=>({value:'csrf'})}};
  for(const scenario of ['absent','truncated','wrong-account','still-present','offline']) {
    let posted=false,posts=0;
    globalThis.fetch=async(url,options)=>{
      if(options.method==='POST'){posted=true;posts++;return {ok:true,text:async()=>'{"different":"ack"}'};}
      if(url.endsWith('/feed/atom')) {
        if(posted&&scenario==='offline')throw Error('offline');
        const owner=posted&&scenario==='wrong-account'?'other@example.test':'owner@example.test';
        const entry=!posted||scenario==='still-present'?'<entry><link href="https://mail.google.com/#inbox/abcdef"/></entry>':'';
        const count=posted&&scenario==='truncated'?30:entry?1:0;
        return {ok:true,text:async()=>`<feed><title>Gmail - Inbox for ${owner}</title><fullcount>${count}</fullcount>${entry}</feed>`};
      }
      return {ok:true,text:async()=> 'GM_ID_KEY="key"'};
    };
    await assert.rejects(mutateGmailConversation('owner@example.test','abcdef','trash'),e=>e.uncertain&&e.unreadInboxAbsent===(scenario==='absent'));
    assert.equal(posts,1);
  }
});

test('Gmail takes the action token after uncached session requests can rotate cookies',async()=>{
  const {mutateGmailConversation}=await import('../src/providers/mail-actions.js');
  let cookie='old-session';
  let posts=0;
  globalThis.chrome={cookies:{get:async()=>({value:cookie})}};
  globalThis.fetch=async(url,options)=>{
    if(options.method==='POST') {
      posts++;
      assert.equal(new URL(url).searchParams.get('at'),'current-session');
      return {ok:true,status:200,text:async()=>'["ar",1,"OK"]'};
    }
    assert.equal(options.cache,'no-store','ownership/session reads must not use cached pages');
    if(new URL(url).searchParams.get('view')==='cv')return {ok:true,status:200,text:async()=>exactState(url,['^k'])};
    if(url.endsWith('/feed/atom'))return {ok:true,status:200,text:async()=>'<feed><title>Gmail - Inbox for owner@example.test</title></feed>'};
    cookie='current-session';
    return {ok:true,status:200,text:async()=>'GM_ID_KEY="key"'};
  };
  assert.deepEqual(await mutateGmailConversation('owner@example.test','abcdef','trash'),{id:'abcdef'});
  assert.equal(posts,1);
});

test('Gmail write diagnostics classify replies without logging mail or credentials',async()=>{
  const {mutateGmailConversation}=await import('../src/providers/mail-actions.js');
  let saved={};
  globalThis.chrome={cookies:{get:async()=>({value:'private-csrf'})},storage:{local:{
    get:async()=>structuredClone(saved),set:async value=>{saved=structuredClone(value);}
  }}};
  const captured=[];
  const original=console.info;
  console.info=value=>captured.push(JSON.parse(value));
  try {
    for(const reply of ['["ar",1,"Private subject"]','<script>https://mail.google.com/mail/u/0/spreauth</script>','<html>Private mail and credentials</html>']) {
      globalThis.fetch=async(url,options)=>({ok:true,status:200,text:async()=>options.method==='POST'?reply:new URL(url).searchParams.get('view')==='cv'&&reply.startsWith('["ar"')?exactState(url,['^k']):url.endsWith('/feed/atom')?'<feed><title>Gmail - Inbox for owner@example.test</title><fullcount>0</fullcount></feed>':'GM_ID_KEY="private-key"'});
      if(reply.startsWith('["ar"'))await mutateGmailConversation('owner@example.test','abcdef','trash');
      else await assert.rejects(mutateGmailConversation('owner@example.test','abcdef','trash'),e=>e.uncertain===true);
    }
  } finally {console.info=original;}
  assert.equal(captured.length,3);
  assert.deepEqual(captured.map(event=>event.response),['state-verified','sign-in-challenge','unrecognized']);
  assert.deepEqual(captured.map(event=>event.outcome),['acknowledged','uncertain','uncertain']);
  assert.deepEqual(saved.mailActionDiagnostics,captured,'actual provider outcomes survive console loss');
  for(const event of captured) {
    assert.equal(event.event,'gmail-mail-action');
    assert.equal(event.entryPoint,'popup-mail-action');
    assert.match(event.requestId,/^[0-9a-f-]{36}$/);
    assert.equal(event.action,'trash');assert.equal(event.slot,0);assert.equal(event.status,200);
    assert.doesNotMatch(JSON.stringify(event),/Private|private|owner|abcdef|https|csrf/);
  }
});

test('Gmail session discovery distinguishes transient provider failures from missing login',async()=>{
  const {gmailSession}=await import('../src/providers/mail-actions.js');
  const originalFetch=globalThis.fetch;
  try {
    for(const status of [503,429,401]) {
      globalThis.fetch=async()=>({ok:false,status});
      await assert.rejects(gmailSession('owner@example.test'),e=>e.code===(status===401?'sign-in':'unavailable'));
    }
    globalThis.fetch=async()=>{throw Error('offline');};
    await assert.rejects(gmailSession('owner@example.test'),e=>e.code==='unavailable');
  } finally {globalThis.fetch=originalFetch;}
});
