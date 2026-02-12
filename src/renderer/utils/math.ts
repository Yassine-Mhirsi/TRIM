export const TRIM_EPSILON_SECONDS = 0.01;

export type TrimRange = {
  start: number;
  end: number;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeTrimRange(range: TrimRange, duration: number): TrimRange {
  const maxDuration = Math.max(0, duration);
  const minWindow = Math.min(TRIM_EPSILON_SECONDS, maxDuration);
  const maxStart = Math.max(0, maxDuration - minWindow);
  const start = clamp(range.start, 0, maxStart);
  const end = clamp(range.end, start + minWindow, maxDuration);
  return { start, end };
}
