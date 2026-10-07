const DURATIONS = { slide: 0.18, merge: 0.32, clear: 0.48 };
const REDUCED_DURATIONS = { slide: 0.06, merge: 0.08, clear: 0.09 };

function cloneTokens(tokens) {
  return new Map(tokens.map((token) => [token.tokenId, { ...token, cell: { ...token.cell } }]));
}

function makeTimeline(events, reducedMotion) {
  const groups = new Map();
  for (const event of events) {
    if (!groups.has(event.wave)) groups.set(event.wave, []);
    groups.get(event.wave).push(event);
  }
  const stages = [];
  let chain = 0;
  for (const [wave, waveEvents] of groups) {
    const moves = waveEvents.filter((event) => event.type === 'tokenMoved');
    const merges = waveEvents.filter((event) => event.type === 'stackMerged');
    const clears = waveEvents.filter((event) => event.type === 'stackCleared');
    if (moves.length) stages.push({ type: 'slide', wave, events: moves, duration: durationFor('slide', reducedMotion) });
    if (merges.length) stages.push({ type: 'merge', wave, events: merges, duration: durationFor('merge', reducedMotion) });
    if (clears.length) {
      chain += 1;
      stages.push({ type: 'clear', wave, chain, events: clears, duration: durationFor('clear', reducedMotion) });
    }
  }
  return stages;
}

function durationFor(type, reducedMotion) {
  return (reducedMotion ? REDUCED_DURATIONS : DURATIONS)[type];
}

export function createResolutionPlayer() {
  let tokens = new Map();
  let stages = [];
  let index = 0;
  let elapsed = 0;
  let active = false;
  let complete = true;

  function finishStage(stage) {
    if (stage.type === 'slide') {
      for (const event of stage.events) {
        const token = tokens.get(event.tokenId);
        if (token) token.cell = { ...event.to };
      }
    } else if (stage.type === 'merge') {
      for (const event of stage.events) {
        for (const tokenId of event.memberIds) if (tokenId !== event.tokenId) tokens.delete(tokenId);
        const keeper = tokens.get(event.tokenId);
        if (keeper) { keeper.mass = event.mass; keeper.cell = { ...event.cell }; }
      }
    } else if (stage.type === 'clear') {
      for (const event of stage.events) tokens.delete(event.tokenId);
    }
  }

  function start(state, events, { reducedMotion = false } = {}) {
    tokens = cloneTokens(state.tokens);
    stages = makeTimeline(events, reducedMotion);
    index = 0;
    elapsed = 0;
    active = stages.length > 0;
    complete = !active;
    return getSnapshot();
  }

  function update(dt) {
    if (!active || !Number.isFinite(dt) || dt <= 0) return false;
    let remaining = dt;
    while (active && remaining > 0) {
      const stage = stages[index];
      const used = Math.min(remaining, stage.duration - elapsed);
      elapsed += used;
      remaining -= used;
      if (elapsed + 1e-9 < stage.duration) break;
      finishStage(stage);
      index += 1;
      elapsed = 0;
      if (index >= stages.length) {
        active = false;
        complete = true;
      }
    }
    return true;
  }

  function getSnapshot() {
    const stage = active ? stages[index] : null;
    const progress = stage ? Math.min(1, elapsed / stage.duration) : 1;
    const visualTokens = [...tokens.values()].map((token) => ({ ...token, cell: { ...token.cell }, alpha: 1, scale: 1 }));
    const byId = new Map(visualTokens.map((token) => [token.tokenId, token]));
    const effects = [];
    if (stage?.type === 'slide') {
      for (const event of stage.events) {
        const token = byId.get(event.tokenId);
        if (!token) continue;
        token.x = event.from.col + (event.to.col - event.from.col) * ease(progress);
        token.y = event.from.row + (event.to.row - event.from.row) * ease(progress);
      }
      effects.push(...stage.events.map((event) => ({
        type: 'pull-line', from: { ...event.from }, to: { ...event.to }, color: tokens.get(event.tokenId)?.color, progress,
      })));
    } else if (stage?.type === 'merge') {
      for (const event of stage.events) {
        const keeper = byId.get(event.tokenId);
        if (keeper) keeper.scale = 1 + Math.sin(progress * Math.PI) * 0.2;
        effects.push({ type: 'merge', cell: { ...event.cell }, mass: event.mass, progress });
      }
    } else if (stage?.type === 'clear') {
      for (const event of stage.events) {
        const token = byId.get(event.tokenId);
        if (token) { token.alpha = 1 - progress; token.scale = 1 + progress * 0.25; }
        effects.push({ type: 'clear', cell: { ...event.cell }, mass: event.mass, chain: stage.chain, progress });
      }
    }
    return { active, complete, stage: stage?.type ?? null, progress, tokens: visualTokens, effects };
  }

  function cancel() {
    stages = [];
    index = 0;
    elapsed = 0;
    active = false;
    complete = true;
    tokens = new Map();
  }

  return { start, update, cancel, snapshot: getSnapshot };
}

function ease(value) { return value * value * (3 - 2 * value); }
