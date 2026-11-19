import { cleanImageUrl, mergeArticles } from './notes-data.mjs';
const section = document.querySelector('#writing');
if (section) {
  const list = section.querySelector('[data-notes-list]');
  const status = section.querySelector('[data-notes-status]');
  const fallback = [...list.querySelectorAll('.note-card')].map(card => ({ title: card.querySelector('h3').textContent, url: card.href, excerpt: card.querySelector('p').textContent, date: null }));
  const cacheKey = 'portfolio-medium-notes-v1';
  let articles = mergeArticles(fallback);
  let busy = false;
  let lastSuccess = null;
  function render() {
    const fragment = document.createDocumentFragment();
    articles.slice(0, 3).forEach((article, index) => {
      const item = document.createElement('li');
      const card = document.createElement('a'); card.className = 'note-card'; card.href = article.url; card.target = '_blank'; card.rel = 'noopener';
      const meta = document.createElement('span'); meta.className = 'note-meta';
      const date = article.date ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(article.date)) : 'Medium';
      meta.append(document.createTextNode(date));
      const number = document.createElement('span'); number.className = 'note-index'; number.textContent = String(index + 1).padStart(2, '0'); meta.append(number);
      const title = document.createElement('h3'); title.textContent = article.title;
      const excerpt = document.createElement('p'); excerpt.textContent = article.excerpt;
      const read = document.createElement('span'); read.className = 'note-read'; read.textContent = 'Read note ';
      const arrow = document.createElement('span'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '↗'; read.append(arrow);
      const copy = document.createElement('div'); copy.className = 'note-copy'; copy.append(meta, title, excerpt, read);
      if (index === 0 && article.image) {
        const image = document.createElement('img'); image.className = 'note-cover'; image.src = article.image; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
        card.classList.add('has-cover');
        image.addEventListener('error', () => { image.remove(); card.classList.remove('has-cover'); }, { once: true });
        card.append(image);
      }
      card.append(copy); item.append(card); fragment.append(item);
    });
    list.replaceChildren(fragment);
  }
  function plainText(html) {
    const document = new DOMParser().parseFromString(html, 'text/html');
    document.querySelectorAll('script, style, iframe, img, figure').forEach(node => node.remove());
    return document.body.textContent.replace(/\s+/g, ' ').trim();
  }
  function coverImage(html) {
    const document = new DOMParser().parseFromString(html, 'text/html');
    const images = [...document.querySelectorAll('img')];
    return images.filter(image => image.getAttribute('width') !== '1' && image.getAttribute('height') !== '1').map(image => cleanImageUrl(image.getAttribute('src'))).find(Boolean) ?? null;
  }
  function parseFeed(xml) {
    if (xml.length > 5000000) throw new Error('Feed too large');
    const document = new DOMParser().parseFromString(xml, 'text/xml');
    if (document.querySelector('parsererror') || !document.querySelector('rss > channel')) throw new Error('Invalid Medium feed');
    return mergeArticles([...document.querySelectorAll('channel > item')].map(item => ({
      title: item.querySelector('title')?.textContent,
      url: item.querySelector('link')?.textContent,
      date: item.querySelector('pubDate')?.textContent,
      image: coverImage(item.getElementsByTagNameNS('*', 'encoded')[0]?.textContent ?? item.querySelector('description')?.textContent ?? ''),
      excerpt: plainText(item.getElementsByTagNameNS('*', 'encoded')[0]?.textContent ?? item.querySelector('description')?.textContent ?? '')
    })));
  }
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey));
    if (cached && Array.isArray(cached.articles) && Number.isFinite(Date.parse(cached.fetchedAt))) {
      articles = mergeArticles(cached.articles, fallback); lastSuccess = cached.fetchedAt; render();
    }
  } catch { /* The static notes remain usable if storage is unavailable. */ }
  async function refresh() {
    if (busy) return;
    busy = true;
    try {
      const response = await fetch('/medium-feed.xml', { signal: AbortSignal.timeout(12000), credentials: 'omit', cache: 'no-cache' });
      if (!response.ok) throw new Error('Feed unavailable');
      const fresh = parseFeed(await response.text());
      if (!fresh.length) throw new Error('No articles returned');
      articles = mergeArticles(fresh, articles, fallback);
      lastSuccess = new Date().toISOString(); render();
      status.textContent = 'Latest notes from Medium';
      try { localStorage.setItem(cacheKey, JSON.stringify({ articles, fetchedAt: lastSuccess })); } catch { /* Storage is optional. */ }
    } catch {
      status.textContent = lastSuccess ? 'Showing saved notes · Medium update temporarily unavailable' : 'Selected notes · Latest updates temporarily unavailable';
    } finally { busy = false; }
  }
  render(); refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 900000);
}
