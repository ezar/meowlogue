# Meowlogue

Your cats have a vocabulary. Meowlogue learns it with you.

A PWA that listens for cat vocalizations with the phone microphone, learns to
tell your cats apart by voice, learns what each cat's calls usually mean in your
home, logs everything on a timeline, and turns weeks of listening into insights
you can use — including a vet-ready summary of how much and when each cat
vocalizes.

Everything runs in the browser. Audio never leaves the phone unless you choose
to share a clip. Meowlogue **does not translate** cat language; there is no such
thing to translate. It learns your household's own habits.

## Status: M0

M0 is the pipeline-and-evaluation milestone. The only surface it ships is a
debug page — the product UI (onboarding, Listen, Timeline, Insights, Away, vet
summary) arrives in M1.

What is in this repository today:

| Area                                                                             | State                            |
| -------------------------------------------------------------------------------- | -------------------------------- |
| Project scaffolding, strict TypeScript, lint, format, CI                         | done                             |
| Detection policy — thresholds, segmentation, confidence bands (spec 6.2, 6.4)    | done, `src/engine/config.ts`     |
| earshot contract and integration seam                                            | done, `src/engine/`              |
| Self-hosted YAMNet models with checksum verification                             | done, `pnpm models:fetch`        |
| Debug page: level meter, session summary, policy panel, spectrogram, JSON export | done                             |
| Capture, detection, segmentation, pitch, features, kNN identity and context      | **in earshot**, not yet released |

### The earshot dependency

Meowlogue's audio engine is [`earshot`](https://github.com/ezar/earshot), the
shared engine also used by SteadyHum. Per spec section 11 it is consumed from
GitHub at a release tag and never copied into this repository.

earshot has no release tag yet, so the debug page reports the engine as
unavailable in plain language and the pipeline does not run. Everything else on
the page is live. Wiring the real engine up is a two-line change in
`src/engine/earshot-adapter.ts` — see
[docs/decisions/0001-earshot-integration-seam.md](docs/decisions/0001-earshot-integration-seam.md).

## Getting started

```sh
pnpm install
pnpm models:fetch   # ~16 MB of YAMNet into public/models/, checksum-verified
pnpm dev
```

Model binaries are never committed. `pnpm models:fetch` verifies them against
`scripts/models.checksums.json` on every run and re-downloads on a mismatch.

## Scripts

| Script                      | What it does                                 |
| --------------------------- | -------------------------------------------- |
| `pnpm dev`                  | Vite dev server                              |
| `pnpm build`                | Typecheck, then production build             |
| `pnpm test`                 | Vitest unit tests                            |
| `pnpm test:e2e`             | Playwright against the production build      |
| `pnpm lint` / `pnpm format` | ESLint / Prettier                            |
| `pnpm typecheck`            | `tsc --build` across app and tooling         |
| `pnpm check`                | format check, lint, typecheck and unit tests |
| `pnpm models:fetch`         | Download and verify the P0 models            |
| `pnpm models:checksums`     | Re-record checksums for what is on disk      |

Where the local Chromium does not match the build Playwright expects, point
`CHROMIUM_PATH` at it: `CHROMIUM_PATH=/path/to/chromium pnpm test:e2e`.

## Layout

```
src/
  engine/        the earshot seam: contract types, detection policy, adapter
  lib/           app-side logic: formatting, spectrogram raster, session export
  debug/         the M0 debug page and its components
scripts/         models-fetch and its checksum manifest
tests/unit/      Vitest
tests/e2e/       Playwright
docs/decisions/  decision records (spec section 11)
```

The acoustic fixtures and the CatMeows evaluation (spec 6.7) live in earshot's
own `fixtures/synthetic/` and `scripts/eval/`, with results in earshot's
`docs/eval-results.md`.

## Conventions

Code, comments, identifiers, commits and docs in English; UI copy only in i18n
dictionaries, Spanish default and English second (i18n lands with M1). Strict
TypeScript everywhere including workers, no `any`, JSDoc with units on every
numeric parameter. No analytics and no network calls beyond model downloads and
the app itself. See spec section 11.

## Privacy

Audio is captured, analysed and stored on the device. There is no backend, no
account and no telemetry. Clips are kept for as long as the retention setting
says and can be deleted at any time. Model files are downloaded once from
Google's MediaPipe model garden and then served from this app's own origin.
