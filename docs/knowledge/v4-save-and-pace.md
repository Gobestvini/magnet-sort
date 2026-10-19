# V4 save, прогноз и темп: проверенные границы

2026-10-19, TASK-0066/0067/0069. Источник: session/progress-v4/spawn-forecast,
model-v4 explicit factory и tools/experiments. [Save](../reports/V4_SAVE_CONTINUE.md),
[forecast](../reports/SPAWN_FORECAST.md), [темп/входные hashes](../reports/TELEGRAM_SESSION_PACE.md).

- Признак: закрытие во время анимации теряет ход либо повторно начисляет сбор.
  Причина: presentation временно отстаёт от уже окончательной модели.
  Способ: синхронно сохранить seed+accepted log до makeTransferTimeline;
  при входе replay через тот же kernel, display сразу final cleared/queue,
  без timeline/audio cues. Проверка: полные replay states и production immediate
  reload в web/Telegram mock PASS. Ограничения: native phone не проверен;
  contentVersion надо менять при несовместимых rules/content.
- Признак: новая вкладка перетёрта старой. Способ: revision + exact raw comparison
  перед write, sticky memory fallback и явный reload; corruption не заменять без
  кнопки. Две реальные browser tabs и unit same-revision collision PASS.
  LocalStorage не имеет CAS: это не полная межпроцессная транзакция.
- Признак: прогноз перескочил раньше видимого spawn. Способ: общий stacksForMove,
  before до первого stackSpawned.start либо queueStart. Число — плановый максимум.
  Unit boundaries и normal/reduced production L7/L10 PASS; не заводить второй RNG.
- Признак: меньший интервал пополнения ускорил игру, но чаще заполняет поле.
  Способ: одинаковые seed/policy/cutoff и общий kernel с двумя явными параметрами;
  рядом считать wins/loss/unknown и input-locked timeline, а не только длину побед.
  A/B/C3600 runs +108 replay witnesses PASS: B L12=40/50 greedy, A8/50, C4/50.
  Это не человеческая выигрышность и не доказательство невозможных seed.
- Default сохранён36 pre-seam state/event traces + прежними witnesses.
  Custom rules разрешены только transient; DEV hook/preset labels отсутствуют
  в production bundles. Локальный preview — общий настоящий runtime в iframe.
  Human A/B двух людей и телефон остаются review. Измеренная timeline — бюджет
  блокировки ввода, а не полная длительность человеческой партии.
