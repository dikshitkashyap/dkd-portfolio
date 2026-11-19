import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const origin=new URL(process.argv[2]);
if(origin.protocol!=='https:' && origin.hostname!=='localhost') throw new Error('HTTPS required');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const path of ['/','/case-upi-mdr/','/case-bbps/','/case-upi/','/resume.pdf','/theme.js','/printer/intro.js','/book/pages.json']) {
  const response=await fetch(new URL(path,origin),{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`${path}: ${response.status}`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  const file=path==='/'?'dist/index.html':path.endsWith('/')?`dist${path}index.html`:`dist${path}`;
  if(hash(bytes)!==hash(await readFile(file)))throw new Error(`${path}: content mismatch`);
  console.log(`${path}: verified`);
}
for(const path of ['/printer/printer-printing.mp4','/book/cover.mp4','/assets/audio/ambre.mp3','/assets/audio/paper-click.mp3','/printer/printer-sound.mp3']) {
  const media=await fetch(new URL(path,origin),{headers:{Range:'bytes=0-127'},signal:AbortSignal.timeout(20000)});
  if(media.status!==206||!media.headers.get('content-range')?.startsWith('bytes 0-127/'))throw new Error(`${path}: byte ranges unavailable`);
  const bytes=new Uint8Array(await media.arrayBuffer());
  if(hash(bytes)!==hash((await readFile('dist'+path)).subarray(0,128)))throw new Error(`${path}: partial content mismatch`);
}
console.log('All five media files: byte ranges verified');
const feed=await fetch(new URL('/medium-feed.xml',origin),{signal:AbortSignal.timeout(20000)});
if(!feed.ok||!/<rss[\s>]/i.test(await feed.text()))throw new Error(`Medium feed: ${feed.status}`);
console.log('Medium RSS: verified');
const stats=await fetch(new URL('/api/running-summary',origin),{signal:AbortSignal.timeout(20000)});
const data=await stats.json();
if(stats.status===503 && data.status==='unavailable')console.log('COROS: private connection not migrated yet');
else if(!stats.ok||data.status!=='success')throw new Error('Running summary failed');
else console.log(`COROS: summary available, updated ${data.updatedAt}`);
const privateStatus=await fetch(new URL('/api/coros/status',origin),{signal:AbortSignal.timeout(15000)});
if(privateStatus.status!==403)throw new Error('Owner endpoint is not protected');
console.log('Owner endpoint: private');
if(origin.hostname==='www.kidshit.space') {
  const apex=await fetch('https://kidshit.space/case-bbps/?source=migration',{redirect:'manual',signal:AbortSignal.timeout(20000)});
  if(apex.status!==301||apex.headers.get('location')!=='https://www.kidshit.space/case-bbps/?source=migration')throw new Error('Apex redirect failed');
  console.log('Apex HTTPS redirect: verified with path and query preserved');
}
