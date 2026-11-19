import { randomBytes, createHash } from 'node:crypto';
import { ISSUER, RESOURCE, ORIGIN, CALLBACK } from '../../server/coros-core.mjs';
import { privateStore, authorized, page } from '../../server/coros-state.mjs';
export default async request => {
  if (!process.env.COROS_OWNER_KEY || process.env.COROS_OWNER_KEY.length<32) return page('<p>The private updater is not configured yet.</p>',503);
  if (request.method==='GET') {
    const csrf=randomBytes(32).toString('base64url');
    return page(`<p>Owner-only connection. This authorizes the private daily updater. Visitors see only running kilometres and the latest run’s distance and date.</p><form method="post"><input type="hidden" name="csrf" value="${csrf}"><label>Private setup key<input type="password" name="key" required autocomplete="off"></label><button>Connect my COROS account</button></form><p><a href="/#running">Back to portfolio</a></p>`,200,{'Set-Cookie':`coros_setup=${csrf}; HttpOnly; Secure; SameSite=Strict; Path=/api/coros; Max-Age=600`});
  }
  if (request.method!=='POST') return page('<p>Method not allowed.</p>',405);
  const origin=request.headers.get('origin');
  if ((origin && origin!=='null' && origin!==ORIGIN) || Number(request.headers.get('content-length')||0)>2048) return page('<p>Request not allowed.</p>',403);
  const body=await request.text();
  if (body.length>2048) return page('<p>Request not allowed.</p>',403);
  const form=new URLSearchParams(body);
  const csrf=request.headers.get('cookie')?.match(/(?:^|;\s*)coros_setup=([^;]+)/)?.[1];
  // A no-referrer form POST may have an opaque Origin. Require its same-site cookie and nonce regardless.
  if (!csrf || !/^[\w-]{43}$/.test(csrf) || form.get('csrf')!==csrf) return page('<p>Reload the connection page and try again.</p>',403);
  if (!authorized(form.get('key'))) return page('<p>Incorrect setup key.</p>',403);
  try {
    const store=privateStore();
    let client=await store.get('client',{type:'json'});
    if (!client) {
      const response=await fetch(`${ISSUER}/connect/register`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json'},body:JSON.stringify({client_name:'Dikshit portfolio running log',redirect_uris:[CALLBACK],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none'})});
      if (!response.ok) throw new Error(`Client registration failed (${response.status})`);
      const data=await response.json();
      if (typeof data.client_id!=='string' || data.client_secret) throw new Error('Unsupported client registration');
      client={clientId:data.client_id};await store.setJSON('client',client);
    }
    const state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
    await store.setJSON(`oauth/${state}`,{verifier,createdAt:Date.now(),used:false});
    const url=new URL(`${ISSUER}/oauth2/authorize`);
    url.search=new URLSearchParams({client_id:client.clientId,response_type:'code',redirect_uri:CALLBACK,scope:'openid mcp.tools offline_access',resource:RESOURCE,state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
    // Use a normal navigation link: browsers differ in how form CSP applies to OAuth redirect chains.
    return page(`<p>The private connection is ready.</p><p><a href="${url.href.replaceAll('&','&amp;')}">Continue to COROS</a></p><p>Sign in and review COROS’s authorization screen. The updater only queries running records.</p>`,200,{'Set-Cookie':`coros_oauth=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api/coros; Max-Age=600`});
  } catch (error) { console.warn('COROS connection setup failed:',error.name); return page('<p>Could not start the COROS connection. Try again later.</p>',502); }
};
export const config={path:'/api/coros/connect'};
