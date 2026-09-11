import { DEFAULT_ENGINE_OPTIONS } from './config';
import type { AudioEngine, EngineError, EngineOptions } from './types';

/**
 * The single place in meowlogue that knows the `earshot` package exists.
 *
 * earshot is not published yet (the repository is empty as of this commit), so
 * this module resolves it lazily and reports a typed `earshot-unavailable`
 * error when it cannot. The debug page renders that state honestly instead of
 * pretending to listen.
 *
 * Wiring the real engine is a two-line change, both of them in this file:
 *   1. add `"earshot": "github:ezar/earshot#vX.Y.Z"` to package.json
 *   2. replace `loadEarshot()`'s body with `return import('earshot')`
 *
 * Nothing else in the app imports from `earshot`, by design. See
 * docs/decisions/0001-earshot-integration-seam.md.
 */

/** The factory earshot is expected to export (spec 6.1, section 7). */
type EarshotModule = {
  createAudioEngine(options: EngineOptions): Promise<AudioEngine>;
};

/** Raised when the engine cannot be constructed. Carries a typed code. */
export class AudioEngineError extends Error {
  readonly code: EngineError['code'];

  constructor(error: EngineError) {
    super(error.message, error.cause === undefined ? undefined : { cause: error.cause });
    this.name = 'AudioEngineError';
    this.code = error.code;
  }

  toEngineError(): EngineError {
    return { code: this.code, message: this.message, cause: this.cause };
  }
}

const EARSHOT_UNAVAILABLE: EngineError = {
  code: 'earshot-unavailable',
  message:
    'The earshot audio engine is not wired up yet. meowlogue consumes it from ' +
    'github:ezar/earshot at a release tag; until that tag exists there is no ' +
    'capture, detection or feature pipeline to run.',
};

/**
 * Resolves the earshot module, or null when the package is not installed.
 *
 * The specifier is built at runtime so that bundlers do not try to resolve a
 * package that is deliberately absent from package.json today.
 */
async function loadEarshot(): Promise<EarshotModule | null> {
  const specifier = 'earshot';
  try {
    const mod: unknown = await import(/* @vite-ignore */ specifier);
    if (
      typeof mod === 'object' &&
      mod !== null &&
      'createAudioEngine' in mod &&
      typeof (mod as EarshotModule).createAudioEngine === 'function'
    ) {
      return mod as EarshotModule;
    }
    return null;
  } catch {
    return null;
  }
}

/** True when the earshot package resolves and exposes the expected factory. */
export async function isEarshotAvailable(): Promise<boolean> {
  return (await loadEarshot()) !== null;
}

/**
 * Builds the audio engine for a listening session.
 *
 * @param overrides Partial engine options merged over {@link DEFAULT_ENGINE_OPTIONS}.
 * @throws {AudioEngineError} with code `earshot-unavailable` until earshot ships.
 */
export async function createAudioEngine(
  overrides: Partial<EngineOptions> = {},
): Promise<AudioEngine> {
  const earshot = await loadEarshot();
  if (earshot === null) {
    throw new AudioEngineError(EARSHOT_UNAVAILABLE);
  }
  return earshot.createAudioEngine({ ...DEFAULT_ENGINE_OPTIONS, ...overrides });
}
