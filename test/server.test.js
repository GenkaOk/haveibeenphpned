'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createApp } = require('../src/server');
const fixtures = require('./fixtures.json');
const { startFixtureServer } = require('./helpers/fixture-server');

/**
 * @param {object} [options]
 */
async function startApp(options = {}) {
  const server = createApp({ log: () => {}, allowPrivateTargets: true, ...options });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function postCheck(baseUrl, body, headers = {}) {
  return fetch(`${baseUrl}/api/check`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('GET /api/health → {"ok":true}', async () => {
  const app = await startApp();
  try {
    const response = await fetch(`${app.url}/api/health`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await response.json(), { ok: true });
  } finally {
    await app.close();
  }
});

test('POST /api/check возвращает отчёт', async () => {
  const fixture = await startFixtureServer({ root: fixtures['php-8-4-26'] });
  const app = await startApp();
  try {
    const response = await postCheck(app.url, { url: fixture.url });
    assert.equal(response.status, 200);

    const report = await response.json();
    assert.equal(report.target, fixture.url + '/');
    assert.equal(report.php.version, '8.4.26');
    assert.equal(report.summary.status, 'vulnerable');
    for (const cve of report.cves) {
      assert.ok(['CVE-2026-109618', 'CVE-2026-109619'].includes(cve.id));
      assert.ok(cve.reason && cve.evidence.length > 0);
    }
    assert.ok(Array.isArray(report.mitigations));
    assert.ok(Array.isArray(report.recommendations));
    assert.ok(Array.isArray(report.checks));
  } finally {
    await app.close();
    await fixture.close();
  }
});

test('POST /api/check: metadata-адрес → 403 blocked_target', async () => {
  const app = await startApp({ allowPrivateTargets: false });
  try {
    const response = await postCheck(app.url, { url: 'http://169.254.169.254/' });
    assert.equal(response.status, 403);
    const payload = await response.json();
    assert.equal(payload.error.code, 'blocked_target');
  } finally {
    await app.close();
  }
});

test('POST /api/check: приватный адрес без флага → 403', async () => {
  const app = await startApp({ allowPrivateTargets: false });
  try {
    const response = await postCheck(app.url, { url: 'http://127.0.0.1:1/' });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, 'blocked_target');
  } finally {
    await app.close();
  }
});

test('POST /api/check: невалидное тело и content-type', async () => {
  const app = await startApp();
  try {
    let response = await postCheck(app.url, { url: '' });
    assert.equal(response.status, 400);

    response = await postCheck(app.url, '{не json');
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'invalid_json');

    response = await fetch(`${app.url}/api/check`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'http://example.com',
    });
    assert.equal(response.status, 415);

    response = await fetch(`${app.url}/api/check`);
    assert.equal(response.status, 405);
  } finally {
    await app.close();
  }
});

test('rate limit: 2 запроса в окне, третий → 429 с Retry-After', async () => {
  const fixture = await startFixtureServer({ root: fixtures['php-8-4-27'] });
  const app = await startApp({ rateLimit: { windowMs: 60_000, max: 2 } });
  try {
    const first = await postCheck(app.url, { url: fixture.url });
    assert.equal(first.status, 200);

    const second = await postCheck(app.url, { url: fixture.url });
    assert.equal(second.status, 200);

    const third = await postCheck(app.url, { url: fixture.url });
    assert.equal(third.status, 429);
    assert.ok(Number(third.headers.get('retry-after')) > 0);
    assert.equal((await third.json()).error.code, 'rate_limited');
  } finally {
    await app.close();
    await fixture.close();
  }
});

test('неизвестный маршрут → 404 JSON', async () => {
  const app = await startApp();
  try {
    const response = await fetch(`${app.url}/api/nope`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'not_found');
  } finally {
    await app.close();
  }
});

test('статика: index.html отдаётся с /', async () => {
  const fs = require('node:fs');
  const path = require('node:path');

  const dir = fs.mkdtempSync(path.join(__dirname, '.tmp-static-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>ui</title>');

  const app = await startApp({ staticDir: dir });
  try {
    const response = await fetch(`${app.url}/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<title>ui<\/title>/);

    const traversal = await fetch(`${app.url}/..%2f..%2fpackage.json`);
    assert.equal(traversal.status, 404);
  } finally {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ---------- CORS ---------- */

const SITE_ORIGIN = 'https://genkaok.github.io';

test('CORS preflight: OPTIONS /api/check с разрешённым origin → 204', async () => {
  const app = await startApp({ allowedOrigins: [SITE_ORIGIN] });
  try {
    const response = await fetch(`${app.url}/api/check`, {
      method: 'OPTIONS',
      headers: {
        origin: SITE_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), SITE_ORIGIN);
    const methods = response.headers.get('access-control-allow-methods') || '';
    assert.match(methods, /POST/);
    assert.match(methods, /OPTIONS/);
    assert.match(response.headers.get('access-control-allow-headers') || '', /Content-Type/i);
    assert.match(response.headers.get('vary') || '', /Origin/i);
    assert.equal(await response.text(), '');
  } finally {
    await app.close();
  }
});

test('CORS preflight: чужой origin → 204 без Access-Control-Allow-Origin', async () => {
  const app = await startApp({ allowedOrigins: [SITE_ORIGIN] });
  try {
    const response = await fetch(`${app.url}/api/check`, {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  } finally {
    await app.close();
  }
});

test('CORS: POST /api/check с разрешённым origin отдаёт allow-origin', async () => {
  const fixture = await startFixtureServer({ root: fixtures['php-8-4-27'] });
  const app = await startApp({ allowedOrigins: [SITE_ORIGIN] });
  try {
    const response = await postCheck(app.url, { url: fixture.url }, { origin: SITE_ORIGIN });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), SITE_ORIGIN);
    assert.match(response.headers.get('vary') || '', /Origin/i);
  } finally {
    await app.close();
    await fixture.close();
  }
});

test('CORS: чужой origin не получает allow-origin', async () => {
  const fixture = await startFixtureServer({ root: fixtures['php-8-4-27'] });
  const app = await startApp({ allowedOrigins: [SITE_ORIGIN] });
  try {
    const response = await postCheck(app.url, { url: fixture.url }, { origin: 'https://evil.example' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  } finally {
    await app.close();
    await fixture.close();
  }
});

test('CORS: GET /api/health и ответы с ошибкой тоже содержат allow-origin', async () => {
  const app = await startApp({ allowedOrigins: [SITE_ORIGIN] });
  try {
    const health = await fetch(`${app.url}/api/health`, { headers: { origin: SITE_ORIGIN } });
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('access-control-allow-origin'), SITE_ORIGIN);

    const invalid = await postCheck(app.url, '{не json', { origin: SITE_ORIGIN });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.headers.get('access-control-allow-origin'), SITE_ORIGIN);
  } finally {
    await app.close();
  }
});

test('CORS: опция allowedOrigins важнее env, по умолчанию разрешён genkaok.github.io', async () => {
  const previous = process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS = 'https://env.example';
  try {
    // Опция переопределяет env.
    const fromOption = await startApp({ allowedOrigins: ['https://option.example'] });
    try {
      const allowed = await fetch(`${fromOption.url}/api/health`, {
        headers: { origin: 'https://option.example' },
      });
      assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://option.example');

      const fromEnv = await fetch(`${fromOption.url}/api/health`, {
        headers: { origin: 'https://env.example' },
      });
      assert.equal(fromEnv.headers.get('access-control-allow-origin'), null);
    } finally {
      await fromOption.close();
    }

    // Без опции список берётся из env.
    const fromEnvOnly = await startApp();
    try {
      const allowed = await fetch(`${fromEnvOnly.url}/api/health`, {
        headers: { origin: 'https://env.example' },
      });
      assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://env.example');
    } finally {
      await fromEnvOnly.close();
    }

    // Без env действует значение по умолчанию.
    delete process.env.ALLOWED_ORIGINS;
    const byDefault = await startApp();
    try {
      const allowed = await fetch(`${byDefault.url}/api/health`, {
        headers: { origin: SITE_ORIGIN },
      });
      assert.equal(allowed.headers.get('access-control-allow-origin'), SITE_ORIGIN);

      const foreign = await fetch(`${byDefault.url}/api/health`, {
        headers: { origin: 'https://evil.example' },
      });
      assert.equal(foreign.headers.get('access-control-allow-origin'), null);
    } finally {
      await byDefault.close();
    }
  } finally {
    if (previous === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = previous;
  }
});
