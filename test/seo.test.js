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
const { makeSandbox, runBuild, removeSandbox } = require('./helpers/build-pages');

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
