import { OBJECTS } from '../content/objects';
import { View, Z_PX } from '../world/iso';
import { Painter } from '../world/render/painter';

const cache = new Map<string, string>();

/** Render a catalog thumbnail for an object definition (cached as a data URL). */
export function thumbnail(defId: string, size = 72): string {
  const hit = cache.get(defId);
  if (hit) return hit;
  const d = OBJECTS[defId];
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = size * dpr;
  c.height = size * dpr;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const [w, h] = d.size;
  const zoom = Math.min(1.1, (size * 0.9) / (Math.max(w + h, 2) * 32 + d.height * Z_PX * 0.6));
  const v: View = { cx: w / 2, cy: h / 2, zoom, rot: 0, w: size, h: size + d.height * Z_PX * zoom, n: 8 };
  const p = new Painter(v, d, 0, 0, 0);
  d.draw(p, null, 0);
  p.out.sort((a, b) => a.depth - b.depth).forEach((x) => x.draw(ctx, v));
  const url = c.toDataURL();
  cache.set(defId, url);
  return url;
}
