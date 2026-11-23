import { Rng, hashString } from '../engine/rng';
import { SYLLABLES } from './social';

export interface Voice {
  /** Base pitch in Hz. */
  pitch: number;
  /** Pitch wobble range as a fraction of the base. */
  range: number;
  /** Syllables per second. */
  rate: number;
  wave: OscillatorType;
  /** Multiplier on vowel formant frequencies (timbre). */
  formant: number;
  syllables: string[];
}

/** A stable voice generated from a seed (the same Mim always sounds the same). */
export function voiceFromSeed(seed: string): Voice {
  const r = new Rng(hashString(seed));
  const low = r.chance(0.5);
  const pool = [...SYLLABLES];
  const syllables: string[] = [];
  for (let i = 0; i < 7; i++) syllables.push(pool.splice(Math.floor(r.next() * pool.length), 1)[0]);
  return {
    pitch: low ? r.range(105, 165) : r.range(175, 290),
    range: r.range(0.12, 0.3),
    rate: r.range(5, 8.5),
    wave: r.pick(['triangle', 'sawtooth', 'square', 'triangle'] as OscillatorType[]),
    formant: r.range(0.85, 1.2),
    syllables,
  };
}
