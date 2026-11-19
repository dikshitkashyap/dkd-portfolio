import { RunningLog } from './running-log.mjs';
import {MEDIA_PATHS,mediaAsset} from './media.mjs';
export { RunningLog };

export async function mediumFeed(request, cache = globalThis.caches?.default, fetcher = fetch) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, {status:405});
  const key = new Request(new URL('/medium-feed.xml', request.url), {method:'GET'});
  const hit = await cache?.match(key);
  if (hit) return request.method === 'HEAD' ? new Response(null, hit) : hit;
  try {
    // Fixed destination: this endpoint cannot proxy visitor-supplied URLs.
    const upstream = await fetcher('https://medium.com/feed/@dkashyap450', {
      signal:AbortSignal.timeout(10000), headers:{Accept:'application/rss+xml, application/xml, text/xml'}
    });
    if (!upstream.ok) throw new Error('Feed unavailable');
    const body = await upstream.text();
    if (body.length > 2_000_000 || !/<rss[\s>]/i.test(body)) throw new Error('Invalid feed');
    const response = new Response(body, {headers:{
      'Content-Type':'application/rss+xml; charset=utf-8',
      'Cache-Control':'public, max-age=300, s-maxage=1800',
      'X-Content-Type-Options':'nosniff'
    }});
    await cache?.put(key, response.clone());
    return request.method === 'HEAD' ? new Response(null, response) : response;
  } catch { return new Response('Feed temporarily unavailable', {status:502, headers:{'Cache-Control':'no-store'}}); }
}

const running = env => env.RUNNING.get(env.RUNNING.idFromName('portfolio-owner'));
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (MEDIA_PATHS.has(path)) return mediaAsset(request, env.ASSETS);
    if (path === '/medium-feed.xml') return mediumFeed(request);
    if (['/api/running-summary','/api/coros/connect','/api/coros/callback','/api/coros/sync','/api/coros/status','/api/coros/migrate'].includes(path)) {
      return running(env).fetch(request);
    }
    if (path.startsWith('/api/')) return new Response('Not found', {status:404});
    return env.ASSETS.fetch(request);
  },
  async scheduled(controller, env) {
    // Queue a durable alarm rather than relying on a visitor request's lifetime.
    await running(env).fetch(new Request('https://internal/schedule', {method:'POST'}));
  }
};
