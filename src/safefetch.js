'use strict';

/**
 * Безопасный HTTP-клиент для пассивной проверки.
 *
 * Ограничения и защита:
 *  - только http/https, только порты 80/443 (для приватных целей порт можно любой);
 *  - логин/пароль в URL запрещены;
 *  - DNS резолвится заранее, соединение идёт на проверенный IP (защита от rebinding);
 *  - metadata/link-local адреса заблокированы всегда;
 *  - приватные диапазоны — только при allowPrivateTargets;
 *  - таймаут на запрос, лимит тела, лимит редиректов и общий бюджет запросов.
 */

const dns = require('node:dns/promises');
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');

const { t } = require('./i18n');

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 5;
const DEFAULT_LANG = 'ru';
const ALLOWED_PORTS = new Set([80, 443]);
const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

/**
 * Человекочитаемый текст из словаря. Неизвестный язык приводит `t` к en,
 * поэтому русских строк в en/fr-сообщениях быть не может.
 * @param {'ru'|'en'|'fr'} lang
 * @param {string} key
 * @param {Record<string, unknown>} [vars]
 */
function detailText(lang, key, vars) {
  return t(lang, `server.errorDetail.${key}`, vars);
}

/**
 * @param {'ru'|'en'|'fr'} lang
 * @param {string} code
 */
function guardText(lang, code) {
  return t(lang, `server.guard.${code}`);
}

/**
 * @param {'blocked'|'private'|'public'} kind
 * @param {string} code
 * @param {'ru'|'en'|'fr'} lang
 */
function verdictOf(kind, code, lang) {
  return { kind, reasonCode: code, reason: guardText(lang, code) };
}

const BLOCKED_HOSTNAMES = new Set([
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
  'instance-data.ec2.internal',
]);

class TargetError extends Error {
  constructor(message, code, statusCode = 400) {
    super(message);
    this.name = 'TargetError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class InvalidTargetError extends TargetError {
  constructor(message) {
    super(message, 'invalid_target', 400);
    this.name = 'InvalidTargetError';
  }
}

class BlockedTargetError extends TargetError {
  constructor(message) {
    super(message, 'blocked_target', 403);
    this.name = 'BlockedTargetError';
  }
}

class BudgetExceededError extends TargetError {
  constructor(message) {
    super(message, 'request_budget_exceeded', 400);
    this.name = 'BudgetExceededError';
  }
}

class FetchError extends TargetError {
  constructor(message, cause) {
    super(message, 'fetch_failed', 502);
    this.name = 'FetchError';
    this.cause = cause;
  }
}

/* ------------------------------- IP-политика ------------------------------ */

/** @param {string} ip @returns {number|null} */
function ipv4ToInt(ip) {
  const parts = String(ip).split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = ((value << 8) | n) >>> 0;
  }
  return value >>> 0;
}

/** @param {string} base @param {number} bits @returns {number} маска */
function maskOf(bits) {
  return bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
}

/** @param {number} value @param {string} base @param {number} bits */
function inV4Cidr(value, base, bits) {
  const baseInt = ipv4ToInt(base);
  if (baseInt === null) return false;
  return (value & maskOf(bits)) === (baseInt & maskOf(bits));
}

/**
 * Раскладывает IPv6 в 8 групп по 16 бит. Поддерживает "::" и встроенный IPv4.
 * @param {string} ip @returns {number[]|null}
 */
function expandV6(ip) {
  let s = String(ip).toLowerCase().split('%')[0];
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);

  const embedded = s.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (embedded) {
    const v4 = ipv4ToInt(embedded[2]);
    if (v4 === null) return null;
    s = `${embedded[1]}${((v4 >>> 16) & 0xffff).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  if (!s.includes(':')) return null;

  const halves = s.split('::');
  if (halves.length > 2) return null;
  const parseGroups = (part) =>
    part ? part.split(':').map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN)) : [];
  const head = parseGroups(halves[0]);
  const tail = halves.length === 2 ? parseGroups(halves[1]) : [];
  if ([...head, ...tail].some(Number.isNaN)) return null;

  if (halves.length === 1) return head.length === 8 ? head : null;
  const fill = 8 - head.length - tail.length;
  if (fill < 1) return null;
  return [...head, ...new Array(fill).fill(0), ...tail];
}

/**
 * @param {number} value
 * @param {'ru'|'en'|'fr'} [lang]
 * @returns {{kind: 'blocked'|'private'|'public', reasonCode: string, reason: string}}
 */
function classifyV4(value, lang = DEFAULT_LANG) {
  if (value === ipv4ToInt('100.100.100.200')) {
    return verdictOf('blocked', 'metadata', lang);
  }
  if (inV4Cidr(value, '169.254.0.0', 16)) {
    return verdictOf('blocked', 'linkLocal', lang);
  }
  if (inV4Cidr(value, '0.0.0.0', 8)) return verdictOf('blocked', 'networkZero', lang);
  if (inV4Cidr(value, '224.0.0.0', 4)) return verdictOf('blocked', 'multicast', lang);
  if (inV4Cidr(value, '240.0.0.0', 4)) return verdictOf('blocked', 'reserved', lang);
  if (inV4Cidr(value, '255.255.255.255', 32)) return verdictOf('blocked', 'broadcast', lang);
  if (inV4Cidr(value, '192.0.0.0', 24)) return verdictOf('blocked', 'ietf', lang);
  if (inV4Cidr(value, '198.18.0.0', 15)) return verdictOf('blocked', 'benchmarking', lang);
  if (
    inV4Cidr(value, '192.0.2.0', 24) ||
    inV4Cidr(value, '198.51.100.0', 24) ||
    inV4Cidr(value, '203.0.113.0', 24)
  ) {
    return verdictOf('blocked', 'documentation', lang);
  }
  if (inV4Cidr(value, '127.0.0.0', 8)) return verdictOf('private', 'loopback', lang);
  if (inV4Cidr(value, '10.0.0.0', 8)) return verdictOf('private', 'private10', lang);
  if (inV4Cidr(value, '172.16.0.0', 12)) return verdictOf('private', 'private172', lang);
  if (inV4Cidr(value, '192.168.0.0', 16)) return verdictOf('private', 'private192', lang);
  if (inV4Cidr(value, '100.64.0.0', 10)) return verdictOf('private', 'cgnat', lang);
  return verdictOf('public', 'public', lang);
}

/**
 * @param {string} address
 * @param {'ru'|'en'|'fr'} [lang]
 * @returns {{kind: 'blocked'|'private'|'public', reasonCode: string, reason: string}}
 */
function classifyAddress(address, lang = DEFAULT_LANG) {
  const family = net.isIP(address);
  if (family === 4) {
    const value = ipv4ToInt(address);
    if (value === null) return verdictOf('blocked', 'invalidV4', lang);
    return classifyV4(value, lang);
  }
  if (family !== 6) return verdictOf('blocked', 'invalidAddress', lang);

  const g = expandV6(address);
  if (!g) return verdictOf('blocked', 'invalidV6', lang);

  // ::ffff:a.b.c.d — это IPv4, классифицируем по IPv4-правилам.
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    const v4 = (((g[6] << 16) >>> 0) | g[7]) >>> 0;
    return classifyV4(v4, lang);
  }
  if (g.every((x) => x === 0)) return verdictOf('blocked', 'unspecified', lang);
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) {
    return verdictOf('blocked', 'loopbackV6', lang);
  }
  if ((g[0] & 0xffc0) === 0xfe80) return verdictOf('blocked', 'linkLocalV6', lang);
  if ((g[0] & 0xff00) === 0xff00) return verdictOf('blocked', 'multicastV6', lang);
  if (g[0] === 0x2001 && g[1] === 0x0db8) return verdictOf('blocked', 'documentationV6', lang);
  if ((g[0] & 0xfe00) === 0xfc00) return verdictOf('private', 'ula', lang);
  return verdictOf('public', 'public', lang);
}

/* ------------------------------- Валидация -------------------------------- */

/**
 * @param {unknown} input
 * @param {'ru'|'en'|'fr'} [lang]
 * @returns {URL}
 */
function normalizeUrl(input, lang = DEFAULT_LANG) {
  if (typeof input !== 'string') throw new InvalidTargetError(detailText(lang, 'urlNotString'));
  let raw = input.trim();
  if (!raw) throw new InvalidTargetError(detailText(lang, 'urlEmpty'));
  if (raw.length > 2048) throw new InvalidTargetError(detailText(lang, 'urlTooLong'));
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new InvalidTargetError(detailText(lang, 'urlInvalid'));
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new InvalidTargetError(detailText(lang, 'urlProtocol'));
  }
  if (url.username || url.password) {
    throw new InvalidTargetError(detailText(lang, 'urlCredentials'));
  }
  if (!url.hostname) throw new InvalidTargetError(detailText(lang, 'urlNoHostname'));
  url.hash = '';
  return url;
}

/**
 * Проверяет цель и возвращает закреплённый IP.
 * @param {unknown} input
 * @param {{allowPrivateTargets?: boolean, lang?: 'ru'|'en'|'fr'}} [options]
 */
async function validateTarget(input, options = {}) {
  const allowPrivateTargets = options.allowPrivateTargets === true;
  const lang = options.lang || DEFAULT_LANG;
  const url = normalizeUrl(input, lang);
  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new BlockedTargetError(detailText(lang, 'blockedHostname', { hostname }));
  }

  let addresses;
  if (net.isIP(hostname)) {
    addresses = [{ address: hostname, family: net.isIP(hostname) }];
  } else {
    try {
      addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new InvalidTargetError(detailText(lang, 'resolve', { hostname }));
    }
  }
  if (!addresses.length) {
    throw new InvalidTargetError(detailText(lang, 'noAddresses', { hostname }));
  }

  const classified = addresses.map((item) => ({
    ...item,
    verdict: classifyAddress(item.address, lang),
  }));
  const blocked = classified.find((item) => item.verdict.kind === 'blocked');
  if (blocked) {
    throw new BlockedTargetError(
      detailText(lang, 'blockedAddress', {
        address: blocked.address,
        reason: blocked.verdict.reason,
      }),
    );
  }
  const privateAddr = classified.find((item) => item.verdict.kind === 'private');
  if (privateAddr && !allowPrivateTargets) {
    throw new BlockedTargetError(
      detailText(lang, 'privateAddress', {
        address: privateAddr.address,
        reason: privateAddr.verdict.reason,
      }),
    );
  }

  const chosen = classified.find((item) => item.verdict.kind === 'public') || classified[0];
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new InvalidTargetError(detailText(lang, 'badPort'));
  }
  if (!allowPrivateTargets && !ALLOWED_PORTS.has(port)) {
    throw new InvalidTargetError(detailText(lang, 'portNotAllowed'));
  }

  return {
    url,
    hostname,
    address: chosen.address,
    family: chosen.family,
    port,
    allowPrivateTargets,
    guard: {
      address: chosen.address,
      family: chosen.family,
      reasonCode: chosen.verdict.reasonCode,
      reason: chosen.verdict.reason,
    },
  };
}

/* -------------------------------- Запросы --------------------------------- */

function escapeHeader(value) {
  return String(value).replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Один HTTP-запрос на уже проверенный адрес (IP закреплён через lookup).
 */
function requestOnce(target, config) {
  const {
    method = 'GET',
    headers = {},
    timeoutMs,
    maxBytes = DEFAULT_MAX_BYTES,
    readBody = true,
    lang = DEFAULT_LANG,
  } = config;

  return new Promise((resolve, reject) => {
    const isHttps = target.url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const path = `${target.url.pathname || '/'}${target.url.search}`;

    const options = {
      host: target.hostname,
      port: target.port,
      path,
      method,
      agent: false,
      timeout: timeoutMs,
      headers: {
        host: target.url.host,
        'user-agent': escapeHeader(headers['user-agent'] || 'php2shell-checker/1.0 (passive)'),
        accept: escapeHeader(headers.accept || 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5'),
        'accept-encoding': 'identity',
        connection: 'close',
      },
      // Закрепляем IP, который прошёл проверку: DNS-rebinding не сработает.
      lookup: (hostname, lookupOptions, callback) => {
        const done = typeof lookupOptions === 'function' ? lookupOptions : callback;
        const opts = typeof lookupOptions === 'function' ? {} : lookupOptions || {};
        // Node 20+ с autoSelectFamily просит массив адресов (all: true).
        if (opts.all) done(null, [{ address: target.address, family: target.family }]);
        else done(null, target.address, target.family);
      },
    };
    if (isHttps && !net.isIP(target.hostname)) options.servername = target.hostname;

    let settled = false;
    let hardTimer = null;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      if (hardTimer) clearTimeout(hardTimer);
      fn(value);
    };

    const req = lib.request(options, (res) => {
      const status = res.statusCode || 0;
      const responseHeaders = res.headers;
      const encoding = String(responseHeaders['content-encoding'] || '').toLowerCase();
      const encodable = encoding && encoding !== 'identity';

      if (method === 'HEAD' || !readBody || encodable) {
        res.resume();
        finish(resolve, {
          status,
          headers: responseHeaders,
          body: '',
          bodyTruncated: false,
          bodySkipped: encodable ? `content-encoding: ${encoding}` : method === 'HEAD' ? 'HEAD' : 'body off',
          url: target.url.href,
        });
        res.on('error', () => {});
        return;
      }

      const chunks = [];
      let total = 0;
      let truncated = false;

      res.on('data', (chunk) => {
        if (total >= maxBytes) return;
        const remaining = maxBytes - total;
        if (chunk.length > remaining) {
          chunks.push(chunk.subarray(0, remaining));
          total = maxBytes;
          truncated = true;
          res.destroy();
          return;
        }
        chunks.push(chunk);
        total += chunk.length;
      });

      const complete = () => {
        finish(resolve, {
          status,
          headers: responseHeaders,
          body: Buffer.concat(chunks).toString('utf8'),
          bodyTruncated: truncated,
          bodySkipped: null,
          url: target.url.href,
        });
      };

      res.on('end', complete);
      res.on('close', complete);
      res.on('error', () => complete());
    });

    req.on('timeout', () => {
      req.destroy(new FetchError(detailText(lang, 'timeout', { timeoutMs })));
    });
    // Жёсткий таймер: сокетный timeout не спасает, если сервер медленно отдаёт тело.
    hardTimer = setTimeout(() => {
      req.destroy(new FetchError(detailText(lang, 'timeout', { timeoutMs })));
    }, timeoutMs);
    hardTimer.unref();
    req.on('error', (error) => {
      finish(reject, error instanceof TargetError ? error : new FetchError(error.message, error));
    });
    req.end();
  });
}

/**
 * Запрос с ручной обработкой редиректов и общим бюджетом запросов.
 *
 * @param {unknown} input
 * @param {object} [options]
 * @param {{remaining: number}} [options.budget]
 * @param {number} [options.deadline] epoch ms, общий дедлайн
 * @param {number} [options.timeoutMs]
 * @param {number} [options.maxBytes]
 * @param {boolean} [options.allowPrivateTargets]
 * @param {number} [options.maxRedirects]
 * @param {'GET'|'HEAD'} [options.method]
 * @param {'ru'|'en'|'fr'} [options.lang]
 * @param {number} [options.maxRequests] лимит запросов (только для текста ошибки)
 */
async function safeFetch(input, options = {}) {
  const budget = options.budget || { remaining: 3 };
  const deadline = options.deadline || Date.now() + (options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const maxBytes = options.maxBytes || DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  const method = options.method || 'GET';
  const lang = options.lang || DEFAULT_LANG;
  const maxRequests = Number(options.maxRequests) > 0 ? Number(options.maxRequests) : 3;

  let current = input;
  const hops = [];
  let redirects = 0;

  for (;;) {
    if (budget.remaining <= 0) {
      throw new BudgetExceededError(detailText(lang, 'budget', { max: maxRequests }));
    }
    const target = await validateTarget(current, {
      allowPrivateTargets: options.allowPrivateTargets === true,
      lang,
    });
    const left = deadline - Date.now();
    if (left <= 0) throw new FetchError(detailText(lang, 'deadline'));
    const timeoutMs = Math.max(1, Math.min(options.timeoutMs || DEFAULT_TIMEOUT_MS, left));

    budget.remaining -= 1;
    hops.push(target.url.href);

    const response = await requestOnce(target, {
      method,
      headers: options.headers,
      timeoutMs,
      maxBytes,
      readBody: method !== 'HEAD',
      lang,
    });

    const location = response.headers && response.headers.location;
    if (REDIRECT_CODES.has(response.status) && location) {
      if (redirects >= maxRedirects) {
        throw new FetchError(detailText(lang, 'tooManyRedirects', { maxRedirects }));
      }
      redirects += 1;
      let next;
      try {
        next = new URL(String(location), target.url);
      } catch {
        throw new FetchError(detailText(lang, 'badLocation'));
      }
      current = next.href;
      continue;
    }

    return {
      ...response,
      finalUrl: target.url.href,
      hops,
      redirects,
      guard: target.guard,
      requests: hops.length,
      elapsedMs: null,
    };
  }
}

module.exports = {
  DEFAULT_MAX_BYTES,
  DEFAULT_TIMEOUT_MS,
  TargetError,
  InvalidTargetError,
  BlockedTargetError,
  BudgetExceededError,
  FetchError,
  normalizeUrl,
  validateTarget,
  classifyAddress,
  safeFetch,
};
