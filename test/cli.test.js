'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');

const fixtures = require('./fixtures.json');
const { startFixtureServer } = require('./helpers/fixture-server');

const CLI = path.join(__dirname, '..', 'cli.js');

/**
 * @param {string[]} args
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      env: { ...process.env, ALLOW_PRIVATE_TARGETS: '1', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('cli: уязвимый сервер → exit 1 и валидный JSON', async () => {
  const srv = await startFixtureServer({ root: fixtures['php-8-4-26'] });
  try {
    const result = await runCli([srv.url, '--json']);
    assert.equal(result.code, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.summary.status, 'vulnerable');
    assert.equal(report.php.version, '8.4.26');
  } finally {
    await srv.close();
  }
});

test('cli: исправленный сервер → exit 0', async () => {
  const srv = await startFixtureServer({ root: fixtures['php-8-4-27'] });
  try {
    const result = await runCli([srv.url, '--json']);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).summary.status, 'not_vulnerable');
  } finally {
    await srv.close();
  }
});

test('cli: сайт без PHP → exit 0, not_applicable', async () => {
  const srv = await startFixtureServer({ root: fixtures['no-php'] });
  try {
    const result = await runCli([srv.url, '--json']);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).summary.status, 'not_applicable');
  } finally {
    await srv.close();
  }
});

test('cli: версия скрыта → exit 2, unknown', async () => {
  const srv = await startFixtureServer({ root: fixtures['php-hidden-version'] });
  try {
    const result = await runCli([srv.url, '--json']);
    assert.equal(result.code, 2, result.stderr);
    assert.equal(JSON.parse(result.stdout).summary.status, 'unknown');
    assert.equal(JSON.parse(result.stdout).php.version, null);
  } finally {
    await srv.close();
  }
});

test('cli: человекочитаемый вывод содержит вердикт', async () => {
  const srv = await startFixtureServer({ root: fixtures['php-8-4-26'] });
  try {
    const result = await runCli([srv.url]);
    assert.equal(result.code, 1);
    assert.match(result.stdout, /подвержен/i);
    assert.match(result.stdout, /CVE-2026-109618/);
    assert.match(result.stdout, /Что делать/);
  } finally {
    await srv.close();
  }
});

test('cli: в рекомендациях есть Sury и предупреждение о стороннем репозитории', async () => {
  const srv = await startFixtureServer({ root: fixtures['php-8-4-26'] });
  try {
    const result = await runCli([srv.url, '--lang=en']);
    assert.equal(result.code, 1, result.stderr);
    assert.match(result.stdout, /deb\.sury\.org/);
    assert.match(result.stdout, /third-party repository/);
  } finally {
    await srv.close();
  }
});

test('cli: заблокированная цель → exit 2 и понятная ошибка', async () => {
  const result = await runCli(['http://169.254.169.254/']);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /заблокирован/);
});

test('cli: без URL → exit 2 и подсказка', async () => {
  const result = await runCli([]);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /Использование/);
});
