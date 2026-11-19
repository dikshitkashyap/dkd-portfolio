import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrinterPlayback} from '../dist/printer/printer-playback.mjs';

class Video extends EventTarget {
  readyState=0;error=null;paused=true;plays=0;seeks=0;position=0;requests=[];
  get currentTime(){return this.position;}
  set currentTime(value){if(!this.readyState)throw new Error('Cannot seek before metadata');this.seeks++;this.position=value;}
  play(){this.plays++;return this.requests.shift()?.()??Promise.resolve();}
  pause(){this.paused=true;}
  load(){this.error=null;}
  showFrames(){this.readyState=3;this.paused=false;this.dispatchEvent(new Event('playing'));}
}
function setup(){
  const video=new Video(),events=[],timers=new Map();let now=0,id=0;
  const controller=createPrinterPlayback({video,
    onWaiting:event=>events.push(['waiting',event]),onPlaying:event=>events.push(['playing',event]),
    onFailure:error=>events.push(['failure',error]),onEnded:()=>events.push(['completed']),
    setTimer:(callback,delay)=>{timers.set(++id,{callback,at:now+delay});return id;},
    clearTimer:id=>timers.delete(id)
  });
  const advance=milliseconds=>{
    now+=milliseconds;
    for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.callback();}
  };
  return {video,controller,events,advance};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();};

test('cold first click requests playback immediately without seeking unavailable metadata',()=>{
  const {video,controller,events}=setup();controller.start();
  assert.equal(video.plays,1);assert.equal(video.seeks,0);
  assert.deepEqual(events.map(e=>e[0]),['waiting']);
  video.showFrames();assert.equal(events.at(-1)[0],'playing');
  assert.equal(events.at(-1)[1].first,true);
});
test('slow first load survives the former eleven-second timeout and finishes only after playback',()=>{
  const {video,controller,events,advance}=setup();controller.start();advance(12000);
  assert.equal(events.some(e=>e[0]==='failure'||e[0]==='completed'),false);
  video.showFrames();advance(25000);
  assert.equal(events.some(e=>e[0]==='failure'),false);
  video.dispatchEvent(new Event('ended'));
  assert.equal(events.filter(e=>e[0]==='completed').length,1);
});
test('a transient first-play AbortError retries when video data arrives',async()=>{
  const {video,controller,events}=setup();
  video.requests.push(()=>Promise.reject(Object.assign(new Error('Preload interrupted'),{name:'AbortError'})));
  controller.start();await flush();
  assert.equal(events.some(e=>e[0]==='failure'||e[0]==='completed'),false);
  video.readyState=2;video.dispatchEvent(new Event('canplay'));
  assert.equal(video.plays,2);video.showFrames();
  assert.equal(events.at(-1)[0],'playing');
});
test('a denied play request returns a retryable failure, never a completed intro',async()=>{
  const {video,controller,events}=setup();
  video.requests.push(()=>Promise.reject(Object.assign(new Error('Denied'),{name:'NotAllowedError'})));
  controller.start();await flush();
  assert.equal(events.at(-1)[0],'failure');assert.equal(events.some(e=>e[0]==='completed'),false);
  controller.start();video.showFrames();assert.equal(events.at(-1)[0],'playing');
});
test('a true loading timeout offers retry without signaling completion',()=>{
  const {controller,events,advance}=setup();controller.start();advance(30001);
  assert.equal(events.at(-1)[0],'failure');assert.equal(events.some(e=>e[0]==='completed'),false);
});
test('Skip cancels a pending start and ignores late playback or completion events',()=>{
  const {video,controller,events}=setup();controller.start();controller.cancel();
  video.showFrames();video.dispatchEvent(new Event('ended'));
  assert.deepEqual(events.map(e=>e[0]),['waiting']);assert.equal(video.paused,true);
});
test('switching away suspends the loading timeout and resumes the same intro',()=>{
  const {video,controller,events,advance}=setup();controller.start();controller.suspend();advance(60000);
  assert.equal(events.some(e=>e[0]==='failure'),false);
  controller.resume();video.showFrames();assert.equal(video.plays,2);
  assert.equal(events.at(-1)[0],'playing');
});
test('resetting an already loaded video for replay is safe',()=>{
  const {video,controller}=setup();video.readyState=2;video.position=8;
  controller.start();assert.equal(video.currentTime,0);assert.equal(video.seeks,1);
});
