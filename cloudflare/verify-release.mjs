import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const origin=new URL(process.argv[2]);
if(origin.protocol!=='https:' && origin.hostname!=='localhost') throw new Error('HTTPS required');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const path of ['/','/case-upi-mdr/','/case-bbps/','/case-upi/','/resume.pdf','/theme.js','/printer/intro.js']) {
  const response=await fetch(new URL(path,origin),{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`${path}: ${response.status}`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  const file=path==='/'?'dist/index.html':path.endsWith('/')?`dist${path}index.html`:`dist${path}`;
  if(hash(bytes)!==hash(await readFile(file)))throw new Error(`${path}: content mismatch`);
  console.log(`${path}: verified`);
}
const video=await fetch(new URL('/printer/printer-printing.mp4',origin),{headers:{Range:'bytes=0-127'},signal:AbortSignal.timeout(20000)});
if(video.status!==206||!video.headers.get('content-range')?.startsWith('bytes 0-127/'))throw new Error('Video byte ranges unavailable');
console.log('Printer video: byte ranges verified');
const feed=await fetch(new URL('/medium-feed.xml',origin),{signal:AbortSignal.timeout(20000)});
if(!feed.ok||!/<rss[\s>]/i.test(await feed.text()))throw new Error(`Medium feed: ${feed.status}`);
console.log('Medium RSS: verified');
const stats=await fetch(new URL('/api/running-summary',origin),{signal:AbortSignal.timeout(20000)});
const data=await stats.json();
if(stats.status===503 && data.status==='unavailable')console.log('COROS: private connection not migrated yet');
else if(!stats.ok||data.status!=='success')throw new Error('Running summary failed');
else console.log(`COROS: summary available, updated ${data.updatedAt}`);
