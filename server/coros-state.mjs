import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ISSUER, ORIGIN, RESOURCE } from './coros-core.mjs';
export const privateStore = () => getStore({name:'coros-owner-private',consistency:'strong'});
export const summaryStore = () => getStore({name:'running-public-summary',consistency:'strong'});
export function authorized(value) {
  const secret = process.env.COROS_OWNER_KEY;
  return secret?.length >= 32 && typeof value === 'string' && timingSafeEqual(createHash('sha256').update(value).digest(),createHash('sha256').update(secret).digest());
}
export function json(data,status=200,cache='no-store') {
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':cache,'X-Content-Type-Options':'nosniff'}});
}
export function page(text,status=200,extra={}) {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Portfolio · COROS</title><style>body{font:16px/1.6 system-ui;max-width:580px;margin:10vh auto;padding:24px;background:#fafaf8;color:#151615}input,button{font:inherit;padding:12px;margin:8px 0}input{display:block;width:90%}a{color:inherit}</style><h1>Running log</h1>${text}</html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",...extra}});
}
export async function queueSync() {
  const response = await fetch(`${ORIGIN}/.netlify/functions/coros-sync-background`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),headers:{Authorization:`Bearer ${process.env.COROS_OWNER_KEY}`}});
  if (response.status !== 202) throw new Error('Could not start COROS refresh');
}
export async function tokenRequest(params) {
  const response = await fetch(`${ISSUER}/oauth2/token`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});
  if (!response.ok) throw new Error('COROS authorization needs reconnecting');
  const data = await response.json();
  if (typeof data.access_token !== 'string' || !Number.isFinite(Number(data.expires_in)) || Number(data.expires_in)<=0) throw new Error('Invalid COROS token response');
  return {accessToken:data.access_token,refreshToken:data.refresh_token,expiresAt:Date.now()+Number(data.expires_in)*1000};
}
export async function ownerAccess() {
  const store=privateStore();
  let tokens=await store.get('credentials',{type:'json'});
  if (!tokens) throw new Error('COROS has not been authorized');
  if (tokens.expiresAt < Date.now()+300000) {
    const client=await store.get('client',{type:'json'});
    const renewed=await tokenRequest({grant_type:'refresh_token',refresh_token:tokens.refreshToken,client_id:client.clientId,resource:RESOURCE});
    tokens={...renewed,refreshToken:renewed.refreshToken || tokens.refreshToken};
    await store.setJSON('credentials',tokens);
  }
  return tokens.accessToken;
}
