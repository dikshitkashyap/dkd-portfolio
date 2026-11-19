import { RESOURCE, CALLBACK } from '../../server/coros-core.mjs';
import { privateStore, tokenRequest, queueSync, page } from '../../server/coros-state.mjs';
export default async request => {
  const url=new URL(request.url),state=url.searchParams.get('state'),code=url.searchParams.get('code');
  const cookie=request.headers.get('cookie')?.match(/(?:^|;\s*)coros_oauth=([^;]+)/)?.[1];
  if (request.method!=='GET' || !state || !/^[\w-]{43}$/.test(state) || state!==cookie || !code || url.searchParams.has('error')) return page('<p>Connection was not completed. Start again from the private connection page.</p>',400);
  try {
    const store=privateStore();
    const item=await store.getWithMetadata(`oauth/${state}`,{type:'json'});
    if (!item || item.data.used || Date.now()-item.data.createdAt>600000) throw new Error('Expired connection');
    const claim=await store.setJSON(`oauth/${state}`,{used:true},{onlyIfMatch:item.etag});
    if (!claim.modified) throw new Error('Connection already used');
    const client=await store.get('client',{type:'json'});
    const tokens=await tokenRequest({grant_type:'authorization_code',code,redirect_uri:CALLBACK,client_id:client.clientId,code_verifier:item.data.verifier,resource:RESOURCE});
    if (!tokens.refreshToken) throw new Error('Offline authorization was not granted');
    await store.setJSON('credentials',tokens);
    let queued=true;try {await queueSync();} catch {queued=false;}
    return page(`<p>COROS is connected. ${queued?'The first running summary is being prepared.':'The first summary will be prepared at the next daily update.'} Future updates run once a day at 7:30 am India time.</p><p><a href="/#running">Back to portfolio</a></p>`,200,{'Set-Cookie':'coros_oauth=; HttpOnly; Secure; SameSite=Lax; Path=/api/coros; Max-Age=0'});
  } catch { return page('<p>The COROS connection could not be completed. Please start again from the private connection page.</p>',502); }
};
export const config={path:'/api/coros/callback'};
