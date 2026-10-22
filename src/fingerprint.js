'use strict';

/**
 * Фингерпринтинг PHP-приложений по публичным признакам.
 *
 * Приложение не сообщает точную версию PHP, но сообщает свою версию, а у
 * каждой версии приложения есть минимальная поддерживаемая версия PHP.
 * Это даёт *нижнюю границу* (lower bound), а не точную версию: сервер мог
 * обновиться сильнее. Нижняя граница используется только тогда, когда точная
 * версия PHP не раскрыта, и всегда помечается в отчёте.
 *
 * Источники минимумов — официальная документация приложений, см. README
 * (раздел «Deep scan»). Значения намеренно консервативные.
 */

const { headerValue, headerList } = require('./headers');
const { parseVersion } = require('./version');

/**
 * Правила: приложение → минимальная версия PHP для диапазона версий.
 * `from` — минимальная версия приложения, к которой относится требование.
 * Список отсортирован от новых к старым; берём первое совпадение.
 */
const APP_RULES = Object.freeze({
  wordpress: {
    name: 'WordPress',
    rules: [
      { from: '6.6', min: '7.2.24' },
      { from: '6.3', min: '7.0.0' },
      { from: '5.2', min: '5.6.20' },
    ],
    fallback: '5.2.4',
  },
  drupal: {
    name: 'Drupal',
    rules: [
      { from: '11', min: '8.3.0' },
      { from: '10', min: '8.1.0' },
      { from: '9', min: '7.3.0' },
      { from: '8', min: '5.5.9' },
    ],
    fallback: '5.2.5',
  },
  joomla: {
    name: 'Joomla',
    rules: [
      { from: '5', min: '8.1.0' },
      { from: '4', min: '7.2.5' },
      { from: '3', min: '5.3.10' },
    ],
    fallback: '5.3.10',
  },
  laravel: {
    name: 'Laravel',
    rules: [
      { from: '11', min: '8.2.0' },
      { from: '10', min: '8.1.0' },
      { from: '9', min: '8.0.2' },
      { from: '8', min: '7.3.0' },
    ],
    fallback: '7.2.5',
  },
  symfony: {
    name: 'Symfony',
    rules: [
      { from: '7', min: '8.2.0' },
      { from: '6.4', min: '8.1.0' },
      { from: '6', min: '8.0.2' },
      { from: '5.4', min: '7.2.5' },
    ],
    fallback: '7.1.3',
  },
});

/**
 * @param {unknown} raw
 * @returns {number[]|null}
 */
function versionNumbers(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const parsed = parseVersion(raw.trim());
  return parsed ? parsed.numbers : null;
}

/**
 * Сравнивает версию приложения с границей `from` (только major/minor/patch).
 * @param {number[]} actual
 * @param {string} from
 * @returns {boolean} actual >= from
 */
function atLeast(actual, from) {
  const min = versionNumbers(from);
  if (!min) return false;
  const len = Math.max(actual.length, min.length);
  for (let index = 0; index < len; index += 1) {
    const a = actual[index] ?? 0;
    const b = min[index] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

/**
 * Минимальная версия PHP для приложения и его версии.
 * @param {keyof typeof APP_RULES} key
 * @param {string|null} appVersion
 * @returns {string}
 */
function minimumPhpFor(key, appVersion) {
  const app = APP_RULES[key];
  if (!app) return null;
  const actual = versionNumbers(appVersion);
  if (!actual) return app.fallback || null;
  for (const rule of app.rules) {
    if (atLeast(actual, rule.from)) return rule.min;
  }
  return app.fallback || null;
}

/**
 * Первый <meta name="generator">.
 * @param {string} body
 * @returns {string|null}
 */
function metaGenerator(body) {
  if (!body) return null;
  const tags = body.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    if (!/\bname\s*=\s*["']generator["']/i.test(tag)) continue;
    const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
    if (content && content[1].trim()) return content[1].trim();
  }
  return null;
}

/**
 * Версия из строки генератора: "WordPress 6.5.3" → "6.5.3".
 * @param {string} generator
 * @param {RegExp} re
 * @returns {string|null}
 */
function generatorVersion(generator, re) {
  const match = generator.match(re);
  return match ? match[1] : null;
}

/**
 * Определяет PHP-приложение и нижнюю границу PHP.
 *
 * @param {{headers?: Record<string, string|string[]>, body?: string}} response
 * @returns {{key: string, name: string, version: string|null, versionMin: string}|null}
 */
function detectApp(response = {}) {
  const headers = response.headers || {};
  const body = response.body || '';
  const generator = metaGenerator(body) || headerValue(headers, 'x-generator') || '';
  const cookies = headerList(headers, 'set-cookie').join('; ');

  /** @type {{key: keyof typeof APP_RULES, version: string|null}|null} */
  let found = null;

  const wordpressVersion = generatorVersion(generator, /WordPress\s*([\d.]+)/i);
  if (
    wordpressVersion ||
    /wp-content\//i.test(body) ||
    /wp-includes\//i.test(body) ||
    /wp-json\/?/i.test(body)
  ) {
    found = { key: 'wordpress', version: wordpressVersion };
  }

  if (!found) {
    const drupalVersion = generatorVersion(generator, /Drupal\s*([\d.]+)/i);
    if (
      drupalVersion ||
      /Drupal\.settings|drupalSettings/i.test(body) ||
      /\/sites\/default\/files\//i.test(body)
    ) {
      found = { key: 'drupal', version: drupalVersion };
    }
  }

  if (!found) {
    const joomlaVersion = generatorVersion(generator, /Joomla!?\s*([\d.]+)/i);
    if (joomlaVersion || /\/media\/system\/js\//i.test(body) || /option=com_/i.test(body)) {
      found = { key: 'joomla', version: joomlaVersion };
    }
  }

  if (!found && /(?:^|;\s*)laravel_session=/i.test(cookies)) {
    found = { key: 'laravel', version: null };
  }

  if (!found && (/(?:^|;\s*)sf_redirect=/i.test(cookies) || headerValue(headers, 'x-debug-token'))) {
    found = { key: 'symfony', version: null };
  }

  if (!found) return null;

  const meta = APP_RULES[found.key];
  const versionMin = minimumPhpFor(found.key, found.version);
  if (!versionMin) return null;

  return {
    key: found.key,
    name: meta.name,
    version: found.version,
    versionMin,
  };
}

module.exports = {
  APP_RULES,
  detectApp,
  minimumPhpFor,
  metaGenerator,
};
