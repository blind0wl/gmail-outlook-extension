import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectGmailTrash, parseGmailSearchTargets } from '../src/providers/gmail-trash-verification.js';

function searchReply(ids) {
  const rows=ids.map(id=>{
    const row=Array(12).fill(null);
    row[3]='Private subject';row[4]='Private body';row[11]=id;
    return row;
  });
  return JSON.stringify([null,[[null,null,[null,null,null,null,null,rows]]]]);
}
const frame=value=>`${new TextEncoder().encode(value).length}&${value}`;

test('search parser recognizes bounded JSON and byte-framed replies without exposing content',()=>{
  const raw=searchReply(['abcdef','123abc']);
  for(const text of [raw,")]}'\n"+frame('[null]')+'\n'+frame(raw),frame(raw.replace('Private subject','Private café'))]) {
    assert.deepEqual(parseGmailSearchTargets(text),{recognized:true,ids:['abcdef','123abc'],returned:2});
  }
  for(const text of ['', '<html>Private body</html>',frame(raw).slice(0,-1),frame(raw)+'trailing junk',searchReply(['not-a-hex-id'])]) {
    assert.deepEqual(parseGmailSearchTargets(text),{recognized:false,ids:[],returned:0});
  }
});

test('existing targets are verified by a query-only POST, without mutations or persisted mail',async()=>{
  const previousFetch=globalThis.fetch,previousChrome=globalThis.chrome;
  const calls=[];
  globalThis.chrome={cookies:{get:async()=>({value:'private-token'})}};
  globalThis.fetch=async(url,options)=>{
    calls.push({url,...options});
    const text=options.method==='POST' ? frame(searchReply(['abcdef']))
      :url.endsWith('/feed/atom') ? '<feed><title>Gmail - Inbox for owner@example.test</title><fullcount>0</fullcount></feed>'
      :'GM_ID_KEY="private-session"';
    return {ok:true,status:200,text:async()=>text};
  };
  try {
    const result=await inspectGmailTrash('owner@example.test',['abcdef','123abc']);
    assert.deepEqual(result,{ok:true,status:200,returned:1,results:['verified-trash','not-confirmed']});
    const posts=calls.filter(c=>c.method==='POST');
    assert.equal(posts.length,1);
    const query=JSON.parse(posts[0].body.get('s_jr'));
    assert.equal(query[1][1][1][1],'in:trash');
    assert.equal(query[1][1][1][4],80);
    assert.equal(query[1].length,2);
    assert.equal(query[1][0][3],null,'query has no action code or target payload');
    assert.equal(posts[0].body.has('t'),false);
    assert.ok(calls.every(c=>c.cache==='no-store'));
    assert.doesNotMatch(JSON.stringify(result),/private|owner|abcdef|123abc|https/i);
  } finally {globalThis.fetch=previousFetch;globalThis.chrome=previousChrome;}
});

test('unrecognized search, transport failure and changed ownership never verify Trash',async()=>{
  const previousFetch=globalThis.fetch,previousChrome=globalThis.chrome;
  globalThis.chrome={cookies:{get:async()=>({value:'private-token'})}};
  try {
    for(const mode of ['unknown','failed','swapped']) {
      let afterQuery=false;
      globalThis.fetch=async(url,options)=>{
        if(options.method==='POST') {
          afterQuery=true;
          if(mode==='failed')throw Error('private exception');
          return {ok:true,status:200,text:async()=>mode==='unknown'?'<html>private reply</html>':searchReply(['abcdef'])};
        }
        return {ok:true,status:200,text:async()=>url.endsWith('/feed/atom')
          ?`<feed><title>Gmail - Inbox for ${afterQuery&&mode==='swapped'?'other@example.test':'owner@example.test'}</title><fullcount>0</fullcount></feed>`
          :'GM_ID_KEY="private-session"'};
      };
      const result=await inspectGmailTrash('owner@example.test',['abcdef']);
      assert.equal(result.ok,false);
      assert.deepEqual(result.results,['not-confirmed']);
      assert.doesNotMatch(JSON.stringify(result),/private|owner|abcdef|other|https/i);
    }
  } finally {globalThis.fetch=previousFetch;globalThis.chrome=previousChrome;}
});

test('invalid or oversized target batches never access provider',async()=>{
  const previousFetch=globalThis.fetch;
  let calls=0;globalThis.fetch=async()=>{calls++;};
  try {
    for(const ids of [[],['bad/id'],Array(81).fill('abcdef')]) {
      assert.equal((await inspectGmailTrash('owner@example.test',ids)).code,'invalid-targets');
    }
    assert.equal(calls,0);
  } finally {globalThis.fetch=previousFetch;}
});
