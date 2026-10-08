export const MAX_VISUAL_STACK_LAYERS = 6;

// Art height is intentionally capped; the model and score retain the full mass.
export function visualStackLayers(mass) {
  return Math.min(MAX_VISUAL_STACK_LAYERS, Math.max(1, Math.floor(Number(mass) || 1)));
}
