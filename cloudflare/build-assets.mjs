import {cp, mkdir, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const source=fileURLToPath(new URL('../dist/',import.meta.url));
const destination=fileURLToPath(new URL('../.cloudflare-assets/',import.meta.url));
// This is exclusively a generated, gitignored deployment directory.
await rm(destination,{recursive:true,force:true});
await mkdir(destination,{recursive:true});
// Keep the old host's proxy configuration in dist for rollback, but don't give
// it to Cloudflare's configuration parser. The Worker owns the RSS route.
await cp(source,destination,{recursive:true,filter:path=>!['_redirects','.assetsignore','.DS_Store'].includes(path.split('/').at(-1))});
