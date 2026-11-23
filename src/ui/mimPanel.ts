import { NEEDS, NEED_INFO, moodOf } from '../sim/needs';
import type { Game } from '../game';
import { clear, h } from './dom';
import { Look } from '../content/looks';
import { relLabel } from '../content/social';

/** Draw a Mim's head into a small canvas for portraits. */
export function drawPortrait(c: HTMLCanvasElement, look: Look, mood: number): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = 44;
  c.width = size * dpr;
  c.height = size * dpr;
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = look.shirt;
  ctx.beginPath();
  ctx.roundRect(10, 30, 24, 18, 8);
  ctx.fill();
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(22, 20, 12, 0, Math.PI * 2);
  ctx.fill();
  if (look.hairStyle !== 'bald') {
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.arc(22, 18, 12.5, Math.PI * 1.02, Math.PI * 1.98);
    ctx.fill();
    if (look.hairStyle === 'long' || look.hairStyle === 'bob') {
      ctx.fillRect(9, 16, 4, look.hairStyle === 'long' ? 16 : 9);
      ctx.fillRect(31, 16, 4, look.hairStyle === 'long' ? 16 : 9);
    }
    if (look.hairStyle === 'mohawk') ctx.fillRect(20, 2, 4, 8);
    if (look.hairStyle === 'bun') {
      ctx.beginPath();
      ctx.arc(22, 5, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#2b2350';
  ctx.beginPath();
  ctx.arc(18, 21, 1.6, 0, Math.PI * 2);
  ctx.arc(26, 21, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2b2350';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  if (mood > 30) ctx.arc(22, 24, 3.5, 0.2 * Math.PI, 0.8 * Math.PI);
  else if (mood < -30) ctx.arc(22, 29, 3.5, 1.2 * Math.PI, 1.8 * Math.PI);
  else {
    ctx.moveTo(19, 27);
    ctx.lineTo(25, 27);
  }
  ctx.stroke();
}

export function needColor(v: number): string {
  if (v < 20) return '#d94b3b';
  if (v < 45) return '#f2a33a';
  if (v < 70) return '#c9c94a';
  return '#4cb87a';
}

/** Selected Mim panel: portrait, mood, needs, action queue, free will toggle. */
export class MimPanel {
  readonly root = h('div', { class: 'mimpanel panel' });
  private collapsed = window.innerWidth < 600;
  private tab: 'needs' | 'friends' = 'needs';
  private portraits = new Map<number, HTMLCanvasElement>();
  private lastKey = '';
  private portrait = h('canvas', { class: 'portrait' });

  constructor(private game: Game) {}

  update(): void {
    const m = this.game.selected;
    const w = this.game.world;
    if (!m) {
      this.root.style.display = 'none';
      return;
    }
    this.root.style.display = '';
    const mood = moodOf(m.needs);
    const queueKey = m.queue.map((a) => `${a.uid}${a.cancel ? 'x' : ''}`).join(',');
    const others = w.mims.filter((o) => o !== m);
    const relKeyStr = others.map((o) => Math.round(w.rel(m.id, o.id).daily)).join(',');
    const houseKey = w.mims.map((o) => `${o.id}:${Math.round(moodOf(o.needs) / 10)}`).join(',');
    const key = `${m.id}|${Math.round(mood / 4)}|${NEEDS.map((k) => Math.round(m.needs[k])).join(',')}|${queueKey}|${w.freeWill}|${this.collapsed}|${this.tab}|${relKeyStr}|${houseKey}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    clear(this.root);
    drawPortrait(this.portrait, m.look, mood);
    const moodPct = (mood + 100) / 2;
    const queue = h('div', { class: 'queue', 'aria-label': 'Action queue' });
    m.queue.forEach((a, i) => {
      queue.append(
        h(
          'button',
          {
            class: `qitem${i === 0 ? ' current' : ''}${a.cancel ? ' cancelling' : ''}${a.auto ? ' auto' : ''}`,
            title: `${a.label}${a.auto ? ' (own idea)' : ''}. Tap to cancel.`,
            'aria-label': `Cancel ${a.label}`,
            onclick: () => w.cancelAction(m, a.uid),
          },
          a.icon,
        ),
      );
    });
    if (!m.queue.length) queue.append(h('span', { class: 'idle' }, 'Idle'));
    const head = h(
      'div',
      { class: 'mp-head' },
      this.portrait,
      h('div', { class: 'mp-name' }, h('b', {}, m.name), h('div', { class: 'moodbar', title: `Mood ${Math.round(mood)}` }, h('i', { style: `width:${moodPct}%;background:${needColor(moodPct)}` }))),
      h('button', { class: 'collapse', 'aria-label': this.collapsed ? 'Show needs' : 'Hide needs', onclick: () => { this.collapsed = !this.collapsed; this.lastKey = ''; this.update(); } }, this.collapsed ? '▴' : '▾'),
    );
    // household strip: tap a portrait to select that Mim and center the camera on them
    const strip = h('div', { class: 'household', role: 'tablist', 'aria-label': 'Household' });
    for (const o of w.mims) {
      let c = this.portraits.get(o.id);
      if (!c) {
        c = h('canvas', {});
        this.portraits.set(o.id, c);
      }
      const om = moodOf(o.needs);
      drawPortrait(c, o.look, om);
      strip.append(
        h('button', { class: `pp${o === m ? ' on' : ''}`, title: o.name, 'aria-label': `Select ${o.name}`, 'data-mim': o.id, style: `--ring:${needColor((om + 100) / 2)}`, onclick: () => this.game.focusMim(o.id) }, c),
      );
    }
    if (w.mims.length > 1) this.root.append(strip);
    this.root.append(head, queue);
    if (!this.collapsed && w.mims.length > 1) {
      this.root.append(
        h('div', { class: 'tabs2' },
          h('button', { class: this.tab === 'needs' ? 'on' : '', onclick: () => { this.tab = 'needs'; this.lastKey = ''; this.update(); } }, 'Needs'),
          h('button', { class: this.tab === 'friends' ? 'on' : '', 'data-tab': 'friends', onclick: () => { this.tab = 'friends'; this.lastKey = ''; this.update(); } }, 'Friends'),
        ),
      );
    }
    if (!this.collapsed && this.tab === 'friends' && others.length) {
      const list = h('div', { class: 'friends' });
      for (const o of others) {
        const r = w.rel(m.id, o.id);
        const pct = Math.abs(r.daily) / 2;
        list.append(
          h('div', { class: 'friend', title: `Today ${Math.round(r.daily)} · Lifetime ${Math.round(r.life)}` },
            h('b', {}, o.name.split(' ')[0]),
            h('span', { class: 'rl' }, relLabel(r.daily)),
            h('div', { class: 'relbar' }, h('i', { style: r.daily >= 0 ? `left:50%;width:${pct}%;background:#4cb87a` : `right:50%;width:${pct}%;background:#d94b3b` })),
          ),
        );
      }
      this.root.append(list);
      return;
    }
    if (!this.collapsed) {
      const grid = h('div', { class: 'needs' });
      for (const k of NEEDS) {
        const v = m.needs[k];
        grid.append(
          h('div', { class: 'need', title: `${NEED_INFO[k].label}: ${Math.round(v)}` },
            h('span', { class: 'need-ic' }, NEED_INFO[k].icon),
            h('span', { class: 'need-l' }, NEED_INFO[k].label),
            h('div', { class: 'bar' }, h('i', { style: `width:${v}%;background:${needColor(v)}` })),
          ),
        );
      }
      this.root.append(grid);
      this.root.append(
        h('label', { class: 'fw' },
          h('input', { type: 'checkbox', checked: w.freeWill ? 'checked' : undefined, onchange: (e: Event) => (w.freeWill = (e.target as HTMLInputElement).checked) }),
          ' Free will (Mims act on their own)',
        ),
      );
    }
  }
}
