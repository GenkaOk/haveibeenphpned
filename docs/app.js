'use strict';

/**
 * Клиент страницы проверки: валидация, consent, POST /api/check, рендер состояний.
 *
 * Все видимые строки берутся из public/i18n.js (ru/en/fr) — в этой разметке
 * и в этом файле текстов интерфейса нет. Машинные коды статусов
 * (vulnerable, unknown, ...) не переводятся: переводятся только подписи.
 *
 * Без зависимостей. Данные API вставляются через textContent.
 */

(function () {
  const I18N = window.PHP2SHELL_I18N;
  if (!I18N) return;

  // Страницы /en/ и /fr/ собраны статически: язык задаёт путь, а не query.
  const PRERENDERED =
    document.documentElement.getAttribute('data-prerendered') === 'true';

  // Язык страницы по умолчанию — русский (`/`); у I18N.FALLBACK другой смысл.
  const DEFAULT_PAGE_LANG = 'ru';

  const form = document.getElementById('check-form');
  const input = document.getElementById('target-url');
  const consent = document.getElementById('consent');
  const deepInput = document.getElementById('deep');
  const button = document.getElementById('check-button');
  const formError = document.getElementById('form-error');
  const result = document.getElementById('result');
  const actions = document.getElementById('result-actions');
  const againButton = document.getElementById('check-again');
  const warnButton = document.getElementById('warn-team');
  const warnStatus = document.getElementById('warn-status');
  const factsStatus = document.getElementById('facts-status');
  const copyBadgeButton = document.getElementById('copy-badge');
  const badgeStatus = document.getElementById('badge-status');
  const heroLede = document.getElementById('hero-lede');
  const langSwitch = document.getElementById('lang-switch');

  if (!form || !input || !consent || !button || !result) return;

  const REQUEST_TIMEOUT_MS = 70000;
  const STORAGE_KEY = 'php2shell.lang';
  const RELEASE_DATE = '2026-10-21';

  const FIXED_VERSIONS = [
    ['8.5', '8.5.12'],
    ['8.4', '8.4.27'],
    ['8.3', '8.3.36'],
    ['8.2', '8.2.35'],
  ];

  const STATUS_ICONS = {
    vulnerable:
      '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.4 21.2 20H2.8L12 3.4Z"/><path d="M12 9.5v4.4"/><path d="M12 17.2v.1"/></svg>',
    likely_vulnerable:
      '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.4 21.2 20H2.8L12 3.4Z"/><path d="M9.8 9.3a2.3 2.3 0 0 1 4.4.9c0 1.5-2.2 1.9-2.2 3.3"/><path d="M12 17.2v.1"/></svg>',
    not_vulnerable:
      '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.6"/><path d="m8.1 12.2 2.7 2.7 5.2-5.6"/></svg>',
    not_applicable:
      '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.6"/><path d="M8 12h8"/></svg>',
    unknown:
      '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.6"/><path d="M9.7 9.4a2.4 2.4 0 0 1 4.6.9c0 1.6-2.3 2-2.3 3.5"/><path d="M12 17.2v.1"/></svg>',
  };

  const ERROR_ICON =
    '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.6"/><path d="M12 7.7v5"/><path d="M12 16.4v.1"/></svg>';

  let currentLang = I18N.FALLBACK;
  let busy = false;
  let lastTarget = '';
  let lastDeep = false;
  let lastReport = null;
  let lastError = null;
  /** @type {Record<string, object>} отчёты по языкам — переключение без повторного запроса */
  const reportCache = {};
  let langRequestToken = 0;

  /* ---------- локализация ---------- */

  function t(key, vars) {
    return I18N.t(currentLang, key, vars);
  }

  function hasKey(key) {
    return Object.prototype.hasOwnProperty.call(I18N.dict(currentLang), key);
  }

  function formatDate(iso) {
    return I18N.formatDate(iso, currentLang, { dateStyle: 'long', timeStyle: 'short' });
  }

  function statusTitle(status) {
    return hasKey(`ui.status.${status}`) ? t(`ui.status.${status}`) : t('ui.status.unknown');
  }

  function confidenceTitle(value) {
    const key = `ui.confidence.${value}`;
    return hasKey(key) ? t(key) : '';
  }

  function requestCount(count) {
    const category = I18N.pluralCategory(currentLang, count);
    return `${count} ${t(`ui.request.${category}`)}`;
  }

  function applyStaticLanguage() {
    I18N.applyStatic(document, currentLang);
    if (heroLede) {
      heroLede.textContent = t('ui.hero.lede', {
        date: I18N.formatDate(RELEASE_DATE, currentLang, { dateStyle: 'long' }),
      });
    }
    if (langSwitch) {
      for (const btn of langSwitch.querySelectorAll('[data-lang]')) {
        const code = btn.getAttribute('data-lang');
        const active = code === currentLang;
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        btn.setAttribute('title', t('ui.lang.switchTo', { language: t(`ui.lang.${code}`) }));
      }
    }
  }

  function storeLanguage(lang) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* приватный режим: язык просто не сохранится */
    }
  }

  function updateUrlLang() {
    if (PRERENDERED) return;
    const params = new URLSearchParams(location.search);
    params.set('lang', currentLang);
    const query = params.toString();
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
  }

  /**
   * Путь соседней языковой страницы: `/` для ru, `/en/` и `/fr/` для остальных.
   * Работает и в подкаталоге (`/haveibeenphpned/en/` → `/haveibeenphpned/fr/`).
   * @param {'ru'|'en'|'fr'} lang
   */
  function languagePath(lang) {
    let base = location.pathname;
    if (base.endsWith('/index.html')) base = base.slice(0, -'index.html'.length);
    if (currentLang !== DEFAULT_PAGE_LANG) {
      const suffix = `/${currentLang}/`;
      if (base.endsWith(suffix)) base = base.slice(0, 1 - suffix.length);
    }
    if (!base.endsWith('/')) base += '/';
    return base + (lang === DEFAULT_PAGE_LANG ? '' : `${lang}/`);
  }

  function navigateToLanguage(lang) {
    const params = new URLSearchParams(location.search);
    params.delete('lang');
    const query = params.toString();
    location.assign(`${languagePath(lang)}${query ? `?${query}` : ''}${location.hash}`);
  }

  /* ---------- утилиты ---------- */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function icon(html) {
    const span = document.createElement('span');
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = html;
    return span;
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function asArray(value) {
    return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined) : [];
  }

  /* ---------- адрес API ---------- */

  /**
   * Нормализует адрес API: trim, без хвостовых `/`, только http(s).
   * Пустая строка или мусор → '' (значит «не задан»).
   */
  function normalizeApiBase(raw) {
    const value = String(raw === null || raw === undefined ? '' : raw)
      .trim()
      .replace(/\/+$/, '');
    if (!value) return '';
    if (!/^https?:\/\/[^\s/]+/i.test(value)) return '';
    return value;
  }

  /**
   * Приоритет: ?api= → window.__PHP2SHELL_API__ (config.js) → same-origin.
   * @returns {string} '' для same-origin
   */
  function apiBase() {
    const params = new URLSearchParams(location.search);
    const fromQuery = normalizeApiBase(params.get('api'));
    if (fromQuery) return fromQuery;
    return normalizeApiBase(window.__PHP2SHELL_API__);
  }

  function apiUrl(path) {
    const base = apiBase();
    return base ? `${base}${path}` : path;
  }

  /** Статический хостинг: своё API там не живёт, same-origin не сработает. */
  function isStaticGithubPages() {
    const host = location.hostname;
    return host === 'github.io' || host.endsWith('.github.io');
  }

  function apiNotConfigured() {
    return !apiBase() && isStaticGithubPages();
  }

  /* ---------- форма ---------- */

  function syncButton() {
    button.disabled = busy || !consent.checked;
    if (deepInput) deepInput.disabled = busy;
  }

  function showFormError(key) {
    formError.textContent = t(key);
    formError.hidden = false;
    input.setAttribute('aria-invalid', 'true');
  }

  function clearFormError() {
    formError.textContent = '';
    formError.hidden = true;
    input.removeAttribute('aria-invalid');
  }

  function validate(rawValue) {
    const raw = String(rawValue || '').trim();
    if (!raw) return { errorKey: 'ui.validate.empty' };
    if (/\s/.test(raw)) return { errorKey: 'ui.validate.spaces' };

    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    let parsed;
    try {
      parsed = new URL(withScheme);
    } catch {
      return { errorKey: 'ui.validate.invalid' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { errorKey: 'ui.validate.protocol' };
    }
    if (!parsed.hostname) return { errorKey: 'ui.validate.hostname' };
    if (parsed.username || parsed.password) {
      return { errorKey: 'ui.validate.credentials' };
    }
    return { url: parsed.href };
  }

  /* ---------- состояния ---------- */

  function setState(state) {
    result.dataset.state = state;
    result.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
  }

  function renderLoading() {
    result.replaceChildren();
    setState('loading');

    const box = el('div', 'loading');
    const head = el('div', 'loading-head');
    const spinner = el('span', 'spinner');
    spinner.setAttribute('aria-hidden', 'true');
    head.append(spinner, el('span', null, t('ui.loading')));
    box.append(head);
    box.append(el('div', 'skeleton skeleton--wide'));
    box.append(el('div', 'skeleton'));
    box.append(el('div', 'skeleton skeleton--short'));
    result.append(box);
  }

  function renderErrorState(error) {
    result.replaceChildren();
    setState('error');
    const box = el('div', 'error-box');
    box.append(icon(ERROR_ICON));
    const text = el('div');
    text.append(el('h2', null, t('ui.error.title')));
    const message = error && error.key ? t(error.key, error.vars) : t('ui.net.failed');
    const extra = error && error.retryKey ? ` ${t(error.retryKey, error.retryVars)}` : '';
    text.append(el('p', null, `${message}${extra}`));
    box.append(text);
    result.append(box);
  }

  /**
   * Статика на Pages без API: запрос не отправляем, показываем объяснение
   * на выбранном языке вместо сетевой ошибки.
   */
  function showApiNotConfigured() {
    lastError = { key: 'ui.api.notConfigured' };
    lastReport = null;
    actions.hidden = true;
    renderErrorState(lastError);
  }

  /* ---------- рендер отчёта ---------- */

  function renderVerdict(report) {
    const summary = isObject(report.summary) ? report.summary : {};
    const status = hasKey(`ui.status.${summary.status}`) ? summary.status : 'unknown';
    const http = isObject(report.http) ? report.http : {};

    const badge = el('div', `verdict verdict--${status}`);
    badge.id = 'result-status';
    badge.tabIndex = -1;

    const iconWrap = el('div', 'verdict-icon');
    iconWrap.append(icon(STATUS_ICONS[status]));
    badge.append(iconWrap);

    const text = el('div');
    text.append(el('p', 'verdict-label', statusTitle(status)));

    const parts = [t('ui.verdict.checked', { date: formatDate(report.scannedAt) })];
    if (http.status) parts.push(`HTTP ${http.status}`);
    if (Number.isFinite(http.elapsedMs)) parts.push(t('ui.verdict.ms', { n: http.elapsedMs }));
    text.append(el('p', 'verdict-sub', parts.join(' · ')));
    badge.append(text);

    return badge;
  }

  function renderMeta(report) {
    const panel = el('div', 'panel');
    panel.id = 'result-meta';
    panel.append(el('h2', 'block-title', t('ui.meta.title')));

    const dl = el('dl', 'meta-grid');
    const http = isObject(report.http) ? report.http : {};

    function pair(label, value, mono) {
      const group = el('div');
      group.append(el('dt', null, label));
      group.append(el('dd', mono ? 'mono' : null, value));
      dl.append(group);
    }

    pair(t('ui.meta.target'), report.target || report.finalUrl || '—', true);
    if (report.finalUrl && report.finalUrl !== report.target) {
      pair(t('ui.meta.finalUrl'), report.finalUrl, true);
    }
    pair(t('ui.meta.checked'), formatDate(report.scannedAt));
    pair(
      t('ui.meta.response'),
      http.status ? `HTTP ${http.status}` : t('ui.meta.noResponse'),
      true,
    );
    if (Number.isFinite(http.requests)) {
      pair(t('ui.meta.requests'), requestCount(http.requests), true);
    } else {
      pair(t('ui.meta.requests'), '—', true);
    }
    pair(t('ui.meta.deep'), report.deep === true ? t('ui.meta.deepOn') : t('ui.meta.deepOff'));

    panel.append(dl);

    if (isObject(report.error) && report.error.message) {
      const code = report.error.code;
      const message = code && hasKey(`ui.errors.${code}`) ? t(`ui.errors.${code}`) : report.error.message;
      panel.append(el('p', 'callout', t('ui.meta.unreachable', { message })));
    }
    return panel;
  }

  function versionSourceLabel(source) {
    if (source === 'body') return t('ui.php.sourceBody');
    if (source === 'phpinfo') return t('ui.php.sourcePhpinfo');
    if (source === 'easter-egg') return t('ui.php.sourceEasterEgg');
    if (source === 'app-fingerprint') return t('ui.php.sourceAppFingerprint');
    return t('ui.php.sourceHeader');
  }

  function renderPhp(report) {
    const php = isObject(report.php) ? report.php : {};
    const panel = el('div', 'panel');
    panel.id = 'php-info';
    panel.append(el('h2', 'block-title', t('ui.php.title')));

    const dl = el('dl', 'meta-grid');

    const versionGroup = el('div');
    versionGroup.append(el('dt', null, t('ui.php.version')));
    const versionValue = el('dd');
    const bound = isObject(php.versionBound) ? php.versionBound : null;
    const boundMin = bound && bound.min ? bound.min : php.versionMin || null;
    if (php.version) {
      versionValue.append(el('span', 'version', php.version));
      versionValue.append(
        el('div', 'source-note', t('ui.php.source', { source: versionSourceLabel(php.versionSource) })),
      );
    } else if (php.legacyPhp5) {
      versionValue.append(el('span', 'version', t('ui.php.legacy')));
      versionValue.append(
        el('div', 'source-note', t('ui.php.source', { source: versionSourceLabel('easter-egg') })),
      );
    } else if (boundMin) {
      versionValue.append(el('span', 'version', `≥ ${boundMin}`));
      versionValue.append(
        el(
          'div',
          'source-note',
          t('ui.php.lowerBoundNote', {
            app: isObject(php.app) && php.app.name ? php.app.name : '—',
          }),
        ),
      );
      versionValue.append(
        el('div', 'source-note', t('ui.php.source', { source: versionSourceLabel('app-fingerprint') })),
      );
    } else {
      versionValue.append(el('span', 'version', t('ui.php.notDisclosed')));
    }
    versionGroup.append(versionValue);
    dl.append(versionGroup);

    const sapiGroup = el('div');
    sapiGroup.append(el('dt', null, t('ui.php.sapi')));
    const sapiValue = el('dd');
    const sapiName =
      php.sapi === 'php-fpm'
        ? t('ui.sapi.phpFpm')
        : php.sapi === 'mod_php'
          ? t('ui.sapi.modPhp')
          : php.detected
            ? t('ui.php.sapiUnknown')
            : '—';
    sapiValue.append(el('span', null, sapiName));
    if (php.sapiNote) sapiValue.append(el('div', 'source-note', php.sapiNote));
    sapiGroup.append(sapiValue);
    dl.append(sapiGroup);

    if (isObject(php.distro) && php.distro.name) {
      const distroGroup = el('div');
      distroGroup.append(el('dt', null, t('ui.php.distro')));
      distroGroup.append(el('dd', null, php.distro.name));
      dl.append(distroGroup);
    }

    if (isObject(php.app) && php.app.name) {
      const appGroup = el('div');
      appGroup.append(el('dt', null, t('ui.php.app')));
      appGroup.append(el('dd', null, php.app.version ? `${php.app.name} ${php.app.version}` : php.app.name));
      dl.append(appGroup);
    }

    if (!php.detected) {
      const distroGroup = el('div');
      distroGroup.append(el('dt', null, t('ui.php.signs')));
      distroGroup.append(el('dd', null, t('ui.php.signsNone')));
      dl.append(distroGroup);
    }

    const confidence = confidenceTitle(php.confidence);
    if (confidence) {
      const confGroup = el('div');
      confGroup.append(el('dt', null, t('ui.php.confidence')));
      confGroup.append(el('dd', null, confidence));
      dl.append(confGroup);
    }

    panel.append(dl);

    const lowerBoundUnknown =
      boundMin &&
      !php.version &&
      asArray(report.cves).some(
        (cve) => isObject(cve) && cve.status === 'unknown' && cve.lowerBoundOnly === true,
      );
    if (lowerBoundUnknown) {
      panel.append(el('p', 'callout', t('ui.php.lowerBoundUnknown', { min: boundMin })));
    }

    const evidence = asArray(php.evidence);
    if (evidence.length) {
      const wrap = el('div', 'evidence-wrap');
      wrap.append(el('p', null, t('ui.php.evidence')));
      const list = el('ul', 'evidence-list');
      for (const item of evidence.slice(0, 8)) list.append(el('li', null, item));
      wrap.append(list);
      panel.append(wrap);
    }

    return panel;
  }

  function renderCves(report) {
    const panel = el('div', 'panel');
    panel.append(el('h2', 'block-title', t('ui.cves.title')));

    const list = el('div', 'cve-list');
    list.id = 'cve-list';

    const cves = asArray(report.cves);
    if (!cves.length) {
      list.append(el('p', null, t('ui.cves.empty')));
    }

    for (const cve of cves) {
      if (!isObject(cve)) continue;
      const card = el('article', 'cve');

      const head = el('div', 'cve-head');
      head.append(el('h3', null, cve.id || 'CVE'));
      head.append(el('span', 'chip chip--severity', `CVSS ${cve.severity != null ? cve.severity : '—'}`));
      const status = hasKey(`ui.status.${cve.status}`) ? cve.status : 'unknown';
      head.append(el('span', `chip chip--${status}`, statusTitle(status)));
      card.append(head);

      if (cve.title) card.append(el('p', 'cve-title', cve.title));
      if (cve.reason) card.append(el('p', 'cve-reason', cve.reason));

      const evidence = asArray(cve.evidence);
      const foot = el('div', 'cve-foot');
      if (cve.advisory && /^https:\/\//.test(cve.advisory)) {
        const link = el('a', 'cve-advisory', t('ui.cves.advisory'));
        link.href = cve.advisory;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        foot.append(link);
      } else {
        foot.append(el('span'));
      }

      if (evidence.length) {
        const ul = el('ul', 'evidence-list cve-evidence');
        for (const item of evidence.slice(0, 6)) ul.append(el('li', null, item));
        foot.append(ul);
      }

      if (foot.childNodes.length) card.append(foot);
      list.append(card);
    }

    panel.append(list);
    return panel;
  }

  function renderRecommendations(report) {
    const summary = isObject(report.summary) ? report.summary : {};
    const panel = el('div', 'panel');
    panel.id = 'recommendations';
    panel.append(el('h2', 'block-title', t('ui.rec.title')));

    if (summary.status === 'not_vulnerable') {
      panel.append(el('p', 'source-note', t('ui.rec.noUpdate')));
    } else if (summary.status === 'not_applicable') {
      panel.append(el('p', 'source-note', t('ui.rec.notApplicable')));
    }

    const fixes = el('div', 'fix-grid');
    for (const [branch, version] of FIXED_VERSIONS) {
      const item = el('div', 'fix-item');
      item.append(el('span', 'fix-branch', t('ui.rec.branch', { branch })));
      item.append(el('span', 'fix-version', version));
      fixes.append(item);
    }
    panel.append(fixes);

    const recommendations = asArray(report.recommendations);
    if (recommendations.length) {
      const list = el('ul', 'rec-list');
      list.style.marginTop = '16px';
      for (const item of recommendations) list.append(el('li', null, item));
      panel.append(list);
    }

    return panel;
  }

  function renderMitigations(report) {
    const mitigations = asArray(report.mitigations);
    const panel = el('div', 'panel');
    panel.id = 'mitigations';
    panel.append(el('h2', 'block-title', t('ui.mit.title')));

    if (mitigations.length) {
      const list = el('ul', 'mit-list');
      for (const item of mitigations) list.append(el('li', null, item));
      panel.append(list);
    } else {
      panel.append(el('p', null, t('ui.mit.empty')));
    }

    panel.append(el('p', 'callout', t('ui.mit.callout')));
    return panel;
  }

  function renderHow() {
    const panel = el('div', 'panel');
    panel.append(el('h2', 'block-title', t('ui.how.title')));
    const list = el('ul', 'how-list');
    for (let index = 1; index <= 4; index += 1) {
      list.append(el('li', null, t(`ui.how.${index}`)));
    }
    panel.append(list);
    return panel;
  }

  function renderReport(report) {
    result.replaceChildren();
    result.append(renderVerdict(report));
    result.append(renderMeta(report));
    result.append(renderPhp(report));
    result.append(renderCves(report));
    result.append(renderRecommendations(report));
    result.append(renderMitigations(report));
    result.append(renderHow());
  }

  /* ---------- сеть ---------- */

  function httpErrorKey(status) {
    const key = `ui.http.${status}`;
    return hasKey(key) ? key : 'ui.http.other';
  }

  function apiError(payload, status, retryAfter) {
    const code = payload && payload.error && typeof payload.error.code === 'string' ? payload.error.code : null;
    const error = new Error('api_error');
    error.key = code && hasKey(`ui.errors.${code}`) ? `ui.errors.${code}` : httpErrorKey(status);
    error.vars = undefined;
    if (retryAfter) {
      error.retryKey = 'ui.net.retryAfter';
      error.retryVars = { seconds: retryAfter };
    }
    return error;
  }

  async function postCheck(target, lang, deepMode) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(apiUrl('/api/check'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: target, lang, deep: deepMode === true }),
        signal: controller.signal,
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw apiError(payload, response.status, response.headers.get('retry-after'));
      }
      if (!isObject(payload)) {
        const error = new Error('bad_payload');
        error.key = 'ui.net.badResponse';
        throw error;
      }
      return payload;
    } finally {
      clearTimeout(timer);
    }
  }

  function checkErrorFromException(error) {
    if (error && error.name === 'AbortError') return { key: 'ui.net.timeout' };
    if (error instanceof TypeError) return { key: 'ui.net.network' };
    if (error && error.key) return { key: error.key, vars: error.vars, retryKey: error.retryKey, retryVars: error.retryVars };
    return { key: 'ui.net.failed' };
  }

  function applyReport(payload, fallbackTarget) {
    lastReport = payload;
    // Новый скан делает старые переводы того же результата неактуальными.
    const payloadLang = I18N.normalizeLang(payload.lang) || currentLang;
    for (const key of Object.keys(reportCache)) {
      if (key !== payloadLang) delete reportCache[key];
    }
    reportCache[payloadLang] = payload;
    renderReport(payload);
    setState('done');
    actions.hidden = false;

    lastTarget = typeof payload.target === 'string' && payload.target ? payload.target : fallbackTarget;

    const badge = document.getElementById('result-status');
    if (badge) badge.focus({ preventScroll: false });
  }

  async function runCheck(target, deepMode) {
    if (busy) return;
    busy = true;
    lastDeep = deepMode === true;
    syncButton();
    input.readOnly = true;
    clearFormError();
    actions.hidden = true;
    lastError = null;
    renderLoading();

    const sentLang = currentLang;
    try {
      const payload = await postCheck(target, sentLang, lastDeep);
      applyReport(payload, target);
      if (payload.lang && payload.lang !== currentLang) await refreshReportForLang();
    } catch (error) {
      lastError = checkErrorFromException(error);
      renderErrorState(lastError);
    } finally {
      busy = false;
      input.readOnly = false;
      syncButton();
    }
  }

  /**
   * После смены языка уже показанный отчёт нужно перерисовать: серверные
   * причины и рекомендации приходят на языке запроса. Отчёт кэшируется
   * по языку, поэтому обратное переключение мгновенное.
   */
  async function refreshReportForLang() {
    if (!lastTarget) return;
    const lang = currentLang;
    const cached = reportCache[lang];
    if (cached) {
      lastReport = cached;
      renderReport(cached);
      setState('done');
      actions.hidden = false;
      return;
    }

    const token = ++langRequestToken;
    try {
      const payload = await postCheck(lastTarget, lang, lastDeep);
      if (token !== langRequestToken || lang !== currentLang) return;
      reportCache[lang] = payload;
      lastReport = payload;
      renderReport(payload);
      setState('done');
      actions.hidden = false;
    } catch {
      // Оставляем предыдущий отчёт: смена языка не должна ломать результат.
    }
  }

  /* ---------- копирование фактов, а не результата ---------- */

  const SITE_URL = 'https://haveibeenphpned.github.io/';
  const statusTimers = new WeakMap();

  /**
   * Текст факта: заголовок, сам факт и ссылка на инструмент с UTM.
   * Ни вердикт, ни версия, ни адрес проверенного сервера сюда не попадают.
   * @param {'php81'|'versions'|'check60'} id
   */
  function factText(id) {
    const params = new URLSearchParams({
      utm_source: `fact-${id}`,
      utm_medium: 'copy',
      utm_campaign: 'php2shell',
    });
    return `${t(`ui.facts.${id}.title`)}\n\n${t(`ui.facts.${id}.text`)}\n\n${SITE_URL}?${params.toString()}`;
  }

  function legacyCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    document.body.removeChild(area);
    return copied;
  }

  function flashStatus(node, key) {
    if (!node) return;
    node.textContent = t(key);
    clearTimeout(statusTimers.get(node));
    statusTimers.set(
      node,
      setTimeout(() => {
        node.textContent = '';
      }, 4000),
    );
  }

  async function copyText(text, statusNode, doneKey, failKey) {
    if (!text) return false;
    let copied = false;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied) copied = legacyCopy(text);

    flashStatus(statusNode, copied ? doneKey : failKey);
    return copied;
  }

  /* ---------- язык ---------- */

  function setLanguage(lang) {
    const next = I18N.normalizeLang(lang);
    if (!next || next === currentLang) return;
    if (PRERENDERED) {
      navigateToLanguage(next);
      return;
    }
    currentLang = next;
    storeLanguage(currentLang);
    applyStaticLanguage();
    updateUrlLang();

    if (lastError && result.dataset.state === 'error') {
      renderErrorState(lastError);
      return;
    }
    if (lastReport && result.dataset.state === 'done') {
      refreshReportForLang();
    }
  }

  /* ---------- события ---------- */

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!consent.checked) {
      showFormError('ui.validate.consent');
      consent.focus();
      return;
    }
    const checked = validate(input.value);
    if (checked.errorKey) {
      showFormError(checked.errorKey);
      input.focus();
      return;
    }
    clearFormError();
    if (apiNotConfigured()) {
      showApiNotConfigured();
      return;
    }
    runCheck(checked.url, Boolean(deepInput && deepInput.checked));
  });

  consent.addEventListener('change', () => {
    syncButton();
    if (consent.checked) clearFormError();
  });

  input.addEventListener('input', () => {
    if (!formError.hidden) clearFormError();
  });

  againButton.addEventListener('click', () => {
    if (!consent.checked) {
      showFormError('ui.validate.consent');
      consent.focus();
      return;
    }
    if (apiNotConfigured()) {
      showApiNotConfigured();
      return;
    }
    runCheck(lastTarget || input.value.trim(), Boolean(deepInput && deepInput.checked));
  });

  if (warnButton) {
    warnButton.addEventListener('click', () => {
      copyText(
        t('ui.warn.text'),
        warnStatus,
        'ui.actions.warnDone',
        'ui.actions.warnFailed',
      );
    });
  }

  for (const button of document.querySelectorAll('[data-copy-fact]')) {
    button.addEventListener('click', () => {
      copyText(
        factText(button.getAttribute('data-copy-fact')),
        factsStatus,
        'ui.facts.copyDone',
        'ui.facts.copyFailed',
      );
    });
  }

  if (copyBadgeButton) {
    copyBadgeButton.addEventListener('click', () => {
      const snippet = document.querySelector('.badge-markdown');
      copyText(
        snippet ? snippet.textContent.trim() : '',
        badgeStatus,
        'ui.badge.copyDone',
        'ui.badge.copyFailed',
      );
    });
  }

  if (langSwitch) {
    langSwitch.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-lang]');
      if (!btn) return;
      setLanguage(btn.getAttribute('data-lang'));
    });
  }

  /* ---------- старт ---------- */

  const params = new URLSearchParams(location.search);
  let storedLang = null;
  try {
    storedLang = localStorage.getItem(STORAGE_KEY);
  } catch {
    storedLang = null;
  }

  // Предрендеренная страница уже на нужном языке: путь важнее query,
  // localStorage и настроек браузера, иначе /en/ показал бы русский текст.
  const pageLang = PRERENDERED ? I18N.normalizeLang(document.documentElement.lang) : null;
  currentLang =
    pageLang ||
    I18N.detectLang({
      queryLang: params.get('lang'),
      storedLang,
      navigatorLang: navigator.language,
    });
  applyStaticLanguage();
  // Язык виден в ссылке и не содержит данных проверки.
  if (!PRERENDERED && params.get('lang') !== currentLang) updateUrlLang();

  syncButton();
})();
