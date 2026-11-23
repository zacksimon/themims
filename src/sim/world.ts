import { Lot } from '../world/lot';
import { Rng } from '../engine/rng';

/** All simulation state. Rendering and UI read from it; nothing in here touches the DOM. */
export class World {
  lot: Lot;
  /** Game minutes since day 1, 00:00. */
  time = 8 * 60;
  funds = 20000;
  rng: Rng;

  constructor(n = 24, seed = 1234) {
    this.lot = new Lot(n);
    this.rng = new Rng(seed);
  }

  step(dtMin: number): void {
    this.time += dtMin;
  }
}
