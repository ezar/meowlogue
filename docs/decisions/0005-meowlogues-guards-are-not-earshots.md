# 0005: Meowlogue's guards are not earshot's

- Status: accepted
- Date: 2026-09-12
- Milestone: M0

## Context

earshot 0.5.0 added `createEngine({ guards })`: the guards run inside the
worker, the verdict is attached to every window, and **the embedder is skipped
for windows the guards reject**. The embedder is more than half the engine's
per-window cost, so on silence the cost falls from 17.0 ms to 7.3 ms per
window, with no penalty on audio the guards accept.

A cat household is mostly silence. This is the largest saving available to the
listening loop, and it costs one option.

The option is not free of judgement, though, because of what earshot's
defaults are. `INTERFERENCE_CLASSES` is SteadyHum's list — earshot's other
consumer listens to a washing machine, and there a window is worthless if
something else is making a sound. The list therefore contains:

```
'Speech', 'Conversation', …, 'Television', 'Radio', 'Dog', 'Cat', 'Bird'
```

`Cat` is in the list. For SteadyHum that is correct. In Meowlogue the cat is
the signal, so `guards: {}` — accepting earshot's defaults — would reject
every window with a confident `Cat` score and skip the embedder for exactly the
windows spec 6.4 needs to train identity. Nothing would error. Identity would
simply never have any data, and the debug page would report an embedder that
loaded and produced nothing.

## Decision

Meowlogue passes its own `GUARDS` policy (`src/engine/config.ts`), which keeps
the level guards and switches the interference guard off:

```ts
export const GUARDS: GuardConfig = {
  silenceFloorDbfs: -72,
  maxLevelDbfs: -3,
  interferenceClasses: [],
};
```

- **Silence stays a guard.** A window below the floor holds no vocalization to
  embed, and this is where the saving comes from.

- **The floor is -72 dBFS, not earshot's -65.** Spec 6.2 treats purrs as quiet
  at distance — it is why their class threshold is the lowest of the five — and
  a purr wrongly called silence would lose its embedding. The floor is a
  threshold to tune against the evaluation set like any other, not a constant.

- **Too-loud stays a guard.** The embedding of a clipped window describes the
  clipping.

- **Interference is switched off with an empty list**, rather than by
  hand-pruning the animals out of earshot's list. A pruned copy would silently
  fall out of date the next time earshot added a class, and the pruning would
  have to be re-justified every time. An empty list says what is meant: this
  app has no interference guard.

- **Human voice is not a guard.** Spec 6.2 is explicit that an event which may
  be a person imitating a cat is _stored and marked_ `possibleHuman`, not
  dropped, and the confirmation flow in 6.4 needs its embedding to exist. The
  speech policy stays where the spec puts it, in the detector's `humanScore`.

## Consequences

An embedding can now be absent for a window inside an event. `poolEmbedding`
already handles that: it pools the covering windows that carry one and returns
null when none does, which the UI reports rather than hides.

`EARSHOT_INTERFERENCE_CLASSES` is re-exported through the seam so the unit test
asserts against earshot's real list rather than a copy of it. The test fails if
anyone ever passes the defaults, and states why in the assertion:

```ts
expect(EARSHOT_INTERFERENCE_CLASSES).toContain('Cat');
expect(GUARDS.interferenceClasses).toEqual([]);
```

This is the second time earshot's defaults have been right for its other
consumer and wrong here — the first was the single global `triggerScore`
against spec 6.2's per-class thresholds, handled in `vocalization.ts`. The
pattern is worth naming: earshot supplies mechanism, and every policy default
it ships is SteadyHum's policy until Meowlogue decides otherwise.
