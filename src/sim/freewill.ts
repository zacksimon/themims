import { OBJECTS, InteractionDef } from '../content/objects';
import { NEEDS, NeedDelta, urgency } from './needs';
import { hourOf } from '../engine/clock';
import type { Mim } from './mim';
import type { ObjInst } from './objects';
import { defOf, objCenter } from './objects';
import type { World } from './world';

export interface Choice {
  obj: ObjInst;
  ix: InteractionDef;
  score: number;
}

/** Expected total need gain of an interaction, used for both free will and UI hints. */
export function advertised(ix: InteractionDef): NeedDelta {
  if (ix.adv) return ix.adv;
  const out: NeedDelta = {};
  const mins = ix.minutes ?? ix.maxMinutes ?? 30;
  for (const k in ix.rates) out[k as keyof NeedDelta] = (ix.rates[k as keyof NeedDelta] ?? 0) * (mins / 60);
  return out;
}

/** Utility of an interaction for this Mim right now: gains weighted by how much each need is wanted. */
export function utility(m: Mim, adv: NeedDelta): number {
  let s = 0;
  for (const k of NEEDS) {
    const g = adv[k];
    if (!g) continue;
    const gain = g > 0 ? Math.min(g, 100 - m.needs[k]) : g;
    s += gain * urgency(m.needs[k]);
  }
  return s;
}

export function scoreChoices(w: World, m: Mim): Choice[] {
  const out: Choice[] = [];
  for (const o of w.objects) {
    if ((m.unreachable[o.id] ?? -1) > w.time) continue;
    const def = defOf(o);
    const [cx, cy] = objCenter(o);
    const dist = Math.hypot(cx - m.x, cy - m.y);
    for (const ix of def.interactions) {
      if (ix.auto === false || ix.hidden) continue;
      if (ix.available && !ix.available(w, m, o)) continue;
      if (ix.cost && w.funds < ix.cost) continue;
      const night = hourOf(w.time) >= 22 || hourOf(w.time) < 6;
      if (ix.want) {
        const below = ix.sleep && night ? ix.want.below + 40 : ix.want.below;
        if (m.needs[ix.want.need] >= below) continue;
      }
      if (!ix.seat && !w.hasFreeSlot(o, ix, m)) continue;
      let s = utility(m, advertised(ix));
      if (ix.sleep && ix.untilFull && (hourOf(w.time) >= 22 || hourOf(w.time) < 6)) s *= 2;
      if (s <= 0) continue;
      s /= 1 + dist / 18;
      out.push({ obj: o, ix, score: s });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Pick something to do. Top choices are weighted so behavior feels alive and a little irrational. */
export function chooseAutonomous(w: World, m: Mim): Choice | null {
  const choices = scoreChoices(w, m).slice(0, 3);
  if (!choices.length || choices[0].score < 0.8) return null;
  const usable = choices.filter((c) => c.score >= choices[0].score * 0.5);
  const total = usable.reduce((a, c) => a + c.score * c.score, 0);
  let r = w.rng.next() * total;
  for (const c of usable) {
    r -= c.score * c.score;
    if (r <= 0) return c;
  }
  return usable[0];
}

export function findIx(defId: string, ixId: string): InteractionDef | undefined {
  return OBJECTS[defId]?.interactions.find((i) => i.id === ixId);
}
