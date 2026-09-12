import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium } from '@playwright/test';

/**
 * Rasterises `public/icon.svg` into the PNGs the web app manifest needs.
 *
 * Chromium is already a dependency for the end-to-end tests and is already
 * installed in CI, so it renders these rather than adding an image library for
 * six files. The PNGs are committed: a manifest icon that 404s makes an app
 * uninstallable, and that is not a failure worth discovering at install time on
 * someone's phone.
 *
 * Run with `pnpm icons:build` after editing the SVG.
 */

/** Fraction of the canvas the mark occupies in a maskable icon. */
const SAFE_ZONE = 0.8;

/** Warm neutral base, the same `BASE_HEX` as `src/lib/cat-colors.ts`. */
const BACKGROUND = '#faf7f2';

interface IconSpec {
  readonly file: string;
  readonly size: number;
  /** Maskable icons inset the mark so a circular mask cannot clip it. */
  readonly maskable: boolean;
}

const ICONS: readonly IconSpec[] = [
  { file: 'icons/icon-192.png', size: 192, maskable: false },
  { file: 'icons/icon-512.png', size: 512, maskable: false },
  { file: 'icons/icon-maskable-192.png', size: 192, maskable: true },
  { file: 'icons/icon-maskable-512.png', size: 512, maskable: true },
  { file: 'icons/apple-touch-icon.png', size: 180, maskable: true },
  { file: 'favicon-32.png', size: 32, maskable: false },
];

const projectRoot = resolve(import.meta.dirname, '..');
const publicDir = resolve(projectRoot, 'public');

async function main(): Promise<void> {
  const svg = await readFile(resolve(publicDir, 'icon.svg'), 'utf8');
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;

  const executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(executablePath === undefined ? {} : { executablePath });
  try {
    for (const icon of ICONS) {
      const page = await browser.newPage({
        viewport: { width: icon.size, height: icon.size },
        deviceScaleFactor: 1,
      });
      const inset = icon.maskable ? ((1 - SAFE_ZONE) / 2) * 100 : 0;
      await page.setContent(
        `<!doctype html><style>
           html,body{margin:0;width:100%;height:100%;background:${BACKGROUND}}
           img{position:absolute;inset:${inset}%;width:${100 - inset * 2}%;height:${100 - inset * 2}%}
         </style><img src="${dataUrl}" alt="">`,
      );
      await page.waitForLoadState('load');
      const target = resolve(publicDir, icon.file);
      await mkdir(dirname(target), { recursive: true });
      const png = await page.screenshot({ omitBackground: false });
      await writeFile(target, png);
      await page.close();
      console.log(`${icon.file} ${icon.size}x${icon.size}${icon.maskable ? ' (maskable)' : ''}`);
    }
  } finally {
    await browser.close();
  }
}

await main();
