import { Look } from '../../content/looks';
import { View, rotateDir, worldToScreen } from '../iso';
import { shade } from './draw';
import type { Pose } from '../../sim/mim';

export interface MimDrawState {
  x: number;
  y: number;
  /** Height above the floor in world units (sitting on a chair, lying on a bed). */
  z?: number;
  fx: number;
  fy: number;
  pose: Pose;
  anim: number;
  look: Look;
  /** Optional facial expression: -1 frown, 0 neutral, 1 smile. */
  mood?: number;
}

/** Convert a world facing vector into a screen direction for the current camera rotation. */
export function screenFacing(v: View, fx: number, fy: number): { sx: number; front: boolean } {
  const [rx, ry] = rotateDir(fx, fy, v.rot);
  const sx = rx - ry;
  const sy = (rx + ry) / 2;
  return { sx, front: sy > -0.05 };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Procedural Mim: shadow, legs, body, arms, head, hair and face. Sizes are in CSS px at zoom 1. */
export function drawMim(ctx: CanvasRenderingContext2D, v: View, m: MimDrawState): void {
  const [fx, fy] = worldToScreen(v, m.x, m.y, 0);
  const [px, py] = worldToScreen(v, m.x, m.y, m.z ?? 0);
  const s = v.zoom * m.look.height;
  const { sx: dirX, front } = screenFacing(v, m.fx, m.fy);
  const side = Math.abs(dirX) < 0.25 ? 0 : Math.sign(dirX);
  const L = m.look;
  ctx.save();
  // shadow on the floor
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(fx, fy, 11 * v.zoom, 5 * v.zoom, 0, 0, Math.PI * 2);
  ctx.fill();

  if (m.pose === 'lie') {
    drawLying(ctx, px, py, s, L, side || 1);
    ctx.restore();
    return;
  }
  ctx.translate(px, py);
  ctx.scale(s, s);
  const walking = m.pose === 'walk';
  const swing = walking ? Math.sin(m.anim * Math.PI) : 0;
  const bob = walking ? Math.abs(Math.cos(m.anim * Math.PI)) * 1.5 : 0;
  const sitting = m.pose === 'sit';
  const legH = sitting ? 7 : 14;
  ctx.translate(0, -bob);

  // legs
  const legW = 5;
  if (sitting) {
    roundRect(ctx, -7 + side * 3, -legH, 6, legH, 2, L.pants);
    roundRect(ctx, 1 + side * 3, -legH, 6, legH, 2, shade(L.pants, 0.85));
  } else {
    roundRect(ctx, -6 + swing * 2.5 * (side || 1), -legH, legW, legH, 2, shade(L.pants, 0.85));
    roundRect(ctx, 1 - swing * 2.5 * (side || 1), -legH, legW, legH, 2, L.pants);
    // shoes
    ctx.fillStyle = '#2a2230';
    ctx.fillRect(-6 + swing * 2.5 * (side || 1), -2, legW, 2);
    ctx.fillRect(1 - swing * 2.5 * (side || 1), -2, legW, 2);
  }
  // body
  const bodyTop = -legH - 18;
  const armSwing = walking ? swing * 3 : 0;
  // back arm
  roundRect(ctx, side >= 0 ? -12 : 7, bodyTop + 2 - armSwing, 5, 14, 2.5, shade(L.shirt, 0.75));
  roundRect(ctx, -9, bodyTop, 18, 19, 6, L.shirt);
  // front arm
  roundRect(ctx, side >= 0 ? 7 : -12, bodyTop + 2 + armSwing, 5, 14, 2.5, shade(L.shirt, 0.9));
  ctx.fillStyle = L.skin;
  ctx.beginPath();
  ctx.arc(side >= 0 ? 9.5 : -9.5, bodyTop + 17 + armSwing, 2.6, 0, Math.PI * 2);
  ctx.fill();

  // head
  const hy = bodyTop - 9;
  ctx.fillStyle = L.skin;
  ctx.beginPath();
  ctx.arc(0, hy, 9.5, 0, Math.PI * 2);
  ctx.fill();
  drawHair(ctx, L, hy, front, side);
  if (front) drawFace(ctx, hy, side, m.mood ?? 0);
  ctx.restore();
}

function drawHair(ctx: CanvasRenderingContext2D, L: Look, hy: number, front: boolean, side: number) {
  ctx.fillStyle = L.hair;
  const st = L.hairStyle;
  if (st === 'bald') {
    if (!front) {
      ctx.fillStyle = shade(L.skin, 0.9);
      ctx.beginPath();
      ctx.arc(0, hy, 9.5, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (!front) {
    // back of the head is mostly hair
    ctx.beginPath();
    ctx.arc(0, hy, 10, 0, Math.PI * 2);
    ctx.fill();
    if (st === 'long' || st === 'bob') ctx.fillRect(-10, hy, 20, st === 'long' ? 14 : 6);
    if (st === 'bun') {
      ctx.beginPath();
      ctx.arc(0, hy - 10, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  // cap of hair on top
  ctx.beginPath();
  ctx.arc(0, hy - 1, 10, Math.PI * 1.02, Math.PI * 1.98);
  ctx.lineTo(9, hy - 2);
  ctx.quadraticCurveTo(side * 4, hy - 6, -9, hy - 2);
  ctx.fill();
  if (st === 'spiky') {
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 4 - 3, hy - 7);
      ctx.lineTo(i * 4, hy - 15);
      ctx.lineTo(i * 4 + 3, hy - 7);
      ctx.fill();
    }
  } else if (st === 'mohawk') {
    ctx.fillRect(-2, hy - 17, 4, 9);
  } else if (st === 'bun') {
    ctx.beginPath();
    ctx.arc(0, hy - 11, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (st === 'bob' || st === 'long') {
    const len = st === 'long' ? 15 : 8;
    ctx.fillRect(-10.5, hy - 3, 4, len);
    ctx.fillRect(6.5, hy - 3, 4, len);
  }
}

function drawFace(ctx: CanvasRenderingContext2D, hy: number, side: number, mood: number) {
  const ox = side * 3;
  ctx.fillStyle = '#2b2350';
  for (const ex of side === 0 ? [-3.5, 3.5] : [ox - 2.5, ox + 3.5]) {
    ctx.beginPath();
    ctx.ellipse(ex, hy + 1, 1.3, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#2b2350';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const my = hy + 5.5;
  if (mood > 0.3) ctx.arc(ox, my - 1.5, 2.6, 0.2 * Math.PI, 0.8 * Math.PI);
  else if (mood < -0.3) ctx.arc(ox, my + 2, 2.6, 1.2 * Math.PI, 1.8 * Math.PI);
  else {
    ctx.moveTo(ox - 2, my);
    ctx.lineTo(ox + 2, my);
  }
  ctx.stroke();
}

function drawLying(ctx: CanvasRenderingContext2D, px: number, py: number, s: number, L: Look, dir: number) {
  ctx.translate(px, py);
  ctx.scale(s * dir, s);
  roundRect(ctx, -22, -12, 16, 9, 3, L.pants);
  roundRect(ctx, -8, -14, 18, 12, 5, L.shirt);
  ctx.fillStyle = L.skin;
  ctx.beginPath();
  ctx.arc(16, -10, 8, 0, Math.PI * 2);
  ctx.fill();
  if (L.hairStyle !== 'bald') {
    ctx.fillStyle = L.hair;
    ctx.beginPath();
    ctx.arc(19, -11, 7, -0.6 * Math.PI, 0.5 * Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = '#2b2350';
  ctx.fillRect(12, -12, 3, 1.2);
}

/** Selection marker: a pulsing ring on the floor plus a floating chevron. */
export function drawSelection(ctx: CanvasRenderingContext2D, v: View, x: number, y: number, t: number, headZ = 2.0): void {
  const [sx, sy] = worldToScreen(v, x, y, 0);
  const pulse = 1 + Math.sin(t / 220) * 0.08;
  ctx.save();
  ctx.strokeStyle = '#ffe27a';
  ctx.lineWidth = 3 * v.zoom;
  ctx.beginPath();
  ctx.ellipse(sx, sy, 15 * v.zoom * pulse, 7.5 * v.zoom * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
  const [hx, hy] = worldToScreen(v, x, y, headZ);
  const by = hy - 8 * v.zoom + Math.sin(t / 300) * 3 * v.zoom;
  const w = 7 * v.zoom;
  ctx.fillStyle = '#ffe27a';
  ctx.strokeStyle = '#2b2350';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(hx - w, by - w);
  ctx.lineTo(hx + w, by - w);
  ctx.lineTo(hx, by + w * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
