'use strict';

/**
 * Виральность без самодисклоуза: нейтральный чеклист и ссылка на решение.
 *
 * Проверяем:
 *   - тексты «Предупредить команду» и блока «У меня старый PHP» на ru/en/fr;
 *   - отсутствие копирования фактов/версий и приёма цели проверки из URL;
 *   - отсутствие вердикта в meta/OG/JSON-LD сгенерированных страниц;
 *   - нейтральный бейдж и контент-артефакты (статья, одностраничник, launch kit, UTM).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const I18N = require('../public/i18n.js');
const { ROOT, makeSandbox, runBuild, removeSandbox } = require('./helpers/build-pages');

const PUBLIC = path.join(ROOT, 'public');
const INDEX = path.join(PUBLIC, 'index.html');
const APP = path.join(PUBLIC, 'app.js');
const CSS = path.join(PUBLIC, 'styles.css');
const CONTENT = [path.join(ROOT, 'tmp', 'content-drafts'), path.join(ROOT, 'content')].find((dir) =>
  fs.existsSync(dir)
);

const LANGS = ['ru', 'en', 'fr'];
const SITE = 'https://haveibeenphpned.github.io/';
const FIXED = ['8.2.35', '8.3.36', '8.4.27', '8.5.12'];
const BRANCHES = ['8.2', '8.3', '8.4', '8.5', '8.1', '8.0', '7.x', '5.x'];

test('i18n: чеклист предупреждения на ru/en/fr содержит ветки, фиксы и ссылку', () => {
  const texts = new Set();
  for (const lang of LANGS) {
    const text = I18N.t(lang, 'ui.warn.text');
    texts.add(text);
    for (const branch of BRANCHES) {
      assert.ok(text.includes(branch), `${lang}: в чеклисте нет ветки ${branch}`);
    }
    for (const version of FIXED) {
      assert.ok(text.includes(version), `${lang}: в чеклисте нет версии ${version}`);
    }
    assert.ok(text.includes(SITE), `${lang}: в чеклисте нет ссылки на инструмент`);
    assert.match(text, /utm_source=warning/, `${lang}: нет UTM у ссылки предупреждения`);
    assert.doesNotMatch(text, /\{(?:target|url|domain|version|verdict|status)\}/i);
    assert.doesNotMatch(text, /example\.com/i);
    assert.doesNotMatch(
      text,
      /your server is vulnerable|votre serveur est vulnérable|ваш сервер уязвим/i,
      `${lang}: чеклист не должен утверждать что-то о сервере пользователя`,
    );
  }
  assert.equal(texts.size, 3, 'чеклист должен отличаться для каждого языка');
});

test('i18n: ссылка на страницу решения и бейдж есть на всех языках', () => {
  for (const lang of LANGS) {
    for (const key of ['ui.decision.title', 'ui.decision.intro', 'ui.decision.link', 'ui.decision.aria']) {
      assert.ok(I18N.DICTS[lang][key], `${lang}: нет ключа ${key}`);
    }
    assert.ok(I18N.DICTS[lang]['ui.badge.copy']);
    assert.ok(I18N.DICTS[lang]['ui.privacy.note']);

    // Механика «поделиться фактами» удалена вместе со строками (GHO-142).
    const leftovers = Object.keys(I18N.DICTS[lang]).filter((key) => key.startsWith('ui.facts'));
    assert.deepEqual(leftovers, [], `${lang}: остались строки ${leftovers.join(', ')}`);
  }
});

test('index.html: кнопка предупреждения, ссылка на решение и нейтральный бейдж', () => {
  const html = fs.readFileSync(INDEX, 'utf8');

  assert.match(html, /id="warn-team"/);
  assert.match(html, /data-i18n="ui\.actions\.warn"/);
  assert.match(html, /data-i18n-aria-label="ui\.actions\.warnAria"/);

  assert.match(html, /id="decision"/);
  assert.match(html, /data-i18n="ui\.decision\.link"/);
  assert.match(html, /data-i18n-aria-label="ui\.decision\.aria"/);
  assert.match(html, /<a[^>]*\shref="\.\/fix\/"[^>]*\sdata-fix-link/);
  // Копирование таблицы версий и фактов убрано.
  assert.doesNotMatch(html, /data-copy-fact/);
  assert.doesNotMatch(html, /ui\.facts\./);

  assert.match(html, /class="php2shell-badge">Checked with PHP2Shell</);
  assert.match(
    html,
    /class="badge-markdown">\[Checked with PHP2Shell\]\(https:\/\/haveibeenphpned\.github\.io\/\)</,
  );
  assert.match(html, /id="copy-badge"/);

  for (const id of ['warn-status', 'badge-status']) {
    assert.match(html, new RegExp(`id="${id}"[^>]*role="status"`), `нет статуса ${id}`);
  }
});

test('index.html: нет ссылки «поделиться результатом» и приёма цели из query', () => {
  const html = fs.readFileSync(INDEX, 'utf8');
  assert.doesNotMatch(html, /id="copy-link"/);
  assert.doesNotMatch(html, /ui\.actions\.copy/);
  assert.doesNotMatch(html, /\?url=/);
  assert.doesNotMatch(html, /id="copy-status"/);
});

test('app.js: результат не пишется в URL, историю и заголовок страницы', () => {
  const source = fs.readFileSync(APP, 'utf8');

  assert.doesNotMatch(source, /shareUrl|copyShareLink/);
  assert.doesNotMatch(source, /params\.set\('url'/);
  assert.doesNotMatch(source, /(?:lastTarget|payload|report)[^;]{0,120}history\.replaceState/i);
  assert.doesNotMatch(source, /history\.replaceState\([^;]*(?:target|payload|report)/i);
  assert.doesNotMatch(source, /document\.title\s*=/);
  assert.doesNotMatch(source, /navigator\.sendBeacon/);
  assert.doesNotMatch(source, /params\.get\('url'\)/);

  // Язык по-прежнему можно менять через query — это не данные проверки.
  assert.match(source, /params\.get\('lang'\)/);
  assert.match(source, /history\.replaceState/);

  // Один сетевой запрос — только к своему API проверки.
  assert.equal((source.match(/\bfetch\(/g) || []).length, 1);
  assert.match(source, /apiUrl\('\/api\/check'\)/);

  // Новые механики на месте.
  assert.match(source, /ui\.warn\.text/);
  assert.match(source, /data-fix-link/);
  assert.match(source, /badge-markdown/);
  // Копирования фактов и таблицы версий больше нет.
  assert.doesNotMatch(source, /data-copy-fact|ui\.facts\./);
});

test('app.js и index.html: нет live-счётчика проверок', () => {
  const sources = [APP, INDEX].map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(sources, /totalChecks|scanCount|checksToday|liveCounter|scans-counter/i);
});

test('build:pages: вердикт не попадает в title, meta, OG и JSON-LD', () => {
  const dir = makeSandbox();
  try {
    runBuild(dir, { API_BASE: 'https://haveapi.example', SITE_URL: undefined });
    const files = ['index.html', 'en/index.html', 'fr/index.html'];

    for (const file of files) {
      const html = fs.readFileSync(path.join(dir, 'docs', file), 'utf8');
      assert.doesNotMatch(html, /\?url=/);
      assert.doesNotMatch(html, /utm_source/);
      assert.doesNotMatch(html, /history\.replaceState/);

      const title = /<title>([\s\S]*?)<\/title>/.exec(html)[1];
      assert.doesNotMatch(title, /vulnerable|уязвим|подвержен/i, `${file}: вердикт в title`);

      // Проверяем именно исходящие meta/OG-поля, а не обучающий текст FAQ в JSON-LD:
      // слово «уязвим» в описании CVE — это не персональный вердикт.
      const metas = [...html.matchAll(/<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"/g)];
      for (const [, name, value] of metas) {
        assert.doesNotMatch(value, /vulnerable|уязвим|подвержен/i, `${file}: вердикт в ${name}`);
        assert.doesNotMatch(value, /utm_/, `${file}: UTM в ${name}`);
        assert.doesNotMatch(value, /https?:\/\/[^"]*\?url=/, `${file}: цель проверки в ${name}`);
      }

      const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1];
      assert.doesNotMatch(ld, /"target"|"verdict"|"phpVersion"/, `${file}: данные проверки в JSON-LD`);
    }
  } finally {
    removeSandbox(dir);
  }
});

test('CSS: мобильная раскладка, видимый фокус и aria-стили для новых блоков', () => {
  const css = fs.readFileSync(CSS, 'utf8');
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.decision-band/);
  assert.match(css, /\.warn-band/);
  assert.match(css, /\.badge-box/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.decision-action \.fix-cta\s*\{[^}]*width: 100%/);
  assert.doesNotMatch(css, /\.fact-/);
  assert.match(css, /\.btn--quiet/);
});

test('черновики контента: статья, одностраничник, launch kit и UTM готовы', (t) => {
  if (!CONTENT) {
    t.skip('черновики хранятся локально в tmp/content-drafts (GHO-139)');
    return;
  }
  const files = [
    'README.md',
    'article-ru.md',
    'article-en.md',
    'one-pager-ru.md',
    'one-pager-en.md',
    'launch-kit.md',
    'utm.md',
  ];
  for (const file of files) {
    const full = path.join(CONTENT, file);
    assert.ok(fs.existsSync(full), `нет content/${file}`);
    assert.ok(fs.statSync(full).size > 500, `content/${file} подозрительно мал`);
  }

  const ru = fs.readFileSync(path.join(CONTENT, 'article-ru.md'), 'utf8');
  const en = fs.readFileSync(path.join(CONTENT, 'article-en.md'), 'utf8');
  for (const text of [ru, en]) {
    for (const version of FIXED) assert.ok(text.includes(version), `в статье нет ${version}`);
    for (const cve of ['CVE-2026-109618', 'CVE-2026-109619']) {
      assert.ok(text.includes(cve), `в статье нет ${cve}`);
    }
  }
  assert.match(ru, /Habr/);
  assert.match(ru, /Плохая идея|не публикуйте|Не публикуйте|не делиться|не делитесь/i);

  const onePager = fs.readFileSync(path.join(CONTENT, 'one-pager-ru.md'), 'utf8');
  assert.match(onePager, /php2shell за 60 секунд/i);
  assert.match(onePager, /php -v/);

  const kit = fs.readFileSync(path.join(CONTENT, 'launch-kit.md'), 'utf8');
  const blocks = [...kit.matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1].trim());
  assert.ok(blocks.length >= 8, `в launch kit ${blocks.length} текстов, нужно 8+`);
  for (const channel of ['Hacker News', 'r/sysadmin', 'r/PHP', 'r/webdev', 'X / Twitter', 'Telegram']) {
    assert.ok(kit.includes(channel), `в launch kit нет канала ${channel}`);
  }

  const utm = fs.readFileSync(path.join(CONTENT, 'utm.md'), 'utf8');
  for (const source of [
    'hn',
    'reddit-sysadmin',
    'reddit-php',
    'reddit-webdev',
    'x',
    'telegram-channel',
    'telegram-chat',
    'linkedin',
    'habr',
  ]) {
    assert.ok(utm.includes(`utm_source=${source}`), `в UTM-таблице нет ${source}`);
  }
  assert.match(utm, /utm_campaign=php2shell_launch/);
  assert.match(utm, /не добавлять UTM в canonical/i);
});
