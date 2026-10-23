'use strict';

/**
 * Генерирует `docs/` — опубликованную копию `public/` для GitHub Pages.
 *
 * Источник правды — `public/`. `docs/` руками не правят: Settings → Pages
 * в этом репозитории настроены на «Deploy from a branch → /docs», поэтому
 * Pages отдаёт именно эту папку.
 *
 * Что делает скрипт:
 *   1. очищает `docs/`;
 *   2. копирует туда ресурсы из `public/` (без index.html);
 *   3. рендерит три статические страницы из `public/index.html` и строк
 *      `public/i18n.js`: `/` (ru, x-default), `/en/`, `/fr/`. Текст, title,
 *      description, canonical, hreflang, Open Graph и Twitter попадают в HTML
 *      до JS, поэтому краулер видит осмысленную страницу;
 *   4. генерирует `og-image.png` 1200×630 без внешних зависимостей;
 *   5. создаёт `docs/.nojekyll` — отключает Jekyll целиком (иначе GitHub
 *      пытается собрать SCSS и падает без `assets/css/style.scss`);
 *   6. пишет `docs/config.js` со значением `API_BASE` из окружения.
 *
 * Запуск: `npm run build:pages` (`API_BASE` и `SITE_URL` необязательны).
 */

const fs = require('node:fs');
const path = require('node:path');

const { render: renderOgImage } = require('./og-image');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'public');
const target = path.join(root, 'docs');

const I18N = require(path.join(source, 'i18n.js'));

const SITE_URL = (process.env.SITE_URL || 'https://haveibeenphpned.github.io').replace(/\/+$/, '');
const RELEASE_DATE = '2026-10-21';

const PAGES = [
  { lang: 'ru', dir: '', sitePath: '/', locale: 'ru_RU' },
  { lang: 'en', dir: 'en', sitePath: '/en/', locale: 'en_US' },
  { lang: 'fr', dir: 'fr', sitePath: '/fr/', locale: 'fr_FR' },
];

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function fail(message) {
  console.error('build:pages: ' + message);
  process.exit(1);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function text(lang, key) {
  return I18N.t(lang, key, {
    date: I18N.formatDate(RELEASE_DATE, lang, { dateStyle: 'long' }),
  });
}

/** Подставляет текст в элементы с data-i18n / data-i18n-html. */
function fillElements(html, lang, attribute, allowHtml) {
  const pattern = new RegExp(
    `<([a-zA-Z][a-zA-Z0-9]*)([^>]*\\s${attribute}="([^"]+)"[^>]*)>([\\s\\S]*?)<\\/\\1>`,
    'g',
  );
  return html.replace(pattern, (match, tag, attributes, key, inner) => {
    const value = text(lang, key);
    return `<${tag}${attributes}>${allowHtml ? value : escapeHtml(value)}</${tag}>`;
  });
}

/** Подставляет значения в placeholder / aria-label / title по ключу из data-i18n-*. */
function fillAttributes(html, lang, marker, attribute) {
  const pattern = new RegExp(`<([a-zA-Z][a-zA-Z0-9]*)([^>]*?)\\s${marker}="([^"]+)"([^>]*)>`, 'g');
  return html.replace(pattern, (match, tag, before, key, after) => {
    return `<${tag}${before} ${attribute}="${escapeHtml(text(lang, key))}" ${marker}="${key}"${after}>`;
  });
}

function metaBlock(page) {
  const title = escapeHtml(text(page.lang, 'meta.title'));
  const description = escapeHtml(text(page.lang, 'meta.description'));
  const canonical = SITE_URL + page.sitePath;
  const image = SITE_URL + '/og-image.png';
  const alternates = PAGES.filter((other) => other.lang !== page.lang);

  const lines = [
    `<link rel="canonical" href="${canonical}">`,
    `<link rel="alternate" hreflang="ru" href="${SITE_URL}/">`,
    `<link rel="alternate" hreflang="en" href="${SITE_URL}/en/">`,
    `<link rel="alternate" hreflang="fr" href="${SITE_URL}/fr/">`,
    `<link rel="alternate" hreflang="x-default" href="${SITE_URL}/">`,
    '<meta name="robots" content="index,follow">',
    '<meta name="theme-color" content="#1c4ed8">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="PHP2Shell">',
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:locale" content="${page.locale}">`,
    ...alternates.map(
      (other) => `<meta property="og:locale:alternate" content="${other.locale}">`,
    ),
    `<meta property="og:image" content="${image}">`,
    '<meta property="og:image:type" content="image/png">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${title}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${image}">`,
  ];

  return lines.join('\n  ');
}

/** Рендерит HTML одной языковой страницы из общего шаблона public/index.html. */
function renderPage(template, page) {
  let html = template;

  html = html.replace(/<html\b[^>]*>/, `<html lang="${page.lang}" data-prerendered="true" data-site-lang="${page.lang}">`);

  const title = escapeHtml(text(page.lang, 'meta.title'));
  const description = escapeHtml(text(page.lang, 'meta.description'));
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
  html = html.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${description}">`,
  );

  html = fillElements(html, page.lang, 'data-i18n', false);
  html = fillElements(html, page.lang, 'data-i18n-html', true);
  html = fillAttributes(html, page.lang, 'data-i18n-placeholder', 'placeholder');
  html = fillAttributes(html, page.lang, 'data-i18n-aria-label', 'aria-label');
  html = fillAttributes(html, page.lang, 'data-i18n-title', 'title');

  // SEO-блок — сразу после color-scheme, до стилей.
  html = html.replace(
    /(<meta name="color-scheme" content="light">)/,
    `$1\n  ${metaBlock(page)}`,
  );

  // `/en/` и `/fr/` живут в подкаталоге: относительные ссылки на ресурсы
  // должны подняться на уровень выше. Абсолютные пути ломают project pages.
  if (page.dir) {
    html = html.replace(/(\s(?:src|href))="\.\/([^"]+)"/g, '$1="../$2"');
  }

  return html;
}

if (!fs.existsSync(path.join(source, 'index.html'))) {
  fail('нет public/index.html — нечего публиковать');
}

const template = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
const ogImage = renderOgImage();

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, {
  recursive: true,
  filter: (from) => path.basename(from) !== 'index.html' || path.dirname(from) !== source,
});
fs.writeFileSync(path.join(target, '.nojekyll'), '');
fs.writeFileSync(path.join(target, 'og-image.png'), ogImage);

// Держим public/og-image.png в репозитории как исходник: тесты и локальный
// сервер не должны зависеть от запущенной сборки.
const publicOg = path.join(source, 'og-image.png');
if (!fs.existsSync(publicOg) || !fs.readFileSync(publicOg).equals(ogImage)) {
  fs.writeFileSync(publicOg, ogImage);
}

for (const page of PAGES) {
  const html = renderPage(template, page);
  const dir = page.dir ? path.join(target, page.dir) : target;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);

  // Локальный `npm start` и Render отдают public/, поэтому языковые копии
  // нужны и там. Корневой public/index.html остаётся шаблоном: его наполняет
  // app.js, а статический текст для краулеров живёт в docs/.
  if (page.dir) {
    const publicDir = path.join(source, page.dir);
    fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(path.join(publicDir, 'index.html'), html);
  }
}

const base = (process.env.API_BASE || '').trim();
const config =
  "'use strict';\n\n" +
  '// Generated by `npm run build:pages` (scripts/build-pages.js) from public/config.js.\n' +
  '// Do not edit by hand: change API_BASE and re-run the script.\n' +
  'window.__PHP2SHELL_API__ = ' + JSON.stringify(base) + ';\n';
fs.writeFileSync(path.join(target, 'config.js'), config);

for (const required of [
  'index.html',
  'en/index.html',
  'fr/index.html',
  'og-image.png',
  'config.js',
  'app.js',
  'i18n.js',
  'styles.css',
  '.nojekyll',
]) {
  if (!fs.existsSync(path.join(target, required))) {
    fail('после сборки нет docs/' + required);
  }
}

console.log(
  'build:pages: docs/ готова — 3 страницы (/ , /en/, /fr/), og-image.png; API_BASE ' +
    (base ? '= ' + base : 'пуст — same-origin'),
);
