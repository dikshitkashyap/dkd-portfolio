// Workers Static Assets currently ignores Range. Keep browser seeking and Safari
// playback working without putting the site's ordinary static requests in code.
export const MEDIA_PATHS=new Set([
  '/printer/printer-printing.mp4','/book/cover.mp4',
  '/assets/audio/ambre.mp3','/assets/audio/paper-click.mp3','/printer/printer-sound.mp3'
]);
export async function mediaAsset(request, assets) {
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
  const incoming=request.headers.get('Range');
  const headers=new Headers(request.headers);headers.delete('Range');headers.delete('If-Range');
  const full=await assets.fetch(new Request(request,{headers}));
  if(full.status!==200)return full;
  const output=new Headers(full.headers);output.set('Accept-Ranges','bytes');
  const ifRange=request.headers.get('If-Range');
  if(request.method==='HEAD'||!incoming||(ifRange && ifRange!==full.headers.get('ETag') && ifRange!==full.headers.get('Last-Modified')))return new Response(full.body,{status:200,headers:output});
  const bytes=await full.arrayBuffer(),size=bytes.byteLength;
  const match=/^bytes=(\d*)-(\d*)$/.exec(incoming);
  let start,end;
  if(match && (match[1]||match[2])) {
    start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
    end=match[1]&&match[2]?Math.min(Number(match[2]),size-1):size-1;
    if(!match[1] && Number(match[2])===0)start=size;
  }
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||start>end) {
    output.set('Content-Range',`bytes */${size}`);output.set('Content-Length','0');
    return new Response(null,{status:416,headers:output});
  }
  output.set('Content-Range',`bytes ${start}-${end}/${size}`);
  output.set('Content-Length',String(end-start+1));
  output.delete('Content-Encoding');
  return new Response(bytes.slice(start,end+1),{status:206,headers:output});
}
