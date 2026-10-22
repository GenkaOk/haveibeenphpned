'use strict';

/**
 * Локализация API и CLI: язык из тела, Accept-Language, отсутствие
 * русских строк в en/fr-ответах, машинные коды не меняются.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');

const { createApp } = require('../src/server');
const { guardCheck } = require('../src/scan');
const { classifyAddress, validateTarget } = require('../src/safefetch');
const fixtures = require('./fixtures.json');
const { startFixtureServer } = require('./helpers/fixture-server');

const CLI = path.join(__dirname, '..', 'cli.js');
const CYRILLIC = /[\u0400-\u04FF]/;

/**
 * Все строковые значения отчёта, рекурсивно. Ключи не проверяются: машинные
 * коды (vulnerable, fetch_failed, ...) переводить нельзя.
 * @param {unknown} value
 * @param {string[]} [out]
 * @returns {string[]}
 */
function allStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) allStrings(item, out);
  else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) allStrings(item, out);
  }
  return out;
}

/**
 * @param {object} report
 * @param {'en'|'fr'} lang
 */
function assertReportWithoutCyrillic(report, lang) {
  for (const value of allStrings(report)) {
    assert.doesNotMatch(value, CYRILLIC, `русская строка в ${lang}-отчёте: ${value}`);
  }
}

/** Поля отчёта, которые видит человек (и рендерит страница). */
function visibleStrings(report) {
  const out = [];
  out.push(report.summary && report.summary.label);
  for (const cve of report.cves || []) {
    out.push(cve.title, cve.description, cve.reason, ...(cve.evidence || []));
  }
  if (report.php) {
    out.push(report.php.sapiNote, ...(report.php.evidence || []));
    if (report.php.distro) out.push(report.php.distro.name, report.php.distro.evidence);
  }
  out.push(...(report.recommendations || []));
  out.push(...(report.mitigations || []));
  out.push(report.disclaimer);
  return out.filter((item) => typeof item === 'string');
}

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

function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      env: { ...process.env, ALLOW_PRIVATE_TARGETS: '1', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
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
}

test('POST /api/check: lang=en отдаёт английские reason/recommendations', async () => {
  const fixture = await startFixtureServer({ root: fixtures['php-8-4-26'] });
  const app = await startApp();
  try {
    const response = await postCheck(app.url, { url: fixture.url, lang: 'en' });
    assert.equal(response.status, 200);
    const report = await response.json();

    // Машинные коды не переводятся.
    assert.equal(report.summary.status, 'vulnerable');
    assert.equal(report.lang, 'en');
    for (const cve of report.cves) {
      assert.equal(cve.status, 'vulnerable');
      assert.match(cve.reason, /8\.4\.27/);
    }
    assert.match(report.cves[0].reason, /older than the fixed/);
    assert.match(report.recommendations[0], /^Update PHP/);
    assert.match(report.summary.label, /affected/i);

    for (const value of visibleStrings(report)) {
      assert.doesNotMatch(value, CYRILLIC, `русская строка в en-ответе: ${value}`);
    }
  } finally {
    await app.close();
    await fixture.close();
  }
});

test('POST /api/check: lang=fr отдаёт французские строки и те же коды', async () => {
  const fixture = await startFixtureServer({ root: fixtures['php-8-4-26'] });
  const app = await startApp();
  try {
    const response = await postCheck(app.url, { url: fixture.url, lang: 'fr' });
    const report = await response.json();
    assert.equal(report.summary.status, 'vulnerable');
    assert.equal(report.lang, 'fr');
    assert.match(report.cves[0].reason, /antérieure à la version corrigée/);
    assert.match(report.recommendations[0], /^Mettez PHP à jour/);
    for (const value of visibleStrings(report)) {
      assert.doesNotMatch(value, CYRILLIC, `русская строка в fr-ответе: ${value}`);
    }
  } finally {
    await app.close();
    await fixture.close();
  }
});

test('POST /api/check: Accept-Language и фолбэк на en', async () => {
  const fixture = await startFixtureServer({ root: fixtures['php-8-4-27'] });
  const app = await startApp();
  try {
    let report = await (await postCheck(app.url, { url: fixture.url }, { 'accept-language': 'fr-CA,fr;q=0.9' })).json();
    assert.equal(report.lang, 'fr');
    assert.match(report.cves[0].reason, /n'est pas antérieure à la version corrigée/);

    report = await (await postCheck(app.url, { url: fixture.url }, { 'accept-language': 'de-DE,de;q=0.9' })).json();
    assert.equal(report.lang, 'en');
    assert.doesNotMatch(report.cves[0].reason, CYRILLIC);

    // Невалидный lang в теле не ломает запрос: берём Accept-Language.
    report = await (await postCheck(app.url, { url: fixture.url, lang: 'de' }, { 'accept-language': 'ru-RU' })).json();
    assert.equal(report.lang, 'ru');

    // Тело важнее заголовка.
    report = await (await postCheck(app.url, { url: fixture.url, lang: 'en' }, { 'accept-language': 'ru-RU' })).json();
    assert.equal(report.lang, 'en');
  } finally {
    await app.close();
    await fixture.close();
  }
});

test('недоступная цель: en-отчёт без кириллицы, код ошибки прежний', async () => {
  const app = await startApp({ allowPrivateTargets: true });
  try {
    const response = await postCheck(app.url, { url: 'http://127.0.0.1:1/', lang: 'en' });
    assert.equal(response.status, 200);
    const report = await response.json();
    assert.equal(report.summary.status, 'unknown');
    assert.equal(report.error.code, 'fetch_failed');
    assert.match(report.error.message, /did not respond/i);
    for (const value of visibleStrings(report)) {
      assert.doesNotMatch(value, CYRILLIC, `русская строка в en-ошибке: ${value}`);
    }
  } finally {
    await app.close();
  }
});

test('CLI --lang=en: английский человекочитаемый отчёт, коды прежние', async () => {
  const fixture = await startFixtureServer({ root: fixtures['php-8-4-26'] });
  try {
    const human = await runCli([fixture.url, '--lang=en']);
    assert.equal(human.code, 1, human.stderr);
    assert.match(human.stdout, /Result:/);
    assert.match(human.stdout, /What to do:/);
    assert.match(human.stdout, /AFFECTED/);
    assert.doesNotMatch(human.stdout, CYRILLIC, 'в en-выводе CLI не должно быть кириллицы');

    const json = await runCli([fixture.url, '--lang=en', '--json']);
    assert.equal(json.code, 1, json.stderr);
    const report = JSON.parse(json.stdout);
    assert.equal(report.summary.status, 'vulnerable');
    assert.equal(report.lang, 'en');
  } finally {
    await fixture.close();
  }
});

test('CLI --lang=fr и фолбэк по умолчанию на ru', async () => {
  const fixture = await startFixtureServer({ root: fixtures['php-8-4-27'] });
  try {
    const fr = await runCli([fixture.url, '--lang=fr']);
    assert.equal(fr.code, 0, fr.stderr);
    assert.match(fr.stdout, /Résultat/);
    assert.match(fr.stdout, /NON VULNÉRABLE/);
    assert.match(fr.stdout, /\(confiance : faible\)/);
    assert.doesNotMatch(fr.stdout, /confidence/);
    assert.doesNotMatch(fr.stdout, CYRILLIC);

    const ru = await runCli([fixture.url]);
    assert.equal(ru.code, 0, ru.stderr);
    assert.match(ru.stdout, /Итог:/);
    assert.match(ru.stdout, /НЕ ПОДВЕРЖЕН/);
    assert.match(ru.stdout, /уверенность: низкая/);
    assert.doesNotMatch(ru.stdout, /confidence/);
  } finally {
    await fixture.close();
  }
});

test('CLI --lang=de: exit 2 и понятная ошибка', async () => {
  const result = await runCli(['https://example.com', '--lang=de']);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /неподдерживаемый язык|unsupported language|langue non prise en charge/);
});

/* ------------------ Регрессия GHO-126: кириллица в EN/FR ------------------ */

test('полный отчёт en/fr: кириллицы нет ни в одном строковом поле', async () => {
  const fixture = await startFixtureServer({ root: fixtures['php-8-4-26'] });
  const app = await startApp();
  try {
    for (const lang of ['en', 'fr']) {
      const response = await postCheck(app.url, { url: fixture.url, lang });
      assert.equal(response.status, 200);
      const report = await response.json();

      // Поведение и машинные коды не меняются.
      assert.equal(report.lang, lang);
      assert.equal(report.summary.status, 'vulnerable');
      assert.equal(report.php.version, '8.4.26');
      for (const cve of report.cves) assert.equal(cve.status, 'vulnerable');

      // Именно эти поля раньше содержали русские строки.
      assert.ok(report.checks.some((check) => check.name === 'ssrf-guard' && check.evidence));
      assert.ok(report.php.evidence.length > 0);
      assert.ok(report.cves.every((cve) => typeof cve.reason === 'string' && cve.reason.length));

      assertReportWithoutCyrillic(report, lang);
    }
  } finally {
    await app.close();
    await fixture.close();
  }
});

test('отчёт о недоступной цели en/fr: message и detail без кириллицы', async () => {
  const app = await startApp({ allowPrivateTargets: true });
  try {
    for (const lang of ['en', 'fr']) {
      const response = await postCheck(app.url, { url: 'http://127.0.0.1:1/', lang });
      assert.equal(response.status, 200);
      const report = await response.json();
      assert.equal(report.summary.status, 'unknown');
      assert.equal(report.error.code, 'fetch_failed');
      assertReportWithoutCyrillic(report, lang);
    }
  } finally {
    await app.close();
  }
});

test('checks[].evidence: причина ssrf-guard локализована, публичный адрес без кириллицы', async () => {
  // Раньше здесь было «connection to 66.6.42.252 (публичный адрес)» при lang=en.
  const publicAddress = '66.6.42.252';

  const enTarget = await validateTarget(`http://${publicAddress}/`, { lang: 'en' });
  assert.equal(enTarget.guard.reasonCode, 'public');
  const en = guardCheck('en', enTarget.guard);
  assert.equal(en.name, 'ssrf-guard');
  assert.equal(en.evidence, `connection to ${publicAddress} (public address)`);
  assert.doesNotMatch(en.evidence, CYRILLIC);

  const frTarget = await validateTarget(`http://${publicAddress}/`, { lang: 'fr' });
  const fr = guardCheck('fr', frTarget.guard);
  assert.equal(fr.evidence, `connexion à ${publicAddress} (adresse publique)`);
  assert.doesNotMatch(fr.evidence, CYRILLIC);

  const ruTarget = await validateTarget(`http://${publicAddress}/`, { lang: 'ru' });
  assert.match(guardCheck('ru', ruTarget.guard).evidence, /публичный адрес/);
});

test('checks[].evidence: все классы адресов дают en/fr без кириллицы', () => {
  const addresses = [
    '66.6.42.252',
    '169.254.169.254',
    '100.100.100.200',
    '0.0.0.0',
    '224.0.0.1',
    '192.0.2.5',
    '127.0.0.1',
    '10.0.0.5',
    '172.16.5.4',
    '192.168.1.1',
    '100.64.0.1',
    '::1',
    'fe80::1',
    'ff02::1',
    '2001:db8::1',
    'fd00::1',
    '2a00:1450:4010:c05::64',
  ];
  for (const address of addresses) {
    for (const lang of ['en', 'fr']) {
      const verdict = classifyAddress(address, lang);
      const check = guardCheck(lang, { address, reasonCode: verdict.reasonCode });
      assert.doesNotMatch(check.evidence, CYRILLIC, `${lang}: ${check.evidence}`);
    }
  }
});

test('lang=ru: отчёт остаётся русским, коды статусов не переводятся', async () => {
  const fixture = await startFixtureServer({ root: fixtures['php-8-4-26'] });
  const app = await startApp();
  try {
    const report = await (await postCheck(app.url, { url: fixture.url, lang: 'ru' })).json();
    assert.equal(report.lang, 'ru');
    assert.equal(report.summary.status, 'vulnerable');
    assert.equal(report.cves[0].status, 'vulnerable');
    assert.match(report.cves[0].reason, /ниже исправленной/);
    assert.match(report.recommendations[0], /Обновите PHP/);
    assert.ok(allStrings(report).some((value) => CYRILLIC.test(value)));
  } finally {
    await app.close();
    await fixture.close();
  }
});

test('recommendations: Sury есть в ru/en/fr и всегда с оговоркой о стороннем репозитории', async () => {
  const fixture = await startFixtureServer({ root: fixtures['php-8-4-26'] });
  const app = await startApp();
  try {
    const expectations = {
      ru: /сторонний репозиторий/,
      en: /third-party repository/,
      fr: /dépôt tiers/,
    };
    for (const [lang, caution] of Object.entries(expectations)) {
      const report = await (await postCheck(app.url, { url: fixture.url, lang })).json();
      const sury = report.recommendations.filter((rec) => rec.includes('deb.sury.org'));
      assert.equal(sury.length, 2, `${lang}: ожидались рекомендация Sury и оговорка`);
      assert.match(sury[0], /USN-8948-1/, `${lang}: нет ссылки на дистрибутив`);
      assert.match(sury[1], caution, `${lang}: нет оговорки о стороннем репозитории`);
      assert.match(sury[1], /php-fpm|PHP-FPM/, `${lang}: нет требования перезапустить php-fpm`);
    }
  } finally {
    await app.close();
    await fixture.close();
  }
});

test('ошибки API en/fr без кириллицы, ru — с кириллицей', async () => {
  const blocked = await startApp({ allowPrivateTargets: false });
  try {
    // blocked_target: ошибка приходит из safefetch уже на языке запроса.
    for (const lang of ['en', 'fr']) {
      const response = await postCheck(blocked.url, { url: 'http://169.254.169.254/', lang });
      assert.equal(response.status, 403);
      const payload = await response.json();
      assert.equal(payload.error.code, 'blocked_target');
      assert.doesNotMatch(payload.error.message, CYRILLIC, `${lang}: ${payload.error.message}`);
    }
  } finally {
    await blocked.close();
  }

  const limited = await startApp({ allowPrivateTargets: false, rateLimit: { windowMs: 60_000, max: 1 } });
  try {
    // rate_limited: текст собирается в server.js из словаря.
    await postCheck(limited.url, { url: 'http://169.254.169.254/', lang: 'en' });

    const limitedEn = await (await postCheck(limited.url, { url: 'http://169.254.169.254/', lang: 'en' })).json();
    assert.equal(limitedEn.error.code, 'rate_limited');
    assert.doesNotMatch(limitedEn.error.message, CYRILLIC);

    // Тело ещё не прочитано (rate limit срабатывает раньше), поэтому язык
    // ответа 429 берётся из query/Accept-Language.
    const limitedFr = await (await fetch(`${limited.url}/api/check?lang=fr`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'http://169.254.169.254/' }),
    })).json();
    assert.equal(limitedFr.error.code, 'rate_limited');
    assert.doesNotMatch(limitedFr.error.message, CYRILLIC);
    assert.match(limitedFr.error.message, /trop de vérifications/);

    const limitedRu = await (await fetch(`${limited.url}/api/check?lang=ru`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'http://169.254.169.254/' }),
    })).json();
    assert.equal(limitedRu.error.code, 'rate_limited');
    assert.match(limitedRu.error.message, /слишком много проверок/);
  } finally {
    await limited.close();
  }
});
