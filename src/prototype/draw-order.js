// Fixed-camera painter order: paint each row's tiles, shadows, source lights,
// resting chips and badges before the next, nearer row. Airborne chips stay
// above every row, including the translucent front of the source lights.
// These bands apply to the authored PNG planes with depth testing disabled.
export const FLIGHT_ORDER = 18000;
export const cellDrawOrder = cell => 1000 + cell.row * 1000;
export const unitDrawOrder = pose => pose.from
  ? FLIGHT_ORDER
  : cellDrawOrder(pose.cell) + 10 + pose.index * 2;
