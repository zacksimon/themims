import { Lot } from '../world/lot';
import { Rng } from '../engine/rng';
import { Mim, createMim, mimTile, stepWalk } from './mim';
import { Look } from '../content/looks';
import { Tile, findPath } from '../world/pathfinding';

export interface WorldEvents {
  toast: { text: string; kind?: 'info' | 'good' | 'bad' };
}

/** All simulation state. Rendering and UI read from it; nothing in here touches the DOM. */
export class World {
  lot: Lot;
  /** Game minutes since day 1, 00:00. */
  time = 8 * 60;
  funds = 20000;
  rng: Rng;
  mims: Mim[] = [];
  nextId = 1;
  /** Notifications for the UI to show; drained by the game each frame. */
  outbox: WorldEvents['toast'][] = [];

  constructor(n = 24, seed = 1234) {
    this.lot = new Lot(n);
    this.rng = new Rng(seed);
  }

  addMim(name: string, look: Look, tx: number, ty: number): Mim {
    const m = createMim(this.nextId++, name, look, tx, ty);
    this.mims.push(m);
    return m;
  }

  mim(id: number): Mim | undefined {
    return this.mims.find((m) => m.id === id);
  }

  notify(text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
    this.outbox.push({ text, kind });
  }

  /** Send a Mim walking to a tile. Returns false (and leaves the Mim alone) when the tile can't be reached. */
  walkTo(m: Mim, target: Tile): boolean {
    const path = findPath(this.lot, mimTile(m), [target]);
    if (!path) return false;
    // keep moving smoothly: drop the current tile from the path if we are already standing in it
    m.path = path.slice(1);
    if (!m.path.length) m.path = [target];
    return true;
  }

  step(dtMin: number): void {
    this.time += dtMin;
    for (const m of this.mims) stepWalk(m, dtMin);
  }
}
