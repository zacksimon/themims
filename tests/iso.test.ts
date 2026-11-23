import { describe, expect, it } from 'vitest';
import { Rot, rotatePoint, unrotatePoint, screenToTile, screenToWorld, worldToScreen } from '../src/world/iso';
import { Camera } from '../src/world/camera';

const ROTS: Rot[] = [0, 1, 2, 3];

describe('isometric projection', () => {
  it('rotate and unrotate are inverses', () => {
    for (const r of ROTS) {
      const [a, b] = rotatePoint(3.25, 7.5, r, 24);
      const [x, y] = unrotatePoint(a, b, r, 24);
      expect(x).toBeCloseTo(3.25);
      expect(y).toBeCloseTo(7.5);
    }
  });

  it('screen <-> world round trips from every rotation', () => {
    const cam = new Camera(24);
    cam.w = 1000;
    cam.h = 700;
    for (const r of ROTS) {
      cam.setRot(r);
      for (const zoom of [0.5, 1, 2]) {
        cam.zoom = zoom;
        const [sx, sy] = worldToScreen(cam, 5.3, 17.8);
        const [x, y] = screenToWorld(cam, sx, sy);
        expect(x).toBeCloseTo(5.3);
        expect(y).toBeCloseTo(17.8);
      }
    }
  });

  it('clicking a tile picks the same tile from all four rotations', () => {
    const cam = new Camera(24);
    cam.w = 800;
    cam.h = 600;
    for (let tx = 0; tx < 24; tx += 5) {
      for (let ty = 0; ty < 24; ty += 7) {
        for (const r of ROTS) {
          cam.setRot(r);
          const [sx, sy] = worldToScreen(cam, tx + 0.5, ty + 0.5);
          expect(screenToTile(cam, sx, sy)).toEqual([tx, ty]);
        }
      }
    }
  });

  it('rotation keeps the world point at screen center in place', () => {
    const cam = new Camera(24);
    cam.cx = 4;
    cam.cy = 19;
    for (const r of ROTS) {
      cam.setRot(r);
      const [x, y] = screenToWorld(cam, cam.w / 2, cam.h / 2);
      expect(x).toBeCloseTo(4);
      expect(y).toBeCloseTo(19);
    }
  });

  it('rotate() animates through a fade and lands on the next stop', () => {
    const cam = new Camera(24);
    cam.rotate(1, 0);
    expect(cam.rotating).toBe(true);
    expect(cam.update(50)).toBeGreaterThan(0);
    cam.update(150);
    expect(cam.rot).toBe(1);
    expect(cam.update(400)).toBe(0);
    expect(cam.rotating).toBe(false);
    cam.rotate(-1, 500);
    cam.update(1000);
    cam.rotate(-1, 1000);
    cam.update(2000);
    expect(cam.rot).toBe(3);
  });

  it('zoom snaps to fixed levels and keeps the anchor point fixed', () => {
    const cam = new Camera(24);
    cam.w = 800;
    cam.h = 600;
    const before = screenToWorld(cam, 100, 100);
    cam.zoomAt(1.4, 100, 100);
    const mid = screenToWorld(cam, 100, 100);
    expect(mid[0]).toBeCloseTo(before[0]);
    cam.snapZoom(100, 100);
    expect(cam.zoom).toBe(1.5);
  });
});
