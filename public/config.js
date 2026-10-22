'use strict';

/**
 * Адрес API проверки для статического сайта.
 *
 * Пусто — same-origin: страницу и API отдаёт один хост (npm start).
 * Workflow .github/workflows/pages.yml подставляет сюда значение
 * repository variable API_BASE; параметр ссылки ?api=https://… важнее.
 */
window.__PHP2SHELL_API__ = '';
