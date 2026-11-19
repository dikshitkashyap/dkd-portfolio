import {getAPIToken} from '@netlify/dev-utils';
import {NetlifyAPI} from '@netlify/api';
import {getStore} from '@netlify/blobs';
import {mkdir,writeFile} from 'node:fs/promises';

const token=await getAPIToken();
if(!token)throw new Error('Netlify sign-in required');
const api=new NetlifyAPI(token),siteID='030aaf1a-f1d6-4023-90f4-733cda97af4b';
const site=await api.getSite({site_id:siteID});
const zones=await api.getDnsZones({site_id:siteID});
const zone=zones.find(z=>z.name==='kidshit.space'||z.domain==='kidshit.space');
if(!zone)throw new Error('Domain DNS zone not found');
const full=await api.getDnsZone({zone_id:zone.id});
await mkdir('.migration-private',{recursive:true,mode:0o700});
await writeFile('.migration-private/netlify-dns-backup.json',JSON.stringify(full,null,2),{mode:0o600});
const store=getStore({name:'coros-owner-private',siteID,token,consistency:'strong'});
const credentials=await store.get('credentials',{type:'json'});
const client=await store.get('client',{type:'json'});
const lease=await store.get('sync-lease',{type:'json'});
console.log(JSON.stringify({
  site:site.name,domain:site.custom_domain,zoneId:zone.id,
  dnsRecords:full.records.map(r=>({name:r.hostname,type:r.type,value:r.value,priority:r.priority,ttl:r.ttl})),
  coros:{connected:!!credentials?.refreshToken,clientPresent:!!client?.clientId,accessTokenCurrentlyValid:credentials?.expiresAt>Date.now()+300000,collectorBusy:lease?.expiresAt>Date.now()}
},null,2));
