import { turnDecision } from './turn-gesture.mjs';
const section=document.querySelector('[data-anniversary-book]');
const dialog=document.querySelector('[data-book-reader]');
const hit=dialog.querySelector('.book-hit'),book=dialog.querySelector('.physical-book');
const left=book.querySelector('[data-side=left]'),right=book.querySelector('[data-side=right]'),flap=book.querySelector('.book-turn');
const front=flap.querySelector('.front'),back=flap.querySelector('.back');
const previous=dialog.querySelector('[data-book-previous]'),next=dialog.querySelector('[data-book-next]');
const status=dialog.querySelector('[data-book-status]'),loading=dialog.querySelector('[data-book-loading]');
const reading=dialog.querySelector('.book-reader-reading'),film=dialog.querySelector('video'),toggle=dialog.querySelector('[data-book-view]');
const mobile=matchMedia('(max-width:760px)'),reduce=matchMedia('(prefers-reduced-motion:reduce)');
const data=await fetch(new URL('./pages.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Book unavailable');return r.json()});
data.cover=new URL(data.cover,import.meta.url).href;
data.backCover=new URL(data.backCover,import.meta.url).href;
data.pages=data.pages.map(page=>page.src?{...page,src:new URL(page.src,import.meta.url).href}:page);
const cover={src:data.cover,alt:'Cover of The Adventures of Deengoos and Spoingoos'},end={src:data.backCover,alt:'Back cover illustration of Deengoos and Spoingoos'};
const imageCache=new Map();
let frames=[],index=0,turn=null,drag=null,busy=false,animation=null,opener=null,view='read',session=0;
function preload(page){
 if(!page||page.kind==='chapter')return Promise.resolve();
 if(!imageCache.has(page.src)){
  const image=new Image();image.decoding='async';image.src=page.src;
  const ready=image.decode().then(()=>image).catch(error=>{imageCache.delete(page.src);throw error});
  imageCache.set(page.src,{image,ready});
 }
 return imageCache.get(page.src).ready;
}
function framePages(frame){return [frame.left,frame.right].filter(Boolean)}
function warm(at){return Promise.all(framePages(frames[at]).map(preload))}
function art(page){
 if(!page)return null;
 if(page.kind==='chapter'){
  const card=document.createElement('div');card.className='book-chapter-page';
  const label=document.createElement('span');label.textContent=`Chapter ${page.number}`;
  const title=document.createElement('strong');title.textContent=page.title;
  card.append(label,title);return card;
 }
 const image=document.createElement('img');image.src=page.src;image.alt=page.alt;image.draggable=false;image.decoding='async';return image;
}
function face(node,page,visible=true){node.replaceChildren(...(page?[art(page)]:[]));node.hidden=!visible;node.classList.toggle('endpaper',!page)}
function buildFrames(){
 if(mobile.matches)frames=[cover,...data.pages,end].map((page,i)=>({left:null,right:page,label:i===0?'Front cover':i===data.pages.length+1?'Back cover':`${i} / ${data.pages.length}`,position:'spread',page:i}));
 else{
  frames=[{left:null,right:cover,label:'Front cover',position:'front',page:0},{left:null,right:data.pages[0],label:`1 / ${data.pages.length}`,position:'spread',page:1}];
  for(let i=1;i<data.pages.length;i+=2)frames.push({left:data.pages[i],right:data.pages[i+1]||null,label:`${i+1}–${Math.min(i+2,data.pages.length)} / ${data.pages.length}`,position:'spread',page:i+1});
  frames.push({left:end,right:null,label:'Back cover',position:'back',page:data.pages.length+1});
 }
}
function controls(){previous.disabled=busy||index===0;next.disabled=busy||index===frames.length-1;status.textContent=frames[index].label;hit.setAttribute('aria-label',`${frames[index].label}. Drag or use the arrow keys to turn a page.`);hit.dataset.page=String(frames[index].page)}
function render(){
 const frame=frames[index];book.dataset.position=frame.position;
 left.removeAttribute('aria-hidden');right.removeAttribute('aria-hidden');
 face(left,frame.left,frame.position!=='front');face(right,frame.right,frame.position!=='back');
 flap.hidden=true;turn=null;controls();
 const nearby=[index-1,index,index+1].filter(at=>frames[at]);
 const retained=new Set(nearby.flatMap(at=>framePages(frames[at])).map(page=>page.src).filter(Boolean));
 for(const key of imageCache.keys())if(!retained.has(key))imageCache.delete(key);
 for(const at of nearby)warm(at).catch(()=>{});
}
function resetTurn(){if(animation){animation.cancel();animation=null}flap.hidden=true;turn=null;drag=null;busy=false;hit.dataset.dragging='false';render()}
function progress(p){if(!turn)return;turn.progress=Math.max(0,Math.min(1,p));flap.style.transform=`rotateY(${(turn.direction===1?-180:180)*turn.progress}deg)`;flap.style.setProperty('--fold-shade',String(Math.sin(Math.PI*turn.progress)*.85));hit.dataset.progress=turn.progress.toFixed(3)}
function prepare(direction){
 const target=index+direction;if(!frames[target]||busy)return false;
 const current=frames[index],incoming=frames[target];
 if(turn&&turn.direction===direction)return true;
 turn={direction,target,progress:0};
 flap.dataset.direction=direction===1?'next':'previous';
 if(mobile.matches){face(right,incoming.right);face(front,current.right);face(back,incoming.right)}
 else if(direction===1){face(left,current.left,current.position!=='front');face(right,incoming.right,incoming.position!=='back');face(front,current.right);face(back,incoming.left)}
 else{face(left,incoming.left,incoming.position!=='front');face(right,current.right,current.position!=='back');face(front,current.left);face(back,incoming.right)}
 left.setAttribute('aria-hidden','true');right.setAttribute('aria-hidden','true');
 // The fixed hit surface never follows the rotating page geometry.
 flap.hidden=false;progress(0);return true;
}
async function settle(complete){
 if(!turn)return;const snapshot=turn,token=session;busy=true;drag=null;hit.dataset.dragging='false';controls();loading.textContent='';
 try{
  if(complete){loading.textContent='';await warm(snapshot.target)}
  if(token!==session||!dialog.open)return;
  const from=snapshot.progress,to=complete?1:0;
  if(!reduce.matches){
   const duration=Math.max(170,Math.abs(to-from)*620);
   animation=flap.animate([{transform:`rotateY(${(snapshot.direction===1?-180:180)*from}deg)`},{transform:`rotateY(${(snapshot.direction===1?-180:180)*to}deg)`}],{duration,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});
   await animation.finished.catch(()=>{});
  }
  if(token!==session||!dialog.open)return;
  if(complete){index=snapshot.target;pageSound()}
 }catch{loading.textContent='This page could not load. Please try again.'}
 finally{if(token===session){if(animation){animation.cancel();animation=null}busy=false;drag=null;hit.dataset.dragging='false';render()}}
}
function go(direction){if(!busy&&prepare(direction))settle(true)}
function pageSound(){
 try{if(localStorage.getItem('portfolio-click-sounds')==='false')return}catch{}
 const audio=new Audio('/assets/audio/paper-click.mp3?v=trimmed-1');audio.volume=1;audio.play().catch(()=>{});
}
function directionAt(x){const bounds=book.getBoundingClientRect();return x<bounds.left+bounds.width/2&&index>0?-1:1}
hit.addEventListener('pointerenter',event=>{if(!mobile.matches&&event.pointerType==='mouse'&&!busy&&!drag&&!reduce.matches&&prepare(directionAt(event.clientX)))progress(.035)});
hit.addEventListener('pointerleave',()=>{if(!drag&&!busy&&turn)resetTurn()});
hit.addEventListener('pointerdown',event=>{
 if(event.button!==0||busy)return;
 const direction=directionAt(event.clientX);if(!prepare(direction))return;
 hit.setPointerCapture(event.pointerId);
 drag={id:event.pointerId,startX:event.clientX,lastX:event.clientX,lastTime:event.timeStamp,velocity:0,maxDistance:0,width:mobile.matches?book.clientWidth:book.clientWidth/2};
 progress(0);hit.dataset.dragging='true';
});
hit.addEventListener('pointermove',event=>{
 if(!drag){
  if(!mobile.matches&&event.pointerType==='mouse'&&!busy&&!reduce.matches&&prepare(directionAt(event.clientX)))progress(.035);
  return;
 }
 if(!drag||event.pointerId!==drag.id||!turn)return;
 const delta=event.clientX-drag.lastX,elapsed=event.timeStamp-drag.lastTime;
 if(elapsed>0)drag.velocity=delta/elapsed;
 drag.lastX=event.clientX;drag.lastTime=event.timeStamp;
 drag.maxDistance=Math.max(drag.maxDistance,Math.abs(event.clientX-drag.startX));
 progress((drag.startX-event.clientX)*turn.direction/drag.width);
});
hit.addEventListener('pointerup',event=>{
 if(!drag||event.pointerId!==drag.id||!turn)return;
 const recentVelocity=event.timeStamp-drag.lastTime<120?-drag.velocity*turn.direction:0;
 const decision=turnDecision({distance:(drag.startX-event.clientX)*turn.direction,width:drag.width,velocity:recentVelocity,maxDistance:drag.maxDistance});
 drag=null;if(hit.hasPointerCapture(event.pointerId))hit.releasePointerCapture(event.pointerId);
 settle(decision);
});
hit.addEventListener('pointercancel',()=>{if(drag){drag=null;settle(false)}});
hit.addEventListener('lostpointercapture',()=>{if(drag){drag=null;settle(false)}});
hit.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();go(event.key==='ArrowRight'?1:-1)}else if(event.key==='Enter'||event.key===' '){event.preventDefault();go(1)}});
previous.addEventListener('click',event=>{event.preventDefault();go(-1)});next.addEventListener('click',event=>{event.preventDefault();go(1)});
function showView(which){view=which;const showFilm=which==='film';reading.hidden=showFilm;film.hidden=!showFilm;toggle.textContent=showFilm?'Read the illustrated book ↗':'Watch the printed copy ↗';if(!showFilm)film.pause()}
function open(which,source){opener=source;++session;index=0;buildFrames();resetTurn();showView(which);dialog.showModal();document.documentElement.classList.add('anniversary-reader-open');window.lenis?.stop?.();hit.focus({preventScroll:true})}
section.querySelectorAll('[data-open-book]').forEach(button=>button.addEventListener('click',()=>open(button.dataset.openBook||'read',button)));
toggle.addEventListener('click',()=>showView(view==='read'?'film':'read'));
dialog.querySelector('[data-book-close]').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()}});
dialog.addEventListener('close',()=>{++session;film.pause();resetTurn();document.documentElement.classList.remove('anniversary-reader-open');window.lenis?.start?.();opener?.focus({preventScroll:true})});
mobile.addEventListener('change',()=>{const page=frames[index]?.page||0;++session;resetTurn();buildFrames();index=Math.max(0,frames.findLastIndex(frame=>frame.page<=page));render()});
reduce.addEventListener('change',()=>{if(turn){++session;resetTurn()}});
buildFrames();render();preload(cover).catch(()=>{});
