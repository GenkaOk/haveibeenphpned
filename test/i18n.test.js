'use strict';

/**
 * Локализация: полнота словарей, выбор языка и применение к разметке.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const I18N = require('../public/i18n.js');

const PUBLIC = path.join(__dirname, '..', 'public');
const INDEX = path.join(PUBLIC, 'index.html');
const APP = path.join(PUBLIC, 'app.js');

const CYRILLIC = /[\u0400-\u04FF]/;

/** Убирает комментарии, чтобы проверять только исполняемый код. */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}

/** Минимальная заглушка Document для applyStatic(). */
function fakeDoc(entries) {
  const nodes = entries.map(([attribute, key]) => ({
    attribute,
    key,
    textContent: '',
    innerHTML: '',
    attrs: {},
    getAttribute(name) {
      return name === attribute ? key : null;
    },
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
  }));
  const meta = {
    attrs: {},
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
  };
  const html = {
    attrs: {},
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
  };
  return {
    title: '',
    documentElement: html,
    nodes,
    meta,
    querySelectorAll(selector) {
      if (selector === '[data-i18n]') return nodes.filter((n) => n.attribute === 'data-i18n');
      if (selector === '[data-i18n-html]') return nodes.filter((n) => n.attribute === 'data-i18n-html');
      if (selector === '[data-i18n-placeholder]') return nodes.filter((n) => n.attribute === 'data-i18n-placeholder');
      if (selector === '[data-i18n-aria-label]') return nodes.filter((n) => n.attribute === 'data-i18n-aria-label');
      return [];
    },
    querySelector(selector) {
      return selector === 'meta[name="description"]' ? meta : null;
    },
  };
}

test('словари ru/en/fr: одинаковый набор ключей и непустые значения', () => {
  const languages = Object.keys(I18N.DICTS);
  assert.deepEqual(languages.sort(), ['en', 'fr', 'ru']);

  const reference = Object.keys(I18N.DICTS.ru).sort();
  assert.ok(reference.length > 100, `слишком мало ключей: ${reference.length}`);

  for (const lang of languages) {
    const keys = Object.keys(I18N.DICTS[lang]).sort();
    assert.deepEqual(keys, reference, `набор ключей ${lang} расходится с ru`);
    for (const key of keys) {
      const value = I18N.DICTS[lang][key];
      assert.equal(typeof value, 'string', `${lang}.${key} должен быть строкой`);
      assert.ok(value.trim().length > 0, `${lang}.${key} пустой`);
    }
  }
});

test('словари en/fr без кириллицы, ru — с кириллицей', () => {
  for (const lang of ['en', 'fr']) {
    for (const [key, value] of Object.entries(I18N.DICTS[lang])) {
      assert.ok(!CYRILLIC.test(value), `${lang}.${key} содержит кириллицу: ${value}`);
    }
  }
  const russian = Object.values(I18N.DICTS.ru).filter((value) => CYRILLIC.test(value));
  assert.ok(russian.length > 100, 'в русском словаре должно быть много кириллических строк');
});

test('подстановка {placeholder} во всех языках', () => {
  for (const lang of ['ru', 'en', 'fr']) {
    const line = I18N.t(lang, 'server.reason.belowFix', {
      version: '8.4.26',
      fix: '8.4.27',
      branch: '8.4',
    });
    assert.match(line, /8\.4\.26/);
    assert.match(line, /8\.4\.27/);
    assert.doesNotMatch(line, /\{[a-zA-Z]+\}/, `незаполненный плейсхолдер: ${line}`);
  }
  assert.equal(I18N.t('en', 'missing.key'), 'missing.key');
});

test('выбор языка: query → localStorage → navigator → en', () => {
  assert.equal(I18N.normalizeLang('ru-RU'), 'ru');
  assert.equal(I18N.normalizeLang('FR'), 'fr');
  assert.equal(I18N.normalizeLang('de-DE'), null);
  assert.equal(I18N.normalizeLang(undefined), null);

  assert.equal(I18N.detectLang({ queryLang: 'fr', storedLang: 'ru', navigatorLang: 'en' }), 'fr');
  assert.equal(I18N.detectLang({ queryLang: 'de', storedLang: 'ru', navigatorLang: 'en' }), 'ru');
  assert.equal(I18N.detectLang({ queryLang: null, storedLang: null, navigatorLang: 'ru-RU' }), 'ru');
  assert.equal(I18N.detectLang({}), 'en');

  assert.equal(I18N.langFromAcceptLanguage('fr-CA,fr;q=0.9,en;q=0.8'), 'fr');
  assert.equal(I18N.langFromAcceptLanguage('de-DE,de;q=0.9'), null);
  assert.equal(I18N.langFromAcceptLanguage(''), null);
});

test('множественное число en/fr/ru', () => {
  assert.equal(`${1} ${I18N.tp('en', 'ui.request', 1)}`, '1 request');
  assert.equal(`${2} ${I18N.tp('en', 'ui.request', 2)}`, '2 requests');
  assert.equal(`${1} ${I18N.tp('fr', 'ui.request', 1)}`, '1 requête');
  assert.equal(`${2} ${I18N.tp('fr', 'ui.request', 2)}`, '2 requêtes');
  assert.equal(`${1} ${I18N.tp('ru', 'ui.request', 1)}`, '1 запрос');
  assert.equal(`${2} ${I18N.tp('ru', 'ui.request', 2)}`, '2 запроса');
  assert.equal(`${5} ${I18N.tp('ru', 'ui.request', 5)}`, '5 запросов');
});

test('даты форматируются через Intl для каждой локали', () => {
  const iso = '2026-10-21T12:00:00.000Z';
  const ru = I18N.formatDate(iso, 'ru', { dateStyle: 'long' });
  const en = I18N.formatDate(iso, 'en', { dateStyle: 'long' });
  const fr = I18N.formatDate(iso, 'fr', { dateStyle: 'long' });
  assert.match(ru, /2026/);
  assert.match(en, /2026/);
  assert.match(fr, /2026/);
  assert.notEqual(ru, en);
  assert.notEqual(en, fr);
  assert.match(ru, /октября|окт/i);
});

test('applyStatic: переключение языка меняет тексты интерфейса', () => {
  const doc = fakeDoc([
    ['data-i18n', 'ui.hero.title'],
    ['data-i18n', 'ui.form.submit'],
    ['data-i18n', 'ui.status.vulnerable'],
    ['data-i18n-placeholder', 'ui.form.placeholder'],
    ['data-i18n-aria-label', 'ui.lang.label'],
    ['data-i18n-html', 'ui.idle.php.text'],
  ]);

  I18N.applyStatic(doc, 'ru');
  const ruTitle = doc.nodes[0].textContent;
  assert.match(ruTitle, /Проверьте/);
  assert.match(doc.nodes[1].textContent, /Проверить/);
  assert.equal(doc.documentElement.attrs.lang, 'ru');
  assert.equal(doc.meta.attrs.content, I18N.DICTS.ru['meta.description']);
  assert.equal(doc.title, I18N.DICTS.ru['meta.title']);
  assert.match(doc.nodes[5].innerHTML, /<code>Server<\/code>/);

  I18N.applyStatic(doc, 'fr');
  const frTitle = doc.nodes[0].textContent;
  assert.notEqual(frTitle, ruTitle);
  assert.match(frTitle, /Vérifiez/);
  assert.match(doc.nodes[1].textContent, /Vérifier/);
  assert.doesNotMatch(frTitle, CYRILLIC);
  assert.equal(doc.documentElement.attrs.lang, 'fr');
  assert.equal(doc.meta.attrs.content, I18N.DICTS.fr['meta.description']);

  I18N.applyStatic(doc, 'en');
  assert.match(doc.nodes[0].textContent, /Check whether/);
  assert.doesNotMatch(doc.nodes[0].textContent, CYRILLIC);
  assert.equal(doc.documentElement.attrs.lang, 'en');
});

test('index.html: разметка без текста-дублей и переключатель языка', () => {
  const html = fs.readFileSync(INDEX, 'utf8');
  assert.doesNotMatch(html, CYRILLIC, 'в разметке не должно быть русских строк');
  assert.match(html, /<html[^>]+lang="en"/i);
  assert.match(html, /<script[^>]+src="\.\/i18n\.js"/i);

  for (const key of [
    'ui.hero.title',
    'ui.form.label',
    'ui.form.submit',
    'ui.form.consent',
    'ui.footer.disclaimer',
  ]) {
    assert.match(html, new RegExp(`data-i18n="${key}"`), `нет data-i18n="${key}"`);
  }

  const buttons = html.match(/data-lang="(ru|en|fr)"/g) || [];
  assert.deepEqual(buttons.sort(), ['data-lang="en"', 'data-lang="fr"', 'data-lang="ru"']);

  // Никаких внешних ресурсов.
  assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//i);
  assert.doesNotMatch(html, /<link[^>]+href="https?:\/\//i);
});

test('app.js: нет строк интерфейса на русском, язык уходит в API и в ссылку', () => {
  const source = fs.readFileSync(APP, 'utf8');
  assert.doesNotThrow(() => execFileSync(process.execPath, ['--check', APP], { stdio: 'pipe' }));

  const code = stripComments(source);
  assert.doesNotMatch(code, CYRILLIC, 'в коде не должно быть русских UI-строк');

  assert.match(code, /PHP2SHELL_I18N/);
  assert.match(code, /ui\.status\./);
  assert.match(code, /lang/);
  assert.match(code, /localStorage/);
  assert.match(code, /navigator\.language/);
  assert.match(code, /URLSearchParams/);
});
