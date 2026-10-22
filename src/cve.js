'use strict';

const { parseVersion, compareVersions, branchOf } = require('./version');
const { t, normalizeLang } = require('./i18n');

/**
 * Исправленные версии по веткам (на 21.10.2026).
 * Ветки ниже 8.2 (5.x, 7.x, 8.0, 8.1) исправленных релизов не получили —
 * для них уязвимы все версии.
 */
const FIXED_BY_BRANCH = Object.freeze({
  '8.5': '8.5.12',
  '8.4': '8.4.27',
  '8.3': '8.3.36',
  '8.2': '8.2.35',
});

/** Самая новая исправленная ветка: всё, что выше, считаем исправленным. */
const NEWEST_FIXED_BRANCH = '8.5';
const NEWEST_FIXED_VERSION = '8.5.12';

/**
 * Данные CVE, не зависящие от языка. Тексты заголовков и описаний живут
 * в public/i18n.js (server.cve.<id>.title/.description).
 */
const CVE_LIST = Object.freeze([
  {
    id: 'CVE-2026-109618',
    title: t('ru', 'server.cve.CVE-2026-109618.title'),
    severity: 9.2,
    advisory: 'https://github.com/advisories/GHSA-w8hw-w9fx-j79w',
    description: t('ru', 'server.cve.CVE-2026-109618.description'),
  },
  {
    id: 'CVE-2026-109619',
    title: t('ru', 'server.cve.CVE-2026-109619.title'),
    severity: 9.2,
    advisory: 'https://github.com/advisories/GHSA-6wmf-4rv5-p3rp',
    description: t('ru', 'server.cve.CVE-2026-109619.description'),
  },
]);

/** Русские подписи статусов — обратная совместимость и значения по умолчанию. */
const STATUS_LABELS = Object.freeze({
  vulnerable: t('ru', 'server.status.vulnerable'),
  likely_vulnerable: t('ru', 'server.status.likely_vulnerable'),
  not_vulnerable: t('ru', 'server.status.not_vulnerable'),
  not_applicable: t('ru', 'server.status.not_applicable'),
  unknown: t('ru', 'server.status.unknown'),
});

/**
 * Подпись статуса на выбранном языке. Машинный код не меняется.
 * @param {'ru'|'en'|'fr'} lang
 * @param {string} status
 */
function statusLabel(lang, status) {
  const code = normalizeLang(lang) || 'ru';
  return t(code, `server.status.${status}`);
}

const PACKAGE_MANAGER = Object.freeze({
  ubuntu: 'dpkg -l | grep php',
  debian: 'dpkg -l | grep php',
  alpine: 'apk info -v | grep php',
  centos: 'rpm -qa | grep php',
  rhel: 'rpm -qa | grep php',
  amazon: 'rpm -qa | grep php',
  suse: 'rpm -qa | grep php',
});

function fixForBranch(branch) {
  return FIXED_BY_BRANCH[branch] || null;
}

function isNewerThanNewestFixed(parsed) {
  return compareVersions(parsed, NEWEST_FIXED_VERSION) > 0;
}

/**
 * @param {{id: string, severity: number, advisory: string}} cve
 * @param {object} php результат определения PHP из scan.js
 * @param {'ru'|'en'|'fr'} [lang]
 * @returns {object}
 */
function evaluateCve(cve, php, lang = 'ru') {
  const code = normalizeLang(lang) || 'ru';
  const base = {
    id: cve.id,
    title: t(code, `server.cve.${cve.id}.title`),
    severity: cve.severity,
    advisory: cve.advisory,
    description: t(code, `server.cve.${cve.id}.description`),
  };

  const phpEvidence = (php.evidence || []).slice(0, 4);

  if (!php.detected) {
    return {
      ...base,
      status: 'not_applicable',
      confidence: 'low',
      reason: t(code, 'server.reason.notApplicable'),
      evidence: [t(code, 'server.evidence.phpNotDetected')],
    };
  }

  const version = php.version || null;
  const parsed = version ? parseVersion(version) : null;

  if (!parsed) {
    // Пасхалка PHP отвечает только на legacy-версиях (≤ 5.4): ветка 5.x
    // исправленных релизов не получала, поэтому обе CVE её затрагивают.
    // Точную версию по пасхалке не выводим.
    if (php.legacyPhp5) {
      return {
        ...base,
        status: 'vulnerable',
        confidence: 'medium',
        reason: t(code, 'server.reason.legacyPhp5'),
        evidence: phpEvidence,
      };
    }

    // Точной версии нет, но фингерпринт приложения даёт нижнюю границу.
    const versionMin = php.versionMin ? parseVersion(php.versionMin) : null;
    if (versionMin) {
      const app = php.app && php.app.name ? php.app.name : t(code, 'server.reason.unknownApp');
      const minBranch = branchOf(versionMin);
      const minFix = fixForBranch(minBranch);

      if (isNewerThanNewestFixed(versionMin)) {
        return {
          ...base,
          status: 'not_vulnerable',
          confidence: 'medium',
          reason: t(code, 'server.reason.lowerBoundNewer', {
            app,
            min: php.versionMin,
            newest: NEWEST_FIXED_VERSION,
          }),
          evidence: phpEvidence,
        };
      }

      if (minFix && compareVersions(versionMin, minFix) >= 0) {
        return {
          ...base,
          status: 'not_vulnerable',
          confidence: 'medium',
          reason: t(code, 'server.reason.lowerBoundFixed', {
            app,
            min: php.versionMin,
            fix: minFix,
            branch: minBranch,
          }),
          evidence: phpEvidence,
        };
      }

      return {
        ...base,
        status: 'likely_vulnerable',
        confidence: 'medium',
        reason: minFix
          ? t(code, 'server.reason.lowerBound', {
              app,
              min: php.versionMin,
              fix: minFix,
              branch: minBranch,
            })
          : t(code, 'server.reason.lowerBoundEol', {
              app,
              min: php.versionMin,
              branch: minBranch,
            }),
        evidence: phpEvidence,
      };
    }

    return {
      ...base,
      status: 'unknown',
      confidence: 'low',
      reason: t(code, 'server.reason.noVersion'),
      evidence: phpEvidence,
    };
  }

  const branch = branchOf(parsed);
  const fix = fixForBranch(branch);
  const distro = php.distro && php.distro.name ? php.distro.name : null;
  const evidence = phpEvidence;

  // Версия раскрыта не полностью (например "8.4"): сравнивать патч-уровень нечем.
  if (parsed.precision < 3) {
    if (!fix && !isNewerThanNewestFixed(parsed)) {
      return {
        ...base,
        status: 'likely_vulnerable',
        confidence: 'medium',
        reason: t(code, 'server.reason.eolPartial', { branch, version }),
        evidence,
      };
    }
    return {
      ...base,
      status: 'unknown',
      confidence: 'low',
      reason: t(code, 'server.reason.partialUnknown', {
        version,
        fix: fix || NEWEST_FIXED_VERSION,
      }),
      evidence,
    };
  }

  // Ветка новее самой новой исправленной — считаем исправленной.
  if (isNewerThanNewestFixed(parsed)) {
    return {
      ...base,
      status: 'not_vulnerable',
      confidence: 'high',
      reason: t(code, 'server.reason.newer', {
        version,
        newest: NEWEST_FIXED_VERSION,
        newestBranch: NEWEST_FIXED_BRANCH,
      }),
      evidence,
    };
  }

  // Для ветки с исправлением: версия не ниже фикса — точно не подвержена.
  if (fix && compareVersions(parsed, fix) >= 0) {
    return {
      ...base,
      status: 'not_vulnerable',
      confidence: 'high',
      reason: t(code, 'server.reason.fixedBranch', { version, fix, branch }),
      evidence,
    };
  }

  // Версия ниже фикса (или ветка без фикса), но сборка дистрибутивная:
  // патч могли бэкпортировать, удалённо это не проверить.
  if (distro) {
    return {
      ...base,
      status: 'unknown',
      confidence: 'medium',
      reason: t(code, 'server.reason.distroBackport', {
        version,
        fix: fix || NEWEST_FIXED_VERSION,
        branch,
        distro,
      }),
      evidence,
    };
  }

  if (!fix) {
    // EOL-ветка: исправленных релизов нет, уязвимы все версии.
    return {
      ...base,
      status: 'vulnerable',
      confidence: php.versionSource === 'body' ? 'medium' : 'high',
      reason: t(code, 'server.reason.eol', { version, branch }),
      evidence,
    };
  }

  return {
    ...base,
    status: 'vulnerable',
    confidence: php.versionSource === 'body' ? 'medium' : 'high',
    reason: t(code, 'server.reason.belowFix', { version, fix, branch }),
    evidence,
  };
}

module.exports = {
  CVE_LIST,
  FIXED_BY_BRANCH,
  NEWEST_FIXED_VERSION,
  NEWEST_FIXED_BRANCH,
  STATUS_LABELS,
  statusLabel,
  PACKAGE_MANAGER,
  fixForBranch,
  evaluateCve,
  parseVersion,
  compareVersions,
  branchOf,
};
