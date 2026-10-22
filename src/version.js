'use strict';

/**
 * Разбор и сравнение версий PHP.
 *
 * Версия в заголовках приходит в виде "8.4.26" или "8.1.2-1ubuntu2.14".
 * Сравниваем только числовую часть, суффикс (дистрибутив, RC) сохраняем
 * отдельно — он нужен, чтобы понять, мог ли дистрибутив бэкпортировать патч.
 */

const DISTRO_RE =
  /(ubuntu|debian|deb\d+u?\d*|alpine|centos|rhel|red\s?hat|amazon|amzn|suse|opensuse|~bpo|\.el\d+|\.fc\d+)/i;

/**
 * @param {unknown} raw
 * @returns {{raw: string, numbers: number[], precision: number, suffix: string}|null}
 */
function parseVersion(raw) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;
  const m = value.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?([^0-9].*)?$/);
  if (!m) return null;

  const numbers = [Number(m[1])];
  if (m[2] !== undefined) numbers.push(Number(m[2]));
  if (m[3] !== undefined) numbers.push(Number(m[3]));

  return {
    raw: value,
    numbers,
    precision: numbers.length,
    suffix: (m[4] || '').trim(),
  };
}

/**
 * @param {number[]} left
 * @param {number[]} right
 * @returns {-1|0|1}
 */
function compareNumbers(left, right) {
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    const a = left[i] ?? 0;
    const b = right[i] ?? 0;
    if (a !== b) return a < b ? -1 : 1;
  }
  return 0;
}

/**
 * @param {string|{numbers: number[]}} a
 * @param {string|{numbers: number[]}} b
 * @returns {-1|0|1}
 */
function compareVersions(a, b) {
  const left = typeof a === 'string' ? parseVersion(a) : a;
  const right = typeof b === 'string' ? parseVersion(b) : b;
  if (!left || !right) throw new TypeError('compareVersions: invalid version');
  return compareNumbers(left.numbers, right.numbers);
}

/**
 * Ветка версии: "8.4.26" -> "8.4", "7.4" -> "7.4", "8" -> "8.0".
 * @param {string|{numbers: number[]}} version
 * @returns {string|null}
 */
function branchOf(version) {
  const v = typeof version === 'string' ? parseVersion(version) : version;
  if (!v) return null;
  return `${v.numbers[0]}.${v.numbers[1] ?? 0}`;
}

/**
 * Ищет признаки дистрибутива в произвольной строке (заголовок, суффикс версии).
 * @param {unknown} text
 * @returns {string|null} ubuntu | debian | alpine | centos | rhel | amazon | suse | null
 */
function matchDistro(text) {
  if (typeof text !== 'string' || !text) return null;
  const m = text.match(DISTRO_RE);
  if (!m) return null;
  const name = m[1].toLowerCase().replace(/\s+/g, '');
  if (name.startsWith('ubuntu')) return 'ubuntu';
  if (name.startsWith('deb')) return 'debian';
  if (name.startsWith('alpine')) return 'alpine';
  if (name.startsWith('centos')) return 'centos';
  if (name.startsWith('amzn') || name.startsWith('amazon')) return 'amazon';
  if (name.includes('suse')) return 'suse';
  if (name.includes('red') || name === 'rhel') return 'rhel';
  return name;
}

module.exports = {
  DISTRO_RE,
  parseVersion,
  compareVersions,
  compareNumbers,
  branchOf,
  matchDistro,
};
