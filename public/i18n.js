'use strict';

/**
 * Единый источник строк для ru / en / fr.
 *
 * Файл используется и браузером (window.PHP2SHELL_I18N), и сервером
 * (require('../public/i18n.js')), поэтому тексты интерфейса и серверные
 * reason/recommendations не расходятся.
 *
 * Формат: плоские ключи. `{}` — подстановка, `ui.request.*` — формы
 * множественного числа (Intl.PluralRules).
 *
 * Ключи не переводятся: статусы API остаются машинными кодами
 * (vulnerable, likely_vulnerable, ...), переводятся только подписи.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PHP2SHELL_I18N = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DICTS = {
    ru: {
      'meta.title': 'PHP2Shell — проверка сервера на CVE-2026-109618 и CVE-2026-109619',
      'meta.description':
        'Пассивная проверка: подвержен ли ваш сервер критическим RCE в ядре PHP CVE-2026-109618 и CVE-2026-109619.',

      'ui.skip': 'Перейти к содержимому',
      'ui.brandNote': 'проверка серверов',
      'ui.lang.label': 'Язык интерфейса',
      'ui.lang.switchTo': 'Переключить на {language}',
      'ui.lang.ru': 'Русский',
      'ui.lang.en': 'Английский',
      'ui.lang.fr': 'Французский',
      'ui.hero.title': 'Проверьте, уязвим ли ваш сервер к PHP2Shell',
      'ui.hero.lede':
        'Две критические RCE в ядре PHP — CVE-2026-109618 и CVE-2026-109619. Исправлено {date} в версиях 8.5.12, 8.4.27, 8.3.36 и 8.2.35. Проверка пассивная: один запрос к сайту и только публичные заголовки.',
      'ui.checker.title': 'Проверка сервера',
      'ui.form.label': 'Адрес сервера',
      'ui.form.placeholder': 'example.com или https://example.com',
      'ui.form.submit': 'Проверить сервер',
      'ui.form.hint':
        'Схему можно не указывать — подставим https://. Поддерживаются только http и https.',
      'ui.form.linkHint':
        'Адрес из ссылки. Подтвердите, что сервер ваш, и нажмите «Проверить сервер».',
      'ui.form.consent': 'Я владею этим сервером или имею разрешение на проверку',

      'ui.idle.title': 'Что показывает проверка',
      'ui.idle.php.title': 'Версия PHP',
      'ui.idle.php.text':
        'Заголовки <code>Server</code> и <code>X-Powered-By</code>, если сервер их раскрывает.',
      'ui.idle.cve.title': 'Две CVE',
      'ui.idle.cve.text':
        'Статус по каждой: подвержен, вероятно подвержен, не подвержен или неизвестно.',
      'ui.idle.actions.title': 'Что делать',
      'ui.idle.actions.text': 'Целевые версии обновления и временные меры, которые снижают риск.',
      'ui.idle.note': 'Уязвимость не эксплуатируется: запросов к чужим портам и путям нет.',

      'ui.actions.again': 'Проверить снова',
      'ui.actions.copy': 'Скопировать ссылку на результат',
      'ui.actions.copyDone': 'Ссылка скопирована',
      'ui.actions.copyFailed': 'Не удалось скопировать ссылку',

      'ui.footer.disclaimer':
        'Отчёт основан на версии PHP, которую сервер раскрывает публично, и может быть неточным: сборки дистрибутивов обычно содержат бэкпорты патчей. Проверяйте только свои серверы или серверы, на проверку которых есть разрешение.',
      'ui.footer.meta': 'Пассивная проверка · без эксплуатации · без внешних зависимостей',

      'ui.loading': 'Проверяем сервер… Обычно это занимает до 10 секунд.',
      'ui.error.title': 'Проверка не выполнена',

      'ui.status.vulnerable': 'Подвержен',
      'ui.status.likely_vulnerable': 'Вероятно подвержен',
      'ui.status.not_vulnerable': 'Не подвержен',
      'ui.status.not_applicable': 'PHP не обнаружен',
      'ui.status.unknown': 'Неизвестно',

      'ui.confidence.high': 'высокая',
      'ui.confidence.medium': 'средняя',
      'ui.confidence.low': 'низкая',
      'ui.confidence.none': 'нет',

      'ui.sapi.phpFpm': 'PHP-FPM',
      'ui.sapi.modPhp': 'mod_php (Apache)',

      'ui.verdict.checked': 'Проверено {date}',
      'ui.verdict.ms': '{n} мс',

      'ui.meta.title': 'Проверка',
      'ui.meta.target': 'Адрес',
      'ui.meta.finalUrl': 'Итоговый адрес',
      'ui.meta.checked': 'Проверено',
      'ui.meta.response': 'Ответ',
      'ui.meta.noResponse': 'нет ответа',
      'ui.meta.requests': 'Запросы к цели',
      'ui.meta.unreachable': 'Цель недоступна: {message}',

      'ui.php.title': 'PHP на сервере',
      'ui.php.version': 'Версия PHP',
      'ui.php.source': 'Источник: {source}',
      'ui.php.sourceHeader': 'из заголовка',
      'ui.php.sourceBody': 'из тела ответа',
      'ui.php.notDisclosed': 'не раскрыта',
      'ui.php.sapi': 'SAPI',
      'ui.php.sapiUnknown': 'не определён',
      'ui.php.distro': 'Дистрибутив',
      'ui.php.signs': 'Признаки PHP',
      'ui.php.signsNone': 'не найдены',
      'ui.php.confidence': 'Уверенность в PHP',
      'ui.php.evidence': 'Что увидели',

      'ui.cves.title': 'Уязвимости',
      'ui.cves.empty': 'В отчёте нет данных по CVE.',
      'ui.cves.advisory': 'Advisory на GitHub',

      'ui.rec.title': 'Что делать',
      'ui.rec.noUpdate': 'Обновление не требуется: раскрытая версия не ниже исправленной.',
      'ui.rec.notApplicable':
        'Признаков PHP не найдено — эти CVE к серверу не относятся.',
      'ui.rec.branch': 'ветка {branch}',

      'ui.mit.title': 'Временные меры',
      'ui.mit.empty': 'Временных мер для этого случая нет.',
      'ui.mit.callout':
        'Митигации частичные: они снижают риск, но не заменяют обновление PHP.',

      'ui.how.title': 'Как мы проверяем',
      'ui.how.1': 'Пассивно: один-два обычных GET/HEAD-запроса на корень сайта.',
      'ui.how.2': 'Без эксплуатации: уязвимость не запускается, состояние сервера не меняется.',
      'ui.how.3':
        'Только публичное: заголовки Server, X-Powered-By, Set-Cookie и маркеры PHP в теле.',
      'ui.how.4': 'Без перебора: никаких портов, путей, словарей и фаззинга.',

      'ui.request.one': 'запрос',
      'ui.request.few': 'запроса',
      'ui.request.many': 'запросов',
      'ui.request.other': 'запроса',

      'ui.net.failed': 'Не удалось связаться с сервисом проверки. Попробуйте ещё раз.',
      'ui.net.timeout':
        'Сервер не ответил за 70 секунд. На бесплатном плане Render инстанс засыпает после 15 минут простоя и первый запрос после сна идёт до минуты. Подождите немного и повторите проверку.',
      'ui.net.network':
        'Не удалось связаться с сервисом проверки. Проверьте сеть и попробуйте ещё раз.',
      'ui.net.badResponse': 'Сервис вернул неожиданный ответ. Попробуйте ещё раз.',
      'ui.net.retryAfter': 'Повторите через {seconds} с.',
      'ui.api.notConfigured':
        'API проверки не подключён. Статический сайт на GitHub Pages не может обращаться к чужим доменам напрямую. Укажите адрес API в переменной репозитория API_BASE (или в ссылке: ?api=https://…), затем переопубликуйте сайт.',

      'ui.errors.invalid_target': 'Сервис не принял адрес. Проверьте его и попробуйте снова.',
      'ui.errors.blocked_target':
        'Этот адрес заблокирован: проверять можно только публичные http/https-адреса.',
      'ui.errors.rate_limited': 'Слишком много проверок. Подождите минуту и повторите.',
      'ui.errors.unsupported_media_type':
        'Сервис не принял формат запроса. Обновите страницу и попробуйте снова.',
      'ui.errors.bad_request': 'Сервис не принял запрос. Попробуйте ещё раз.',
      'ui.errors.invalid_json': 'Сервис не принял запрос. Попробуйте ещё раз.',
      'ui.errors.internal_error': 'Сервис проверки временно недоступен. Попробуйте позже.',
      'ui.errors.fetch_failed': 'Цель не ответила.',
      'ui.errors.request_budget_exceeded': 'У цели закончился бюджет запросов.',
      'ui.errors.unknown': 'Сервис вернул ошибку. Попробуйте ещё раз.',

      'ui.http.400': 'Сервис не принял адрес. Проверьте его и попробуйте снова.',
      'ui.http.403':
        'Этот адрес заблокирован: проверять можно только публичные http/https-адреса.',
      'ui.http.415':
        'Сервис не принял формат запроса. Обновите страницу и попробуйте снова.',
      'ui.http.429': 'Слишком много проверок. Подождите минуту и повторите.',
      'ui.http.500': 'Сервис проверки временно недоступен. Попробуйте позже.',
      'ui.http.other': 'Сервис вернул ошибку. Попробуйте ещё раз.',

      'ui.validate.empty': 'Укажите адрес сервера.',
      'ui.validate.spaces': 'В адресе не должно быть пробелов.',
      'ui.validate.invalid':
        'Не похоже на адрес сервера. Пример: example.com или https://example.com',
      'ui.validate.protocol': 'Поддерживаются только адреса http:// и https://.',
      'ui.validate.hostname': 'В адресе нет имени сервера.',
      'ui.validate.credentials': 'Уберите логин и пароль из адреса.',
      'ui.validate.consent':
        'Подтвердите, что сервер ваш или у вас есть разрешение на проверку.',

      'server.status.vulnerable': 'подвержен',
      'server.status.likely_vulnerable': 'вероятно подвержен',
      'server.status.not_vulnerable': 'не подвержен',
      'server.status.not_applicable': 'не применимо',
      'server.status.unknown': 'неизвестно',

      'server.cve.CVE-2026-109618.title': 'Некорректное состояние при OOM',
      'server.cve.CVE-2026-109618.description':
        'Сбой при обработке нехватки памяти оставляет ядро PHP в некорректном состоянии, из которого возможен захват контроля над процессом (RCE).',
      'server.cve.CVE-2026-109619.title': 'Устаревшее состояние воркера между запросами',
      'server.cve.CVE-2026-109619.description':
        'Воркер PHP-FPM переиспользует состояние предыдущего запроса, что позволяет повлиять на обработку следующего запроса и привести к RCE.',

      'server.reason.notApplicable':
        'Признаков PHP на сервере не найдено: нет X-Powered-By с PHP, нет PHPSESSID, в теле ответа нет маркеров PHP. CVE к такому серверу не относится.',
      'server.reason.noVersion':
        'PHP обнаружен, но версия не раскрыта (X-Powered-By/Server её не содержат). Проверить подверженность удалённо нельзя — нужна проверка на самом сервере.',
      'server.reason.eolPartial':
        'Ветка PHP {branch} исправленных релизов не получила, все её версии уязвимы. Точный патч-уровень не раскрыт ({version}).',
      'server.reason.partialUnknown':
        'Версия PHP раскрыта неполно ({version}): нельзя сравнить её с исправленной {fix}.',
      'server.reason.newer':
        'Версия PHP {version} новее исправленной {newest} ({newestBranch}).',
      'server.reason.fixedBranch':
        'Версия PHP {version} не ниже исправленной {fix} для ветки {branch}.',
      'server.reason.distroBackport':
        'Версия PHP {version} ниже исправленной {fix} и относится к ветке {branch}; сборка похожа на пакет дистрибутива ({distro}), поэтому патч мог быть бэкпортирован (например, Ubuntu USN-8948-1). Нужно проверить версию пакета на сервере.',
      'server.reason.eol':
        'Версия PHP {version} относится к ветке {branch}, которая исправлений по этим CVE не получила: уязвимы все её версии.',
      'server.reason.belowFix':
        'Версия PHP {version} ниже исправленной {fix} для ветки {branch}. Признаков бэкпорта дистрибутива не найдено.',
      'server.reason.targetUnreachable':
        'Не удалось получить ответ от цели: {detail}',

      'server.evidence.serverPhp': 'Server указывает на PHP',
      'server.evidence.poweredByPhp': 'X-Powered-By указывает на PHP',
      'server.evidence.poweredByOther': 'X-Powered-By: {value} (не PHP)',
      'server.evidence.serverHeader': 'Server: {value}',
      'server.evidence.cookieShort': 'cookie PHPSESSID',
      'server.evidence.cookiePhp': 'Set-Cookie: PHPSESSID=<скрыто>',
      'server.evidence.bodyPhpError': 'в теле есть текст ошибки PHP',
      'server.evidence.bodySession': 'PHPSESSID в теле',
      'server.evidence.bodyPhpLinks': 'ссылки на .php в разметке',
      'server.evidence.bodyWordpress': 'мета-тег generator: WordPress',
      'server.evidence.versionInBody': 'версия PHP найдена в теле: {version}',
      'server.evidence.distroSign': 'признак дистрибутива: {value}',
      'server.evidence.noPhpSigns':
        'Нет X-Powered-By с PHP, нет PHPSESSID, в теле нет маркеров PHP — признаков PHP не найдено',
      'server.evidence.versionDisclosed': 'раскрыта версия PHP {version}',
      'server.evidence.versionHidden': 'версия PHP не раскрыта',
      'server.evidence.phpNotDetected': 'PHP не обнаружен',

      'server.sapi.notDetected': 'PHP не обнаружен',
      'server.sapi.fpm': 'FPM/FastCGI явно указан в заголовках',
      'server.sapi.apache':
        'косвенный признак: Server: Apache (обычно mod_php, но возможен и FPM)',
      'server.sapi.nginx': 'косвенный признак: Server: nginx (обычно PHP-FPM)',
      'server.sapi.unknownNote': 'по заголовкам SAPI не определяется',

      'server.rec.update':
        'Обновите PHP до исправленной версии для вашей ветки: {fixList}.',
      'server.rec.restart':
        'После обновления перезапустите PHP-FPM и веб-сервер, проверьте `php -v`.',
      'server.rec.checkPackage':
        'Проверьте версию пакета на сервере: `{command}` и наличие обновления (Ubuntu: USN-8948-1). Версия в X-Powered-By может не отражать бэкпорт патча.',
      'server.rec.learnVersion':
        'Узнайте точную версию на сервере: `php -v` (и `php-fpm -v` для FPM).',
      'server.rec.hiddenHeaders':
        'Если PHP на сервере всё же используется, узнайте версию командой `php -v`: скрытые заголовки не позволяют проверить это удалённо.',
      'server.rec.passive':
        'Проверка пассивная: вердикт основан на раскрытой версии и не подтверждает эксплуатацию.',
      'server.rec.unreachable':
        'Проверьте, что сайт доступен и отвечает по http/https, и повторите проверку.',

      'server.mitigation.1':
        'session.upload_progress.enabled = Off — убирает один из векторов CVE-2026-109618 (снижение риска, не исправление).',
      'server.mitigation.2':
        'Лимиты размера запроса (post_max_size, upload_max_filesize, лимит на reverse proxy) — уменьшают вероятность OOM-сценария.',
      'server.mitigation.3':
        'php-fpm: max_requests и регулярный перезапуск воркеров, отдельные пулы для сайтов — частично ограничивают CVE-2026-109619.',
      'server.mitigation.4':
        'Митигации частичные: единственное полное исправление — обновление PHP.',

      'server.disclaimer':
        'Проверка пассивная и основана на данных, которые сервер отдаёт публично (заголовки и тело ответа). Она показывает риск, но не подтверждает эксплуатацию и не гарантирует отсутствие уязвимости. Проверяйте только свои серверы или серверы, на проверку которых есть письменное разрешение.',

      'server.error.fetch_failed': 'цель не ответила',
      'server.error.request_budget_exceeded': 'превышен бюджет запросов',
      'server.error.invalid_target': 'адрес некорректен',
      'server.error.blocked_target': 'адрес заблокирован',

      'server.errorDetail.timeout': 'таймаут запроса ({timeoutMs} мс)',
      'server.errorDetail.deadline': 'исчерпан общий таймаут проверки',
      'server.errorDetail.resolve': 'не удалось разрешить имя {hostname}',
      'server.errorDetail.noAddresses': 'имя {hostname} не разрешилось в адрес',
      'server.errorDetail.blockedHostname': 'хост {hostname} заблокирован (metadata-эндпоинт)',
      'server.errorDetail.blockedAddress': 'адрес {address} заблокирован: {reason}',
      'server.errorDetail.privateAddress':
        'адрес {address} приватный ({reason}); проверка таких целей разрешена только при ALLOW_PRIVATE_TARGETS=1',
      'server.errorDetail.badPort': 'некорректный порт',
      'server.errorDetail.portNotAllowed': 'разрешены только порты 80 и 443',
      'server.errorDetail.budget': 'исчерпан лимит запросов к цели (максимум {max})',
      'server.errorDetail.tooManyRedirects': 'слишком много редиректов (больше {maxRedirects})',
      'server.errorDetail.badLocation': 'сервер вернул некорректный Location',
      'server.errorDetail.urlNotString': 'URL должен быть строкой',
      'server.errorDetail.urlEmpty': 'пустой URL',
      'server.errorDetail.urlTooLong': 'URL длиннее 2048 символов',
      'server.errorDetail.urlInvalid': 'некорректный URL',
      'server.errorDetail.urlProtocol': 'разрешены только http:// и https://',
      'server.errorDetail.urlCredentials': 'URL с логином/паролем не поддерживается',
      'server.errorDetail.urlNoHostname': 'в URL нет имени хоста',

      'server.guard.public': 'публичный адрес',
      'server.guard.metadata': 'metadata-эндпоинт 100.100.100.200',
      'server.guard.linkLocal': 'link-local / metadata (169.254.0.0/16)',
      'server.guard.networkZero': 'сеть 0.0.0.0/8',
      'server.guard.multicast': 'multicast',
      'server.guard.reserved': 'reserved 240.0.0.0/4',
      'server.guard.broadcast': 'broadcast',
      'server.guard.ietf': 'IETF protocol assignments',
      'server.guard.benchmarking': 'benchmarking 198.18.0.0/15',
      'server.guard.documentation': 'документационный диапазон',
      'server.guard.loopback': 'loopback',
      'server.guard.private10': 'private 10.0.0.0/8',
      'server.guard.private172': 'private 172.16.0.0/12',
      'server.guard.private192': 'private 192.168.0.0/16',
      'server.guard.cgnat': 'CGNAT 100.64.0.0/10',
      'server.guard.invalidV4': 'некорректный IPv4',
      'server.guard.invalidAddress': 'некорректный адрес',
      'server.guard.invalidV6': 'некорректный IPv6',
      'server.guard.unspecified': 'unspecified ::',
      'server.guard.loopbackV6': 'loopback ::1',
      'server.guard.linkLocalV6': 'link-local fe80::/10',
      'server.guard.multicastV6': 'multicast ff00::/8',
      'server.guard.documentationV6': 'документационный 2001:db8::/32',
      'server.guard.ula': 'ULA fc00::/7',
      'server.guard.unknown': 'адрес',

      'server.api.onlyGet': 'только GET',
      'server.api.usePost': 'используйте POST /api/check',
      'server.api.bodyTooLarge': 'тело запроса слишком большое',
      'server.api.forbiddenPath': 'недопустимый путь',
      'server.api.rateLimited':
        'слишком много проверок: не больше {max} в минуту, повторите через {retryAfter} с',
      'server.api.unsupportedMediaType': 'нужен content-type: application/json',
      'server.api.invalidJson': 'тело запроса — не JSON',
      'server.api.urlRequired': 'в теле нужен объект с полем url (https://...)',
      'server.api.notFoundRoute': 'неизвестный маршрут',
      'server.api.notFound': 'не найдено',
      'server.api.internalError': 'внутренняя ошибка',
      'server.api.uiNotInstalled': 'статика public/ не установлена',

      'server.checks.guardAllowed': 'соединение с {address} ({reason})',
      'server.checks.requestGet': 'GET {url}',
      'server.checks.requestGetRedirects': 'GET {url}, редиректов: {redirects}',
      'server.checks.requestHead': 'HEAD {url} — уточнение заголовков',
      'server.checks.headerPresent': 'заголовок отдан',
      'server.checks.headerMissing': 'заголовок не отдан',
      'server.checks.cookieHidden': 'Set-Cookie: PHPSESSID=<скрыто>',
      'server.checks.cookieNotFound': 'PHPSESSID не найден',
      'server.checks.bodyNotRead': 'тело не читалось: {reason}',
      'server.checks.bodyTruncated': 'тело прочитано частично (лимит {limit} байт)',
      'server.checks.bodyRead': 'тело прочитано в пределах лимита',
      'server.checks.versionSource': 'источник: {source}',
      'server.checks.versionHidden': 'версия PHP не раскрыта',
      'server.source.header': 'заголовок',
      'server.source.body': 'тело ответа',

      'cli.intro':
        'PHP2Shell checker — пассивная проверка сервера на CVE-2026-109618 / CVE-2026-109619',
      'cli.usageHeading': 'Использование:',
      'cli.optionsHeading': 'Параметры:',
      'cli.optionJson': 'напечатать отчёт в JSON',
      'cli.optionTimeout': 'общий таймаут проверки (по умолчанию 10000)',
      'cli.optionAllowPrivate': 'разрешить приватные адреса (для своего интранета)',
      'cli.optionLang': 'язык человекочитаемого вывода: ru, en или fr (по умолчанию ru)',
      'cli.exitHeading': 'Коды выхода:',
      'cli.exit0': 'не подвержен (или PHP не обнаружен)',
      'cli.exit1': 'подвержен / вероятно подвержен',
      'cli.exit2': 'неизвестно или проверка не удалась',
      'cli.noUrl': 'не указан URL',
      'cli.unknownOption': 'неизвестный параметр: {arg}',
      'cli.extraArg': 'лишний аргумент: {arg}',
      'cli.badTimeout': '--timeout должен быть положительным числом миллисекунд',
      'cli.badLang': 'неподдерживаемый язык: {arg} (доступны ru, en, fr)',
      'cli.severityLine': 'severity {severity} · {status} · уверенность: {confidence}',
      'cli.targetError': 'Нельзя проверить цель: {message}',
      'cli.checkError': 'Ошибка проверки: {message}',
      'cli.label.target': 'Цель:',
      'cli.label.time': 'Время: {date} ({ms} мс, запросов: {requests})',
      'cli.label.php': 'PHP:',
      'cli.label.summary': 'Итог:',
      'cli.phpDetected': 'обнаружен, {version}; SAPI: {sapi}',
      'cli.phpNotDetected': 'признаков не найдено',
      'cli.versionHidden': 'версия не раскрыта',
      'cli.sapiUnknown': 'не определён',
      'cli.sapi': '{sapi} (уверенность: {confidence})',
      'cli.distro': 'Дистрибутив: похоже на {name} (косвенно)',
      'cli.reason': 'Причина:',
      'cli.evidence': 'Evidence:',
      'cli.recommendations': 'Что делать:',
      'cli.error': 'Ошибка:',
      'cli.limits': 'Ограничения:',
    },

    en: {
      'meta.title': 'PHP2Shell — check your server for CVE-2026-109618 and CVE-2026-109619',
      'meta.description':
        'Passive check: is your server affected by the critical PHP core RCEs CVE-2026-109618 and CVE-2026-109619?',

      'ui.skip': 'Skip to content',
      'ui.brandNote': 'server checks',
      'ui.lang.label': 'Interface language',
      'ui.lang.switchTo': 'Switch to {language}',
      'ui.lang.ru': 'Russian',
      'ui.lang.en': 'English',
      'ui.lang.fr': 'French',
      'ui.hero.title': 'Check whether your server is vulnerable to PHP2Shell',
      'ui.hero.lede':
        'Two critical RCEs in the PHP core — CVE-2026-109618 and CVE-2026-109619. Fixed on {date} in versions 8.5.12, 8.4.27, 8.3.36 and 8.2.35. The check is passive: one request to the site and public headers only.',
      'ui.checker.title': 'Server check',
      'ui.form.label': 'Server address',
      'ui.form.placeholder': 'example.com or https://example.com',
      'ui.form.submit': 'Check server',
      'ui.form.hint':
        'The scheme is optional — we add https://. Only http and https are supported.',
      'ui.form.linkHint':
        'Address from a link. Confirm that you own the server, then click “Check server”.',
      'ui.form.consent': 'I own this server or have permission to check it',

      'ui.idle.title': 'What the check shows',
      'ui.idle.php.title': 'PHP version',
      'ui.idle.php.text':
        'The <code>Server</code> and <code>X-Powered-By</code> headers, if the server exposes them.',
      'ui.idle.cve.title': 'Two CVEs',
      'ui.idle.cve.text':
        'Status for each: affected, likely affected, not affected or unknown.',
      'ui.idle.actions.title': 'What to do',
      'ui.idle.actions.text':
        'Target versions to upgrade to and temporary measures that reduce the risk.',
      'ui.idle.note': 'The vulnerability is not exploited: there are no requests to other ports or paths.',

      'ui.actions.again': 'Check again',
      'ui.actions.copy': 'Copy result link',
      'ui.actions.copyDone': 'Link copied',
      'ui.actions.copyFailed': 'Could not copy the link',

      'ui.footer.disclaimer':
        'The report is based on the PHP version the server exposes publicly and may be inaccurate: distribution builds usually contain backported patches. Check only your own servers or servers you have permission to check.',
      'ui.footer.meta': 'Passive check · no exploitation · no external dependencies',

      'ui.loading': 'Checking the server… This usually takes up to 10 seconds.',
      'ui.error.title': 'Check failed',

      'ui.status.vulnerable': 'Affected',
      'ui.status.likely_vulnerable': 'Likely affected',
      'ui.status.not_vulnerable': 'Not affected',
      'ui.status.not_applicable': 'PHP not detected',
      'ui.status.unknown': 'Unknown',

      'ui.confidence.high': 'high',
      'ui.confidence.medium': 'medium',
      'ui.confidence.low': 'low',
      'ui.confidence.none': 'none',

      'ui.sapi.phpFpm': 'PHP-FPM',
      'ui.sapi.modPhp': 'mod_php (Apache)',

      'ui.verdict.checked': 'Checked {date}',
      'ui.verdict.ms': '{n} ms',

      'ui.meta.title': 'Check',
      'ui.meta.target': 'Address',
      'ui.meta.finalUrl': 'Final address',
      'ui.meta.checked': 'Checked',
      'ui.meta.response': 'Response',
      'ui.meta.noResponse': 'no response',
      'ui.meta.requests': 'Requests to target',
      'ui.meta.unreachable': 'Target unreachable: {message}',

      'ui.php.title': 'PHP on the server',
      'ui.php.version': 'PHP version',
      'ui.php.source': 'Source: {source}',
      'ui.php.sourceHeader': 'from a header',
      'ui.php.sourceBody': 'from the response body',
      'ui.php.notDisclosed': 'not disclosed',
      'ui.php.sapi': 'SAPI',
      'ui.php.sapiUnknown': 'not determined',
      'ui.php.distro': 'Distribution',
      'ui.php.signs': 'PHP signs',
      'ui.php.signsNone': 'not found',
      'ui.php.confidence': 'Confidence in PHP',
      'ui.php.evidence': 'What we saw',

      'ui.cves.title': 'Vulnerabilities',
      'ui.cves.empty': 'No CVE data in the report.',
      'ui.cves.advisory': 'Advisory on GitHub',

      'ui.rec.title': 'What to do',
      'ui.rec.noUpdate':
        'No update is required: the disclosed version is not older than the fixed one.',
      'ui.rec.notApplicable':
        'No PHP signs found — these CVEs do not apply to this server.',
      'ui.rec.branch': 'branch {branch}',

      'ui.mit.title': 'Temporary measures',
      'ui.mit.empty': 'There are no temporary measures for this case.',
      'ui.mit.callout':
        'Mitigations are partial: they reduce risk but do not replace a PHP update.',

      'ui.how.title': 'How we check',
      'ui.how.1': 'Passively: one or two ordinary GET/HEAD requests to the site root.',
      'ui.how.2': 'No exploitation: the vulnerability is not triggered and the server state does not change.',
      'ui.how.3':
        'Public data only: Server, X-Powered-By and Set-Cookie headers and PHP markers in the body.',
      'ui.how.4': 'No scanning: no ports, paths, wordlists or fuzzing.',

      'ui.request.one': 'request',
      'ui.request.few': 'requests',
      'ui.request.many': 'requests',
      'ui.request.other': 'requests',

      'ui.net.failed': 'Could not reach the check service. Try again.',
      'ui.net.timeout':
        'The server did not respond within 70 seconds. On the Render free plan the instance sleeps after 15 minutes idle and the first request after sleep can take up to a minute. Wait a moment and run the check again.',
      'ui.net.network': 'Could not reach the check service. Check your network and try again.',
      'ui.net.badResponse': 'The service returned an unexpected response. Try again.',
      'ui.net.retryAfter': 'Try again in {seconds} s.',
      'ui.api.notConfigured':
        'The check API is not connected. A static site on GitHub Pages cannot call other domains directly. Set the API address in the API_BASE repository variable (or in the link: ?api=https://…), then redeploy the site.',

      'ui.errors.invalid_target': 'The service did not accept the address. Check it and try again.',
      'ui.errors.blocked_target':
        'This address is blocked: only public http/https addresses can be checked.',
      'ui.errors.rate_limited': 'Too many checks. Wait a minute and try again.',
      'ui.errors.unsupported_media_type':
        'The service did not accept the request format. Reload the page and try again.',
      'ui.errors.bad_request': 'The service did not accept the request. Try again.',
      'ui.errors.invalid_json': 'The service did not accept the request. Try again.',
      'ui.errors.internal_error': 'The check service is temporarily unavailable. Try again later.',
      'ui.errors.fetch_failed': 'The target did not respond.',
      'ui.errors.request_budget_exceeded': 'The target used up the request budget.',
      'ui.errors.unknown': 'The service returned an error. Try again.',

      'ui.http.400': 'The service did not accept the address. Check it and try again.',
      'ui.http.403':
        'This address is blocked: only public http/https addresses can be checked.',
      'ui.http.415':
        'The service did not accept the request format. Reload the page and try again.',
      'ui.http.429': 'Too many checks. Wait a minute and try again.',
      'ui.http.500': 'The check service is temporarily unavailable. Try again later.',
      'ui.http.other': 'The service returned an error. Try again.',

      'ui.validate.empty': 'Enter the server address.',
      'ui.validate.spaces': 'The address must not contain spaces.',
      'ui.validate.invalid':
        'This does not look like a server address. Example: example.com or https://example.com',
      'ui.validate.protocol': 'Only http:// and https:// addresses are supported.',
      'ui.validate.hostname': 'The address has no host name.',
      'ui.validate.credentials': 'Remove the user name and password from the address.',
      'ui.validate.consent':
        'Confirm that the server is yours or that you have permission to check it.',

      'server.status.vulnerable': 'affected',
      'server.status.likely_vulnerable': 'likely affected',
      'server.status.not_vulnerable': 'not affected',
      'server.status.not_applicable': 'not applicable',
      'server.status.unknown': 'unknown',

      'server.cve.CVE-2026-109618.title': 'Incorrect state after an out-of-memory error',
      'server.cve.CVE-2026-109618.description':
        'A failure while handling an out-of-memory condition leaves the PHP core in an incorrect state that can let an attacker take control of the process (RCE).',
      'server.cve.CVE-2026-109619.title': 'Stale worker state between requests',
      'server.cve.CVE-2026-109619.description':
        'A PHP-FPM worker reuses state from the previous request, which can affect how the next request is handled and lead to RCE.',

      'server.reason.notApplicable':
        'No PHP signs were found on the server: no X-Powered-By with PHP, no PHPSESSID, and no PHP markers in the response body. This CVE does not apply to such a server.',
      'server.reason.noVersion':
        'PHP was detected, but the version is not disclosed (X-Powered-By/Server do not contain it). Vulnerability cannot be checked remotely — check on the server itself.',
      'server.reason.eolPartial':
        'PHP branch {branch} received no fixed releases, so all its versions are vulnerable. The exact patch level is not disclosed ({version}).',
      'server.reason.partialUnknown':
        'The PHP version is disclosed only partially ({version}): it cannot be compared with the fixed {fix}.',
      'server.reason.newer':
        'PHP version {version} is newer than the fixed {newest} ({newestBranch}).',
      'server.reason.fixedBranch':
        'PHP version {version} is not older than the fixed {fix} for branch {branch}.',
      'server.reason.distroBackport':
        'PHP version {version} is older than the fixed {fix} and belongs to branch {branch}; the build looks like a distribution package ({distro}), so the patch may be backported (for example, Ubuntu USN-8948-1). Check the package version on the server.',
      'server.reason.eol':
        'PHP version {version} belongs to branch {branch}, which received no fixes for these CVEs: all its versions are vulnerable.',
      'server.reason.belowFix':
        'PHP version {version} is older than the fixed {fix} for branch {branch}. No signs of a distribution backport were found.',
      'server.reason.targetUnreachable':
        'Could not get a response from the target: {detail}',

      'server.evidence.serverPhp': 'Server indicates PHP',
      'server.evidence.poweredByPhp': 'X-Powered-By indicates PHP',
      'server.evidence.poweredByOther': 'X-Powered-By: {value} (not PHP)',
      'server.evidence.serverHeader': 'Server: {value}',
      'server.evidence.cookieShort': 'PHPSESSID cookie',
      'server.evidence.cookiePhp': 'Set-Cookie: PHPSESSID=<hidden>',
      'server.evidence.bodyPhpError': 'a PHP error message in the body',
      'server.evidence.bodySession': 'PHPSESSID in the body',
      'server.evidence.bodyPhpLinks': '.php links in the markup',
      'server.evidence.bodyWordpress': 'generator meta tag: WordPress',
      'server.evidence.versionInBody': 'PHP version found in the body: {version}',
      'server.evidence.distroSign': 'distribution sign: {value}',
      'server.evidence.noPhpSigns':
        'No X-Powered-By with PHP, no PHPSESSID, no PHP markers in the body — no PHP signs found',
      'server.evidence.versionDisclosed': 'PHP version {version} disclosed',
      'server.evidence.versionHidden': 'PHP version not disclosed',
      'server.evidence.phpNotDetected': 'PHP not detected',

      'server.sapi.notDetected': 'PHP not detected',
      'server.sapi.fpm': 'FPM/FastCGI is explicitly named in the headers',
      'server.sapi.apache':
        'indirect sign: Server: Apache (usually mod_php, but FPM is possible)',
      'server.sapi.nginx': 'indirect sign: Server: nginx (usually PHP-FPM)',
      'server.sapi.unknownNote': 'SAPI cannot be determined from the headers',

      'server.rec.update':
        'Update PHP to the fixed version for your branch: {fixList}.',
      'server.rec.restart':
        'After the update, restart PHP-FPM and the web server, then check `php -v`.',
      'server.rec.checkPackage':
        'Check the package version on the server: `{command}` and whether an update is available (Ubuntu: USN-8948-1). The version in X-Powered-By may not reflect a backported patch.',
      'server.rec.learnVersion':
        'Find the exact version on the server: `php -v` (and `php-fpm -v` for FPM).',
      'server.rec.hiddenHeaders':
        'If the server does use PHP, get the version with `php -v`: hidden headers do not allow checking it remotely.',
      'server.rec.passive':
        'The check is passive: the verdict is based on the disclosed version and does not confirm exploitation.',
      'server.rec.unreachable':
        'Make sure the site is reachable and responds over http/https, then run the check again.',

      'server.mitigation.1':
        'session.upload_progress.enabled = Off — removes one of the CVE-2026-109618 vectors (risk reduction, not a fix).',
      'server.mitigation.2':
        'Request size limits (post_max_size, upload_max_filesize, a reverse proxy limit) — reduce the chance of the OOM scenario.',
      'server.mitigation.3':
        'php-fpm: max_requests and regular worker restarts, separate pools per site — partially limit CVE-2026-109619.',
      'server.mitigation.4':
        'Mitigations are partial: the only complete fix is a PHP update.',

      'server.disclaimer':
        'The check is passive and based on data the server exposes publicly (headers and response body). It shows risk but does not confirm exploitation and does not guarantee that the vulnerability is absent. Check only your own servers or servers for which you have written permission.',

      'server.error.fetch_failed': 'the target did not respond',
      'server.error.request_budget_exceeded': 'the request budget was exceeded',
      'server.error.invalid_target': 'the address is not valid',
      'server.error.blocked_target': 'the address is blocked',

      'server.errorDetail.timeout': 'request timeout ({timeoutMs} ms)',
      'server.errorDetail.deadline': 'the overall check deadline was exceeded',
      'server.errorDetail.resolve': 'could not resolve the name {hostname}',
      'server.errorDetail.noAddresses': 'the name {hostname} did not resolve to an address',
      'server.errorDetail.blockedHostname': 'host {hostname} is blocked (metadata endpoint)',
      'server.errorDetail.blockedAddress': 'address {address} is blocked: {reason}',
      'server.errorDetail.privateAddress':
        'address {address} is private ({reason}); such targets can be checked only with ALLOW_PRIVATE_TARGETS=1',
      'server.errorDetail.badPort': 'invalid port',
      'server.errorDetail.portNotAllowed': 'only ports 80 and 443 are allowed',
      'server.errorDetail.budget': 'the request budget for the target is exhausted (maximum {max})',
      'server.errorDetail.tooManyRedirects': 'too many redirects (more than {maxRedirects})',
      'server.errorDetail.badLocation': 'the server returned an invalid Location header',
      'server.errorDetail.urlNotString': 'the URL must be a string',
      'server.errorDetail.urlEmpty': 'the URL is empty',
      'server.errorDetail.urlTooLong': 'the URL is longer than 2048 characters',
      'server.errorDetail.urlInvalid': 'invalid URL',
      'server.errorDetail.urlProtocol': 'only http:// and https:// are allowed',
      'server.errorDetail.urlCredentials': 'a URL with a user name or password is not supported',
      'server.errorDetail.urlNoHostname': 'the URL has no host name',

      'server.guard.public': 'public address',
      'server.guard.metadata': 'metadata endpoint 100.100.100.200',
      'server.guard.linkLocal': 'link-local / metadata (169.254.0.0/16)',
      'server.guard.networkZero': 'network 0.0.0.0/8',
      'server.guard.multicast': 'multicast',
      'server.guard.reserved': 'reserved 240.0.0.0/4',
      'server.guard.broadcast': 'broadcast',
      'server.guard.ietf': 'IETF protocol assignments',
      'server.guard.benchmarking': 'benchmarking 198.18.0.0/15',
      'server.guard.documentation': 'documentation range',
      'server.guard.loopback': 'loopback',
      'server.guard.private10': 'private 10.0.0.0/8',
      'server.guard.private172': 'private 172.16.0.0/12',
      'server.guard.private192': 'private 192.168.0.0/16',
      'server.guard.cgnat': 'CGNAT 100.64.0.0/10',
      'server.guard.invalidV4': 'invalid IPv4',
      'server.guard.invalidAddress': 'invalid address',
      'server.guard.invalidV6': 'invalid IPv6',
      'server.guard.unspecified': 'unspecified ::',
      'server.guard.loopbackV6': 'loopback ::1',
      'server.guard.linkLocalV6': 'link-local fe80::/10',
      'server.guard.multicastV6': 'multicast ff00::/8',
      'server.guard.documentationV6': 'documentation 2001:db8::/32',
      'server.guard.ula': 'ULA fc00::/7',
      'server.guard.unknown': 'address',

      'server.api.onlyGet': 'GET only',
      'server.api.usePost': 'use POST /api/check',
      'server.api.bodyTooLarge': 'the request body is too large',
      'server.api.forbiddenPath': 'invalid path',
      'server.api.rateLimited':
        'too many checks: no more than {max} per minute, retry in {retryAfter} s',
      'server.api.unsupportedMediaType': 'content-type: application/json is required',
      'server.api.invalidJson': 'the request body is not JSON',
      'server.api.urlRequired': 'the body must contain an object with a "url" field (https://...)',
      'server.api.notFoundRoute': 'unknown route',
      'server.api.notFound': 'not found',
      'server.api.internalError': 'internal error',
      'server.api.uiNotInstalled': 'the public/ static files are not installed',

      'server.checks.guardAllowed': 'connection to {address} ({reason})',
      'server.checks.requestGet': 'GET {url}',
      'server.checks.requestGetRedirects': 'GET {url}, redirects: {redirects}',
      'server.checks.requestHead': 'HEAD {url} — header refinement',
      'server.checks.headerPresent': 'header present',
      'server.checks.headerMissing': 'header not sent',
      'server.checks.cookieHidden': 'Set-Cookie: PHPSESSID=<hidden>',
      'server.checks.cookieNotFound': 'PHPSESSID not found',
      'server.checks.bodyNotRead': 'body not read: {reason}',
      'server.checks.bodyTruncated': 'body read partially (limit {limit} bytes)',
      'server.checks.bodyRead': 'body read within the limit',
      'server.checks.versionSource': 'source: {source}',
      'server.checks.versionHidden': 'PHP version not disclosed',
      'server.source.header': 'header',
      'server.source.body': 'response body',

      'cli.intro':
        'PHP2Shell checker — passive check of a server for CVE-2026-109618 / CVE-2026-109619',
      'cli.usageHeading': 'Usage:',
      'cli.optionsHeading': 'Options:',
      'cli.optionJson': 'print the report as JSON',
      'cli.optionTimeout': 'total check timeout (default 10000)',
      'cli.optionAllowPrivate': 'allow private addresses (for your own intranet)',
      'cli.optionLang': 'language of the human-readable output: ru, en or fr (default ru)',
      'cli.exitHeading': 'Exit codes:',
      'cli.exit0': 'not affected (or PHP not detected)',
      'cli.exit1': 'affected / likely affected',
      'cli.exit2': 'unknown or the check failed',
      'cli.noUrl': 'no URL given',
      'cli.unknownOption': 'unknown option: {arg}',
      'cli.extraArg': 'unexpected argument: {arg}',
      'cli.badTimeout': '--timeout must be a positive number of milliseconds',
      'cli.badLang': 'unsupported language: {arg} (available: ru, en, fr)',
      'cli.severityLine': 'severity {severity} · {status} · confidence: {confidence}',
      'cli.targetError': 'Cannot check target: {message}',
      'cli.checkError': 'Check failed: {message}',
      'cli.label.target': 'Target:',
      'cli.label.time': 'Time: {date} ({ms} ms, requests: {requests})',
      'cli.label.php': 'PHP:',
      'cli.label.summary': 'Result:',
      'cli.phpDetected': 'detected, {version}; SAPI: {sapi}',
      'cli.phpNotDetected': 'no signs found',
      'cli.versionHidden': 'version not disclosed',
      'cli.sapiUnknown': 'not determined',
      'cli.sapi': '{sapi} (confidence: {confidence})',
      'cli.distro': 'Distribution: looks like {name} (indirect)',
      'cli.reason': 'Reason:',
      'cli.evidence': 'Evidence:',
      'cli.recommendations': 'What to do:',
      'cli.error': 'Error:',
      'cli.limits': 'Limitations:',
    },

    fr: {
      'meta.title': 'PHP2Shell — vérifier votre serveur pour CVE-2026-109618 et CVE-2026-109619',
      'meta.description':
        'Vérification passive : votre serveur est-il vulnérable aux RCE critiques du cœur de PHP CVE-2026-109618 et CVE-2026-109619 ?',

      'ui.skip': 'Aller au contenu',
      'ui.brandNote': 'vérification de serveurs',
      'ui.lang.label': "Langue de l'interface",
      'ui.lang.switchTo': 'Passer en {language}',
      'ui.lang.ru': 'Russe',
      'ui.lang.en': 'Anglais',
      'ui.lang.fr': 'Français',
      'ui.hero.title': 'Vérifiez si votre serveur est vulnérable à PHP2Shell',
      'ui.hero.lede':
        'Deux RCE critiques dans le cœur de PHP — CVE-2026-109618 et CVE-2026-109619. Corrigées le {date} dans les versions 8.5.12, 8.4.27, 8.3.36 et 8.2.35. La vérification est passive : une requête vers le site et uniquement les en-têtes publics.',
      'ui.checker.title': 'Vérification du serveur',
      'ui.form.label': 'Adresse du serveur',
      'ui.form.placeholder': 'example.com ou https://example.com',
      'ui.form.submit': 'Vérifier le serveur',
      'ui.form.hint':
        'Le schéma est facultatif — nous ajoutons https://. Seuls http et https sont pris en charge.',
      'ui.form.linkHint':
        "Adresse issue d'un lien. Confirmez que le serveur est le vôtre, puis cliquez sur « Vérifier le serveur ».",
      'ui.form.consent': "Je possède ce serveur ou j'ai l'autorisation de le vérifier",

      'ui.idle.title': 'Ce que montre la vérification',
      'ui.idle.php.title': 'Version de PHP',
      'ui.idle.php.text':
        'Les en-têtes <code>Server</code> et <code>X-Powered-By</code>, si le serveur les expose.',
      'ui.idle.cve.title': 'Deux CVE',
      'ui.idle.cve.text':
        'Statut pour chacune : vulnérable, probablement vulnérable, non vulnérable ou inconnu.',
      'ui.idle.actions.title': 'Que faire',
      'ui.idle.actions.text':
        'Versions cibles de mise à jour et mesures temporaires qui réduisent le risque.',
      'ui.idle.note':
        "La vulnérabilité n'est pas exploitée : aucune requête vers d'autres ports ou chemins.",

      'ui.actions.again': 'Vérifier à nouveau',
      'ui.actions.copy': 'Copier le lien du résultat',
      'ui.actions.copyDone': 'Lien copié',
      'ui.actions.copyFailed': 'Impossible de copier le lien',

      'ui.footer.disclaimer':
        'Le rapport repose sur la version de PHP que le serveur expose publiquement et peut être inexact : les paquets des distributions contiennent souvent des correctifs rétroportés. Ne vérifiez que vos propres serveurs ou ceux pour lesquels vous avez une autorisation.',
      'ui.footer.meta': 'Vérification passive · sans exploitation · sans dépendances externes',

      'ui.loading': "Vérification du serveur… Cela prend généralement jusqu'à 10 secondes.",
      'ui.error.title': 'Vérification non effectuée',

      'ui.status.vulnerable': 'Vulnérable',
      'ui.status.likely_vulnerable': 'Probablement vulnérable',
      'ui.status.not_vulnerable': 'Non vulnérable',
      'ui.status.not_applicable': 'PHP non détecté',
      'ui.status.unknown': 'Inconnu',

      'ui.confidence.high': 'élevée',
      'ui.confidence.medium': 'moyenne',
      'ui.confidence.low': 'faible',
      'ui.confidence.none': 'aucune',

      'ui.sapi.phpFpm': 'PHP-FPM',
      'ui.sapi.modPhp': 'mod_php (Apache)',

      'ui.verdict.checked': 'Vérifié le {date}',
      'ui.verdict.ms': '{n} ms',

      'ui.meta.title': 'Vérification',
      'ui.meta.target': 'Adresse',
      'ui.meta.finalUrl': 'Adresse finale',
      'ui.meta.checked': 'Vérifié le',
      'ui.meta.response': 'Réponse',
      'ui.meta.noResponse': 'pas de réponse',
      'ui.meta.requests': 'Requêtes vers la cible',
      'ui.meta.unreachable': 'Cible inaccessible : {message}',

      'ui.php.title': 'PHP sur le serveur',
      'ui.php.version': 'Version de PHP',
      'ui.php.source': 'Source : {source}',
      'ui.php.sourceHeader': 'depuis un en-tête',
      'ui.php.sourceBody': 'depuis le corps de la réponse',
      'ui.php.notDisclosed': 'non divulguée',
      'ui.php.sapi': 'SAPI',
      'ui.php.sapiUnknown': 'non déterminé',
      'ui.php.distro': 'Distribution',
      'ui.php.signs': 'Signes de PHP',
      'ui.php.signsNone': 'non trouvés',
      'ui.php.confidence': 'Confiance dans PHP',
      'ui.php.evidence': 'Ce que nous avons vu',

      'ui.cves.title': 'Vulnérabilités',
      'ui.cves.empty': 'Le rapport ne contient aucune donnée sur les CVE.',
      'ui.cves.advisory': 'Avis sur GitHub',

      'ui.rec.title': 'Que faire',
      'ui.rec.noUpdate':
        "Aucune mise à jour n'est nécessaire : la version divulguée n'est pas antérieure à la version corrigée.",
      'ui.rec.notApplicable':
        "Aucun signe de PHP n'a été trouvé — ces CVE ne concernent pas ce serveur.",
      'ui.rec.branch': 'branche {branch}',

      'ui.mit.title': 'Mesures temporaires',
      'ui.mit.empty': "Il n'y a pas de mesure temporaire pour ce cas.",
      'ui.mit.callout':
        "Les mesures d'atténuation sont partielles : elles réduisent le risque mais ne remplacent pas une mise à jour de PHP.",

      'ui.how.title': 'Comment nous vérifions',
      'ui.how.1':
        'De façon passive : une ou deux requêtes GET/HEAD ordinaires vers la racine du site.',
      'ui.how.2':
        "Sans exploitation : la vulnérabilité n'est pas déclenchée, l'état du serveur ne change pas.",
      'ui.how.3':
        'Uniquement des données publiques : en-têtes Server, X-Powered-By, Set-Cookie et marqueurs PHP dans le corps.',
      'ui.how.4': 'Sans balayage : aucun port, chemin, dictionnaire ni fuzzing.',

      'ui.request.one': 'requête',
      'ui.request.few': 'requêtes',
      'ui.request.many': 'requêtes',
      'ui.request.other': 'requêtes',

      'ui.net.failed': 'Impossible de joindre le service de vérification. Réessayez.',
      'ui.net.timeout':
        "Le serveur n'a pas répondu en 70 secondes. Sur le plan gratuit de Render, l'instance se met en veille après 15 minutes d'inactivité et la première requête peut prendre jusqu'à une minute. Patientez un instant puis relancez la vérification.",
      'ui.net.network':
        'Impossible de joindre le service de vérification. Vérifiez votre réseau et réessayez.',
      'ui.net.badResponse': 'Le service a renvoyé une réponse inattendue. Réessayez.',
      'ui.net.retryAfter': 'Réessayez dans {seconds} s.',
      'ui.api.notConfigured':
        "L'API de vérification n'est pas connectée. Un site statique sur GitHub Pages ne peut pas appeler d'autres domaines directement. Indiquez l'adresse de l'API dans la variable de dépôt API_BASE (ou dans le lien : ?api=https://…), puis redéployez le site.",

      'ui.errors.invalid_target':
        "Le service n'a pas accepté l'adresse. Vérifiez-la et réessayez.",
      'ui.errors.blocked_target':
        'Cette adresse est bloquée : seules les adresses publiques http/https peuvent être vérifiées.',
      'ui.errors.rate_limited': 'Trop de vérifications. Attendez une minute et réessayez.',
      'ui.errors.unsupported_media_type':
        "Le service n'a pas accepté le format de la requête. Rechargez la page et réessayez.",
      'ui.errors.bad_request': "Le service n'a pas accepté la requête. Réessayez.",
      'ui.errors.invalid_json': "Le service n'a pas accepté la requête. Réessayez.",
      'ui.errors.internal_error':
        'Le service de vérification est temporairement indisponible. Réessayez plus tard.',
      'ui.errors.fetch_failed': "La cible n'a pas répondu.",
      'ui.errors.request_budget_exceeded': 'La cible a épuisé le budget de requêtes.',
      'ui.errors.unknown': 'Le service a renvoyé une erreur. Réessayez.',

      'ui.http.400': "Le service n'a pas accepté l'adresse. Vérifiez-la et réessayez.",
      'ui.http.403':
        'Cette adresse est bloquée : seules les adresses publiques http/https peuvent être vérifiées.',
      'ui.http.415':
        "Le service n'a pas accepté le format de la requête. Rechargez la page et réessayez.",
      'ui.http.429': 'Trop de vérifications. Attendez une minute et réessayez.',
      'ui.http.500': 'Le service de vérification est temporairement indisponible. Réessayez plus tard.',
      'ui.http.other': 'Le service a renvoyé une erreur. Réessayez.',

      'ui.validate.empty': "Indiquez l'adresse du serveur.",
      'ui.validate.spaces': "L'adresse ne doit pas contenir d'espaces.",
      'ui.validate.invalid':
        'Cela ne ressemble pas à une adresse de serveur. Exemple : example.com ou https://example.com',
      'ui.validate.protocol': 'Seules les adresses http:// et https:// sont prises en charge.',
      'ui.validate.hostname': "L'adresse ne contient pas de nom d'hôte.",
      'ui.validate.credentials': "Retirez l'identifiant et le mot de passe de l'adresse.",
      'ui.validate.consent':
        "Confirmez que le serveur est le vôtre ou que vous avez l'autorisation de le vérifier.",

      'server.status.vulnerable': 'vulnérable',
      'server.status.likely_vulnerable': 'probablement vulnérable',
      'server.status.not_vulnerable': 'non vulnérable',
      'server.status.not_applicable': 'non applicable',
      'server.status.unknown': 'inconnu',

      'server.cve.CVE-2026-109618.title':
        'État incorrect après une erreur de mémoire insuffisante',
      'server.cve.CVE-2026-109618.description':
        "Une défaillance lors du traitement d'une insuffisance de mémoire laisse le cœur de PHP dans un état incorrect, à partir duquel un attaquant peut prendre le contrôle du processus (RCE).",
      'server.cve.CVE-2026-109619.title': 'État obsolète du processus entre les requêtes',
      'server.cve.CVE-2026-109619.description':
        "Un processus PHP-FPM réutilise l'état de la requête précédente, ce qui peut influencer le traitement de la requête suivante et mener à une RCE.",

      'server.reason.notApplicable':
        "Aucun signe de PHP n'a été trouvé sur le serveur : pas de X-Powered-By avec PHP, pas de PHPSESSID, aucun marqueur PHP dans le corps de la réponse. Cette CVE ne concerne pas un tel serveur.",
      'server.reason.noVersion':
        "PHP a été détecté, mais la version n'est pas divulguée (X-Powered-By/Server ne la contiennent pas). La vulnérabilité ne peut pas être vérifiée à distance — vérifiez sur le serveur lui-même.",
      'server.reason.eolPartial':
        "La branche PHP {branch} n'a reçu aucune version corrigée, toutes ses versions sont vulnérables. Le niveau de correctif exact n'est pas divulgué ({version}).",
      'server.reason.partialUnknown':
        "La version de PHP n'est divulguée que partiellement ({version}) : impossible de la comparer à la version corrigée {fix}.",
      'server.reason.newer':
        'La version de PHP {version} est plus récente que la version corrigée {newest} ({newestBranch}).',
      'server.reason.fixedBranch':
        "La version de PHP {version} n'est pas antérieure à la version corrigée {fix} de la branche {branch}.",
      'server.reason.distroBackport':
        "La version de PHP {version} est antérieure à la version corrigée {fix} et appartient à la branche {branch} ; la compilation ressemble à un paquet de distribution ({distro}), le correctif a donc pu être rétroporté (par exemple Ubuntu USN-8948-1). Vérifiez la version du paquet sur le serveur.",
      'server.reason.eol':
        "La version de PHP {version} appartient à la branche {branch}, qui n'a reçu aucun correctif pour ces CVE : toutes ses versions sont vulnérables.",
      'server.reason.belowFix':
        "La version de PHP {version} est antérieure à la version corrigée {fix} de la branche {branch}. Aucun signe de rétroportage par la distribution n'a été trouvé.",
      'server.reason.targetUnreachable':
        "Impossible d'obtenir une réponse de la cible : {detail}",

      'server.evidence.serverPhp': 'Server indique PHP',
      'server.evidence.poweredByPhp': 'X-Powered-By indique PHP',
      'server.evidence.poweredByOther': 'X-Powered-By : {value} (pas PHP)',
      'server.evidence.serverHeader': 'Server : {value}',
      'server.evidence.cookieShort': 'cookie PHPSESSID',
      'server.evidence.cookiePhp': 'Set-Cookie : PHPSESSID=<masqué>',
      'server.evidence.bodyPhpError': "un message d'erreur PHP dans le corps",
      'server.evidence.bodySession': 'PHPSESSID dans le corps',
      'server.evidence.bodyPhpLinks': 'des liens .php dans le balisage',
      'server.evidence.bodyWordpress': 'méta-balise generator : WordPress',
      'server.evidence.versionInBody': 'version de PHP trouvée dans le corps : {version}',
      'server.evidence.distroSign': 'signe de distribution : {value}',
      'server.evidence.noPhpSigns':
        "Pas de X-Powered-By avec PHP, pas de PHPSESSID, aucun marqueur PHP dans le corps — aucun signe de PHP trouvé",
      'server.evidence.versionDisclosed': 'version de PHP {version} divulguée',
      'server.evidence.versionHidden': 'version de PHP non divulguée',
      'server.evidence.phpNotDetected': 'PHP non détecté',

      'server.sapi.notDetected': 'PHP non détecté',
      'server.sapi.fpm': 'FPM/FastCGI est explicitement indiqué dans les en-têtes',
      'server.sapi.apache':
        'signe indirect : Server : Apache (généralement mod_php, mais FPM est possible)',
      'server.sapi.nginx': 'signe indirect : Server : nginx (généralement PHP-FPM)',
      'server.sapi.unknownNote': 'le SAPI ne peut pas être déterminé à partir des en-têtes',

      'server.rec.update':
        'Mettez PHP à jour vers la version corrigée de votre branche : {fixList}.',
      'server.rec.restart':
        'Après la mise à jour, redémarrez PHP-FPM et le serveur web, puis vérifiez `php -v`.',
      'server.rec.checkPackage':
        "Vérifiez la version du paquet sur le serveur : `{command}` et la disponibilité d'une mise à jour (Ubuntu : USN-8948-1). La version dans X-Powered-By peut ne pas refléter un correctif rétroporté.",
      'server.rec.learnVersion':
        'Déterminez la version exacte sur le serveur : `php -v` (et `php-fpm -v` pour FPM).',
      'server.rec.hiddenHeaders':
        'Si le serveur utilise bien PHP, obtenez la version avec `php -v` : des en-têtes masqués ne permettent pas de la vérifier à distance.',
      'server.rec.passive':
        "La vérification est passive : le verdict repose sur la version divulguée et ne confirme pas une exploitation.",
      'server.rec.unreachable':
        'Vérifiez que le site est accessible et répond en http/https, puis relancez la vérification.',

      'server.mitigation.1':
        "session.upload_progress.enabled = Off — supprime l'un des vecteurs de CVE-2026-109618 (réduction du risque, pas un correctif).",
      'server.mitigation.2':
        "Limites de taille des requêtes (post_max_size, upload_max_filesize, limite sur le reverse proxy) — réduisent la probabilité du scénario OOM.",
      'server.mitigation.3':
        'php-fpm : max_requests et redémarrage régulier des processus, pools séparés par site — limitent partiellement CVE-2026-109619.',
      'server.mitigation.4':
        "Les mesures d'atténuation sont partielles : le seul correctif complet est la mise à jour de PHP.",

      'server.disclaimer':
        "La vérification est passive et repose sur les données que le serveur expose publiquement (en-têtes et corps de la réponse). Elle montre un risque mais ne confirme pas une exploitation et ne garantit pas l'absence de vulnérabilité. Ne vérifiez que vos propres serveurs ou ceux pour lesquels vous disposez d'une autorisation écrite.",

      'server.error.fetch_failed': "la cible n'a pas répondu",
      'server.error.request_budget_exceeded': 'le budget de requêtes est dépassé',
      'server.error.invalid_target': "l'adresse n'est pas valide",
      'server.error.blocked_target': "l'adresse est bloquée",

      'server.errorDetail.timeout': "délai d'attente dépassé ({timeoutMs} ms)",
      'server.errorDetail.deadline': 'le délai global de la vérification est dépassé',
      'server.errorDetail.resolve': 'impossible de résoudre le nom {hostname}',
      'server.errorDetail.noAddresses':
        "le nom {hostname} ne s'est pas résolu en une adresse",
      'server.errorDetail.blockedHostname':
        "l'hôte {hostname} est bloqué (point de terminaison metadata)",
      'server.errorDetail.blockedAddress': "l'adresse {address} est bloquée : {reason}",
      'server.errorDetail.privateAddress':
        "l'adresse {address} est privée ({reason}) ; la vérification de ces cibles n'est autorisée qu'avec ALLOW_PRIVATE_TARGETS=1",
      'server.errorDetail.badPort': 'port non valide',
      'server.errorDetail.portNotAllowed': 'seuls les ports 80 et 443 sont autorisés',
      'server.errorDetail.budget':
        'le budget de requêtes pour la cible est épuisé (maximum {max})',
      'server.errorDetail.tooManyRedirects': 'trop de redirections (plus de {maxRedirects})',
      'server.errorDetail.badLocation': 'le serveur a renvoyé un en-tête Location non valide',
      'server.errorDetail.urlNotString': "l'URL doit être une chaîne",
      'server.errorDetail.urlEmpty': "l'URL est vide",
      'server.errorDetail.urlTooLong': "l'URL dépasse 2048 caractères",
      'server.errorDetail.urlInvalid': 'URL non valide',
      'server.errorDetail.urlProtocol': 'seuls http:// et https:// sont autorisés',
      'server.errorDetail.urlCredentials':
        "une URL avec un identifiant ou un mot de passe n'est pas prise en charge",
      'server.errorDetail.urlNoHostname': "l'URL ne contient pas de nom d'hôte",

      'server.guard.public': 'adresse publique',
      'server.guard.metadata': 'point de terminaison metadata 100.100.100.200',
      'server.guard.linkLocal': 'link-local / metadata (169.254.0.0/16)',
      'server.guard.networkZero': 'réseau 0.0.0.0/8',
      'server.guard.multicast': 'multicast',
      'server.guard.reserved': 'reserved 240.0.0.0/4',
      'server.guard.broadcast': 'broadcast',
      'server.guard.ietf': 'IETF protocol assignments',
      'server.guard.benchmarking': 'benchmarking 198.18.0.0/15',
      'server.guard.documentation': 'plage de documentation',
      'server.guard.loopback': 'loopback',
      'server.guard.private10': 'private 10.0.0.0/8',
      'server.guard.private172': 'private 172.16.0.0/12',
      'server.guard.private192': 'private 192.168.0.0/16',
      'server.guard.cgnat': 'CGNAT 100.64.0.0/10',
      'server.guard.invalidV4': 'IPv4 non valide',
      'server.guard.invalidAddress': 'adresse non valide',
      'server.guard.invalidV6': 'IPv6 non valide',
      'server.guard.unspecified': 'unspecified ::',
      'server.guard.loopbackV6': 'loopback ::1',
      'server.guard.linkLocalV6': 'link-local fe80::/10',
      'server.guard.multicastV6': 'multicast ff00::/8',
      'server.guard.documentationV6': 'documentation 2001:db8::/32',
      'server.guard.ula': 'ULA fc00::/7',
      'server.guard.unknown': 'adresse',

      'server.api.onlyGet': 'GET uniquement',
      'server.api.usePost': 'utilisez POST /api/check',
      'server.api.bodyTooLarge': 'le corps de la requête est trop volumineux',
      'server.api.forbiddenPath': 'chemin non autorisé',
      'server.api.rateLimited':
        'trop de vérifications : pas plus de {max} par minute, réessayez dans {retryAfter} s',
      'server.api.unsupportedMediaType': 'content-type : application/json est requis',
      'server.api.invalidJson': "le corps de la requête n'est pas du JSON",
      'server.api.urlRequired':
        'le corps doit contenir un objet avec un champ "url" (https://...)',
      'server.api.notFoundRoute': 'route inconnue',
      'server.api.notFound': 'introuvable',
      'server.api.internalError': 'erreur interne',
      'server.api.uiNotInstalled': 'les fichiers statiques public/ ne sont pas installés',

      'server.checks.guardAllowed': 'connexion à {address} ({reason})',
      'server.checks.requestGet': 'GET {url}',
      'server.checks.requestGetRedirects': 'GET {url}, redirections : {redirects}',
      'server.checks.requestHead': 'HEAD {url} — précision des en-têtes',
      'server.checks.headerPresent': 'en-tête présent',
      'server.checks.headerMissing': 'en-tête non envoyé',
      'server.checks.cookieHidden': 'Set-Cookie : PHPSESSID=<masqué>',
      'server.checks.cookieNotFound': 'PHPSESSID introuvable',
      'server.checks.bodyNotRead': 'corps non lu : {reason}',
      'server.checks.bodyTruncated': 'corps lu partiellement (limite {limit} octets)',
      'server.checks.bodyRead': 'corps lu dans la limite',
      'server.checks.versionSource': 'source : {source}',
      'server.checks.versionHidden': 'version de PHP non divulguée',
      'server.source.header': 'en-tête',
      'server.source.body': 'corps de la réponse',

      'cli.intro':
        'PHP2Shell checker — vérification passive d’un serveur pour CVE-2026-109618 / CVE-2026-109619',
      'cli.usageHeading': 'Utilisation :',
      'cli.optionsHeading': 'Options :',
      'cli.optionJson': 'afficher le rapport en JSON',
      'cli.optionTimeout': 'délai total de la vérification (10000 par défaut)',
      'cli.optionAllowPrivate': 'autoriser les adresses privées (pour votre intranet)',
      'cli.optionLang': 'langue de la sortie lisible : ru, en ou fr (ru par défaut)',
      'cli.exitHeading': 'Codes de sortie :',
      'cli.exit0': 'non vulnérable (ou PHP non détecté)',
      'cli.exit1': 'vulnérable / probablement vulnérable',
      'cli.exit2': 'inconnu ou échec de la vérification',
      'cli.noUrl': 'aucune URL indiquée',
      'cli.unknownOption': 'option inconnue : {arg}',
      'cli.extraArg': 'argument inattendu : {arg}',
      'cli.badTimeout': '--timeout doit être un nombre positif de millisecondes',
      'cli.badLang': 'langue non prise en charge : {arg} (disponibles : ru, en, fr)',
      'cli.severityLine': 'sévérité {severity} · {status} · confiance : {confidence}',
      'cli.targetError': 'Impossible de vérifier la cible : {message}',
      'cli.checkError': 'Échec de la vérification : {message}',
      'cli.label.target': 'Cible :',
      'cli.label.time': 'Date : {date} ({ms} ms, requêtes : {requests})',
      'cli.label.php': 'PHP :',
      'cli.label.summary': 'Résultat :',
      'cli.phpDetected': 'détecté, {version} ; SAPI : {sapi}',
      'cli.phpNotDetected': 'aucun signe trouvé',
      'cli.versionHidden': 'version non divulguée',
      'cli.sapiUnknown': 'non déterminé',
      'cli.sapi': '{sapi} (confiance : {confidence})',
      'cli.distro': 'Distribution : ressemble à {name} (indirect)',
      'cli.reason': 'Raison :',
      'cli.evidence': 'Evidence :',
      'cli.recommendations': 'Que faire :',
      'cli.error': 'Erreur :',
      'cli.limits': 'Limites :',
    },
  };

  const SUPPORTED = ['ru', 'en', 'fr'];
  const LOCALES = { ru: 'ru-RU', en: 'en-US', fr: 'fr-FR' };
  const FALLBACK = 'en';

  /**
   * Приводит тег языка к поддерживаемому коду: `ru-RU` → `ru`,
   * `fr_CA` → `fr`. Возвращает null, если язык не поддерживается.
   * @param {unknown} value
   * @returns {'ru'|'en'|'fr'|null}
   */
  function normalizeLang(value) {
    if (typeof value !== 'string') return null;
    const primary = value.trim().toLowerCase().replace('_', '-').split('-')[0];
    return SUPPORTED.includes(primary) ? primary : null;
  }

  /**
   * Первый подходящий язык из списка кандидатов (query → localStorage →
   * navigator), иначе `en`.
   * @param {{queryLang?: unknown, storedLang?: unknown, navigatorLang?: unknown}} [sources]
   * @returns {'ru'|'en'|'fr'}
   */
  function detectLang(sources = {}) {
    for (const value of [sources.queryLang, sources.storedLang, sources.navigatorLang]) {
      const lang = normalizeLang(value);
      if (lang) return lang;
    }
    return FALLBACK;
  }

  /**
   * Разбор заголовка Accept-Language: первый поддерживаемый тег.
   * @param {string} [header]
   * @returns {'ru'|'en'|'fr'|null}
   */
  function langFromAcceptLanguage(header) {
    if (typeof header !== 'string') return null;
    for (const part of header.split(',')) {
      const tag = part.split(';')[0];
      const lang = normalizeLang(tag);
      if (lang) return lang;
    }
    return null;
  }

  /**
   * @param {'ru'|'en'|'fr'} lang
   * @returns {Record<string, string>}
   */
  function dict(lang) {
    return DICTS[normalizeLang(lang) || FALLBACK];
  }

  /**
   * @param {string} template
   * @param {Record<string, unknown>} [vars]
   */
  function format(template, vars) {
    return String(template).replace(/\{(\w+)\}/g, (match, key) => {
      if (!vars || vars[key] === undefined || vars[key] === null) return match;
      return String(vars[key]);
    });
  }

  /**
   * @param {'ru'|'en'|'fr'} lang
   * @param {string} key
   * @param {Record<string, unknown>} [vars]
   */
  function t(lang, key, vars) {
    const table = dict(lang);
    const template = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : key;
    return vars ? format(template, vars) : template;
  }

  /**
   * @param {'ru'|'en'|'fr'} lang
   * @param {number} count
   * @returns {'one'|'few'|'many'|'other'}
   */
  function pluralCategory(lang, count) {
    const n = Number(count) || 0;
    try {
      return new Intl.PluralRules(LOCALES[normalizeLang(lang) || FALLBACK]).select(n);
    } catch {
      return n === 1 ? 'one' : 'other';
    }
  }

  /**
   * Форма множественного числа: t(lang, `${base}.${category}`).
   * @param {'ru'|'en'|'fr'} lang
   * @param {string} base
   * @param {number} count
   */
  function tp(lang, base, count) {
    return t(lang, `${base}.${pluralCategory(lang, count)}`);
  }

  /**
   * @param {string|number|Date} value ISO-строка или Date
   * @param {'ru'|'en'|'fr'} lang
   * @param {Intl.DateTimeFormatOptions} [options]
   */
  function formatDate(value, lang, options = { dateStyle: 'long', timeStyle: 'short' }) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    try {
      return new Intl.DateTimeFormat(LOCALES[normalizeLang(lang) || FALLBACK], options).format(date);
    } catch {
      return date.toISOString().replace('T', ' ').slice(0, 16);
    }
  }

  /**
   * Применяет словарь к статической разметке: data-i18n (текст),
   * data-i18n-html (HTML), data-i18n-placeholder / -aria-label / -title,
   * <title> и meta[name=description], а также <html lang>.
   *
   * Работает с любым объектом, похожим на Document (в тестах — заглушка).
   * @param {Document} doc
   * @param {'ru'|'en'|'fr'} lang
   * @returns {Record<string, string>}
   */
  function applyStatic(doc, lang) {
    const table = dict(lang);
    const code = normalizeLang(lang) || FALLBACK;
    const text = (key) => t(code, key);

    for (const node of doc.querySelectorAll('[data-i18n]')) {
      node.textContent = text(node.getAttribute('data-i18n'));
    }
    for (const node of doc.querySelectorAll('[data-i18n-html]')) {
      node.innerHTML = text(node.getAttribute('data-i18n-html'));
    }
    for (const node of doc.querySelectorAll('[data-i18n-placeholder]')) {
      node.setAttribute('placeholder', text(node.getAttribute('data-i18n-placeholder')));
    }
    for (const node of doc.querySelectorAll('[data-i18n-aria-label]')) {
      node.setAttribute('aria-label', text(node.getAttribute('data-i18n-aria-label')));
    }
    for (const node of doc.querySelectorAll('[data-i18n-title]')) {
      node.setAttribute('title', text(node.getAttribute('data-i18n-title')));
    }

    const title = text('meta.title');
    if (doc.title !== undefined) doc.title = title;
    const description = doc.querySelector('meta[name="description"]');
    if (description) description.setAttribute('content', text('meta.description'));
    if (doc.documentElement) doc.documentElement.setAttribute('lang', code);

    return table;
  }

  return {
    DICTS,
    SUPPORTED,
    LOCALES,
    FALLBACK,
    normalizeLang,
    detectLang,
    langFromAcceptLanguage,
    dict,
    format,
    t,
    pluralCategory,
    tp,
    formatDate,
    applyStatic,
  };
});
