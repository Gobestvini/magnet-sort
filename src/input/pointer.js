import { cellId } from '../game/hex.js';
import { isMagnetTrayPoint, screenToCell } from '../render/layout.js';

export function createPointerController(target, { getLayout, getLevel, getState, onPreview, onAction }) {
  let pointerId = null;
  let dragging = false;
  let locked = false;
  let selectedColor = null;
  let previewCell = null;
  let pointerPoint = null;
  let lastAction = null;
  let actionCount = 0;
  let disposed = false;

  function pointFrom(event) {
    const bounds = target.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  function notify() {
    onPreview?.({
      selectedColor,
      previewCell: previewCell ? { ...previewCell } : null,
      pointerPoint: pointerPoint ? { ...pointerPoint } : null,
      dragging,
      action: lastAction ? structuredClone(lastAction) : null,
    });
  }

  function validCell(cell, color) {
    if (!cell || !color || locked) return false;
    const level = getLevel();
    const options = getState().selectedMagnetOptions ?? level.magnetSchedule[0].options;
    if (!options.includes(color)) return false;
    const id = cellId(cell);
    if (level.blockedCells.some((blocked) => cellId(blocked) === id)) return false;
    return !getState().tokens.some((token) => cellId(token.cell) === id);
  }

  function updatePreview(event) {
    pointerPoint = pointFrom(event);
    const cell = screenToCell(pointerPoint, getLayout());
    previewCell = validCell(cell, selectedColor) ? cell : null;
    notify();
  }

  function down(event) {
    if (disposed || locked || event.isPrimary === false || pointerId !== null || event.button > 0) return;
    const point = pointFrom(event);
    const layout = getLayout();
    if (isMagnetTrayPoint(point, layout)) {
      const options = getState().selectedMagnetOptions ?? getLevel().magnetSchedule[0].options;
      const color = options.find((option) => getLevel().colors.includes(option));
      if (!color) return;
      selectedColor = color;
      dragging = true;
    } else if (!selectedColor) return;
    pointerId = event.pointerId;
    try { target.setPointerCapture(pointerId); } catch { /* Pointer may already have been cancelled by the browser. */ }
    updatePreview(event);
    event.preventDefault();
  }

  function move(event) {
    if (disposed || pointerId !== event.pointerId) return;
    updatePreview(event);
    event.preventDefault();
  }

  function clearPointer(release = true) {
    const previousId = pointerId;
    pointerId = null;
    dragging = false;
    previewCell = null;
    pointerPoint = null;
    if (release && previousId !== null) {
      try { if (target.hasPointerCapture(previousId)) target.releasePointerCapture(previousId); } catch { /* Target may have unmounted. */ }
    }
  }

  function up(event) {
    if (disposed || pointerId !== event.pointerId) return;
    updatePreview(event);
    const cell = previewCell;
    const color = selectedColor;
    const beganAtTray = dragging;
    clearPointer();
    // A tray tap selects; dropping a tray drag (or tapping a cell after selection) emits one Action.
    if (cell && (!beganAtTray || !isMagnetTrayPoint(pointFrom(event), getLayout()))) {
      lastAction = { type: 'placeMagnet', color, cell: { ...cell } };
      actionCount += 1;
      onAction?.(structuredClone(lastAction));
    }
    notify();
    event.preventDefault();
  }

  function cancel() {
    if (disposed) return;
    clearPointer();
    selectedColor = null;
    lastAction = null;
    notify();
  }

  function pointerCancel(event) {
    if (pointerId !== null && event.pointerId !== pointerId) return;
    cancel();
  }

  target.addEventListener('pointerdown', down);
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', pointerCancel);

  return {
    cancel,
    chooseColor(color) {
      const options = getState().selectedMagnetOptions ?? getLevel().magnetSchedule[0].options;
      if (disposed || locked || pointerId !== null || !options.includes(color)) return false;
      selectedColor = color;
      lastAction = null;
      previewCell = null;
      pointerPoint = null;
      notify();
      return true;
    },
    setLocked(value) { locked = Boolean(value); if (locked) cancel(); },
    snapshot() { return { pointerId, dragging, locked, selectedColor, previewCell: previewCell ? { ...previewCell } : null, pointerPoint: pointerPoint ? { ...pointerPoint } : null, action: lastAction ? structuredClone(lastAction) : null, actionCount }; },
    dispose() {
      if (disposed) return;
      cancel();
      disposed = true;
      target.removeEventListener('pointerdown', down);
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', pointerCancel);
    },
  };
}
