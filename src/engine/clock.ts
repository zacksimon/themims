/** Game time in minutes. 1 real second = 1 game minute at speed 1. */
export const SPEEDS = [0, 1, 3, 10] as const;
export const DAY_MIN = 24 * 60;

export function dayOf(min: number): number {
  return Math.floor(min / DAY_MIN) + 1;
}
export function minuteOfDay(min: number): number {
  return ((min % DAY_MIN) + DAY_MIN) % DAY_MIN;
}
export function hourOf(min: number): number {
  return minuteOfDay(min) / 60;
}
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export function weekdayOf(min: number): string {
  return WEEKDAYS[(dayOf(min) - 1) % 7];
}
export function isWorkday(min: number): boolean {
  return (dayOf(min) - 1) % 7 < 5;
}
export function formatTime(min: number): string {
  const m = Math.floor(minuteOfDay(min));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm.toString().padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}
