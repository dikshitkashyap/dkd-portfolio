import {createPrinterPlayback} from './printer-playback.mjs';
(() => {
  if(document.documentElement.dataset.printerIntro!=='pending')return;

  const body=document.body,stage=document.querySelector('.printer-intro'),video=document.querySelector('.printer-film');
  const sound=document.querySelector('#printer-sound'),print=stage.querySelector('.print'),skip=stage.querySelector('.skip');
  const mute=stage.querySelector('.sound'),status=stage.querySelector('.print-status');
  const frame=document.querySelector('body > .page'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let state='ready',soundOn=true,token=0,raf,zoom,fade,fadeInterval,resumeAfterHidden=false,entered=false,sheetReady=null,sheet=null,sheetZoom=null,washAnimation=null;
  const wash=document.createElement('div');wash.className='printer-wash';wash.setAttribute('aria-hidden','true');stage.append(wash);
  document.documentElement.dataset.printerReady='true';
  video.src=video.dataset.src;video.preload='auto';video.load();sound.src=sound.dataset.src;sound.preload='auto';sound.load();
  frame.inert=true;frame.style.visibility='hidden';
  const setState=value=>{state=value;body.dataset.state=value;};
  let soundContext=null,soundGain=null;
  function soundLevel(value){if(soundGain)soundGain.gain.value=value;else sound.volume=value;}
  function primeSound(){
    try{
      const Context=window.AudioContext||window.webkitAudioContext;
      if(Context&&!soundContext){soundContext=window.portfolioSoundContext||new Context();window.portfolioSoundContext=soundContext;const source=soundContext.createMediaElementSource(sound);soundGain=soundContext.createGain();source.connect(soundGain);soundGain.connect(soundContext.destination);sound.volume=1;}
      if(soundContext?.state==='suspended')soundContext.resume().catch(()=>{});
    }catch{soundGain=null;}
    soundLevel(0);sound.muted=soundGain?!soundOn:true;
    sound.play().catch(()=>{});
  }
  function stopSound(fadeOut=false){
    clearInterval(fadeInterval);
    if(!fadeOut){sound.pause();if(sound.readyState>=1)sound.currentTime=0;return;}
    const start=soundGain?soundGain.gain.value:sound.volume,at=performance.now();
    fadeInterval=setInterval(()=>{const left=1-Math.min(1,(performance.now()-at)/550);soundLevel(start*left);if(!left){clearInterval(fadeInterval);sound.pause();}},25);
  }
  function activateHomepage(){
    frame.inert=false;frame.style.visibility='';
    try{sessionStorage.setItem('portfolio-printer-seen-v1','true');}catch{}
    delete document.documentElement.dataset.printerIntro;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',document.documentElement.dataset.theme==='dark'?'#181a18':'#fafaf8');
    sheet?.remove();sheet=null;
    document.querySelector('main')?.focus({preventScroll:true});
    if(!entered){entered=true;window.dispatchEvent(new Event('portfolio:intro-complete'));}
  }
  function prepareSharpPaper(){
    if(innerWidth<=760)return Promise.resolve(false);
    sheet=document.createElement('div');sheet.className='printed-sheet';
    sheet.setAttribute('aria-hidden','true');sheet.inert=true;
    const shadow=sheet.attachShadow({mode:'open'});
    // An inert, isolated copy keeps text vector-sharp and introduces no duplicate IDs
    // or controls into the live homepage. It stays on white paper in either theme.
    const clone=frame.cloneNode(true);
    clone.style.visibility='visible';clone.inert=true;
    clone.querySelectorAll('script,video,audio,iframe,dialog').forEach(node=>node.remove());
    [clone,...clone.querySelectorAll('*')].forEach(node=>{
      for(const attribute of [...node.attributes]){
        if(attribute.name==='id'||attribute.name==='name'||attribute.name.startsWith('data-'))node.removeAttribute(attribute.name);
      }
    });
    const heading=clone.querySelector('.hero h1');
    if(heading){
      const first=document.createElement('span');first.className='roll-first';first.textContent='Making complex';
      const second=document.createElement('span');second.className='roll-second';second.textContent='payments feel simple';
      const dot=document.createElement('span');dot.style.color='var(--green)';dot.textContent='.';second.append(dot);heading.replaceChildren(first,second);
    }
    clone.querySelectorAll('img').forEach(image=>{image.loading='eager';});
    const loaded=[];
    document.querySelectorAll('head link[rel="stylesheet"]').forEach(original=>{
      if(original.href.includes('/printer/'))return;
      const link=original.cloneNode();
      loaded.push(new Promise(resolve=>{link.onload=()=>resolve(true);link.onerror=()=>resolve(false);}));
      shadow.append(link);
    });
    const style=document.createElement('style');
    style.textContent=`:host{--paper:#fafaf8;--ink:#151615;--muted:#686b67;--line:#d2d4ce;--green:#30b759;--surface:#f0f1ed;--image-ground:#eee;--surface-line:#c8cbc3;--link-hover:#247d40;--button-hover:#2b2d29;color-scheme:light;font-family:"DM Sans",Arial,sans-serif;font-size:16px;line-height:1.5;color:#151615;background:#fafaf8}.page{width:1600px;max-width:none;margin:0;padding:0 4.2%;visibility:visible!important}.header{position:relative;top:auto}.hero{display:grid;grid-template-columns:3fr 1fr;padding:81px 0 65px}.hero h1{font-size:106px}.roll-action{pointer-events:none}.theme-moon{opacity:1!important;transform:none!important}.theme-sun{opacity:0!important}.menu-toggle{display:none}.header nav{display:flex}*{animation:none!important;transition:none!important}.page::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,.06),transparent 80px)}`;
    shadow.append(style,clone);stage.append(sheet);
    return Promise.race([
      Promise.all(loaded).then(results=>results.every(Boolean)),
      new Promise(resolve=>setTimeout(()=>resolve(false),1800))
    ]);
  }
  async function finish(animated=true){
    if(state==='entered'||(animated&&['zooming','washing','revealing'].includes(state)))return;
    const operation=++token;
    cancelAnimationFrame(raf);
    zoom?.cancel();fade?.cancel();sheetZoom?.cancel();washAnimation?.cancel();
    playback.cancel();stopSound(animated);
    if(animated&&!reduce.matches){
      const sharpReady=sheetReady?await sheetReady:false;
      if(operation!==token)return;
      body.dataset.printerPaper=sharpReady?'vector':'video';
      setState('zooming');frame.style.visibility='hidden';
      const rect=video.getBoundingClientRect();
      const fitHeight=Math.min(rect.height,rect.width*1.5),fitWidth=fitHeight/1.5;
      const fitX=(rect.width-fitWidth)/2,fitY=(rect.height-fitHeight)/2;
      const paper={x:fitX+fitWidth*.26,y:fitY+fitHeight*.37,width:fitWidth*.48,height:fitHeight*.62};
      const scale=Math.max(innerWidth/paper.width,innerHeight/paper.height)*1.04;
      const origin={x:rect.width*.5,y:rect.height*.43};
      const desiredLeft=(innerWidth-paper.width*scale)/2;
      const x=desiredLeft-(rect.left+origin.x+(paper.x-origin.x)*scale);
      const y=-8-(rect.top+origin.y+(paper.y-origin.y)*scale);
      const options={duration:1000,easing:'cubic-bezier(.45,0,.18,1)',fill:'forwards'};
      if(sharpReady&&sheet){
        const initialScale=paper.width/1600;
        sheet.style.height=`${paper.height/initialScale}px`;
        sheet.style.display='block';
        sheetZoom=sheet.animate([
          {transform:`translate(${rect.left+paper.x}px,${rect.top+paper.y}px) scale(${initialScale})`},
          {transform:`translate(${desiredLeft}px,-8px) scale(${initialScale*scale})`}
        ],options);
      }
      zoom=video.animate([
        {transform:'translate(0,0) scale(1)'},
        {transform:`translate(${x}px,${y}px) scale(${scale})`}
      ],options);
      await zoom.finished.catch(()=>{});
      if(operation!==token)return;
      // Cover the now full-screen paper in the selected theme before showing the site.
      setState('washing');
      washAnimation=wash.animate([
        {opacity:0,offset:0},{opacity:1,offset:.8},{opacity:1,offset:1}
      ],{duration:260,easing:'ease-in-out',fill:'forwards'});
      await washAnimation.finished.catch(()=>{});
      if(operation!==token)return;
    }
    setState('revealing');frame.style.visibility='visible';
    fade=stage.animate([{opacity:1},{opacity:0}],{duration:reduce.matches?0:180,easing:'ease-out',fill:'forwards'});
    await fade.finished.catch(()=>{});if(operation!==token)return;
    setState('entered');frame.inert=false;stopSound();activateHomepage();
  }
  function tick(){
    if(state!=='printing'||document.hidden)return;
    if(video.currentTime>=10.8){finish(true);return;}
    if(video.currentTime>9.2)status.textContent='One last detail…';
    raf=requestAnimationFrame(tick);
  }
  const playback=createPrinterPlayback({
    video,
    onWaiting({started}){
      if(!started)setState('loading');
      status.textContent=started?'Buffering the printer…':'Preparing the printer…';
      print.setAttribute('aria-busy','true');if(started)sound.pause();else soundLevel(0);
    },
    onPlaying({first}){
      setState('printing');print.removeAttribute('aria-busy');status.textContent='Printing selected work…';
      if(first&&sound.readyState>=1)sound.currentTime=0;
      sound.muted=!soundOn;soundLevel(.72);if(soundOn)sound.play().catch(()=>{});
      cancelAnimationFrame(raf);raf=requestAnimationFrame(tick);
    },
    onFailure(){
      cancelAnimationFrame(raf);stopSound();setState('ready');print.disabled=false;print.removeAttribute('aria-busy');
      status.textContent='The printer couldn’t start. Try again, or skip to the portfolio.';
      sheet?.remove();sheet=null;sheetReady=null;
    },
    onEnded:()=>finish(true)
  });
  function start(){
    if(state!=='ready')return;
    if(reduce.matches){finish(false);return;}
    const operation=++token;print.disabled=true;skip.focus({preventScroll:true});
    // Issue the actual media requests first, inside the click. Build sharp paper later.
    primeSound();playback.start();
    requestAnimationFrame(()=>{if(operation===token&&['loading','printing'].includes(state))sheetReady=prepareSharpPaper();});
  }
  print.addEventListener('click',start);
  skip.addEventListener('click',()=>finish(false));
  mute.addEventListener('click',()=>{soundOn=!soundOn;sound.muted=!soundOn;mute.setAttribute('aria-pressed',String(soundOn));mute.setAttribute('aria-label',soundOn?'Mute printing sound':'Enable printing sound');});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state!=='entered'){event.preventDefault();finish(false);}});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&['loading','printing'].includes(state)){resumeAfterHidden=true;playback.suspend();sound.pause();cancelAnimationFrame(raf);}
    else if(!document.hidden&&resumeAfterHidden&&['loading','printing'].includes(state)){resumeAfterHidden=false;playback.resume();}
  });
  addEventListener('resize',()=>{if(['zooming','washing'].includes(state))finish(false);});
  addEventListener('pagehide',()=>{++token;cancelAnimationFrame(raf);playback.cancel();stopSound();});
})();
