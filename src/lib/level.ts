import { clamp } from './format';

/** Lowest level shown by the input meter, in dBFS. */
export const METER_FLOOR_DBFS = -80;

/**
 * Maps a level to a meter position.
 *
 * @param dbfs Level in dBFS (negative; 0 dBFS is full scale).
 * @returns Position in the range 0..1, where 0 is {@link METER_FLOOR_DBFS}.
 */
export function levelToFraction(dbfs: number): number {
  if (!Number.isFinite(dbfs)) return 0;
  return clamp((dbfs - METER_FLOOR_DBFS) / -METER_FLOOR_DBFS, 0, 1);
}
