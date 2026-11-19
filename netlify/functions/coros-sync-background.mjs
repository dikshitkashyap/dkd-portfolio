import { randomUUID } from 'node:crypto';
import { privateStore, summaryStore, authorized, ownerAccess } from '../../server/coros-state.mjs';
import { createCorosClient, collectWindow, makeSummary, monthWindows, localDate } from '../../server/coros-core.mjs';
export default async request => {
  if (request.method!=='POST' || !authorized(request.headers.get('authorization')?.replace(/^Bearer /,''))) return;
  const store=privateStore(),owner=randomUUID();
  // A renewable lease prevents overlapping refresh-token use and duplicate collectors.
  const current=await store.getWithMetadata('sync-lease',{type:'json'});
  if (current?.data.expiresAt>Date.now()) return;
  const lease=await store.setJSON('sync-lease',{owner,expiresAt:Date.now()+16*60000},current?{onlyIfMatch:current.etag}:{onlyIfNew:true});
  if (!lease.modified) return;
  let phase='credentials';
  try {
    const today=localDate();
    const last=await store.get('last-success',{type:'json'});
    if (last?.date===today) return;
    const access=await ownerAccess();
    phase='mcp-initialize';
    const query=await createCorosClient(access);
    const rows=[];
    for (const [start,end] of monthWindows(today)) {
      phase=`collect-${start.slice(0,7)}`;
      rows.push(...await collectWindow(query,start,end));
    }
    phase='summary';
    const summary=makeSummary(rows);
    await summaryStore().setJSON(String(summary.year),summary);
    await store.setJSON('last-success',{date:today,updatedAt:summary.updatedAt});
    await store.setJSON('sync-status',{status:'ready',updatedAt:summary.updatedAt});
  } catch (error) {
    const message=String(error?.message || '');
    const safe=/^(COROS (query failed|protocol error|request failed \(\d{3}\)|running query unavailable|authorization needs reconnecting|has not been authorized)|Unrecognized or incomplete COROS response|Invalid COROS running record|Daily COROS result limit reached|Latest run time is ambiguous|Conflicting duplicate activity|Invalid COROS token response)$/.test(message) ? message : 'Internal refresh error';
    console.error('COROS refresh diagnostic',JSON.stringify({phase,reason:safe}));
    // Preserve the last good summary and its timestamp. No provider payload or token is logged.
    await store.setJSON('sync-status',{status:'failed',attemptedAt:new Date().toISOString()});
    throw new Error('COROS daily refresh failed; previous summary retained');
  } finally {
    const latest=await store.getWithMetadata('sync-lease',{type:'json'});
    if (latest?.data.owner===owner) await store.setJSON('sync-lease',{owner,expiresAt:0},{onlyIfMatch:latest.etag});
  }
};
export const config={background:true};
