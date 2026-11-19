import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
const maps=new Map();
mock.module('@netlify/blobs',{namedExports:{getStore:({name})=>{
  if (!maps.has(name)) maps.set(name,new Map());const map=maps.get(name);
  return {async get(k){return map.get(k)?.data ?? null;},async getWithMetadata(k){return map.get(k)??null;},async setJSON(k,data,opts={}){
    const old=map.get(k);if((opts.onlyIfNew&&old)||(opts.onlyIfMatch&&old?.etag!==opts.onlyIfMatch))return {modified:false};
    const etag=String(Math.random());map.set(k,{data,etag});return {modified:true,etag};
  }};
}}});
const {default:connect}=await import('../netlify/functions/coros-connect.mjs');
const {default:callback}=await import('../netlify/functions/coros-callback.mjs');
const {default:publicSummary}=await import('../netlify/functions/running-summary.mjs');
const {default:background}=await import('../netlify/functions/coros-sync-background.mjs');
const {ORIGIN,CALLBACK,RESOURCE}=await import('../server/coros-core.mjs');
const secret='test-only-private-key-that-is-over-32-characters';
test('owner gate rejects cross-origin and incorrect setup keys',async()=>{
  process.env.COROS_OWNER_KEY=secret;
  for (const [origin,key] of [['https://other.example',secret],[ORIGIN,'wrong']]) {
    const r=await connect(new Request(`${ORIGIN}/api/coros/connect`,{method:'POST',headers:{Origin:origin},body:new URLSearchParams({key})}));assert.equal(r.status,403);
  }
});
test('owner connection uses PKCE, offline scope, secure cookie and private verifier',async()=>{
  const old=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{assert(url.endsWith('/connect/register'));const data=JSON.parse(options.body);assert.deepEqual(data.redirect_uris,[CALLBACK]);return Response.json({client_id:'sample-client'});};
  try {
    const csrf='c'.repeat(43);
    const r=await connect(new Request(`${ORIGIN}/api/coros/connect`,{method:'POST',headers:{Origin:'null',Cookie:`coros_setup=${csrf}`},body:new URLSearchParams({key:secret,csrf})}));assert.equal(r.status,200);
    const html=await r.text();const url=new URL(html.match(/href="([^"]+)"/)[1].replaceAll('&amp;','&'));assert.equal(url.searchParams.get('resource'),RESOURCE);assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert(url.searchParams.get('scope').includes('offline_access'));
    assert(!url.searchParams.has('code_verifier'));const cookie=r.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=Lax'])assert(cookie.includes(flag));
    const state=url.searchParams.get('state');assert(maps.get('coros-owner-private').get(`oauth/${state}`).data.verifier);
  } finally {globalThis.fetch=old;}
});
test('owner form requires its same-site nonce even with a valid private key',async()=>{
  const r=await connect(new Request(`${ORIGIN}/api/coros/connect`,{method:'POST',headers:{Origin:ORIGIN},body:new URLSearchParams({key:secret})}));assert.equal(r.status,403);
});
test('callback rejects missing cookie and expired state before token exchange',async()=>{
  let r=await callback(new Request(`${CALLBACK}?code=x&state=${'a'.repeat(43)}`));assert.equal(r.status,400);
  maps.get('coros-owner-private').set(`oauth/${'a'.repeat(43)}`,{data:{createdAt:0,used:false,verifier:'private'},etag:'one'});
  r=await callback(new Request(`${CALLBACK}?code=x&state=${'a'.repeat(43)}`,{headers:{Cookie:`coros_oauth=${'a'.repeat(43)}`}}));assert.equal(r.status,502);
});
test('successful callback stores tokens privately and cannot be replayed',async()=>{
  const state='b'.repeat(43),map=maps.get('coros-owner-private');
  map.set(`oauth/${state}`,{data:{createdAt:Date.now(),used:false,verifier:'sample-private-verifier'},etag:'fresh'});
  const old=globalThis.fetch;let exchanges=0;
  globalThis.fetch=async(url,options)=>{
    if(url.endsWith('/oauth2/token')){
      exchanges++;const body=new URLSearchParams(options.body);assert.equal(body.get('code_verifier'),'sample-private-verifier');
      return Response.json({access_token:'private-access',refresh_token:'private-refresh',expires_in:2592000});
    }
    assert(url.endsWith('/coros-sync-background'));assert.equal(options.headers.Authorization,`Bearer ${secret}`);return new Response(null,{status:202});
  };
  try{
    const request=()=>new Request(`${CALLBACK}?code=sample-code&state=${state}`,{headers:{Cookie:`coros_oauth=${state}`}});
    const response=await callback(request());assert.equal(response.status,200);assert(!(await response.text()).includes('private-access'));
    assert.equal(map.get('credentials').data.refreshToken,'private-refresh');assert.equal((await callback(request())).status,502);assert.equal(exchanges,1);
  }finally{globalThis.fetch=old;}
});
test('public endpoint reveals only two display metrics and coverage metadata',async()=>{
  const map=maps.get('running-public-summary') || new Map();maps.set('running-public-summary',map);
  map.set('2026',{data:{coverage:{startDate:'2026-01-01',endDate:'2026-10-29',complete:true},totals:{distanceKm:100,runs:999},lastRun:{date:'2026-10-27',distanceKm:9.09,coordinates:[1,2]},updatedAt:'2026-10-29T12:00:00Z',accessToken:'must-never-leak',runningDates:['private']}});
  const response=await publicSummary(new Request(`${ORIGIN}/api/running-summary?year=2026`));assert.equal(response.status,200);const text=await response.text();
  for(const privateValue of ['must-never-leak','coordinates','runningDates','"runs"']) assert(!text.includes(privateValue));
  assert.equal((await publicSummary(new Request(`${ORIGIN}/api/running-summary?year=9999`))).status,400);
});
test('background invocation without private authorization cannot read owner data',async()=>{
  assert.equal(await background(new Request(`${ORIGIN}/.netlify/functions/coros-sync-background`,{method:'POST'})),undefined);
});
