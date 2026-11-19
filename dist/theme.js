// Apply the requested light default before styles paint.
(() => {
  // Every fresh page starts light; dark mode is a deliberate in-page choice.
  let preference = 'light';
  function apply() {
    const theme = preference || 'light';
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', document.documentElement.dataset.printerIntro==='pending' ? '#fff' : (theme === 'dark' ? '#181a18' : '#fafaf8'));
    const button = document.querySelector('[data-theme-toggle]');
    if (button) {
      const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
      button.setAttribute('aria-label', label);
      button.title = label;
      button.hidden = false;
    }
  }
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      apply();
    });
  }, { once: true });
})();
