import './style.css';
import { h, render } from 'preact';
import { createStepper } from './loop.js';
import { createInput } from './input.js';
import { createPointerController } from './input/pointer.js';
import { createScene } from './scene.js';
import { createPixiApplication } from './render/application.js';
import { campaignLevelIds, ftueLevelIds } from './game/levels.js';
import { loadProgress, recordDailyRunResult, recordRunResult, saveProgress, setProgressSetting } from './game/progress.js';
import { compareRunResults } from './game/scoring.js';
import { createChallengeCardSvg, createChallengePayload, createChallengeUrl, encodeChallengePayload, parseChallengeUrl, shareChallenge } from './social/challenge.js';
import { getDailyPuzzle } from './social/daily.js';
import { createAudioFeedback } from './audio/feedback.js';
import { createAnalytics } from './analytics/events.js';
import { createFacebookInstantGamesAdapter } from './platform/facebook.js';
import { createStandalonePlatform } from './platform/standalone.js';
import { App } from './ui/App.js';

const uiRoot = document.querySelector('#ui-root');
if (!uiRoot) throw new Error('Magnet Sort UI mount point is missing');

let gameHost = null;
let canvasElement = null;
const surfaceRef = (node) => { gameHost = node; };
const canvasRef = (node) => { canvasElement = node; };

const input = createInput();
const stepper = createStepper();
let renderer = null;
let scene = null;
let paused = false;
let previous = null;
let frame = null;
let disposed = false;
let initializing = false;
let initAttempt = 0;
let error = null;
let tickCount = 0;
let observer = null;
let pointer = null;
let reducedMotionOverride = null;
const hasChallengeQuery = new URLSearchParams(window.location.search).has('challenge');
const parsedChallenge = hasChallengeQuery ? parseChallengeUrl(window.location.href) : null;
let challenge = parsedChallenge?.ok ? parsedChallenge.challenge : null;
let challengeError = parsedChallenge && !parsedChallenge.ok ? challengeErrorMessage(parsedChallenge.reason) : null;
let shareStatus = null;
let boosterNotice = null;
let screen = challenge ? 'challenge' : 'home';
let progress = loadProgress().progress;
const analytics = createAnalytics({ enabled: import.meta.env.DEV });
let activeRunId = null;
let ftueFlowId = null;
let ftueStarted = false;
let challengeOpened = false;
let platformDaily = null;
const platform = window.FBInstant
  ? createFacebookInstantGamesAdapter({ sdk: window.FBInstant })
  : createStandalonePlatform();
const platformInitialization = platform.initialize();
let removePlatformPauseListener = null;
const feedback = createAudioFeedback({
  AudioContext: window.AudioContext ?? window.webkitAudioContext,
  navigator: window.navigator,
  soundEnabled: progress.settings.soundEnabled,
  hapticsEnabled: progress.settings.hapticsEnabled,
});
const savedResults = new Set();

function progressTarget(value = progress) {
  if (value.ftue.completed || value.ftue.skipped) {
    const ids = campaignLevelIds();
    return { campaignPuzzleId: ids[Math.min(ids.length - 1, value.unlockedCampaignLevel - 1)] };
  }
  const ids = ftueLevelIds();
  return { ftuePuzzleId: ids[Math.min(ids.length - 1, value.ftue.unlockedLesson - 1)] };
}

function analyticsContext(session = scene?.getSession(), runId = activeRunId) {
  if (!session) return {};
  const state = session.state;
  return {
    ...(runId ? { runId } : {}),
    ...(ftueFlowId && session.tutorial?.active ? { flowId: ftueFlowId } : {}),
    puzzleId: session.puzzleId ?? state?.puzzleId,
    contentVersion: state?.contentVersion,
    rulesVersion: state?.rulesVersion,
    mode: session.challenge ? 'challenge' : session.daily ? 'daily' : session.tutorial?.active ? 'ftue' : state?.mode ?? 'campaign',
    assisted: Object.values(session.assistedFlags ?? {}).some(Boolean),
  };
}

function beginAnalyticsRun({ keepChallengeRun = false } = {}) {
  const session = scene?.getSession();
  if (!session) return;
  if (!keepChallengeRun || !activeRunId) activeRunId = analytics.createId('run');
  if (session.tutorial?.active && !ftueStarted) {
    ftueFlowId = analytics.createId('ftue');
    ftueStarted = true;
    analytics.track('ftue_start', analyticsContext(session));
  }
  analytics.track('level_start', analyticsContext(session));
  if (session.challenge) analytics.track('challenge_started', analyticsContext(session));
  if (!session.tutorial?.active) ftueFlowId = null;
}

function recordAnalyticsTerminal(session) {
  const payload = {
    ...analyticsContext(session),
    outcome: session.result.outcome,
    score: session.result.score,
    movesUsed: session.result.movesUsed,
    eligibleForChallenge: session.result.eligibleForChallenge,
  };
  analytics.track('level_complete', payload);
  if (session.challenge) analytics.track('challenge_completed', payload);
  if (session.tutorial?.completed && session.result.outcome === 'win') analytics.track('ftue_complete', payload);
}

function persistProgress() {
  const saved = saveProgress(progress);
  progress = saved.progress;
}

function startGame({ daily = null } = {}) {
  if (!scene || !renderer) return;
  feedback.beginRun();
  void feedback.activateFromGesture();
  pointer?.cancel();
  if (challenge) scene.startChallenge(challenge.puzzleId);
  else if (daily) scene.startDaily(daily.dailyId, daily.puzzleId);
  else scene.startFromProgress(progressTarget());
  if (!challenge && !progress.ftue.seen && !progress.ftue.completed && !progress.ftue.skipped) {
    progress = { ...progress, ftue: { ...progress.ftue, seen: true } };
    persistProgress();
  }
  screen = 'game';
  challengeError = null;
  if (hasChallengeQuery && !challenge) clearChallengeFromUrl();
  beginAnalyticsRun({ keepChallengeRun: Boolean(challenge && challengeOpened) });
  paused = false;
  syncPointerLock();
  clearTiming();
  renderUI();
  resize();
  renderScene(0);
  scheduleFrame();
}

function startDaily() {
  startGame({ daily: platformDaily ?? getDailyPuzzle() });
}

function goHome() {
  if (!scene) return;
  handleTerminalResult({ force: true });
  screen = 'home';
  challenge = null;
  challengeError = null;
  clearChallengeFromUrl();
  pointer?.cancel();
  cancelFrame();
  clearTiming();
  paused = false;
  void feedback.suspend();
  renderUI();
}

function handleTerminalResult({ force = false } = {}) {
  const session = scene?.getSession();
  if (!session?.result) return;
  if (!force && session.phase === 'lost' && (session.boosters.undoAvailable || session.boosters.extraMoveAvailable)) return;
  recordAnalyticsTerminal(session);
  if (session.challenge) return;
  const resultKey = JSON.stringify([session.dailyId ?? 'campaign', session.result]);
  if (savedResults.has(resultKey)) return;
  const tutorial = session.tutorial;
  if (session.daily && session.dailyId) {
    progress = recordDailyRunResult(progress, session.dailyId, session.result);
    persistProgress();
    savedResults.add(resultKey);
    return;
  }
  progress = recordRunResult(progress, session.result, {
    campaignNumber: session.campaignNumber,
    ftueSeen: tutorial.active,
    ftueLesson: tutorial.active ? tutorial.lessonIndex : undefined,
    ftueCompleted: tutorial.completed,
  });
  persistProgress();
  savedResults.add(resultKey);
}

function clearChallengeFromUrl() {
  if (!window.history?.replaceState || !new URLSearchParams(window.location.search).has('challenge')) return;
  const url = new URL(window.location.href);
  url.searchParams.delete('challenge');
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

function challengeErrorMessage(reason) {
  if (reason === 'unsupported-version') return 'Эта ссылка создана в другой версии игры.';
  if (reason === 'unknown-puzzle') return 'Уровень из ссылки больше не доступен.';
  return 'Ссылка на вызов повреждена или неполная.';
}

async function shareCurrentChallenge() {
  const session = scene?.getSession();
  const level = scene?.getLevel();
  if (!level || !session?.result) return;
  const payload = analyticsContext(session);
  analytics.track('share_clicked', payload, { dedupeKey: analytics.createId('share') });
  try {
    const url = createChallengeUrl(level, session.result, window.location.href);
    analytics.track('challenge_created', payload);
    const cardSvg = createChallengeCardSvg(level, session.result);
    const encodedChallenge = encodeChallengePayload(createChallengePayload(level, session.result));
    let outcome;
    if (platform.snapshot().kind === 'facebook-instant-games' && platform.snapshot().started) {
      const result = await platform.shareResult({ text: 'Сможешь побить мой результат?', encodedChallenge });
      outcome = result.status === 'ok'
        ? { status: 'shared' }
        : await shareChallenge({ url, cardSvg }, { navigator: window.navigator, clipboard: window.navigator.clipboard, File: window.File });
    } else {
      outcome = await shareChallenge({ url, cardSvg }, { navigator: window.navigator, clipboard: window.navigator.clipboard, File: window.File });
    }
    shareStatus = outcome.status === 'shared' ? 'Вызов отправлен в меню «Поделиться».'
      : outcome.status === 'copied' ? 'Ссылка скопирована.'
        : outcome.status === 'cancelled' ? 'Отправка отменена.'
          : 'Не удалось поделиться. Скачай карточку или проверь разрешение на копирование.';
  } catch {
    shareStatus = 'Не удалось создать ссылку на этот результат.';
  }
  renderUI();
}

function toggleReducedMotion(event) {
  progress = setProgressSetting(progress, 'reducedMotion', event.currentTarget.checked);
  reducedMotionOverride = progress.settings.reducedMotion ? true : null;
  persistProgress();
}

function toggleFeedbackSetting(key, event) {
  progress = setProgressSetting(progress, key, event.currentTarget.checked);
  persistProgress();
  feedback.setSettings({
    soundEnabled: progress.settings.soundEnabled,
    hapticsEnabled: progress.settings.hapticsEnabled,
  });
  if (key === 'soundEnabled' && progress.settings.soundEnabled) void feedback.activateFromGesture();
}

function clearTiming() {
  previous = null;
  stepper.reset();
  input.reset();
}

function cancelFrame() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
}

function scheduleFrame() {
  if (!disposed && screen === 'game' && renderer && scene && !paused && !document.hidden && frame === null) {
    frame = requestAnimationFrame(tick);
  }
}

function prefersReducedMotion() {
  return reducedMotionOverride ?? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function currentStatus() {
  if (error) return 'Нужен повторный запуск';
  if (!renderer) return initializing ? 'Загрузка поля…' : 'Готово к запуску';
  if (paused) return 'Пауза';
  const phase = scene?.getSession().phase;
  if (phase === 'resolving') return 'Магнит притягивает фишки…';
  if (phase === 'won') return 'Уровень пройден!';
  if (phase === 'lost') return 'Ходы закончились';
  if (phase === 'error') return 'Не удалось загрузить уровень';
  return 'Готово';
}

function renderUI() {
  if (disposed) return;
  const currentSession = scene?.getSession();
  render(h(App, {
    screen,
    progress,
    daily: platformDaily ?? getDailyPuzzle(),
    challenge,
    challengeError,
    challengeComparison: currentSession?.result && challenge && currentSession.result.eligibleForChallenge && challenge.challengerResult.eligibleForChallenge
      ? compareRunResults(currentSession.result, challenge.challengerResult) : null,
    shareStatus,
    boosterNotice,
    level: scene?.getLevel(),
    paused,
    ready: Boolean(renderer && scene && !error),
    initializing,
    error,
    session: currentSession,
    status: currentStatus(),
    interaction: scene?.snapshot().interaction,
    surfaceRef,
    canvasRef,
    onTogglePause: () => setPaused(!paused),
    onReset: reset,
    onRetry: retry,
    onRetryRenderer: initialize,
    onChooseColor: (color) => pointer?.chooseColor(color),
    onUndo: useUndo,
    onHint: requestHint,
    onApplyHint: applyHint,
    onExtraMove: requestExtraMove,
    onSkipTutorial: skipTutorial,
    onPlay: startGame,
    onHome: goHome,
    onDaily: startDaily,
    onFriend() {},
    onToggleReducedMotion: toggleReducedMotion,
    onToggleSound: (event) => toggleFeedbackSetting('soundEnabled', event),
    onToggleHaptics: (event) => toggleFeedbackSetting('hapticsEnabled', event),
    onNextPuzzle: advancePuzzle,
    onShareChallenge: shareCurrentChallenge,
  }), uiRoot);
}

function renderScene(alpha = 0) {
  if (!renderer || !scene) return;
  scene.render(renderer, renderer.canvas.clientWidth, renderer.canvas.clientHeight, alpha);
}

function resize() {
  clearTiming();
  if (!renderer || !scene) return;
  const width = gameHost.clientWidth;
  const height = gameHost.clientHeight;
  renderer.resize(width, height);
  scene.resize(width, height, Math.min(window.devicePixelRatio || 1, 2));
  renderScene(0);
}

function setPaused(value) {
  if (!renderer || !scene) return;
  paused = Boolean(value);
  if (paused) void feedback.suspend();
  else void feedback.activateFromGesture();
  syncPointerLock();
  clearTiming();
  if (paused) cancelFrame();
  renderUI();
  if (!paused) scheduleFrame();
}

function syncPointerLock() {
  const phase = scene?.getSession().phase;
  pointer?.setLocked(paused || document.hidden || (phase !== undefined && phase !== 'playing'));
}

function reset() {
  if (!scene) return;
  const previousSession = scene.getSession();
  analytics.track('retry', { ...analyticsContext(previousSession), ...(previousSession.result ? { outcome: previousSession.result.outcome } : {}) }, { dedupeKey: analytics.createId('retry') });
  pointer?.cancel();
  feedback.beginRun();
  void feedback.activateFromGesture();
  scene.reset();
  beginAnalyticsRun();
  syncPointerLock();
  clearTiming();
  renderScene(0);
  renderUI();
  scheduleFrame();
}

function retry() {
  if (!scene) return;
  const previousSession = scene.getSession();
  handleTerminalResult({ force: true });
  analytics.track('retry', { ...analyticsContext(previousSession), ...(previousSession.result ? { outcome: previousSession.result.outcome } : {}) }, { dedupeKey: analytics.createId('retry') });
  pointer?.cancel();
  feedback.beginRun();
  void feedback.activateFromGesture();
  scene.retry();
  beginAnalyticsRun();
  syncPointerLock();
  clearTiming();
  renderScene(0);
  renderUI();
  scheduleFrame();
}

function nextPuzzle() {
  if (!scene) return;
  pointer?.cancel();
  feedback.beginRun();
  void feedback.activateFromGesture();
  scene.nextPuzzle();
  beginAnalyticsRun();
  syncPointerLock();
  clearTiming();
  renderScene(0);
  renderUI();
  scheduleFrame();
}

function advancePuzzle() {
  if (!scene) return;
  handleTerminalResult({ force: true });
  pointer?.cancel();
  feedback.beginRun();
  void feedback.activateFromGesture();
  const advanced = scene.nextPuzzle();
  if (!advanced) { goHome(); return; }
  beginAnalyticsRun();
  syncPointerLock();
  clearTiming();
  renderScene(0);
  renderUI();
  scheduleFrame();
}

function skipTutorial() {
  if (!scene?.skipTutorial()) return;
  beginAnalyticsRun();
  feedback.beginRun();
  void feedback.activateFromGesture();
  progress = { ...progress, unlockedCampaignLevel: Math.max(6, progress.unlockedCampaignLevel), ftue: { ...progress.ftue, seen: true, skipped: true } };
  persistProgress();
  pointer?.cancel();
  syncPointerLock();
  clearTiming();
  renderScene(0);
  renderUI();
  scheduleFrame();
}

function useUndo() {
  boosterNotice = null;
  pointer?.cancel();
  const result = scene?.undo();
  if (!result?.accepted) return;
  syncPointerLock();
  clearTiming();
  renderScene(0);
  renderUI();
  scheduleFrame();
}

function requestHint() {
  pointer?.cancel();
  const hint = scene?.requestHint();
  boosterNotice = hint?.available ? 'Подсказка отмечает забег как забег с помощью.'
    : hint?.reason === 'state-outside-solution' || hint?.reason === 'no-authored-solution' ? 'Для этого состояния нет проверенной подсказки.'
      : hint?.reason === 'hint-already-used' ? 'Подсказка уже использована в этом забеге.' : 'Подсказка сейчас недоступна.';
  renderUI();
  return hint;
}

function applyHint() {
  boosterNotice = null;
  pointer?.cancel();
  const result = scene?.applyHint();
  if (!result?.accepted) return;
  feedback.playEvents(result.events);
  syncPointerLock();
  clearTiming();
  renderScene(0);
  renderUI();
  scheduleFrame();
}

function requestExtraMove() {
  const result = scene?.requestExtraMove();
  boosterNotice = result?.granted ? 'Получен один дополнительный ход тестовой наградой; забег отмечен как вспомогательный.'
    : result?.reason === 'extra-move-unavailable' ? 'Дополнительный ход доступен только при оставшихся легальных ходах.'
      : result?.reason === 'extra-move-already-used' ? 'Дополнительный ход уже использован в этом забеге.' : 'Тестовая награда недоступна.';
  if (!result?.granted) { renderUI(); return; }
  syncPointerLock();
  clearTiming();
  renderScene(0);
  renderUI();
  scheduleFrame();
}

function tick(now) {
  frame = null;
  if (disposed || screen !== 'game' || paused || document.hidden || !scene || !renderer) return;
  const delta = previous === null ? 0 : (now - previous) / 1000;
  previous = now;
  let phaseChanged = false;
  const result = stepper.advance(delta, (dt) => { phaseChanged = scene.update(dt, input) || phaseChanged; });
  tickCount += 1;
  renderScene(result.alpha);
  if (phaseChanged) {
    handleTerminalResult();
    syncPointerLock();
    renderUI();
  }
  const phase = scene.getSession().phase;
  if (phase === 'won' || phase === 'lost' || phase === 'error') {
    cancelFrame();
    return;
  }
  scheduleFrame();
}

function handleVisibility() {
  pointer?.cancel();
  syncPointerLock();
  clearTiming();
  cancelFrame();
  if (document.hidden) void feedback.suspend();
  if (!document.hidden) {
    void feedback.resumeAfterVisibility();
    renderScene(0);
    scheduleFrame();
  }
}

function handleBlur() {
  pointer?.cancel();
  clearTiming();
  if (renderer && scene && !paused) setPaused(true);
}

async function initialize() {
  if (disposed || initializing || renderer) return;
  initializing = true;
  error = null;
  const attempt = ++initAttempt;
  renderUI();
  let candidate;
  try {
    if (!gameHost || !canvasElement) throw new Error('Game surface is not mounted');
    candidate = await createPixiApplication(gameHost, canvasElement);
    if (disposed || attempt !== initAttempt) {
      candidate.destroy();
      return;
    }
    renderer = candidate;
    scene = createScene(renderer.stage, { ...progressTarget(), ...(challenge ? { challengePuzzleId: challenge.puzzleId } : {}), reducedMotion: prefersReducedMotion });
    if (challenge && !challengeOpened) {
      challengeOpened = true;
      activeRunId = analytics.createId('run');
      analytics.track('challenge_opened', analyticsContext(scene.getSession()));
    }
    pointer = createPointerController(canvasElement, {
      getLayout: () => scene.getLayout(),
      getLevel: () => scene.getLevel(),
      getState: () => scene.getState(),
      onPreview: (interaction) => {
        scene?.setInteraction(interaction);
        renderScene(0);
        renderUI();
      },
      onAction: (action) => {
        const result = scene?.submitAction(action);
        if (result?.accepted) {
          feedback.playEvents(result.events);
          syncPointerLock();
          renderScene(0);
          renderUI();
        }
      },
    });
    removePlatformPauseListener = platform.onPause?.((value) => setPaused(value)) ?? null;
    void initializePlatform(attempt);
    pointer.setLocked(paused || document.hidden);
    scene.resize(gameHost.clientWidth, gameHost.clientHeight);
    resize();
    renderUI();
    scheduleFrame();
  } catch {
    if (candidate && renderer === candidate) {
      scene?.dispose();
      scene = null;
      candidate.destroy();
      renderer = null;
    } else if (candidate) {
      candidate.destroy();
    }
    if (!disposed && attempt === initAttempt) {
      error = true;
      renderUI();
    }
  } finally {
    if (attempt === initAttempt) {
      initializing = false;
      renderUI();
    }
  }
}

async function initializePlatform(attempt) {
  try {
    const initialized = await platformInitialization;
    if (disposed || attempt !== initAttempt || initialized.status !== 'ok') return;
    const started = await platform.start();
    if (disposed || attempt !== initAttempt || started.status !== 'ok') return;
    const entry = await platform.getEntry();
    if (disposed || attempt !== initAttempt || entry.status !== 'ok') return;
    if (entry.value?.kind === 'daily') {
      platformDaily = entry.value.data;
      renderUI();
      return;
    }
    // Do not replace a run if entry data arrives after the player started.
    if (entry.value?.kind !== 'challenge' || challenge || screen !== 'home' || !scene) return;
    challenge = entry.value.data;
    screen = 'challenge';
    scene.startChallenge(challenge.puzzleId);
    challengeOpened = true;
    activeRunId = analytics.createId('run');
    analytics.track('challenge_opened', analyticsContext(scene.getSession()));
    pointer?.cancel();
    syncPointerLock();
    clearTiming();
    renderUI();
    renderScene(0);
  } catch {
    // Platform startup is optional and must not interrupt standalone play.
  }
}

renderUI();
window.addEventListener('resize', resize);
window.addEventListener('blur', handleBlur);
document.addEventListener('visibilitychange', handleVisibility);
if (typeof ResizeObserver !== 'undefined') {
  observer = new ResizeObserver(resize);
  observer.observe(gameHost);
}

function snapshot() {
  return {
    ...(scene?.snapshot() ?? { elapsed: 0 }),
    puzzleId: scene?.getSession().puzzleId ?? null,
    state: scene?.getSession().state ?? null,
    phase: scene?.getSession().phase ?? 'loading',
    moves: scene?.getSession().movesUsed ?? 0,
    remainingMoves: scene?.getSession().remainingMoves ?? null,
    tutorial: scene?.getSession().tutorial ?? null,
    result: scene?.getSession().result ?? null,
    progress,
    feedback: feedback.snapshot(),
    analytics: analytics.snapshot(),
    platform: platform.snapshot(),
    screen,
    challenge: scene?.getSession().challenge ?? false,
    daily: scene?.getSession().daily ?? false,
    dailyId: scene?.getSession().dailyId ?? null,
    dailyPreview: (() => { const { dailyId, puzzleId, rotationVersion } = getDailyPuzzle(); return { dailyId, puzzleId, rotationVersion }; })(),
    activeTimeMs: scene?.getSession().activeTimeMs ?? 0,
    assistedFlags: scene?.getSession().assistedFlags ?? {},
    paused,
    keys: [...input.keys].sort(),
    rendererReady: Boolean(renderer),
    rafScheduled: frame !== null,
    tickCount,
    canvasCount: gameHost.querySelectorAll('canvas').length,
    pointer: pointer?.snapshot() ?? null,
  };
}

function dispose() {
  if (disposed) return;
  disposed = true;
  initAttempt += 1;
  cancelFrame();
  clearTiming();
  pointer?.dispose();
  pointer = null;
  removePlatformPauseListener?.();
  removePlatformPauseListener = null;
  platform.dispose();
  observer?.disconnect();
  window.removeEventListener('resize', resize);
  window.removeEventListener('blur', handleBlur);
  document.removeEventListener('visibilitychange', handleVisibility);
  input.dispose();
    feedback.dispose();
  analytics.dispose();
  scene?.dispose();
  renderer?.destroy();
  scene = null;
  renderer = null;
  render(null, uiRoot);
  if (import.meta.env.DEV) delete window.gameDebug;
}

if (import.meta.env.DEV) {
  window.gameDebug = {
    snapshot,
    reset,
    retry,
    nextPuzzle,
    skipTutorial,
    setPaused,
    setReducedMotion(value) { reducedMotionOverride = Boolean(value); },
    loadTestLevel(level) {
      pointer?.cancel();
      scene?.loadTestLevel(level);
      renderUI();
      renderScene(0);
    },
    playTestAction(action) {
      const result = scene?.submitAction(action);
      if (result?.accepted) {
        syncPointerLock();
        renderUI();
        renderScene(0);
      }
      return result;
    },
    dispose,
  };
}
void initialize();

if (import.meta.hot) import.meta.hot.dispose(dispose);
