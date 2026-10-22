'use strict';

/**
 * Движок пассивной проверки: подвержен ли сервер CVE-2026-109618 / CVE-2026-109619.
 *
 * Ничего не эксплуатирует: делает 1–2 обычных GET/HEAD-запроса на корень сайта,
 * читает только заголовки и (частично) тело, затем сравнивает раскрытую версию PHP
 * с исправленными версиями.
 */

const {
  safeFetch,
  normalizeUrl,
  InvalidTargetError,
  BlockedTargetError,
} = require('./safefetch');
const { headerValue, headerList, shortValue } = require('./headers');
const { parseVersion, matchDistro } = require('./version');
const { detectApp } = require('./fingerprint');
const {
  MAX_DEEP_REQUESTS,
  DEEP_BODY_BYTES,
  DEEP_PROBES,
  probeUrl,
  collectHeaderVersions,
  detectEasterEgg,
  extractPhpinfo,
  detectFpm,
} = require('./deep');
const {
  CVE_LIST,
  FIXED_BY_BRANCH,
  NEWEST_FIXED_VERSION,
  PACKAGE_MANAGER,
  statusLabel,
  evaluateCve,
} = require('./cve');
const { t, normalizeLang, errorText } = require('./i18n');

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_REQUESTS = 3;
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 5;

/** Русский дисклеймер — обратная совместимость; в отчёт идёт локализованный. */
const DISCLAIMER = t('ru', 'server.disclaimer');

/**
 * @param {'ru'|'en'|'fr'} lang
 * @returns {string[]}
 */
function mitigationsFor(lang) {
  return [1, 2, 3, 4].map((index) => t(lang, `server.mitigation.${index}`));
}

/** Русские митигации — обратная совместимость. */
const MITIGATIONS = Object.freeze(mitigationsFor('ru'));

/**
 * Запись checks[] для SSRF-guard: адрес и локализованная причина.
 * Причина приходит из safefetch машинным кодом (reasonCode), поэтому
 * в en/fr-отчёте не остаётся русских строк.
 * @param {'ru'|'en'|'fr'} lang
 * @param {{address: string, reasonCode?: string, reason?: string}} guard
 */
function guardCheck(lang, guard) {
  const reasonCode = guard && guard.reasonCode ? guard.reasonCode : 'unknown';
  return {
    name: 'ssrf-guard',
    result: 'allowed',
    evidence: t(lang, 'server.checks.guardAllowed', {
      address: guard.address,
      reason: t(lang, `server.guard.${reasonCode}`),
    }),
  };
}

const PHP_VERSION_RE = /PHP\s*\/?\s*(\d+(?:\.\d+){0,2}(?:[^\s,;()]+)?)/i;
const PHP_VERSION_IN_TEXT_RE = /PHP\/(\d+\.\d+(?:\.\d+)?)/i;

/**
 * @param {string} text
 * @returns {string|null}
 */
function extractPhpVersion(text) {
  if (!text) return null;
  const m = String(text).match(PHP_VERSION_RE);
  if (!m) return null;
  return m[1].replace(/[.,;:]+$/, '');
}

/**
 * @param {string} body
 * @param {'ru'|'en'|'fr'} [lang]
 * @returns {Array<{strength: 'strong'|'medium', label: string}>}
 */
function bodySignals(body, lang = 'ru') {
  const out = [];
  if (!body) return out;
  if (/PHP (?:Warning|Notice|Fatal error|Parse error|Deprecated)\s*:/i.test(body)) {
    out.push({ strength: 'strong', label: t(lang, 'server.evidence.bodyPhpError') });
  }
  if (/PHPSESSID=/.test(body)) out.push({ strength: 'medium', label: t(lang, 'server.evidence.bodySession') });
  if (/(?:href|src|action)=["'][^"']*\.php(?:[?"']|$)/i.test(body)) {
    out.push({ strength: 'medium', label: t(lang, 'server.evidence.bodyPhpLinks') });
  }
  if (/<meta[^>]+name=["']generator["'][^>]+content=["'][^"']*WordPress/i.test(body)) {
    out.push({ strength: 'medium', label: t(lang, 'server.evidence.bodyWordpress') });
  }
  return out;
}

/**
 * @param {string} server
 * @param {string} poweredBy
 * @param {boolean} phpDetected
 * @param {'ru'|'en'|'fr'} [lang]
 */
function detectSapi(server, poweredBy, phpDetected, lang = 'ru', extra = '') {
  if (!phpDetected) {
    return { sapi: 'unknown', confidence: 'none', note: t(lang, 'server.sapi.notDetected') };
  }
  const hay = `${server} ${poweredBy} ${extra}`;
  if (/php-?fpm|fastcgi|\bx-fpm-/i.test(hay)) {
    return {
      sapi: 'php-fpm',
      confidence: 'high',
      note: t(lang, 'server.sapi.fpm'),
    };
  }
  if (/apache/i.test(server)) {
    return {
      sapi: 'mod_php',
      confidence: 'low',
      note: t(lang, 'server.sapi.apache'),
    };
  }
  if (/nginx/i.test(server)) {
    return {
      sapi: 'php-fpm',
      confidence: 'low',
      note: t(lang, 'server.sapi.nginx'),
    };
  }
  return { sapi: 'unknown', confidence: 'none', note: t(lang, 'server.sapi.unknownNote') };
}

/**
 * @param {{headers: Record<string, string|string[]>, body: string}} response
 * @param {'ru'|'en'|'fr'} [lang]
 */
function detectPhp(response, lang = 'ru') {
  const headers = response.headers || {};
  const body = response.body || '';

  const poweredBy = headerValue(headers, 'x-powered-by');
  const server = headerValue(headers, 'server');
  const xPhpVersion = headerValue(headers, 'x-php-version');
  const backend = headerValue(headers, 'x-backend-server');
  const via = headerValue(headers, 'via');
  const varnish = headerValue(headers, 'x-varnish');
  const xFpmHeaders = Object.keys(headers).filter((key) => key.startsWith('x-fpm-'));
  const setCookies = headerList(headers, 'set-cookie');

  const evidence = [];
  const strong = [];
  const medium = [];
  let headerEvidence = false;

  if (poweredBy) {
    if (/php/i.test(poweredBy)) {
      strong.push(t(lang, 'server.evidence.poweredByPhp'));
      evidence.push(`X-Powered-By: ${shortValue(poweredBy)}`);
      headerEvidence = true;
    } else {
      evidence.push(t(lang, 'server.evidence.poweredByOther', { value: shortValue(poweredBy) }));
    }
  }

  if (server) {
    evidence.push(t(lang, 'server.evidence.serverHeader', { value: shortValue(server) }));
    if (PHP_VERSION_RE.test(server) || /(^|[\s/])php([\s/]|$)/i.test(server)) {
      strong.push(t(lang, 'server.evidence.serverPhp'));
      headerEvidence = true;
    }
  }

  // Дополнительные заголовки: иногда версию или SAPI раскрывает прокси/бэкенд.
  for (const [name, value] of [
    ['x-php-version', xPhpVersion],
    ['x-backend-server', backend],
    ['via', via],
    ['x-varnish', varnish],
  ]) {
    if (!value) continue;
    evidence.push(t(lang, 'server.evidence.headerSignal', { name, value: shortValue(value) }));
    if (/php/i.test(value) || PHP_VERSION_RE.test(value)) {
      strong.push(t(lang, 'server.evidence.headerPhp', { name }));
      headerEvidence = true;
    }
  }
  if (xPhpVersion && !/php/i.test(xPhpVersion)) {
    strong.push(t(lang, 'server.evidence.headerPhp', { name: 'x-php-version' }));
    headerEvidence = true;
  }
  for (const key of xFpmHeaders) {
    const value = headerValue(headers, key);
    if (!value) continue;
    evidence.push(t(lang, 'server.evidence.headerSignal', { name: key, value: shortValue(value) }));
    strong.push(t(lang, 'server.evidence.headerPhp', { name: key }));
    headerEvidence = true;
  }

  for (const cookie of setCookies) {
    if (/(?:^|;\s*)PHPSESSID=/i.test(cookie)) {
      strong.push(t(lang, 'server.evidence.cookieShort'));
      evidence.push(t(lang, 'server.evidence.cookiePhp'));
      break;
    }
  }

  for (const signal of bodySignals(body, lang)) {
    if (signal.strength === 'strong') strong.push(signal.label);
    else medium.push(signal.label);
    evidence.push(signal.label);
  }

  const detected = strong.length > 0 || medium.length > 0;
  let confidence = 'none';
  if (detected) confidence = headerEvidence ? 'high' : 'low';

  // Версия: сначала заголовки (сильный источник), потом тело (слабый).
  // Несколько значений в заголовках поддерживаются; при расхождении берём
  // минимальную версию, чтобы отчёт не стал оптимистичнее реальности.
  let version = null;
  let versionSource = null;
  const fromHeaders = collectHeaderVersions(headers);
  if (fromHeaders.version) {
    version = fromHeaders.version;
    versionSource = 'header';
    const headerNames = [...new Set(fromHeaders.sources.map((item) => item.header))].join(', ');
    evidence.push(t(lang, 'server.evidence.headerVersion', { header: headerNames, version }));
    const allVersions = [...new Set(fromHeaders.sources.flatMap((item) => item.versions))];
    if (allVersions.length > 1) {
      evidence.push(
        t(lang, 'server.evidence.multipleHeaderVersions', { versions: allVersions.join(', ') }),
      );
    }
  } else {
    const fromBody = body.match(PHP_VERSION_IN_TEXT_RE);
    if (fromBody) {
      version = fromBody[1];
      versionSource = 'body';
      evidence.push(t(lang, 'server.evidence.versionInBody', { version }));
    }
  }

  // Дистрибутив: суффикс версии или заголовок Server.
  let distro = null;
  const distroCandidates = [];
  const parsed = version ? parseVersion(version) : null;
  if (parsed && parsed.suffix) distroCandidates.push(parsed.suffix);
  if (server) distroCandidates.push(server);
  for (const candidate of distroCandidates) {
    const name = matchDistro(candidate);
    if (name) {
      distro = {
        name,
        evidence: t(lang, 'server.evidence.distroSign', { value: shortValue(candidate, 120) }),
      };
      evidence.push(distro.evidence);
      break;
    }
  }

  const sapi = detectSapi(
    server,
    poweredBy,
    detected,
    lang,
    `${xPhpVersion} ${backend} ${via} ${xFpmHeaders.map((key) => `${key} ${headerValue(headers, key)}`).join(' ')}`,
  );

  if (!detected) {
    evidence.push(t(lang, 'server.evidence.noPhpSigns'));
  }
  if (detected && version) evidence.push(t(lang, 'server.evidence.versionDisclosed', { version }));
  if (detected && !version) evidence.push(t(lang, 'server.evidence.versionHidden'));

  return {
    detected,
    confidence,
    version,
    versionSource,
    precision: parsed ? parsed.precision : 0,
    distro,
    sapi: sapi.sapi,
    sapiConfidence: sapi.confidence,
    sapiNote: sapi.note,
    evidence: [...new Set(evidence)],
  };
}

/**
 * Объединяет заголовки корневого ответа и deep-проб. Значения одного и того же
 * заголовка сохраняются массивом: X-Powered-By может прийти из нескольких мест.
 * @param {Record<string, string|string[]>} base
 * @param {Record<string, string|string[]>} extra
 * @returns {Record<string, string|string[]>}
 */
function mergeHeaders(base, extra) {
  const out = { ...(base || {}) };
  for (const [key, value] of Object.entries(extra || {})) {
    if (value === undefined || value === null) continue;
    if (out[key] === undefined) {
      out[key] = value;
      continue;
    }
    const current = Array.isArray(out[key]) ? out[key].map(String) : [String(out[key])];
    const incoming = Array.isArray(value) ? value.map(String) : [String(value)];
    out[key] = [...new Set([...current, ...incoming])];
  }
  return out;
}

/**
 * Собирает итоговый объект php из пассивного определения, фингерпринта
 * приложения и результатов deep scan.
 *
 * Приоритет источников версии: phpinfo > заголовки > тело > app-fingerprint.
 * Пасхалка даёт только legacy PHP 5.x и никогда — точную версию.
 *
 * @param {object} detection результат detectPhp()
 * @param {{app?: object|null, phpinfo?: object|null, easterEgg?: object|null, fpm?: string|null, requests: number}} context
 * @param {'ru'|'en'|'fr'} lang
 */
function buildPhp(detection, context, lang) {
  const php = {
    detected: detection.detected,
    confidence: detection.confidence,
    version: detection.version,
    versionSource: detection.versionSource,
    precision: detection.precision,
    versionMin: null,
    versionMinSource: null,
    legacyPhp5: false,
    app: null,
    distro: detection.distro,
    sapi: detection.sapi,
    sapiConfidence: detection.sapiConfidence,
    sapiNote: detection.sapiNote,
    evidence: [...detection.evidence],
    requests: context.requests,
  };

  // Фингерпринт приложения: нижняя граница, только если точной версии нет.
  if (context.app) {
    php.app = { name: context.app.name, version: context.app.version || null };
    if (!php.detected) {
      php.detected = true;
      php.confidence = 'medium';
      php.evidence.push(t(lang, 'server.evidence.appImpliesPhp', { app: context.app.name }));
    }
    if (!php.version) {
      php.versionMin = context.app.versionMin;
      php.versionMinSource = 'app-fingerprint';
      php.versionSource = 'app-fingerprint';
      php.evidence.push(
        context.app.version
          ? t(lang, 'server.evidence.appFingerprint', {
              app: context.app.name,
              version: context.app.version,
              min: context.app.versionMin,
            })
          : t(lang, 'server.evidence.appFingerprintNoVersion', {
              app: context.app.name,
              min: context.app.versionMin,
            }),
      );
    }
  }

  // phpinfo(): самый точный источник, если страница действительно доступна.
  if (context.phpinfo && context.phpinfo.version) {
    const parsed = parseVersion(context.phpinfo.version);
    php.detected = true;
    php.version = context.phpinfo.version;
    php.versionSource = 'phpinfo';
    php.precision = parsed ? parsed.precision : 0;
    php.versionMin = null;
    php.versionMinSource = null;
    php.legacyPhp5 = false;
    php.confidence = 'high';
    php.evidence.push(t(lang, 'server.evidence.phpinfoFound', { version: context.phpinfo.version }));
    if (context.phpinfo.sapi) {
      php.evidence.push(t(lang, 'server.evidence.phpinfoSapi', { sapi: context.phpinfo.sapi }));
      if (/fpm|fastcgi/i.test(context.phpinfo.sapi)) {
        php.sapi = 'php-fpm';
        php.sapiConfidence = 'high';
        php.sapiNote = t(lang, 'server.sapi.fpm');
      }
    }
  }

  // Пасхалка: только legacy PHP 5.x, без точной версии. Если точная версия
  // уже известна, показания пасхалки игнорируем (противоречие = не доверяем).
  if (!php.version && context.easterEgg) {
    php.detected = true;
    php.legacyPhp5 = true;
    php.versionSource = 'easter-egg';
    php.confidence = 'medium';
    php.versionMin = null;
    php.versionMinSource = null;
    php.evidence.push(t(lang, 'server.evidence.easterEgg'));
  }

  if (context.fpm) {
    if (php.sapi !== 'php-fpm') {
      php.sapi = 'php-fpm';
      php.sapiConfidence = 'medium';
      php.sapiNote = t(lang, 'server.sapi.fpm');
    }
    php.evidence.push(
      t(lang, context.fpm === 'fpm-ping' ? 'server.evidence.fpmPing' : 'server.evidence.fpmStatus'),
    );
  }

  php.evidence = [...new Set(php.evidence)];
  return php;
}

/**
 * @param {object} php
 * @param {object[]} cves
 * @param {'ru'|'en'|'fr'} [lang]
 * @returns {string[]}
 */
function buildRecommendations(php, cves, lang = 'ru') {
  const recs = [];
  const statuses = cves.map((cve) => cve.status);
  const hasRisk = statuses.includes('vulnerable') || statuses.includes('likely_vulnerable');
  const hasUnknown = statuses.includes('unknown');

  if (hasRisk) {
    const fixList = Object.entries(FIXED_BY_BRANCH)
      .map(([branch, fix]) => `${branch} → ${fix}`)
      .join(', ');
    recs.push(t(lang, 'server.rec.update', { fixList }));
    recs.push(t(lang, 'server.rec.restart'));
    // Sury — не официальный канал безопасности; оговорка обязательна рядом
    // с предложением обновиться, а не где-то в документации.
    recs.push(t(lang, 'server.rec.sury'));
    recs.push(t(lang, 'server.rec.suryCaution'));
  }

  if (php.distro && php.distro.name && hasUnknown) {
    const command = PACKAGE_MANAGER[php.distro.name] || 'dpkg -l | grep php';
    recs.push(t(lang, 'server.rec.checkPackage', { command }));
  }

  if (!php.version) {
    recs.push(t(lang, 'server.rec.learnVersion'));
  }

  if (php.versionMin && !php.version) {
    recs.push(t(lang, 'server.rec.verifyVersion', { min: php.versionMin }));
  }

  if (php.legacyPhp5) {
    recs.push(t(lang, 'server.rec.legacyPhp5'));
  }

  if (!php.detected) {
    recs.push(t(lang, 'server.rec.hiddenHeaders'));
  }

  recs.push(t(lang, 'server.rec.passive'));
  return recs;
}

/**
 * @param {object[]} cves
 * @param {'ru'|'en'|'fr'} [lang]
 */
function summarize(cves, lang = 'ru') {
  /** @type {Record<string, number>} */
  const counts = {
    vulnerable: 0,
    likely_vulnerable: 0,
    not_vulnerable: 0,
    not_applicable: 0,
    unknown: 0,
  };
  for (const cve of cves) counts[cve.status] = (counts[cve.status] || 0) + 1;

  let status;
  if (counts.vulnerable > 0) status = 'vulnerable';
  else if (counts.likely_vulnerable > 0) status = 'likely_vulnerable';
  else if (counts.unknown > 0) status = 'unknown';
  else if (counts.not_vulnerable > 0) status = 'not_vulnerable';
  else status = 'not_applicable';

  return { status, label: statusLabel(lang, status), counts };
}

/**
 * Отчёт для случая, когда цель недоступна: статус unknown, без догадок.
 * @param {string} target
 * @param {Error & {code?: string}} error
 * @param {number} startedAt
 * @param {'ru'|'en'|'fr'} [lang]
 */
function buildErrorReport(target, error, startedAt, lang = 'ru', deep = false) {
  const errorCode = error.code || 'fetch_failed';
  // Для ru сохраняем техническую деталь (таймаут, DNS и т.п.). Для en/fr —
  // локализованный текст по коду; safefetch тоже отдаёт сообщения на выбранном
  // языке, поэтому error.detail в en/fr-отчёте не содержит кириллицы.
  const detail = lang === 'ru' && error.message ? error.message : errorText(lang, errorCode);
  const emptyPhp = {
    detected: false,
    confidence: 'none',
    version: null,
    versionSource: null,
    precision: 0,
    versionMin: null,
    versionMinSource: null,
    legacyPhp5: false,
    app: null,
    distro: null,
    sapi: 'unknown',
    sapiConfidence: 'none',
    sapiNote: null,
    evidence: [],
    requests: 0,
  };
  return {
    lang,
    deep,
    target,
    finalUrl: null,
    scannedAt: new Date().toISOString(),
    summary: {
      status: 'unknown',
      label: statusLabel(lang, 'unknown'),
      counts: { vulnerable: 0, likely_vulnerable: 0, not_vulnerable: 0, not_applicable: 0, unknown: 2 },
    },
    php: emptyPhp,
    cves: CVE_LIST.map((cve) => ({
      id: cve.id,
      title: t(lang, `server.cve.${cve.id}.title`),
      severity: cve.severity,
      advisory: cve.advisory,
      description: t(lang, `server.cve.${cve.id}.description`),
      status: 'unknown',
      confidence: 'low',
      reason: t(lang, 'server.reason.targetUnreachable', { detail }),
      evidence: [],
    })),
    mitigations: mitigationsFor(lang),
    recommendations: [t(lang, 'server.rec.unreachable'), t(lang, 'server.rec.passive')],
    checks: [],
    http: { status: null, requests: 0, redirects: 0, elapsedMs: Date.now() - startedAt },
    error: { code: errorCode, message: detail, detail: error.message },
    disclaimer: t(lang, 'server.disclaimer'),
  };
}

/**
 * Пассивная проверка цели.
 *
 * @param {string} target URL или хост (без схемы будет добавлен https://)
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs] общий таймаут проверки, по умолчанию 10000
 * @param {number} [opts.maxRequests] максимум запросов к цели, по умолчанию 3 (deep: 10)
 * @param {boolean} [opts.allowPrivateTargets] разрешить приватные адреса (ALLOW_PRIVATE_TARGETS=1)
 * @param {boolean} [opts.deep] включить ограниченный deep scan (allowlist, ≤ 10 запросов)
 * @param {'ru'|'en'|'fr'} [opts.lang] язык человекочитаемых строк отчёта, по умолчанию ru
 * @returns {Promise<object>}
 */
async function scan(target, opts = {}) {
  const startedAt = Date.now();
  const scannedAt = new Date(startedAt).toISOString();
  const lang = normalizeLang(opts.lang) || 'ru';
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : DEFAULT_TIMEOUT_MS;
  const deep = opts.deep === true;
  const requestedMax = Number(opts.maxRequests) > 0 ? Math.floor(Number(opts.maxRequests)) : null;
  // Deep scan — жёсткий предел: корневой GET + не больше MAX_DEEP_REQUESTS проб.
  const maxRequests = deep
    ? Math.min(requestedMax || MAX_DEEP_REQUESTS, MAX_DEEP_REQUESTS)
    : requestedMax || MAX_REQUESTS;
  const allowPrivateTargets =
    opts.allowPrivateTargets !== undefined
      ? opts.allowPrivateTargets === true
      : process.env.ALLOW_PRIVATE_TARGETS === '1';

  // Невалидная цель — ошибка вызывающего кода (API отдаёт 400/403), а не вердикт.
  const targetUrl = normalizeUrl(target, lang).href;

  const budget = { remaining: maxRequests };
  // Deep scan делает до 10 последовательных запросов, поэтому общий дедлайн
  // больше пассивного. Каждый запрос по-прежнему ограничен timeoutMs.
  const deadline = startedAt + (deep ? Math.max(timeoutMs, 30_000) : timeoutMs);
  const checks = [];

  let response;
  try {
    response = await safeFetch(target, {
      budget,
      deadline,
      timeoutMs,
      maxRequests,
      allowPrivateTargets,
      lang,
      method: 'GET',
      maxBytes: MAX_BODY_BYTES,
      maxRedirects: MAX_REDIRECTS,
    });
  } catch (error) {
    if (error instanceof InvalidTargetError || error instanceof BlockedTargetError) throw error;
    return buildErrorReport(targetUrl, error, startedAt, lang, deep);
  }

  checks.push(guardCheck(lang, response.guard));
  checks.push({
    name: 'request:GET',
    result: String(response.status),
    evidence: response.redirects
      ? t(lang, 'server.checks.requestGetRedirects', { url: targetUrl, redirects: response.redirects })
      : t(lang, 'server.checks.requestGet', { url: targetUrl }),
  });

  let headers = { ...response.headers };
  let finalUrl = response.finalUrl;

  let detection = detectPhp({ headers, body: response.body }, lang);
  const app = detectApp({ headers, body: response.body });
  const findings = { phpinfo: null, easterEgg: null, fpm: null };

  // Пассивный режим: если первый ответ пустой/ошибочный и версия не раскрыта —
  // один HEAD-запрос. В deep-режиме бюджет нужен probes, HEAD не делаем.
  if (!deep && !detection.version && budget.remaining > 0 && (response.status >= 400 || !response.body)) {
    try {
      const head = await safeFetch(finalUrl, {
        budget,
        deadline,
        timeoutMs,
        maxRequests,
        allowPrivateTargets,
        lang,
        method: 'HEAD',
        maxBytes: MAX_BODY_BYTES,
      });
      checks.push({
        name: 'request:HEAD',
        result: String(head.status),
        evidence: t(lang, 'server.checks.requestHead', { url: finalUrl }),
      });
      headers = { ...head.headers, ...headers };
      finalUrl = head.finalUrl || finalUrl;
      detection = detectPhp({ headers, body: response.body }, lang);
    } catch (error) {
      checks.push({
        name: 'request:HEAD',
        result: 'error',
        evidence: shortValue(error.message, 160),
      });
    }
  }

  // Deep scan: только allowlist, последовательно, до исчерпания бюджета.
  if (deep) {
    let skipped = false;
    for (const probe of DEEP_PROBES) {
      if (budget.remaining <= 0) {
        skipped = true;
        break;
      }
      // Точная версия или legacy-пасхалка уже доказаны — дальнейшие запросы
      // не нужны и только нагружают цель.
      if (detection.version && detection.precision >= 3) break;
      if (findings.easterEgg) break;

      let probeResponse;
      try {
        probeResponse = await safeFetch(probeUrl(finalUrl, probe.path), {
          budget,
          deadline,
          timeoutMs,
          maxRequests,
          allowPrivateTargets,
          lang,
          method: 'GET',
          maxBytes: DEEP_BODY_BYTES,
          maxRedirects: 2,
        });
      } catch (error) {
        checks.push({
          name: `deep:${probe.id}`,
          result: 'error',
          evidence: t(lang, 'server.checks.deepError', {
            path: probe.path,
            error: shortValue(error.message, 120),
          }),
        });
        continue;
      }

      checks.push({
        name: `deep:${probe.id}`,
        result: String(probeResponse.status),
        evidence: t(lang, 'server.checks.deepProbe', {
          path: probe.path,
          status: probeResponse.status,
        }),
      });

      headers = mergeHeaders(headers, probeResponse.headers);

      if (probe.kind === 'phpinfo') {
        const info = extractPhpinfo(probeResponse.body);
        if (info && info.version) {
          findings.phpinfo = info;
          break;
        }
      } else if (probe.kind === 'easter-egg') {
        const egg = detectEasterEgg(probeResponse);
        if (egg) {
          findings.easterEgg = { ...egg, path: probe.path };
          break;
        }
      } else if (detectFpm(probe.kind, probeResponse)) {
        findings.fpm = probe.kind;
      }
    }

    if (skipped) {
      checks.push({
        name: 'deep:limit',
        result: 'reached',
        evidence: t(lang, 'server.checks.deepSkipped', { max: MAX_DEEP_REQUESTS }),
      });
    }

    // Заголовки из deep-проб могли раскрыть версию/SAPI.
    detection = detectPhp({ headers, body: response.body }, lang);
  }

  checks.push({
    name: 'header:x-powered-by',
    result: headerValue(headers, 'x-powered-by') ? 'present' : 'missing',
    evidence: headerValue(headers, 'x-powered-by')
      ? shortValue(headerValue(headers, 'x-powered-by'))
      : t(lang, 'server.checks.headerMissing'),
  });
  checks.push({
    name: 'header:server',
    result: headerValue(headers, 'server') ? 'present' : 'missing',
    evidence: headerValue(headers, 'server')
      ? shortValue(headerValue(headers, 'server'))
      : t(lang, 'server.checks.headerMissing'),
  });

  const cookies = headerList(headers, 'set-cookie');
  const phpCookie = cookies.some((cookie) => /(?:^|;\s*)PHPSESSID=/i.test(cookie));
  checks.push({
    name: 'cookie:phpsessid',
    result: phpCookie ? 'present' : 'missing',
    evidence: phpCookie
      ? t(lang, 'server.checks.cookieHidden')
      : t(lang, 'server.checks.cookieNotFound'),
  });
  checks.push({
    name: 'body:markers',
    result: response.body ? 'parsed' : 'skipped',
    evidence: response.bodySkipped
      ? t(lang, 'server.checks.bodyNotRead', { reason: response.bodySkipped })
      : response.bodyTruncated
        ? t(lang, 'server.checks.bodyTruncated', { limit: MAX_BODY_BYTES })
        : t(lang, 'server.checks.bodyRead'),
  });

  const requestsMade = maxRequests - budget.remaining;
  const php = buildPhp(
    detection,
    { app, phpinfo: findings.phpinfo, easterEgg: findings.easterEgg, fpm: findings.fpm, requests: requestsMade },
    lang,
  );

  const versionSourceKey = php.versionSource || 'header';
  const versionSourceLabel = t(lang, `server.source.${versionSourceKey}`);
  let versionEvidence = t(lang, 'server.checks.versionHidden');
  if (php.version) {
    versionEvidence = t(lang, 'server.checks.versionSource', { source: versionSourceLabel });
  } else if (php.legacyPhp5) {
    versionEvidence = t(lang, 'server.checks.versionLegacy');
  } else if (php.versionMin) {
    versionEvidence = t(lang, 'server.checks.versionLowerBound', {
      min: php.versionMin,
      app: php.app && php.app.name ? php.app.name : '—',
    });
  }

  checks.push({
    name: 'php:version',
    result: php.version || (php.versionMin ? `>=${php.versionMin}` : php.legacyPhp5 ? 'legacy-php-5' : 'unknown'),
    evidence: versionEvidence,
  });

  const cves = CVE_LIST.map((cve) => evaluateCve(cve, php, lang));
  const summary = summarize(cves, lang);

  return {
    lang,
    deep,
    target: targetUrl,
    finalUrl,
    scannedAt,
    summary,
    php,
    cves,
    mitigations: mitigationsFor(lang),
    recommendations: buildRecommendations(php, cves, lang),
    checks,
    http: {
      status: response.status,
      requests: requestsMade,
      redirects: response.redirects,
      hops: response.hops,
      elapsedMs: Date.now() - startedAt,
      bodyTruncated: Boolean(response.bodyTruncated),
    },
    disclaimer: t(lang, 'server.disclaimer'),
  };
}

module.exports = {
  scan,
  guardCheck,
  detectPhp,
  buildPhp,
  mergeHeaders,
  extractPhpVersion,
  summarize,
  DISCLAIMER,
  MITIGATIONS,
  mitigationsFor,
  MAX_REQUESTS,
  MAX_DEEP_REQUESTS,
  MAX_BODY_BYTES,
  NEWEST_FIXED_VERSION,
};
