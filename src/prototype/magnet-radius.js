// String color slots remain stable; each offered magnet owns its range.
// Historical fixtures without a type retain their radius-two behavior.
export const magnetRadius = (state,color) => state.magnetRadii?.[color] === 1 ? 1 : 2;
export const rangeArt = radius => `${import.meta.env.BASE_URL}art/range-${radius}.svg`;
