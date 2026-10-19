# TASK-0066: сохранение и продолжение v4

2026-10-19. Реализация и технические проверки завершены. Статус **review**: реальное закрытие/открытие Telegram на физическом телефоне не проверено; mock bridge не заменяет эту приёмку.

## Поведение

- Общий session owner работает в web/embed/Telegram. Хранится seed + журнал принятых действий, schemaVersion1, contentVersion `ten-range-2026-10-18.1`, revision и bestStars по levelId.
- Одна атомарная запись `magnet-sort.v4.progress.v1` выполняется синхронно в submit до первой анимации. Renderer/audio state не сериализуются. При восстановлении проигрывается модель без анимаций: счёт/очередь/radii/ID/RNG возвращаются к committed результату.
- Незавершённая попытка продолжается. Lost восстанавливает поражение; Retry использует прежний seed. Won при следующем входе идемпотентно фиксирует рекорд и открывает следующий уровень; последний won остаётся итоговым экраном. Play from start/Retry не стирают завершения.
- Повреждённые/несовместимые данные не перезаписываются. Игра работает в памяти; в паузе есть статус и добровольный Start fresh save. Quota/denied также не мешают игре.
- Exact raw-value comparison перед записью + revision обнаруживают обычный конфликт вкладок. Старая вкладка прекращает durable writes и предлагает Reload saved game. Это optimistic защита; у localStorage нет атомарного compare-and-swap, межпроцессная транзакция не обещается.
- URL `?seed=` запускает временную попытку без чтения/записи кампании. Session умеет replaceAttempt/leaveTransient для будущих режимов; daily/challenge/Undo не добавлены.
- Legacy `magnet-sort.progress`, audio settings и ключи других игр не затрагиваются. Локальная запись не обещает синхронизацию устройств/аккаунтов.

## Владельцы и входы

`src/prototype/progress-v4.js`: createAttempt/replayAttempt/normalizeProgress/withAttempt и storage boundary. Проверяются schema/content version, известные уровни, координаты/цвета/uint32 seed, assisted, completion stars, целая revision, каждый accepted переход и отсутствие действий после terminal. Предельные2048 actions и512KiB строки ограничивают чтение/запись; превышение оставляет текущую игру в памяти.

`src/prototype/session.js`: единственный committed gameplay owner, синхронный submit/start, entry policy и transient suspension. Экспериментальные rules допускаются только при фиксированном transient seed; обычный save всегда воспроизводится default v4.

`runtime.js`: получает начальную state из session, сохраняет перед makeTransferTimeline, восстанавливает displayedCleared/queue/phase, владеет storage listener и удаляет его при dispose. `App.js` показывает компактный статус в существующей scrollable pause panel рядом с настройками звука.

Модель притяжения/спавна/победы не менялась. Golden state/event traces и legacy v4 witnesses подтверждают прежнее поведение default kernel после отдельного seam TASK-0069.

## Проверки

- `node --test tests/progress-v4.test.js tests/prototype-v4.test.js tests/ten-range.test.js`:24/24 PASS до следующего среза; повторные интегрированные проверки также PASS.
- `pnpm check:full`:239/239 unit и build PASS для общего результата0066/0067/0069.
- `pnpm build:platforms`: web/embed/Telegram PASS.
- `node tools/save-v4-browser-check.cjs`: production web390×844 и Telegram mock844×390. Реальный accepted keyboard/UI ход → немедленный reload; восстановлены moves/cleared/очередь/radii. Проверены invalid data/recovery, entry после won дважды, final won, lost/Retry, fixed-seed isolation, две реальные вкладки, denied read и quota writes; pageerror нет.
- Unit проверяют полные replay states, сохранение до presentation, reject без записи, Retry/ID/RNG, completion idempotence, конфликт одинаковых revisions, отказ recovery при новом чужом save, transient suspend/return, sanitization/oversized log/terminal suffix и чужие storage keys.
- Дополнительный normal-motion сценарий: страница закрыта при видимых collection-hex в полёте, открыта заново в том же контексте; полный committed collected/moves/journal восстановлен, повторных collection images нет. PASS.
- Дополнительный ручной browser осмотр через Codex: обычная партия → Pause, статус читается, Music/Sounds/volume/Resume/Restart сохранены, landscape панель доступна.
- `pnpm test:platforms` и опубликованный smoke проверяются для общего итогового коммита; release SHA/результат указаны в финальном ответе.

Логи: `artifacts/save-forecast-pace/`, `.telegram-check-logs/`. Скриншоты: `artifacts/save-v4/`. Native Telegram/телефон и акустическое прослушивание новых изменений не проводились; звуковые настройки и прежний audio pipeline сохранены. Реализация собственной durable истории не мигрирует legacy progress.
