import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { allCells, cellId } from '../game/hex.js';
import { drawResolutionEffects, drawTutorialHint } from './effects.js';
import { cellToScreen } from './layout.js';
import { visualStackLayers } from './stack-art.js';

export function createBoardRenderer(root, assets = null) {
  const grid = new Container({ eventMode: 'none' });
  const pieces = new Container({ eventMode: 'none' });
  const overlay = new Container({ eventMode: 'none' });
  const effectsView = new Graphics();
  const tray = new Sprite();
  const target = new Sprite();
  const dragged = new Sprite();
  for (const sprite of [tray, target, dragged]) sprite.anchor.set(0.5);
  overlay.addChild(effectsView, tray, target, dragged);
  root.addChild(grid, pieces, overlay);
  pieces.sortableChildren = true;
  const cells = allCells().map(entry => {
    const sprite = new Sprite();
    sprite.anchor.set(0.5);
    grid.addChild(sprite);
    return { ...entry, sprite };
  });
  const tokens = new Map();
  let disposed = false;
  const texture = key => assets?.get(key) ?? Texture.WHITE;

  function render(level, state, layout, interaction = {}) {
    if (disposed) return;
    const animation = interaction.animation;
    const renderTokens = animation?.active ? animation.tokens : state.tokens;
    const blocked = new Set(level.blockedCells.map(cellId));
    const crates = new Set((state.crates ?? level.crates ?? []).map(cellId));
    const scale = layout.radius / 96;
    for (const { cell, sprite } of cells) {
      const key = cellId(cell);
      const point = cellToScreen(cell, layout);
      sprite.texture = texture(blocked.has(key) ? 'blocked' : crates.has(key) ? 'crate' : 'empty');
      sprite.position.set(point.x, point.y);
      sprite.scale.set(scale);
    }
    const live = new Set();
    for (const token of renderTokens) {
      live.add(token.tokenId);
      let view = tokens.get(token.tokenId);
      if (!view) {
        const node = new Container();
        const sprite = new Sprite();
        sprite.anchor.set(0.5);
        const mass = new Text({ text: '', style: { fontFamily: 'Arial, sans-serif', fontSize: 27, fontWeight: '900', fill: '#ffffff' } });
        mass.anchor.set(0.5);
        node.addChild(sprite, mass);
        pieces.addChild(node);
        view = { node, sprite, mass };
        tokens.set(token.tokenId, view);
      }
      let point = cellToScreen(token.cell, layout);
      if (token.fromCell && token.toCell) {
        const from = cellToScreen(token.fromCell, layout), to = cellToScreen(token.toCell, layout);
        point = { x: from.x + (to.x - from.x) * token.moveProgress, y: from.y + (to.y - from.y) * token.moveProgress };
      }
      const layers = visualStackLayers(token.mass);
      view.sprite.texture = texture(token.color + '-' + layers);
      view.mass.text = String(token.mass);
      view.mass.position.set(44, 27 - (layers - 1) * 6);
      view.node.position.set(point.x, point.y);
      view.node.scale.set(scale * (token.scale ?? 1));
      view.node.alpha = token.alpha ?? 1;
      view.node.zIndex = point.y;
    }
    for (const [id, view] of tokens) {
      if (!live.has(id)) { view.node.destroy({ children: true }); tokens.delete(id); }
    }
    effectsView.clear();
    const color = interaction.selectedColor ?? state.selectedMagnetOptions?.[0] ?? level.magnetSchedule[0].options[0];
    const trayY = Math.min(layout.height - layout.radius * 0.72, layout.originY + layout.boardHeight + layout.radius * 0.9);
    const trayWidth = Math.max(92, layout.radius * 3.8);
    effectsView.roundRect(layout.width / 2 - trayWidth / 2, trayY - 26, trayWidth, 52, 18)
      .fill({ color: 0xa64924, alpha: 0.96 }).stroke({ color: 0xf0ae56, width: 2 });
    tray.texture = texture('magnet-' + color);
    tray.position.set(layout.width / 2, trayY - 3);
    tray.scale.set(Math.max(0.22, scale * 0.78));
    tray.alpha = interaction.dragging ? 0.35 : 1;
    const magnet = animation?.active ? animation.magnet : null;
    target.visible = Boolean(interaction.previewCell || magnet);
    if (target.visible) {
      const point = cellToScreen(magnet?.cell ?? interaction.previewCell, layout);
      target.texture = texture('magnet-' + (magnet?.color ?? color));
      target.position.set(point.x, point.y - layout.radius * 0.04);
      target.scale.set(scale * 1.04);
      target.alpha = magnet ? 1 : interaction.dragging ? 0.28 : 0.9;
    }
    dragged.visible = Boolean(interaction.dragging && interaction.pointerPoint);
    if (dragged.visible) {
      dragged.texture = texture('magnet-' + color);
      dragged.position.set(interaction.pointerPoint.x, interaction.pointerPoint.y - 32);
      dragged.scale.set(scale * 1.12);
    }
    drawResolutionEffects(effectsView, animation?.effects ?? [], layout);
    drawTutorialHint(effectsView, interaction.tutorialHint, layout);
  }
  return {
    render,
    dispose() {
      if (disposed) return;
      disposed = true;
      tokens.clear();
      grid.destroy({ children: true }); pieces.destroy({ children: true }); overlay.destroy({ children: true });
    },
  };
}
