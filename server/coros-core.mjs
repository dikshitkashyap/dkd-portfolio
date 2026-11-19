export const ISSUER = 'https://mcpus.coros.com';
export const RESOURCE = `${ISSUER}/mcp`;
export const ORIGIN = 'https://www.kidshit.space';
export const CALLBACK = `${ORIGIN}/api/coros/callback`;
export const RUN_TYPES = [100, 101, 102, 103];
export function localDate(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(now);
  return ['year','month','day'].map(k => p.find(x => x.type === k).value).join('-');
}
export function parseRecords(result, start, end) {
  if (result?.isError) throw new Error('COROS query failed');
  const text = (result?.content || []).filter(x => x.type === 'text').map(x => {
    try { const parsed = JSON.parse(x.text); return typeof parsed === 'string' ? parsed : x.text; } catch { return x.text; }
  }).join('\n');
  if (text.trim() === `No sport records found from ${start} to ${end}.`) return [];
  const count = text.match(/\((\d+) records\)/);
  const headers = [...text.matchAll(/^\d+\. (.+?) [—–] (\d{4}-\d{2}-\d{2})\s*$/gm)];
  if (!count || Number(count[1]) !== headers.length) throw new Error('Unrecognized or incomplete COROS response');
  return headers.map((h, i) => {
    const body = text.slice(h.index + h[0].length, headers[i+1]?.index ?? text.length);
    const distance = body.match(/Distance:\s*([\d,.]+)\s*(km|m)\b/);
    const identity = body.match(/LabelId:\s*(\d+)\s*\|\s*SportType:\s*(\d+)/);
    const stamp = body.match(/startTimestamp=(\d+)/);
    const km = Number(distance?.[1].replaceAll(',', '')) / (distance?.[2] === 'm' ? 1000 : 1);
    const code = Number(identity?.[2]);
    const date = stamp ? localDate(new Date(Number(stamp[1]) * 1000)) : h[2];
    if (!identity || !distance || !RUN_TYPES.includes(code) || !Number.isFinite(km) || km < 0 || km > 500 || h[2] < start || h[2] > end) throw new Error('Invalid COROS running record');
    return { id:identity[1], date, distanceKm:km, timestamp:Number(stamp?.[1] || 0) };
  });
}
export function monthWindows(today) {
  const year = Number(today.slice(0,4));
  return Array.from({length:Number(today.slice(5,7))}, (_, i) => {
    const start = `${year}-${String(i+1).padStart(2,'0')}-01`;
    const end = new Date(Date.UTC(year,i+1,0)).toISOString().slice(0,10);
    return [start, end > today ? today : end];
  });
}
export async function collectWindow(query, start, end, limit = 100) {
  const rows = parseRecords(await query({ startDate:start.replaceAll('-',''), endDate:end.replaceAll('-',''), sportTypeCodes:RUN_TYPES, limit }), start, end);
  if (rows.length < limit) return rows;
  if (start === end) throw new Error('Daily COROS result limit reached');
  const middle = new Date((Date.parse(`${start}T00:00:00Z`) + Date.parse(`${end}T00:00:00Z`))/2).toISOString().slice(0,10);
  const next = new Date(Date.parse(`${middle}T00:00:00Z`) + 86400000).toISOString().slice(0,10);
  return [...await collectWindow(query,start,middle,limit), ...await collectWindow(query,next,end,limit)];
}
export function makeSummary(records, now = new Date()) {
  const today = localDate(now), year = Number(today.slice(0,4));
  const unique = new Map();
  for (const r of records) {
    if (r.date < `${year}-01-01` || r.date > today) continue;
    if (unique.has(r.id) && JSON.stringify(unique.get(r.id)) !== JSON.stringify(r)) throw new Error('Conflicting duplicate activity');
    unique.set(r.id,r);
  }
  const ordered = [...unique.values()].sort((a,b) => b.date.localeCompare(a.date) || b.timestamp-a.timestamp || b.id.localeCompare(a.id));
  const latestDay = ordered.filter(r=>r.date===ordered[0]?.date);
  if (latestDay.length>1 && latestDay.some(r=>!r.timestamp)) throw new Error('Latest run time is ambiguous');
  return { status:'success', source:'COROS', version:2, year,
    coverage:{startDate:`${year}-01-01`, endDate:today, complete:true},
    totals:{distanceKm:Math.round(ordered.reduce((sum,r)=>sum+r.distanceKm,0)*100)/100},
    lastRun:ordered.length ? {date:ordered[0].date,distanceKm:ordered[0].distanceKm} : null,
    updatedAt:now.toISOString() };
}
export function parseRpc(body, id) {
  const messages = body.trim().startsWith('{') ? [JSON.parse(body)] : body.split(/\r?\n\r?\n/).flatMap(event => {
    const data = event.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim()).join('\n');
    return data ? [JSON.parse(data)] : [];
  });
  const message = messages.find(x=>x.id === id);
  if (!message || message.error) throw new Error('COROS protocol error');
  return message.result;
}
export async function createCorosClient(accessToken, fetcher = fetch) {
  let session = '', sequence = 0;
  const rpc = async (method, params, notification=false) => {
    const id = notification ? undefined : ++sequence;
    const response = await fetcher(RESOURCE, { method:'POST', redirect:'error', signal:AbortSignal.timeout(25000),
      headers:{Authorization:`Bearer ${accessToken}`, 'Content-Type':'application/json', Accept:'application/json, text/event-stream', 'MCP-Protocol-Version':'2025-03-26', ...(session ? {'Mcp-Session-Id':session} : {})},
      body:JSON.stringify({jsonrpc:'2.0', ...(notification ? {} : {id}), method, params}) });
    if (!response.ok) throw new Error(`COROS request failed (${response.status})`);
    session = response.headers.get('mcp-session-id') || session;
    return notification ? null : parseRpc(await response.text(),id);
  };
  await rpc('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'kidshit-portfolio-running',version:'1.0.0'}});
  await rpc('notifications/initialized',{},true);
  const listing = await rpc('tools/list',{});
  const tool = listing.tools?.find(t=>t.name.replaceAll(/[^a-z]/gi,'').toLowerCase() === 'querysportrecords');
  if (!tool) throw new Error('COROS running query unavailable');
  return args => rpc('tools/call',{name:tool.name,arguments:args});
}
