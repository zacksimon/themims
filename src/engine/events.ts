type Handler<T> = (payload: T) => void;

/** Minimal typed event bus. */
export class Emitter<E extends Record<string, unknown>> {
  private handlers: { [K in keyof E]?: Handler<E[K]>[] } = {};
  on<K extends keyof E>(k: K, h: Handler<E[K]>): () => void {
    (this.handlers[k] ??= []).push(h);
    return () => {
      this.handlers[k] = this.handlers[k]!.filter((x) => x !== h);
    };
  }
  emit<K extends keyof E>(k: K, payload: E[K]): void {
    this.handlers[k]?.forEach((h) => h(payload));
  }
}
