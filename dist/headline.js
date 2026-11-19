(() => {
  const words = ['simple', 'clear', 'effortless'];
  const hero = document.querySelector('.typewriter-hero');
  const text = document.querySelector('[data-typed-word]');
  const period = document.querySelector('[data-typed-period]');
  const toggle = document.querySelector('[data-type-toggle]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let timer = null;
  let manualPaused = false;
  let visible = true;
  let started = false;
  const canRun = () => !manualPaused && visible && !document.hidden && !reduced.matches;
  function cancel() { clearTimeout(timer); timer = null; }
  function render(value, complete, state) {
    text.textContent = value;
    period.hidden = !complete;
    hero.dataset.state = state;
  }
  function controls() {
    hero.dataset.paused = String(!canRun());
    toggle.disabled = reduced.matches;
    toggle.setAttribute('aria-label', manualPaused ? 'Play headline animation' : 'Pause headline animation');
  }
  function later(fn, delay) {
    cancel();
    if (canRun()) timer = setTimeout(fn, delay);
  }
  function hold() { render(words[index], true, 'holding'); controls(); later(erase, 2400); }
  function type(count = 0) {
    if (!canRun()) return;
    if (count >= words[index].length) { hold(); return; }
    render(words[index].slice(0, count + 1), false, 'typing');
    later(() => type(count + 1), 95);
  }
  function erase() {
    if (!canRun()) return;
    const remaining = text.textContent.slice(0, -1);
    render(remaining, false, 'deleting');
    if (remaining.length) later(erase, 45);
    else { index = (index + 1) % words.length; later(() => type(), 230); }
  }
  function settle() { cancel(); render(words[index], true, 'holding'); controls(); }
  function resume() {
    cancel(); controls();
    if (reduced.matches) { index = 0; settle(); return; }
    if (!canRun()) { settle(); return; }
    if (!started) {
      started = true;
      render('', false, 'typing'); later(() => type(), 450);
    } else hold();
  }
  toggle.addEventListener('click', () => { manualPaused = !manualPaused; if (manualPaused) settle(); else resume(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) settle(); else resume(); });
  reduced.addEventListener('change', () => { manualPaused = false; resume(); });
  hero.dataset.typeEnabled = 'true';
  if ('IntersectionObserver' in window) {
    visible = false;
    new IntersectionObserver(entries => {
      const next = entries[0].isIntersecting;
      if (next === visible) return;
      visible = next;
      if (visible) resume(); else settle();
    }, { threshold:.15 }).observe(hero);
    controls();
  } else resume();
})();
