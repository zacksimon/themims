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
  // bedroom
  w.addObject('bed_single', 6, 5, 0);
  w.addObject('fern', 10, 8, 0);
  // bathroom
  w.addObject('toilet', 11, 5, 0);
  w.addObject('shower', 13, 5, 0);
}
