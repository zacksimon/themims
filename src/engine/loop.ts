/** Fixed-step simulation with a render callback each animation frame. */
export const STEP_MS = 50;
export const STEP_MIN = STEP_MS / 1000; // game minutes per step at speed 1

export class Loop {
  private acc = 0;
  private last = 0;
  private raf = 0;
  speed = 1;

  constructor(private step: (dtMin: number) => void, private render: (now: number) => void) {}

  start(): void {
    this.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(250, now - this.last);
      this.last = now;
      this.acc += dt * this.speed;
      let steps = 0;
      while (this.acc >= STEP_MS && steps < 400) {
        this.step(STEP_MIN);
        this.acc -= STEP_MS;
        steps++;
      }
      if (steps >= 400) this.acc = 0;
      this.render(now);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }
}
