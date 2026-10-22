'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseVersion,
  compareVersions,
  branchOf,
  matchDistro,
} = require('../src/version');
const { CVE_LIST, evaluateCve, fixForBranch } = require('../src/cve');

test('parseVersion разбирает простые и дистрибутивные версии', () => {
  assert.deepEqual(parseVersion('8.4.26'), {
    raw: '8.4.26',
    numbers: [8, 4, 26],
    precision: 3,
    suffix: '',
  });

  const ubuntu = parseVersion('8.1.2-1ubuntu2.14');
  assert.deepEqual(ubuntu.numbers, [8, 1, 2]);
  assert.equal(ubuntu.suffix, '-1ubuntu2.14');

  const partial = parseVersion('8.4');
  assert.deepEqual(partial.numbers, [8, 4]);
  assert.equal(partial.precision, 2);

  assert.equal(parseVersion('php'), null);
  assert.equal(parseVersion(null), null);
});

test('compareVersions сравнивает по числовым частям', () => {
  assert.equal(compareVersions('8.4.26', '8.4.27'), -1);
  assert.equal(compareVersions('8.4.27', '8.4.27'), 0);
  assert.equal(compareVersions('8.5.12', '8.4.27'), 1);
  assert.equal(compareVersions('8.4', '8.4.0'), 0);
  assert.equal(compareVersions('7.4.33', '8.2.35'), -1);
});

test('branchOf и fixForBranch', () => {
  assert.equal(branchOf('8.4.26'), '8.4');
  assert.equal(branchOf('7.4'), '7.4');
  assert.equal(fixForBranch('8.4'), '8.4.27');
  assert.equal(fixForBranch('8.2'), '8.2.35');
  assert.equal(fixForBranch('7.4'), null);
});

test('matchDistro узнаёт дистрибутив по строке', () => {
  assert.equal(matchDistro('Apache/2.4.52 (Ubuntu)'), 'ubuntu');
  assert.equal(matchDistro('-1ubuntu2.14'), 'ubuntu');
  assert.equal(matchDistro('alpine'), 'alpine');
  assert.equal(matchDistro('-0+deb12u1'), 'debian');
  assert.equal(matchDistro('nginx/1.24.0'), null);
});

test('оба CVE имеют одинаковые пороги исправлений', () => {
  assert.equal(CVE_LIST.length, 2);
  assert.deepEqual(
    CVE_LIST.map((cve) => cve.id),
    ['CVE-2026-109618', 'CVE-2026-109619'],
  );
});

test('evaluateCve: 8.4.26 ниже фикса — vulnerable с evidence', () => {
  const php = {
    detected: true,
    version: '8.4.26',
    versionSource: 'header',
    distro: null,
    evidence: ['X-Powered-By: PHP/8.4.26'],
  };
  const result = evaluateCve(CVE_LIST[0], php);
  assert.equal(result.status, 'vulnerable');
  assert.equal(result.confidence, 'high');
  assert.match(result.reason, /8\.4\.27/);
  assert.deepEqual(result.evidence, ['X-Powered-By: PHP/8.4.26']);
});

test('evaluateCve: 8.4.27 — not_vulnerable', () => {
  const php = {
    detected: true,
    version: '8.4.27',
    versionSource: 'header',
    distro: null,
    evidence: ['X-Powered-By: PHP/8.4.27'],
  };
  const result = evaluateCve(CVE_LIST[1], php);
  assert.equal(result.status, 'not_vulnerable');
  assert.equal(result.confidence, 'high');
});

test('evaluateCve: дистрибутивная сборка ниже фикса — unknown', () => {
  const php = {
    detected: true,
    version: '8.1.2-1ubuntu2.14',
    versionSource: 'header',
    distro: { name: 'ubuntu', evidence: 'признак дистрибутива' },
    evidence: ['X-Powered-By: PHP/8.1.2-1ubuntu2.14'],
  };
  const result = evaluateCve(CVE_LIST[0], php);
  assert.equal(result.status, 'unknown');
  assert.equal(result.confidence, 'medium');
  assert.match(result.reason, /Ubuntu/);
});

test('evaluateCve: версия не раскрыта — unknown, без догадок', () => {
  const php = {
    detected: true,
    version: null,
    versionSource: null,
    distro: null,
    evidence: ['Set-Cookie: PHPSESSID=<скрыто>'],
  };
  const result = evaluateCve(CVE_LIST[0], php);
  assert.equal(result.status, 'unknown');
  assert.equal(result.confidence, 'low');
});

test('evaluateCve: PHP не обнаружен — not_applicable', () => {
  const php = { detected: false, version: null, distro: null, evidence: [] };
  const result = evaluateCve(CVE_LIST[0], php);
  assert.equal(result.status, 'not_applicable');
});

test('evaluateCve: неполная версия EOL-ветки — likely_vulnerable', () => {
  const php = {
    detected: true,
    version: '7.4',
    versionSource: 'header',
    distro: null,
    evidence: ['X-Powered-By: PHP/7.4'],
  };
  const result = evaluateCve(CVE_LIST[0], php);
  assert.equal(result.status, 'likely_vulnerable');
  assert.equal(result.confidence, 'medium');
});
