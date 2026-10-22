'use strict';

/**
 * Проверки статической страницы: разметка, офлайн-ресурсы, отдача через npm start.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { createApp } = require('../src/server');

const PUBLIC = path.join(__dirname, '..', 'public');
const INDEX = path.join(PUBLIC, 'index.html');
const CSS = path.join(PUBLIC, 'styles.css');
const APP = path.join(PUBLIC, 'app.js');
const I18N_FILE = path.join(PUBLIC, 'i18n.js');
const CONFIG = path.join(PUBLIC, 'config.js');

async function startApp(options = {}) {
  const server = createApp({ log: () => {}, ...options });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('public/: пять файлов на месте', () => {
  for (const file of [INDEX, CSS, APP, I18N_FILE, CONFIG]) {
    assert.ok(fs.existsSync(file), `нет файла ${path.relative(path.join(__dirname, '..'), file)}`);
  }
});

test('index.html: язык, viewport и контрактные id', () => {
  const html = fs.readFileSync(INDEX, 'utf8');
  assert.match(html, /<html[^>]+lang="en"/i);
  assert.match(html, /<meta[^>]+name="viewport"/i);
  assert.match(html, /<title>[^<]*PHP2Shell/i);

  // Статичные элементы разметки.
  const ids = [
    'check-form',
    'target-url',
    'consent',
    'check-button',
    'form-error',
    'result',
    'result-actions',
    'copy-link',
    'check-again',
  ];
  for (const id of ids) {
    assert.match(html, new RegExp(`id="${id}"`), `в index.html нет id="${id}"`);
  }

  // Элементы, которые рендерит app.js в состоянии результата.
  const appSource = fs.readFileSync(APP, 'utf8');
  for (const id of ['result-status', 'result-meta', 'cve-list', 'php-info', 'recommendations', 'mitigations']) {
    assert.match(appSource, new RegExp(`id = '${id}'|id="${id}"`), `app.js не создаёт #${id}`);
  }

  // label должен быть связан с полем ввода
  assert.match(html, /<label[^>]+for="target-url"/i);
  // aria-live обязателен для результата
  assert.match(html, /aria-live=/i);
});

test('index.html и styles.css не тянут внешние ресурсы', () => {
  const html = fs.readFileSync(INDEX, 'utf8');
  const css = fs.readFileSync(CSS, 'utf8');

  assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//i);
  assert.doesNotMatch(html, /<link[^>]+href="https?:\/\//i);
  assert.doesNotMatch(html, /<img[^>]+src="https?:\/\//i);
  assert.doesNotMatch(css, /@import\s+url\(\s*["']?https?:/i);
  assert.doesNotMatch(css, /url\(\s*["']?https?:/i);
});

test('app.js: синтаксис, без alert() и без глобального fetch на чужой origin', () => {
  const source = fs.readFileSync(APP, 'utf8');
  assert.doesNotThrow(() => execFileSync(process.execPath, ['--check', APP], { stdio: 'pipe' }));
  assert.doesNotMatch(source, /\balert\s*\(/);
  assert.match(source, /\/api\/check/);
});

test('npm start-сервер отдаёт страницу и ассеты', async () => {
  const app = await startApp();
  try {
    const page = await fetch(`${app.url}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    const html = await page.text();
    assert.match(html, /data-i18n="ui.form.submit"/);
    assert.match(html, /src="\.\/i18n\.js"/);

    const i18n = await fetch(`${app.url}/i18n.js`);
    assert.equal(i18n.status, 200);
    assert.match(i18n.headers.get('content-type'), /javascript/);
    assert.match(await i18n.text(), /ui\.form\.submit/);

    const css = await fetch(`${app.url}/styles.css`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type'), /text\/css/);

    const js = await fetch(`${app.url}/app.js`);
    assert.equal(js.status, 200);
    assert.match(js.headers.get('content-type'), /javascript/);

    const config = await fetch(`${app.url}/config.js`);
    assert.equal(config.status, 200);
    assert.match(config.headers.get('content-type'), /javascript/);
    assert.match(await config.text(), /__PHP2SHELL_API__/);
  } finally {
    await app.close();
  }
});

test('config.js: пустой адрес API = same-origin', () => {
  const source = fs.readFileSync(CONFIG, 'utf8');
  assert.doesNotThrow(() => execFileSync(process.execPath, ['--check', CONFIG], { stdio: 'pipe' }));
  assert.match(source, /window\.__PHP2SHELL_API__\s*=\s*''\s*;/);
});

test('index.html: config.js раньше i18n.js и app.js, пути относительные', () => {
  const html = fs.readFileSync(INDEX, 'utf8');
  const configAt = html.indexOf('src="./config.js"');
  const i18nAt = html.indexOf('src="./i18n.js"');
  const appAt = html.indexOf('src="./app.js"');

  assert.ok(configAt > 0, 'index.html не подключает ./config.js');
  assert.ok(i18nAt > configAt, 'config.js должен идти до i18n.js');
  assert.ok(appAt > i18nAt, 'app.js должен идти после i18n.js');
  // Проектный GitHub Pages живёт в подкаталоге: абсолютные пути ломаются.
  assert.doesNotMatch(html, /(?:src|href)="\/(?!\/)/, 'в index.html остались абсолютные пути');
});

test('app.js: приоритет ?api= → __PHP2SHELL_API__ → same-origin', () => {
  const source = fs.readFileSync(APP, 'utf8');
  assert.match(source, /window\.__PHP2SHELL_API__/);
  assert.match(source, /params\.get\('api'\)/);
  assert.match(source, /apiUrl\('\/api\/check'\)/);
  // при заданном base — base + path, при пустом — чистый путь
  assert.match(source, /base \? `\$\{base\}\$\{path\}` : path/);
  assert.match(source, /github\.io/);
  assert.match(source, /ui\.api\.notConfigured/);
});

test('i18n: ключ ui.api.notConfigured есть в ru, en и fr', () => {
  const i18n = require(I18N_FILE);
  for (const lang of ['ru', 'en', 'fr']) {
    assert.ok(i18n.dict(lang)['ui.api.notConfigured'], `нет ключа ui.api.notConfigured для ${lang}`);
  }
});
