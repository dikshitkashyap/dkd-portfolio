import { createRacePhotoLoader } from './race-photos.mjs?v=1';
import { dateKey, validateSummary } from './running-data.mjs?v=coros-summary-2';

const photo = document.querySelector('#race-photo-preview');
const milestones = [...document.querySelectorAll('[data-race-photo]')];
if (photo && milestones.length) {
  let image = photo.querySelector('img');
  const caption = photo.querySelector('[data-race-preview-caption]');
  const mobileLayout = matchMedia('(max-width:760px)');
  const desktopHome = document.createComment('Race photo desktop position');
  photo.before(desktopHome);
  const mobileHome = document.createElement('div');
  mobileHome.className = 'race-photo-mobile-home';
  document.querySelector('.milestone-ledger').after(mobileHome);
  function placePhoto() {
    if (mobileLayout.matches) {
      if (photo.parentElement !== mobileHome) mobileHome.append(photo);
      photo.setAttribute('role', 'group');
      photo.style.left = ''; photo.style.top = ''; image.style.maxHeight = '';
      if (active) pinned = true;
    } else {
      if (photo.parentElement === mobileHome) desktopHome.after(photo);
      photo.setAttribute('role', 'dialog');
      if (active && !defaultHint) pinned = false;
    }
    positionPhoto();
  }
  let active = null;
  let pinned = false;
  let defaultHint = false;
  let introAvailable = true;
  let restoringFocus = false;
  let hideTimer;
  const loader = createRacePhotoLoader({
    onPending() { photo.hidden = true; },
    onReady(nextImage, { milestone }) {
      nextImage.alt = milestone.dataset.raceAlt;
      if (image !== nextImage) { image.replaceWith(nextImage); image = nextImage; }
      caption.textContent = milestone.dataset.raceCaption;
      photo.hidden = false;
      positionPhoto();
    },
    onError() { closePhoto(); }
  });
  milestones.forEach(milestone => loader.preload(milestone.dataset.racePhoto));
  function positionPhoto() {
    if (!active || photo.hidden) return;
    if (mobileLayout.matches) {
      photo.style.left = ''; photo.style.top = ''; image.style.maxHeight = '';
      return;
    }
    const bounds = active.getBoundingClientRect();
    const minTop = (document.querySelector('.header')?.getBoundingClientRect().bottom || 0) + 16;
    image.style.maxHeight = '';
    let rect = photo.getBoundingClientRect();
    const preferredLeft = bounds.left - rect.width - 24;
    photo.style.left = `${Math.max(16, Math.min(preferredLeft, innerWidth - rect.width - 16))}px`;
    const frameHeight = rect.height - image.getBoundingClientRect().height;
    image.style.maxHeight = `${Math.max(0, Math.min(innerHeight * .58, innerHeight - minTop - 16 - frameHeight))}px`;
    rect = photo.getBoundingClientRect();
    const top = bounds.top + bounds.height / 2 - rect.height / 2;
    photo.style.top = `${Math.max(minTop, Math.min(top, innerHeight - rect.height - 16))}px`;
  }
  function closePhoto(restoreFocus = false) {
    clearTimeout(hideTimer);
    loader.cancel();
    const previous = active;
    milestones.forEach(m => m.setAttribute('aria-expanded', 'false'));
    photo.hidden = true;
    active = null;
    pinned = false;
    defaultHint = false;
    if (restoreFocus && previous) {
      restoringFocus = true;
      previous.focus({ preventScroll: true });
      restoringFocus = false;
    }
  }
  function showPhoto(milestone, pin = false, hint = false) {
    clearTimeout(hideTimer);
    introAvailable = false;
    defaultHint = hint;
    milestones.forEach(m => m.setAttribute('aria-expanded', String(m === milestone)));
    active = milestone;
    pinned = pin;
    loader.show(milestone.dataset.racePhoto, { milestone });
  }
  function deferClose(event) {
    if (pinned) return;
    clearTimeout(hideTimer);
    const pointerLeaving = event?.type === 'pointerleave';
    hideTimer = setTimeout(() => {
      // A mouse click must not keep a hover card open through button focus.
      if (pointerLeaving) {
        if (!active?.matches(':hover')) closePhoto();
      } else if (!photo.contains(document.activeElement) && document.activeElement !== active) closePhoto();
    }, 100);
  }
  milestones.forEach(milestone => {
    milestone.addEventListener('pointerenter', event => {
      if (!mobileLayout.matches && event.pointerType !== 'touch' && (!pinned || defaultHint || active !== milestone)) showPhoto(milestone);
    });
    milestone.addEventListener('pointerleave', deferClose);
    milestone.addEventListener('focus', () => { if ((!pinned || defaultHint) && !restoringFocus && milestone.matches(':focus-visible')) showPhoto(milestone, mobileLayout.matches); });
    milestone.addEventListener('blur', deferClose);
    milestone.addEventListener('click', event => {
      const touch = mobileLayout.matches || event.pointerType === 'touch' || (!event.pointerType && event.detail > 0 && matchMedia('(hover: none)').matches);
      if (touch && active === milestone && pinned) closePhoto();
      else showPhoto(milestone, touch);
    });
  });
  photo.addEventListener('pointerleave', deferClose);
  photo.addEventListener('focusout', deferClose);
  photo.querySelector('.race-photo-close').addEventListener('click', () => closePhoto(true));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !photo.hidden) closePhoto(pinned || photo.contains(document.activeElement)); });
  document.addEventListener('pointermove', event => {
    if (!mobileLayout.matches && defaultHint && event.pointerType !== 'touch' && !active?.contains(event.target)) closePhoto();
  }, { passive: true });
  document.addEventListener('pointerdown', event => { if (!mobileLayout.matches && !photo.hidden && !photo.contains(event.target) && !active?.contains(event.target)) closePhoto(); });
  mobileLayout.addEventListener('change', placePhoto);
  window.addEventListener('resize', positionPhoto);
  placePhoto();
  window.addEventListener('scroll', () => {
    if (mobileLayout.matches) return;
    if (defaultHint && active) {
      const bounds = active.getBoundingClientRect();
      const headerBottom = document.querySelector('.header')?.getBoundingClientRect().bottom || 0;
      if (bounds.bottom <= headerBottom || bounds.top >= innerHeight) { closePhoto(); return; }
    }
    if (pinned) positionPhoto(); else closePhoto();
  }, { passive: true });
  // Introduce the first photo only when its distance enters view, without moving focus.
  const firstRace = milestones[0];
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      const entry = entries[0];
      if (entry.isIntersecting && entry.intersectionRatio >= .6 && introAvailable) {
        showPhoto(firstRace, true, true);
      } else if (!mobileLayout.matches && !entry.isIntersecting && defaultHint) closePhoto();
    }, { threshold:[0, .6] }).observe(firstRace);
  } else {
    const introduce = () => {
      if (!introAvailable) return;
      const bounds = firstRace.getBoundingClientRect();
      const headerBottom = document.querySelector('.header')?.getBoundingClientRect().bottom || 0;
      if (bounds.top >= headerBottom + 16 && bounds.bottom <= innerHeight) {
        showPhoto(firstRace, true, true);
      }
    };
    window.addEventListener('scroll', introduce, { passive:true });
    introduce();
  }

}

const log = document.querySelector('[data-running-log]');
if (log) {
  const year = Number(dateKey(new Date()).slice(0, 4));
  const status = log.querySelector('[data-log-status]');
  const period = log.querySelector('[data-log-period]');
  const refresh = log.querySelector('[data-log-refresh]');
  const latest = log.querySelector('[data-latest-run]');
  const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
  let successful = null;
  let refreshing = false;
  let refreshTimer;
  period.textContent = `in ${year}`;
  async function refreshSummary() {
    if (refreshing) return;
    clearTimeout(refreshTimer);
    refreshing = true;
    refresh.disabled = true;
    log.setAttribute('aria-busy', 'true');
    status.textContent = 'Checking the running log…';
    try {
      const response = await fetch(`/api/running-summary?year=${year}`, { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Running log unavailable');
      const summary = validateSummary(await response.json(), year);
      log.querySelector('[data-run-km]').textContent = `${number.format(summary.totals.distanceKm)} km`;
      period.textContent = summary.coverage.complete ? `in ${year}` : `· ${summary.coverage.startDate} to ${summary.coverage.endDate}`;
      const date = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(summary.updatedAt));
      status.textContent = `Last updated ${date}`;
      latest.textContent = summary.lastRun ? `${number.format(summary.lastRun.distanceKm)} km · ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(`${summary.lastRun.date}T12:00:00Z`))}` : 'No recorded runs';
      log.dataset.state = Date.now() - Date.parse(summary.updatedAt) > 36 * 3600000 ? 'stale' : 'ready';
      if (log.dataset.state === 'stale') status.textContent += ' · Update pending';
      successful = summary;
      refreshTimer = setTimeout(() => { if (!document.hidden) refreshSummary(); }, 3600000);
    } catch {
      if (successful) {
        log.dataset.state = 'stale';
        status.textContent = 'Update unavailable. Showing the last successful running log.';
      } else {
        log.dataset.state = 'unavailable';
        status.textContent = 'Running log not connected yet.';
      }
    } finally {
      refreshing = false;
      refresh.disabled = false;
      log.setAttribute('aria-busy', 'false');
    }
  }
  refresh.addEventListener('click', refreshSummary);
  refreshSummary();
}
