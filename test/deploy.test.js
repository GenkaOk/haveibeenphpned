'use strict';

/**
 * Проверки деплоя: Render Blueprint и подстановка API_BASE в docs/config.js.
 *
 * Сети и Docker здесь нет: манифест проверяется по содержимому, а сборка
 * страницы запускается в песочнице внутри `tmp/` (каталог в .gitignore),
 * поэтому рабочий `docs/` тесты не трогают.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const RENDER_YAML = path.join(ROOT, 'render.yaml');
const BUILD_SCRIPT = path.join(ROOT, 'scripts', 'build-pages.js');
const PUBLIC_DIR = path.join(ROOT, 'public');
const TMP = path.join(ROOT, 'tmp');

function readRender() {
  assert.ok(fs.existsSync(RENDER_YAML), 'нет render.yaml в корне репозитория');
  return fs.readFileSync(RENDER_YAML, 'utf8');
}

/** Песочница с копией scripts/ и public/ — build-pages пишет docs/ рядом. */
function makeSandbox() {
  fs.mkdirSync(TMP, { recursive: true });
  const dir = fs.mkdtempSync(path.join(TMP, 'build-pages-'));
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(BUILD_SCRIPT, path.join(dir, 'scripts', 'build-pages.js'));
  fs.cpSync(PUBLIC_DIR, path.join(dir, 'public'), { recursive: true });
  return dir;
}

function runBuild(dir, apiBase) {
  const env = { ...process.env };
  if (apiBase === undefined) delete env.API_BASE;
  else env.API_BASE = apiBase;

  return execFileSync(process.execPath, [path.join(dir, 'scripts', 'build-pages.js')], {
    cwd: dir,
    env,
    encoding: 'utf8',
  });
}

test('render.yaml: web-сервис на Docker, free, health check и env', () => {
  const yaml = readRender();

  assert.match(yaml, /^services:\s*$/m, 'render.yaml: нет корневого ключа services');
  assert.match(yaml, /-\s*type:\s*web\b/, 'render.yaml: сервис должен быть type: web');
  assert.match(yaml, /runtime:\s*docker\b/, 'render.yaml: ожидается runtime: docker');
  assert.match(yaml, /dockerfilePath:\s*\.?\/Dockerfile\b/, 'render.yaml: не указан Dockerfile');
  assert.match(yaml, /plan:\s*free\b/, 'render.yaml: ожидается plan: free');
  assert.match(yaml, /healthCheckPath:\s*\/api\/health\b/, 'render.yaml: healthCheckPath должен быть /api/health');
  assert.match(yaml, /-\s*key:\s*NODE_ENV\s*\n\s*value:\s*production\b/, 'render.yaml: нет NODE_ENV=production');
  assert.match(
    yaml,
    /-\s*key:\s*ALLOWED_ORIGINS\s*\n\s*value:\s*https:\/\/haveibeenphpned\.github\.io,https:\/\/genkaok\.github\.io\b/,
    'render.yaml: ALLOWED_ORIGINS должен содержать оба адреса сайта',
  );
  // Секретов в манифесте быть не должно: ни sync: false, ни values с токенами.
  assert.doesNotMatch(yaml, /sync:\s*false/, 'render.yaml: секрет не должен требовать ручного ввода');
  assert.doesNotMatch(yaml, /(api[_-]?key|secret|token|password)\s*:/i, 'render.yaml: похоже на секрет в манифесте');
});

test('build:pages: API_BASE попадает в docs/config.js', () => {
  const dir = makeSandbox();
  try {
    const out = runBuild(dir, 'https://example.onrender.com');
    const config = fs.readFileSync(path.join(dir, 'docs', 'config.js'), 'utf8');

    assert.match(config, /window\.__PHP2SHELL_API__ = "https:\/\/example\.onrender\.com";/);
    assert.match(out, /API_BASE = https:\/\/example\.onrender\.com/);
    assert.ok(fs.existsSync(path.join(dir, 'docs', 'index.html')), 'docs/index.html не собран');
    assert.ok(fs.existsSync(path.join(dir, 'docs', '.nojekyll')), 'docs/.nojekyll не создан');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('build:pages: без API_BASE docs/config.js остаётся same-origin', () => {
  const dir = makeSandbox();
  try {
    const out = runBuild(dir, undefined);
    const config = fs.readFileSync(path.join(dir, 'docs', 'config.js'), 'utf8');

    assert.match(config, /window\.__PHP2SHELL_API__ = "";/);
    assert.doesNotMatch(config, /onrender\.com/);
    assert.match(out, /API_BASE пуст/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('deploy:site: npm-скрипт публикует в оба remote и проверяет docs/', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['deploy:site'], 'node scripts/publish-site.js');

  const script = fs.readFileSync(path.join(ROOT, 'scripts', 'publish-site.js'), 'utf8');
  assert.match(script, /'site'/, 'publish-site.js: нет второго remote `site`');
  assert.match(script, /'origin'/, 'publish-site.js: нет remote `origin`');
  assert.match(script, /HEAD:main/, 'publish-site.js: должен пушить в main');
  assert.match(script, /haveibeenphpned\.github\.io/, 'publish-site.js: нет адреса репозитория сайта');
  assert.match(script, /build:pages/, 'publish-site.js: должен подсказывать про сборку docs/');
});

test('docs/: собран целиком и совпадает с public/, кроме config.js', () => {
  const docs = path.join(ROOT, 'docs');
  for (const entry of fs.readdirSync(PUBLIC_DIR, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const source = path.join(PUBLIC_DIR, entry.name);
    const target = path.join(docs, entry.name);
    assert.ok(fs.existsSync(target), `в docs/ нет ${entry.name}`);
    if (entry.name === 'config.js') continue;
    assert.equal(
      fs.readFileSync(target).equals(fs.readFileSync(source)),
      true,
      `docs/${entry.name} отличается от public/${entry.name} — пересоберите docs/`,
    );
  }
  assert.ok(fs.existsSync(path.join(docs, '.nojekyll')), 'в docs/ нет .nojekyll');
});

test('docs/config.js: пустой API_BASE или https-адрес, без заглушки example', () => {
  const config = fs.readFileSync(path.join(ROOT, 'docs', 'config.js'), 'utf8');
  const value = /window\.__PHP2SHELL_API__ = (.*);/.exec(config);
  assert.ok(value, 'в docs/config.js нет window.__PHP2SHELL_API__');
  const base = JSON.parse(value[1]);
  assert.match(base, /^(|https:\/\/[^"']+)$/, 'API_BASE должен быть пустым или https-адресом');
  assert.doesNotMatch(base, /example\.onrender\.com/, 'в docs/config.js не должно быть адреса-заглушки');
});
