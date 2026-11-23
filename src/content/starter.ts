import type { World } from '../sim/world';

/** The Fumblewicks' starter house: living room, kitchen, bedroom, bathroom and a spare room. Front door faces the street (+y). */
export function buildStarterHouse(w: World): void {
  const lot = w.lot;
  // rooms: floors 0 oak, 1 checker, 2 tangerine shag, 4 blue carpet, 5 spa tile
  lot.addRoom(5, 9, 12, 15, 2, 0); // living room
  lot.addRoom(12, 9, 17, 15, 1, 1); // kitchen
  lot.addRoom(5, 5, 11, 9, 4, 4); // bedroom
  lot.addRoom(11, 5, 14, 9, 5, 1); // bathroom
  lot.addRoom(14, 5, 17, 9, 0, 0); // spare room
  const door = (k: string, style = 0) => lot.setWall(k, { kind: 'door', style });
  const win = (k: string, style = 0) => lot.setWall(k, { kind: 'window', style });
  door('h:8:15'); // front door
  door('h:7:9', 4); // bedroom
  door('h:12:9', 1); // bathroom -> kitchen
  door('h:15:9', 0); // spare room -> kitchen
  door('v:12:11', 1); // living <-> kitchen
  for (const k of ['h:6:15', 'h:10:15', 'h:14:15', 'h:16:15', 'v:5:11', 'v:5:13', 'v:5:7', 'h:7:5', 'h:9:5', 'h:15:5', 'v:17:11', 'v:17:13']) win(k);
  for (const k of ['h:7:5', 'h:9:5', 'v:5:7']) lot.setWall(k, { kind: 'window', style: 4 });
  lot.setWall('h:15:5', { kind: 'window', style: 0 });
  lot.setWall('v:17:11', { kind: 'window', style: 1 });
  lot.setWall('v:17:13', { kind: 'window', style: 1 });
  lot.setWall('h:14:15', { kind: 'window', style: 1 });
  lot.setWall('h:16:15', { kind: 'window', style: 1 });

  // kitchen
  w.addObject('fridge_basic', 13, 9, 0);
  w.addObject('counter', 14, 9, 0);
  w.addObject('stove', 15, 9, 0);
  w.addObject('sink', 16, 9, 0);
  w.addObject('table', 14, 12, 0);
  w.addObject('chair_dining', 14, 13, 2);
  w.addObject('chair_dining', 15, 12, 1);
  w.addObject('chair_dining', 13, 12, 3);
  // living room
  w.addObject('sofa', 8, 10, 0);
  w.addObject('tv', 8, 13, 2);
  w.addObject('bookshelf', 5, 12, 3);
  w.addObject('boombox', 11, 14, 2);
  w.addObject('fern', 5, 14, 0);
  w.addObject('lava_lamp', 11, 9, 0);
  w.addObject('phone', 5, 10, 3);
  // bedroom
  w.addObject('bed_single', 6, 5, 0);
  w.addObject('bed_single', 8, 5, 0);
  // spare room, now Gus's and Pim's
  w.addObject('bed_single', 14, 5, 0);
  w.addObject('bed_single', 16, 5, 0);
  w.addObject('fern', 10, 8, 0);
  // bathroom
  w.addObject('toilet', 11, 5, 0);
  w.addObject('shower', 13, 5, 0);
}

import { Look } from './looks';
import type { Voice } from './voices';
import { voiceFromSeed } from './voices';

interface Member {
  name: string;
  look: Look;
  at: [number, number];
  voice: Partial<Voice>;
}

/** The Fumblewicks, as described in CONTENT.md, with their distinct voices. */
export const FUMBLEWICKS: Member[] = [
  {
    name: 'Bartley Fumblewick', at: [9, 12],
    look: { skin: '#eab68c', hair: '#5a3a22', hairStyle: 'bob', shirt: '#4f7fd9', pants: '#3a3f5c', height: 1.05 },
    voice: { pitch: 150, rate: 5.2, wave: 'triangle', formant: 0.95, range: 0.15 },
  },
  {
    name: 'Dotty Fumblewick', at: [10, 12],
    look: { skin: '#f6d3b3', hair: '#b33a2c', hairStyle: 'bun', shirt: '#5cc8a8', pants: '#283048', height: 0.97 },
    voice: { pitch: 250, rate: 8.2, wave: 'sawtooth', formant: 1.15, range: 0.22 },
  },
  {
    name: 'Gus Fumblewick', at: [14, 11],
    look: { skin: '#9a6440', hair: '#2b1d14', hairStyle: 'spiky', shirt: '#f2c14e', pants: '#5a4632', height: 1.0 },
    voice: { pitch: 110, rate: 4.6, wave: 'square', formant: 0.85, range: 0.1 },
  },
  {
    name: 'Pim Fumblewick', at: [7, 13],
    look: { skin: '#c98b5e', hair: '#e8e8e8', hairStyle: 'mohawk', shirt: '#e8e8e8', pants: '#3a3a4a', height: 0.92 },
    voice: { pitch: 300, rate: 7.4, wave: 'triangle', formant: 1.2, range: 0.32 },
  },
];

export function addFumblewicks(w: World): void {
  for (const f of FUMBLEWICKS) {
    const m = w.addMim(f.name, f.look, f.at[0], f.at[1]);
    m.voice = { ...voiceFromSeed(f.name), ...f.voice };
  }
}
