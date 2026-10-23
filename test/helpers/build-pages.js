'use strict';

/**
 * Песочница для `scripts/build-pages.js`: копирует public/ и нужные скрипты
 * в `tmp/` (каталог в .gitignore), чтобы тесты не трогали рабочий `docs/`.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const TMP = path.join(ROOT, 'tmp');

function makeSandbox() {
  fs.mkdirSync(TMP, { recursive: true });
  const dir = fs.mkdtempSync(path.join(TMP, 'build-pages-'));
  fs.mkdirSync(path.join(dir, 'scripts'));
  for (const name of ['build-pages.js', 'og-image.js']) {
    fs.copyFileSync(path.join(ROOT, 'scripts', name), path.join(dir, 'scripts', name));
  }
  fs.cpSync(PUBLIC_DIR, path.join(dir, 'public'), { recursive: true });
  return dir;
}

function runBuild(dir, env = {}) {
  const merged = { ...process.env };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete merged[key];
    else merged[key] = value;
  }
  return execFileSync(process.execPath, [path.join(dir, 'scripts', 'build-pages.js')], {
    cwd: dir,
    env: merged,
    encoding: 'utf8',
  });
}

function removeSandbox(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

module.exports = { ROOT, PUBLIC_DIR, makeSandbox, runBuild, removeSandbox };
