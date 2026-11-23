import { h } from './dom';

export interface PieOption {
  label: string;
  icon: string;
  disabled?: boolean;
  hint?: string;
  onSelect: () => void;
}

/**
 * Radial action menu that opens around the tapped point. Buttons are at least 44 px tall and the whole ring
 * is kept on screen. Tapping the backdrop closes it.
 */
export class PieMenu {
  private root: HTMLElement | null = null;
  private openedAt = 0;

  constructor(private host: HTMLElement) {}

  get open(): boolean {
    return !!this.root;
  }

  show(x: number, y: number, title: string, options: PieOption[]): void {
    this.close();
    const n = options.length;
    const radius = Math.max(78, Math.min(130, 30 + n * 16));
    this.openedAt = performance.now();
    const pad = 70;
    const vw = window.innerWidth, vh = window.innerHeight;
    const cx = Math.min(vw - radius - pad, Math.max(radius + pad, x));
    const cy = Math.min(vh - radius - 40, Math.max(radius + 60, y));
    const backdrop = h('div', {
      class: 'pie-backdrop',
      onpointerdown: (e: Event) => {
        e.preventDefault();
        if (performance.now() - this.openedAt > 150) this.close();
      },
    });
    // Long menus (social options) don't fit on a ring on phones: show a compact two-column list instead.
    if (n > 8) {
      const cols = vw < 520 ? 2 : 3;
      const w = Math.min(vw - 16, cols * 168 + 16);
      const rows = Math.ceil(n / cols);
      const hgt = Math.min(vh - 120, 48 + rows * 52);
      const left = Math.min(vw - w - 8, Math.max(8, x - w / 2));
      // keep the list below the top bar so it doesn't sit over the HUD
      const barBottom = (document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 56) + 8;
      const top = Math.min(vh - hgt - 8, Math.max(barBottom, y - hgt / 2));
      const list = h('div', { class: 'pie-list panel', role: 'menu', 'aria-label': title, style: `left:${left}px;top:${top}px;width:${w}px;max-height:${hgt}px;grid-template-columns:repeat(${cols},1fr)` });
      list.append(h('div', { class: 'pie-list-title' }, title));
      for (const o of options) {
        list.append(
          h('button', {
            class: 'pie-item',
            role: 'menuitem',
            disabled: o.disabled,
            title: o.hint,
            onclick: (e: Event) => {
              e.stopPropagation();
              if (performance.now() - this.openedAt < 350) return;
              this.close();
              o.onSelect();
            },
          }, h('span', { class: 'pie-ic' }, o.icon), o.label),
        );
      }
      this.root = h('div', { class: 'pie-root' }, backdrop, list);
      this.host.append(this.root);
      return;
    }
    const ring = h('div', { class: 'pie', style: `left:${cx}px;top:${cy}px`, role: 'menu', 'aria-label': title });
    ring.append(h('div', { class: 'pie-title panel' }, title));
    options.forEach((o, i) => {
      const ang = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2;
      const bx = Math.cos(ang) * radius;
      const by = Math.sin(ang) * radius * 0.85;
      const btn = h(
        'button',
        {
          class: 'pie-item',
          role: 'menuitem',
          style: `transform: translate(calc(${bx}px - 50%), calc(${by}px - 50%)); animation-delay:${i * 18}ms`,
          disabled: o.disabled,
          title: o.hint,
          onclick: (e: Event) => {
            e.stopPropagation();
            // On touch screens the tap that opened the menu also fires a click; ignore it.
            if (performance.now() - this.openedAt < 350) return;
            this.close();
            o.onSelect();
          },
        },
        h('span', { class: 'pie-ic' }, o.icon),
        o.label,
      );
      ring.append(btn);
    });
    this.root = h('div', { class: 'pie-root' }, backdrop, ring);
    this.host.append(this.root);
  }

  close(): void {
    this.root?.remove();
    this.root = null;
  }
}
