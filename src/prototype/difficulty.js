// Stable level bands shared by stack generation and magnet choices.
export const COLOR_ORDER = Object.freeze(['violet','blue','coral','gold','lime','teal','pink']);
export function levelPalette(number) {
  if (!Number.isInteger(number) || number < 1 || number > 12) throw new Error('Invalid level number');
  const count = number <= 3 ? 3 : number <= 6 ? 4 : number <= 9 ? 5 : number <= 11 ? 6 : 7;
  return COLOR_ORDER.slice(0, count);
}
export function levelGroupCounts(number, height=12) {
  levelPalette(number); // Same validated level range.
  if(![6,12].includes(height))throw new Error('Invalid stack height');
  // More colors in the level and mandatory mixed stacks increase difficulty;
  // two equal groups keep later boards manageable with seven available colors.
  return number <= 6 ? [1,2] : [2];
}
export function spawnInterval(number) {
  levelPalette(number);
  return number <= 6 ? 1 : number <= 9 ? 2 : 3;
}
