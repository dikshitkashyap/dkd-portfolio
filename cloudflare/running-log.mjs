import {createHash, timingSafeEqual, randomUUID} from 'node:crypto';
import {ISSUER, RESOURCE, createCorosClient, collectWindow, makeSummary, monthWindows, localDate} from '../server/coros-core.mjs';
import {connect, callback} from './coros-auth.mjs';

const json = (data, status=200, cache='no-store') => new Response(JSON.stringify(data), {
  status, headers:{'Content-Type':'application/json','Cache-Control':cache,'X-Content-Type-Options':'nosniff'}
});
const page = (text, status=200, extra={}) => new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Portfolio · COROS</title><style>body{font:16px/1.6 system-ui;max-width:580px;margin:10vh auto;padding:24px;background:#fafaf8;color:#151615}input,button{font:inherit;padding:12px;margin:8px 0}input{display:block;width:90%}a{color:inherit}</style><h1>Running log</h1>${text}</html>`, {
  status, headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
    'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",...extra}
});

// SQLite-backed Durable Object storage is private and strongly consistent.
// Compare-and-set transactions keep OAuth callbacks single-use and syncs exclusive.
export function storeAdapter(storage, prefix) {
  return {
    async get(key) { return (await storage.get(prefix+key))?.data ?? null; },
    async getWithMetadata(key) { return await storage.get(prefix+key) ?? null; },
    async setJSON(key, data, options={}) {
      return storage.transaction(async tx => {
        const old = await tx.get(prefix+key);
        if ((options.onlyIfNew && old) || (options.onlyIfMatch && old?.etag !== options.onlyIfMatch)) return {modified:false};
        const etag = randomUUID();
        await tx.put(prefix+key, {data, etag});
        return {modified:true, etag};
      });
    }
  };
}

export class RunningLog {
  constructor(ctx, env) {
    this.ctx=ctx; this.env=env;
    this.private=storeAdapter(ctx.storage,'private:');
    this.summary=storeAdapter(ctx.storage,'summary:');
  }
  authorized(value) {
    const secret=this.env.COROS_OWNER_KEY;
    return typeof secret==='string' && secret.length>=32 && typeof value==='string' && timingSafeEqual(
      createHash('sha256').update(secret).digest(), createHash('sha256').update(value).digest());
  }
  async tokenRequest(params) {
    const response=await fetch(`${ISSUER}/oauth2/token`, {method:'POST',redirect:'manual',signal:AbortSignal.timeout(20000),
      headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});
    if (!response.ok) throw new Error('COROS authorization needs reconnecting');
    const data=await response.json();
    if (typeof data.access_token!=='string' || !Number.isFinite(Number(data.expires_in)) || Number(data.expires_in)<=0) throw new Error('Invalid COROS token response');
    return {accessToken:data.access_token,refreshToken:data.refresh_token,expiresAt:Date.now()+Number(data.expires_in)*1000};
  }
  async ownerAccess() {
    let tokens=await this.private.get('credentials');
    if (!tokens) throw new Error('COROS has not been authorized');
    if (tokens.expiresAt<Date.now()+300000) {
      const client=await this.private.get('client');
      const fresh=await this.tokenRequest({grant_type:'refresh_token',refresh_token:tokens.refreshToken,client_id:client.clientId,resource:RESOURCE});
      tokens={...fresh,refreshToken:fresh.refreshToken||tokens.refreshToken};
      await this.private.setJSON('credentials',tokens);
    }
    return tokens.accessToken;
  }
  async queueSync() { await this.ctx.storage.setAlarm(Date.now()+1000); }
  services() {
    const ORIGIN=this.env.PUBLIC_ORIGIN || 'https://www.kidshit.space';
    return {ORIGIN,CALLBACK:`${ORIGIN}/api/coros/callback`,ownerKey:this.env.COROS_OWNER_KEY,
      privateStore:()=>this.private,authorized:value=>this.authorized(value),page,
      tokenRequest:params=>this.tokenRequest(params),queueSync:()=>this.queueSync()};
  }
  async publicSummary(request) {
    if (request.method!=='GET') return json({status:'unavailable'},405);
    const current=Number(localDate().slice(0,4));
    const year=Number(new URL(request.url).searchParams.get('year')||current);
    if (!Number.isInteger(year)||year<2026||year>current) return json({status:'unavailable'},400);
    try {
      const data=await this.summary.get(String(year));
      if (!data) return json({status:'unavailable'},503);
      return json({status:'success',source:'COROS',version:2,year,
        coverage:{startDate:data.coverage.startDate,endDate:data.coverage.endDate,complete:data.coverage.complete},
        totals:{distanceKm:data.totals.distanceKm},lastRun:data.lastRun?{date:data.lastRun.date,distanceKm:data.lastRun.distanceKm}:null,
        updatedAt:data.updatedAt},200,'public, max-age=300, s-maxage=3600');
    } catch { return json({status:'unavailable'},503); }
  }
  async migrate(request) {
    if (this.env.MIGRATION_ENABLED!=='true' || await this.private.get('migration-complete')) return json({status:'unavailable'},404);
    const text=await request.text();
    if (text.length>32000) return json({status:'unavailable'},413);
    let data;
    try { data=JSON.parse(text); } catch { return json({status:'unavailable'},400); }
    if (typeof data.client?.clientId!=='string' || typeof data.credentials?.accessToken!=='string' ||
        typeof data.credentials?.refreshToken!=='string' || !Number.isFinite(data.credentials?.expiresAt)) return json({status:'unavailable'},400);
    // Imported credentials never enter the static assets or public summary.
    const accepted=await this.ctx.storage.transaction(async tx=>{
      if (await tx.get('private:migration-complete') || await tx.get('private:credentials')) return false;
      const put=(key,value)=>tx.put(key,{data:value,etag:randomUUID()});
      await put('private:client',{clientId:data.client.clientId});
      await put('private:credentials',{accessToken:data.credentials.accessToken,refreshToken:data.credentials.refreshToken,expiresAt:data.credentials.expiresAt});
      for (const summary of data.summaries||[]) {
        if (Number.isInteger(summary.year) && summary.year>=2026 && summary.coverage?.complete && Number.isFinite(summary.totals?.distanceKm)) {
          await put(`summary:${summary.year}`,summary);
        }
      }
      await put('private:migration-complete',{at:new Date().toISOString()});
      return true;
    });
    return json({status:accepted?'imported':'unavailable'},accepted?200:409);
  }
  async fetch(request) {
    const path=new URL(request.url).pathname;
    // Only the outer Worker can reach this private binding URL.
    if (request.url==='https://internal/schedule' && request.method==='POST') {
      if (this.env.SYNC_ENABLED==='true') await this.queueSync();
      return json({status:'queued'});
    }
    if (path==='/api/running-summary') return this.publicSummary(request);
    if (path==='/api/coros/connect') return connect(request,this.services());
    if (path==='/api/coros/callback') return callback(request,this.services());
    if (!this.authorized(request.headers.get('authorization')?.replace(/^Bearer /,''))) return json({status:'unavailable'},403);
    if (path==='/api/coros/status' && request.method==='GET') return json({
      connected:!!(await this.private.get('credentials')),syncEnabled:this.env.SYNC_ENABLED==='true',
      sync:await this.private.get('sync-status'),lastSuccess:await this.private.get('last-success')
    });
    if (path==='/api/coros/sync' && request.method==='POST') {await this.queueSync();return json({status:'queued'},202);}
    if (path==='/api/coros/migrate' && request.method==='POST') return this.migrate(request);
    return json({status:'unavailable'},404);
  }
  async alarm() { await this.sync(); }
  async sync() {
    const store=this.private, owner=randomUUID(), current=await store.getWithMetadata('sync-lease');
    if (current?.data.expiresAt>Date.now()) return;
    const lease=await store.setJSON('sync-lease',{owner,expiresAt:Date.now()+16*60000},current?{onlyIfMatch:current.etag}:{onlyIfNew:true});
    if (!lease.modified) return;
    let phase='credentials';
    try {
      const today=localDate();
      if ((await store.get('last-success'))?.date===today) return;
      const access=await this.ownerAccess();phase='mcp-initialize';
      const query=await createCorosClient(access,async(url,options)=>{
        phase=`mcp-${JSON.parse(options.body).method.replaceAll('/','-')}-headers`;
        const response=await fetch(url,options);
        phase=phase.replace(/-headers$/,'-body');
        return response;
      }), rows=[];
      for (const [start,end] of monthWindows(today)) {
        phase=`collect-${start.slice(0,7)}`;
        rows.push(...await collectWindow(query,start,end));
      }
      phase='summary';
      const summary=makeSummary(rows);
      await this.summary.setJSON(String(summary.year),summary);
      await store.setJSON('last-success',{date:today,updatedAt:summary.updatedAt});
      await store.setJSON('sync-status',{status:'ready',updatedAt:summary.updatedAt});
    } catch (error) {
      const message=String(error?.message||'');
      const reason=/^(COROS (query failed|protocol error|request failed \(\d{3}\)|running query unavailable|authorization needs reconnecting|has not been authorized)|Unrecognized or incomplete COROS response|Invalid COROS running record|Daily COROS result limit reached|Latest run time is ambiguous|Conflicting duplicate activity|Invalid COROS token response)$/.test(message)?message:'Internal refresh error';
      const errorClass=['Error','TypeError','SyntaxError','TimeoutError','AbortError'].includes(error?.name)?error.name:'Error';
      await store.setJSON('sync-status',{status:'failed',phase,reason,errorClass,attemptedAt:new Date().toISOString()});
      // No provider response, activity details, credentials or request URL is logged.
      throw new Error('Daily running refresh failed; previous summary retained');
    } finally {
      const latest=await store.getWithMetadata('sync-lease');
      if (latest?.data.owner===owner) await store.setJSON('sync-lease',{owner,expiresAt:0},{onlyIfMatch:latest.etag});
    }
  }
}
