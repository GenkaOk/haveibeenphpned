#!/usr/bin/env node
'use strict';

/**
 * CLI пассивной проверки.
 *
 *   node cli.js https://example.com
 *   node cli.js example.com --json
 *   node cli.js example.com --lang=en
 *
 * Коды выхода (не зависят от языка):
 *   0 — не подвержен (или PHP не обнаружен)
 *   1 — подвержен / вероятно подвержен
 *   2 — неизвестно или проверка не удалась
 */

const { scan } = require('./src/scan');
const { TargetError } = require('./src/safefetch');
const { FIXED_BY_BRANCH } = require('./src/cve');
const { normalizeLang, t, formatDate, errorText } = require('./src/i18n');

const EXIT_CODES = {
  not_vulnerable: 0,
  not_applicable: 0,
  vulnerable: 1,
  likely_vulnerable: 1,
  unknown: 2,
};

const STATUS_STYLE = {
  vulnerable: '31', // red
  likely_vulnerable: '33', // yellow
  not_vulnerable: '32', // green
  not_applicable: '32',
  unknown: '36', // cyan
};

const DEFAULT_LANG = 'ru';

/**
 * @param {'unknown_option'|'extra_arg'} code
 * @param {string} arg
 */
function argError(code, arg) {
  const error = new Error(code);
  error.code = code;
  error.arg = arg;
  return error;
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const result = { url: null, json: false, help: false, deep: false, timeoutMs: undefined, allowPrivate: false, lang: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') result.json = true;
    else if (arg === '--deep') result.deep = true;
    else if (arg === '--help' || arg === '-h') result.help = true;
    else if (arg === '--allow-private') result.allowPrivate = true;
    else if (arg.startsWith('--timeout=')) result.timeoutMs = Number(arg.slice('--timeout='.length));
    else if (arg === '--lang') {
      index += 1;
      result.lang = argv[index] === undefined ? '' : argv[index];
    } else if (arg.startsWith('--lang=')) result.lang = arg.slice('--lang='.length);
    else if (arg.startsWith('-')) throw argError('unknown_option', arg);
    else if (!result.url) result.url = arg;
    else throw argError('extra_arg', arg);
  }
  return result;
}

/**
 * Язык для сообщений об ошибках разбора: ищем --lang=... до валидации.
 * @param {string[]} argv
 * @returns {'ru'|'en'|'fr'}
 */
function langHint(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--lang=')) return normalizeLang(arg.slice('--lang='.length)) || DEFAULT_LANG;
    if (arg === '--lang' && argv[index + 1]) return normalizeLang(argv[index + 1]) || DEFAULT_LANG;
  }
  return DEFAULT_LANG;
}

function colorize(text, code) {
  if (!process.stdout.isTTY || process.env.NO_COLOR) return text;
  return `\u001b[${code}m${text}\u001b[0m`;
}

/**
 * @param {string} status машинный код
 * @param {'ru'|'en'|'fr'} lang
 */
function statusLine(status, lang) {
  const label = t(lang, `server.status.${status}`).toUpperCase();
  return colorize(label, STATUS_STYLE[status] || '0');
}

/**
 * @param {'ru'|'en'|'fr'} lang
 */
function usage(lang) {
  const lines = [
    t(lang, 'cli.intro'),
    '',
    t(lang, 'cli.usageHeading'),
    '  node cli.js <url> [--json] [--deep] [--timeout=<ms>] [--allow-private] [--lang=ru|en|fr]',
    '',
    t(lang, 'cli.optionsHeading'),
    `  --json            ${t(lang, 'cli.optionJson')}`,
    `  --deep            ${t(lang, 'cli.optionDeep')}`,
    `  --timeout=<ms>    ${t(lang, 'cli.optionTimeout')}`,
    `  --allow-private   ${t(lang, 'cli.optionAllowPrivate')}`,
    `  --lang=<code>     ${t(lang, 'cli.optionLang')}`,
    '',
    t(lang, 'cli.exitHeading'),
    `  0 — ${t(lang, 'cli.exit0')}`,
    `  1 — ${t(lang, 'cli.exit1')}`,
    `  2 — ${t(lang, 'cli.exit2')}`,
    '',
    t(lang, 'server.disclaimer'),
  ];
  return `${lines.join('\n')}\n`;
}

/**
 * Человекочитаемый отчёт. Машинные коды статусов не переводятся.
 * @param {object} report
 * @param {'ru'|'en'|'fr'} [lang]
 */
function formatHuman(report, lang = DEFAULT_LANG) {
  const lines = [];
  const php = report.php;

  const targetLine =
    `${report.target}` +
    (report.finalUrl && report.finalUrl !== report.target ? ` → ${report.finalUrl}` : '');
  lines.push(`${t(lang, 'cli.label.target')} ${targetLine}`);
  lines.push(
    t(lang, 'cli.label.time', {
      date: formatDate(report.scannedAt, lang),
      ms: report.http.elapsedMs,
      requests: report.http.requests,
    }),
  );

  if (php.detected) {
    const version = php.version
      ? php.version
      : php.versionMin
        ? `>=${php.versionMin}`
        : t(lang, 'cli.versionHidden');
    const confidence = t(lang, `ui.confidence.${php.sapiConfidence}`);
    const sapiName =
      php.sapi === 'php-fpm'
        ? t(lang, 'ui.sapi.phpFpm')
        : php.sapi === 'mod_php'
          ? t(lang, 'ui.sapi.modPhp')
          : t(lang, 'cli.sapiUnknown');
    const sapi =
      php.sapi === 'unknown' ? sapiName : t(lang, 'cli.sapi', { sapi: sapiName, confidence });
    lines.push(`${t(lang, 'cli.label.php')} ${t(lang, 'cli.phpDetected', { version, sapi })}`);
    if (php.versionMin && !php.version) {
      lines.push(
        t(lang, 'cli.versionMin', {
          min: php.versionMin,
          app: php.app && php.app.name ? php.app.name : '—',
        }),
      );
    }
    if (php.legacyPhp5) lines.push(t(lang, 'cli.legacyPhp5'));
    if (php.distro && php.distro.name) {
      lines.push(t(lang, 'cli.distro', { name: php.distro.name }));
    }
  } else {
    lines.push(`${t(lang, 'cli.label.php')} ${t(lang, 'cli.phpNotDetected')}`);
  }

  lines.push(`${t(lang, 'cli.label.summary')} ${statusLine(report.summary.status, lang)}`);
  lines.push('');

  for (const cve of report.cves) {
    lines.push(`${cve.id}  ${cve.title}`);
    lines.push(
      `  ${t(lang, 'cli.severityLine', {
        severity: cve.severity,
        status: t(lang, `server.status.${cve.status}`),
        confidence: t(lang, `ui.confidence.${cve.confidence}`),
      })}`,
    );
    lines.push(`  ${t(lang, 'cli.reason')} ${cve.reason}`);
    for (const item of cve.evidence.slice(0, 3)) {
      lines.push(`  ${t(lang, 'cli.evidence')} ${item}`);
    }
    lines.push('');
  }

  if (report.recommendations.length) {
    lines.push(t(lang, 'cli.recommendations'));
    for (const rec of report.recommendations) lines.push(`  - ${rec}`);
    lines.push('');
  }

  if (report.error) lines.push(`${t(lang, 'cli.error')} ${report.error.message}`, '');
  lines.push(`${t(lang, 'cli.limits')} ${report.disclaimer}`);
  return lines.join('\n');
}

async function main(argv) {
  const hint = langHint(argv);

  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    // parseArgs не знает языка: сообщение собирается с языком из argv.
    const key = error && error.code === 'extra_arg' ? 'cli.extraArg' : 'cli.unknownOption';
    process.stderr.write(`${t(hint, key, { arg: (error && error.arg) || '' })}\n\n${usage(hint)}`);
    return 2;
  }

  let lang = DEFAULT_LANG;
  if (args.lang !== null && args.lang !== undefined) {
    const normalized = normalizeLang(args.lang);
    if (!normalized) {
      process.stderr.write(`${t(hint, 'cli.badLang', { arg: args.lang })}\n\n${usage(hint)}`);
      return 2;
    }
    lang = normalized;
  }

  if (args.help) {
    process.stdout.write(usage(lang));
    return 0;
  }
  if (!args.url) {
    process.stderr.write(`${t(lang, 'cli.noUrl')}\n\n${usage(lang)}`);
    return 2;
  }
  if (args.timeoutMs !== undefined && (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0)) {
    process.stderr.write(`${t(lang, 'cli.badTimeout')}\n`);
    return 2;
  }

  const allowPrivate = args.allowPrivate || process.env.ALLOW_PRIVATE_TARGETS === '1';

  let report;
  try {
    report = await scan(args.url, {
      timeoutMs: args.timeoutMs,
      allowPrivateTargets: allowPrivate,
      deep: args.deep,
      lang,
    });
  } catch (error) {
    if (error instanceof TargetError) {
      const detail =
        lang === 'ru' && error.message
          ? error.message
          : errorText(lang, error.code || 'invalid_target');
      process.stderr.write(`${t(lang, 'cli.targetError', { message: detail })}\n`);
      return 2;
    }
    const detail = lang === 'ru' && error && error.message ? error.message : errorText(lang, 'fetch_failed');
    process.stderr.write(`${t(lang, 'cli.checkError', { message: detail })}\n`);
    return 2;
  }

  if (args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else process.stdout.write(`${formatHuman(report, lang)}\n`);

  if (report.error) return 2;
  return EXIT_CODES[report.summary.status] ?? 2;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

module.exports = { main, parseArgs, formatHuman, usage, EXIT_CODES, FIXED_BY_BRANCH };
