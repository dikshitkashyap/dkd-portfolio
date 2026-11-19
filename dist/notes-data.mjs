export function cleanImageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password && (url.hostname === 'medium.com' || url.hostname.endsWith('.medium.com'))) return url.href;
  } catch {}
  return null;
}
export function cleanArticle(article) {
  if (!article || typeof article.title !== 'string' || !article.title.trim()) return null;
  let url;
  try { url = new URL(article.url); } catch { return null; }
  if (url.protocol !== 'https:' || !(url.hostname === 'medium.com' || url.hostname.endsWith('.medium.com')) || url.username || url.password) return null;
  url.search = ''; url.hash = '';
  const date = article.date && Number.isFinite(Date.parse(article.date)) ? new Date(article.date).toISOString() : null;
  return { title: article.title.trim().slice(0, 240), url: url.href, excerpt: typeof article.excerpt === 'string' ? article.excerpt.trim().slice(0, 280) : '', date, image: cleanImageUrl(article.image) };
}
export function mergeArticles(...collections) {
  const found = new Map();
  for (const articles of collections) for (const raw of articles) {
    const article = cleanArticle(raw);
    if (!article) continue;
    const id = article.url.match(/-([a-f0-9]{12})\/?$/i)?.[1] ?? article.url;
    if (!found.has(id)) found.set(id, article);
  }
  return [...found.values()].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
}
