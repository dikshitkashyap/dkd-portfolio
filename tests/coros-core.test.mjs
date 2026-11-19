import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecords, makeSummary, monthWindows, collectWindow, parseRpc, localDate, createCorosClient, RESOURCE } from '../server/coros-core.mjs';
import { validateSummary } from '../dist/running-data.mjs';
const fixture=(rows)=>({content:[{type:'text',text:JSON.stringify(`Sport Records — dates (${rows.length} records)\n========================\n\n${rows.map((r,i)=>`${i+1}. Run — ${r.date}\n   Duration: 0:30:00 | Distance: ${r.km} km\n   LabelId: ${r.id} | SportType: ${r.type||100}`).join('\n\n')}`)}]});
test('COROS text decoding and explicit empty results',()=>{
  assert.equal(parseRecords(fixture([{id:'1',date:'2026-10-27',km:9.09}]),'2026-10-01','2026-10-29')[0].distanceKm,9.09);
  assert.deepEqual(parseRecords({content:[{type:'text',text:JSON.stringify('No sport records found from 2026-01-01 to 2026-01-31.')}]},'2026-01-01','2026-01-31'),[]);
  assert.throws(()=>parseRecords({content:[{type:'text',text:'Server error'}]},'2026-01-01','2026-01-31'));
});
test('walking, malformed and out-of-window records fail closed',()=>{
  for (const row of [{id:'1',date:'2026-10-27',km:5,type:900},{id:'1',date:'2026-11-01',km:5},{id:'1',date:'2026-10-27',km:900}]) assert.throws(()=>parseRecords(fixture([row]),'2026-10-01','2026-10-29'));
});
test('coverage windows handle leap years, India timezone and year rollover',()=>{
  assert.deepEqual(monthWindows('2024-03-02')[1],['2024-02-01','2024-02-29']);
  assert.deepEqual(monthWindows('2027-01-01'),[['2027-01-01','2027-01-01']]);
  assert.equal(localDate(new Date('2026-10-29T19:00:00Z')),'2026-10-30');
});
test('truncated windows split; saturated single days abort',async()=>{
  const calls=[];
  const query=async args=>{calls.push(args);return fixture(args.startDate===args.endDate?[{id:args.startDate,date:args.startDate.replace(/(\d{4})(\d{2})(\d{2})/,'$1-$2-$3'),km:1}]:[{id:'1',date:'2026-10-01',km:1},{id:'2',date:'2026-10-02',km:1}]);};
  const rows=await collectWindow(query,'2026-10-01','2026-10-02',2);assert.equal(rows.length,2);assert.equal(calls.length,3);
  await assert.rejects(()=>collectWindow(async()=>fixture([{id:'1',date:'2026-10-01',km:1}]),'2026-10-01','2026-10-01',1));
});
test('deduplication and latest run; public response excludes private activity fields',()=>{
  const first={id:'private-1',date:'2026-10-20',distanceKm:5,timestamp:10};
  const last={id:'private-2',date:'2026-10-27',distanceKm:9.09,timestamp:20};
  const summary=makeSummary([first,last,last],new Date('2026-10-29T12:00:00Z'));
  assert.equal(summary.totals.distanceKm,14.09);assert.deepEqual(summary.lastRun,{date:'2026-10-27',distanceKm:9.09});
  const serialized=JSON.stringify(summary);for(const field of ['private-1','private-2','timestamp','runningDates','heartRate','accessToken']) assert(!serialized.includes(field));
  assert.equal(validateSummary(summary,2026,new Date('2026-10-29T12:00:00Z')).totals.distanceKm,14.09);
  assert.throws(()=>makeSummary([first,{...first,distanceKm:7}]));
});
test('public validator rejects future dates and removes injected metadata',()=>{
  const now=new Date('2026-10-29T12:00:00Z'),summary=makeSummary([],now);
  assert.throws(()=>validateSummary({...summary,coverage:{...summary.coverage,endDate:'2026-12-31'}},2026,now));
  assert(!('accessToken' in validateSummary({...summary,accessToken:'secret'},2026,now)));
});
test('MCP JSON and SSE replies are matched by request ID',()=>{
  assert.deepEqual(parseRpc('{"jsonrpc":"2.0","id":3,"result":{"ok":true}}',3),{ok:true});
  assert.deepEqual(parseRpc('event: message\ndata: {"id":3,"result":{"ok":true}}\n\n',3),{ok:true});
  assert.throws(()=>parseRpc('{"id":3,"error":{}}',3));
});
test('MCP client only invokes the activity query and authenticates server-side',async()=>{
  const methods=[];let n=0;
  const fetcher=async(url,options)=>{
    assert.equal(url,RESOURCE);assert.equal(options.headers.Authorization,'Bearer private-token');
    const body=JSON.parse(options.body);methods.push(body.method);
    let result={};if(body.method==='tools/list')result={tools:[{name:'querySportRecords'}]};
    if(body.method==='tools/call')assert.equal(body.params.name,'querySportRecords');
    n++;return new Response(body.id?JSON.stringify({id:body.id,result}):null,{status:body.id?200:202,headers:{'mcp-session-id':'private-session'}});
  };
  const query=await createCorosClient('private-token',fetcher);await query({limit:100});
  assert.deepEqual(methods,['initialize','notifications/initialized','tools/list','tools/call']);assert.equal(n,4);
});

test('short activities in metres contribute their converted distance',()=>{
  const response=fixture([{id:'1',date:'2026-09-21',km:1}]);
  response.content[0].text=response.content[0].text.replace('1 km','922 m');
  const rows=parseRecords(response,'2026-09-01','2026-09-30');
  assert.equal(rows[0].distanceKm,0.922);
  assert.equal(makeSummary(rows,new Date('2026-09-30T12:00:00Z')).totals.distanceKm,0.92);
});
