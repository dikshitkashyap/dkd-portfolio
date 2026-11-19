(() => {
  function initializeAudio(){
  const button = document.querySelector('[data-music-toggle]');
  const audio = document.querySelector('[data-background-music]');
  if (!button || !audio) return;
  const message = document.querySelector('[data-music-message]');
  const header = document.querySelector('.header');
  const LEVEL = 0.08;
  const positionKey = 'portfolio-ambre-position';
  const enabledKey = 'portfolio-ambre-enabled';
  let enabled = true;
  try { enabled = sessionStorage.getItem(enabledKey) !== 'false'; } catch { /* Use the default. */ }
  let context = null;
  let gain = null;
  let graphAttempted = false;
  let wanted = false;
  let operation = 0;
  let fadeTimer = null;
  let lastSaved = 0;
  let savedPosition = 0;
  audio.volume = LEVEL;
  try {
    const stored = Number(sessionStorage.getItem(positionKey));
    if (Number.isFinite(stored) && stored >= 0) savedPosition = stored;
  } catch { /* Storage is optional. */ }
  function savePosition() {
    if (!Number.isFinite(audio.currentTime)) return;
    try { sessionStorage.setItem(positionKey, String(audio.currentTime)); } catch { /* Storage is optional. */ }
  }
  function update() {
    const playing = wanted && !audio.paused;
    button.setAttribute('aria-pressed', String(wanted));
    const label = wanted ? (playing ? 'Pause background music' : 'Pause background music — starts after interaction') : 'Play background music — Ambre by Nils Frahm';
    button.setAttribute('aria-label', label);
    button.title = label;
  }
  function initGraph() {
    if (graphAttempted) return;
    graphAttempted = true;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      context = window.portfolioSoundContext || new AudioContext();
      window.portfolioSoundContext = context;
      const source = context.createMediaElementSource(audio);
      gain = context.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(context.destination);
      // GainNode also controls volume on browsers that ignore media.volume.
      audio.volume = 1;
    } catch {
      gain = null;
      audio.volume = LEVEL;
    }
  }
  function setLevel(value, seconds = 0.25) {
    if (!gain || !context) return;
    gain.gain.cancelScheduledValues(context.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, context.currentTime);
    gain.gain.linearRampToValueAtTime(value, context.currentTime + seconds);
  }
  function disarm() {
    document.removeEventListener('pointerdown', unlockOnInteraction, true);
    document.removeEventListener('keydown', unlockOnInteraction, true);
  }
  function unlockOnInteraction(event) {
    if (!event.isTrusted || event.target.closest?.('[data-music-toggle]') || !enabled || !wanted) return;
    if (event.type === 'keydown' && (event.metaKey || event.ctrlKey || event.altKey || ['Shift', 'Control', 'Alt', 'Meta', 'Escape'].includes(event.key))) return;
    disarm();
    play(true);
  }
  function arm() {
    document.addEventListener('pointerdown', unlockOnInteraction, true);
    document.addEventListener('keydown', unlockOnInteraction, true);
  }
  async function play(automatic = false) {
    const current = ++operation;
    wanted = true;
    clearTimeout(fadeTimer);
    if (message) message.textContent = '';
    button.setAttribute('aria-busy', 'true');
    initGraph();
    update();
    try {
      // Request both while still handling the visitor's click/tap gesture.
      const unlock = context?.state === 'suspended' ? context.resume() : Promise.resolve();
      const playback = audio.play();
      await Promise.all([unlock, playback]);
      if (current !== operation || !wanted) { if (!wanted) audio.pause(); return; }
      disarm();
      setLevel(LEVEL, 0.45);
    } catch (error) {
      if (current !== operation) return;
      if (automatic && error?.name === 'NotAllowedError') {
        wanted = true;
        arm();
        return;
      }
      disarm();
      wanted = false;
      audio.pause();
      if (message) message.textContent = 'Music could not start. Press Play to try again.';
    } finally {
      if (current === operation) { button.removeAttribute('aria-busy'); update(); }
    }
  }
  function pause() {
    disarm();
    ++operation;
    wanted = false;
    clearTimeout(fadeTimer);
    button.removeAttribute('aria-busy');
    update();
    setLevel(0, 0.15);
    const finish = () => { audio.pause(); savePosition(); update(); };
    if (gain && !audio.paused) fadeTimer = setTimeout(finish, 160);
    else finish();
  }
  button.addEventListener('click', () => {
    enabled = !wanted;
    try { sessionStorage.setItem(enabledKey, String(enabled)); } catch { /* Keep the current page choice. */ }
    if (enabled) play(); else pause();
  });
  audio.addEventListener('playing', () => { if (!wanted) audio.pause(); update(); });
  audio.addEventListener('pause', () => { wanted = false; button.removeAttribute('aria-busy'); update(); });
  audio.addEventListener('error', () => {
    disarm(); ++operation; wanted = false; button.removeAttribute('aria-busy'); update();
    if (message) message.textContent = 'Music is unavailable right now. You can keep browsing.';
  });
  audio.addEventListener('loadedmetadata', () => {
    if (savedPosition > 0 && Number.isFinite(audio.duration)) {
      try { audio.currentTime = savedPosition < audio.duration - 0.1 ? savedPosition : 0; } catch { /* Start normally if seeking is unavailable. */ }
    }
    savedPosition = 0;
  }, { once:true });
  audio.addEventListener('timeupdate', () => { if (Date.now() - lastSaved > 5000) { savePosition(); lastSaved = Date.now(); } });
  window.addEventListener('pagehide', () => { disarm(); ++operation; clearTimeout(fadeTimer); savePosition(); wanted = false; audio.pause(); });
  window.addEventListener('pageshow', event => { if (event.persisted) { try { enabled = sessionStorage.getItem(enabledKey) !== 'false'; } catch {} if (enabled) { arm(); play(true); } else update(); } });
  const measureHeader = () => {
    if (header) document.documentElement.style.setProperty('--header-height', `${header.getBoundingClientRect().height}px`);
  };
  button.hidden = false;
  update(); measureHeader();
  if (header && 'ResizeObserver' in window) new ResizeObserver(measureHeader).observe(header);
  else window.addEventListener('resize', measureHeader);
  if (enabled) { arm(); play(true); }
  }
  if(document.documentElement.dataset.printerIntro==='pending')window.addEventListener('portfolio:intro-complete',initializeAudio,{once:true});
  else initializeAudio();
})();
