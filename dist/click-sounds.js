(() => {
  const key = 'portfolio-click-sounds';
  const toggles = [...document.querySelectorAll('[data-click-sounds]')];
  let enabled = true;
  let context = null;
  let buffer = null;
  let lastClick = -Infinity;
  let loading = null;
  let request = 0;
  let active = null;
  const clip = toggles[0]?.getAttribute('data-click-sound-src');
  try { enabled = localStorage.getItem(key) !== 'false'; } catch { /* Preference storage is optional. */ }
  function update() {
    toggles.forEach(button => {
      button.hidden = false;
      button.textContent = `Click sounds ${enabled ? 'on' : 'off'}`;
      button.setAttribute('aria-pressed', String(enabled));
      button.setAttribute('aria-label', enabled ? 'Mute click sounds' : 'Enable click sounds');
    });
  }
  function prepare() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return false;
    context = window.portfolioSoundContext || context || new Context();
    window.portfolioSoundContext = context;
    return true;
  }
  function load() {
    if (buffer) return Promise.resolve(buffer);
    if (!loading) loading = fetch(clip)
      .then(response => {
        if (!response.ok) throw new Error('Click audio unavailable');
        return response.arrayBuffer();
      })
      .then(bytes => context.decodeAudioData(bytes))
      .then(decoded => { buffer = decoded; return decoded; })
      .catch(error => { loading = null; throw error; });
    return loading;
  }
  async function sound(kind = 'tap') {
    if (!enabled || document.hidden || !clip) return;
    const now = performance.now();
    if (now - lastClick < 90) return;
    lastClick = now;
    const currentRequest = ++request;
    try {
      if (!prepare()) return;
      // Resume inside the gesture; decode and cache the supplied recording once.
      const resume = context.state === 'suspended' ? context.resume() : Promise.resolve();
      const [decoded] = await Promise.all([load(), resume]);
      if (!enabled || document.hidden || context.state !== 'running' || currentRequest !== request || performance.now() - now > 500) return;
      if (active) active.stop();
      const source = context.createBufferSource();
      const level = context.createGain();
      source.buffer = decoded;
      source.playbackRate.value = 1;
      level.gain.value = 1;
      source.connect(level); level.connect(context.destination);
      source.onended = () => {
        source.disconnect(); level.disconnect();
        if (active === source) active = null;
      };
      active = source;
      source.start();
    } catch { /* Audio feedback never blocks an interaction. */ }
  }
  function silence() {
    ++request;
    if (active) { active.stop(); active = null; }
  }
  toggles.forEach(button => button.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem(key, String(enabled)); } catch { /* Use the current page's setting. */ }
    update();
    if (enabled) sound();
    else silence();
  }));
  document.addEventListener('click', event => {
    if (!event.isTrusted || event.defaultPrevented || !enabled) return;
    const target = event.target.closest?.('button, a[href], summary');
    if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true' || target.hasAttribute('data-click-sounds')) return;
    const summary = target.matches('summary') ? target : null;
    const kind = summary ? (summary.parentElement.open ? 'close' : 'open') : 'tap';
    sound(kind);
  });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { enabled = event.newValue !== 'false'; if (!enabled) silence(); update(); }
  });
  update();
})();
