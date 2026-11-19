import {getAPIToken} from '@netlify/dev-utils';
import {getStore} from '@netlify/blobs';
import {randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';

// This owner-run migration utility never prints provider credentials or keys.
const origin='https://dikshit-portfolio.dkashyap450.workers.dev';
const siteID='030aaf1a-f1d6-4023-90f4-733cda97af4b';
async function ownerKey() {
  await mkdir('.migration-private',{recursive:true,mode:0o700});
  try {return (await readFile('.migration-private/cloudflare-owner-key','utf8')).trim();}
  catch(error) {
    if(error.code!=='ENOENT')throw error;
    const key=randomBytes(32).toString('base64url');
    await writeFile('.migration-private/cloudflare-owner-key',key,{mode:0o600,flag:'wx'});
    return key;
  }
}
async function main() {
  const key=await ownerKey();
  if(process.argv[2]==='configure-key') {
    const child=spawn('node_modules/.bin/wrangler',['secret','put','COROS_OWNER_KEY'],{stdio:['pipe','pipe','pipe']});
    child.stdout.resume();child.stderr.resume();child.stdin.end(key+'\n');
    const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
    if(code!==0)throw new Error('Private key configuration failed');
    console.log('Cloudflare owner key configured privately.');return;
  }
  const headers={Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
  if(process.argv[2]==='status') {
    const response=await fetch(origin+'/api/coros/status',{headers});
    if(!response.ok)throw new Error('Owner status unavailable');
    console.log(JSON.stringify(await response.json(),null,2));return;
  }
  if(process.argv[2]!=='import')throw new Error('Choose configure-key, import or status');
  const token=await getAPIToken();
  if(!token)throw new Error('Netlify sign-in required');
  const store=getStore({name:'coros-owner-private',siteID,token,consistency:'strong'});
  const credentials=await store.get('credentials',{type:'json'});
  const client=await store.get('client',{type:'json'});
  // Do not begin a token handover close to expiry: a coordinated refresh-token
  // transfer is then required before either collector can run.
  if(!credentials?.refreshToken||!client?.clientId||credentials.expiresAt<Date.now()+30*60000)throw new Error('COROS requires a coordinated reconnect before migration');
  const summaries=[];
  const summaryStore=getStore({name:'running-public-summary',siteID,token,consistency:'strong'});
  const year=new Date().getFullYear();
  for(let y=2026;y<=year;y++) {
    const value=await summaryStore.get(String(y),{type:'json'});if(value)summaries.push(value);
  }
  const response=await fetch(origin+'/api/coros/migrate',{method:'POST',headers,body:JSON.stringify({client,credentials,summaries}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`Private import was not accepted (${response.status})`);
  console.log('COROS connection and public summary copied privately. Automatic refresh remains disabled until handover.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
