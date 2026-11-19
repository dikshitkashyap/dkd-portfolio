const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('#main-nav');
if (menu && nav) {
  const closeMenu = () => { menu.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); };
  menu.addEventListener('click', () => {
    const isOpen = menu.getAttribute('aria-expanded') === 'true';
    menu.setAttribute('aria-expanded', String(!isOpen));
    nav.classList.toggle('is-open', !isOpen);
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { closeMenu(); menu.focus(); } });
  window.matchMedia('(min-width: 761px)').addEventListener('change', e => { if (e.matches) closeMenu(); });
}
// Preserve the single-project accordion behaviour in browsers without details[name].
const projects = [...document.querySelectorAll('details.project')];
projects.forEach(project => project.addEventListener('toggle', () => {
  if (project.open) projects.forEach(other => { if (other !== project) other.open = false; });
}));

// Measure only the case study, ending before the next-project navigation.
// ResizeObserver keeps the range accurate as images finish loading.
const caseStudy = document.querySelector('.case-main');
if (caseStudy) {
  const progress = document.createElement('div');
  progress.className = 'reading-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.append(progress);
  let start = 0;
  let travel = 0;
  let frame = null;
  function paintProgress() {
    frame = null;
    const fraction = travel > 0 ? Math.max(0, Math.min(1, (window.scrollY - start) / travel)) : 1;
    progress.style.transform = `scaleX(${fraction})`;
  }
  function queueProgress() {
    if (frame === null) frame = requestAnimationFrame(paintProgress);
  }
  function measureProgress() {
    const bounds = caseStudy.getBoundingClientRect();
    const nextProject = caseStudy.querySelector('.next-project');
    start = Math.max(0, bounds.top + window.scrollY);
    const end = (nextProject ? nextProject.getBoundingClientRect().top : bounds.bottom) + window.scrollY;
    travel = end - window.innerHeight - start;
    queueProgress();
  }
  window.addEventListener('scroll', queueProgress, { passive: true });
  window.addEventListener('resize', measureProgress);
  window.addEventListener('pageshow', measureProgress);
  if ('ResizeObserver' in window) new ResizeObserver(measureProgress).observe(caseStudy);
  else window.addEventListener('load', measureProgress);
  measureProgress();
}
