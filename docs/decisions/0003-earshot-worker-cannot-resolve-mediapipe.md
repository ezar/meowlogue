# 0003: earshot's worker cannot resolve MediaPipe in a browser

- Status: resolved in earshot v0.4.0
- Date: 2026-09-11
- Milestone: M0

## The failure

With earshot v0.3.0 wired up, pressing Start in a real browser fails:

```
earshot: Failed to resolve module specifier '@mediapipe/tasks-audio'
```

Reproduced in Chromium against a production build; three end-to-end tests are
marked `fixme` against this record.

## Cause

earshot's `defaultTasksAudioLoader` imports MediaPipe through a bare specifier
held in a variable and marked `@vite-ignore`, so no bundler rewrites it and the
browser is asked to resolve `@mediapipe/tasks-audio` on its own. Browsers
cannot: bare specifiers need an import map, and import maps do not apply to a
module worker's graph.

earshot does provide an override, `ModelUrls.loadTasksAudio`. It cannot reach
the worker: it is a function, so it cannot cross `postMessage`.
`EngineOptions.models` is typed `Omit<ModelUrls, 'loadTasksAudio'>` for exactly
that reason, and the worker's init message omits it too. The worker always uses
the default loader.

So the override works on the main thread — `createClassifier` and
`createEmbedder` take full `ModelUrls` — and is unreachable in the one place
the engine actually loads models.

## Why there is no fix on this side

- **Aliasing.** `@vite-ignore` tells Vite not to touch the import, and the
  specifier is a variable, so there is nothing to alias.
- **Import maps.** Not applied to module workers.
- **A worker shim.** A wrapper worker cannot inject a loader earshot does not
  look for.
- **Reimplementing the worker here.** Forbidden: never copy earshot's code
  (spec section 11, `CLAUDE.md`). It would also fork the pipeline SteadyHum
  shares.
- **Main-thread inference.** Would drop the worker the spec requires (section
  7: no UI jank) and duplicate earshot's framing logic.

## Proposed fix, in earshot

Make `earshot/worker` import `@mediapipe/tasks-audio` **statically**, so the
consuming app's bundler resolves and bundles it while building the worker.

This preserves the reason the import was dynamic — keeping MediaPipe out of the
core bundle for apps that use only the DSP — because `earshot/worker` is
already a separate entry point. An app that never constructs an engine never
loads that chunk.

Alternative, if the dynamic import must stay: carry a module **URL** (a string,
therefore serializable) in the init message, and have the worker import that.

Either way the change is in earshot, gets tests there, is released under a new
tag, and the tag is bumped here — the process `CLAUDE.md` already prescribes.

## Resolution

earshot v0.4.0 took the proposed fix: the MediaPipe specifier is now a static
literal, so the consumer's bundler resolves it and bundles it into the worker
chunk. Our worker chunk grew from 10.6 kB to 62 kB, which is MediaPipe arriving.

earshot found a second defect at the same time, which this record had not:
**MediaPipe cannot load in an ES module worker at all.** It loads its WASM glue
with `importScripts`, which module workers do not support, and its fallback
wants a `document`. So the engine worker is now a _classic_ worker and
consumers must set `worker.format: 'iife'`. Their own record is
`docs/decisions/0007-mediapipe-cannot-load-in-a-module-worker.md`.

That is why 0.4.0 is a MINOR rather than a PATCH, and why earshot's changelog
says plainly that **0.3.0 should not be used**: on that tag `createEngine`
cannot load a model in any browser, with no workaround.

Verified here: the three end-to-end tests this record blocked now pass against
a production build in Chromium — models load from our own origin, the worker
starts, and the level meter carries a real dBFS value, which only happens once
windows are coming back from the worker.

## Historical note

The integration is complete and unit-tested; only the live browser path is
blocked. The debug page reports the failure in plain language rather than
hanging on a spinner, and an end-to-end test asserts that it does — a missing
capability should say what is missing (spec section 2).
