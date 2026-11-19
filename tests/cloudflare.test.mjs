import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker, {mediumFeed, RunningLog} from '../cloudflare/worker.mjs';
import {storeAdapter} from '../cloudflare/running-log.mjs';
import {mediaAsset} from '../cloudflare/media.mjs';
import {readRpcResponse,createCorosClient} from '../server/coros-core.mjs';
import apexRedirect from '../cloudflare/apex-redirect.mjs';

const origin='https://www.kidshit.space';
const secret='test-only-owner-key-longer-than-thirty-two-characters';
function fixture(vars={}) {
  const map=new Map();let tail=Promise.resolve();
  const storage={
    async get(k){return structuredClone(map.get(k));},
    async put(k,v){map.set(k,structuredClone(v));},
    transaction(fn){const task=tail.then(()=>fn(storage));tail=task.catch(()=>{});return task;},
    async setAlarm(time){storage.alarmAt=time;}
  };
  return {map,storage,log:new RunningLog({storage},{COROS_OWNER_KEY:secret,PUBLIC_ORIGIN:origin,...vars})};
}
const auth={Authorization:`Bearer ${secret}`};
const request=(path,options={})=>new Request(origin+path,options);
const summary={year:2026,coverage:{startDate:'2026-01-01',endDate:'2026-11-19',complete:true},totals:{distanceKm:250,runs:100},lastRun:{date:'2026-11-18',distanceKm:10,route:[1,2]},updatedAt:'2026-11-19T02:00:00Z',accessToken:'never-public'};

test('Cloudflare OAuth state compare-and-set only permits one callback claimant',async()=>{
  const {storage}=fixture(),store=storeAdapter(storage,'private:');
  await store.setJSON('oauth/state',{used:false});
  const {etag}=await store.getWithMetadata('oauth/state');
  const results=await Promise.all([1,2].map(()=>store.setJSON('oauth/state',{used:true},{onlyIfMatch:etag})));
  assert.equal(results.filter(r=>r.modified).length,1);
});
test('Cloudflare public summary retains the strict privacy boundary',async()=>{
  const {log}=fixture();await log.summary.setJSON('2026',summary);
  const response=await log.fetch(request('/api/running-summary?year=2026'));
  assert.equal(response.status,200);
  const text=await response.text();for(const value of ['never-public','route','"runs"'])assert(!text.includes(value));
  assert.equal(JSON.parse(text).totals.distanceKm,250);
  assert.equal((await log.fetch(request('/api/running-summary?year=9999'))).status,400);
  assert.equal((await log.fetch(request('/api/running-summary',{method:'POST'}))).status,405);
});
test('owner connection still requires both the private key and same-site nonce',async()=>{
  const {log}=fixture();
  for (const headers of [{Origin:'https://evil.example'}, {Origin:origin}]) {
    const response=await log.fetch(request('/api/coros/connect',{method:'POST',headers,body:new URLSearchParams({key:secret})}));
    assert.equal(response.status,403);
  }
  const response=await log.fetch(request('/api/coros/connect'));
  assert.equal(response.status,200);assert(response.headers.get('set-cookie').includes('HttpOnly; Secure; SameSite=Strict'));
});
test('Cloudflare callback exchanges privately once and queues a durable alarm',async()=>{
  const {log,storage}=fixture(),state='a'.repeat(43);
  await log.private.setJSON(`oauth/${state}`,{verifier:'private-verifier',createdAt:Date.now(),used:false});
  await log.private.setJSON('client',{clientId:'sample'});
  let exchanges=0;log.tokenRequest=async params=>{exchanges++;assert.equal(params.code_verifier,'private-verifier');return {accessToken:'private-access',refreshToken:'private-refresh',expiresAt:Date.now()+1000000};};
  const callback=()=>request(`/api/coros/callback?code=sample&state=${state}`,{headers:{Cookie:`coros_oauth=${state}`}});
  const response=await log.fetch(callback());assert.equal(response.status,200);
  assert(!(await response.text()).includes('private-access'));assert(storage.alarmAt>Date.now()-100);
  assert.equal((await log.fetch(callback())).status,502);assert.equal(exchanges,1);
});
test('private status, sync and one-time migration reject unauthenticated requests',async()=>{
  const {log}=fixture({MIGRATION_ENABLED:'true'});
  for(const path of ['status','sync','migrate']) assert.equal((await log.fetch(request(`/api/coros/${path}`,{method:path==='status'?'GET':'POST'}))).status,403);
  const payload={client:{clientId:'sample'},credentials:{accessToken:'private',refreshToken:'private-refresh',expiresAt:Date.now()+100000},summaries:[summary]};
  const migrate=()=>request('/api/coros/migrate',{method:'POST',headers:auth,body:JSON.stringify(payload)});
  assert.equal((await log.fetch(migrate())).status,200);
  assert.equal((await log.fetch(migrate())).status,404);
  assert.equal((await log.fetch(request('/api/coros/status',{headers:auth}))).status,200);
  assert.equal((await log.fetch(request('/api/coros/sync',{method:'POST',headers:auth}))).status,202);
});
test('failed refresh preserves the last good summary and releases its lease',async()=>{
  const {log}=fixture();await log.summary.setJSON('2026',summary);
  await assert.rejects(log.sync(),/previous summary retained/);
  assert.deepEqual(await log.summary.get('2026'),summary);
  assert.equal((await log.private.get('sync-lease')).expiresAt,0);
  assert.equal((await log.private.get('sync-status')).status,'failed');
});
test('Medium proxy uses a fixed upstream, caches XML and rejects invalid content',async()=>{
  let calls=0, saved;const cache={match:async()=>saved?.clone(),put:async(k,v)=>{saved=v;}};
  const fetcher=async url=>{calls++;assert.equal(url,'https://medium.com/feed/@dkashyap450');return new Response('<rss version="2.0"><channel/></rss>');};
  const response=await mediumFeed(request('/medium-feed.xml?url=https://evil.example'),cache,fetcher);
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/rss+xml; charset=utf-8');
  assert.equal((await mediumFeed(request('/medium-feed.xml'),cache,fetcher)).status,200);assert.equal(calls,1);
  assert.equal((await mediumFeed(request('/medium-feed.xml'),null,async()=>new Response('<html>blocked</html>'))).status,502);
  assert.equal((await mediumFeed(request('/medium-feed.xml',{method:'POST'}),null,fetcher)).status,405);
});
test('static pages and media pass through unchanged, only explicit API routes reach storage',async()=>{
  const reached=[];const env={ASSETS:{fetch:async r=>{reached.push(new URL(r.url).pathname);return new Response('asset');}},RUNNING:{idFromName:n=>n,get:()=>({fetch:async()=>new Response('private-handler')})}};
  for(const path of ['/','/case-upi-mdr/','/style.css'])assert.equal(await (await worker.fetch(request(path),env)).text(),'asset');
  assert.equal(await (await worker.fetch(request('/api/running-summary'),env)).text(),'private-handler');
  assert.equal((await worker.fetch(request('/api/unknown'),env)).status,404);
  assert.equal(reached.length,3);
});
test('media supports closed, open, suffix, invalid and conditional ranges',async()=>{
  const assets={fetch:async()=>new Response('0123456789',{headers:{'Content-Type':'video/mp4','Content-Length':'10',ETag:'"sample"'}})};
  for(const [range,expected] of [['bytes=0-1','01'],['bytes=8-','89'],['bytes=-3','789'],['bytes=7-999','789']]) {
    const response=await mediaAsset(request('/book/cover.mp4',{headers:{Range:range}}),assets);
    assert.equal(response.status,206);assert.equal(await response.text(),expected);
  }
  for(const range of ['bytes=20-','bytes=7-2','bytes=-0','bytes=0-1,3-4'])assert.equal((await mediaAsset(request('/book/cover.mp4',{headers:{Range:range}}),assets)).status,416);
  const changed=await mediaAsset(request('/book/cover.mp4',{headers:{Range:'bytes=0-1','If-Range':'"old"'}}),assets);
  assert.equal(changed.status,200);assert.equal(await changed.text(),'0123456789');
});
test('daily refresh remains disabled in staging until the old updater is stopped',async()=>{
  const {log,storage}=fixture({SYNC_ENABLED:'false'});
  await log.fetch(new Request('https://internal/schedule',{method:'POST'}));assert.equal(storage.alarmAt,undefined);
  log.env.SYNC_ENABLED='true';await log.fetch(new Request('https://internal/schedule',{method:'POST'}));assert(storage.alarmAt>Date.now()-100);
});
test('COROS replies are consumed before a persistent SSE connection closes',async()=>{
  let cancelled=false;
  const encoder=new TextEncoder();
  const body=new ReadableStream({start(controller){
    controller.enqueue(encoder.encode(': keepalive\n\ndata: {"jsonrpc":"2.0","method":"notification"}\n\n'));
    controller.enqueue(encoder.encode('data: {"jsonrpc":"2.0","id":7,"result":{"ok":true}}\n'));
    controller.enqueue(encoder.encode('\n'));
    // Deliberately remains open. Waiting for response.text() would hang.
  },cancel(){cancelled=true;}});
  assert.deepEqual(await readRpcResponse(new Response(body,{headers:{'Content-Type':'text/event-stream'}}),7),{ok:true});
  assert.equal(cancelled,true);
});
test('COROS uses Cloudflare-compatible redirect mode and rejects redirects before credentials can be forwarded',async()=>{
  let calls=0;
  await assert.rejects(createCorosClient('test-token',async(url,options)=>{
    calls++;assert.equal(options.redirect,'manual');
    return new Response(null,{status:302,headers:{Location:'https://untrusted.example'}});
  }),/COROS request failed \(302\)/);
  assert.equal(calls,1);
});
test('the apex redirect preserves the requested page and query string',()=>{
  const response=apexRedirect.fetch(new Request('https://kidshit.space/case-bbps/?source=resume'));
  assert.equal(response.status,301);
  assert.equal(response.headers.get('location'),'https://www.kidshit.space/case-bbps/?source=resume');
});
