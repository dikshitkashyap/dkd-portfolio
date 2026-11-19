(() => {
  const words=[{text:'simple',lang:'en',label:'English'},{text:'सरल',lang:'hi',label:'Hindi'},{text:'সহজ',lang:'bn',label:'Bengali'},{text:'ಸುಲಭ',lang:'kn',label:'Kannada'},{text:'எளிது',lang:'ta',label:'Tamil'},{text:'సులభం',lang:'te',label:'Telugu'}];
  const families={en:'DM Sans',hi:'Noto Sans Devanagari',bn:'Noto Sans Bengali',kn:'Noto Sans Kannada',ta:'Noto Sans Tamil',te:'Noto Sans Telugu'};
  const hero=document.querySelector('.language-hero'),slot=hero.querySelector('.roll-window'),button=hero.querySelector('.roll-action');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)'),context=document.createElement('canvas').getContext('2d');
  const review=new URLSearchParams(location.search);
  let index=Math.max(0,words.findIndex(w=>w.lang===review.get('language'))),timer,paused=review.has('pause')||document.documentElement.dataset.printerIntro==='pending',intersecting=true,animation=[],generation=0,metrics=[],frame={ascent:0,descent:0};
  hero.dataset.language=words[index].lang;
  const ready=()=>metrics.length&&!paused&&!document.hidden&&intersecting&&!reduce.matches;
  function measure(){
    const base=parseFloat(getComputedStyle(button).fontSize);context.font=`700 ${base}px "DM Sans"`;
    const reference=context.measureText('simple'),dot=context.measureText('.');
    metrics=words.map(word=>{
      context.font=`700 ${base}px "${families[word.lang]}"`;const original=context.measureText(word.text);
      const size=base*Math.max(.75,Math.min(1.35,reference.actualBoundingBoxAscent/original.actualBoundingBoxAscent));
      context.font=`700 ${size}px "${families[word.lang]}"`;const m=context.measureText(word.text);
      const ascent=Math.ceil(Math.max(m.actualBoundingBoxAscent,dot.actualBoundingBoxAscent))+2,descent=Math.ceil(Math.max(m.actualBoundingBoxDescent,dot.actualBoundingBoxDescent))+2;
      return {size,ascent,descent,width:Math.ceil(m.width+dot.width+base*.02)+4,wordWidth:m.width,base};
    });
    frame={ascent:Math.max(...metrics.map(m=>m.ascent)),descent:Math.max(...metrics.map(m=>m.descent))};
    stop();
  }
  function nodeAt(i){
    const word=words[i],m=metrics[i],ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.classList.add('roll-word');svg.setAttribute('width',m.width);svg.setAttribute('height',frame.ascent+frame.descent);svg.setAttribute('viewBox',`0 0 ${m.width} ${frame.ascent+frame.descent}`);svg.setAttribute('aria-hidden','true');svg.dataset.lang=word.lang;
    const text=document.createElementNS(ns,'text');text.setAttribute('x','1');text.setAttribute('y',String(frame.ascent));text.setAttribute('font-family',families[word.lang]);text.setAttribute('font-size',m.size);text.setAttribute('font-weight','700');text.setAttribute('fill','currentColor');text.setAttribute('lang',word.lang);text.style.letterSpacing='0';text.textContent=word.text;
    const period=document.createElementNS(ns,'text');period.setAttribute('x',String(1+m.wordWidth+m.base*.02));period.setAttribute('y',String(frame.ascent));period.setAttribute('font-family','DM Sans');period.setAttribute('font-size',m.base);period.setAttribute('font-weight','700');period.setAttribute('fill','var(--green)');period.style.letterSpacing='0';period.textContent='.';
    svg.append(text,period);return svg;
  }
  function setSize(i){const m=metrics[i];slot.style.width=`${m.width}px`;slot.style.height=`${frame.ascent+frame.descent}px`;slot.style.verticalAlign=`-${frame.descent}px`;}
  function controls(){button.setAttribute('aria-label',`Making complex payments feel simple. ${paused?'Play':'Pause'} headline animation`);button.setAttribute('aria-pressed',String(paused));}
  function stop(){hero.dataset.motion='holding';delete hero.dataset.nextLanguage;clearTimeout(timer);generation++;for(const a of animation)a.cancel();animation=[];if(metrics.length){slot.replaceChildren(nodeAt(index));setSize(index);slot.dataset.ready='true';}controls();}
  function schedule(){clearTimeout(timer);if(ready())timer=setTimeout(advance,1500);}
  async function advance(){
    if(!ready())return;
    const token=++generation,next=(index+1)%words.length,out=slot.firstElementChild,incoming=nodeAt(next),height=frame.ascent+frame.descent;
    incoming.style.transform=`translateY(${height+4}px)`;slot.append(incoming);setSize(next);hero.dataset.motion='rolling';hero.dataset.nextLanguage=words[next].lang;
    const opts={duration:640,easing:'cubic-bezier(.22,.75,.2,1)',fill:'forwards'};
    animation=[out.animate([{transform:'translateY(0)'},{transform:`translateY(-${height+4}px)`}],opts),incoming.animate([{transform:`translateY(${height+4}px)`},{transform:'translateY(0)'}],opts)];
    await Promise.all(animation.map(a=>a.finished.catch(()=>{})));if(token!==generation)return;
    index=next;slot.replaceChildren(nodeAt(index));animation.forEach(a=>a.cancel());animation=[];setSize(index);hero.dataset.language=words[index].lang;hero.dataset.motion='holding';delete hero.dataset.nextLanguage;schedule();
  }
  function refresh(){stop();if(reduce.matches){index=0;stop();hero.dataset.language='en';}schedule();}
  button.addEventListener('click',()=>{paused=!paused;refresh();});document.addEventListener('visibilitychange',refresh);reduce.addEventListener('change',refresh);
  new IntersectionObserver(([entry])=>{intersecting=entry.isIntersecting;refresh();},{threshold:.15}).observe(hero);
  window.addEventListener('resize',()=>{measure();schedule();});
  Promise.all([...new Map(words.map(w=>[w.lang,w])).values()].map(w=>document.fonts.load(`700 80px "${families[w.lang]}"`,w.text))).then(()=>{measure();refresh();});
  window.addEventListener('portfolio:intro-complete',()=>{if(!review.has('pause')){paused=false;refresh();}},{once:true});
  controls();
})();
