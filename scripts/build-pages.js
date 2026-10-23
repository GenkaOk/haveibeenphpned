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

const SITE_URL = (process.env.SITE_URL || 'https://haveibeenphpned.github.io').replace(/\/+$/, '');
const RELEASE_DATE = '2026-10-21';
const UPDATED_DATE = '2026-10-23';

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
    updated: I18N.formatDate(UPDATED_DATE, lang, { dateStyle: 'long' }),
  });
}

/** Текст без HTML-тегов — для JSON-LD и текстовых файлов. */
function plain(value) {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Вопросы FAQ из словаря: видимый текст и JSON-LD берут одни и те же ключи. */
function faqItems(lang) {
  const items = [];
  for (let index = 1; ; index += 1) {
    if (!(`ui.faq.q${index}` in I18N.DICTS[lang])) break;
    items.push({
      question: plain(text(lang, `ui.faq.q${index}`)),
      answer: plain(text(lang, `ui.faq.a${index}`)),
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

/** JSON-LD одной страницы: одно приложение, организация, FAQ, HowTo, хлебные крошки. */
function jsonLd(page) {
  const canonical = SITE_URL + page.sitePath;
  const organizationId = SITE_URL + '/#organization';
  const description = plain(text(page.lang, 'meta.description'));

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

/** sitemap.xml: три URL, self-referencing hreflang-альтернативы и lastmod. */
function sitemapXml() {
  const lastmod = lastModifiedDate();
  const alternates = [
    ['ru', SITE_URL + '/'],
    ['en', SITE_URL + '/en/'],
    ['fr', SITE_URL + '/fr/'],
    ['x-default', SITE_URL + '/'],
  ];
  const links = alternates
    .map(
      ([hreflang, href]) =>
        `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(href)}"/>`,
    )
    .join('\n');

  const urls = PAGES.map((page) => {
    const loc = escapeXml(SITE_URL + page.sitePath);
    return [
      '  <url>',
      `    <loc>${loc}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      '    <changefreq>weekly</changefreq>',
      `    <priority>${page.dir ? '0.8' : '1.0'}</priority>`,
      links,
      '  </url>',
    ].join('\n');
  }).join('\n');

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

  // JSON-LD — последним в <head>: разметка описывает уже готовый видимый текст.
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
const ogImage = renderOgImage();

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, {
  recursive: true,
  filter: (from) => path.basename(from) !== 'index.html' || path.dirname(from) !== source,
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
  'build:pages: docs/ готова — 3 страницы (/ , /en/, /fr/) с JSON-LD, sitemap.xml, og-image.png; API_BASE ' +
    (base ? '= ' + base : 'пуст — same-origin'),
);
