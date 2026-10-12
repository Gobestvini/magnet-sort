# TASK-0045: Перенести новый экран победы и затемнение в игру

- Статус: done
- Приоритет: high
- Создана: 2026-10-12
- Обновлена: 2026-10-12
- Проект: Magnet Sort — https://github.com/Gobestvini/magnet-sort
- Рекомендуемый исполнитель: средняя; высокий — интеграция result/lifecycle/accessibility
- Зависимости: TASK-0044

## 1. Цель и запрос пользователя

Внедрить подготовленный в TASK-0044 экран победы в активный runtime, сохранив реальные результаты и действия.

Подготовка по новому запросу с create-task; реализация этим заданием не запускается. [Общая карта](FOLLOWUP-2026-10-12.md).

## 2. Проверенный контекст

Проверено чтением кода и original background.png 2026-10-12. HEAD `5517c4c5109f126dc2c264f879d2bd1eb77f39c8`, main; Three.js0.186.1/Preact, active rules4.

`App.js`: Modal focus trap и restore focus, PrototypeApp result зависит от terminal и phase; кнопки onNext/onReset. `prototype.css`: victory-dialog отключает затемнение отдельным override; это подтверждённая причина отсутствия затемнения, не гипотеза. `VictoryParticles.js`: привязан к runId/reduced/active. `assets.js`: preload/decode/error/retry/BASE_URL. `runtime.js`: displayedCleared приходит из frame.collected, result после timeline.

Ранее существующие локальные изменения: src/prototype/board.js, src/prototype/magnet-glow.js, untracked src/prototype/draw-order.js и .codex-remote-attachments/. Не включать их автоматически в свои commit. Новый запрос меняет решения завершённых0041/0033, но не удаляет их исторические отчёты.

## 3. Область изменений

App.js/CSS/assets/VictoryParticles только при необходимости; public/art/victory-v2 или mockup v2 PNG, профильные browser tests и renderer docs. Модель/пороги/генерацию/фон не менять. Использовать manifest44, не перерисовывать макет заново.

Документы текущей версии: docs/design/GDD_V0.4.md и THREE_RENDERING.md. PIXI_RENDERING.md явно legacy; переносимые §§«Сцена и владельцы», «Ассеты и загрузка», «Производительность и графика», «Lifecycle и качество» docs/knowledge/pixijs-practices.md применимы без Pixi API в Three runtime; для45/46 также «Ввод и hit testing». Применять game-quality; для генерации imagegen, для объёмного контекста ai-economy. Не добавлять соседние рефакторинги.

## 4. Требуемое поведение

Убрать override background:none у victory-dialog и поставить затемнение по spec44 поверх игрового поля. Карточка и CTA выше overlay; нижележащий game-view inert, клики/drag сквозь overlay невозможны. Все тексты/числа DOM, state.stars/movesUsed/cleared/goal реальные; отображаются только заработанные звёзды, без декоративных ложных наград. Победа после последнего прибытия/деактивации, не по раннему model terminal. Next level/Play again/Play from start вызывают существующие handlers. Сохранить dialog accessible name Victory, result region Result, клавиатурный focus trap, contrast, reduced entry. VictoryParticles не закрывают текст, не перезапускаются на pause/resume и чистятся при reset/next/dispose. Новый фон может быть изменён43 независимо — overlay/card не зависят от его размеров.

Сохранить английский UI, доступные controls, pause/reset/hidden/dispose и reduced motion в применимой области.

## 5. План для исполнителя

1. Проверить done44 и прочитать все spec/assets; сверить current App/runtime.
2. Подключить подготовленные ассеты через общий loader до ввода, реализовать DOM-композицию и затемнение44.
3. Привязать live state/CTA, сохранить overlay/focus/phase gate и bounded burst.
4. Обновить browser assertions под финальную разметку/тексты, сохраняя реальные победы и result accessible contract.
5. Снять actual runtime vs mockup и записать отклонения, выполнить checks/deploy.

## 6. Критерии готовности

- [x] Runtime result визуально соответствует44, с явным затемнением и без старой обрезанной композиции.
- [x] Данные/звёзды настоящие; result не показывается до конца начисления, CTA работают.
- [x] Focus/keyboard, inert board, reduced/pause/reset/next и cleanup сохранены.
- [x] Обязательные проверки реально выполнены, результаты/недоступные сценарии записаны, отчёт и INDEX обновлены.
- [x] Коммит только своих изменений, push текущей ветки и доставка проверенного commit в remote main без force; success deploy-pages.yml и проверка опубликованной игры. При сбое сохранить commit/причину и не объявлять все критерии done.

## 7. Проверки

### Автоматические

Из корня проекта:

pnpm check:full; pnpm test:browser (pnpm dev/GAME_BASE_URL); node tools/v4-visual-check.cjs; node tools/pages-browser-check.cjs. Проверять computed background opacity, отсутствие клика сквозь dialog, actual stars/counts и handlers; screenshots по каждой компоновке. Обновить selectors только при реальной смене UI, не ослаблять victory checks.

Логи на диске, в отчёт итог/exit code/строки ошибок. Для dirty checkout проверять закоммиченный tree отдельно. Известно из5517c4c: native campaign crash во вложенной OneDrive-копии, тот же tree прошёл по короткому temp пути; не выкидывать тест. Для browser focus-loss harness допускает настоящий Resume через UI (BROWSER_CHANNEL=msedge при native Chromium crash). Это сведения среды, не разрешение игнорировать новый failure.

### Ручные

Реальная победа в desktop/mobile viewport;1/2/3звезды через controlled seeds/actions, last level, next/retry; Tab/Shift+Tab; resize/landscape; pause/hidden в burst; reduced. Сравнить с preview44, подтвердить тёмный игровой слой и читаемую карточку.

После commit/deploy проверить https://gobestvini.github.io/magnet-sort/ и нужное изменённое поведение. Browser surrogate не называть реальным телефоном; Telegram не запускать.

## 8. Предположения, вопросы и условия остановки

Draft только из-за44; ready после done44 и сверки файлов. От46 зависимости нет: брать goal из state, поддержать текущую и уменьшенную цель. Художественное уточнение пользователя во время работы имеет приоритет над sample44.

Если код изменился, сверить фактические symbols/diff; при невыполненной зависимости не выполнять downstream. Если существенное продуктовое решение невозможно в этих границах, записать блокер и требуемое решение. Художественные предложения отделены от подтверждённого запроса; новых обязательных approval gates нет.

## 9. Сообщение для передачи модели

```text
Выполни docs/tasks/TASK-0045-victory-screen-runtime.md в Magnet Sort. Прочитай AGENTS.md и задачу целиком, проверь актуальность и зависимости, работай в заданных границах. Выполни обязательные проверки и публикацию по AGENTS.md, заполни раздел10 и обнови INDEX. Draft с незавершённой зависимостью не реализуй. При блокере запиши причину и необходимое решение.
```

## 10. Отчёт исполнителя

- Результат: Реализация выполнена, CI и публикация успешны. [Общий отчёт](../reports/FOLLOWUP_IMPLEMENTATION.md).
- Изменённые файлы и зачем: профильные модули/ассеты и проверочные сценарии перечислены в общем отчёте по ID задачи.
- Команды и фактические результаты: 173/173 full tests (serial/no-opt), targeted28, clean production build; обычный check:full получает native access violation legacy campaign. Удалённый pnpm check:full на Node22/Linux — success (run38272136726).
- Ручные проверки: браузерные viewport/кадры, реальный pointer drag, настоящие seeded действия победы; подробности и end-sampling отмечены в общем отчёте.
- Выполненные критерии: все критерии реализации/интеграции/профильных проверок/публикации подтверждены в общем отчёте.
- Непроверенное, блокеры и отклонения: реальный телефон не проверен; нативные Windows V8 crashes явно описаны. Реальные 1/2/3-star runs и Linux full CI успешны.
- Коммит / push / deploy / публичная проверка:05dd9ae в main; Check game и deploy success; публичные desktop/mobile flow и 1/2/3-star wins прошли.
- Итоговый статус и дата: done, 2026-10-12.
