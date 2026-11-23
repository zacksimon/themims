import type { Emotion } from '../content/social';
import type { Voice } from '../content/voices';

/** Vowel formants (F1, F2) in Hz. */
const VOWELS: Record<string, [number, number]> = {
  a: [800, 1250],
  e: [480, 1900],
  i: [310, 2300],
  o: [520, 900],
  u: [360, 780],
};

const EMOTION: Record<Emotion, { pitch: number; rate: number; vol: number }> = {
  neutral: { pitch: 1, rate: 1, vol: 1 },
  happy: { pitch: 1.15, rate: 1.1, vol: 1 },
  question: { pitch: 1.05, rate: 1, vol: 0.95 },
  angry: { pitch: 0.84, rate: 1.35, vol: 1.15 },
  sleepy: { pitch: 0.8, rate: 0.6, vol: 0.7 },
  shy: { pitch: 1.06, rate: 0.85, vol: 0.6 },
};

export interface AudioSettings {
  volume: number;
  muted: boolean;
}

const STORE = 'mims.audio';

/**
 * Synthesized Mimlish. Everything is generated with the Web Audio API, so there are no sound files.
 * Browsers only allow audio after a user gesture, so the context is created on the first tap or key.
 */
export class MimAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private busyUntil = 0;
  private voicesPlaying = 0;
  settings: AudioSettings = { volume: 0.7, muted: false };

  constructor() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) this.settings = { ...this.settings, ...JSON.parse(raw) };
    } catch {
      /* private mode: defaults */
    }
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Call from a user gesture. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolume(v: number): void {
    this.settings.volume = Math.max(0, Math.min(1, v));
    this.applyVolume();
    this.save();
  }

  setMuted(m: boolean): void {
    this.settings.muted = m;
    this.applyVolume();
    this.save();
  }

  private applyVolume(): void {
    if (this.master) this.master.gain.value = this.settings.muted ? 0 : this.settings.volume * 0.5;
  }

  private save(): void {
    try {
      localStorage.setItem(STORE, JSON.stringify(this.settings));
    } catch {
      /* ignore */
    }
  }

  /** At most two Mims talk at once, so a busy house doesn't turn into noise. */
  get canSpeak(): boolean {
    return this.ready && !this.settings.muted && this.voicesPlaying < 2;
  }

  /** Babble a short Mimlish phrase. `pan` is -1..1, `gain` 0..1. Returns the phrase duration in seconds. */
  babble(voice: Voice, emotion: Emotion, syllables: number, pan = 0, gain = 1): number {
    if (!this.canSpeak || !this.ctx || !this.master) return 0;
    const ctx = this.ctx;
    const e = EMOTION[emotion];
    const out = ctx.createGain();
    out.gain.value = gain * e.vol;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      out.connect(p);
      p.connect(this.master);
    } else out.connect(this.master);
    const start = Math.max(ctx.currentTime + 0.02, this.busyUntil - 0.3);
    const syl = 1 / (voice.rate * e.rate);
    let t = start;
    for (let i = 0; i < syllables; i++) {
      const s = voice.syllables[Math.floor(Math.random() * voice.syllables.length)];
      let contour = 1 + (Math.random() * 2 - 1) * voice.range;
      if (emotion === 'question' && i === syllables - 1) contour *= 1.35;
      if (emotion === 'happy') contour *= i % 2 ? 1.08 : 0.97;
      if (emotion === 'angry') contour *= 1 - i * 0.03;
      this.syllable(out, s, voice, voice.pitch * e.pitch * contour, t, syl * (0.75 + Math.random() * 0.4));
      t += syl;
    }
    this.voicesPlaying++;
    const dur = t - start;
    window.setTimeout(() => {
      this.voicesPlaying--;
      out.disconnect();
    }, (t - ctx.currentTime + 0.3) * 1000);
    return dur;
  }

  private syllable(out: AudioNode, s: string, voice: Voice, f0: number, t: number, len: number): void {
    const ctx = this.ctx!;
    const vowelChar = [...s].reverse().find((c) => 'aeiou'.includes(c)) ?? 'a';
    const [f1, f2] = VOWELS[vowelChar];
    const cons = s.replace(/[aeiou]+$/, '');
    const cLen = cons ? 0.035 : 0;
    // consonant: a short filtered noise burst
    if (cons && this.noise) {
      const n = ctx.createBufferSource();
      n.buffer = this.noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = /s|z|sh/.test(cons) ? 5200 : /k|t|p/.test(cons) ? 2600 : 900;
      bp.Q.value = 1.2;
      const g = ctx.createGain();
      const loud = /s|z|sh|k|t|p/.test(cons) ? 0.22 : 0.08;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(loud, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, t + cLen);
      n.connect(bp).connect(g).connect(out);
      n.start(t, Math.random() * 0.3, cLen + 0.01);
    }
    // vowel: an oscillator through two formant filters
    const v0 = t + cLen * 0.6;
    const osc = ctx.createOscillator();
    osc.type = voice.wave;
    osc.frequency.setValueAtTime(f0, v0);
    osc.frequency.linearRampToValueAtTime(f0 * (0.94 + Math.random() * 0.1), v0 + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, v0);
    g.gain.linearRampToValueAtTime(voice.wave === 'triangle' ? 0.5 : 0.22, v0 + 0.015);
    g.gain.setValueAtTime(voice.wave === 'triangle' ? 0.42 : 0.18, v0 + len * 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, v0 + len);
    for (const [f, q, amt] of [[f1, 6, 1], [f2, 9, 0.6]] as [number, number, number][]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * voice.formant;
      bp.Q.value = q;
      const a = ctx.createGain();
      a.gain.value = amt * 2.2;
      osc.connect(bp).connect(a).connect(g);
    }
    const body = ctx.createBiquadFilter();
    body.type = 'lowpass';
    body.frequency.value = 1400;
    const bg = ctx.createGain();
    bg.gain.value = 0.35;
    osc.connect(body).connect(bg).connect(g);
    g.connect(out);
    osc.start(v0);
    osc.stop(v0 + len + 0.02);
  }
}
