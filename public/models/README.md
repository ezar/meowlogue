# Models

This directory holds the self-hosted P0 models. **The binaries are not
committed** — run `pnpm models:fetch` after cloning.

| File | Purpose | Source |
| --- | --- | --- |
| `yamnet-classifier.tflite` | MediaPipe Tasks Audio `AudioClassifier`, the cat-class event trigger (spec 6.1) | Google, MediaPipe model garden |
| `yamnet-embedder.tflite` | MediaPipe Tasks Audio `AudioEmbedder`, 1024-d embedding per window | Google, MediaPipe model garden |

Checksums live in `scripts/models.checksums.json` and are verified on every
fetch. Optional larger models (CLAP in P1, WebLLM in P2) are downloaded on
demand from their hubs and cached, never vendored here.
