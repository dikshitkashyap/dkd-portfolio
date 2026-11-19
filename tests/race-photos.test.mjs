import test from 'node:test';
import assert from 'node:assert/strict';
import { createRacePhotoLoader } from '../dist/race-photos.mjs';
function harness() {
  const images = [], visible = [];
  const loader = createRacePhotoLoader({
    createImage() {
      let finish, fail;
      const promise = new Promise((resolve, reject) => { finish = resolve; fail = reject; });
      const image = { decode: () => promise, finish, fail }; images.push(image); return image;
    },
    onReady(image, context) { visible.push([image.src, context]); },
    onPending(context) { visible.push(['hidden', context]); }
  });
  return { images, visible, loader };
}
test('preloaded photos display synchronously without another request or a stale frame', async () => {
  const { images, visible, loader } = harness();
  const ready = loader.preload('wipro.jpeg'); images[0].finish(); await ready;
  const shown = loader.show('wipro.jpeg', '21.1 km');
  assert.deepEqual(visible, [['wipro.jpeg', '21.1 km']]);
  assert.equal(images.length, 1); assert.equal(await shown, true);
});
test('a late default 12.5 km load cannot overwrite a newer 21.1 km request', async () => {
  const { images, visible, loader } = harness();
  const first = loader.show('ultra.jpeg', '12.5 km');
  const second = loader.show('wipro.jpeg', '21.1 km');
  images[1].finish(); assert.equal(await second, true);
  images[0].finish(); assert.equal(await first, false);
  assert.deepEqual(visible.filter(([src]) => src !== 'hidden'), [['wipro.jpeg', '21.1 km']]);
});
test('closing during loading cancels the pending photo and failed loads never reveal the old photo', async () => {
  const { images, visible, loader } = harness();
  const first = loader.show('ultra.jpeg', '12.5 km'); loader.cancel(); images[0].finish();
  assert.equal(await first, false);
  const second = loader.show('wipro.jpeg', '21.1 km'); images[1].fail(new Error('offline'));
  assert.equal(await second, false);
  assert(visible.every(([src]) => src === 'hidden'));
});
