# Исправление запуска GitHub Pages — 2026-10-11

На опубликованной игре `/magnet-sort/` появлялся `COULDN'T OPEN THE BOARD`, включая сломанную картинку магнита в диалоге. `art()` запрашивал PNG от корня домена `/art/mockup/`, где GitHub Pages возвращает 404. HTTP 200 для HTML и успешный deploy не проверяли запуск поля.

Runtime URL теперь использует `import.meta.env.BASE_URL`, совпадая с deployment base Vite. CSS URL уже обрабатываются Vite. `tools/pages-browser-check.cjs` обслуживает production `dist` исключительно под `/magnet-sort/`, проверяет отсутствие ошибок HTTP/запуска, декодирование DOM-картинок, первый ход до победы, повтор и паузу в desktop/mobile viewport. `GAME_BASE_URL` позволяет проверить опубликованную версию тем же сценарием. Workflow запускает его перед загрузкой артефакта Pages.

Проверки: текущая опубликованная версия воспроизводит диалог и 404; исправленная production-сборка проходит новый сценарий. `pnpm check:full` — тесты и сборка успешно. Логи: `artifacts/pages-before-fix.log`, `artifacts/pages-fix-browser.log`, `artifacts/pages-fix-check.log`; кадры: `artifacts/pages-browser/`. Мобильный кадр просмотрен. Это Chromium с mobile viewport, не проверка реального телефона.
