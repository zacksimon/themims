import { SPEEDS } from './engine/clock';
import { Loop } from './engine/loop';
import { Gesture, GestureRecognizer } from './engine/input';
import { World } from './sim/world';
import { Camera } from './world/camera';
import { Drawable, Renderer, SceneSource, WallMode } from './world/render/renderer';
import { Hud } from './ui/hud';
import { View } from './world/iso';

/** Wires simulation, rendering, input and UI together. */
export class Game implements SceneSource {
  readonly camera: Camera;
  readonly renderer: Renderer;
  readonly loop: Loop;
  readonly hud: Hud;
  readonly gestures: GestureRecognizer;
  speedIndex = 1;
  private keys = new Set<string>();

  constructor(public world: World, canvas: HTMLCanvasElement, private uiRoot: HTMLElement) {
    this.camera = new Camera(world.lot.n);
    this.renderer = new Renderer(canvas);
    this.renderer.resize(this.camera);
    if (this.camera.w < 600) this.camera.zoom = 0.5;
    else if (this.camera.w < 1000) this.camera.zoom = 0.75;
    this.loop = new Loop((dt) => this.world.step(dt), (now) => this.render(now));
    this.hud = new Hud(this);
    this.uiRoot.append(this.hud.root);
    this.gestures = new GestureRecognizer((g) => this.onGesture(g));
    this.bindInput(canvas);
    window.addEventListener('resize', () => this.renderer.resize(this.camera));
  }

  get lot() {
    return this.world.lot;
  }

  start(): void {
    this.loop.start();
  }

  setSpeed(i: number): void {
    this.speedIndex = i;
    this.loop.speed = SPEEDS[i];
  }

  setWallMode(m: WallMode): void {
    this.renderer.wallMode = m;
  }

  drawables(_v: View): Drawable[] {
    return [];
  }

  private render(now: number): void {
    this.gestures.tick(now);
    this.applyHeldKeys();
    const fade = this.camera.update(now);
    this.renderer.frame(this.camera, this, fade);
    this.hud.update();
  }

  private applyHeldKeys(): void {
    const k = this.keys;
    const dx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const dy = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
    if (dx || dy) this.camera.panDir(dx * 0.35, dy * 0.35);
  }

  protected onGesture(g: Gesture): void {
    if (this.camera.rotating) return;
    switch (g.type) {
      case 'dragmove':
        this.camera.panScreen(g.px, g.py, g.x, g.y);
        break;
      case 'pan2':
        this.camera.panScreen(g.px, g.py, g.x, g.y);
        break;
      case 'pinch':
        this.camera.zoomAt(this.camera.zoom * g.scale, g.x, g.y);
        break;
      case 'pinchend':
        this.camera.snapZoom(g.x, g.y);
        break;
      case 'twist':
        this.camera.rotate(g.dir);
        break;
      default:
        break;
    }
  }

  private bindInput(canvas: HTMLCanvasElement): void {
    const send = (e: PointerEvent, kind: 'down' | 'move' | 'up' | 'cancel') => {
      this.gestures.handle({ id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), kind, pointer: e.pointerType, button: e.button });
    };
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      send(e, 'down');
    });
    canvas.addEventListener('pointermove', (e) => send(e, 'move'));
    canvas.addEventListener('pointerup', (e) => send(e, 'up'));
    canvas.addEventListener('pointercancel', (e) => send(e, 'cancel'));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (!this.camera.rotating) this.camera.zoomStep(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY);
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (k === 'q') this.camera.rotate(-1);
      else if (k === 'e') this.camera.rotate(1);
      else if (k === '+' || k === '=') this.camera.zoomStep(1);
      else if (k === '-' || k === '_') this.camera.zoomStep(-1);
      else if (k === ' ') {
        e.preventDefault();
        this.setSpeed(this.speedIndex === 0 ? 1 : 0);
      } else if (k >= '0' && k <= '3') this.setSpeed(+k);
      else this.keys.add(k);
      this.onKey(k, e);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  protected onKey(_k: string, _e: KeyboardEvent): void {}
}
