import { CATALOG_ORDER, Category, OBJECTS } from '../content/objects';
import { DOOR_PRICE, FLOORS, WALLS, WINDOW_PRICE } from '../content/styles';
import type { Gesture } from '../engine/input';
import type { Game } from '../game';
import { Builder, edgeRun, nearestEdge, rectTiles } from '../sim/build';
import { Dir, ObjInst, defOf, worldSize } from '../sim/objects';
import { View, projectRotated, rotatePoint, screenToWorld, worldToScreen } from '../world/iso';
import { edgePoints, parseEdge } from '../world/lot';
import { poly, tilePoly } from '../world/render/draw';
import { Painter } from '../world/render/painter';
import type { Drawable } from '../world/render/renderer';
import { WALL_H } from '../world/render/renderer';
import { clear, h } from './dom';
import { thumbnail } from './thumbs';

export type Mode = 'live' | 'buy' | 'build';
export type Tool = 'wall' | 'door' | 'window' | 'paint' | 'floor' | 'unfloor' | 'erase';

const TOOLS: { id: Tool; icon: string; label: string; hint: string }[] = [
  { id: 'wall', icon: '🧱', label: 'Wall', hint: 'Drag along the grid to build walls.' },
  { id: 'door', icon: '🚪', label: 'Door', hint: 'Tap a wall to add a door.' },
  { id: 'window', icon: '🪟', label: 'Window', hint: 'Tap a wall to add a window.' },
  { id: 'paint', icon: '🖌️', label: 'Paint', hint: 'Tap or drag along walls to repaint them.' },
  { id: 'floor', icon: '▦', label: 'Floor', hint: 'Drag a rectangle to lay floor.' },
  { id: 'unfloor', icon: '⬚', label: 'Rip up', hint: 'Drag a rectangle to remove floor.' },
  { id: 'erase', icon: '🧨', label: 'Bulldoze', hint: 'Drag along walls to remove them.' },
];

const CATS: { id: Category | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'bathroom', label: 'Bath' },
  { id: 'bedroom', label: 'Bed' },
  { id: 'living', label: 'Living' },
  { id: 'fun', label: 'Fun' },
  { id: 'decor', label: 'Decor' },
];

interface Placing {
  def: string;
  dir: Dir;
  x: number;
  y: number;
  moving?: ObjInst;
  shown: boolean;
}

interface Stroke {
  kind: 'line' | 'rect';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  sx: number;
  sy: number;
}

/** Build and buy modes: catalog, placement ghosts, wall/floor strokes, undo. */
export class BuildController {
  readonly builder: Builder;
  readonly sheet = h('div', { class: 'sheet panel', style: 'display:none' });
  mode: Mode = 'live';
  tool: Tool | null = 'wall';
  wallStyle = 0;
  floorStyle = 0;
  cat: Category | 'all' = 'all';
  placing: Placing | null = null;
  stroke: Stroke | null = null;
  private hoverEdge: string | null = null;

  constructor(private game: Game) {
    this.builder = new Builder(game.world);
  }

  get active(): boolean {
    return this.mode !== 'live';
  }

  setMode(m: Mode): void {
    this.mode = m;
    this.placing = null;
    this.stroke = null;
    this.render();
  }

  // ---------- panel ----------

  render(): void {
    const s = this.sheet;
    if (this.mode === 'live') {
      s.style.display = 'none';
      return;
    }
    s.style.display = '';
    clear(s);
    const undo = h('button', { class: 'undo', title: 'Undo (Ctrl+Z)', disabled: !this.builder.canUndo, onclick: () => this.undo() }, '↶', h('span', { class: 'lbl2' }, 'Undo'));
    if (this.mode === 'buy') {
      if (this.placing) {
        const d = OBJECTS[this.placing.def];
        const touch = matchMedia('(pointer: coarse)').matches;
        s.append(
          h('div', { class: 'sheet-row placing' },
            h('img', { src: thumbnail(this.placing.def, 48), alt: '' }),
            h('div', { class: 'grow' }, h('b', {}, d.name), h('small', {}, this.placing.moving ? 'Moving' : `₥${d.price}`), h('small', { class: 'hint' }, touch ? 'Tap a spot or drag to adjust.' : 'Click to place. , and . rotate. Esc cancels.')),
            h('button', { 'aria-label': 'Rotate', title: 'Rotate (,  .)', onclick: () => this.rotatePlacing(1) }, '⟳'),
            h('button', { class: 'ok', 'aria-label': 'Place here', onclick: () => this.commitPlacing() }, '✓'),
            h('button', { 'aria-label': 'Cancel', onclick: () => this.cancelPlacing() }, '✕'),
          ),
        );
        return;
      }
      const tabs = h('div', { class: 'sheet-row tabs', role: 'tablist' });
      for (const c of CATS) tabs.append(h('button', { class: this.cat === c.id ? 'on' : '', role: 'tab', onclick: () => { this.cat = c.id; this.render(); } }, c.label));
      tabs.append(undo);
      const items = h('div', { class: 'sheet-row items' });
      for (const id of CATALOG_ORDER) {
        const d = OBJECTS[id];
        if (this.cat !== 'all' && d.category !== this.cat) continue;
        const poor = d.price > this.game.world.funds;
        items.append(
          h('button', { class: `card${poor ? ' poor' : ''}`, title: d.desc, 'data-buy': id, onclick: () => this.startPlacing(id) },
            h('img', { src: thumbnail(id), alt: '' }),
            h('span', { class: 'nm' }, d.name),
            h('span', { class: 'pr' }, `₥${d.price}`),
          ),
        );
      }
      s.append(tabs, items);
      return;
    }
    const tools = h('div', { class: 'sheet-row tools' });
    for (const t of TOOLS) {
      tools.append(h('button', { class: this.tool === t.id ? 'on' : '', 'data-tool': t.id, title: t.hint, onclick: () => { this.tool = this.tool === t.id ? null : t.id; this.render(); } }, h('span', { class: 'ti' }, t.icon), h('span', { class: 'lbl2' }, t.label)));
    }
    tools.append(undo);
    s.append(tools);
    const tdef = TOOLS.find((t) => t.id === this.tool);
    if (this.tool === 'wall' || this.tool === 'paint') {
      const row = h('div', { class: 'sheet-row swatches' });
      WALLS.forEach((st, i) => row.append(h('button', { class: `sw${i === this.wallStyle ? ' on' : ''}`, title: `${st.name} · ₥${st.price} per segment`, onclick: () => { this.wallStyle = i; this.render(); } }, h('i', { style: `background:${st.color};border-color:${st.trim}` }), h('span', {}, `₥${st.price}`))));
      s.append(row);
    } else if (this.tool === 'floor') {
      const row = h('div', { class: 'sheet-row swatches' });
      FLOORS.forEach((st, i) => row.append(h('button', { class: `sw${i === this.floorStyle ? ' on' : ''}`, title: `${st.name} · ₥${st.price} per tile`, onclick: () => { this.floorStyle = i; this.render(); } }, h('i', { style: `background:${st.pattern === 'checker' ? `repeating-conic-gradient(${st.a} 0 25%, ${st.b} 0 50%) 0 0/12px 12px` : st.a}` }), h('span', {}, `₥${st.price}`))));
      s.append(row);
    } else if (this.tool === 'door' || this.tool === 'window') {
      s.append(h('div', { class: 'sheet-row hintrow' }, `${tdef!.hint} ₥${this.tool === 'door' ? DOOR_PRICE : WINDOW_PRICE} each.`));
    } else s.append(h('div', { class: 'sheet-row hintrow' }, tdef ? tdef.hint : 'Pick a tool. With no tool, dragging pans the camera.'));
  }

  // ---------- operations ----------

  private report(err: string | null, okText?: string): void {
    if (err) this.game.hud.toast(err, 'bad', 2600);
    else if (okText) this.game.hud.toast(okText, 'good', 1500);
    this.render();
  }

  undo(): void {
    if (this.builder.undo()) this.render();
  }

  startPlacing(def: string, moving?: ObjInst): void {
    const c = this.game.camera;
    const [cx, cy] = screenToWorld(c, c.w / 2, c.h / 2);
    this.placing = { def, dir: moving?.dir ?? 0, x: Math.floor(cx), y: Math.floor(cy), moving, shown: false };
    if (moving) {
      this.placing.x = moving.x;
      this.placing.y = moving.y;
      this.placing.shown = true;
    }
    this.render();
  }

  cancelPlacing(): void {
    this.placing = null;
    this.render();
  }

  rotatePlacing(d: 1 | -1): void {
    if (!this.placing) return;
    this.placing.dir = ((((this.placing.dir + d) % 4) + 4) % 4) as Dir;
  }

  /** Put the ghost so the tile under the pointer is roughly its middle. */
  private aimAt(tx: number, ty: number): void {
    const p = this.placing!;
    const [w, hh] = worldSize(OBJECTS[p.def], p.dir);
    p.x = tx - Math.floor((w - 1) / 2);
    p.y = ty - Math.floor((hh - 1) / 2);
    p.shown = true;
  }

  placingError(): string | null {
    const p = this.placing;
    if (!p) return null;
    const err = this.builder.placementError(p.def, p.x, p.y, p.dir, p.moving?.id ?? -1);
    if (err) return err;
    if (!p.moving && OBJECTS[p.def].price > this.game.world.funds) return 'Not enough Mints.';
    return null;
  }

  commitPlacing(): void {
    const p = this.placing;
    if (!p) return;
    const err = p.moving ? this.builder.move(p.moving, p.x, p.y, p.dir) : this.builder.buy(p.def, p.x, p.y, p.dir);
    if (!err && p.moving) this.placing = null;
    this.report(err);
  }

  private objectMenu(o: ObjInst, sx: number, sy: number): void {
    const refund = this.builder.refundFor(o);
    this.game.pie.show(sx, sy, defOf(o).name, [
      { label: 'Move', icon: '✋', onSelect: () => this.startPlacing(o.def, o) },
      { label: 'Rotate', icon: '⟳', onSelect: () => this.report(this.builder.move(o, o.x, o.y, ((o.dir + 1) % 4) as Dir)) },
      { label: `Sell ₥${refund}`, icon: '💰', onSelect: () => this.report(this.builder.sell(o), `Sold for ₥${refund}.`) },
    ]);
  }

  // ---------- input ----------

  /**
   * The wall piece drawn under a screen point (front-most wins), using each wall's on-screen height,
   * so tapping a wall face picks that wall. Falls back to the nearest grid edge on the ground.
   */
  edgeAt(sx: number, sy: number): string {
    const v = this.game.camera;
    const lot = this.game.world.lot;
    let best: string | null = null;
    let bd = -Infinity;
    for (const k of lot.walls.keys()) {
      const { axis, x, y } = parseEdge(k);
      const [a, b] = edgePoints(axis, x, y);
      const hgt = Math.max(0.5, this.game.renderer.wallHeight(v, lot, k));
      const quad = [worldToScreen(v, a[0], a[1], 0), worldToScreen(v, b[0], b[1], 0), worldToScreen(v, b[0], b[1], hgt), worldToScreen(v, a[0], a[1], hgt)];
      if (!inQuad(sx, sy, quad)) continue;
      const [ra, rb] = rotatePoint((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, v.rot, v.n);
      if (ra + rb > bd) {
        bd = ra + rb;
        best = k;
      }
    }
    if (best) return best;
    const [wx, wy] = this.world(sx, sy);
    return nearestEdge(wx, wy);
  }

  private world(sx: number, sy: number): [number, number] {
    return screenToWorld(this.game.camera, sx, sy);
  }

  gesture(g: Gesture): boolean {
    if (this.mode === 'live') return false;
    if (this.mode === 'buy') return this.buyGesture(g);
    return this.buildGesture(g);
  }

  private buyGesture(g: Gesture): boolean {
    const p = this.placing;
    if (p) {
      if (g.type === 'hover') {
        const [wx, wy] = this.world(g.x, g.y);
        this.aimAt(Math.floor(wx), Math.floor(wy));
        return true;
      }
      if (g.type === 'tap') {
        const [wx, wy] = this.world(g.x, g.y);
        this.aimAt(Math.floor(wx), Math.floor(wy));
        if (g.pointer === 'mouse') {
          if (g.button === 2) this.cancelPlacing();
          else this.commitPlacing();
        }
        return true;
      }
      // touch: drag the ghost, floating a little above the finger so it stays visible
      if ((g.type === 'dragstart' || g.type === 'dragmove') && g.pointer !== 'mouse') {
        const [wx, wy] = this.world(g.x, g.y - 56);
        this.aimAt(Math.floor(wx), Math.floor(wy));
        return true;
      }
      if (g.type === 'dragend' && g.pointer !== 'mouse') return true;
      return false;
    }
    if (g.type === 'tap') {
      const o = this.game.objAt(g.x, g.y);
      if (o) this.objectMenu(o, g.x, g.y);
      return true;
    }
    return false;
  }

  private buildGesture(g: Gesture): boolean {
    const tool = this.tool;
    if (g.type === 'hover') {
      this.hoverEdge = tool === 'door' || tool === 'window' || tool === 'paint' || tool === 'erase' ? this.edgeAt(g.x, g.y) : null;
      return true;
    }
    if (!tool) return false;
    const drawsWithDrag = (g.type === 'dragstart' || g.type === 'dragmove' || g.type === 'dragend') && g.button !== 2;
    if (g.type === 'tap') {
      const [wx, wy] = this.world(g.x, g.y);
      const edge = this.edgeAt(g.x, g.y);
      if (tool === 'door' || tool === 'window') this.report(this.builder.setOpening(edge, tool));
      else if (tool === 'paint') this.report(this.builder.paintWalls([edge], this.wallStyle));
      else if (tool === 'erase') this.report(this.builder.eraseWalls([edge]));
      else if (tool === 'floor' || tool === 'unfloor') this.report(this.builder.setFloors([[Math.floor(wx), Math.floor(wy)]], tool === 'floor' ? this.floorStyle : -1));
      return true;
    }
    if (!drawsWithDrag || tool === 'door' || tool === 'window') return false;
    const [wx, wy] = this.world(g.x, g.y);
    const rect = tool === 'floor' || tool === 'unfloor';
    const gx = rect ? Math.floor(wx) : Math.round(wx);
    const gy = rect ? Math.floor(wy) : Math.round(wy);
    const n = this.game.world.lot.n;
    const cx = Math.max(0, Math.min(rect ? n - 1 : n, gx));
    const cy = Math.max(0, Math.min(rect ? n - 1 : n, gy));
    if (g.type === 'dragstart') {
      this.stroke = { kind: rect ? 'rect' : 'line', x0: cx, y0: cy, x1: cx, y1: cy, sx: g.x, sy: g.y };
      return true;
    }
    if (!this.stroke) return true;
    this.stroke.x1 = cx;
    this.stroke.y1 = cy;
    this.stroke.sx = g.x;
    this.stroke.sy = g.y;
    if (g.type === 'dragend') {
      const s = this.stroke;
      this.stroke = null;
      if (s.kind === 'rect') {
        this.report(this.builder.setFloors(rectTiles(s.x0, s.y0, s.x1, s.y1), tool === 'floor' ? this.floorStyle : -1));
      } else {
        const keys = edgeRun(s.x0, s.y0, s.x1, s.y1).keys;
        if (!keys.length) return true;
        if (tool === 'wall') this.report(this.builder.buildWalls(keys, this.wallStyle));
        else if (tool === 'erase') this.report(this.builder.eraseWalls(keys));
        else if (tool === 'paint') this.report(this.builder.paintWalls(keys, this.wallStyle));
      }
    }
    return true;
  }

  onKey(k: string, e: KeyboardEvent): boolean {
    if (this.mode === 'live') return false;
    if ((e.ctrlKey || e.metaKey) && k === 'z') {
      e.preventDefault();
      this.undo();
      return true;
    }
    if (this.placing) {
      if (k === ',') this.rotatePlacing(-1);
      else if (k === '.') this.rotatePlacing(1);
      else if (k === 'escape') this.cancelPlacing();
      else if (k === 'enter') this.commitPlacing();
      else return false;
      return true;
    }
    if (k === 'escape' && this.mode === 'build') {
      this.tool = null;
      this.render();
      return true;
    }
    return false;
  }

  // ---------- drawing ----------

  /** Faint lot grid plus previews for floors and the ghost footprint. */
  groundOverlay(ctx: CanvasRenderingContext2D, v: View): void {
    if (this.mode === 'live') return;
    const n = this.game.world.lot.n;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      for (const [a, b] of [[[i, 0], [i, n]], [[0, i], [n, i]]] as [number, number][][]) {
        const p = worldToScreen(v, a[0], a[1]);
        const q = worldToScreen(v, b[0], b[1]);
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(q[0], q[1]);
      }
    }
    ctx.stroke();
    ctx.restore();
    const s = this.stroke;
    if (s?.kind === 'rect') {
      for (const [x, y] of rectTiles(s.x0, s.y0, s.x1, s.y1)) poly(ctx, tilePoly(v, x, y), this.tool === 'floor' ? 'rgba(92,200,168,0.55)' : 'rgba(217,75,59,0.45)');
    }
    const p = this.placing;
    if (p?.shown) {
      const ok = !this.placingError();
      const [w, hh] = worldSize(OBJECTS[p.def], p.dir);
      for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) poly(ctx, tilePoly(v, p.x + i, p.y + j), ok ? 'rgba(92,200,168,0.5)' : 'rgba(217,75,59,0.55)');
    }
  }

  drawables(v: View): Drawable[] {
    const p = this.placing;
    if (!p?.shown) return [];
    const d = OBJECTS[p.def];
    const painter = new Painter(v, d, p.x, p.y, p.dir);
    painter.alpha = 0.72;
    d.draw(painter, p.moving ?? null, performance.now());
    return painter.out.map((x) => ({ ...x, depth: x.depth + 0.001 }));
  }

  /** Wall stroke previews, edge highlights and cost labels, drawn above everything. */
  overlay(ctx: CanvasRenderingContext2D, v: View): void {
    if (this.mode !== 'build') return;
    const s = this.stroke;
    const tool = this.tool;
    let keys: string[] = [];
    if (s?.kind === 'line') keys = edgeRun(s.x0, s.y0, s.x1, s.y1).keys;
    else if (this.hoverEdge && !s) keys = [this.hoverEdge];
    if (!keys.length || !tool) return;
    const color = tool === 'erase' ? 'rgba(217,75,59,0.55)' : tool === 'paint' ? WALLS[this.wallStyle].color : tool === 'wall' ? 'rgba(92,200,168,0.6)' : 'rgba(255,226,122,0.7)';
    for (const k of keys) {
      const { axis, x, y } = parseEdge(k);
      const [a, b] = edgePoints(axis, x, y);
      const [ax, ay] = rotatePoint(a[0], a[1], v.rot, v.n);
      const [bx, by] = rotatePoint(b[0], b[1], v.rot, v.n);
      const hgt = tool === 'wall' ? WALL_H * 0.7 : 0.25;
      ctx.globalAlpha = tool === 'paint' ? 0.75 : 1;
      poly(ctx, [projectRotated(v, ax, ay, 0), projectRotated(v, bx, by, 0), projectRotated(v, bx, by, hgt), projectRotated(v, ax, ay, hgt)], color, 'rgba(43,35,80,0.6)', 1.5);
      ctx.globalAlpha = 1;
    }
    if (s) {
      const b = this.builder;
      let label = '';
      if (tool === 'wall') label = `${keys.length} × ₥${WALLS[this.wallStyle].price} = ₥${b.wallCost(keys, this.wallStyle)}`;
      else if (tool === 'paint') label = `₥${b.paintCost(keys, this.wallStyle)}`;
      else if (tool === 'erase') label = `Remove ${keys.filter((k) => this.game.world.lot.walls.has(k)).length}`;
      if (label) costLabel(ctx, s.sx, s.sy - 44, label);
    }
  }

  /** Floor stroke cost label (drawn separately since floors use the ground pass). */
  floorLabel(ctx: CanvasRenderingContext2D): void {
    const s = this.stroke;
    if (s?.kind !== 'rect') return;
    const tiles = rectTiles(s.x0, s.y0, s.x1, s.y1);
    costLabel(ctx, s.sx, s.sy - 44, this.tool === 'floor' ? `${tiles.length} tiles · ₥${this.builder.floorCost(tiles, this.floorStyle)}` : `Rip up ${tiles.length}`);
  }
}

function costLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
  ctx.save();
  ctx.font = 'bold 14px "Trebuchet MS", system-ui, sans-serif';
  const w = ctx.measureText(text).width + 16;
  ctx.fillStyle = 'rgba(43,35,80,0.92)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 14, w, 28, 14);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

function inQuad(x: number, y: number, q: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const [xi, yi] = q[i], [xj, yj] = q[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
