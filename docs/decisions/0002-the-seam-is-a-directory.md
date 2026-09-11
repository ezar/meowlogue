# 0002: The earshot seam is a directory, not a file

- Status: accepted
- Date: 2026-09-11
- Milestone: M0
- Supersedes part of [0001](0001-earshot-integration-seam.md)

## Context

Record 0001 set up the seam before earshot existed and claimed two things that
turned out to be wrong once earshot v0.3.0 shipped.

**"Exactly one module may import `earshot`."** That held only while the import
was a single factory call. The real API is not one object: earshot deliberately
ships three composable pieces — `createCapture` (the microphone),
`createEngine` (windows, via a worker) and `createEventDetector` (events from
windows plus the envelope) — and leaves the wiring to the app, because the
wiring is where the product decisions live. It also exports the types those
pieces speak, which the app's own types must be built on rather than restate.
Funnelling all of that through one file would mean re-exporting earshot's type
surface by hand: more code, and a second place for it to drift.

**"Wiring earshot up is a two-line change."** It was not. The names differ
(`createAudioEngine` does not exist), the units differ (earshot times events in
seconds since capture started; Meowlogue stores epoch milliseconds), the field
names differ (`confidence` not `typeConfidence`, `peakDbfs` not `peakRmsDbfs`,
`syllables` not `syllableCount`), the pitch slope is in semitones per second
rather than Hz per second, and a window's `logMel` is a single 64-value average
rather than a spectrogram. The integration touched every consumer.

## Decision

The seam is `src/engine/`. Any module inside it may import `earshot`; nothing
outside it may. Application code imports from `@/engine`.

Inside the seam:

- `types.ts` re-exports earshot's types rather than restating them, and adds
  the app-level `MeowEvent`.
- `config.ts` holds Meowlogue's detection policy in the spec's own units.
- `vocalization.ts` is the pure, tested translation layer: unit conversion,
  label mapping, and the per-class threshold policy earshot's single
  `triggerScore` cannot express.
- `listener.ts` composes capture, engine and detector into one session.
- `mel.ts` stacks window log-mel vectors into an event thumbnail.

## Consequences

- The prediction in 0001 was wrong about effort but right about containment.
  When the API turned out to differ, `tsc` listed every affected line and every
  one was in the app layer or in tests — no domain logic moved. That is what
  the seam bought, and it is the part worth keeping.
- Estimating integration cost against an API that does not exist yet is not
  possible. 0001 should have said "one indirection to change" and left the line
  count out of it.
