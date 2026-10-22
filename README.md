# PHP2Shell Checker

Пассивная проверка: подвержен ли сервер критическим RCE в ядре PHP
**CVE-2026-109618** и **CVE-2026-109619** («php2shell», опубликованы 21.10.2026).

Утилита не эксплуатирует уязвимость и ничего не меняет на цели: она делает
один-два обычных запроса на корень сайта, читает публичные заголовки и тело,
сравнивает раскрытую версию PHP с исправленными версиями и отдаёт вердикт
с confidence и evidence.

```
CVE-2026-109618  некорректное состояние при OOM → RCE
CVE-2026-109619  устаревшее состояние воркера между запросами → RCE

Исправлено: 8.5.12 · 8.4.27 · 8.3.36 · 8.2.35
Ветки 5.x / 7.x / 8.0 / 8.1 исправленных релизов не получили.
Дистрибутивы (Ubuntu USN-8948-1 и др.) бэкпортировали патч.
```

- Репозиторий: <https://github.com/GenkaOk/haveibeenphpned>
- Сайт (GitHub Pages): <https://genkaok.github.io/haveibeenphpned/>
- API: размещается отдельно, адрес задаётся в `API_BASE` (см. «Деплой»).

Первоисточники: [GHSA-w8hw-w9fx-j79w](https://github.com/advisories/GHSA-w8hw-w9fx-j79w),
[GHSA-6wmf-4rv5-p3rp](https://github.com/advisories/GHSA-6wmf-4rv5-p3rp),
isc.sans.edu/diary/33440.

## Запуск

Нужен Node.js >= 20. Внешних зависимостей нет.

```bash
npm ci          # ставит пустое дерево зависимостей по package-lock.json
npm test        # тесты на node:test
npm start       # страница на / и API на PORT (по умолчанию 8080)
```

```bash
node cli.js https://example.com
node cli.js example.com --json
node cli.js http://127.0.0.1:8080 --allow-private
node cli.js example.com --lang=en
```

`--json` печатает тот же отчёт, что отдаёт `POST /api/check`.
`--lang=ru|en|fr` меняет язык человекочитаемого вывода (по умолчанию `ru`);
машинные коды статусов и exit-коды от языка не зависят.

### Веб-страница

`npm start` отдаёт страницу проверки на `/` с того же порта, что и API —
отдельного фронтенд-сервера и сборки нет.

```bash
PORT=8080 npm start
# http://localhost:8080/
```

- статика: `public/index.html`, `public/styles.css`, `public/app.js`,
  `public/i18n.js`, `public/config.js`;
- все ссылки на ассеты относительные, поэтому один и тот же `public/`
  работает и в корне (`http://localhost:8080/`), и в подкаталоге
  (`https://genkaok.github.io/haveibeenphpned/`);
- без CDN, внешних шрифтов и аналитики — страница работает офлайн;
- форма: адрес сервера и подтверждение владения (без него кнопка неактивна);
- состояния: пустое, загрузка, ошибка человеческим текстом, результат;
- результат: бейдж вердикта, карточки CVE с evidence, версия PHP и SAPI,
  исправленные версии, временные меры, «как мы проверяем»;
- ссылка на результат: `/?url=https%3A%2F%2Fexample.com` подставляет адрес
  в поле, но не запускает проверку без подтверждения;
- адаптив 360–1440 px, `aria-live`, `:focus-visible`, контраст ≥ 4.5:1.

### Адрес API во фронтенде

Странице нужно знать, куда отправлять `POST /api/check`. Приоритет:

1. query-параметр `?api=https://api.example.com` (только `http`/`https`);
2. `window.__PHP2SHELL_API__` из `public/config.js` — это значение подставляет
   workflow Pages из repository variable `API_BASE`;
3. иначе same-origin, то есть `/api/check` на том же хосте (как при `npm start`).

Пустое значение = same-origin. Хвостовые `/` отбрасываются, значения без
схемы `http(s)://` игнорируются.

Если сайт открыт с `*.github.io`, а API не задан, форма не делает запрос и
показывает понятное сообщение «API не подключён» (RU/EN/FR) вместо сетевой
ошибки: статический хостинг не может сам обращаться к чужим доменам.

## Деплой

Схема: **страница — GitHub Pages, API — отдельный хост**. Pages умеет отдавать
только статику, поэтому проверка живёт на своём сервере.

### 1. Страница на GitHub Pages

Источник правды — `public/`. Pages в этом репозитории настроены на
**Deploy from a branch → `main` / `/docs`**, поэтому публикуется
сгенерированная копия:

```bash
npm run build:pages        # public/ → docs/, API_BASE пуст
API_BASE=https://php2shell-api.onrender.com npm run build:pages
```

Скрипт `scripts/build-pages.js` очищает `docs/`, копирует `public/`, пишет
`docs/.nojekyll` (отключает Jekyll целиком — иначе GitHub ищет
`assets/css/style.scss` и падает) и `docs/config.js` со значением `API_BASE`.

`docs/` генерируется, руками не править: после изменений в `public/`
запустить `npm run build:pages` и закоммитить результат вместе с `public/`.
GitHub сам этот скрипт не запускает — сборка статики остаётся в репозитории.

Разовая настройка репозитория:

1. **Settings → Pages → Build and deployment → Source: Deploy from a branch.**
2. Branch: `main`, folder: `/docs`.
3. Push в `main` — сайт пересобирается без Jekyll.

Адрес API: `API_BASE` при сборке (шаг выше) либо query-параметр
`?api=https://…`. Без значения форма честно скажет, что API не подключён.

Необязательный fallback: `.github/workflows/pages.yml` умеет публиковать
`public/` через GitHub Actions, но запускается только вручную
(**Actions → Deploy site to GitHub Pages → Run workflow**) и требует
Source: GitHub Actions. При source=branch он не нужен.

Проверка после деплоя:

```bash
# 1. сайт отдаётся
curl -sI https://genkaok.github.io/haveibeenphpned/ | head -1     # HTTP/2 200
# 2. страница видит API: в исходнике config.js должен быть ваш адрес
curl -s https://genkaok.github.io/haveibeenphpned/config.js
#    window.__PHP2SHELL_API__ = "https://php2shell-api.onrender.com";
# 3. API жив и разрешает origin сайта
curl -s https://php2shell-api.onrender.com/api/health            # {"ok":true}
curl -sI -X OPTIONS https://php2shell-api.onrender.com/api/check \
  -H 'Origin: https://genkaok.github.io' \
  -H 'Access-Control-Request-Method: POST' | grep -i access-control
#    access-control-allow-origin: https://genkaok.github.io
```

Если в браузере вместо результата «API не подключён» — не задан `API_BASE`
(или не переопубликован сайт). Если «Не удалось связаться с сервисом» —
API недоступен либо его `ALLOWED_ORIGINS` не содержит origin сайта.

### 2. Бэкенд

Требования: Node.js >= 20, переменные `PORT` (по умолчанию `8080`) и
`ALLOWED_ORIGINS` (по умолчанию `https://genkaok.github.io`). Порт должен быть
публичным по HTTPS: страница на Pages работает по HTTPS, а браузер не пустит
`http`-запрос с HTTPS-страницы.

#### Docker

```bash
docker build -t php2shell-api .
docker run -d --name php2shell-api -p 8080:8080 \
  -e ALLOWED_ORIGINS=https://genkaok.github.io \
  --restart unless-stopped php2shell-api
curl -s http://127.0.0.1:8080/api/health       # {"ok":true}
```

Образ: `node:22-alpine`, процесс работает от пользователя `node`,
`HEALTHCHECK` дергает `/api/health`.

#### Render (Blueprint)

В корне репозитория лежит `render.yaml` — манифест Render Blueprint. Сервис
создаётся из него, руками поля заполнять не нужно:

1. **New → Blueprint**, подключить репозиторий `GenkaOk/haveibeenphpned`.
2. Render находит `render.yaml` и показывает сервис `haveibeenphpned-api`:
   runtime Docker (`./Dockerfile`), plan `free`, region Frankfurt,
   health check `/api/health`, автодеплой при push в ветку.
3. **Apply** — Render собирает образ и запускает контейнер.
4. Скопировать публичный URL вида
   `https://haveibeenphpned-api.onrender.com` и передать его в `API_BASE`
   при сборке страницы (шаг 1):

   ```bash
   API_BASE=https://haveibeenphpned-api.onrender.com npm run build:pages
   ```

Переменные из манифеста: `NODE_ENV=production` и
`ALLOWED_ORIGINS=https://genkaok.github.io`. `PORT` Render передаёт сам —
`src/server.js` читает `process.env.PORT`. Секретов в манифесте нет.

Если Blueprint не нужен, тот же сервис создаётся вручную:
**New → Web Service**, runtime Docker, health check `/api/health`,
`ALLOWED_ORIGINS=https://genkaok.github.io`.

**Free-план засыпает.** После ~15 минут без запросов инстанс останавливается,
и первый запрос после сна идёт ~30–60 с. На сайте это выглядит как
«сервер просыпается»: таймаут проверки увеличен до 70 с, а сообщение об
ошибке объясняет сон free-плана и предлагает повторить. Для мгновенного
отклика нужен платный план Render либо always-on хост (Fly.io / VPS ниже).

#### Fly.io

```bash
fly launch --no-deploy --name php2shell-api   # возьмёт Dockerfile
fly secrets set ALLOWED_ORIGINS=https://genkaok.github.io
fly deploy
curl -s https://php2shell-api.fly.dev/api/health
```

`fly.toml`: `[http_service] internal_port = 8080`, `force_https = true`.

#### VPS (systemd + nginx)

```ini
# /etc/systemd/system/php2shell-api.service
[Unit]
Description=PHP2Shell check API
After=network.target

[Service]
WorkingDirectory=/opt/php2shell
ExecStart=/usr/bin/node src/server.js
Environment=PORT=8080
Environment=ALLOWED_ORIGINS=https://genkaok.github.io
Environment=TRUST_PROXY=1
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

`TRUST_PROXY=1` включайте только когда сервер действительно стоит за своим
прокси: иначе клиент подделает `X-Forwarded-For` и обойдёт rate limit.

## Переменные окружения

| Переменная | По умолчанию | Смысл |
| --- | --- | --- |
| `PORT` | `8080` | порт HTTP API |
| `HOST` | `0.0.0.0` | адрес прослушивания |
| `ALLOWED_ORIGINS` | `https://genkaok.github.io` | список origin через запятую, которым разрешены CORS-запросы |
| `ALLOW_PRIVATE_TARGETS` | `0` | `1` — разрешить приватные/loopback-адреса (для своего интранета) |
| `TRUST_PROXY` | `0` | `1` — брать IP клиента из `X-Forwarded-For` (только за своим прокси) |

## API

База: `<API_BASE>`. Все ответы — JSON, кроме `OPTIONS` (204 без тела).

### `GET /api/health`

```json
{ "ok": true }
```

### `POST /api/check`

Тело: `{"url":"https://example.com","lang":"en"}`, `content-type: application/json`.

`lang` — необязательный код языка (`ru`, `en`, `fr`) для человекочитаемых строк.
Порядок выбора: `lang` в теле → `?lang=` → заголовок `Accept-Language` → `en`.
Машинные коды статусов и структура отчёта от языка не зависят; в ответе есть
поле `lang` с фактически использованным языком.

```json
{
  "target": "https://example.com",
  "finalUrl": "https://example.com/",
  "scannedAt": "2026-10-22T12:00:00.000Z",
  "summary": { "status": "vulnerable", "label": "подвержен",
               "counts": { "vulnerable": 2, "likely_vulnerable": 0, "not_vulnerable": 0,
                           "not_applicable": 0, "unknown": 0 } },
  "php": { "detected": true, "confidence": "high", "version": "8.4.26",
           "versionSource": "header", "sapi": "php-fpm", "sapiConfidence": "low",
           "distro": null,
           "evidence": ["X-Powered-By: PHP/8.4.26", "Server: nginx/1.24.0"] },
  "cves": [
    { "id": "CVE-2026-109618", "title": "Некорректное состояние при OOM",
      "severity": 9.2, "status": "vulnerable", "confidence": "high",
      "reason": "Версия PHP 8.4.26 ниже исправленной 8.4.27 для ветки 8.4. …",
      "evidence": ["X-Powered-By: PHP/8.4.26"],
      "advisory": "https://github.com/advisories/GHSA-w8hw-w9fx-j79w" }
  ],
  "mitigations": ["session.upload_progress.enabled = Off — …"],
  "recommendations": ["Обновите PHP до исправленной версии …"],
  "checks": [ { "name": "header:x-powered-by", "result": "present",
                "evidence": "PHP/8.4.26" } ],
  "http": { "status": 200, "requests": 1, "redirects": 0, "elapsedMs": 420 },
  "disclaimer": "Проверка пассивная …"
}
```

Ошибки: `400` — невалидный URL/тело, `403` — цель заблокирована SSRF-guard,
`415` — не JSON, `429` — rate limit (заголовок `Retry-After`), `500` — внутренняя ошибка.

### CORS

Браузеру на Pages нужно разрешение на кросс-доменный `POST`. Разрешены только
origin из `ALLOWED_ORIGINS` (точное совпадение, без wildcard):

```
Access-Control-Allow-Origin: https://genkaok.github.io
Vary: Origin
Access-Control-Allow-Methods: POST, GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Max-Age: 600
```

`OPTIONS /api/check` отвечает `204` без тела. Для чужого origin
`Access-Control-Allow-Origin` не отдаётся — браузер сам заблокирует запрос.
`Access-Control-Allow-Credentials` не включён: cookies и сессии не нужны.

## Метод проверки

1. **Не более 3 запросов** к цели, включая редиректы. Обычно хватает одного `GET /`;
   второй `HEAD` делается только если первый ответ пустой или ошибочный.
2. Только **http/https**, только порты **80/443** (при `ALLOW_PRIVATE_TARGETS=1`
   ограничение по порту снимается — для своего интранета).
3. Таймаут **10 с** на проверку, лимит тела **1 МБ**, редиректов **≤ 5**.
4. Собирается: `Server`, `X-Powered-By`, `Set-Cookie` (PHPSESSID), код ответа,
   маркеры PHP в теле (текст ошибок PHP, ссылки на `.php`, generator WordPress).
5. SAPI (`mod_php` / `php-fpm`) определяется только по косвенным признакам
   (`Server: nginx` → FPM, `Server: Apache` → mod_php) и помечается
   `sapiConfidence: "low"`. Прямое указание FPM/FastCGI — `high`, иначе `unknown`.
6. Никаких эксплойтов, фаззинга, перебора путей и портов, изменения состояния.

## Вердикты

| Статус | Когда выставляется | confidence |
| --- | --- | --- |
| `vulnerable` | версия ниже исправленной для своей ветки, признаков дистрибутива нет | high (medium, если версия найдена только в теле) |
| `likely_vulnerable` | неполная версия в EOL-ветке (например `7.4`), все релизы которой уязвимы | medium |
| `not_vulnerable` | версия не ниже исправленной для ветки, либо новее 8.5.12 | high |
| `unknown` | версия скрыта; версия неполная; сборка дистрибутива ниже фикса (возможен бэкпорт); цель недоступна | low / medium |
| `not_applicable` | признаков PHP не найдено | low |

Для дистрибутивных сборок ниже фикса (`8.1.2-1ubuntu2.14`) вердикт `unknown`:
патч мог быть бэкпортирован. В рекомендациях — команда проверки пакета
(`dpkg -l | grep php`, `apk info -v | grep php`, `rpm -qa | grep php`).

## Коды выхода CLI

| Код | Значение |
| --- | -------- |
| 0 | не подвержен, либо PHP на сервере не обнаружен (`not_applicable`) |
| 1 | подвержен или вероятно подвержен |
| 2 | неизвестно (версия не раскрыта / дистрибутив / цель недоступна) или ошибка проверки |

## Безопасность

- Заблокированы **всегда**: `169.254.0.0/16` (включая `169.254.169.254`),
  `100.100.100.200`, `::1`, `fe80::/10`, multicast, `0.0.0.0/8`,
  документационные диапазоны и metadata-хосты (`metadata.google.internal` и др.).
- Приватные диапазоны (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `100.64/10`,
  `fc00::/7`) — только с `ALLOW_PRIVATE_TARGETS=1`.
- DNS резолвится заранее, TCP-соединение идёт на **проверенный IP**
  (защита от DNS-rebinding), редиректы пересматриваются тем же guard'ом.
- URL с логином/паролем отклоняются, схема только http/https.
- Rate limit: **10 проверок в минуту на IP**, лишние — `429` с `Retry-After`.
  CORS это не ослабляет: заголовки лишь разрешают браузеру прочитать ответ.
- CORS отвечает только перечисленным origin; credentials и wildcard не используются.
- Логи содержат только метод, путь, код и время — без query-строк, заголовков и тел.

## Ограничения

- Вердикт основан на **публично раскрытой** версии PHP. Если `X-Powered-By`
  отключён (обычная практика), честный ответ — `unknown` и команда `php -v`
  на сервере.
- Бэкпорты дистрибутивов удалённо не видны: по такой сборке выставляется `unknown`.
- Проверка не подтверждает эксплуатацию и не гарантирует отсутствие уязвимости.
- `Server: nginx`/`Apache` — только косвенный признак SAPI.

## Дисклеймер

Инструмент предназначен для проверки **своих** серверов или серверов, на проверку
которых есть **письменное разрешение**. Не используйте его для проверки чужих
систем. Авторы не несут ответственности за использование вопреки этому правилу.

## Структура

```
src/scan.js             движок проверки, scan(target, opts)
src/safefetch.js        SSRF-guard, DNS-пиннинг, редиректы, лимиты
src/cve.js              данные CVE и вердикты
src/version.js          разбор и сравнение версий
src/headers.js          работа с заголовками
src/i18n.js             серверная локализация поверх общего словаря
src/server.js           HTTP API (node:http) + CORS + статика public/
public/index.html       страница проверки
public/styles.css       стили страницы, без внешних ресурсов
public/app.js           валидация, запрос к API, рендер, переключатель языка
public/i18n.js          единый словарь строк ru/en/fr (браузер и Node)
public/config.js        адрес API (пустой = same-origin)
public/.nojekyll        отключает Jekyll на GitHub Pages
docs/                   сгенерированная копия public/ — её отдаёт Pages
scripts/build-pages.js  сборка docs/ (npm run build:pages)
cli.js                  CLI
test/                   тесты node:test + фикстуры заголовков
Dockerfile              образ бэкенда (node:22-alpine)
.github/workflows/pages.yml  ручной fallback: публикация public/ через Actions
```

## Лицензия

MIT — см. [LICENSE](LICENSE).

## English (short)

Passive checker for **CVE-2026-109618** / **CVE-2026-109619** in the PHP core
(fixed in 8.5.12, 8.4.27, 8.3.36, 8.2.35). No exploitation: one or two plain
GET/HEAD requests to the site root, public headers only.

```bash
npm ci && npm test          # Node.js >= 20, no dependencies
npm start                   # site at / and API at :8080
node cli.js example.com --json
```

- **Site:** GitHub Pages serves `docs/`, a generated copy of `public/`
  (https://genkaok.github.io/haveibeenphpned/). Pages source in this repo is
  *Deploy from a branch → `main` / `/docs`*. After any change in `public/`, run
  `npm run build:pages` and commit `docs/` — never edit it by hand. The script
  also writes `docs/.nojekyll` so Pages skips Jekyll entirely.
- **API:** run the Docker image on any HTTPS host, set
  `ALLOWED_ORIGINS=https://genkaok.github.io`, then rebuild the site with
  `API_BASE=https://your-api npm run build:pages` and commit `docs/`.
  `?api=https://…` overrides it per link. Empty value means same-origin, and on
  `*.github.io` the form then shows "API is not connected".
- **CORS:** only listed origins get `Access-Control-Allow-Origin`; `OPTIONS`
  preflight returns `204` with `POST, GET, OPTIONS` and `Content-Type`.
- **Deploy:** push to `main`; Pages republishes `/docs`. `.github/workflows/pages.yml`
  stays as a manual GitHub Actions fallback only. Backend:
  `docker run -p 8080:8080 -e ALLOWED_ORIGINS=…`.

Only check servers you own or are authorized to test.
