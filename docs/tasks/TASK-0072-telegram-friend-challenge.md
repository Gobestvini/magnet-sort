# TASK-0072: Предложить другу ту же начальную доску

- Статус: review
- Приоритет: normal
- Создана: 2026-10-19
- Обновлена: 2026-10-25
- Проект: Magnet Sort, `C:/Users/gobes/OneDrive/Документы/PetProgects/Magnet Sort`, remote `https://github.com/Gobestvini/magnet-sort`
- Рекомендуемый исполнитель: сильная; высокий уровень рассуждения — launch/share boundary, версии и сохранность кампании.
- Зависимости: TASK-0066 и TASK-0068 done; актуальный session contract. TASK-0071 не требуется.

2026-10-25: пользователь принял0071 и поручил реализацию0072. Зависимости
выполнены, до начала core зафиксированы contentVersion=`sub-ten-2026-10-20.1`
и SHA-256 rules/layout manifest:
`1641a9930e9ce0163739f1e05b26878620a08d2547fc1ec2a91f6542d9601492`.
Поставляются два профиля: `campaign-a-v1` и `short-b-2026-10-25.1`.
Manifest включает12layouts, параметры профилей и8normalized-LF rules sources;
UI/codec/platform в digest не входят. Logical descriptor содержит явные версии,
профиль и полный hash; canonical encoding ограничен160 символами.

## 1. Цель и запрос пользователя

После победы игрок добровольно делится ссылкой на тот же layout/seed/правила. Получатель играет отдельную попытку и возвращается к своей кампании. Это адаптация подтверждённого архитектурного сценария White Tower, без обещания серверно проверенного результата.

Исходный запрос пользователя: «проработай механики и идеи что можно добавить в телеграм билд игры чтобы его улучшить посмотри как это сделано в других играх головоломках в том числе и в наших». Требования ниже — предложения автора для ограниченного среза. Подготовка не запускает реализацию.

## 2. Проверенный контекст

Перепроверено2026-10-25, HEAD4ed9851. Активны Three.js0.186.1/Preact11/Vite7.1.9,
rules v4, isolated daily B и campaign A. Предыдущие board/draw-order изменения
интегрированы; чужой untracked .codex-remote-attachments/ не трогать.
Исходный аудит: [исследование](../reports/TELEGRAM_IMPROVEMENT_IDEAS.md).

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

- [x] Отправитель и получатель получают одинаковую initial state при той же версии/seed.
- [x] Malformed/unknown ссылки не изменяют campaign и не запускают молча другую доску.
- [x] Cancel/error/unsupported дают понятное состояние; открытие chooser не записано как delivered.
- [x] Return/reload/Retry/Undo не меняют campaign progress/history; assisted сравнивается честно.
- [x] Проверки и ограничения записаны в разделе 10, статус файла и INDEX совпадают; доставка своего коммита фиксируется в release.json и итоговом сообщении.
- [ ] Реальная пересылка и запуск у получателя по §7: отдельная проверка при прямом разрешении отправить конкретный тест. До неё status review, без заявления о доставке.

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

- Результат: После won доступен Challenge a friend с canonical A/B descriptor и честной маркировкой. Incoming preview/Cancel и отдельная transient попытка с Return сохраняют campaign/daily; chooser/copy только по действию игрока.
- Изменённые файлы и зачем: challenge-v4/content/generator — codec/hash/версии; challenge-session/daily suspendedStartup/runtime/App/CSS — отдельный owner и UI; platform adapters/context/bootstrap/links — launch/share до constructor; tests/browser — регрессии. Подробнее docs/reports/V4_CHALLENGE.md.
- Команды и фактические результаты: generator --check и291full tests/build PASS; build:platforms/test:platforms PASS; production challenge web/Telegram mock/embed, daily/Hint/Undo/tutorial/Pages/loading PASS. Независимый critic49tests,23postfixchallenge tests и actualDEVflows PASS.
- Ручные проверки: браузерные реальные touch/keyboard/Copy/chooser-mock, preview/Cancel/invalid/unsupported/duplicate, A/B initial state, B share, help comparisons, won/lost/Retry/Undo/Return, raw campaign/daily/audio и newseed bounds. DEV loss использует controller prefix +последнийреальныйUIход;8warm/lifecyclecycles,resize/dispose PASS.
- Выполненные критерии: все технические; payload102/111<=160, hash/versions фиксированы; не принимаются чужие stacks/actions/final win. P2 URLseed conflict исправлен и независимо перепроверен. Новые controls>=44px, stale share/copy callback не восстанавливает закрытый UI.
- Непроверенное, блокеры и отклонения от плана: реальные Telegram chooser/пересылка/получатель не проверялись и сообщения не отправлялись. По §7 остаётся review до отдельно разрешённого end-to-end теста. Для работы t.me bot URL та же CI-built static сборка доставляется на существующий основной сервер; новые backend/бот settings/рейтинги не входят.
- Итоговый статус и дата: review,2026-10-25; техническая и независимая приёмка завершены, реальная доставка не заявлена.
