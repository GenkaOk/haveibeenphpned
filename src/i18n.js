'use strict';

/**
 * Серверная локализация: тонкая обёртка над общим словарём
 * public/i18n.js (один источник строк для браузера и Node).
 */

const core = require('../public/i18n.js');

/**
 * Язык запроса: тело → query → Accept-Language → en.
 * @param {{bodyLang?: unknown, queryLang?: unknown, acceptLanguage?: unknown}} [sources]
 * @returns {'ru'|'en'|'fr'}
 */
function resolveRequestLang(sources = {}) {
  const fromBody = core.normalizeLang(sources.bodyLang);
  if (fromBody) return fromBody;
  const fromQuery = core.normalizeLang(sources.queryLang);
  if (fromQuery) return fromQuery;
  const fromHeader = core.langFromAcceptLanguage(String(sources.acceptLanguage || ''));
  if (fromHeader) return fromHeader;
  return core.FALLBACK;
}

/**
 * Человекочитаемый текст ошибки по коду. Для неизвестного кода возвращает
 * сам код: машинные коды не переводятся.
 * @param {'ru'|'en'|'fr'} lang
 * @param {string} code
 */
function errorText(lang, code) {
  const key = `server.error.${code}`;
  const table = core.dict(lang);
  return Object.prototype.hasOwnProperty.call(table, key) ? core.t(lang, key) : String(code);
}

module.exports = { ...core, resolveRequestLang, errorText };
