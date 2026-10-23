'use strict';

/**
 * Страницы решения /fix/, /en/fix/, /fr/fix/:
 *   - собираются статически без JS;
 *   - имеют уникальные title/description, canonical и hreflang;
 *   - содержат проверенные факты про Sury и ссылки на первоисточники;
 *   - FAQPage JSON-LD совпадает с видимыми вопросами;
 *   - с главной и из результата проверки есть переход на /fix/.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const I18N = require('../public/i18n.js');
const FIX = require('../public/fix-i18n.js');
const { ROOT, makeSandbox, runBuild, removeSandbox } = require('./helpers/build-pages');

const PUBLIC = path.join(ROOT, 'public');
const APP = path.join(PUBLIC, 'app.js');
const SITE_URL = 'https://haveibeenphpned.github.io';

const PAGES = [
  { lang: 'ru', file: 'fix/index.html', sitePath: '/fix/' },
  { lang: 'en', file: 'en/fix/index.html', sitePath: '/en/fix/' },
  { lang: 'fr', file: 'fr/fix/index.html', sitePath: '/fr/fix/' },
];

function readPage(dir, page) {
  return fs.readFileSync(path.join(dir, 'docs', page.file), 'utf8');
}

function metaContent(html, attribute, value) {
  const pattern = new RegExp(`<meta ${attribute}="${value}" content="([^"]*)">`, 'i');
  const match = pattern.exec(html);
  return match ? match[1] : null;
}

function graph(html) {
  const match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(match, 'нет JSON-LD');
  return JSON.parse(match[1].replace(/\\u003c/g, '<'))['@graph'];
}

function visible(html, tag, key) {
  const pattern = new RegExp(`<${tag}[^>]*data-i18n="${key}"[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
  return [...html.matchAll(pattern)].map((match) => match[1].trim());
}

test('fix i18n: title ≤ 60, description 140–160, 10 вопросов во всех языках', () => {
  for (const lang of ['ru', 'en', 'fr']) {
    const title = FIX[lang]['meta.fixTitle'];
    const description = FIX[lang]['meta.fixDescription'];
    assert.ok([...title].length <= 60, `${lang}: title длиннее 60 символов`);
    assert.ok([...title].length > 20, `${lang}: title слишком короткий`);
    assert.ok(
      [...description].length >= 140 && [...description].length <= 160,
      `${lang}: description вне 140–160 символов (${[...description].length})`,
    );

    for (let index = 1; index <= 10; index += 1) {
      assert.ok(FIX[lang][`fix.faq.q${index}`], `${lang}: нет fix.faq.q${index}`);
      assert.ok(FIX[lang][`fix.faq.a${index}`], `${lang}: нет fix.faq.a${index}`);
    }
    assert.equal(FIX[lang]['fix.faq.q11'], undefined, `${lang}: FAQ должен заканчиваться на q10`);
  }

  const titles = new Set(['ru', 'en', 'fr'].map((lang) => FIX[lang]['meta.fixTitle']));
  assert.equal(titles.size, 3, 'title страницы решения должен быть уникальным');
});

test('build:pages: три статические страницы решения с SEO и без JS', () => {
  const dir = makeSandbox();
  try {
    runBuild(dir, { API_BASE: undefined, SITE_URL: undefined });

    for (const page of PAGES) {
      const html = readPage(dir, page);
      const title = FIX[page.lang]['meta.fixTitle'];
      const description = FIX[page.lang]['meta.fixDescription'];
      const canonical = SITE_URL + page.sitePath;

      assert.match(html, new RegExp(`<html[^>]+lang="${page.lang}"`), `${page.file}: нет lang`);
      assert.match(html, /<html[^>]+data-prerendered="true"/, `${page.file}: нет data-prerendered`);
      assert.ok(html.includes(`<title>${title}</title>`), `${page.file}: неверный title`);
      assert.equal(metaContent(html, 'name', 'description'), description);
      assert.equal(metaContent(html, 'name', 'robots'), 'index,follow');
      assert.ok(
        html.includes(`<link rel="canonical" href="${canonical}">`),
        `${page.file}: canonical`,
      );

      for (const [hreflang, href] of [
        ['ru', `${SITE_URL}/fix/`],
        ['en', `${SITE_URL}/en/fix/`],
        ['fr', `${SITE_URL}/fr/fix/`],
        ['x-default', `${SITE_URL}/fix/`],
      ]) {
        assert.ok(
          html.includes(`<link rel="alternate" hreflang="${hreflang}" href="${href}">`),
          `${page.file}: нет hreflang ${hreflang}`,
        );
      }

      assert.equal(metaContent(html, 'property', 'og:url'), canonical);
      assert.equal(metaContent(html, 'property', 'og:title'), title);
      assert.equal(metaContent(html, 'property', 'og:description'), description);
      assert.equal(metaContent(html, 'name', 'twitter:card'), 'summary_large_image');

      // Страница статическая: исполняемых скриптов нет, только JSON-LD.
      assert.doesNotMatch(html, /<script\s+src=/i, `${page.file}: подключён внешний JS`);
      assert.doesNotMatch(html, /app\.js|i18n\.js|config\.js/, `${page.file}: лишний скрипт`);

      assert.equal((html.match(/<h1\b/g) || []).length, 1, `${page.file}: должен быть один h1`);
      assert.ok((html.match(/<h2\b/g) || []).length >= 6, `${page.file}: мало h2`);
      assert.doesNotMatch(html, /\{[a-zA-Z]+\}/, `${page.file}: остался плейсхолдер`);

      const body = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      assert.ok(body.length > 3000, `${page.file}: слишком мало статического текста`);
      assert.ok(body.includes(FIX[page.lang]['fix.title']), `${page.file}: нет h1`);
      assert.ok(body.includes('deb.sury.org'), `${page.file}: нет упоминания Sury`);
      assert.ok(body.includes(FIX[page.lang]['fix.faq.q1']), `${page.file}: нет FAQ`);

      // Проверенные факты и команды.
      for (const fact of [
        '8.5.12',
        '8.4.27',
        '8.3.36',
        '8.2.35',
        '8.1.34-9',
        '7.4.33-31',
        '8.0.30-25',
      ]) {
        assert.ok(html.includes(fact), `${page.file}: нет версии ${fact}`);
      }
      assert.ok(html.includes('apt-get install --only-upgrade'), `${page.file}: нет apt install`);
      assert.ok(html.includes('php -v'), `${page.file}: нет проверки php -v`);
      assert.ok(html.includes("dpkg -l | grep '^ii  php8.1'"), `${page.file}: нет dpkg`);

      for (const source of [
        'https://security-tracker.debian.org/tracker/CVE-2026-109618',
        'https://security-tracker.debian.org/tracker/CVE-2026-109619',
        'https://ubuntu.com/security/notices/USN-8948-1',
        'https://packages.sury.org/php/README.txt',
        'php8.1_8.1.34-9+0~20261021.82+debian12~1.gbp4e430a.debian.tar.xz',
      ]) {
        assert.ok(html.includes(source), `${page.file}: нет ссылки ${source}`);
      }

      const depth = page.sitePath.split('/').filter(Boolean).length;
      const cssHref = 'href="' + '../'.repeat(depth) + 'styles.css"';
      assert.ok(html.includes(cssHref), `${page.file}: неверный styles.css (${cssHref})`);
      assert.doesNotMatch(html, /(?:src|href)="\/(?!\/)/, `${page.file}: абсолютный локальный путь`);
    }
  } finally {
    removeSandbox(dir);
  }
});

test('fix: каждая версия в таблице Sury ссылается на свой debian/changelog', () => {
  const dir = makeSandbox();
  try {
    runBuild(dir, { API_BASE: undefined, SITE_URL: undefined });

    const changelogs = {
      '8.5.12-1': 'php8.5/php8.5_8.5.12-1+0~20261021.27+debian12~1.gbp1a3e8a.debian.tar.xz',
      '8.4.27-1': 'php8.4/php8.4_8.4.27-1+0~20261021.57+debian12~1.gbp7636b9.debian.tar.xz',
      '8.3.36-1': 'php8.3/php8.3_8.3.36-1+0~20261021.88+debian12~1.gbp250f7c.debian.tar.xz',
      '8.2.35-1': 'php8.2/php8.2_8.2.35-1+0~20261021.94+debian12~1.gbp8bff78.debian.tar.xz',
      '8.1.34-9': 'php8.1/php8.1_8.1.34-9+0~20261021.82+debian12~1.gbp4e430a.debian.tar.xz',
      '8.0.30-25': 'php8.0/php8.0_8.0.30-25+0~20261021.88+debian12~1.gbpabebea.debian.tar.xz',
      '7.4.33-31': 'php7.4/php7.4_7.4.33-31+0~20261021.121+debian12~1.gbpe9c428.debian.tar.xz',
      '7.3.33-35': 'php7.3/php7.3_7.3.33-35+0~20261021.144+debian12~1.gbpecf76f.debian.tar.xz',
      '7.2.34-66': 'php7.2/php7.2_7.2.34-66+0~20261021.122+debian12~1.gbpe0bcd4.debian.tar.xz',
      '7.1.33-81': 'php7.1/php7.1_7.1.33-81+0~20261022.128+debian12~1.gbpa88ccf.debian.tar.xz',
      '7.0.33-93': 'php7.0/php7.0_7.0.33-93+0~20261022.119+debian12~1.gbp952195.debian.tar.xz',
      '5.6.40-105': 'php5.6/php5.6_5.6.40-105+0~20261022.135+debian12~1.gbp37a17e.debian.tar.xz',
    };

    for (const page of PAGES) {
      const html = readPage(dir, page);
      for (const [version, file] of Object.entries(changelogs)) {
        const link =
          `<a href="https://packages.sury.org/php/pool/main/p/${file}" rel="noopener">` +
          `${version}</a>`;
        assert.ok(html.includes(link), `${page.file}: ${version} без ссылки на changelog`);
      }
      const total = (html.match(/packages\.sury\.org\/php\/pool\/main/g) || []).length;
      assert.ok(total >= 12, `${page.file}: ссылок на changelog ${total}, ожидалось ≥ 12`);
    }
  } finally {
    removeSandbox(dir);
  }
});

test('fix JSON-LD: WebPage, Organization, FAQPage и BreadcrumbList', () => {
  const dir = makeSandbox();
  try {
    runBuild(dir, { API_BASE: undefined, SITE_URL: undefined });

    for (const page of PAGES) {
      const html = readPage(dir, page);
      const canonical = SITE_URL + page.sitePath;
      const nodes = graph(html);
      assert.deepEqual(
        nodes.map((node) => node['@type']),
        ['Organization', 'WebPage', 'FAQPage', 'BreadcrumbList'],
        `${page.file}: неполный JSON-LD`,
      );

      const webPage = nodes.find((node) => node['@type'] === 'WebPage');
      assert.equal(webPage.url, canonical);
      assert.equal(webPage.inLanguage, page.lang);
      assert.equal(webPage.dateModified, '2026-10-23');

      const faq = nodes.find((node) => node['@type'] === 'FAQPage');
      const visibleQuestions = visible(html, 'h3', 'fix\\.faq\\.q\\d+');
      assert.equal(visibleQuestions.length, 10, `${page.file}: должно быть 10 вопросов`);
      assert.equal(faq.mainEntity.length, visibleQuestions.length);
      faq.mainEntity.forEach((item, index) => {
        assert.equal(item['@type'], 'Question');
        assert.equal(item.name, visibleQuestions[index], `${page.file}: вопрос ${index + 1}`);
        assert.ok(item.acceptedAnswer.text.length > 30, `${page.file}: пустой ответ`);
        // Первый абзац ответа — прямой ответ: без вводных «это зависит».
        assert.doesNotMatch(item.acceptedAnswer.text, /^(it depends|cela dépend|зависит)/i);
      });

      const crumbs = nodes.find((node) => node['@type'] === 'BreadcrumbList');
      assert.equal(crumbs.itemListElement.length, 2);
      assert.equal(crumbs.itemListElement[0].item, `${SITE_URL}/`);
      assert.equal(crumbs.itemListElement[1].item, canonical);
    }
  } finally {
    removeSandbox(dir);
  }
});

test('главная ведёт на /fix/ на всех языках; результат проверки — на страницу решения', () => {
  const dir = makeSandbox();
  try {
    runBuild(dir, { API_BASE: undefined, SITE_URL: undefined });

    for (const lang of ['ru', 'en', 'fr']) {
      const file = lang === 'ru' ? 'docs/index.html' : `docs/${lang}/index.html`;
      const html = fs.readFileSync(path.join(dir, file), 'utf8');
      assert.match(html, /class="fix-cta"/, `${lang}: нет CTA на /fix/`);
      assert.ok(html.includes('href="./fix/"'), `${lang}: неверный href CTA`);
      assert.ok(html.includes(I18N.DICTS[lang]['ui.fixCta']), `${lang}: нет текста CTA`);
    }

    const app = fs.readFileSync(APP, 'utf8');
    assert.match(app, /function renderFixHint/);
    assert.match(app, /status !== 'vulnerable' && status !== 'likely_vulnerable'/);
    assert.match(app, /ui\.result\.fixCta/);
    assert.ok(app.includes('(?:en|fr)'), 'ссылка должна учитывать /en/ и /fr/');
    assert.ok(app.includes("return './fix/';"), 'нужна относительная ссылка на ./fix/');
  } finally {
    removeSandbox(dir);
  }
});
