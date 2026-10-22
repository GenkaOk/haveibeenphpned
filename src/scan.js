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
function detectSapi(server, poweredBy, phpDetected, lang = 'ru') {
  if (!phpDetected) {
    return { sapi: 'unknown', confidence: 'none', note: t(lang, 'server.sapi.notDetected') };
  }
  const hay = `${server} ${poweredBy}`;
  if (/php-?fpm|fastcgi/i.test(hay)) {
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
  const setCookies = headerList(headers, 'set-cookie');

  const evidence = [];
  const strong = [];
  const medium = [];

  if (poweredBy) {
    if (/php/i.test(poweredBy)) {
      strong.push(t(lang, 'server.evidence.poweredByPhp'));
      evidence.push(`X-Powered-By: ${shortValue(poweredBy)}`);
    } else {
      evidence.push(t(lang, 'server.evidence.poweredByOther', { value: shortValue(poweredBy) }));
    }
  }

  if (server) {
    evidence.push(t(lang, 'server.evidence.serverHeader', { value: shortValue(server) }));
    if (PHP_VERSION_RE.test(server) || /(^|[\s/])php([\s/]|$)/i.test(server)) {
      strong.push(t(lang, 'server.evidence.serverPhp'));
    }
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
  if (detected) {
    const headerEvidence =
      /php/i.test(poweredBy) ||
      PHP_VERSION_RE.test(server) ||
      strong.includes(t(lang, 'server.evidence.cookieShort'));
    confidence = headerEvidence ? 'high' : 'low';
  }

  // Версия: сначала заголовки (сильный источник), потом тело (слабый).
  let version = null;
  let versionSource = null;
  const fromPoweredBy = extractPhpVersion(poweredBy);
  const fromServer = extractPhpVersion(server);
  if (fromPoweredBy) {
    version = fromPoweredBy;
    versionSource = 'header';
  } else if (fromServer) {
    version = fromServer;
    versionSource = 'header';
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

  const sapi = detectSapi(server, poweredBy, detected, lang);

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
  }

  if (php.distro && php.distro.name && hasUnknown) {
    const command = PACKAGE_MANAGER[php.distro.name] || 'dpkg -l | grep php';
    recs.push(t(lang, 'server.rec.checkPackage', { command }));
  }

  if (!php.version) {
    recs.push(t(lang, 'server.rec.learnVersion'));
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
function buildErrorReport(target, error, startedAt, lang = 'ru') {
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
    distro: null,
    sapi: 'unknown',
    sapiConfidence: 'none',
    sapiNote: null,
    evidence: [],
  };
  return {
    lang,
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
 * @param {number} [opts.maxRequests] максимум запросов к цели, по умолчанию 3
 * @param {boolean} [opts.allowPrivateTargets] разрешить приватные адреса (ALLOW_PRIVATE_TARGETS=1)
 * @param {'ru'|'en'|'fr'} [opts.lang] язык человекочитаемых строк отчёта, по умолчанию ru
 * @returns {Promise<object>}
 */
async function scan(target, opts = {}) {
  const startedAt = Date.now();
  const scannedAt = new Date(startedAt).toISOString();
  const lang = normalizeLang(opts.lang) || 'ru';
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : DEFAULT_TIMEOUT_MS;
  const maxRequests = Number(opts.maxRequests) > 0 ? Number(opts.maxRequests) : MAX_REQUESTS;
  const allowPrivateTargets =
    opts.allowPrivateTargets !== undefined
      ? opts.allowPrivateTargets === true
      : process.env.ALLOW_PRIVATE_TARGETS === '1';

  // Невалидная цель — ошибка вызывающего кода (API отдаёт 400/403), а не вердикт.
  const targetUrl = normalizeUrl(target, lang).href;

  const budget = { remaining: maxRequests };
  const deadline = startedAt + timeoutMs;
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
    return buildErrorReport(targetUrl, error, startedAt, lang);
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

  // Если первый ответ пустой/ошибочный и версия не раскрыта — один HEAD-запрос.
  let detection = detectPhp({ headers, body: response.body }, lang);
  if (!detection.version && budget.remaining > 0 && (response.status >= 400 || !response.body)) {
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
  checks.push({
    name: 'php:version',
    result: detection.version || 'unknown',
    evidence: detection.version
      ? t(lang, 'server.checks.versionSource', {
          source: t(lang, `server.source.${detection.versionSource === 'body' ? 'body' : 'header'}`),
        })
      : t(lang, 'server.checks.versionHidden'),
  });

  const php = {
    detected: detection.detected,
    confidence: detection.confidence,
    version: detection.version,
    versionSource: detection.versionSource,
    precision: detection.precision,
    distro: detection.distro,
    sapi: detection.sapi,
    sapiConfidence: detection.sapiConfidence,
    sapiNote: detection.sapiNote,
    evidence: detection.evidence,
  };

  const cves = CVE_LIST.map((cve) => evaluateCve(cve, php, lang));
  const summary = summarize(cves, lang);

  return {
    lang,
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
      requests: budget.remaining >= 0 ? maxRequests - budget.remaining : maxRequests,
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
  extractPhpVersion,
  summarize,
  DISCLAIMER,
  MITIGATIONS,
  mitigationsFor,
  MAX_REQUESTS,
  MAX_BODY_BYTES,
  NEWEST_FIXED_VERSION,
};
