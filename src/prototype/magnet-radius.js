// String color slots remain stable; each offered magnet owns its range.
// Historical fixtures without a type retain their radius-two behavior.
export const magnetRadius = (state,color) => state.magnetRadii?.[color] === 1 ? 1 : 2;
export const rangeArt = radius => `${import.meta.env.BASE_URL}art/range-map-${radius}.png`;

// Neutral generated blue tiles keep their white bevel while matching each magnet.
export const rangeHue = color => ({violet:64,blue:0,coral:165,gold:195,lime:240,teal:330,pink:120})[color]??0;
