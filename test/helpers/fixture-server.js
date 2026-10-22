'use strict';

const http = require('node:http');
const fixtures = require('../fixtures.json');

/**
 * Локальный сервер-фикстура: любой путь отдаёт заданный набор заголовков/тело.
 * @param {Record<string, object>} [overrides]
 */
async function startFixtureServer(overrides = {}) {
  const table = { ...fixtures, ...overrides };
  /** @type {string[]} */
  const requests = [];

  const server = http.createServer((req, res) => {
    const rawUrl = req.url || '/';
    requests.push(rawUrl);
    const pathname = rawUrl.split('?')[0];
    const cleanPath = pathname.replace(/^\/+/, '');
    const fixture =
      table[rawUrl] ||
      table[pathname] ||
      table[cleanPath] ||
      (pathname === '/' ? table.root : null) ||
      table.root;

    if (!fixture) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }

    res.writeHead(fixture.status || 200, {
      'content-type': 'text/html; charset=utf-8',
      ...(fixture.headers || {}),
    });
    res.on('error', () => {});
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(fixture.body || '');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  return {
    url: `http://127.0.0.1:${port}`,
    host: `127.0.0.1:${port}`,
    port,
    server,
    requests,
    getRequests: () => requests.slice(),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/**
 * @param {object} fixture
 * @param {(srv: {url: string, port: number}) => Promise<any>} fn
 */
async function withFixture(fixture, fn) {
  const srv = await startFixtureServer({ root: fixture });
  try {
    return await fn(srv);
  } finally {
    await srv.close();
  }
}

module.exports = { startFixtureServer, withFixture };
