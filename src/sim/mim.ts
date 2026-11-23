import { Look } from '../content/looks';
import { Tile } from '../world/pathfinding';
import { Needs, fullNeeds } from './needs';
import { Voice, voiceFromSeed } from '../content/voices';
import type { Emotion } from '../content/social';

export type Pose = 'stand' | 'walk' | 'sit' | 'lie';

export const WALK_SPEED = 2.4; // tiles per game minute
export const MAX_QUEUE = 6;

export interface Action {
  uid: number;
  kind: 'interact' | 'goto' | 'eat' | 'social';
  objId?: number;
  ix?: string;
  tile?: Tile;
  /** Chosen by free will (true) or queued by the player (false). */
  auto: boolean;
  phase: 'pending' | 'walk' | 'use';
  /** The slot actually used, which may belong to a seat rather than the target. */
  slotObj?: number;
  slot?: number;
  route?: Tile;
  /** Minutes spent in the use phase. */
  t: number;
  cancel?: boolean;
  label: string;
  icon: string;
  /** Inserted as a follow-up step of the previous action (keeps carried items). */
  chained?: boolean;
  /** For eating: hunger restored over the meal. */
  food?: number;
  /** Social: the other Mim, which interaction, and whether it was accepted. */
  targetMim?: number;
  social?: string;
  accepted?: boolean;
  /** Re-route attempts when a social target wanders off. */
  tries?: number;
  /** Minutes spent waiting for an occupied object. */
  waited?: number;
}

export interface Mim {
  id: number;
  name: string;
  look: Look;
  /** Feet position in world coordinates. */
  x: number;
  y: number;
  z: number;
  /** Facing as a world-space unit vector. */
  fx: number;
  fy: number;
  pose: Pose;
  /** World head/feet points while lying down. */
  lie?: [number, number, number, number];
  /** Remaining waypoints (tile centers), consumed as the Mim walks. */
  path: Tile[];
  /** Walk animation phase. */
  anim: number;
  needs: Needs;
  queue: Action[];
  carry?: string;
  thought?: { icon: string; until: number };
  /** Minutes until free will next looks for something to do. */
  fwTimer: number;
  /** Object ids this Mim recently failed to reach, with the time to retry. */
  unreachable: Record<number, number>;
  voice: Voice;
  /** Speech bubble (social), separate from thought bubbles. */
  speech?: { icon: string; until: number; emotion: Emotion };
  /** Held in conversation by another Mim: stand still and face them. */
  engaged?: { with: number; until: number };
}

export function createMim(id: number, name: string, look: Look, tx: number, ty: number): Mim {
  return {
    id, name, look, x: tx + 0.5, y: ty + 0.5, z: 0, fx: 0, fy: 1, pose: 'stand', path: [], anim: 0,
    needs: fullNeeds(), queue: [], fwTimer: 1, unreachable: {}, voice: voiceFromSeed(`${name}#${id}`),
  };
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
  if (m.path.length) {
    m.anim += dtMin * WALK_SPEED * 2.2;
    m.pose = 'walk';
  } else if (m.pose === 'walk') m.pose = 'stand';
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
