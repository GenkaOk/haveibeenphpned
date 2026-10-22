'use strict';

/**
 * HTTP API пассивной проверки.
 *
 *   GET  /api/health  -> {"ok":true}
 *   POST /api/check   -> отчёт scan()
 *
 * Зависимостей нет: node:http + node:fs.
 * Защита: rate limit 10 проверок/мин на IP, лимит тела запроса, SSRF-guard в scan().
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { scan } = require('./scan');
const { TargetError, InvalidTargetError } = require('./safefetch');
const { resolveRequestLang, t } = require('./i18n');

const DEFAULT_PORT = 8080;
const DEFAULT_HOST = '0.0.0.0';
const MAX_REQUEST_BODY = 64 * 1024;
const STATIC_DIR = path.join(__dirname, '..', 'public');
// Origin страницы на GitHub Pages. Сайт и API живут на разных хостах,
// поэтому браузеру нужно явное разрешение на кросс-доменный POST.
const DEFAULT_ALLOWED_ORIGINS = ['https://genkaok.github.io'];
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * Скользящее окно: не больше max запросов за windowMs на ключ.
 * @param {{windowMs?: number, max?: number, now?: () => number}} [options]
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 10;
  const now = options.now ?? Date.now;
  /** @type {Map<string, number[]>} */
  const buckets = new Map();

  function cleanup(timestamp) {
    for (const [key, stamps] of buckets) {
      if (!stamps.length || timestamp - stamps[stamps.length - 1] >= windowMs) buckets.delete(key);
    }
  }

  return function take(key) {
    const timestamp = now();
    if (buckets.size > 5000) cleanup(timestamp);
    const stamps = (buckets.get(key) || []).filter((ts) => timestamp - ts < windowMs);
    if (stamps.length >= max) {
      buckets.set(key, stamps);
      return { allowed: false, retryAfterMs: Math.max(1, windowMs - (timestamp - stamps[0])) };
    }
    stamps.push(timestamp);
    buckets.set(key, stamps);
    return { allowed: true, remaining: max - stamps.length };
  };
}

/**
 * Список origin: опция createApp важнее env, env важнее значения по умолчанию.
 * Пустые элементы отбрасываются, сравнение с Origin — точное.
 * @param {{allowedOrigins?: string[]}} options
 * @returns {string[]}
 */
function resolveAllowedOrigins(options = {}) {
  if (Array.isArray(options.allowedOrigins)) {
    return options.allowedOrigins.map((origin) => String(origin).trim()).filter(Boolean);
  }
  const fromEnv = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_ALLOWED_ORIGINS.slice();
}

function clientIp(req) {
  if (process.env.TRUST_PROXY === '1') {
    const forwarded = req.headers['x-forwarded-for'];
    const first = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '').split(',')[0];
    if (first.trim()) return first.trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

function readJsonBody(req, limit = MAX_REQUEST_BODY) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let done = false;

    const fail = (error) => {
      if (done) return;
      done = true;
      reject(error);
    };

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > limit) {
        // Текст ошибки локализуется на уровне обработчика: здесь только код.
        const error = new Error('content_too_large');
        error.code = 'content_too_large';
        error.statusCode = 413;
        fail(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', fail);
  });
}

function serveStatic(req, res, pathname, staticDir = STATIC_DIR, lang = 'en') {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: { code: 'method_not_allowed', message: t(lang, 'server.api.onlyGet') } });
    return true;
  }

  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(staticDir, relative);
  if (!filePath.startsWith(staticDir + path.sep) && filePath !== staticDir) {
    sendJson(res, 403, { error: { code: 'forbidden', message: t(lang, 'server.api.forbiddenPath') } });
    return true;
  }

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'content-type': MIME_TYPES[ext] || 'application/octet-stream',
    'content-length': stat.size,
    'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
  });
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  fs.createReadStream(filePath).pipe(res);
  return true;
}

/**
 * @param {object} [options]
 * @param {(target: string, opts: object) => Promise<object>} [options.scanImpl]
 * @param {boolean} [options.allowPrivateTargets]
 * @param {{windowMs?: number, max?: number, now?: () => number}} [options.rateLimit]
 * @param {string} [options.staticDir]
 * @param {string[]} [options.allowedOrigins] разрешённые CORS-origin (важнее env)
 * @param {(line: string) => void} [options.log]
 */
function createApp(options = {}) {
  const scanImpl = options.scanImpl || scan;
  const staticDir = options.staticDir || STATIC_DIR;
  const log = options.log || ((line) => console.log(line));
  const limiter = createRateLimiter(options.rateLimit);
  const allowedOrigins = resolveAllowedOrigins(options);
  const allowPrivateTargets =
    options.allowPrivateTargets !== undefined
      ? options.allowPrivateTargets === true
      : process.env.ALLOW_PRIVATE_TARGETS === '1';

  return http.createServer(async (req, res) => {
    const startedAt = Date.now();
    let pathname = '/';
    let queryLang = null;
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      pathname = parsedUrl.pathname;
      queryLang = parsedUrl.searchParams.get('lang');
    } catch {
      pathname = '/';
    }

    // CORS: только для /api/*, только перечисленным origin. Для остальных
    // Access-Control-Allow-Origin не выставляется — решает браузер клиента.
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
    const isApiPath = pathname === '/api' || pathname.startsWith('/api/');
    const originAllowed = Boolean(origin) && allowedOrigins.includes(origin);
    if (isApiPath && origin) {
      res.setHeader('vary', 'Origin');
      if (originAllowed) res.setHeader('access-control-allow-origin', origin);
    }

    // Логируем только метод, путь, код и время: без query, заголовков и тел.
    res.on('finish', () => {
      log(`${new Date().toISOString()} ${req.method} ${pathname} ${res.statusCode} ${Date.now() - startedAt}ms`);
    });

    // Preflight: 204 без тела, методы и заголовки — по контракту API.
    if (req.method === 'OPTIONS' && isApiPath) {
      /** @type {Record<string, string>} */
      const headers = {
        'access-control-allow-methods': 'POST, GET, OPTIONS',
        'access-control-allow-headers': 'Content-Type',
        'access-control-max-age': '600',
        vary: 'Origin',
      };
      if (originAllowed) headers['access-control-allow-origin'] = origin;
      res.writeHead(204, headers);
      res.end();
      return;
    }

    // Язык ответа: тело запроса → query → Accept-Language → en. Тело узнаём
    // позже, поэтому до разбора JSON язык берётся из query/заголовка.
    let lang = resolveRequestLang({
      queryLang,
      acceptLanguage: req.headers['accept-language'],
    });
    const text = (key, vars) => t(lang, key, vars);

    try {
      if (pathname === '/api/health') {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          sendJson(res, 405, { error: { code: 'method_not_allowed', message: text('server.api.onlyGet') } });
          return;
        }
        sendJson(res, 200, { ok: true });
        return;
      }

      if (pathname === '/api/check') {
        if (req.method !== 'POST') {
          sendJson(res, 405, {
            error: { code: 'method_not_allowed', message: text('server.api.usePost') },
          });
          return;
        }

        const ip = clientIp(req);
        const limit = limiter(ip);
        if (!limit.allowed) {
          const retryAfter = Math.ceil(limit.retryAfterMs / 1000);
          sendJson(
            res,
            429,
            {
              error: {
                code: 'rate_limited',
                message: text('server.api.rateLimited', {
                  max: options.rateLimit && options.rateLimit.max ? options.rateLimit.max : 10,
                  retryAfter,
                }),
              },
            },
            { 'retry-after': String(retryAfter) },
          );
          return;
        }

        const contentType = String(req.headers['content-type'] || '');
        if (!contentType.includes('application/json')) {
          sendJson(res, 415, {
            error: { code: 'unsupported_media_type', message: text('server.api.unsupportedMediaType') },
          });
          return;
        }

        let raw;
        try {
          raw = await readJsonBody(req);
        } catch (error) {
          sendJson(res, error.statusCode || 400, {
            error: {
              code: 'bad_request',
              message:
                error.code === 'content_too_large'
                  ? text('server.api.bodyTooLarge')
                  : error.message,
            },
          });
          return;
        }

        let payload;
        try {
          payload = JSON.parse(raw);
        } catch {
          sendJson(res, 400, { error: { code: 'invalid_json', message: text('server.api.invalidJson') } });
          return;
        }

        // Тело важнее заголовка: переключаем язык, если в нём есть lang.
        lang = resolveRequestLang({
          bodyLang: payload && payload.lang,
          queryLang,
          acceptLanguage: req.headers['accept-language'],
        });

        if (!payload || typeof payload.url !== 'string' || !payload.url.trim()) {
          sendJson(res, 400, {
            error: { code: 'invalid_target', message: text('server.api.urlRequired') },
          });
          return;
        }

        const report = await scanImpl(payload.url, {
          allowPrivateTargets,
          lang,
          // Deep scan — только при явном true. Любое другое значение = пассивный режим.
          deep: payload.deep === true,
        });
        sendJson(res, 200, report);
        return;
      }

      if (pathname.startsWith('/api/')) {
        sendJson(res, 404, { error: { code: 'not_found', message: text('server.api.notFoundRoute') } });
        return;
      }

      if (serveStatic(req, res, pathname, staticDir, lang)) return;

      if (pathname === '/' && !fs.existsSync(path.join(staticDir, 'index.html'))) {
        sendJson(res, 200, {
          service: 'php2shell-checker',
          api: { health: 'GET /api/health', check: 'POST /api/check' },
          ui: text('server.api.uiNotInstalled'),
        });
        return;
      }

      sendJson(res, 404, { error: { code: 'not_found', message: text('server.api.notFound') } });
    } catch (error) {
      if (error instanceof TargetError || error instanceof InvalidTargetError) {
        // Текст ошибки уже локализован в safefetch/scan выбранным языком.
        sendJson(res, error.statusCode || 400, {
          error: { code: error.code || 'invalid_target', message: error.message },
        });
        return;
      }
      // Внутренние ошибки не раскрывают детали клиенту, но пишутся в лог.
      log(`error: ${error && error.message ? error.message : 'unknown'}`);
      sendJson(res, 500, { error: { code: 'internal_error', message: text('server.api.internalError') } });
    }
  });
}

function start(options = {}) {
  const port = Number(process.env.PORT || options.port || DEFAULT_PORT);
  const host = process.env.HOST || options.host || DEFAULT_HOST;
  const server = createApp(options);

  server.listen(port, host, () => {
    console.log(`php2shell-checker: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
    console.log(`ALLOW_PRIVATE_TARGETS=${process.env.ALLOW_PRIVATE_TARGETS === '1' ? '1' : '0'}`);
  });

  const shutdown = (signal) => {
    console.log(`received ${signal}, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

if (require.main === module) start();

module.exports = { createApp, createRateLimiter, start };
