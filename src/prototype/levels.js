const cells = Array.from({ length: 25 }, (_, i) => ({ col: i % 5 + 1, row: Math.floor(i / 5) + 1 }));
const makeStack = (col, row, colors) => ({ cell: { col, row }, units: colors.map((color, i) => ({ id: `r${row}c${col}-${i}`, color })) });
const repeat = (color, count) => Array(count).fill(color);
const action = (color, col = 3, row = 3) => ({ type: 'placeMagnet', color, cell: { col, row } });
export const prototypeLevels = [
  { id: 'magnet-v3-01', rulesVersion: 3, title: 'Your first pull', subtitle: 'One magnet. A whole chain.',
    lesson: 'Place the violet magnet on an empty tile. Pieces move one at a time; six collected pieces clear.',
    cells, blockers: [], moves: 3, clearSize: 6, magnets: ['violet'],
    stacks: [makeStack(2, 2, repeat('violet', 4)), makeStack(4, 2, repeat('violet', 4)), makeStack(3, 5, repeat('violet', 4))],
    solution: [action('violet')] },
  { id: 'magnet-v3-02', rulesVersion: 3, title: 'Every color has a pull', subtitle: 'Attract matching pieces.',
    lesson: 'A magnet attracts exposed pieces of its color. Other stacks block the path.',
    cells, blockers: [{ col: 3, row: 2 }], moves: 4, clearSize: 6, magnets: ['violet', 'blue', 'coral'],
    stacks: [makeStack(1, 2, repeat('violet', 3)), makeStack(2, 2, repeat('violet', 3)),
      makeStack(4, 2, repeat('blue', 3)), makeStack(5, 2, repeat('blue', 3)),
      makeStack(2, 4, repeat('coral', 3)), makeStack(4, 4, repeat('coral', 3))],
    solution: [action('violet'), action('blue'), action('coral')] },
  { id: 'magnet-v3-03', rulesVersion: 3, title: 'Under the top layer', subtitle: 'Expose a color. Change the route.',
    lesson: 'Remove the top color to expose the next. Groups smaller than six stay on the board.',
    cells, blockers: [{ col: 3, row: 1 }, { col: 3, row: 5 }], moves: 5, clearSize: 6, magnets: ['violet', 'blue', 'coral'],
    stacks: [makeStack(2, 2, [...repeat('blue', 3), ...repeat('violet', 3)]),
      makeStack(4, 2, [...repeat('coral', 3), ...repeat('blue', 3)]),
      makeStack(2, 4, [...repeat('violet', 3), ...repeat('coral', 3)])],
    solution: [action('violet'), action('blue', 3, 2), action('coral', 3, 4), action('violet', 3, 2)] },
];
