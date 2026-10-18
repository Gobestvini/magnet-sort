// White Tower's minimum visible-time contract; hidden intervals never count.
export function createVisibleProgress(minimumMs = 1000) {
  let elapsed = 0, previous, wasVisible = false, ratio = 0, displayed = 0, complete = false;
  return {
    resources(completed, total) {
      if (Number.isFinite(completed) && Number.isFinite(total) && total > 0)
        ratio = Math.max(ratio, Math.min(1, Math.max(0, completed / total)));
    },
    complete() { ratio = 1; complete = true; },
    step(now, visible) {
      const delta = previous === undefined ? 0 : Math.max(0, now - previous);
      previous = now;
      if (visible && wasVisible) elapsed += delta;
      wasVisible = visible;
      const target = Math.min(ratio, elapsed / minimumMs, 1);
      displayed = Math.max(displayed, Math.min(target, displayed + delta / 180));
      const ready = complete && elapsed >= minimumMs;
      if (ready) displayed = 1;
      return { elapsed, displayed, ratio, ready };
    },
  };
}
