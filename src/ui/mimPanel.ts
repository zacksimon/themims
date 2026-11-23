import { NEEDS, NEED_INFO, moodOf } from '../sim/needs';
import type { Game } from '../game';
import { clear, h } from './dom';
import { Look } from '../content/looks';

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
    const key = `${m.id}|${Math.round(mood / 4)}|${NEEDS.map((k) => Math.round(m.needs[k])).join(',')}|${queueKey}|${w.freeWill}|${this.collapsed}`;
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
    this.root.append(head, queue);
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
