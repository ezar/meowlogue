# 0001: Isolate the earshot dependency behind a seam

- Status: accepted
- Date: 2026-09-11
- Milestone: M0

## Context

The spec makes `earshot` the audio engine for both Meowlogue and SteadyHum, and
section 11 is explicit about how to consume it: from GitHub, pinned to a release
tag, as TypeScript source, never copied into this repository.

At the time M0 started, `github.com/ezar/earshot` contained a single `README.md`
with one line in it. There is no code, no release tag, and no `earshot-spec.md`.
The engine is being written in parallel in its own repository.

That leaves meowlogue's M0 — "a debug page that consumes the tagged earshot
release" — with nothing to consume. Waiting would stall the milestone; adding
`"earshot": "github:ezar/earshot#v0.1.0"` to `package.json` would break
`pnpm install` for everyone; and reimplementing detection, segmentation and
pitch tracking here would violate section 11 and duplicate work already under
way.

## Decision

Everything earshot will provide is described as types in `src/engine/types.ts`,
and exactly one module — `src/engine/earshot-adapter.ts` — is allowed to import
the `earshot` package. Application code imports from `@/engine` only.

While the package is absent, the adapter resolves it lazily, fails with a typed
`earshot-unavailable` error, and the debug page says so in plain language rather
than looking broken. The rest of the page — level meter, session summary,
detection-policy panel, spectrogram rendering, JSON export — is real and tested.

Detection policy (thresholds, segmentation windows, confidence bands) lives in
`src/engine/config.ts`, in this repository rather than in earshot. These are
Meowlogue's numbers: earshot supplies the mechanism, meowlogue decides where a
cat household's thresholds sit and what the user is told about a guess.

## Wiring earshot up

When earshot tags a release, two lines change, both in the adapter's file:

1. add `"earshot": "github:ezar/earshot#vX.Y.Z"` to `package.json`
2. replace the body of `loadEarshot()` with `return import('earshot')`

Then reconcile `src/engine/types.ts` against earshot's published types. Any
mismatch is a conversation between the two repositories, not a patch in
application code — which is the whole point of the seam.

`optimizeDeps.exclude` in `vite.config.ts` already lists `earshot` so Vite
compiles its worker and worklet entry points rather than pre-bundling them.

## Consequences

- M0 ships something runnable and tested without blocking on another repository.
- No engine code is duplicated here, so section 11 holds.
- The cost is one indirection and a types file that must be reconciled once.
- `tests/unit/engine-adapter.test.ts` asserts the unavailable path stays typed,
  so the failure mode cannot silently regress into a module-resolution crash.
