# Meowlogue — working notes

The spec is the source of truth. This file is the short version for anyone,
human or agent, picking the repository up.

## Non-negotiables

- **Never copy earshot's code here.** The audio engine is consumed from
  `github:ezar/earshot` at a release tag (spec section 11). If earshot lacks
  something, add it to earshot with tests, tag a release, then bump the tag
  here.
- **Only modules inside `src/engine/` may import `earshot`.** Everything else
  imports from `@/engine`. The seam is the directory, not one file — earshot
  ships three composable pieces plus the types they speak, and wiring them is
  the app's job. See `docs/decisions/0002-the-seam-is-a-directory.md`.
- **Honesty over flattery.** Meowlogue never translates. Every guess carries its
  confidence, cold-start output is labelled a hint, and a missing capability
  says what is missing rather than showing a spinner or a stack trace.
- **Local first.** No backend, no accounts, no analytics. The only network calls
  are model downloads and the app itself.
- **Strict TypeScript, including workers. No `any`.** JSDoc with units on every
  numeric parameter (Hz, dBFS, ms).
- **Every algorithm in spec section 6 gets a unit test on synthetic fixtures
  before it gets a UI.**

## Language

Code, comments, identifiers, commits, README and docs in English. UI copy lives
only in i18n dictionaries — Spanish default, English second. i18n arrives in M1.

## Where things go

- `src/engine/` — the earshot seam. `types.ts` re-exports earshot's types and
  adds the app-level `MeowEvent`; `config.ts` is Meowlogue's detection policy
  in the spec's units; `vocalization.ts` is the pure translation layer
  (seconds/milliseconds, labels, per-class thresholds); `listener.ts` composes
  capture, engine and detector; `mel.ts` stacks thumbnails.
- `src/identity/` — "who was that?" (spec 6.4). The policy lives in
  `src/engine/identity.ts`; this is the worker that runs it, the store that
  owns the worker, and the two screens' worth of status copy. Training is
  quadratic in the confirmed set (measured: 17 ms at 20 examples, 177 ms at
  100, 6 s at 600), so it never runs on the main thread.
- `src/timeline/` — the history (spec 5.1): the filtered list, and one event
  in full. The filtering and day grouping are pure and live in
  `src/lib/timeline.ts`; the screens only render them.
- `src/lib/` — app-side logic with no DOM or engine dependency where possible,
  so it is unit-testable and can later move into a worker.
- `src/debug/` — the M0 debug page. It is scaffolding for tuning, not product.

Detection thresholds are Meowlogue's, not earshot's: earshot supplies the
mechanism, this repository decides where a cat household's thresholds sit.

## Dependencies

Everything is pinned to the latest version that is actually compatible, not
simply the latest published. One ceiling is worth knowing about:

- **TypeScript is held at 6.x, not 7.** `typescript-eslint` peers
  `typescript >=4.8.4 <6.1.0`. Installing TypeScript 7 does not fail the build
  — it degrades type-aware linting, which is where the `no-explicit-any` and
  `strictTypeChecked` rules come from. Bump TypeScript only once
  `typescript-eslint` widens that range.

- **`@mediapipe/tasks-audio` is held at 0.10.21, and this one is not
  negotiable.** MediaPipe removed `AudioEmbedder` after that version. Without
  an embedder there are no embeddings, so cat identity (spec 6.4) cannot be
  trained at all — earshot falls back to classifier-only and says so. earshot
  exports `EMBEDDER_MAX_VERSION` to assert against rather than hardcoding the
  number.

`tsconfig.app.json` deliberately has no `baseUrl`: it is deprecated in
TypeScript 6 and removed in 7, and `paths` already resolves relative to the
config file.

## Before pushing

`pnpm check` runs format, lint, typecheck and unit tests. `pnpm test:e2e` runs
Playwright against a real production build; pass `CHROMIUM_PATH` if the local
Chromium does not match the build Playwright expects.

## The model path does not run under `pnpm dev`

Vite serves workers as ES modules in development whatever `worker.format`
says, and MediaPipe cannot load in a module worker. So `pnpm dev` gives you
the page but not the engine: pressing Start there fails.

Anything touching a class score or an embedding has to be exercised against a
build — `pnpm build && pnpm preview`, or `pnpm test:e2e`, which already does
exactly that. Capture, levels, features, pitch and segmentation never touch a
model and work fine in dev.

`worker.format` is `'iife'` for the same reason, and it is **global** in Vite:
the nightly aggregation worker in spec section 7 will have to be IIFE too.

Meowlogue's own identity worker is the exception that proves the rule: it
loads no model and touches no WASM, so it runs under `pnpm dev` as happily as
in a build.

## Milestones

M0 (here) pipeline and evaluation, debug page only. M1 the product loop:
onboarding, teach voices, Listen, timeline, persistence, i18n, PWA. M2 insight
and honesty. M3 fun and depth. See spec section 9.
