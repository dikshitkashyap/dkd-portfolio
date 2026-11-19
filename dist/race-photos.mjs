// Decode each race once and commit only the latest interaction's image.
export function createRacePhotoLoader({ createImage = () => new Image(), onReady, onPending = () => {}, onError = () => {} }) {
  const cache = new Map();
  let selection = 0;
  function prepare(source) {
    if (cache.has(source)) return cache.get(source);
    const image = createImage();
    image.loading = 'eager'; image.decoding = 'async'; image.fetchPriority = 'high';
    const record = { image, ready: false };
    cache.set(source, record);
    const loaded = typeof image.decode === 'function' ? null : new Promise((resolve, reject) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', reject, { once: true });
    });
    image.src = source;
    record.promise = (async () => {
      try { await (loaded || image.decode()); record.ready = true; return true; }
      catch { return false; }
    })();
    return record;
  }
  return {
    preload(source) { return prepare(source).promise; },
    cancel() { selection++; },
    async show(source, context) {
      const request = ++selection, record = prepare(source);
      if (!record.ready) {
        onPending(context);
        const loaded = await record.promise;
        if (request !== selection) return false;
        if (!loaded) { onError(context); return false; }
      }
      if (request !== selection) return false;
      onReady(record.image, context);
      return true;
    }
  };
}
