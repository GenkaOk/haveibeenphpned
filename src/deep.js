'use strict';

/**
 * Разрешённые пути глубокой проверки (deep scan).
 *
 * Deep scan — это явно включаемый режим. Он делает не больше
 * MAX_DEEP_REQUESTS запросов всего (включая корневой GET), последовательно,
 * только по перечисленным ниже путям. Никакой эксплуатации, только GET.
 *
 * Пасхалки PHP работают только при expose_php=On и только на PHP ≤ 5.4:
 * в PHP 5.5 их удалили. Поэтому успешный ответ пасхалки доказывает legacy
 * PHP 5.x, но не даёт точной версии.
 */

const { headerValue } = require('./headers');
const { compareVersions, parseVersion } = require('./version');

// Жёсткий предел deep scan: все запросы, включая корневой GET.
const MAX_DEEP_REQUESTS = 10;
const DEEP_BODY_BYTES = 512 * 1024;

/**
 * Три GUID из постановки задачи (удалены в PHP 5.5.0). По исследованию:
 * F34 — PHP Logo Easter Egg, F35 — Zend Engine logo, F36 — PHP logo.
 * Все три отдают картинку; настоящая credits-страница имеет GUID
 * PHPB8B5F2A0-…, но точную версию по пасхалке мы всё равно не выводим.
 */
const EASTER_EGGS = Object.freeze([
  { id: 'easter-egg-php-easter', query: '?=PHPE9568F34-D428-11d2-A769-00AA001ACF42' },
  { id: 'easter-egg-zend-logo', query: '?=PHPE9568F35-D428-11d2-A769-00AA001ACF42' },
  { id: 'easter-egg-php-logo', query: '?=PHPE9568F36-D428-11d2-A769-00AA001ACF42' },
]);

/** Публичные диагностические страницы, которые иногда раскрывают версию. */
const PHPINFO_PATHS = Object.freeze([
  '/phpinfo.php',
  '/info.php',
  '/test.php',
  '/php.php',
  '/?phpinfo=1',
]);

/** FPM status/ping: подтверждают SAPI, но не версию PHP. */
const FPM_PATHS = Object.freeze([
  { id: 'fpm-status', path: '/status?full' },
  { id: 'fpm-ping', path: '/ping' },
]);

/**
 * Allowlist deep scan: 5 phpinfo + 3 пасхалки + 2 FPM = 10 кандидатов.
 * Общий бюджет scan в deep-режиме — 10 запросов включая корневой GET,
 * поэтому один низкоприоритетный кандидат может быть пропущен
 * (в отчёте это check `deep:limit`).
 * @returns {Array<{id: string, kind: 'phpinfo'|'easter-egg'|'fpm-status'|'fpm-ping', path: string}>}
 */
const DEEP_PROBES = Object.freeze([
  ...PHPINFO_PATHS.map((path) => ({ id: `phpinfo:${path}`, kind: 'phpinfo', path })),
  ...EASTER_EGGS.map((egg) => ({ id: egg.id, kind: 'easter-egg', path: `/${egg.query}` })),
  ...FPM_PATHS.map((item) => ({
    id: item.id,
    kind: item.path === '/ping' ? 'fpm-ping' : 'fpm-status',
    path: item.path,
  })),
]);

/**
 * URL запроса от корня проверенного сайта.
 * @param {string} baseUrl
 * @param {string} path
 * @returns {string}
 */
function probeUrl(baseUrl, path) {
  return new URL(path, baseUrl).href;
}

/**
 * Несколько значений PHP-версии в строке заголовка.
 * @param {string} text
 * @returns {string[]}
 */
function versionsInText(text) {
  if (!text) return [];
  const out = [];
  const re = /PHP\s*\/\s*(\d+(?:\.\d+){0,2}[^\s,;()]*)/gi;
  let match;
  while ((match = re.exec(String(text))) !== null) {
    out.push(match[1].replace(/[.,;:]+$/, ''));
  }
  return out;
}

/**
 * Собирает версии PHP из всех релевантных заголовков.
 * Несколько значений (в том числе массив X-Powered-By) поддерживаются.
 *
 * @param {Record<string, string|string[]>} headers
 * @returns {{version: string|null, sources: Array<{header: string, value: string, versions: string[]}>}}
 */
function collectHeaderVersions(headers = {}) {
  const sources = [];
  const names = ['x-powered-by', 'x-php-version', 'server', 'x-backend-server', 'via'];
  const keys = Object.keys(headers).filter((key) => key.startsWith('x-fpm-'));
  for (const key of [...names, ...keys]) {
    const raw = headers[key];
    if (raw === undefined || raw === null) continue;
    const values = Array.isArray(raw) ? raw.map(String) : [String(raw)];
    for (const value of values) {
      let versions = versionsInText(value);
      if (!versions.length && key === 'x-php-version') {
        const parsed = parseVersion(value.trim());
        if (parsed && parsed.precision >= 2) versions = [value.trim()];
      }
      if (versions.length) sources.push({ header: key, value, versions });
    }
  }

  let version = null;
  for (const source of sources) {
    for (const candidate of source.versions) {
      const parsed = parseVersion(candidate);
      if (!parsed) continue;
      const current = version ? parseVersion(version) : null;
      // Несколько значений: берём минимальную версию, чтобы не стать
      // оптимистичнее при прокси/нескольких бэкендах.
      if (!current || compareVersions(parsed, current) < 0) version = candidate;
    }
  }
  return { version, sources };
}

/**
 * Признаки успешной пасхалки. Точную версию по картинке не выводим.
 * @param {{status: number, headers: Record<string, string|string[]>, body: string}} response
 * @returns {{kind: 'credits'|'logo'}|null}
 */
function detectEasterEgg(response = {}) {
  const status = Number(response.status) || 0;
  if (status !== 200) return null;
  const body = response.body || '';
  const contentType = headerValue(response.headers || {}, 'content-type').toLowerCase();

  const isImage =
    /^image\/(?:gif|png|jpeg)/.test(contentType) || body.startsWith('GIF87a') || body.startsWith('GIF89a');
  if (isImage && body.length <= 64 * 1024) return { kind: 'logo' };

  const looksLikeCredits =
    /PHP\s+Credits/i.test(body) ||
    (/PHP\s+Version/i.test(body) && /credits?/i.test(body) && body.length <= 256 * 1024);
  if (looksLikeCredits) return { kind: 'credits' };

  return null;
}

/**
 * Извлекает версию и SAPI из HTML phpinfo(). Ничего больше не сохраняем:
 * пути, переменные окружения и $_SERVER в отчёт не попадают.
 *
 * @param {string} body
 * @returns {{version: string|null, sapi: string|null}|null}
 */
function extractPhpinfo(body) {
  if (!body || typeof body !== 'string') return null;
  const isPhpinfo =
    /<title[^>]*>\s*phpinfo\s*\(\s*\)/i.test(body) ||
    (/PHP\s+Version/i.test(body) && /Server\s+API/i.test(body));
  if (!isPhpinfo) return null;

  let version = null;
  const patterns = [
    /PHP\s+Version\s*(?:<\/t[dh]>\s*<td[^>]*>|=>|:)\s*(?:<[^>]*>\s*)*((?:\d+\.){1,3}\d+[^\s<]*)/i,
    /PHP\s+Version\s+((?:\d+\.){1,3}\d+)/i,
    /PHP\s*\/\s*((?:\d+\.){1,3}\d+)/i,
  ];
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) {
      version = match[1].replace(/[.,;:]+$/, '');
      break;
    }
  }

  const sapiMatch = body.match(
    /Server\s+API\s*(?:<\/t[dh]>\s*<td[^>]*>|=>|:)\s*(?:<[^>]*>\s*)*([^<\n]+)/i,
  );
  const sapi = sapiMatch ? sapiMatch[1].replace(/\s+/g, ' ').trim().slice(0, 80) : null;

  return { version, sapi };
}

/**
 * FPM status или ping.
 * @param {string} kind
 * @param {{status: number, body: string}} response
 * @returns {boolean}
 */
function detectFpm(kind, response = {}) {
  if (Number(response.status) !== 200) return false;
  const body = response.body || '';
  if (kind === 'fpm-ping') return /^\s*pong\s*$/i.test(body);
  if (kind === 'fpm-status') {
    return /pool:\s*\S+/i.test(body) && /(process manager|pm\.max_children|accepted conn)/i.test(body);
  }
  return false;
}

module.exports = {
  MAX_DEEP_REQUESTS,
  DEEP_BODY_BYTES,
  EASTER_EGGS,
  PHPINFO_PATHS,
  FPM_PATHS,
  DEEP_PROBES,
  probeUrl,
  versionsInText,
  collectHeaderVersions,
  detectEasterEgg,
  extractPhpinfo,
  detectFpm,
};
