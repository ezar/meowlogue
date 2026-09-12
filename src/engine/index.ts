/**
 * The engine seam.
 *
 * Application code imports from here; only modules inside `src/engine/` import
 * from `earshot`. See docs/decisions/0002-the-seam-is-a-directory.md.
 */
export * from './types';
export * from './config';
export { createListener, estimateNoiseFloorDbfs, type ListenerOptions } from './listener';
export { stackLogMel } from './mel';
export { poolEmbedding, windowsCovering } from './windows';
export {
  TRIGGER_CLASSES,
  lowestTriggerScore,
  passesClassPolicy,
  thresholdFor,
  toDetectorConfig,
  toMeowEvent,
  vocalizationTypeFor,
} from './vocalization';
