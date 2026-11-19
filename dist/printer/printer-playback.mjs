// Coordinate cold media startup without treating buffering as a completed intro.
export function createPrinterPlayback({video, onWaiting, onPlaying, onFailure, onEnded,
  setTimer=setTimeout, clearTimer=clearTimeout, loadingTimeout=30000}) {
  let active=false, suspended=false, started=false, generation=0, attempt=0;
  let timer=null, waitingForData=false, retries=0;
  const listeners=[];
  function listen(name, callback){video.addEventListener(name,callback);listeners.push([name,callback]);}
  function clearWatch(){if(timer!==null)clearTimer(timer);timer=null;}
  function fail(error){
    if(!active||suspended)return;
    active=false;generation++;attempt++;waitingForData=false;clearWatch();video.pause();
    onFailure(error);
  }
  function watch(){
    clearWatch();
    if(active&&!suspended)timer=setTimer(()=>fail(new Error('Printer media is taking too long to load')),loadingTimeout);
  }
  function playing(){
    if(!active||suspended){video.pause();return;}
    clearWatch();waitingForData=false;retries=0;
    const first=!started;started=true;onPlaying({first});
  }
  function requestPlay(){
    if(!active||suspended)return;
    const current=generation, request=++attempt;
    let playback;
    try{playback=video.play();}catch(error){fail(error);return;}
    Promise.resolve(playback).catch(error=>{
      if(!active||suspended||current!==generation||request!==attempt)return;
      if(error?.name==='AbortError'&&retries<2){
        retries++;waitingForData=true;onWaiting({started});watch();
        // A preload/seek can interrupt a first play request. Retry when data exists.
        if(video.readyState>=2)Promise.resolve().then(()=>{
          if(active&&!suspended&&waitingForData&&current===generation){waitingForData=false;requestPlay();}
        });
      }else fail(error);
    });
  }
  function ready(){
    if(active&&!suspended&&waitingForData&&video.readyState>=2){waitingForData=false;requestPlay();}
  }
  listen('playing',playing);
  listen('canplay',ready);
  listen('loadeddata',ready);
  listen('waiting',()=>{if(active&&!suspended){onWaiting({started});watch();}});
  listen('error',()=>fail(video.error||new Error('Printer video is unavailable')));
  listen('ended',()=>{if(!active||suspended||!started)return;active=false;clearWatch();onEnded();});
  return {
    start(){
      generation++;attempt++;active=true;suspended=false;started=false;retries=0;waitingForData=false;
      clearWatch();onWaiting({started:false});
      try{
        video.muted=true;video.playsInline=true;
        if(video.error)video.load();
        video.playbackRate=2.2;
        // Seeking before metadata is available can reject on a cold Safari load.
        if(video.readyState>=1&&video.currentTime>0)video.currentTime=0;
      }catch(error){fail(error);return;}
      watch();requestPlay();
    },
    cancel(){active=false;suspended=false;generation++;attempt++;waitingForData=false;clearWatch();video.pause();},
    suspend(){if(!active)return;suspended=true;attempt++;clearWatch();video.pause();},
    resume(){if(!active||!suspended)return;suspended=false;onWaiting({started});watch();requestPlay();},
    destroy(){this.cancel();listeners.forEach(([name,callback])=>video.removeEventListener(name,callback));}
  };
}
