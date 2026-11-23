import { Look } from '../content/looks';
import { Tile } from '../world/pathfinding';

export type Pose = 'stand' | 'walk' | 'sit' | 'lie';

export const WALK_SPEED = 2.4; // tiles per game minute

export interface Mim {
  id: number;
  name: string;
  look: Look;
  /** Feet position in world coordinates. */
  x: number;
  y: number;
  /** Facing as a world-space unit vector. */
  fx: number;
  fy: number;
  pose: Pose;
  /** Remaining waypoints (tile centers), consumed as the Mim walks. */
  path: Tile[];
  /** Walk animation phase. */
  anim: number;
}

export function createMim(id: number, name: string, look: Look, tx: number, ty: number): Mim {
  return { id, name, look, x: tx + 0.5, y: ty + 0.5, fx: 0, fy: 1, pose: 'stand', path: [], anim: 0 };
}

export function mimTile(m: Mim): Tile {
  return [Math.floor(m.x), Math.floor(m.y)];
}

/** Advance along the path. Returns true when the Mim has arrived (or had nowhere to go). */
export function stepWalk(m: Mim, dtMin: number): boolean {
  let budget = WALK_SPEED * dtMin;
  while (budget > 0 && m.path.length) {
    const [tx, ty] = m.path[0];
    const gx = tx + 0.5, gy = ty + 0.5;
    const dx = gx - m.x, dy = gy - m.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) {
      m.path.shift();
      continue;
    }
    m.fx = dx / d;
    m.fy = dy / d;
    if (d <= budget) {
      m.x = gx;
      m.y = gy;
      budget -= d;
      m.path.shift();
    } else {
      m.x += (dx / d) * budget;
      m.y += (dy / d) * budget;
      budget = 0;
    }
  }
  m.anim += dtMin * WALK_SPEED * 2.2;
  m.pose = m.path.length ? 'walk' : m.pose === 'walk' ? 'stand' : m.pose;
  return m.path.length === 0;
}

export function faceToward(m: Mim, x: number, y: number): void {
  const dx = x - m.x, dy = y - m.y;
  const d = Math.hypot(dx, dy);
  if (d > 1e-6) {
    m.fx = dx / d;
    m.fy = dy / d;
  }
}
