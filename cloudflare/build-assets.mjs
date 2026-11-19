import {cp, mkdir, rm, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {basename,join,sep} from 'node:path';

const source=fileURLToPath(new URL('../dist/',import.meta.url));
const destination=fileURLToPath(new URL('../.cloudflare-assets/',import.meta.url));
await mkdir(destination,{recursive:true});
// Keep the old host's proxy configuration in dist for rollback, but don't give
// it to Cloudflare's configuration parser. The Worker owns the RSS route.
const excluded=new Set(['_redirects','.assetsignore','.DS_Store']);
await cp(source,destination,{recursive:true,filter:path=>!excluded.has(basename(path))});
async function files(directory,prefix='') {
  const found=[];
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const relative=join(prefix,entry.name);
    if(entry.isDirectory())found.push(...await files(join(directory,entry.name),relative));
    else found.push(relative);
  }
  return found;
}
const expected=new Set((await files(source)).filter(path=>path.split(sep).every(part=>!excluded.has(part))));
// Prune stale output without deleting the watched root and stopping dev mode.
for(const path of await files(destination))if(!expected.has(path))await rm(join(destination,path),{force:true});
