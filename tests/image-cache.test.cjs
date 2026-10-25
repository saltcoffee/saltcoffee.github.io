const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const workerSource = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

function imageResponse(body = '<svg/>', headers = {}) {
  return new Response(body, { headers: { 'Content-Type': 'image/svg+xml', ...headers } });
}

function streamingImage() {
  let controller;
  const body = new ReadableStream({ start(value) { controller = value; } });
  controller.enqueue(new TextEncoder().encode('<svg>'));
  return {
    response: imageResponse(body),
    finish() { controller.enqueue(new TextEncoder().encode('</svg>')); controller.close(); },
    fail() { controller.error(new Error('Download interrupted')); }
  };
}

function worker(fetchImage = () => imageResponse()) {
  const stores = new Map(), requests = [], tasks = [];
  const caches = {
    async keys() { return [...stores.keys()]; },
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async match(request) { return entries.get(request.url)?.clone(); },
        async put(request, response) {
          // Like Cache.put(), this cannot complete until the body has arrived.
          const body = await response.arrayBuffer();
          entries.set(request.url, new Response(body, { status: response.status, headers: response.headers }));
        },
        async keys() { return [...entries.keys()].map(url => new Request(url)); },
        async delete(request) { return entries.delete(request.url); }
      };
    }
  };
  const context = vm.createContext({
    URL, Request, Response, Headers, Promise, Date, Number, Set,
    self: { registration: { scope: 'https://blog.test/' }, addEventListener() {} },
    caches,
    async fetch(request) { requests.push(request.url); return fetchImage(request); }
  });
  vm.runInContext(workerSource, context);
  return {
    stores, requests,
    load(name, init) {
      return context.imageCacheFirst({
        request: new Request(new URL(name, 'https://blog.test/'), init),
        waitUntil(task) { tasks.push(task); }
      });
    },
    async settle() { await Promise.all(tasks); },
    images() { return [...stores.entries()].find(([name]) => name.endsWith(':images-v1'))[1]; },
    metadata() { return [...stores.entries()].find(([name]) => name.endsWith(':images-meta-v1'))[1]; }
  };
}

async function promptly(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Image waited for an unrelated download')), 500);
      })
    ]);
  } finally { clearTimeout(timer); }
}

test('a new original loads while another image body is still downloading', async () => {
  const slow = streamingImage();
  const app = worker(request => request.url.endsWith('/slow.svg') ? slow.response : imageResponse());
  const response = await app.load('slow.svg');
  const slowBody = response.text();
  // Give the background storage operation a chance to begin waiting for its body.
  await new Promise(resolve => setImmediate(resolve));
  try {
    const current = await promptly(app.load('current.svg'));
    assert.equal(await current.text(), '<svg/>');
    assert.equal(app.requests.length, 2);
  } finally {
    slow.finish();
    await slowBody;
    await app.settle();
  }
});

test('a cached original displays while another image body is still downloading', async () => {
  const slow = streamingImage();
  const app = worker(request => request.url.endsWith('/slow.svg') ? slow.response : imageResponse());
  await (await app.load('cached.svg')).text();
  await app.settle();
  const slowBody = (await app.load('slow.svg')).text();
  await new Promise(resolve => setImmediate(resolve));
  try {
    const cached = await promptly(app.load('cached.svg'));
    assert.equal(await cached.text(), '<svg/>');
    assert.equal(app.requests.filter(url => url.endsWith('/cached.svg')).length, 1);
  } finally {
    slow.finish();
    await slowBody;
    await app.settle();
  }
});

test('an interrupted image is not cached and does not stall later requests', async () => {
  const broken = streamingImage();
  const app = worker(request => request.url.endsWith('/broken.svg') ? broken.response : imageResponse());
  const body = (await app.load('broken.svg')).text();
  const rejected = assert.rejects(body, /Download interrupted/);
  broken.fail();
  await rejected;
  await app.settle();
  assert.equal(await (await promptly(app.load('current.svg'))).text(), '<svg/>');
  await app.settle();
  assert.equal(app.images().has('https://blog.test/broken.svg'), false);
});

test('completed concurrent downloads retain the 48-image cache limit and matching metadata', async () => {
  const app = worker();
  await Promise.all(Array.from({ length: 55 }, async (_, index) => {
    await (await app.load('photo-' + index + '.svg')).text();
  }));
  await app.settle();
  assert.equal(app.images().size, 48);
  assert.deepEqual([...app.metadata().keys()], [...app.images().keys()]);
});

test('expired images are refreshed and no-store responses remove durable copies', async () => {
  let privateResponse = false;
  const app = worker(() => imageResponse('<svg/>', privateResponse ? { 'Cache-Control': 'no-store' } : {}));
  await (await app.load('photo.svg')).text();
  await app.settle();
  app.metadata().set('https://blog.test/photo.svg', new Response(String(Date.now() - 8 * 24 * 60 * 60 * 1000)));
  await (await app.load('photo.svg')).text();
  await app.settle();
  assert.equal(app.requests.length, 2);
  privateResponse = true;
  await (await app.load('photo.svg', { cache: 'reload' })).text();
  await app.settle();
  assert.equal(app.images().size, 0);
  assert.equal(app.metadata().size, 0);
});
