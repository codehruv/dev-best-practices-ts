// Calendar units use fixed lengths (30-day month, 90-day quarter, 365-day year). Only
// ratios between windows depend on them, and burn-rate windows never use calendar units.
const MINUTES_PER_UNIT = {
  m: 1,
  h: 60,
  d: 1_440,
  w: 10_080,
  M: 43_200,
  Q: 129_600,
  Y: 525_600,
} as const;

type DurationUnit = keyof typeof MINUTES_PER_UNIT;

function isDurationUnit(unit: string): unit is DurationUnit {
  return Object.hasOwn(MINUTES_PER_UNIT, unit);
}

/**
 * Converts an OpenSLO duration shorthand ("5m", "28d") to minutes, so window lengths can
 * be compared. Returns undefined for text that is not a valid shorthand.
 */
export function durationToMinutes(duration: string): number | undefined {
  const match = /^([1-9][0-9]*)([a-zA-Z])$/.exec(duration);
  const unit = match?.[2];
  if (match?.[1] === undefined || unit === undefined || !isDurationUnit(unit)) {
    return undefined;
  }
  return Number(match[1]) * MINUTES_PER_UNIT[unit];
}
