'use strict';

/**
 * Работа с заголовками ответа. Node отдаёт их в нижнем регистре,
 * значение — строка либо массив строк (set-cookie).
 */

/**
 * @param {Record<string, string|string[]|undefined>|null|undefined} headers
 * @param {string} name
 * @returns {string} склеенное значение или ''
 */
function headerValue(headers, name) {
  if (!headers) return '';
  const raw = headers[name.toLowerCase()];
  if (raw === undefined || raw === null) return '';
  return Array.isArray(raw) ? raw.join(', ') : String(raw);
}

/**
 * @param {Record<string, string|string[]|undefined>|null|undefined} headers
 * @param {string} name
 * @returns {string[]}
 */
function headerList(headers, name) {
  if (!headers) return [];
  const raw = headers[name.toLowerCase()];
  if (raw === undefined || raw === null) return [];
  return Array.isArray(raw) ? raw.map(String) : [String(raw)];
}

/**
 * Короткое представление значения для evidence: без переводов строк, обрезано.
 * @param {string} value
 * @param {number} [max]
 * @returns {string}
 */
function shortValue(value, max = 200) {
  const flat = String(value).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

module.exports = { headerValue, headerList, shortValue };
