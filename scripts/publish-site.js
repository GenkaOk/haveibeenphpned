'use strict';

/**
 * Публикация сайта/API из одного коммита.
 *
 * Основной адрес — HaveIbeenPHPned/haveibeenphpned.github.io (remote `origin`),
 * он же источник для Render. Старое зеркало GenkaOk/haveibeenphpned после
 * переноса репозитория отдаёт 404; если владелец аккаунта создаст отдельный
 * репозиторий-зеркало и настроит remote `site`, скрипт запушит и туда.
 *
 * Перед push проверяется:
 *   1. ветка — `main` (Pages отдаёт `/docs` именно из неё);
 *   2. рабочее дерево чистое — публикуется ровно то, что закоммичено;
 *   3. `docs/` собран из `public/` и `docs/config.js` содержит адрес API,
 *      а не пустое значение (иначе на Pages форма скажет «API не подключён»).
 *
 * Запуск: `npm run deploy:site` (сборка docs — отдельно: `npm run build:pages`).
 * Переменные: API_REMOTE (`origin`), SITE_REMOTE (`site`, необязательное зеркало).
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const SITE_REMOTE = process.env.SITE_REMOTE || 'site';
const API_REMOTE = process.env.API_REMOTE || 'origin';
const SITE_REMOTE_URL = 'git@github.com:GenkaOk/haveibeenphpned.git';

function fail(message) {
  console.error('deploy:site: ' + message);
  process.exit(1);
}

function git(args, options = {}) {
  const output = execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.capture === false ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
  // При stdio: 'inherit' execFileSync возвращает null — trim() не вызываем.
  return output ? output.trim() : '';
}

function assertDocsFresh() {
  const source = path.join(root, 'public');
  const target = path.join(root, 'docs');
  if (!fs.existsSync(path.join(target, 'index.html'))) {
    fail('нет docs/index.html — запустите `npm run build:pages` и закоммитьте результат');
  }

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    // index.html и config.js генерируются: шаблон public/index.html
    // намеренно отличается от prerendered docs/index.html.
    if (!entry.isFile() || entry.name === 'config.js' || entry.name === 'index.html') continue;
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (!fs.existsSync(to) || !fs.readFileSync(to).equals(fs.readFileSync(from))) {
      fail('docs/' + entry.name + ' отличается от public/' + entry.name +
        ' — запустите `npm run build:pages` и закоммитьте результат');
    }
  }

  for (const page of ['index.html', 'en/index.html', 'fr/index.html', 'og-image.png']) {
    if (!fs.existsSync(path.join(target, page))) {
      fail('в docs/ нет ' + page + ' — запустите `npm run build:pages`');
    }
  }

  if (!fs.existsSync(path.join(target, '.nojekyll'))) {
    fail('в docs/ нет .nojekyll — запустите `npm run build:pages`');
  }

  const config = fs.readFileSync(path.join(target, 'config.js'), 'utf8');
  const match = /window\.__PHP2SHELL_API__ = (.*);/.exec(config);
  if (!match) fail('в docs/config.js нет window.__PHP2SHELL_API__');
  const apiBase = JSON.parse(match[1]);
  if (!apiBase) {
    fail('docs/config.js собран без API_BASE — пересоберите с ' +
      '`API_BASE=https://haveibeenphpned-api.onrender.com npm run build:pages`');
  }
}

function listRemotes() {
  try {
    return git(['remote'])
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    fail('это не git-репозиторий');
  }
}

function assertRemote(name, urlHint) {
  if (!listRemotes().includes(name)) {
    fail('нет remote `' + name + '`. Добавьте: git remote add ' + name + ' ' + urlHint);
  }
}

const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'main') {
  fail('публикация идёт только из ветки main (сейчас `' + branch + '`)');
}

const dirty = git(['status', '--porcelain']);
if (dirty) {
  fail('рабочее дерево грязное — закоммитьте изменения перед публикацией:\n' + dirty);
}

assertDocsFresh();
assertRemote(API_REMOTE, 'git@github.com:HaveIbeenPHPned/haveibeenphpned.github.io.git');

const hasMirror = listRemotes().includes(SITE_REMOTE);
const sha = git(['rev-parse', '--short', 'HEAD']);
console.log(
  'deploy:site: публикую ' + sha + ' в ' + API_REMOTE + '/main' +
    (hasMirror ? ' и ' + SITE_REMOTE + '/main' : ''),
);

git(['push', API_REMOTE, 'HEAD:main'], { capture: false });
if (hasMirror) {
  git(['push', SITE_REMOTE, 'HEAD:main'], { capture: false });
} else {
  console.log(
    'deploy:site: remote `' + SITE_REMOTE + '` не настроен — зеркало не обновляется.\n' +
      'deploy:site: чтобы вернуть старый адрес, создайте репозиторий-зеркало и добавьте:\n' +
      'deploy:site:   git remote add ' + SITE_REMOTE + ' ' + SITE_REMOTE_URL,
  );
}

console.log('deploy:site: готово. API пересоберётся из ' + API_REMOTE +
  '/main, Pages обновятся из /docs.');
