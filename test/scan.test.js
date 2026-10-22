'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { scan } = require('../src/scan');
const { classifyAddress, validateTarget } = require('../src/safefetch');
const fixtures = require('./fixtures.json');
const { startFixtureServer, withFixture } = require('./helpers/fixture-server');

const PRIVATE = { allowPrivateTargets: true };

test('8.4.26 → vulnerable по обеим CVE', async () => {
  await withFixture(fixtures['php-8-4-26'], async (srv) => {
    const report = await scan(srv.url, PRIVATE);

    assert.equal(report.php.detected, true);
    assert.equal(report.php.version, '8.4.26');
    assert.equal(report.php.versionSource, 'header');
    assert.equal(report.php.sapi, 'php-fpm');
    assert.equal(report.php.sapiConfidence, 'low');
    assert.equal(report.cves.length, 2);

    for (const cve of report.cves) {
      assert.equal(cve.status, 'vulnerable');
      assert.equal(cve.confidence, 'high');
      assert.ok(cve.evidence.length > 0, 'evidence не должен быть пустым');
      assert.match(cve.reason, /8\.4\.27/);
    }

    assert.equal(report.summary.status, 'vulnerable');
    assert.equal(report.summary.counts.vulnerable, 2);
    assert.ok(report.http.elapsedMs < 15_000);
    assert.ok(report.http.requests <= 3);
    assert.ok(report.recommendations.some((rec) => rec.includes('8.4.27')));
    assert.ok(report.checks.some((check) => check.name === 'header:x-powered-by'));
    assert.equal(report.disclaimer.includes('только свои серверы'), true);
  });
});

test('8.4.27 → not_vulnerable', async () => {
  await withFixture(fixtures['php-8-4-27'], async (srv) => {
    const report = await scan(srv.url, PRIVATE);
    assert.equal(report.php.version, '8.4.27');
    for (const cve of report.cves) assert.equal(cve.status, 'not_vulnerable');
    assert.equal(report.summary.status, 'not_vulnerable');
  });
});

test('8.5.12 → not_vulnerable', async () => {
  await withFixture(fixtures['php-8-5-12'], async (srv) => {
    const report = await scan(srv.url, PRIVATE);
    assert.equal(report.summary.status, 'not_vulnerable');
  });
});

test('7.4.33 без признаков дистрибутива → vulnerable (EOL-ветка)', async () => {
  await withFixture(fixtures['php-7-4-33'], async (srv) => {
    const report = await scan(srv.url, PRIVATE);
    assert.equal(report.php.version, '7.4.33');
    assert.equal(report.php.distro, null);
    for (const cve of report.cves) assert.equal(cve.status, 'vulnerable');
  });
});

test('дистрибутивная сборка ниже фикса → unknown + команда проверки пакета', async () => {
  await withFixture(fixtures['php-ubuntu-backport'], async (srv) => {
    const report = await scan(srv.url, PRIVATE);
    assert.equal(report.php.distro.name, 'ubuntu');
    for (const cve of report.cves) {
      assert.equal(cve.status, 'unknown');
      assert.equal(cve.confidence, 'medium');
    }
    assert.equal(report.summary.status, 'unknown');
    assert.ok(report.recommendations.some((rec) => rec.includes('dpkg -l | grep php')));
  });
});

test('версия скрыта, но PHPSESSID есть → PHP обнаружен, вердикт unknown', async () => {
  await withFixture(fixtures['php-hidden-version'], async (srv) => {
    const report = await scan(srv.url, PRIVATE);
    assert.equal(report.php.detected, true);
    assert.equal(report.php.version, null);
    for (const cve of report.cves) assert.equal(cve.status, 'unknown');
    assert.equal(report.summary.status, 'unknown');
    assert.ok(report.recommendations.some((rec) => rec.includes('php -v')));
  });
});

test('маркеры PHP только в теле → detected low confidence, version unknown', async () => {
  await withFixture(fixtures['php-body-only'], async (srv) => {
    const report = await scan(srv.url, PRIVATE);
    assert.equal(report.php.detected, true);
    assert.equal(report.php.confidence, 'low');
    assert.equal(report.php.version, null);
    assert.equal(report.summary.status, 'unknown');
  });
});

test('сайт без PHP → not_applicable с объяснением', async () => {
  await withFixture(fixtures['no-php'], async (srv) => {
    const report = await scan(srv.url, PRIVATE);
    assert.equal(report.php.detected, false);
    for (const cve of report.cves) {
      assert.equal(cve.status, 'not_applicable');
      assert.match(cve.reason, /Признаков PHP/);
      assert.ok(cve.evidence.length > 0);
    }
    assert.equal(report.summary.status, 'not_applicable');
  });
});

test('SAPI FPM распознаётся по явному признаку', async () => {
  await withFixture(fixtures['php-fpm-explicit'], async (srv) => {
    const report = await scan(srv.url, PRIVATE);
    assert.equal(report.php.sapi, 'php-fpm');
    assert.equal(report.php.sapiConfidence, 'high');
  });
});

test('403 без версии → второй запрос HEAD, отчёт не падает', async () => {
  await withFixture(fixtures.forbidden, async (srv) => {
    const report = await scan(srv.url, PRIVATE);
    assert.equal(report.http.requests, 2);
    assert.equal(report.summary.status, 'not_applicable');
    assert.ok(report.checks.some((check) => check.name === 'request:HEAD'));
  });
});

test('тело больше 1 МБ обрезается', async () => {
  const big = {
    status: 200,
    headers: { Server: 'nginx/1.24.0', 'X-Powered-By': 'PHP/8.4.27' },
    body: 'a'.repeat(2 * 1024 * 1024),
  };
  await withFixture(big, async (srv) => {
    const report = await scan(srv.url, PRIVATE);
    assert.equal(report.http.bodyTruncated, true);
    assert.equal(report.php.version, '8.4.27');
  });
});

test('недоступная цель → отчёт unknown, без исключения', async () => {
  const srv = await startFixtureServer();
  const deadUrl = srv.url;
  await srv.close();

  const report = await scan(deadUrl, PRIVATE);
  assert.equal(report.summary.status, 'unknown');
  assert.ok(report.error);
  for (const cve of report.cves) assert.equal(cve.status, 'unknown');
});

test('медленное тело не держит проверку дольше таймаута', async () => {
  const http = require('node:http');
  const slow = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'x-powered-by': 'PHP/8.4.26' });
    res.write('<html>');
    const timer = setInterval(() => res.write('.'), 200);
    res.on('close', () => clearInterval(timer));
  });
  await new Promise((resolve) => slow.listen(0, '127.0.0.1', resolve));
  const { port } = slow.address();

  try {
    const startedAt = Date.now();
    const report = await scan(`http://127.0.0.1:${port}/`, {
      allowPrivateTargets: true,
      timeoutMs: 1500,
    });
    const elapsed = Date.now() - startedAt;
    assert.ok(elapsed < 4000, `проверка заняла ${elapsed} мс`);
    assert.ok(report.summary.status === 'unknown');
    assert.ok(report.error);
    assert.match(report.error.message, /таймаут/);
  } finally {
    await new Promise((resolve) => slow.close(resolve));
  }
});

test('SSRF: metadata-адрес блокируется всегда', async () => {
  await assert.rejects(scan('http://169.254.169.254/latest/meta-data/', PRIVATE), (error) => {
    assert.equal(error.code, 'blocked_target');
    assert.match(error.message, /заблокирован/);
    return true;
  });
  await assert.rejects(scan('http://100.100.100.200/'), /заблокирован/);
  await assert.rejects(scan('http://[::1]/'), /заблокирован/);
});

test('SSRF: приватный адрес только с allowPrivateTargets', async () => {
  const srv = await startFixtureServer({ root: fixtures['php-8-4-27'] });
  try {
    await assert.rejects(scan(srv.url, { allowPrivateTargets: false }), (error) => {
      assert.equal(error.code, 'blocked_target');
      assert.match(error.message, /ALLOW_PRIVATE_TARGETS=1/);
      return true;
    });

    const report = await scan(srv.url, { allowPrivateTargets: true });
    assert.equal(report.php.detected, true);
  } finally {
    await srv.close();
  }
});

test('валидация URL: протокол, креденшелы, порт', async () => {
  await assert.rejects(scan('ftp://example.com/'), /только http/);
  await assert.rejects(scan('http://user:pass@example.com/'), (error) => {
    assert.match(error.message, /логином\/паролем/);
    return true;
  });
  await assert.rejects(validateTarget('http://1.1.1.1:8080/'), /порты 80 и 443/);
  const ok = await validateTarget('http://1.1.1.1/');
  assert.equal(ok.port, 80);
});

test('классификация адресов', () => {
  const cases = [
    ['169.254.169.254', 'blocked'],
    ['100.100.100.200', 'blocked'],
    ['0.0.0.0', 'blocked'],
    ['224.0.0.1', 'blocked'],
    ['::1', 'blocked'],
    ['fe80::1', 'blocked'],
    ['ff02::1', 'blocked'],
    ['10.0.0.5', 'private'],
    ['172.16.5.4', 'private'],
    ['192.168.1.1', 'private'],
    ['127.0.0.1', 'private'],
    ['100.64.0.1', 'private'],
    ['::ffff:127.0.0.1', 'private'],
    ['fd00::1', 'private'],
    ['8.8.8.8', 'public'],
    ['2a00:1450:4010:c05::64', 'public'],
  ];
  for (const [address, expected] of cases) {
    assert.equal(classifyAddress(address).kind, expected, `${address} должен быть ${expected}`);
  }
});
