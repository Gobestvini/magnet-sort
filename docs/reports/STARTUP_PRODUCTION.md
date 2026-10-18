# Экран загрузки и production-сборка — 2026-10-18

По запросу владельца перенесены из соседнего White Tower двухэтапный startup,
контракт минимум 1000 мс видимого экрана, отсутствие видимых процентов,
логотип Plus Vibe и принципы production assets / atomic static deploy.
Логотип студии скопирован без изменения; загрузка использует игровые logo,
фон, магниты и полосу Magnet Sort. Уровни, настройки аккаунтов, Telegram,
платежи, серверные секреты и игровая механика White Tower не переносились.

CSS-прелоадер есть в первом HTML без зависимостей от изображений, шрифтов
или игрового JS. Основной shell открывается после decode его изображений.
Импорт runtime и preload текстур/UI/шрифта следуют за ним; input заблокирован
через inert до полной готовности и временного gate. Скрытое время вкладки
не засчитывается. Минимальный экран сохраняется и при reduced motion.
Ошибки shell, игрового арта, entry, runtime module и CSS дают Retry;
поздняя ошибка не открывает игровое поле. Есть 90 с timeout startup.

Vite явно минифицирует JS/CSS, отключает source maps, сохраняет относительный
base для Pages и VPS. sharp переводит PNG в WebP quality85/alpha100 без resize,
оригиналы остаются неизменными. Public целиком не копируется: модульный allowlist
и CSS dependencies попадают в content-hashed assets. PNG, преобразованные для
этой сборки: **37 546 783 → 3 041 222 bytes (−91,9%)**. Это не весь размер build;
font, JS, CSS и студийный WebP учитываются отдельно. Размеры, параметры и revision
доступны в `resource-sizes.json` / `build-info.json`.

Проверки: 199 unit tests и build (`pnpm check:full`); отдельный production loader
browser tool на 360×800, 390×844, 844×390, 1440×900, reduced motion, минимум
видимого времени, порядок стадий, ошибки пяти зависимостей и Retry.
Полный v4 gameplay smoke под `/magnet-sort/` проверяет seeded победу,
перезапуск и паузу desktop/mobile. Screenshots/logs остаются в ignored artifacts.
Публикация выполняется из отдельного чистого checkout только с изменениями
этого запроса: прежние незакоммиченные изменения board/magnet-glow/draw-order
не входят в release. Финальная публикация проверяется по revision и браузеру.

Сервер: https://play.plusvibegames.com/magnet-sort/ . Собственные
releases/current/shared внутри уже смонтированного static каталога; Caddy
дополнен только маршрутом Magnet Sort. HTML/metadata no-cache, hashed assets
immutable, HTTP transport compression наследуется от существующего host.
GitHub Pages и его workflow сохранены; CI дополнен loader browser check.
Runbook/rollback: `deploy/README.md`.

Границы: Chromium desktop/mobile viewport — browser surrogate; физический
телефон, native Telegram, глобальная задержка и нагрузка сервера не проверялись.
