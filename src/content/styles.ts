export interface FloorStyle { name: string; price: number; a: string; b: string; pattern: 'plain' | 'checker' | 'planks' }
export interface WallStyle { name: string; price: number; color: string; trim: string }

export const FLOORS: FloorStyle[] = [
  { name: 'Honest Oak Planks', price: 10, a: '#b9824f', b: '#a8723f', pattern: 'planks' },
  { name: 'Diner Checkerboard', price: 12, a: '#eeeeee', b: '#2f2f3a', pattern: 'checker' },
  { name: 'Shag Carpet, Tangerine', price: 8, a: '#d9843a', b: '#cf7a31', pattern: 'plain' },
  { name: 'Brutalist Concrete', price: 4, a: '#a3a3a0', b: '#9a9a97', pattern: 'plain' },
  { name: 'Calm Blue Carpet', price: 8, a: '#5d78b3', b: '#5670aa', pattern: 'plain' },
  { name: 'Spa Day Tile', price: 14, a: '#9fd3cf', b: '#8cc6c2', pattern: 'checker' },
];

export const WALLS: WallStyle[] = [
  { name: 'Beige of Compromise', price: 10, color: '#e6d6b8', trim: '#c9b48f' },
  { name: 'Minty Stripes', price: 12, color: '#bfe3cf', trim: '#8fc2a6' },
  { name: 'Exposed Brick (Trendy)', price: 16, color: '#b5654a', trim: '#8f4a34' },
  { name: 'Wood Paneling of the Past', price: 14, color: '#8a5a35', trim: '#6b4225' },
  { name: 'Lavender Haze', price: 12, color: '#c9b6e4', trim: '#a48fc6' },
];

export const DOOR_PRICE = 120;
export const WINDOW_PRICE = 80;
