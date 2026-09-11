/**
 * Fetches the P0 models into `public/models/` and verifies their checksums.
 *
 * Spec section 11: small P0 models are self-hosted rather than pulled from a
 * hub at runtime, so the app works offline and nobody's living room audio
 * depends on a third party being up. Binaries are never committed; this script
 * is how a fresh clone gets them.
 *
 *   pnpm models:fetch             download and verify
 *   pnpm models:fetch --force     re-download even if present and valid
 *   pnpm models:checksums         record the hashes of what is on disk
 */
import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface ModelEntry {
  /** File name written into `public/models/`. */
  readonly file: string;
  /** Upstream URL. */
  readonly url: string;
  /** What the model is for, shown in Settings alongside its size. */
  readonly purpose: string;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODELS_DIR = join(ROOT, 'public', 'models');
const CHECKSUM_FILE = join(ROOT, 'scripts', 'models.checksums.json');
const WASM_DIR = join(MODELS_DIR, 'wasm');

/** The P0 model set (spec 6.1). Both are YAMNet at float32. */
const MODELS: readonly ModelEntry[] = [
  {
    file: 'yamnet-classifier.tflite',
    url: 'https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite',
    purpose: 'AudioClassifier: cat-class event trigger',
  },
  {
    file: 'yamnet-embedder.tflite',
    url: 'https://storage.googleapis.com/mediapipe-models/audio_embedder/yamnet/float32/1/yamnet.tflite',
    purpose: 'AudioEmbedder: 1024-dimensional embedding per window',
  },
];

type ChecksumMap = Record<string, string>;

/**
 * Copies MediaPipe's WASM runtime next to the models.
 *
 * earshot never hardcodes an asset location and nothing is fetched from a CDN
 * at runtime (spec section 11: no network calls beyond model downloads and the
 * app itself), so the runtime has to be served from our own origin. These files
 * are not downloaded: they come from the `@mediapipe/tasks-audio` version the
 * lockfile pins, which is what makes them reproducible.
 *
 * Both the SIMD and non-SIMD builds are copied because MediaPipe's
 * `FilesetResolver` chooses between them from what the browser reports.
 */
async function copyWasmAssets(): Promise<void> {
  const require = createRequire(import.meta.url);
  let packageEntry: string;
  try {
    packageEntry = require.resolve('@mediapipe/tasks-audio');
  } catch {
    throw new Error(
      '@mediapipe/tasks-audio is not installed. Run `pnpm install` before `pnpm models:fetch`.',
    );
  }

  // The entry point sits in the package root or in a build subdirectory; the
  // `wasm` directory is a sibling of one or the other.
  let directory = dirname(packageEntry);
  let source: string | null = null;
  for (let depth = 0; depth < 4; depth += 1) {
    const candidate = join(directory, 'wasm');
    if (existsSync(candidate)) {
      source = candidate;
      break;
    }
    directory = dirname(directory);
  }
  if (source === null) {
    throw new Error(`could not find the wasm directory near ${packageEntry}`);
  }

  await mkdir(WASM_DIR, { recursive: true });
  await cp(source, WASM_DIR, { recursive: true });

  let totalBytes = 0;
  for (const name of await readdir(WASM_DIR)) {
    totalBytes += (await stat(join(WASM_DIR, name))).size;
  }
  console.log(
    `· wasm/: MediaPipe runtime copied from the pinned package (${formatMb(totalBytes)})`,
  );
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function readChecksums(): Promise<ChecksumMap> {
  if (!existsSync(CHECKSUM_FILE)) return {};
  const parsed: unknown = JSON.parse(await readFile(CHECKSUM_FILE, 'utf8'));
  return typeof parsed === 'object' && parsed !== null ? (parsed as ChecksumMap) : {};
}

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function formatMb(byteLength: number): string {
  return `${(byteLength / 1_048_576).toFixed(2)} MB`;
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const writeChecksums = process.argv.includes('--write-checksums');

  await mkdir(MODELS_DIR, { recursive: true });
  const expected = await readChecksums();
  const recorded: ChecksumMap = {};
  let failures = 0;

  for (const model of MODELS) {
    const target = join(MODELS_DIR, model.file);
    let bytes: Uint8Array | null = null;

    if (existsSync(target) && !force) {
      bytes = new Uint8Array(await readFile(target));
      const actual = sha256(bytes);
      const want = expected[model.file];
      if (want !== undefined && want !== actual && !writeChecksums) {
        console.error(`✗ ${model.file}: checksum mismatch, re-downloading`);
        bytes = null;
      } else {
        console.log(`· ${model.file}: already present (${formatMb(bytes.byteLength)})`);
      }
    }

    if (bytes === null) {
      console.log(`↓ ${model.file}: ${model.url}`);
      bytes = await download(model.url);
      await writeFile(target, bytes);
      console.log(`  saved ${formatMb(bytes.byteLength)}`);
    }

    const actual = sha256(bytes);
    recorded[model.file] = actual;

    const want = expected[model.file];
    if (writeChecksums) {
      console.log(`  sha256 ${actual}`);
    } else if (want === undefined) {
      console.warn(
        `! ${model.file}: no recorded checksum. Run \`pnpm models:checksums\` and commit ` +
          `scripts/models.checksums.json once you trust this copy.`,
      );
    } else if (want !== actual) {
      console.error(`✗ ${model.file}: expected ${want}, got ${actual}`);
      failures += 1;
    } else {
      console.log(`✓ ${model.file}: checksum verified`);
    }
  }

  await copyWasmAssets();

  if (writeChecksums) {
    await writeFile(CHECKSUM_FILE, `${JSON.stringify(recorded, null, 2)}\n`);
    console.log(`\nWrote ${CHECKSUM_FILE}`);
  }

  if (failures > 0) {
    console.error(`\n${failures} model(s) failed verification.`);
    process.exitCode = 1;
    return;
  }
  console.log('\nModels ready in public/models/');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
