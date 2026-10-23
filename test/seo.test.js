'use strict';

/**
 * SEO-контракт статических страниц: три языка, meta/canonical/hreflang/OG,
 * осмысленный текст без JS и картинка 1200×630.
 *
 * Сборка идёт в песочнице `tmp/`, рабочий `docs/` не трогается.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const I18N = require('../public/i18n.js');
const { ROOT, makeSandbox, runBuild, removeSandbox } = require('./helpers/build-pages');

const PUBLIC = path.join(ROOT, 'public');
const SOURCE_DATE_EPOCH = '1761264000'; // 2025-10-24, фиксированный lastmod в тестах

const SITE_URL = 'https://haveibeenphpned.github.io';
const PAGES = [
  { lang: 'ru', file: 'index.html', sitePath: '/' },
  { lang: 'en', file: 'en/index.html', sitePath: '/en/' },
  { lang: 'fr', file: 'fr/index.html', sitePath: '/fr/' },
];

function readPage(dir, page) {
  return fs.readFileSync(path.join(dir, 'docs', page.file), 'utf8');
}

function metaContent(html, attribute, value) {
  const pattern = new RegExp(`<meta ${attribute}="${value}" content="([^"]*)">`, 'i');
  const match = pattern.exec(html);
  return match ? match[1] : null;
}

function property(html, name) {
  return metaContent(html, 'property', name);
}

function sha(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function jsonLd(html) {
  const match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(match, 'на странице нет JSON-LD');
  return JSON.parse(match[1].replace(/\\u003c/g, '<'));
}

function graph(html) {
  const data = jsonLd(html);
  assert.equal(data['@context'], 'https://schema.org');
  return data['@graph'];
}

function nodeOf(html, type) {
  const found = graph(html).filter((node) => node['@type'] === type);
  assert.equal(found.length, 1, `ожидался ровно один ${type}`);
  return found[0];
}

function visible(html, tag, key) {
  const pattern = new RegExp(`<${tag}[^>]*data-i18n="${key}"[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
  return [...html.matchAll(pattern)].map((match) => match[1].trim());
}

/** Минимальная проверка well-formedness: теги сбалансированы, амперсанды экранированы. */
function assertWellFormedXml(xml) {
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n/);
  assert.doesNotMatch(xml.replace(/&(?:amp|lt|gt|quot|apos|#\d+);/g, ''), /&/, 'неэкранированный &');
  const stack = [];
  for (const match of xml.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g)) {
    const [, closing, name, , selfClosing] = match;
    if (selfClosing) continue;
    if (closing) {
      assert.equal(stack.pop(), name, `несбалансированный тег </${name}>`);
    } else {
      stack.push(name);
    }
  }
  assert.deepEqual(stack, [], 'остались незакрытые теги');
}

test('i18n: title ≤ 60 символов, description 140–160 символов во всех языках', () => {
  for (const lang of ['ru', 'en', 'fr']) {
    const title = I18N.DICTS[lang]['meta.title'];
    const description = I18N.DICTS[lang]['meta.description'];
    assert.ok([...title].length <= 60, `${lang}: title длиннее 60 символов (${[...title].length})`);
    assert.ok([...title].length > 20, `${lang}: title слишком короткий`);
    assert.ok(
      [...description].length >= 140 && [...description].length <= 160,
      `${lang}: description вне 140–160 символов (${[...description].length})`,
    );
  }
  const titles = new Set(['ru', 'en', 'fr'].map((lang) => I18N.DICTS[lang]['meta.title']));
  assert.equal(titles.size, 3, 'title должен быть уникальным для каждого языка');
});

test('build:pages: три страницы с полным SEO-набором и статическим текстом', () => {
  const dir = makeSandbox();
  try {
    runBuild(dir, { API_BASE: 'https://haveapi.example', SITE_URL: undefined });

    for (const page of PAGES) {
      const html = readPage(dir, page);
      const title = I18N.DICTS[page.lang]['meta.title'];
      const description = I18N.DICTS[page.lang]['meta.description'];
      const canonical = SITE_URL + page.sitePath;

      assert.match(html, new RegExp(`<html[^>]+lang="${page.lang}"`), `${page.file}: нет lang`);
      assert.match(html, /<html[^>]+data-prerendered="true"/, `${page.file}: нет data-prerendered`);
      assert.match(html, new RegExp(`<title>${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</title>`));
      assert.equal(metaContent(html, 'name', 'description'), description);
      assert.equal(metaContent(html, 'name', 'robots'), 'index,follow');
      assert.equal(metaContent(html, 'name', 'theme-color'), '#1c4ed8');

      const canonicalTag = new RegExp(`<link rel="canonical" href="${canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">`);
      assert.match(html, canonicalTag, `${page.file}: canonical`);

      for (const [lang, href] of [
        ['ru', `${SITE_URL}/`],
        ['en', `${SITE_URL}/en/`],
        ['fr', `${SITE_URL}/fr/`],
        ['x-default', `${SITE_URL}/`],
      ]) {
        assert.ok(
          html.includes(`<link rel="alternate" hreflang="${lang}" href="${href}">`),
          `${page.file}: нет hreflang ${lang}`,
        );
      }

      assert.equal(property(html, 'og:type'), 'website');
      assert.equal(property(html, 'og:site_name'), 'PHP2Shell');
      assert.equal(property(html, 'og:title'), title);
      assert.equal(property(html, 'og:description'), description);
      assert.equal(property(html, 'og:url'), canonical);
      assert.equal(property(html, 'og:image'), `${SITE_URL}/og-image.png`);
      assert.equal(property(html, 'og:image:width'), '1200');
      assert.equal(property(html, 'og:image:height'), '630');
      assert.equal(metaContent(html, 'name', 'twitter:card'), 'summary_large_image');
      assert.ok(['ru_RU', 'en_US', 'fr_FR'].includes(property(html, 'og:locale')));
      assert.equal((html.match(/og:locale:alternate/g) || []).length, 2);

      // Ровно один h1, осмысленный текст и никаких незаполненных плейсхолдеров.
      assert.equal((html.match(/<h1\b/g) || []).length, 1, `${page.file}: должен быть один h1`);
      assert.ok((html.match(/<h2\b/g) || []).length >= 4, `${page.file}: мало h2`);
      assert.doesNotMatch(html, /\{[a-zA-Z]+\}/, `${page.file}: остался незаполненный плейсхолдер`);
      assert.doesNotMatch(
        html,
        /<([a-z0-9]+)[^>]*data-i18n(?:-html)?="[^"]+"[^>]*>\s*<\/\1>/i,
        `${page.file}: пустой элемент с data-i18n`,
      );

      const body = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      assert.ok(body.length > 1500, `${page.file}: слишком мало статического текста (${body.length})`);
      assert.ok(body.includes(I18N.DICTS[page.lang]['ui.hero.title']), `${page.file}: нет h1-текста`);
      assert.ok(body.includes(I18N.DICTS[page.lang]['ui.faq.q1']), `${page.file}: нет FAQ`);

      // Относительные пути: страницы в подкаталоге поднимаются на уровень выше.
      const prefix = page.lang === 'ru' ? './' : '../';
      assert.ok(html.includes(`src="${prefix}app.js"`), `${page.file}: неверный путь к app.js`);
      assert.ok(html.includes(`href="${prefix}styles.css"`), `${page.file}: неверный путь к styles.css`);
      assert.doesNotMatch(html, /(?:src|href)="\/(?!\/)/, `${page.file}: абсолютный локальный путь`);
    }
  } finally {
    removeSandbox(dir);
  }
});

test('og-image.png: настоящий PNG 1200×630, генерируется детерминированно', () => {
  const dir = makeSandbox();
  try {
    runBuild(dir, { API_BASE: 'https://haveapi.example', SITE_URL: undefined });
    const imagePath = path.join(dir, 'docs', 'og-image.png');
    const image = fs.readFileSync(imagePath);

    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'нет сигнатуры PNG');
    assert.equal(image.subarray(12, 16).toString('ascii'), 'IHDR');
    assert.equal(image.readUInt32BE(16), 1200);
    assert.equal(image.readUInt32BE(20), 630);
    assert.equal(image[24], 8, 'ожидается 8 бит на канал');
    assert.equal(image[25], 2, 'ожидается truecolor PNG');
    assert.ok(image.length > 5000, 'картинка подозрительно маленькая');

    const first = sha(image);
    runBuild(dir, { API_BASE: 'https://haveapi.example', SITE_URL: undefined });
    assert.equal(sha(fs.readFileSync(imagePath)), first, 'og-image.png не детерминирована');
  } finally {
    removeSandbox(dir);
  }
});

test('build:pages: повторная сборка даёт тот же HTML', () => {
  const dir = makeSandbox();
  try {
    runBuild(dir, { API_BASE: 'https://haveapi.example', SITE_URL: undefined });
    const before = PAGES.map((page) => sha(Buffer.from(readPage(dir, page))));

    runBuild(dir, { API_BASE: 'https://haveapi.example', SITE_URL: undefined });
    const after = PAGES.map((page) => sha(Buffer.from(readPage(dir, page))));

    assert.deepEqual(after, before, 'HTML страниц должен быть воспроизводимым');
  } finally {
    removeSandbox(dir);
  }
});

test('robots.txt: обычные и AI-краулеры разрешены, sitemap указан', () => {
  const robots = fs.readFileSync(path.join(PUBLIC, 'robots.txt'), 'utf8');
  const agents = [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Claude-User',
    'PerplexityBot',
    'Google-Extended',
    'CCBot',
    'Bingbot',
    'Applebot-Extended',
  ];
  for (const agent of agents) {
    assert.match(
      robots,
      new RegExp(`User-agent: ${agent}\\nAllow: /`),
      `robots.txt не разрешает ${agent}`,
    );
  }
  assert.match(robots, /^User-agent: \*\nAllow: \/$/m, 'robots.txt не разрешает обычные краулеры');
  assert.match(
    robots,
    /^Sitemap: https:\/\/haveibeenphpned\.github\.io\/sitemap\.xml$/m,
    'robots.txt не указывает sitemap',
  );
});

test('sitemap.xml: три URL, hreflang-альтернативы, lastmod, валидный XML', () => {
  const dir = makeSandbox();
  try {
    const out = runBuild(dir, {
      API_BASE: 'https://haveapi.example',
      SITE_URL: undefined,
      SOURCE_DATE_EPOCH,
    });
    assert.match(out, /sitemap\.xml/);

    const docsXml = fs.readFileSync(path.join(dir, 'docs', 'sitemap.xml'), 'utf8');
    const publicXml = fs.readFileSync(path.join(dir, 'public', 'sitemap.xml'), 'utf8');
    assert.equal(publicXml, docsXml, 'public/ и docs/ должны получать одинаковый sitemap');

    assert.match(docsXml, /<urlset\b[^>]*xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
    assert.match(docsXml, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
    assertWellFormedXml(docsXml);

    const locs = [...docsXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    assert.deepEqual(locs, [`${SITE_URL}/`, `${SITE_URL}/en/`, `${SITE_URL}/fr/`]);
    assert.equal((docsXml.match(/<url>/g) || []).length, 3);
    assert.equal((docsXml.match(/<xhtml:link /g) || []).length, 12, 'по 4 альтернативы на URL');

    const lastmod = new Date(Number(SOURCE_DATE_EPOCH) * 1000).toISOString().slice(0, 10);
    assert.equal((docsXml.match(new RegExp(`<lastmod>${lastmod}</lastmod>`, 'g')) || []).length, 3);

    for (const [hreflang, href] of [
      ['ru', `${SITE_URL}/`],
      ['en', `${SITE_URL}/en/`],
      ['fr', `${SITE_URL}/fr/`],
      ['x-default', `${SITE_URL}/`],
    ]) {
      assert.ok(docsXml.includes(`hreflang="${hreflang}" href="${href}"`), `нет hreflang ${hreflang}`);
    }
  } finally {
    removeSandbox(dir);
  }
});

test('build:pages: robots.txt, sitemap.xml, llms.txt и llms-full.txt попадают в docs/', () => {
  const dir = makeSandbox();
  try {
    runBuild(dir, { API_BASE: undefined, SITE_URL: undefined });
    for (const file of ['robots.txt', 'sitemap.xml', 'llms.txt', 'llms-full.txt']) {
      assert.ok(fs.existsSync(path.join(dir, 'docs', file)), `в docs/ нет ${file}`);
      assert.ok(fs.existsSync(path.join(dir, 'public', file)), `в public/ нет ${file}`);
    }
  } finally {
    removeSandbox(dir);
  }
});

test('llms.txt: заголовок, сводка, 5–8 ссылок и ключевые факты', () => {
  const short = fs.readFileSync(path.join(PUBLIC, 'llms.txt'), 'utf8');
  assert.match(short, /^# PHP2Shell$/m);
  assert.match(short, /^> .+\S/m, 'нет строки-описания в формате llmstxt.org');

  const links = [...short.matchAll(/\]\((https?:\/\/[^)]+)\)/g)];
  assert.ok(links.length >= 5 && links.length <= 8, `ссылок ${links.length}, нужно 5–8`);

  for (const fact of ['CVE-2026-109618', 'CVE-2026-109619', '8.5.12', '8.4.27', '8.3.36', '8.2.35']) {
    assert.ok(short.includes(fact), `llms.txt: нет ${fact}`);
  }
  assert.match(short, /passive/i);
  assert.match(short, /free/i);
});

test('llms-full.txt: механика проверки, вердикты, API, ограничения и источники', () => {
  const full = fs.readFileSync(path.join(PUBLIC, 'llms-full.txt'), 'utf8');
  for (const source of ['GHSA-w8hw-w9fx-j79w', 'GHSA-6wmf-4rv5-p3rp', 'isc.sans.edu/diary/33440']) {
    assert.ok(full.includes(source), `llms-full.txt: нет источника ${source}`);
  }
  for (const verdict of ['likely_vulnerable', 'not_vulnerable', 'not_applicable', 'unknown']) {
    assert.ok(full.includes(verdict), `llms-full.txt: нет вердикта ${verdict}`);
  }
  assert.match(full, /POST \/api\/check/);
  assert.match(full, /GET \/api\/health/);
  assert.match(full, /8\.1, 8\.0, 7\.x, 5\.x/, 'нет списка веток без фиксов');
  assert.match(full, /How to cite/i);
});

test('JSON-LD: WebApplication, Organization, FAQPage, HowTo, BreadcrumbList на трёх страницах', () => {
  const dir = makeSandbox();
  try {
    runBuild(dir, { API_BASE: 'https://haveapi.example', SITE_URL: undefined });

    for (const page of PAGES) {
      const html = readPage(dir, page);
      const canonical = SITE_URL + page.sitePath;
      const types = graph(html).map((node) => node['@type']);
      assert.deepEqual(types, [
        'WebApplication',
        'Organization',
        'FAQPage',
        'HowTo',
        'BreadcrumbList',
      ], `${page.file}: неполный JSON-LD`);

      const app = nodeOf(html, 'WebApplication');
      assert.equal(app.name, 'PHP2Shell');
      assert.equal(app.url, canonical);
      assert.equal(app.applicationCategory, 'SecurityApplication');
      assert.equal(app.isAccessibleForFree, true);
      assert.equal(app.inLanguage, page.lang);
      assert.equal(app.offers['@type'], 'Offer');
      assert.equal(app.offers.price, '0');
      assert.equal(app.dateModified, '2026-10-23');

      const org = nodeOf(html, 'Organization');
      assert.equal(org.name, 'PHP2Shell');
      assert.equal(org['@id'], `${SITE_URL}/#organization`);

      // Вопросы FAQ в разметке совпадают с видимыми на странице.
      const faq = nodeOf(html, 'FAQPage');
      const visibleQuestions = visible(html, 'h3', 'ui\\.faq\\.q\\d+');
      assert.equal(visibleQuestions.length, 10, `${page.file}: должно быть 10 вопросов FAQ`);
      assert.equal(faq.mainEntity.length, visibleQuestions.length, `${page.file}: FAQPage ≠ видимый FAQ`);
      faq.mainEntity.forEach((item, index) => {
        assert.equal(item['@type'], 'Question');
        assert.equal(item.name, visibleQuestions[index], `${page.file}: вопрос ${index + 1} расходится`);
        assert.ok(item.acceptedAnswer.text.length > 20, `${page.file}: пустой ответ ${index + 1}`);
      });

      const howTo = nodeOf(html, 'HowTo');
      assert.equal(howTo.step.length, visible(html, 'li', 'ui\\.how\\.\\d+').length);
      assert.equal(howTo.step.length, 4);
      howTo.step.forEach((step, index) => {
        assert.equal(step['@type'], 'HowToStep');
        assert.equal(step.position, index + 1);
      });

      const crumbs = nodeOf(html, 'BreadcrumbList');
      assert.ok(crumbs.itemListElement.length >= 1);
      assert.equal(crumbs.itemListElement[0].position, 1);
      assert.equal(crumbs.itemListElement[0].item, `${SITE_URL}/`);
      if (page.lang !== 'ru') {
        assert.equal(crumbs.itemListElement.length, 2);
        assert.equal(crumbs.itemListElement[1].item, canonical);
      }
    }
  } finally {
    removeSandbox(dir);
  }
});

test('контент для цитирования: таблица веток, первоисточники и дата обновления', () => {
  const dir = makeSandbox();
  try {
    runBuild(dir, { API_BASE: 'https://haveapi.example', SITE_URL: undefined });

    for (const page of PAGES) {
      const html = readPage(dir, page);

      const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
        .map((match) => match[1])
        .filter((row) => row.includes('<code>'));
      assert.equal(rows.length, 5, `${page.file}: в таблице должно быть 5 строк веток`);

      for (const version of ['8.5.12', '8.4.27', '8.3.36', '8.2.35']) {
        assert.ok(html.includes(`<code>${version}</code>`), `${page.file}: нет версии ${version}`);
      }

      for (const source of [
        'https://github.com/advisories/GHSA-w8hw-w9fx-j79w',
        'https://github.com/advisories/GHSA-6wmf-4rv5-p3rp',
        'https://isc.sans.edu/diary/33440',
      ]) {
        assert.ok(html.includes(`href="${source}"`), `${page.file}: нет ссылки ${source}`);
      }

      assert.ok(
        visible(html, 'p', 'ui\\.footer\\.updated').length === 1,
        `${page.file}: нет даты обновления`,
      );
      assert.ok(
        /Обновлено|Updated|Mis à jour/.test(html),
        `${page.file}: дата обновления не отрендерена`,
      );
    }
  } finally {
    removeSandbox(dir);
  }
});
