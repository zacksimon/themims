import type { NeedDelta } from '../sim/needs';

export type Emotion = 'neutral' | 'happy' | 'question' | 'angry' | 'sleepy' | 'shy';

export interface SocialDef {
  id: string;
  label: string;
  icon: string;
  /** Daily relationship required (inclusive) and upper bound for mean-spirited options. */
  minRel?: number;
  maxRel?: number;
  minutes: number;
  /** Need change per hour for both Mims while it goes well. */
  rates: NeedDelta;
  /** Relationship change (daily) when accepted / rejected. */
  good: number;
  bad: number;
  /** Base acceptance before mood and relationship modifiers. */
  accept: number;
  /** Mean interactions: both Mims lose, there is no "rejection". */
  mean?: boolean;
  needsMusic?: boolean;
  /** Speech bubble icons for the actor and target while it goes well. */
  bubbles: [string, string];
  emotion: Emotion;
  reject: string;
  /** How likely free will is to pick it among acceptable options. */
  weight: number;
}

export const SOCIALS: SocialDef[] = [
  { id: 'chat', label: 'Chat', icon: '💬', minutes: 12, rates: { social: 90, fun: 10 }, good: 2, bad: -2, accept: 0.85, bubbles: ['💬', '💬'], emotion: 'neutral', reject: '{target} pretends to get a phone call.', weight: 3 },
  { id: 'joke', label: 'Tell Joke', icon: '😂', minutes: 8, rates: { social: 90, fun: 60 }, good: 4, bad: -3, accept: 0.65, bubbles: ['🃏', '😂'], emotion: 'happy', reject: '{target} explains the joke back, incorrectly.', weight: 2 },
  { id: 'compliment', label: 'Compliment', icon: '🌟', minutes: 6, rates: { social: 100 }, good: 5, bad: -2, accept: 0.7, bubbles: ['🌟', '😊'], emotion: 'happy', reject: '{target} suspects a sales pitch.', weight: 1.5 },
  { id: 'weather', label: 'Talk About Weather', icon: '🌦️', minutes: 8, rates: { social: 60 }, good: 1, bad: 0, accept: 1, bubbles: ['🌦️', '☁️'], emotion: 'neutral', reject: '', weight: 1 },
  { id: 'mime', label: 'Mime Act', icon: '🎭', minutes: 8, rates: { social: 70, fun: 70 }, good: 3, bad: -3, accept: 0.6, bubbles: ['🎭', '👏'], emotion: 'happy', reject: '{target} walks through the invisible wall on purpose.', weight: 1 },
  { id: 'highfive', label: 'High Five', icon: '✋', minRel: 20, minutes: 3, rates: { social: 150, fun: 60 }, good: 4, bad: -3, accept: 0.8, bubbles: ['✋', '✋'], emotion: 'happy', reject: '{actor} is left hanging. Forever.', weight: 1.5 },
  { id: 'hug', label: 'Hug', icon: '🤗', minRel: 40, minutes: 4, rates: { social: 200, comfort: 60 }, good: 8, bad: -5, accept: 0.75, bubbles: ['🤗', '🤗'], emotion: 'happy', reject: '{target} offers a firm handshake instead.', weight: 1.5 },
  { id: 'backrub', label: 'Back Rub', icon: '💆', minRel: 50, minutes: 10, rates: { social: 80, comfort: 120 }, good: 6, bad: -4, accept: 0.7, bubbles: ['💆', '😌'], emotion: 'happy', reject: '{target} says their back is "fine, thanks".', weight: 1 },
  { id: 'dance', label: 'Dance Together', icon: '💃', minRel: 30, needsMusic: true, minutes: 20, rates: { social: 70, fun: 70, energy: -6 }, good: 6, bad: -3, accept: 0.7, bubbles: ['💃', '🕺'], emotion: 'happy', reject: '{target} does the robot instead. Badly.', weight: 1 },
  { id: 'gossip', label: 'Gossip', icon: '🤫', minRel: 30, minutes: 10, rates: { social: 100, fun: 30 }, good: 5, bad: -3, accept: 0.7, bubbles: ['🤫', '😮'], emotion: 'question', reject: "{target} says they don't gossip, then gossips about {actor}.", weight: 1 },
  { id: 'argue', label: 'Argue', icon: '💢', minutes: 8, rates: { social: 20, fun: -20 }, good: -8, bad: -8, accept: 1, mean: true, bubbles: ['💢', '💢'], emotion: 'angry', reject: '', weight: 0.4 },
  { id: 'insult', label: 'Insult', icon: '🤬', minutes: 4, rates: { social: 10 }, good: -12, bad: -12, accept: 1, mean: true, bubbles: ['🤬', '😠'], emotion: 'angry', reject: '', weight: 0.2 },
  { id: 'slap', label: 'Slap Fight', icon: '👋', maxRel: -40, minutes: 6, rates: { fun: 40, energy: -20 }, good: -15, bad: -15, accept: 1, mean: true, bubbles: ['👋', '💥'], emotion: 'angry', reject: '', weight: 0.6 },
];

export const SOCIAL_BY_ID: Record<string, SocialDef> = Object.fromEntries(SOCIALS.map((s) => [s.id, s]));

export function relLabel(daily: number): string {
  if (daily < -60) return 'Nemesis';
  if (daily < -20) return 'Not a Fan';
  if (daily < 20) return 'Acquaintance';
  if (daily < 50) return 'Friendly';
  if (daily < 80) return 'Friend';
  return 'Best Friend';
}

/** Mimlish syllables from CONTENT.md. Each Mim favors a seeded subset. */
export const SYLLABLES = ['ba', 'bo', 'bim', 'blee', 'da', 'doo', 'fa', 'fim', 'ga', 'goo', 'ka', 'kip', 'la', 'loo', 'ma', 'mim', 'mee', 'na', 'noo', 'pa', 'pim', 'ploo', 'ra', 'sa', 'sha', 'ta', 'tib', 'va', 'wa', 'wub', 'za', 'zoo'];
