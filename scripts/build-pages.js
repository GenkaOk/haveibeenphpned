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
 *   4. добавляет JSON-LD (`WebApplication`, `Organization`, `FAQPage`,
 *      `HowTo`, `BreadcrumbList`) в `<head>` каждой страницы; вопросы и шаги
 *      берутся из тех же строк `i18n.js`, что и видимый текст, поэтому
 *      разметка не расходится с контентом;
 *   5. генерирует `sitemap.xml` (три URL, hreflang-альтернативы, `lastmod`);
 *   6. генерирует `og-image.png` 1200×630 без внешних зависимостей;
 *   7. создаёт `docs/.nojekyll` — отключает Jekyll целиком (иначе GitHub
 *      пытается собрать SCSS и падает без `assets/css/style.scss`);
 *   8. пишет `docs/config.js` со значением `API_BASE` из окружения.
 *
 * Запуск: `npm run build:pages` (`API_BASE` и `SITE_URL` необязательны).
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { render: renderOgImage } = require('./og-image');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'public');
const target = path.join(root, 'docs');

const I18N = require(path.join(source, 'i18n.js'));
const FIX_I18N = require(path.join(source, 'fix-i18n.js'));

const SITE_URL = (process.env.SITE_URL || 'https://haveibeenphpned.github.io').replace(/\/+$/, '');
const RELEASE_DATE = '2026-10-21';
const UPDATED_DATE = '2026-10-23';

const HOME_PAGES = [
  { kind: 'home', lang: 'ru', dir: '', sitePath: '/', locale: 'ru_RU' },
  { kind: 'home', lang: 'en', dir: 'en', sitePath: '/en/', locale: 'en_US' },
  { kind: 'home', lang: 'fr', dir: 'fr', sitePath: '/fr/', locale: 'fr_FR' },
];

const FIX_PAGES = [
  { kind: 'fix', lang: 'ru', dir: 'fix', sitePath: '/fix/', locale: 'ru_RU' },
  { kind: 'fix', lang: 'en', dir: 'en/fix', sitePath: '/en/fix/', locale: 'en_US' },
  { kind: 'fix', lang: 'fr', dir: 'fr/fix', sitePath: '/fr/fix/', locale: 'fr_FR' },
];

const HOME_ALTERNATES = [
  ['ru', SITE_URL + '/'],
  ['en', SITE_URL + '/en/'],
  ['fr', SITE_URL + '/fr/'],
  ['x-default', SITE_URL + '/'],
];

const FIX_ALTERNATES = [
  ['ru', SITE_URL + '/fix/'],
  ['en', SITE_URL + '/en/fix/'],
  ['fr', SITE_URL + '/fr/fix/'],
  ['x-default', SITE_URL + '/fix/'],
];

for (const page of [...HOME_PAGES, ...FIX_PAGES]) {
  if (page.kind === 'fix') {
    page.titleKey = 'meta.fixTitle';
    page.descriptionKey = 'meta.fixDescription';
    page.alternates = FIX_ALTERNATES;
  } else {
    page.titleKey = 'meta.title';
    page.descriptionKey = 'meta.description';
    page.alternates = HOME_ALTERNATES;
  }
}

const PAGES = HOME_PAGES;

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function fail(message) {
  console.error('build:pages: ' + message);
  process.exit(1);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function text(lang, key) {
  const vars = {
    date: I18N.formatDate(RELEASE_DATE, lang, { dateStyle: 'long' }),
    updated: I18N.formatDate(UPDATED_DATE, lang, { dateStyle: 'long' }),
  };
  const fixTable = FIX_I18N[lang] || {};
  if (Object.prototype.hasOwnProperty.call(fixTable, key)) {
    return I18N.format(fixTable[key], vars);
  }
  return I18N.t(lang, key, vars);
}

/** Есть ли ключ в одном из двух словарей: общем или страницы решения. */
function hasText(lang, key) {
  return (
    Object.prototype.hasOwnProperty.call(I18N.DICTS[lang] || {}, key) ||
    Object.prototype.hasOwnProperty.call(FIX_I18N[lang] || {}, key)
  );
}

/** Текст без HTML-тегов — для JSON-LD и текстовых файлов. */
function plain(value) {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Вопросы FAQ из словаря: видимый текст и JSON-LD берут одни и те же ключи. */
function faqItems(lang, prefix = 'ui.faq') {
  const items = [];
  for (let index = 1; ; index += 1) {
    if (!hasText(lang, `${prefix}.q${index}`)) break;
    items.push({
      question: plain(text(lang, `${prefix}.q${index}`)),
      answer: plain(text(lang, `${prefix}.a${index}`)),
    });
  }
  return items;
}

/** Шаги проверки из `ui.how.N` — те же строки, что видны в блоке «Как мы проверяем». */
function howSteps(lang) {
  const steps = [];
  for (let index = 1; ; index += 1) {
    if (!(`ui.how.${index}` in I18N.DICTS[lang])) break;
    steps.push(plain(text(lang, `ui.how.${index}`)));
  }
  return steps;
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
  const title = escapeHtml(text(page.lang, page.titleKey));
  const description = escapeHtml(text(page.lang, page.descriptionKey));
  const canonical = SITE_URL + page.sitePath;
  const image = SITE_URL + '/og-image.png';
  const alternates = HOME_PAGES.filter((other) => other.lang !== page.lang);

  const lines = [
    `<link rel="canonical" href="${canonical}">`,
    ...page.alternates.map(
      ([hreflang, href]) => `<link rel="alternate" hreflang="${hreflang}" href="${href}">`,
    ),
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

/** JSON-LD главной: приложение, организация, FAQ, HowTo, хлебные крошки. */
function homeJsonLd(page) {
  const canonical = SITE_URL + page.sitePath;
  const organizationId = SITE_URL + '/#organization';
  const description = plain(text(page.lang, page.descriptionKey));

  const breadcrumbs = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'PHP2Shell',
      item: SITE_URL + '/',
    },
  ];
  if (page.dir) {
    breadcrumbs.push({
      '@type': 'ListItem',
      position: 2,
      name: plain(text(page.lang, 'ui.crumb.page')),
      item: canonical,
    });
  }

  const graph = [
    {
      '@type': 'WebApplication',
      '@id': canonical + '#app',
      name: 'PHP2Shell',
      url: canonical,
      description,
      applicationCategory: 'SecurityApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript',
      isAccessibleForFree: true,
      inLanguage: page.lang,
      dateModified: UPDATED_DATE,
      image: SITE_URL + '/og-image.png',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@id': organizationId },
    },
    {
      '@type': 'Organization',
      '@id': organizationId,
      name: 'PHP2Shell',
      url: SITE_URL + '/',
      logo: { '@type': 'ImageObject', url: SITE_URL + '/og-image.png' },
      sameAs: ['https://github.com/GenkaOk/haveibeenphpned'],
    },
    {
      '@type': 'FAQPage',
      '@id': canonical + '#faq',
      inLanguage: page.lang,
      mainEntity: faqItems(page.lang).map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
    {
      '@type': 'HowTo',
      '@id': canonical + '#howto',
      name: plain(text(page.lang, 'ui.how.title')),
      description,
      inLanguage: page.lang,
      step: howSteps(page.lang).map((step, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: step,
        text: step,
      })),
    },
    {
      '@type': 'BreadcrumbList',
      '@id': canonical + '#breadcrumb',
      itemListElement: breadcrumbs,
    },
  ];

  // `\u003c` защищает от преждевременного закрытия <script>.
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

/**
 * JSON-LD страницы решения: WebPage, организация, FAQPage и хлебные крошки.
 * FAQ берётся из `fix.faq.qN/aN` — тех же строк, что видны на странице.
 */
function fixJsonLd(page) {
  const canonical = SITE_URL + page.sitePath;
  const organizationId = SITE_URL + '/#organization';
  const title = plain(text(page.lang, page.titleKey));
  const description = plain(text(page.lang, page.descriptionKey));

  const graph = [
    {
      '@type': 'Organization',
      '@id': organizationId,
      name: 'PHP2Shell',
      url: SITE_URL + '/',
      logo: { '@type': 'ImageObject', url: SITE_URL + '/og-image.png' },
      sameAs: ['https://github.com/GenkaOk/haveibeenphpned'],
    },
    {
      '@type': 'WebPage',
      '@id': canonical + '#page',
      url: canonical,
      name: title,
      description,
      inLanguage: page.lang,
      dateModified: UPDATED_DATE,
      publisher: { '@id': organizationId },
    },
    {
      '@type': 'FAQPage',
      '@id': canonical + '#faq',
      inLanguage: page.lang,
      mainEntity: faqItems(page.lang, 'fix.faq').map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
    {
      '@type': 'BreadcrumbList',
      '@id': canonical + '#breadcrumb',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'PHP2Shell',
          item: SITE_URL + '/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: plain(text(page.lang, 'fix.crumb.current')),
          item: canonical,
        },
      ],
    },
  ];

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

function jsonLd(page) {
  return page.kind === 'fix' ? fixJsonLd(page) : homeJsonLd(page);
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

/**
 * Дата последнего изменения по ISO: `SOURCE_DATE_EPOCH` → дата коммита →
 * дата обновления контента (когда сборка идёт вне git-репозитория).
 */
function lastModifiedDate() {
  const epoch = (process.env.SOURCE_DATE_EPOCH || '').trim();
  if (/^\d+$/.test(epoch)) {
    return new Date(Number(epoch) * 1000).toISOString().slice(0, 10);
  }
  try {
    const out = execFileSync('git', ['-C', root, 'log', '-1', '--format=%cs'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(out)) return out;
  } catch {
    // Не git-репозиторий (например, песочница теста) — берём дату контента.
  }
  return UPDATED_DATE;
}

/** sitemap.xml: главная и /fix/, у каждого URL свой hreflang-набор и lastmod. */
function sitemapXml() {
  const lastmod = lastModifiedDate();
  const urls = [...HOME_PAGES, ...FIX_PAGES]
    .map((page) => {
      const loc = escapeXml(SITE_URL + page.sitePath);
      const links = page.alternates
        .map(
          ([hreflang, href]) =>
            `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(href)}"/>`,
        )
        .join('\n');
      const priority = page.kind === 'fix' ? '0.9' : page.dir ? '0.8' : '1.0';
      return [
        '  <url>',
        `    <loc>${loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        '    <changefreq>weekly</changefreq>',
        `    <priority>${priority}</priority>`,
        links,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    urls,
    '</urlset>',
    '',
  ].join('\n');
}

/** Рендерит HTML одной языковой страницы из общего шаблона public/index.html. */
function renderPage(template, page) {
  let html = template;

  html = html.replace(/<html\b[^>]*>/, `<html lang="${page.lang}" data-prerendered="true" data-site-lang="${page.lang}">`);

  const title = escapeHtml(text(page.lang, page.titleKey));
  const description = escapeHtml(text(page.lang, page.descriptionKey));
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

  // CTA на страницу решения. Ставим href после переписывания `./`: из /en/
  // ссылка `./fix/` ведёт на /en/fix/, а не на корневую /fix/.
  html = html.replace(
    /<a([^>]*\sdata-fix-link[^>]*)>/g,
    (match, attributes) =>
      `<a${attributes.replace(/\shref="[^"]*"/, '')} href="./fix/">`,
  );

  // JSON-LD — последним в <head>: разметка описывает уже готовый видимый текст.
  html = html.replace(
    '</head>',
    `  <script type="application/ld+json">${jsonLd(page)}</script>\n</head>`,
  );

  return html;
}

/** Относительная ссылка между двумя каталогами страниц (`en/fix` → `../fr/fix/`). */
function relativePageHref(fromDir, toDir) {
  const relative = path.posix.relative(fromDir, toDir);
  return relative ? relative + '/' : './';
}

/** Рендерит статическую страницу решения из public/fix.html. */
function renderFixPage(template, page) {
  let html = template;

  html = html.replace(
    /<html\b[^>]*>/,
    `<html lang="${page.lang}" data-prerendered="true" data-site-lang="${page.lang}">`,
  );

  const title = escapeHtml(text(page.lang, page.titleKey));
  const description = escapeHtml(text(page.lang, page.descriptionKey));
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

  html = html.replace(
    /(<meta name="color-scheme" content="light">)/,
    `$1\n  ${metaBlock(page)}`,
  );

  // /fix/ лежит на один уровень глубже корня, /en/fix/ и /fr/fix/ — на два.
  const prefix = '../'.repeat(page.dir.split('/').length);
  html = html.replace(
    /(\s(?:src|href))="\.\/([^"]+)"/g,
    (match, attribute, value) => `${attribute}="${prefix}${value}"`,
  );

  // Ссылки на главную языковой версии: из /fix/, /en/fix/ и /fr/fix/ это `../`.
  html = html.replace(
    /<a([^>]*\sdata-fix-home[^>]*)>/g,
    (match, attributes) => `<a${attributes} href="../">`,
  );

  // Переключатель языка: статические ссылки между тремя страницами решения.
  for (const target of FIX_PAGES) {
    const href = relativePageHref(page.dir, target.dir);
    const current = target.lang === page.lang ? ' aria-current="page"' : '';
    html = html.replace(
      new RegExp(`<a([^>]*\\sdata-fix-lang="${target.lang}"[^>]*)>`),
      (match, attributes) => `<a${attributes} href="${href}"${current}>`,
    );
  }

  html = html.replace(
    '</head>',
    `  <script type="application/ld+json">${jsonLd(page)}</script>\n</head>`,
  );

  return html;
}

if (!fs.existsSync(path.join(source, 'index.html'))) {
  fail('нет public/index.html — нечего публиковать');
}

const template = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
const fixTemplate = fs.readFileSync(path.join(source, 'fix.html'), 'utf8');
const ogImage = renderOgImage();

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, {
  recursive: true,
  // Шаблоны и словарь страницы решения — исходники, а не публичные файлы.
  filter: (from) => {
    if (path.dirname(from) !== source) return true;
    return !['index.html', 'fix.html', 'fix-i18n.js'].includes(path.basename(from));
  },
});
fs.writeFileSync(path.join(target, '.nojekyll'), '');
fs.writeFileSync(path.join(target, 'og-image.png'), ogImage);

// sitemap.xml генерируется и в public/ (его отдаёт `npm start`/Render),
// и в docs/ (GitHub Pages). Содержимое одинаковое — тест deploy это проверяет.
const sitemap = sitemapXml();
fs.writeFileSync(path.join(target, 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(source, 'sitemap.xml'), sitemap);

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

for (const page of FIX_PAGES) {
  const html = renderFixPage(fixTemplate, page);
  const dir = path.join(target, page.dir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);

  // Статическая копия нужна и локальному `npm start`, и Render: они отдают public/.
  const publicDir = path.join(source, page.dir);
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'index.html'), html);
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
  'fix/index.html',
  'en/fix/index.html',
  'fr/fix/index.html',
  'og-image.png',
  'config.js',
  'app.js',
  'i18n.js',
  'styles.css',
  '.nojekyll',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'llms-full.txt',
]) {
  if (!fs.existsSync(path.join(target, required))) {
    fail('после сборки нет docs/' + required);
  }
}

console.log(
  'build:pages: docs/ готова — 3 главные (/ , /en/, /fr/) и 3 страницы решения (/fix/, /en/fix/, /fr/fix/) с JSON-LD, sitemap.xml, og-image.png; API_BASE ' +
    (base ? '= ' + base : 'пуст — same-origin'),
);
