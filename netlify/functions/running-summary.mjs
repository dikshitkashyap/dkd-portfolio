import { summaryStore, json } from '../../server/coros-state.mjs';
import { localDate } from '../../server/coros-core.mjs';
export default async request => {
  if (request.method!=='GET') return json({status:'unavailable'},405);
  const url=new URL(request.url),year=Number(url.searchParams.get('year')||localDate().slice(0,4));
  const current=Number(localDate().slice(0,4));
  if (!Number.isInteger(year) || year<2026 || year>current) return json({status:'unavailable'},400);
  try {
    const data=await summaryStore().get(String(year),{type:'json'});
    if (!data) return json({status:'unavailable'},503);
    // Explicit allowlist: credentials and individual activity records never cross this boundary.
    return json({status:'success',source:'COROS',version:2,year,coverage:{startDate:data.coverage.startDate,endDate:data.coverage.endDate,complete:data.coverage.complete},totals:{distanceKm:data.totals.distanceKm},lastRun:data.lastRun?{date:data.lastRun.date,distanceKm:data.lastRun.distanceKm}:null,updatedAt:data.updatedAt},200,'public, max-age=300, s-maxage=3600');
  } catch {return json({status:'unavailable'},503);}
};
export const config={path:'/api/running-summary'};
