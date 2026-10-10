/* Template appended to generated design + asset data by build-figma-screens.cjs.
 * This is a normal Figma development plugin, not part of the running game.
 * It is supplied for manual use; remote MCP construction is currently blocked.
 */
function decodeBase64(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const result = [];
  let bits = 0, count = 0;
  for (const ch of value) {
    const v = alphabet.indexOf(ch);
    if (v < 0) continue;
    bits = (bits << 6) | v; count += 6;
    if (count >= 8) { count -= 8; result.push((bits >> count) & 255); }
  }
  return new Uint8Array(result);
}
function rgb(value) {
  const v = parseInt(value.slice(1), 16);
  return { r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 };
}
async function importScreens() {
  // Fail before mutating the document if the actual product font is unavailable.
  const font = { family: 'Nunito', style: 'Black' };
  await figma.loadFontAsync(font);
  const collection = figma.variables.createVariableCollection('Magnet Sort / Casual');
  const mode = collection.modes[0].modeId, tokens = {};
  for (const [name, hex] of Object.entries(design.palette)) {
    const variable = figma.variables.createVariable('Color/' + name, collection, 'COLOR');
    variable.setValueForMode(mode, rgb(hex)); variable.scopes = ['ALL_FILLS']; tokens[hex] = variable;
  }
  for (const [name, value] of Object.entries(design.report.hex)) {
    const variable = figma.variables.createVariable('Hex/' + name, collection, 'FLOAT');
    variable.setValueForMode(mode, value); variable.scopes = ['ALL_SCOPES'];
  }
  const styles = {}, masters = {}, hashes = {};
  function paint(hex) {
    const base = { type: 'SOLID', color: rgb(hex) };
    return tokens[hex] ? figma.variables.setBoundVariableForPaint(base, 'color', tokens[hex]) : base;
  }
  const libraryPage = figma.createPage(); libraryPage.name = '00 Components';
  await figma.setCurrentPageAsync(libraryPage);
  let index = 0;
  for (const [name, definition] of Object.entries(design.components)) {
    const master = figma.createComponent(); master.name = name;
    master.description = definition.description;
    master.resize(definition.width, definition.height); master.fills = []; master.clipsContent = false;
    const art = figma.createNodeFromSvg(definition.svg); master.appendChild(art);
    art.name = 'Editable vector artwork'; art.x = 0; art.y = 0;
    art.resize(definition.width, definition.height);
    art.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
    for (const vector of art.findAllWithCriteria({ types: ['VECTOR', 'RECTANGLE', 'ELLIPSE'] })) {
      if (!Array.isArray(vector.fills)) continue;
      vector.fills = vector.fills.map(fill => {
        if (fill.type !== 'SOLID') return fill;
        const hex = '#' + [fill.color.r, fill.color.g, fill.color.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
        return tokens[hex] ? figma.variables.setBoundVariableForPaint(fill, 'color', tokens[hex]) : fill;
      });
    }
    master.x = 100 + (index % 4) * 960; master.y = 100 + Math.floor(index / 4) * 890;
    master.exportSettings = [{ format: 'SVG', suffix: '' }, { format: 'PNG', suffix: '@2x', constraint: { type: 'SCALE', value: 2 } }];
    masters[name] = master; index++;
  }
  const families = [
    ['Tile', 'State', ['Tile default', 'Tile valid', 'Tile invalid', 'Tile hint']],
    ['Ring', 'Color', ['Ring violet', 'Ring blue', 'Ring coral']],
    ['Button', 'Skin', ['Button purple', 'Button green', 'Button light']],
    ['Magnet card', 'State', ['Tool neutral', 'Tool selected']],
  ];
  for (const [i, [family, property, names]] of families.entries()) {
    const variants = names.map(name => masters[name]);
    const stride = Math.max(...variants.map(node => node.width)) + 60;
    variants.forEach((node, j) => { node.name = property + '=' + names[j].split(' ').at(-1); node.x = j * stride; node.y = 0; });
    const set = figma.combineAsVariants(variants, libraryPage);
    set.name = family; set.x = 4200; set.y = 100 + i * 890;
    set.layoutMode = 'HORIZONTAL'; set.itemSpacing = 60;
    set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 24;
    set.description = family + ' variants used by the 12 screen compositions.';
  }
  for (const [name, asset] of Object.entries(assets)) hashes[name] = figma.createImage(decodeBase64(asset.base64)).hash;
  const screensPage = figma.createPage(); screensPage.name = '01 Screens';
  await figma.setCurrentPageAsync(screensPage);
  function make(source, parent) {
    let node;
    if (source.type === 'instance') node = masters[source.component].createInstance();
    else if (source.type === 'vector') node = figma.createNodeFromSvg(source.svg);
    else if (source.type === 'text') {
      node = figma.createText(); node.fontName = font; node.fontSize = source.size;
      node.characters = source.text; node.textAlignHorizontal = source.align;
      node.textAutoResize = 'NONE'; node.lineHeight = { unit: 'PERCENT', value: 135 };
      node.fills = [paint(source.color)];
      if (!styles[source.size]) {
        const style = figma.createTextStyle(); style.name = 'Nunito / Black / ' + source.size;
        style.fontName = font; style.fontSize = source.size; style.lineHeight = { unit: 'PERCENT', value: 135 };
        styles[source.size] = style;
      }
      node.textStyleId = styles[source.size].id;
    } else if (source.type === 'image') {
      node = figma.createRectangle(); node.fills = [{ type: 'IMAGE', imageHash: hashes[source.asset], scaleMode: 'FIT' }];
    } else {
      node = figma.createFrame(); node.fills = []; node.clipsContent = false;
    }
    parent.appendChild(node); node.name = source.name;
    node.resize(source.width, source.height); node.x = source.x; node.y = source.y;
    node.opacity = source.opacity ?? 1;
    if (source.rotation) {
      const angle = source.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
      const cx = source.width / 2, cy = source.height / 2;
      node.relativeTransform = [[c, -s, source.x + cx - c * cx + s * cy], [s, c, source.y + cy - s * cx - c * cy]];
    }
    if (source.children) for (const child of source.children) make(child, node);
    return node;
  }
  const imported = [];
  for (const [i, screen] of design.screens.entries()) {
    const frame = figma.createFrame(); frame.name = screen.id + ' / ' + screen.label;
    frame.resize(screen.width, screen.height); frame.fills = []; frame.clipsContent = true;
    frame.x = 100 + (i % 4) * 1041; frame.y = 100 + Math.floor(i / 4) * 1792;
    for (const child of screen.children) make(child, frame);
    frame.exportSettings = [{ format: 'PNG', suffix: '', constraint: { type: 'SCALE', value: 1 } }];
    imported.push(frame);
  }
  const allText = screensPage.findAllWithCriteria({ types: ['TEXT'] });
  if (allText.some(node => node.fontName.family !== 'Nunito')) throw new Error('Font validation failed');
  if (imported.length !== 12) throw new Error('Expected 12 screens');
  figma.currentPage.selection = [imported[2]];
  figma.viewport.scrollAndZoomIntoView([imported[2]]);
  figma.closePlugin('Imported 12 screens, ' + Object.keys(masters).length + ' components and editable Nunito text. Review before game implementation.');
}
importScreens().catch(error => figma.closePlugin('Import stopped: ' + error.message + '. Any partial pages are retained for inspection.'));
