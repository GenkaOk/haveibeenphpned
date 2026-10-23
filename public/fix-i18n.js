'use strict';

/**
 * Тексты страницы решения `/fix/` для ru / en / fr.
 *
 * Это отдельный модуль, а не часть `i18n.js`: главная страница не должна
 * грузить в браузер текст, который нужен только статической странице.
 * `scripts/build-pages.js` подставляет эти строки в `public/fix.html`
 * и строит из них FAQPage JSON-LD.
 *
 * `fix.faq.qN` / `fix.faq.aN` — единственный источник и для видимого FAQ,
 * и для разметки, поэтому они не расходятся.
 */
module.exports = {
  ru: {
    'meta.fixTitle': 'Старый PHP и CVE-2026-109618: что делать',
    'meta.fixDescription':
      'Пошаговое решение для PHP 7.x–8.1: обновление до 8.5.12, 8.4.27, 8.3.36 или 8.2.35, пакеты deb.sury.org с бэкпортом, проверка результата и типичные ошибки.',

    'fix.brandNote': 'старый PHP: что делать',
    'fix.skip': 'Перейти к содержимому',
    'fix.crumb.label': 'Хлебные крошки',
    'fix.crumb.home': 'Проверка',
    'fix.crumb.current': 'Что делать со старым PHP',
    'fix.kicker': 'Практическое руководство',
    'fix.title': 'У меня старый PHP — что делать',
    'fix.lede':
      'Если ваша ветка ещё поддерживается, обновитесь до 8.5.12, 8.4.27, 8.3.36 или 8.2.35. Если вы залочены на 8.1, 8.0 или 7.x, официального релиза PHP для них нет — но пакеты <a href="https://packages.sury.org/php/" rel="noopener">deb.sury.org</a> содержат бэкпорт, а Ubuntu 22.04 закрыла php8.1 обычным обновлением. Сначала проверьте версию пакета: возможно, фикс уже установлен.',
    'fix.verified': 'Дата проверки фактов: {updated}',
    'fix.backToCheck': 'Проверить сервер',

    'fix.answer.title': 'Короткий ответ',
    'fix.answer.text':
      'Обновите PHP до исправленной версии своей ветки. Если обновление невозможно, поставьте пакет с бэкпортом из репозитория дистрибутива или <a href="https://packages.sury.org/php/" rel="noopener">deb.sury.org</a>. Отключение проверок безопасности и случайные PPA проблему не решают.',
    'fix.answer.note':
      'Ветки 8.2–8.5 получают официальные релизы PHP. Для 8.1, 8.0, 7.x и 5.x официальных релизов нет, но бэкпорты выпускают дистрибутивы и Sury. Ниже — как проверить, что именно установлено, и что делать в каждом случае.',

    'fix.s1.title': 'Сценарий 1. PHP можно обновить',
    'fix.s1.intro':
      'Это лучший путь: официальный релиз содержит все исправления ветки, а не только патч для двух CVE.',
    'fix.s1.step1':
      'Узнайте ветку и точную версию: <code>php -v</code> и <code>php-fpm -v</code>. Если команды нет, найдите версию в панели хостинга.',
    'fix.s1.step2':
      'Обновите пакеты дистрибутива: <code>sudo apt update &amp;&amp; sudo apt upgrade</code> в Debian/Ubuntu или <code>sudo dnf upgrade</code> в RHEL-совместимых системах.',
    'fix.s1.step3':
      'Перезапустите PHP-FPM и веб-сервер: <code>sudo systemctl restart php8.3-fpm</code>. Без перезапуска часть воркеров останется на старом коде.',
    'fix.s1.step4':
      'Проверьте, что <code>php -v</code> показывает 8.5.12, 8.4.27, 8.3.36 или 8.2.35 для вашей ветки или новее.',
    'fix.s1.check':
      'Смотрите не только заголовок <code>X-Powered-By</code>: версия в нём может отставать от патча. Проверьте пакет: <code>dpkg -l | grep php</code> в Debian/Ubuntu или <code>rpm -q --changelog php-cli | head -40</code> в RHEL.',
    'fix.s1.note':
      'Если <code>apt upgrade</code> не предлагает обновление, проверьте, включён ли репозиторий безопасности дистрибутива.',

    'fix.s2.title': 'Сценарий 2. Вы залочены на 8.1, 8.0 или 7.x',
    'fix.s2.intro':
      'Официального релиза PHP для этих веток нет. Патч можно получить из пакета дистрибутива или из стороннего репозитория Sury. Это не официальный канал безопасности Debian/Ubuntu: сначала проверьте, нет ли фикса в вашем дистрибутиве.',
    'fix.s2.officialTitle': 'Сначала проверьте репозиторий дистрибутива',
    'fix.s2.officialText':
      'Debian 12 bookworm: <code>php8.2 8.2.35-1~deb12u1</code>; Debian 13 trixie: <code>php8.4 8.4.27-1~deb13u1</code>. Ubuntu 22.04: <code>php8.1 8.1.2-1ubuntu2.28</code>; Ubuntu 24.04: <code>php8.3 8.3.6-0ubuntu0.24.04.13</code>; Ubuntu 26.04 и 26.10: <code>php8.5</code>. Источники: <a href="https://security-tracker.debian.org/tracker/CVE-2026-109618" rel="noopener">Debian Security Tracker</a> и <a href="https://ubuntu.com/security/notices/USN-8948-1" rel="noopener">USN-8948-1</a>.',
    'fix.s2.tableDistro': 'Дистрибутив',
    'fix.s2.tablePackage': 'Пакет',
    'fix.s2.tableVersion': 'Исправленная версия',
    'fix.s2.suryTitle': 'Пакеты Sury с бэкпортом',
    'fix.s2.suryText':
      'В changelog Sury от 21 октября 2026 есть запись «Backported from 8.2.35: [CVE-2026-109618, CVE-2026-109619]». Мы проверили исходные пакеты: php8.1 8.1.34-9, php8.0 8.0.30-25, php7.4 7.4.33-31, а также 7.0–7.3 и 5.6. Патч внесён во все эти ветки; точные версии и даты — в таблице.',
    'fix.s2.tableSuryPackage': 'Пакет Sury',
    'fix.s2.tableSuryVersion': 'Версия',
    'fix.s2.tableSuryDate': 'Дата сборки',
    'fix.s2.caution':
      'Sury — сторонний репозиторий, а не официальный канал безопасности. Сделайте снимок или бэкап, протестируйте обновление на staging и не подключайте случайные PPA.',
    'fix.s2.repoTitle': 'Как подключить репозиторий Sury',
    'fix.s2.step1': 'Установите ключ и подключите репозиторий командами из официального README Sury:',
    'fix.s2.step2': 'Обновите только пакеты своей ветки. Пример для PHP 8.1:',
    'fix.s2.step2note':
      'Замените <code>8.1</code> на <code>8.0</code>, <code>7.4</code> или другую ветку. <code>--only-upgrade</code> обновляет уже установленные пакеты и не тянет лишние расширения.',
    'fix.s2.step3': 'Проверьте версию PHP, FPM и пакета:',
    'fix.s2.step4': 'Перезапустите FPM и веб-сервер:',
    'fix.s2.step4note':
      'Для nginx перезапустите <code>nginx</code>. Если на сервере несколько версий PHP, перезапустите сервис и пул нужной ветки.',

    'fix.s3.title': 'Сценарий 3. Managed-хостинг или нет root',
    'fix.s3.intro':
      'Обновление делает провайдер. Напишите в поддержку и попросите подтвердить версию пакета, а не только версию в панели.',
    'fix.s3.checkTitle': 'Что проверить в панели',
    'fix.s3.check1': 'Доступен ли выбор PHP 8.2, 8.3, 8.4 или 8.5.',
    'fix.s3.check2': 'Дата последнего обновления PHP и наличие бэкпорта для вашей ветки.',
    'fix.s3.check3': 'Перезапускаются ли воркеры PHP-FPM после смены версии.',
    'fix.s3.check4': 'Можно ли поднять staging-копию и проверить сайт до переключения.',
    'fix.s3.templateTitle': 'Шаблон обращения в поддержку',
    'fix.s3.template':
      'Здравствуйте!\n\n' +
      'На моём тарифе используется PHP [версия]. Проверьте, пожалуйста, закрыты ли в установленном пакете CVE-2026-109618 и CVE-2026-109619.\n\n' +
      'Если исправленная версия недоступна, можно ли переключить сайт на PHP 8.2 или новее либо установить пакет с бэкпортом? Если нет, какие временные меры вы поддерживаете?\n\n' +
      'Пришлите, пожалуйста, вывод php -v и версию пакета (dpkg -l | grep php или rpm -q php-cli), а также дату последнего обновления PHP.\n\n' +
      'Спасибо.',
    'fix.s3.templateNote':
      'Не отправляйте пароли, токены и данные клиентов. Достаточно версии PHP, названия тарифа и вывода <code>php -v</code>.',
    'fix.s3.noRootNote':
      'Если провайдер не может обновить PHP, единственный надёжный путь — перенос на площадку с поддерживаемой версией.',

    'fix.s4.title': 'Сценарий 4. Проверьте результат заново',
    'fix.s4.text':
      'После обновления и перезапуска вернитесь на главную и повторите пассивную проверку. Она покажет раскрытую версию PHP, но не докажет, что патч установлен: вердикт остаётся оценкой риска.',
    'fix.s4.homeLink': 'Открыть проверку',
    'fix.s4.apiText':
      'Для автоматизации: <code>POST /api/check</code> с телом <code>{"url":"https://example.com","lang":"ru"}</code>. Описание API — в <a href="https://haveibeenphpned.github.io/llms-full.txt" rel="noopener">llms-full.txt</a>.',
    'fix.s4.checklistTitle': 'Чек-лист после обновления',
    'fix.s4.check1': '<code>php -v</code> и <code>php-fpm -v</code> показывают новую версию.',
    'fix.s4.check2':
      '<code>dpkg -l | grep php</code> (или <code>rpm -q php-cli</code>) показывает исправленный пакет.',
    'fix.s4.check3': 'Сервис PHP-FPM и веб-сервер перезапущены.',
    'fix.s4.check4':
      'Повторная проверка не показывает <code>vulnerable</code> или <code>likely_vulnerable</code>.',

    'fix.dont.title': 'Чего НЕ делать',
    'fix.dont.1':
      'Не отключайте проверки безопасности, WAF, <code>open_basedir</code> и другие защиты ради совместимости со старым кодом. Это повышает риск, но не закрывает CVE.',
    'fix.dont.2':
      'Не ставьте PHP из случайных PPA и сборок с форумов: проверить наличие патча в таком пакете нельзя.',
    'fix.dont.3':
      'Не считайте, что смена версии в панели сразу перезапускает все воркеры. Проверьте <code>php -v</code> и перезапустите FPM.',
    'fix.dont.4':
      'Не оставляйте phpinfo и диагностические страницы открытыми, пока обновление не установлено.',
    'fix.dont.5':
      'Не откладывайте переход с 5.x и 7.x: бэкпорт закрывает эти две CVE, но не делает ветку поддерживаемой.',

    'fix.faq.title': 'Частые вопросы о старом PHP',
    'fix.faq.q1': 'Мой PHP 8.1. Официального фикса правда нет?',
    'fix.faq.a1':
      'Да, upstream-релиза PHP для 8.1 нет. Но Ubuntu 22.04 и Sury выпустили пакеты с бэкпортом: проверьте версию пакета, а не только версию PHP.',
    'fix.faq.q2': 'Можно ли просто обновить PHP до 8.5?',
    'fix.faq.a2':
      'Да, если приложение совместимо. 8.5 — самая новая ветка, но сначала проверьте расширения и тесты на staging.',
    'fix.faq.q3': 'Безопасно ли использовать deb.sury.org?',
    'fix.faq.a3':
      'Это популярный сторонний репозиторий, но не официальный канал безопасности Debian/Ubuntu. Подключайте его только по официальному README, с бэкапом и проверкой changelog.',
    'fix.faq.q4': 'Как понять, что патч уже установлен?',
    'fix.faq.a4':
      'Посмотрите версию пакета и changelog: <code>dpkg -l | grep php</code> и <code>apt-get changelog php8.1</code>. Версия в заголовке <code>X-Powered-By</code> может быть старой.',
    'fix.faq.q5': 'Нужно ли перезапускать сервер после обновления?',
    'fix.faq.a5':
      'Да. Перезапустите PHP-FPM и веб-сервер, иначе часть воркеров останется на старом коде.',
    'fix.faq.q6': 'Сработает ли проверка, если PHP скрыт?',
    'fix.faq.a6':
      'Нет. Вердикт будет <code>unknown</code>: проверьте версию на сервере командой <code>php -v</code>.',
    'fix.faq.q7': 'Что делать, если хостинг не обновляет PHP?',
    'fix.faq.a7':
      'Напишите провайдеру по шаблону выше и попросите версию пакета. Если фикса нет, переносите сайт на площадку с PHP 8.2 или новее.',
    'fix.faq.q8': 'Можно ли обойтись временными мерами?',
    'fix.faq.a8':
      'Они снижают риск, но не заменяют патч. Отключение <code>session.upload_progress</code> и лимиты запросов не закрывают CVE полностью.',
    'fix.faq.q9': 'Это применимо к PHP 5.6?',
    'fix.faq.a9':
      'Sury пересобрал и 5.6 с бэкпортом, но ветка давно не поддерживается. Для продакшена нужен переход на 8.2 или новее.',
    'fix.faq.q10': 'Где первоисточники?',
    'fix.faq.a10':
      'Ссылки на Debian Security Tracker, USN-8948-1 и changelog Sury — в разделе «Источники» внизу страницы.',

    'fix.sources.title': 'Источники и проверка фактов',
    'fix.sources.intro':
      'Версии и даты сверены с первоисточниками. Если пакет обновили после публикации, ориентируйтесь на его changelog.',
    'fix.sources.debian1':
      'Debian Security Tracker: исправленные php8.2 в bookworm и php8.4 в trixie.',
    'fix.sources.debian2': 'Тот же трекер для второй CVE; исправления совпадают.',
    'fix.sources.usn':
      'Ubuntu USN-8948-1: php8.1 в 22.04, php8.3 в 24.04, php8.5 в 26.04 и 26.10.',
    'fix.sources.sury81':
      'Исходный пакет Sury 8.1.34-9: в debian/changelog запись «Backported from 8.2.35: [CVE-2026-109618, CVE-2026-109619]».',
    'fix.sources.sury74':
      'Исходные пакеты 7.4.33-31 и 8.0.30-25: та же запись в changelog.',
    'fix.sources.readme': 'README packages.sury.org: ключ и команды подключения репозитория.',
    'fix.footer.disclaimer':
      'Это практическое руководство, а не официальный security advisory. Проверяйте только свои серверы или серверы, на проверку которых есть разрешение.',
    'fix.footer.updated': 'Обновлено {updated}',
  },

  en: {
    'meta.fixTitle': 'Old PHP and CVE-2026-109618: what to do',
    'meta.fixDescription':
      'A step-by-step fix for PHP 7.x–8.1: upgrade to 8.5.12, 8.4.27, 8.3.36 or 8.2.35, use deb.sury.org backports, re-check the server and avoid common mistakes.',

    'fix.brandNote': 'old PHP guide',
    'fix.skip': 'Skip to content',
    'fix.crumb.label': 'Breadcrumb',
    'fix.crumb.home': 'Check',
    'fix.crumb.current': 'What to do about old PHP',
    'fix.kicker': 'Practical guide',
    'fix.title': 'I’m stuck on old PHP — what should I do?',
    'fix.lede':
      'If your branch is still supported, upgrade to 8.5.12, 8.4.27, 8.3.36 or 8.2.35. If you are stuck on 8.1, 8.0 or 7.x, upstream PHP has no release for you — but <a href="https://packages.sury.org/php/" rel="noopener">deb.sury.org</a> packages contain the backport, and Ubuntu 22.04 fixed php8.1 with a regular update. Check the package version first: the fix may already be installed.',
    'fix.verified': 'Facts checked against primary sources on {updated}.',
    'fix.backToCheck': 'Check the server',

    'fix.answer.title': 'Short answer',
    'fix.answer.text':
      'Upgrade PHP to the fixed release for your branch. If you cannot upgrade, install a backported package from your distribution or <a href="https://packages.sury.org/php/" rel="noopener">deb.sury.org</a>. Disabling security checks and random PPAs do not solve the problem.',
    'fix.answer.note':
      'Branches 8.2–8.5 get official PHP releases. There are no official releases for 8.1, 8.0, 7.x and 5.x, but distributions and Sury publish backports. Below: how to check what is installed and what to do in each case.',

    'fix.s1.title': 'Scenario 1. You can upgrade PHP',
    'fix.s1.intro':
      'This is the best path: an official release contains all fixes for the branch, not only the patch for these two CVEs.',
    'fix.s1.step1':
      'Find the branch and exact version: <code>php -v</code> and <code>php-fpm -v</code>. If the commands are missing, check the hosting panel.',
    'fix.s1.step2':
      'Upgrade the distribution packages: <code>sudo apt update &amp;&amp; sudo apt upgrade</code> on Debian/Ubuntu or <code>sudo dnf upgrade</code> on RHEL-compatible systems.',
    'fix.s1.step3':
      'Restart PHP-FPM and the web server: <code>sudo systemctl restart php8.3-fpm</code>. Without a restart, some workers keep the old code.',
    'fix.s1.step4':
      'Make sure <code>php -v</code> shows 8.5.12, 8.4.27, 8.3.36 or 8.2.35 for your branch, or newer.',
    'fix.s1.check':
      'Do not rely on the <code>X-Powered-By</code> header alone: its version can lag behind the patch. Check the package: <code>dpkg -l | grep php</code> on Debian/Ubuntu or <code>rpm -q --changelog php-cli | head -40</code> on RHEL.',
    'fix.s1.note':
      'If <code>apt upgrade</code> offers nothing, make sure the distribution security repository is enabled.',

    'fix.s2.title': 'Scenario 2. You are locked to 8.1, 8.0 or 7.x',
    'fix.s2.intro':
      'There is no official PHP release for these branches. You can get the patch from a distribution package or from the third-party Sury repository. Sury is not the official Debian/Ubuntu security channel: first check whether your distribution already has the fix.',
    'fix.s2.officialTitle': 'First check your distribution repository',
    'fix.s2.officialText':
      'Debian 12 bookworm: <code>php8.2 8.2.35-1~deb12u1</code>; Debian 13 trixie: <code>php8.4 8.4.27-1~deb13u1</code>. Ubuntu 22.04: <code>php8.1 8.1.2-1ubuntu2.28</code>; Ubuntu 24.04: <code>php8.3 8.3.6-0ubuntu0.24.04.13</code>; Ubuntu 26.04 and 26.10: <code>php8.5</code>. Sources: <a href="https://security-tracker.debian.org/tracker/CVE-2026-109618" rel="noopener">Debian Security Tracker</a> and <a href="https://ubuntu.com/security/notices/USN-8948-1" rel="noopener">USN-8948-1</a>.',
    'fix.s2.tableDistro': 'Distribution',
    'fix.s2.tablePackage': 'Package',
    'fix.s2.tableVersion': 'Fixed version',
    'fix.s2.suryTitle': 'Sury packages with the backport',
    'fix.s2.suryText':
      'Sury’s changelog for 21 October 2026 says “Backported from 8.2.35: [CVE-2026-109618, CVE-2026-109619]”. We checked the source packages: php8.1 8.1.34-9, php8.0 8.0.30-25, php7.4 7.4.33-31, plus 7.0–7.3 and 5.6. The patch is present in all these branches; exact versions and dates are in the table.',
    'fix.s2.tableSuryPackage': 'Sury package',
    'fix.s2.tableSuryVersion': 'Version',
    'fix.s2.tableSuryDate': 'Build date',
    'fix.s2.caution':
      'Sury is a third-party repository, not an official security channel. Take a snapshot or backup, test the upgrade on staging, and do not add random PPAs.',
    'fix.s2.repoTitle': 'How to add the Sury repository',
    'fix.s2.step1': 'Install the key and add the repository with the commands from the official Sury README:',
    'fix.s2.step2': 'Upgrade only the packages of your branch. Example for PHP 8.1:',
    'fix.s2.step2note':
      'Replace <code>8.1</code> with <code>8.0</code>, <code>7.4</code> or another branch. <code>--only-upgrade</code> upgrades installed packages and does not pull extra extensions.',
    'fix.s2.step3': 'Check the PHP, FPM and package versions:',
    'fix.s2.step4': 'Restart FPM and the web server:',
    'fix.s2.step4note':
      'For nginx, restart <code>nginx</code>. If the server runs several PHP versions, restart the service and pool of the branch you changed.',

    'fix.s3.title': 'Scenario 3. Managed hosting or no root access',
    'fix.s3.intro':
      'The provider performs the upgrade. Ask support to confirm the package version, not only the version shown in the panel.',
    'fix.s3.checkTitle': 'What to check in the panel',
    'fix.s3.check1': 'Whether PHP 8.2, 8.3, 8.4 or 8.5 is available.',
    'fix.s3.check2': 'The date of the last PHP update and whether your branch has a backport.',
    'fix.s3.check3': 'Whether PHP-FPM workers restart after a version change.',
    'fix.s3.check4': 'Whether you can run a staging copy and test the site before switching.',
    'fix.s3.templateTitle': 'Message template for support',
    'fix.s3.template':
      'Hello,\n\n' +
      'My hosting plan uses PHP [version]. Please confirm whether CVE-2026-109618 and CVE-2026-109619 are fixed in the installed PHP package.\n\n' +
      'If the fixed version is not available, can you switch the site to PHP 8.2 or newer, or install a backported package? If not, which temporary mitigations do you support?\n\n' +
      'Please send the output of php -v and the package version (dpkg -l | grep php or rpm -q php-cli), plus the date of the last PHP update.\n\n' +
      'Thank you.',
    'fix.s3.templateNote':
      'Do not send passwords, tokens or customer data. The PHP version, plan name and <code>php -v</code> output are enough.',
    'fix.s3.noRootNote':
      'If the provider cannot upgrade PHP, the only reliable path is to move the site to a platform with a supported version.',

    'fix.s4.title': 'Scenario 4. Check the result again',
    'fix.s4.text':
      'After the upgrade and restart, return to the main page and run the passive check again. It shows the disclosed PHP version but does not prove that the patch is installed: the verdict remains a risk estimate.',
    'fix.s4.homeLink': 'Open the check',
    'fix.s4.apiText':
      'For automation: <code>POST /api/check</code> with a body of <code>{"url":"https://example.com","lang":"en"}</code>. The API is described in <a href="https://haveibeenphpned.github.io/llms-full.txt" rel="noopener">llms-full.txt</a>.',
    'fix.s4.checklistTitle': 'Post-upgrade checklist',
    'fix.s4.check1': '<code>php -v</code> and <code>php-fpm -v</code> show the new version.',
    'fix.s4.check2':
      '<code>dpkg -l | grep php</code> (or <code>rpm -q php-cli</code>) shows the fixed package.',
    'fix.s4.check3': 'The PHP-FPM service and the web server were restarted.',
    'fix.s4.check4':
      'The new check does not show <code>vulnerable</code> or <code>likely_vulnerable</code>.',

    'fix.dont.title': 'What NOT to do',
    'fix.dont.1':
      'Do not disable security checks, a WAF, <code>open_basedir</code> or other protections for compatibility with old code. That raises risk and does not close the CVE.',
    'fix.dont.2':
      'Do not install PHP from random PPAs or forum builds: you cannot verify that the package contains the patch.',
    'fix.dont.3':
      'Do not assume that changing the version in a panel restarts every worker. Check <code>php -v</code> and restart FPM.',
    'fix.dont.4': 'Do not leave phpinfo or diagnostic pages public until the update is installed.',
    'fix.dont.5':
      'Do not postpone moving off 5.x and 7.x: the backport closes these two CVEs but does not make the branch supported.',

    'fix.faq.title': 'Frequently asked questions about old PHP',
    'fix.faq.q1': 'My PHP is 8.1. Is it true that there is no official fix?',
    'fix.faq.a1':
      'Yes, there is no upstream PHP release for 8.1. But Ubuntu 22.04 and Sury published backported packages: check the package version, not only the PHP version.',
    'fix.faq.q2': 'Can I just upgrade PHP to 8.5?',
    'fix.faq.a2':
      'Yes, if the application is compatible. 8.5 is the newest branch, but test extensions and the site on staging first.',
    'fix.faq.q3': 'Is deb.sury.org safe to use?',
    'fix.faq.a3':
      'It is a popular third-party repository, but not the official Debian/Ubuntu security channel. Add it only from the official README, with a backup and a changelog check.',
    'fix.faq.q4': 'How do I know the patch is already installed?',
    'fix.faq.a4':
      'Check the package version and changelog: <code>dpkg -l | grep php</code> and <code>apt-get changelog php8.1</code>. The <code>X-Powered-By</code> header version can be old.',
    'fix.faq.q5': 'Do I need to restart the server after the update?',
    'fix.faq.a5':
      'Yes. Restart PHP-FPM and the web server, otherwise some workers keep the old code.',
    'fix.faq.q6': 'Does the check work if PHP is hidden?',
    'fix.faq.a6':
      'No. The verdict will be <code>unknown</code>: check the version on the server with <code>php -v</code>.',
    'fix.faq.q7': 'What if my hosting provider does not update PHP?',
    'fix.faq.a7':
      'Send the template above and ask for the package version. If there is no fix, move the site to a platform with PHP 8.2 or newer.',
    'fix.faq.q8': 'Are temporary mitigations enough?',
    'fix.faq.a8':
      'They reduce risk but do not replace the patch. Disabling <code>session.upload_progress</code> and request limits do not fully close the CVE.',
    'fix.faq.q9': 'Does this apply to PHP 5.6?',
    'fix.faq.a9':
      'Sury also rebuilt 5.6 with the backport, but the branch has been unsupported for years. Production needs PHP 8.2 or newer.',
    'fix.faq.q10': 'Where are the primary sources?',
    'fix.faq.a10':
      'Links to the Debian Security Tracker, USN-8948-1 and the Sury changelog are in the Sources section at the bottom of this page.',

    'fix.sources.title': 'Sources and fact check',
    'fix.sources.intro':
      'Versions and dates were checked against primary sources. If a package was updated after publication, trust its changelog.',
    'fix.sources.debian1':
      'Debian Security Tracker: fixed php8.2 in bookworm and php8.4 in trixie.',
    'fix.sources.debian2': 'The same tracker for the second CVE; the fixes match.',
    'fix.sources.usn':
      'Ubuntu USN-8948-1: php8.1 on 22.04, php8.3 on 24.04, php8.5 on 26.04 and 26.10.',
    'fix.sources.sury81':
      'Sury source package 8.1.34-9: debian/changelog says “Backported from 8.2.35: [CVE-2026-109618, CVE-2026-109619]”.',
    'fix.sources.sury74': 'Source packages 7.4.33-31 and 8.0.30-25: the same changelog entry.',
    'fix.sources.readme': 'packages.sury.org README: key and repository setup commands.',
    'fix.footer.disclaimer':
      'This is a practical guide, not an official security advisory. Check only your own servers or servers you have permission to check.',
    'fix.footer.updated': 'Updated {updated}',
  },

  fr: {
    'meta.fixTitle': 'PHP ancien et CVE-2026-109618 : que faire',
    'meta.fixDescription':
      'Guide pas à pas pour PHP 7.x–8.1 : mise à jour vers 8.5.12, 8.4.27, 8.3.36 ou 8.2.35, paquets Sury rétroportés, vérification et pièges à éviter.',

    'fix.brandNote': 'guide PHP ancien',
    'fix.skip': 'Aller au contenu',
    'fix.crumb.label': 'Fil d’Ariane',
    'fix.crumb.home': 'Vérification',
    'fix.crumb.current': 'Que faire avec un PHP ancien',
    'fix.kicker': 'Guide pratique',
    'fix.title': 'Mon PHP est ancien — que faire ?',
    'fix.lede':
      'Si votre branche est encore prise en charge, passez à 8.5.12, 8.4.27, 8.3.36 ou 8.2.35. Si vous êtes bloqué sur 8.1, 8.0 ou 7.x, PHP amont n’a pas de version pour vous — mais les paquets <a href="https://packages.sury.org/php/" rel="noopener">deb.sury.org</a> contiennent le rétroportage, et Ubuntu 22.04 a corrigé php8.1 par une mise à jour normale. Vérifiez d’abord la version du paquet : le correctif est peut-être déjà installé.',
    'fix.verified': 'Faits vérifiés auprès des sources primaires le {updated}.',
    'fix.backToCheck': 'Vérifier le serveur',

    'fix.answer.title': 'Réponse courte',
    'fix.answer.text':
      'Mettez PHP à jour vers la version corrigée de votre branche. Si la mise à jour est impossible, installez un paquet rétroporté du dépôt de votre distribution ou de <a href="https://packages.sury.org/php/" rel="noopener">deb.sury.org</a>. Désactiver les contrôles de sécurité et ajouter des PPA au hasard ne résout pas le problème.',
    'fix.answer.note':
      'Les branches 8.2–8.5 reçoivent des versions officielles de PHP. Il n’y a pas de version officielle pour 8.1, 8.0, 7.x et 5.x, mais les distributions et Sury publient des rétroportages. Ci-dessous : comment vérifier ce qui est installé et quoi faire dans chaque cas.',

    'fix.s1.title': 'Scénario 1. PHP peut être mis à jour',
    'fix.s1.intro':
      'C’est la meilleure voie : une version officielle contient tous les correctifs de la branche, pas seulement celui de ces deux CVE.',
    'fix.s1.step1':
      'Identifiez la branche et la version exacte : <code>php -v</code> et <code>php-fpm -v</code>. Si les commandes manquent, cherchez la version dans le panneau d’hébergement.',
    'fix.s1.step2':
      'Mettez à jour les paquets de la distribution : <code>sudo apt update &amp;&amp; sudo apt upgrade</code> sous Debian/Ubuntu ou <code>sudo dnf upgrade</code> sous RHEL.',
    'fix.s1.step3':
      'Redémarrez PHP-FPM et le serveur web : <code>sudo systemctl restart php8.3-fpm</code>. Sans redémarrage, certains workers gardent l’ancien code.',
    'fix.s1.step4':
      'Vérifiez que <code>php -v</code> affiche 8.5.12, 8.4.27, 8.3.36 ou 8.2.35 pour votre branche, ou plus récent.',
    'fix.s1.check':
      'Ne vous fiez pas seulement à l’en-tête <code>X-Powered-By</code> : sa version peut être antérieure au correctif. Vérifiez le paquet : <code>dpkg -l | grep php</code> sous Debian/Ubuntu ou <code>rpm -q --changelog php-cli | head -40</code> sous RHEL.',
    'fix.s1.note':
      'Si <code>apt upgrade</code> ne propose rien, vérifiez que le dépôt de sécurité de la distribution est activé.',

    'fix.s2.title': 'Scénario 2. Vous êtes bloqué sur 8.1, 8.0 ou 7.x',
    'fix.s2.intro':
      'Il n’y a pas de version officielle de PHP pour ces branches. Le correctif peut venir d’un paquet de la distribution ou du dépôt tiers Sury. Sury n’est pas le canal de sécurité officiel de Debian/Ubuntu : vérifiez d’abord si votre distribution propose déjà le correctif.',
    'fix.s2.officialTitle': 'Vérifiez d’abord le dépôt de votre distribution',
    'fix.s2.officialText':
      'Debian 12 bookworm : <code>php8.2 8.2.35-1~deb12u1</code> ; Debian 13 trixie : <code>php8.4 8.4.27-1~deb13u1</code>. Ubuntu 22.04 : <code>php8.1 8.1.2-1ubuntu2.28</code> ; Ubuntu 24.04 : <code>php8.3 8.3.6-0ubuntu0.24.04.13</code> ; Ubuntu 26.04 et 26.10 : <code>php8.5</code>. Sources : <a href="https://security-tracker.debian.org/tracker/CVE-2026-109618" rel="noopener">Debian Security Tracker</a> et <a href="https://ubuntu.com/security/notices/USN-8948-1" rel="noopener">USN-8948-1</a>.',
    'fix.s2.tableDistro': 'Distribution',
    'fix.s2.tablePackage': 'Paquet',
    'fix.s2.tableVersion': 'Version corrigée',
    'fix.s2.suryTitle': 'Paquets Sury avec rétroportage',
    'fix.s2.suryText':
      'Le changelog Sury du 21 octobre 2026 contient « Backported from 8.2.35: [CVE-2026-109618, CVE-2026-109619] ». Nous avons vérifié les paquets sources : php8.1 8.1.34-9, php8.0 8.0.30-25, php7.4 7.4.33-31, ainsi que 7.0–7.3 et 5.6. Le correctif est présent dans toutes ces branches ; les versions et dates exactes sont dans le tableau.',
    'fix.s2.tableSuryPackage': 'Paquet Sury',
    'fix.s2.tableSuryVersion': 'Version',
    'fix.s2.tableSuryDate': 'Date de compilation',
    'fix.s2.caution':
      'Sury est un dépôt tiers, pas un canal de sécurité officiel. Faites un instantané ou une sauvegarde, testez la mise à jour sur un environnement de recette et n’ajoutez pas de PPA au hasard.',
    'fix.s2.repoTitle': 'Comment ajouter le dépôt Sury',
    'fix.s2.step1': 'Installez la clé et ajoutez le dépôt avec les commandes du README officiel Sury :',
    'fix.s2.step2': 'Mettez à jour uniquement les paquets de votre branche. Exemple pour PHP 8.1 :',
    'fix.s2.step2note':
      'Remplacez <code>8.1</code> par <code>8.0</code>, <code>7.4</code> ou une autre branche. <code>--only-upgrade</code> met à jour les paquets déjà installés et n’ajoute pas d’extensions inutiles.',
    'fix.s2.step3': 'Vérifiez les versions de PHP, FPM et du paquet :',
    'fix.s2.step4': 'Redémarrez FPM et le serveur web :',
    'fix.s2.step4note':
      'Pour nginx, redémarrez <code>nginx</code>. Si le serveur héberge plusieurs versions de PHP, redémarrez le service et le pool de la branche concernée.',

    'fix.s3.title': 'Scénario 3. Hébergement managé ou pas d’accès root',
    'fix.s3.intro':
      'C’est l’hébergeur qui effectue la mise à jour. Demandez au support de confirmer la version du paquet, pas seulement celle du panneau.',
    'fix.s3.checkTitle': 'Ce qu’il faut vérifier dans le panneau',
    'fix.s3.check1': 'La disponibilité de PHP 8.2, 8.3, 8.4 ou 8.5.',
    'fix.s3.check2': 'La date de la dernière mise à jour de PHP et l’existence d’un rétroportage pour votre branche.',
    'fix.s3.check3': 'Le redémarrage des workers PHP-FPM après un changement de version.',
    'fix.s3.check4': 'La possibilité de lancer une copie de recette et de tester le site avant le basculement.',
    'fix.s3.templateTitle': 'Modèle de message au support',
    'fix.s3.template':
      'Bonjour,\n\n' +
      'Mon hébergement utilise PHP [version]. Pouvez-vous confirmer que CVE-2026-109618 et CVE-2026-109619 sont corrigées dans le paquet PHP installé ?\n\n' +
      'Si la version corrigée n’est pas disponible, pouvez-vous basculer le site sur PHP 8.2 ou plus récent, ou installer un paquet rétroporté ? Sinon, quelles mesures temporaires prenez-vous en charge ?\n\n' +
      'Merci de m’envoyer la sortie de php -v et la version du paquet (dpkg -l | grep php ou rpm -q php-cli), ainsi que la date de la dernière mise à jour de PHP.\n\n' +
      'Merci.',
    'fix.s3.templateNote':
      'N’envoyez pas de mots de passe, de jetons ni de données clients. La version de PHP, le nom de l’offre et la sortie de <code>php -v</code> suffisent.',
    'fix.s3.noRootNote':
      'Si l’hébergeur ne peut pas mettre PHP à jour, la seule voie fiable est de déplacer le site vers une plateforme avec une version prise en charge.',

    'fix.s4.title': 'Scénario 4. Vérifiez à nouveau le résultat',
    'fix.s4.text':
      'Après la mise à jour et le redémarrage, revenez à la page principale et relancez la vérification passive. Elle affiche la version de PHP divulguée, mais ne prouve pas que le correctif est installé : le verdict reste une estimation du risque.',
    'fix.s4.homeLink': 'Ouvrir la vérification',
    'fix.s4.apiText':
      'Pour l’automatisation : <code>POST /api/check</code> avec le corps <code>{"url":"https://example.com","lang":"fr"}</code>. L’API est décrite dans <a href="https://haveibeenphpned.github.io/llms-full.txt" rel="noopener">llms-full.txt</a>.',
    'fix.s4.checklistTitle': 'Liste de contrôle après la mise à jour',
    'fix.s4.check1': '<code>php -v</code> et <code>php-fpm -v</code> affichent la nouvelle version.',
    'fix.s4.check2':
      '<code>dpkg -l | grep php</code> (ou <code>rpm -q php-cli</code>) affiche le paquet corrigé.',
    'fix.s4.check3': 'Le service PHP-FPM et le serveur web ont été redémarrés.',
    'fix.s4.check4':
      'La nouvelle vérification n’affiche ni <code>vulnerable</code> ni <code>likely_vulnerable</code>.',

    'fix.dont.title': 'Ce qu’il ne faut PAS faire',
    'fix.dont.1':
      'Ne désactivez pas les contrôles de sécurité, le WAF, <code>open_basedir</code> ou d’autres protections pour rester compatible avec du vieux code. Cela augmente le risque sans corriger la CVE.',
    'fix.dont.2':
      'N’installez pas PHP depuis des PPA au hasard ou des compilations trouvées sur un forum : vous ne pouvez pas vérifier que le paquet contient le correctif.',
    'fix.dont.3':
      'Ne croyez pas qu’un changement de version dans le panneau redémarre tous les workers. Vérifiez <code>php -v</code> et redémarrez FPM.',
    'fix.dont.4':
      'Ne laissez pas phpinfo ni les pages de diagnostic accessibles avant l’installation de la mise à jour.',
    'fix.dont.5':
      'Ne repoussez pas la sortie de 5.x et 7.x : le rétroportage corrige ces deux CVE mais ne rend pas la branche prise en charge.',

    'fix.faq.title': 'Questions fréquentes sur PHP ancien',
    'fix.faq.q1': 'Mon PHP est en 8.1. N’y a-t-il vraiment pas de correctif officiel ?',
    'fix.faq.a1':
      'Oui, il n’y a pas de version amont de PHP pour 8.1. Mais Ubuntu 22.04 et Sury ont publié des paquets rétroportés : vérifiez la version du paquet, pas seulement celle de PHP.',
    'fix.faq.q2': 'Puis-je simplement passer à PHP 8.5 ?',
    'fix.faq.a2':
      'Oui, si l’application est compatible. 8.5 est la branche la plus récente, mais testez d’abord les extensions et le site sur un environnement de recette.',
    'fix.faq.q3': 'deb.sury.org est-il sûr ?',
    'fix.faq.a3':
      'C’est un dépôt tiers populaire, mais pas le canal de sécurité officiel de Debian/Ubuntu. Ajoutez-le uniquement depuis le README officiel, avec une sauvegarde et une vérification du changelog.',
    'fix.faq.q4': 'Comment savoir si le correctif est déjà installé ?',
    'fix.faq.a4':
      'Vérifiez la version du paquet et le changelog : <code>dpkg -l | grep php</code> et <code>apt-get changelog php8.1</code>. La version de l’en-tête <code>X-Powered-By</code> peut être ancienne.',
    'fix.faq.q5': 'Faut-il redémarrer le serveur après la mise à jour ?',
    'fix.faq.a5':
      'Oui. Redémarrez PHP-FPM et le serveur web, sinon certains workers gardent l’ancien code.',
    'fix.faq.q6': 'La vérification fonctionne-t-elle si PHP est masqué ?',
    'fix.faq.a6':
      'Non. Le verdict sera <code>unknown</code> : vérifiez la version sur le serveur avec <code>php -v</code>.',
    'fix.faq.q7': 'Que faire si mon hébergeur ne met pas PHP à jour ?',
    'fix.faq.a7':
      'Envoyez le modèle ci-dessus et demandez la version du paquet. S’il n’y a pas de correctif, déplacez le site vers une plateforme avec PHP 8.2 ou plus récent.',
    'fix.faq.q8': 'Les mesures temporaires suffisent-elles ?',
    'fix.faq.a8':
      'Elles réduisent le risque mais ne remplacent pas le correctif. Désactiver <code>session.upload_progress</code> et limiter les requêtes ne corrigent pas complètement la CVE.',
    'fix.faq.q9': 'Cela s’applique-t-il à PHP 5.6 ?',
    'fix.faq.a9':
      'Sury a aussi reconstruit 5.6 avec le rétroportage, mais la branche n’est plus prise en charge depuis longtemps. La production exige PHP 8.2 ou plus récent.',
    'fix.faq.q10': 'Où sont les sources primaires ?',
    'fix.faq.a10':
      'Les liens vers le Debian Security Tracker, USN-8948-1 et le changelog Sury se trouvent dans la section « Sources » en bas de page.',

    'fix.sources.title': 'Sources et vérification des faits',
    'fix.sources.intro':
      'Les versions et les dates ont été vérifiées auprès des sources primaires. Si un paquet a été mis à jour après publication, fiez-vous à son changelog.',
    'fix.sources.debian1':
      'Debian Security Tracker : php8.2 corrigé dans bookworm et php8.4 dans trixie.',
    'fix.sources.debian2': 'Le même tracker pour la seconde CVE ; les correctifs coïncident.',
    'fix.sources.usn':
      'Ubuntu USN-8948-1 : php8.1 sur 22.04, php8.3 sur 24.04, php8.5 sur 26.04 et 26.10.',
    'fix.sources.sury81':
      'Paquet source Sury 8.1.34-9 : debian/changelog indique « Backported from 8.2.35: [CVE-2026-109618, CVE-2026-109619] ».',
    'fix.sources.sury74':
      'Paquets sources 7.4.33-31 et 8.0.30-25 : la même entrée de changelog.',
    'fix.sources.readme':
      'README packages.sury.org : clé et commandes d’ajout du dépôt.',
    'fix.footer.disclaimer':
      'Ceci est un guide pratique, pas un avis de sécurité officiel. Ne vérifiez que vos propres serveurs ou ceux pour lesquels vous avez une autorisation.',
    'fix.footer.updated': 'Mis à jour le {updated}',
  },
};
