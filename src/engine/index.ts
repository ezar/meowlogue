/**
 * The audio engine seam. Application code imports from here and never from
 * `earshot` directly. See docs/decisions/0001-earshot-integration-seam.md.
 */
export * from './types';
export * from './config';
export { AudioEngineError, createAudioEngine, isEarshotAvailable } from './earshot-adapter';
