(() => {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let scroller;
  function start() {
    scroller?.destroy(); scroller = null;
    if (preference.matches || typeof window.Lenis !== 'function') {
      delete document.documentElement.dataset.smoothScrolling;
      return;
    }
    scroller = new window.Lenis({
      autoRaf: true,
      smoothWheel: true,
      syncTouch: false,
      lerp: .12,
      anchors: { duration: .8 },
      prevent: node => !!node.closest('.fieldwork-strip, .mdr-board-scroll, textarea, select, [data-lenis-prevent]')
    });
    document.documentElement.dataset.smoothScrolling = 'enabled';
  }
  preference.addEventListener('change', start);
  window.addEventListener('pagehide', () => { scroller?.destroy(); scroller = null; });
  window.addEventListener('pageshow', () => { if (!scroller) start(); });
  start();
})();
