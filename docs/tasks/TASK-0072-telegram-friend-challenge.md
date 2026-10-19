# TASK-0072: Предложить другу ту же начальную доску

- Статус: draft
- Приоритет: normal
- Создана: 2026-10-19
- Обновлена: 2026-10-19
- Проект: Magnet Sort, `C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort`, remote `https://github.com/Gobestvini/magnet-sort`
- Рекомендуемый исполнитель: сильная; высокий уровень рассуждения — launch/share boundary, версии и сохранность кампании.
- Зависимости: TASK-0066 и TASK-0068 done; актуальный session contract. TASK-0071 не требуется.

## 1. Цель и запрос пользователя

После победы игрок добровольно делится ссылкой на тот же layout/seed/правила. Получатель играет отдельную попытку и возвращается к своей кампании. Это адаптация подтверждённого архитектурного сценария White Tower, без обещания серверно проверенного результата.

Исходный запрос пользователя: «проработай механики и идеи что можно добавить в телеграм билд игры чтобы его улучшить посмотри как это сделано в других играх головоломках в том числе и в наших». Требования ниже — предложения автора для ограниченного среза. Подготовка не запускает реализацию.

## 2. Проверенный контекст

Проверено чтением кода 2026-10-19, HEAD 2c77551ade5f790d4462a3d7e956ebe33ea65d5a. Активны Three.js0.186.1/Preact11/Vite7.1.9 и rules v4. Полный исходный запрос, ссылки на конкурентов и аудит наших игр: [исследование](../reports/TELEGRAM_IMPROVEMENT_IDEAS.md). Чужие локальные board.js, magnet-glow.js, draw-order.js и .codex-remote-attachments/ не включать и не откатывать. После изменения HEAD контекст перепроверить.

| Файл / символ | Проверенный факт / назначение |
| --- | --- |
| `src/platforms/telegram/adapter.js::createTelegramPlatform` | Сейчас нет launch/share capabilities; runtime не должен читать Telegram.WebApp. |
| `src/platforms/bootstrap.js::startGame` | Передаёт pause, но не launch descriptor; расширить boundary минимально. |
| `src/social/challenge.js` | Legacy payload4096 и legacy level registry непригодны активному entry. |
| `../White Tower/src/social/challenge.ts; ../White Tower/src/platforms/telegram/adapter.ts` | Пример compact descriptor, chooser и transient controller. |
| `TASK-0066-v4-save-continue.md; TASK-0068-v4-undo.md` | Реальные session/assisted и история должны быть изучены после done. |

## 3. Область изменений

Новый src/prototype/challenge-v4.js, минимальный platform capability launch/share для web/embed/Telegram, runtime/App/prototype.css/session; tests/challenge-v4.test.js и tools/challenge-v4-browser-check.cjs. Без аккаунтов, server leaderboard, автоматических сообщений или Bot API credentials в клиенте.

Перед кодом прочитать AGENTS.md, docs/PROJECT.md и применить game-quality/ai-economy. Для input/render/lifecycle сверить docs/knowledge/pixijs-practices.md («Ввод», «Lifecycle») и legacy docs/design/PIXI_RENDERING.md; активный контракт — docs/design/THREE_RENDERING.md и GDD_V0.4. Сохранить чистую seeded модель, один clock, cancel/pause/reset/dispose, reduced motion. Чужую отрисовку не исправлять попутно.

## 4. Требуемое поведение

1. Перед ready зафиксировать contentVersion и hash набора правил/level layouts, достаточный для воспроизведения. Descriptor включает schema, levelNumber1..12, seed:uint32, preset/content version, SHA-256 содержимого правил и заявленные moves/assisted. Сериализация только разрешёнными символами A-Z,a-z,0-9,_,-; собственный cap160 символов, не legacy4096. Без имён/userId/initData.
2. Создание после won, кнопка Challenge a friend. Явно указывать 'Shared score, unverified'; hash подтверждает совместимость контента, не подлинность moves. Подмена payload не выдаёт достижение/награду. Local result может сравнить moves при одинаковой версии и одинаковой категории помощи.
3. Telegram adapter формирует https://t.me/MagnetSortPuzzleBot?startapp=<payload>, открывает chooser ссылки по пользовательскому действию. Unsupported/error — видимая ссылка + Copy link; cancel не считается отправкой. Не внедрять shareMessage backend в этот срез.
4. Launch читается адаптером и передаётся общему parser; web variant использует ?challenge= тот же payload, embed может только показать/скопировать web link. Проверить официальный Mini Apps launch contract перед реализацией; версия SDK capability-gated.
5. Входящая ссылка сначала показывает preview: level/заявленный результат/помощь, Play challenge и Cancel. Некорректная/слишком длинная/неизвестной версии — понятная ошибка, campaign не затрагивается. Не принимать чужие stacks/actions как готовую победу.
6. Challenge начинается с create state(initial seed), а не final state отправителя. Campaign save/Undo/selection suspend; Retry/Undo/lost/won действуют только на transient attempt; Return возвращает campaign. Reload challenge не перезаписывает campaign.
7. Отправку выполняет сам игрок через chooser; никакой автодоставки, автоприглашения после каждой победы или отправки от агента при проверках. Рекорд с помощью отделять от результата без помощи.
8. При обновлении несовместимых правил старую ссылку отвергать с Update/Return либо использовать явно поставленный старый immutable profile. Не подменять её текущей доской с другим outcome.

## 5. План для исполнителя

1. После зависимостей зафиксировать content descriptor/version/hash generator, обновить symbols/task до ready.
2. Написать чистый parser/encoder/compatibility и tests malformed/length/versions.
3. Добавить optional capabilities на platform boundary и UI preview/chooser/copy/result/return.
4. Проверить общую доску, изоляцию кампании и fallback. Реальную доставку проверять только при отдельном прямом разрешении пользователя отправить конкретный тест.

## 6. Критерии готовности

- [ ] Отправитель и получатель получают одинаковую initial state при той же версии/seed.
- [ ] Malformed/unknown ссылки не изменяют campaign и не запускают молча другую доску.
- [ ] Cancel/error/unsupported дают понятное состояние; открытие chooser не записано как delivered.
- [ ] Return/reload/Retry/Undo не меняют campaign progress/history; assisted сравнивается честно.
- [ ] Проверки и ограничения записаны в разделе 10, статус файла и INDEX совпадают; собственный commit/push/deploy выполнен по AGENTS.md.

## 7. Проверки

### Автоматические

Из корня проекта: node --test tests/challenge-v4.test.js tests/progress-v4.test.js tests/v4-undo.test.js; pnpm check:full; pnpm build:platforms; pnpm test:platforms; новый node tools/challenge-v4-browser-check.cjs с Telegram mock. Покрыть canonical encoding, zero/max seed, cap160, content change, malformed and duplicate query, no auto share и suspend/restore.

Новые проверки подтверждают наблюдаемое поведение и регрессии, а не повторяют implementation. Полные логи остаются на диске. Финальные tests/build — pnpm check:full; квитанция не заменяет UI-критерии. Введённые новые commands/tools исполнитель добавляет только в указанных границах и документирует точный запуск.

### Ручные

Web + Telegram mock: victory→share fallback, launch→preview→play→lost/Undo/won→Return на390×844/844×390. Реальная пересылка и запуск у получателя — отдельный критерий при прямом разрешении; без него status review, не заявлять доставку.

Проверка браузера, Telegram mock, настоящий Telegram и физический телефон имеют разные статусы. Без требуемой проверки не ставить done; записать review/блокер. Не запускать Telegram без пользовательского запроса; авторизация готовить задачу не авторизует сообщения другим людям.

## 8. Предположения, вопросы и условия остановки

Невыполненные зависимости/неопределённая версия контента блокируют ready. Если требуется trusted global score, подпись или серверные призы, остановить расширение. Чисто клиентская ссылка не доказывает честность результата.

Сначала проверить зависимости и реальный код, не трактовать исторические done MVP как выполненную функцию v4. Не расширять scope соседними улучшениями. При параллельных изменениях runtime/App согласовать последовательность; самовольно не откатывать. Опубликование по постоянному разрешению AGENTS.md касается своего проверенного коммита; не включать чужие файлы и не делать force push.

## 9. Сообщение для передачи модели

```text
Выполни docs/tasks/TASK-0072-telegram-friend-challenge.md в C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort. Прочитай AGENTS.md и задачу целиком; проверь актуальность HEAD и зависимостей. Если статус draft, сначала проверь условия перевода в ready; при невыполненной зависимости реализацию не начинай. Примени game-quality и ai-economy, соблюди scope и критерии. Заполни раздел 10, обнови INDEX и соответствующий отчёт. Различай code/unit/build/browser/Telegram/phone и человеческую оценку. Заверши собственными commit/push/deploy по AGENTS.md; чужие изменения не трогай.
```

## 10. Отчёт исполнителя

- Результат: Не выполнялась.
- Изменённые файлы и зачем: —
- Команды и фактические результаты: —
- Ручные проверки: —
- Выполненные критерии: —
- Непроверенное, блокеры и отклонения от плана: —
- Итоговый статус и дата: —
