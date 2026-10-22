'use strict';

/**
 * GHO-130: deep scan, пасхалки PHP, phpinfo, фингерпринт приложений.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { scan, MAX_DEEP_REQUESTS } = require('../src/scan');
const { createApp } = require('../src/server');
const { parseArgs, usage } = require('../cli');
const fixtures = require('./fixtures.json');
const { startFixtureServer } = require('./helpers/fixture-server');

const PRIVATE = { allowPrivateTargets: true };

const PHPINFO_826 = `<!doctype html><html><head><title>phpinfo()</title></head><body>
<h1>PHP Version 8.4.26</h1>
<table>
<tr><td class="e">PHP Version </td><td class="v">8.4.26 </td></tr>
<tr><td class="e">Server API </td><td class="v">FPM/FastCGI </td></tr>
<tr><td class="e">DOCUMENT_ROOT </td><td class="v">/var/www/secret-project</td></tr>
<tr><td class="e">AUTH_TOKEN </td><td class="v">supersecret-token</td></tr>
</table></body></html>`;

const PHPINFO_827 = PHPINFO_826
  .replace('PHP Version 8.4.26', 'PHP Version 8.4.27')
  .replace('8.4.26 ', '8.4.27 ');

const CREDITS_EGG = `<!doctype html><html><head><title>PHP Credits</title></head><body>
<h1>PHP 5.4.45 - Credits</h1>
<p>PHP Version 5.4.45</p>
<p>This program is free software; you can redistribute it.</p>
</body></html>`;

/** 404-заглушки для всех deep-путей, кроме явно переопределённых. */
function notFoundProbes() {
  return {
    'phpinfo.php': { status: 404, body: 'not found' },
    'info.php': { status: 404, body: 'not found' },
    'test.php': { status: 404, body: 'not found' },
    'php.php': { status: 404, body: 'not found' },
    '/?phpinfo=1': { status: 404, body: 'not found' },
    '/status?full': { status: 404, body: 'not found' },
    '/ping': { status: 404, body: 'not found' },
    '/?=PHPE9568F34-D428-11d2-A769-00AA001ACF42': { status: 404, body: 'not found' },
    '/?=PHPE9568F35-D428-11d2-A769-00AA001ACF42': { status: 404, body: 'not found' },
    '/?=PHPE9568F36-D428-11d2-A769-00AA001ACF42': { status: 404, body: 'not found' },
  };
}

const ALLOWED_PATHS = new Set([
  '/',
  '/phpinfo.php',
  '/info.php',
  '/test.php',
  '/php.php',
  '/?phpinfo=1',
  '/status?full',
  '/ping',
  '/?=PHPE9568F34-D428-11d2-A769-00AA001ACF42',
  '/?=PHPE9568F35-D428-11d2-A769-00AA001ACF42',
  '/?=PHPE9568F36-D428-11d2-A769-00AA001ACF42',
]);

test('deep выключен: ни одного запроса вне корня, поведение прежнее', async () => {
  const srv = await startFixtureServer({
    root: fixtures['php-hidden-version'],
    'phpinfo.php': { status: 200, body: PHPINFO_826 },
  });
  try {
    const report = await scan(srv.url, PRIVATE);
    assert.equal(report.deep, false);
    assert.equal(report.php.version, null);
    assert.equal(report.php.requests, 1);
    assert.equal(report.http.requests, 1);
    assert.equal(srv.getRequests().length, 1);
    assert.equal(srv.getRequests()[0], '/');
    assert.equal(report.summary.status, 'unknown');
  } finally {
    await srv.close();
  }
});

test('deep + phpinfo: версия 8.4.26 → vulnerable, source=phpinfo', async () => {
  const srv = await startFixtureServer({
    root: fixtures['php-hidden-version'],
    'phpinfo.php': { status: 200, body: PHPINFO_826 },
  });
  try {
    const report = await scan(srv.url, { ...PRIVATE, deep: true });

    assert.equal(report.deep, true);
    assert.equal(report.php.version, '8.4.26');
    assert.equal(report.php.versionSource, 'phpinfo');
    assert.equal(report.php.precision, 3);
    assert.equal(report.php.sapi, 'php-fpm');
    assert.equal(report.php.sapiConfidence, 'high');
    assert.equal(report.php.requests, 2);
    assert.equal(report.http.requests, 2);
    assert.ok(report.checks.some((check) => check.name === 'deep:phpinfo:/phpinfo.php'));
    for (const cve of report.cves) {
      assert.equal(cve.status, 'vulnerable');
      assert.equal(cve.confidence, 'high');
    }
    assert.equal(report.summary.status, 'vulnerable');

    // В отчёт не попадают пути, токены и прочие поля phpinfo.
    const json = JSON.stringify(report);
    assert.doesNotMatch(json, /secret-project|supersecret-token|DOCUMENT_ROOT/);
  } finally {
    await srv.close();
  }
});

test('deep + phpinfo: версия 8.4.27 → not_vulnerable', async () => {
  const srv = await startFixtureServer({
    root: fixtures['php-hidden-version'],
    'phpinfo.php': { status: 200, body: PHPINFO_827 },
  });
  try {
    const report = await scan(srv.url, { ...PRIVATE, deep: true });
    assert.equal(report.php.version, '8.4.27');
    assert.equal(report.php.versionSource, 'phpinfo');
    for (const cve of report.cves) assert.equal(cve.status, 'not_vulnerable');
    assert.equal(report.summary.status, 'not_vulnerable');
  } finally {
    await srv.close();
  }
});

test('пасхалка credits: только legacy PHP 5.x, без точной версии', async () => {
  const srv = await startFixtureServer({
    root: fixtures['php-hidden-version'],
    ...notFoundProbes(),
    '/?=PHPE9568F34-D428-11d2-A769-00AA001ACF42': { status: 200, body: CREDITS_EGG },
  });
  try {
    const report = await scan(srv.url, { ...PRIVATE, deep: true });

    assert.equal(report.php.version, null, 'пасхалка не должна давать точную версию');
    assert.equal(report.php.legacyPhp5, true);
    assert.equal(report.php.versionSource, 'easter-egg');
    assert.equal(report.php.confidence, 'medium');
    assert.ok(report.php.requests <= MAX_DEEP_REQUESTS);
    for (const cve of report.cves) {
      assert.equal(cve.status, 'vulnerable');
      assert.equal(cve.confidence, 'medium');
      assert.match(cve.reason, /5\.x|legacy/i);
    }
    assert.equal(report.summary.status, 'vulnerable');
    assert.doesNotMatch(JSON.stringify(report), /5\.4\.45/);
  } finally {
    await srv.close();
  }
});

test('пасхалка-логотип (GIF) распознаётся как legacy PHP', async () => {
  const srv = await startFixtureServer({
    root: fixtures['php-hidden-version'],
    ...notFoundProbes(),
    '/?=PHPE9568F35-D428-11d2-A769-00AA001ACF42': {
      status: 200,
      headers: { 'Content-Type': 'image/gif' },
      body: 'GIF89a\u0001\u0000\u0001\u0000\u0080\u0000\u0000\u0000\u0000\u0000\u00ff\u00ff\u00ff!\u00f9\u0004\u0001\u0000\u0000\u0000\u0000,\u0000\u0000\u0000\u0000\u0001\u0000\u0001\u0000\u0000\u0002\u0002D\u0001\u0000;',
    },
  });
  try {
    const report = await scan(srv.url, { ...PRIVATE, deep: true });
    assert.equal(report.php.legacyPhp5, true);
    assert.equal(report.php.versionSource, 'easter-egg');
    assert.equal(report.php.version, null);
  } finally {
    await srv.close();
  }
});

test('WordPress generator → versionMin 7.2.24 и unknown (нижняя граница не вердикт)', async () => {
  const srv = await startFixtureServer({
    root: {
      status: 200,
      headers: { Server: 'nginx' },
      body: '<!doctype html><html><head><meta name="generator" content="WordPress 6.6.3"></head><body>wp</body></html>',
    },
  });
  try {
    const report = await scan(srv.url, PRIVATE);

    assert.equal(report.php.version, null);
    assert.equal(report.php.versionMin, '7.2.24');
    assert.equal(report.php.versionMinSource, 'app-fingerprint');
    assert.deepEqual(report.php.versionBound, { min: '7.2.24', source: 'app-fingerprint' });
    assert.equal(report.php.versionSource, 'app-fingerprint');
    assert.equal(report.php.app.name, 'WordPress');
    assert.equal(report.php.app.version, '6.6.3');
    assert.equal(report.php.requests, 1, 'фингерпринт пассивный, лишних запросов нет');
    for (const cve of report.cves) {
      // Нижняя граница 7.2.24 ниже исправленной версии: фактическая версия
      // может быть 8.4.x, поэтому подверженность не доказана.
      assert.equal(cve.status, 'unknown');
      assert.equal(cve.confidence, 'low');
      assert.equal(cve.lowerBoundOnly, true);
      assert.match(cve.reason, /7\.2\.24/);
      assert.match(cve.reason, /нижняя граница/i);
    }
    assert.equal(report.summary.status, 'unknown');
  } finally {
    await srv.close();
  }
});

test('Drupal 11 generator → versionMin 8.3.0 (ниже фикса 8.3.36) даёт unknown', async () => {
  const srv = await startFixtureServer({
    root: {
      status: 200,
      headers: { Server: 'nginx' },
      body: '<html><head><meta name="generator" content="Drupal 11"></head><body>drupal</body></html>',
    },
  });
  try {
    const report = await scan(srv.url, PRIVATE);
    assert.equal(report.php.versionMin, '8.3.0');
    assert.deepEqual(report.php.versionBound, { min: '8.3.0', source: 'app-fingerprint' });
    assert.equal(report.php.app.name, 'Drupal');
    for (const cve of report.cves) {
      assert.equal(cve.status, 'unknown');
      assert.equal(cve.confidence, 'low');
      assert.match(cve.reason, /8\.3\.0/);
      assert.match(cve.reason, /8\.3\.36/);
    }
  } finally {
    await srv.close();
  }
});

test('deep: лимит 10 запросов и только allowlist', async () => {
  const srv = await startFixtureServer({
    root: fixtures['php-hidden-version'],
    ...notFoundProbes(),
  });
  try {
    const report = await scan(srv.url, { ...PRIVATE, deep: true });

    assert.equal(report.php.requests, MAX_DEEP_REQUESTS, 'всего не больше 10 запросов');
    assert.equal(report.http.requests, MAX_DEEP_REQUESTS);
    assert.equal(srv.getRequests().length, MAX_DEEP_REQUESTS);
    assert.ok(srv.getRequests().length <= 10, 'не больше 10 запросов всего');
    for (const raw of srv.getRequests()) {
      assert.ok(ALLOWED_PATHS.has(raw), `запрос вне allowlist: ${raw}`);
    }
    assert.ok(report.checks.some((check) => check.name === 'deep:limit'), 'низкоприоритетные пробы пропущены');
    assert.equal(report.summary.status, 'unknown');
  } finally {
    await srv.close();
  }
});

test('X-Powered-By с несколькими значениями: берём минимальную версию', async () => {
  const srv = await startFixtureServer({
    root: {
      status: 200,
      headers: { Server: 'nginx', 'X-Powered-By': ['PHP/8.4.27', 'PHP/8.4.26'] },
      body: '<html><body>ok</body></html>',
    },
  });
  try {
    const report = await scan(srv.url, PRIVATE);
    assert.equal(report.php.version, '8.4.26');
    assert.equal(report.php.versionSource, 'header');
    for (const cve of report.cves) assert.equal(cve.status, 'vulnerable');
  } finally {
    await srv.close();
  }
});

test('X-PHP-Version и X-Backend-Server распознаются как источники версии', async () => {
  const srv = await startFixtureServer({
    root: {
      status: 200,
      headers: { Server: 'nginx', 'X-PHP-Version': '8.3.35' },
      body: '<html><body>ok</body></html>',
    },
  });
  try {
    const report = await scan(srv.url, PRIVATE);
    assert.equal(report.php.version, '8.3.35');
    assert.equal(report.php.versionSource, 'header');
    assert.equal(report.summary.status, 'vulnerable');
  } finally {
    await srv.close();
  }

  const backend = await startFixtureServer({
    root: {
      status: 200,
      headers: { Server: 'nginx', 'X-Backend-Server': 'php/7.4.33' },
      body: '<html><body>ok</body></html>',
    },
  });
  try {
    const report = await scan(backend.url, PRIVATE);
    assert.equal(report.php.version, '7.4.33');
    assert.equal(report.php.versionSource, 'header');
    assert.equal(report.summary.status, 'vulnerable');
  } finally {
    await backend.close();
  }
});

test('API: deep=true передаётся в scan, любое другое значение — false', async () => {
  const calls = [];
  const app = createApp({
    log: () => {},
    scanImpl: async (target, opts) => {
      calls.push({ target, opts });
      return { lang: opts.lang, target, php: {}, cves: [], summary: {} };
    },
  });
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  const { port } = app.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    const post = (body) =>
      fetch(`${base}/api/check`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

    await post({ url: 'example.com', deep: true });
    await post({ url: 'example.com', deep: 'yes' });
    await post({ url: 'example.com' });

    assert.equal(calls.length, 3);
    assert.equal(calls[0].opts.deep, true);
    assert.equal(calls[1].opts.deep, false);
    assert.equal(calls[2].opts.deep, false);
  } finally {
    await new Promise((resolve) => app.close(resolve));
  }
});

test('CLI: --deep разбирается и попадает в справку', () => {
  assert.equal(parseArgs(['example.com', '--deep']).deep, true);
  assert.equal(parseArgs(['example.com']).deep, false);
  assert.match(usage('ru'), /--deep/);
  assert.match(usage('en'), /--deep/);
});

test('UI: чекбокс deep, подсказка и отправка deep в API', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  const appSource = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');

  assert.match(html, /id="deep"/);
  assert.match(html, /data-i18n="ui\.form\.deep"/);
  assert.match(html, /data-i18n="ui\.form\.deepHint"/);
  assert.match(appSource, /deepInput/);
  assert.match(appSource, /deep: deepMode === true/);

  const I18N = require('../public/i18n.js');
  for (const lang of ['ru', 'en', 'fr']) {
    for (const key of ['ui.form.deep', 'ui.form.deepHint', 'ui.php.versionMin', 'ui.meta.deep']) {
      assert.ok(I18N.dict(lang)[key], `${lang}: нет ключа ${key}`);
    }
  }
});

test('CLI --deep end-to-end: phpinfo 8.4.26 → exit 1, source=phpinfo', async () => {
  const { spawn } = require('node:child_process');
  const srv = await startFixtureServer({
    root: fixtures['php-hidden-version'],
    'phpinfo.php': { status: 200, body: PHPINFO_826 },
  });
  try {
    const result = await new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        [path.join(__dirname, '..', 'cli.js'), srv.url, '--json', '--deep', '--lang=en'],
        { env: { ...process.env, ALLOW_PRIVATE_TARGETS: '1', NO_COLOR: '1' }, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      child.on('close', (code) => resolve({ code, stdout, stderr }));
    });

    assert.equal(result.code, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.deep, true);
    assert.equal(report.php.version, '8.4.26');
    assert.equal(report.php.versionSource, 'phpinfo');
    assert.equal(report.php.requests, 2);
  } finally {
    await srv.close();
  }
});

test('API deep end-to-end: POST /api/check с deep:true находит phpinfo', async () => {
  const srv = await startFixtureServer({
    root: fixtures['php-hidden-version'],
    'phpinfo.php': { status: 200, body: PHPINFO_826 },
  });
  const app = createApp({ log: () => {}, allowPrivateTargets: true });
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  const { port } = app.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: srv.url, lang: 'en', deep: true }),
    });
    assert.equal(response.status, 200);
    const report = await response.json();
    assert.equal(report.deep, true);
    assert.equal(report.php.version, '8.4.26');
    assert.equal(report.php.versionSource, 'phpinfo');
    assert.ok(report.php.requests <= 10);
  } finally {
    await new Promise((resolve) => app.close(resolve));
    await srv.close();
  }
});
