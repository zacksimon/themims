import { SPEEDS, formatTime, weekdayOf, dayOf } from '../engine/clock';
import { h } from './dom';
import type { Game } from '../game';

/** Top bar (clock, speed, funds, modes) and camera controls. */
export class Hud {
  readonly root: HTMLElement;
  private clockEl = h('div', { class: 'clock panel' });
  private fundsEl = h('div', { class: 'funds panel' });
  private speedBtns: HTMLButtonElement[] = [];
  private wallBtns: Record<string, HTMLButtonElement> = {};
  private lastFunds = NaN;
  readonly modeGroup = h('div', { class: 'group panel' });
  private toasts = h('div', { class: 'toasts' });

  constructor(private game: Game) {
    const speeds = h('div', { class: 'group panel', 'aria-label': 'Game speed' });
    const labels = ['❚❚', '▶', '▶▶', '▶▶▶'];
    SPEEDS.forEach((_, i) => {
      const b = h('button', { title: i === 0 ? 'Pause (space)' : `Speed ${i} (${i})`, 'data-speed': i, onclick: () => game.setSpeed(i) }, labels[i]);
      this.speedBtns.push(b);
      speeds.append(b);
    });
    const walls = h('div', { class: 'group panel walls', 'aria-label': 'Walls' }, h('span', { class: 'lbl' }, 'Walls'));
    for (const [mode, label, title] of [['up', 'Up', 'Walls up'], ['cutaway', 'Cut', 'Cutaway walls'], ['down', 'Down', 'Walls down']] as const) {
      const b = h('button', { title, onclick: () => game.setWallMode(mode) }, label);
      this.wallBtns[mode] = b;
      walls.append(b);
    }
    const top = h('div', { class: 'topbar' }, this.clockEl, speeds, this.fundsEl, h('div', { class: 'spacer' }), this.modeGroup, walls);
    const cam = h(
      'div',
      { class: 'camctl panel' },
      h('button', { title: 'Rotate left (Q)', 'aria-label': 'Rotate left', 'data-rot': '-1', onclick: () => game.camera.rotate(-1) }, '⟲'),
      h('button', { title: 'Rotate right (E)', 'aria-label': 'Rotate right', 'data-rot': '1', onclick: () => game.camera.rotate(1) }, '⟳'),
      h('button', { title: 'Zoom in (+)', 'aria-label': 'Zoom in', onclick: () => game.camera.zoomStep(1) }, '＋'),
      h('button', { title: 'Zoom out (-)', 'aria-label': 'Zoom out', onclick: () => game.camera.zoomStep(-1) }, '－'),
    );
    this.root = h('div', {}, top, cam, this.toasts);
  }

  toast(text: string, kind: 'info' | 'good' | 'bad' = 'info', ms = 4500): void {
    const t = h('div', { class: `toast panel ${kind}` }, text);
    this.toasts.prepend(t);
    while (this.toasts.children.length > 4) this.toasts.lastChild!.remove();
    setTimeout(() => t.remove(), ms);
  }

  update(): void {
    const w = this.game.world;
    this.clockEl.replaceChildren(h('b', {}, formatTime(w.time)), h('small', {}, `${weekdayOf(w.time)} · Day ${dayOf(w.time)}`));
    if (w.funds !== this.lastFunds) {
      const up = w.funds > this.lastFunds;
      if (!Number.isNaN(this.lastFunds)) {
        this.fundsEl.classList.remove('flash-up', 'flash-down');
        void this.fundsEl.offsetWidth;
        this.fundsEl.classList.add(up ? 'flash-up' : 'flash-down');
      }
      this.lastFunds = w.funds;
      this.fundsEl.textContent = `₥${Math.round(w.funds).toLocaleString('en-US')}`;
    }
    this.speedBtns.forEach((b, i) => b.classList.toggle('on', i === this.game.speedIndex));
    for (const [m, b] of Object.entries(this.wallBtns)) b.classList.toggle('on', m === this.game.renderer.wallMode);
  }
}
