import { cellId } from '../game/hex.js';
import { isMagnetTrayPoint, screenToCell } from '../render/layout.js';

export function createPointerController(target, { getLayout, getLevel, getState, onPreview, onAction }) {
  let pointerId = null;
  let toolBounds = null;
  let dragging = false;
  let locked = false;
  let selectedColor = null;
  let previewCell = null;
  let pointerPoint = null;
  let lastAction = null;
  let invalidReason = null;
  let hoverReason = null;
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
      invalidReason,
    });
  }

  function invalidCellReason(cell, color) {
    if (!cell) return 'outside';
    if (!color) return 'unavailableColor';
    if (locked) return 'locked';
    const level = getLevel();
    const options = getState().selectedMagnetOptions ?? level.magnetSchedule[0].options;
    if (!options.includes(color)) return 'unavailableColor';
    const id = cellId(cell);
    if (level.blockedCells.some((blocked) => cellId(blocked) === id)) return 'blocked';
    if (level.crates?.some((crate) => cellId(crate) === id)) return 'crated';
    if (getState().tokens.some((token) => cellId(token.cell) === id)) return 'occupied';
    return null;
  }

  function updatePreview(event) {
    pointerPoint = pointFrom(event);
    const cell = screenToCell(pointerPoint, getLayout());
    hoverReason = invalidCellReason(cell, selectedColor);
    previewCell = hoverReason ? null : cell;
    if (!hoverReason) invalidReason = null;
    notify();
  }

  function down(event) {
    if (disposed || locked || event.isPrimary === false || pointerId !== null || event.button > 0) return;
    const point = pointFrom(event);
    const layout = getLayout();
    if (isMagnetTrayPoint(point, layout)) {
      const options = getState().selectedMagnetOptions ?? getLevel().magnetSchedule[0].options;
      const color = options.includes(selectedColor) ? selectedColor : options.find((option) => getLevel().colors.includes(option));
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
    toolBounds = null;
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
    const releasedOnTray = toolBounds
      ? event.clientX >= toolBounds.left && event.clientX <= toolBounds.right && event.clientY >= toolBounds.top && event.clientY <= toolBounds.bottom
      : isMagnetTrayPoint(pointFrom(event), getLayout());
    if (cell && (!beganAtTray || !releasedOnTray)) invalidReason = null;
    else if (beganAtTray && releasedOnTray) invalidReason = null;
    else invalidReason = hoverReason ?? 'outside';
    clearPointer();
    // A tray tap selects; dropping a tray drag (or tapping a cell after selection) emits one Action.
    if (cell && (!beganAtTray || !releasedOnTray)) {
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
    invalidReason = null;
    hoverReason = null;
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
    beginToolDrag(event, color) {
      const options = getState().selectedMagnetOptions ?? getLevel().magnetSchedule[0].options;
      if (disposed || locked || pointerId !== null || event.isPrimary === false || event.button > 0 || !options.includes(color)) return false;
      const bounds = event.currentTarget?.getBoundingClientRect();
      if (!bounds) return false;
      toolBounds = { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
      selectedColor = color;
      invalidReason = null;
      lastAction = null;
      dragging = true;
      pointerId = event.pointerId;
      try { target.setPointerCapture(pointerId); } catch { /* Browser may cancel a gesture before capture. */ }
      updatePreview(event);
      event.preventDefault();
      return true;
    },
    chooseColor(color) {
      const options = getState().selectedMagnetOptions ?? getLevel().magnetSchedule[0].options;
      if (disposed || locked || pointerId !== null || !options.includes(color)) return false;
      selectedColor = color;
      lastAction = null;
      invalidReason = null;
      hoverReason = null;
      previewCell = null;
      pointerPoint = null;
      notify();
      return true;
    },
    setLocked(value) { locked = Boolean(value); if (locked) cancel(); },
    snapshot() { return { pointerId, dragging, locked, selectedColor, previewCell: previewCell ? { ...previewCell } : null, pointerPoint: pointerPoint ? { ...pointerPoint } : null, action: lastAction ? structuredClone(lastAction) : null, actionCount, invalidReason }; },
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
