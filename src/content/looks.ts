import { Rng } from '../engine/rng';

export interface Look {
  skin: string;
  hair: string;
  hairStyle: 'bob' | 'spiky' | 'bun' | 'bald' | 'long' | 'mohawk';
  shirt: string;
  pants: string;
  /** 0.9 to 1.1 multiplier on body height. */
  height: number;
}

export const SKINS = ['#f6d3b3', '#eab68c', '#c98b5e', '#9a6440', '#6b4228', '#f2c79b'];
export const HAIRS = ['#2b1d14', '#5a3a22', '#a8642c', '#e3c16f', '#b33a2c', '#e8e8e8', '#4b6cc9', '#9b4fc7'];
export const SHIRTS = ['#ff7a59', '#5cc8a8', '#4f7fd9', '#f2c14e', '#c95ca8', '#7bc950', '#e8e8e8', '#3a3a4a'];
export const PANTS = ['#3a3f5c', '#5a4632', '#2f5a4a', '#6b6b78', '#8a3a3a', '#283048'];
export const HAIR_STYLES: Look['hairStyle'][] = ['bob', 'spiky', 'bun', 'bald', 'long', 'mohawk'];

export function randomLook(rng: Rng): Look {
  return {
    skin: rng.pick(SKINS),
    hair: rng.pick(HAIRS),
    hairStyle: rng.pick(HAIR_STYLES),
    shirt: rng.pick(SHIRTS),
    pants: rng.pick(PANTS),
    height: rng.range(0.92, 1.08),
  };
}
