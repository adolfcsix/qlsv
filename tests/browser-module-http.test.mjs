import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {openDatabase} from '../backend/src/config/database.js';
import {createApp} from '../backend/src/app.js';

test('Browser module graph loads over HTTP, including the shared chatbot module', async () => {
  const db = await openDatabase({driver:'sqlite',file:':memory:'});
  const {server} = await createApp({db,seed:true});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const seen = new Set();
  async function visit(url) {
    if(seen.has(url.href)) return;
    seen.add(url.href);
    const response = await fetch(url);
    assert.equal(response.status,200,url.pathname);
    assert.match(response.headers.get('content-type'),/javascript/,url.pathname);
    const source = await response.text();
    // Resolve imports as a browser does, against the HTTP URL, not filesystem paths.
    for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])(\.[^'"\n]+)\1/g)) {
      await visit(new URL(match[2],url));
    }
  }
  try {
    await visit(new URL('/src/main.js',origin));
    assert.ok(seen.has(origin+'/shared/lookup-intents.js'));
    assert.equal(await (await fetch(origin+'/shared/lookup-intents.js')).text(),await readFile(new URL('../shared/lookup-intents.js',import.meta.url),'utf8'));
    for(const path of ['/shared/private.js','/backend/src/config/env.js','/.env']) {
      assert.notEqual((await fetch(origin+path)).status,200,path);
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
    await db.close();
  }
});
