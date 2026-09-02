// 地の面（おもて）の画像を焼く。
//
//   node tools/make-figures.mjs
//
// 絵そのものは tools/draw-figures.js（キャンバスに描く）。ここは焼くだけ。
// **出来上がりを直接いじらない。** 直すときは draw-figures.js を直して焼き直す
// （画像を手で塗り直すと、次に焼いた時に消える）。
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'src', 'assets', 'figures');
const W = 680;
const H = 1120;

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage();
await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
await page.addScriptTag({ content: readFileSync(join(here, 'draw-figures.js'), 'utf8') });

const ids = await page.evaluate(() => window.KAGAMI_FIGURES.FIGURES.map((f) => f.id));
mkdirSync(OUT, { recursive: true });
for (const id of ids) {
  const { url, colored } = await page.evaluate(([i, w, h]) => {
    const out = window.KAGAMI_FIGURES.render(i, w, h);
    // **焼いたものに色が入っていないことを、ここで確かめる。**
    // 画面のテストは元のコードしか読めないので、出来上がりはここで見る。
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const c = cv.getContext('2d');
    window.KAGAMI_FIGURES.paint(c, i, w, h);
    const d = c.getImageData(0, 0, w, h).data;
    let bad = 0;
    for (let k = 0; k < d.length; k += 4) {
      if (d[k] !== d[k + 1] || d[k + 1] !== d[k + 2]) bad += 1;
    }
    return { url: out, colored: bad };
  }, [id, W, H]);
  if (colored > 0) throw new Error(`${id}: 色の付いた点が ${colored} 個あります（灰色だけで描くこと）`);
  const data = Buffer.from(url.split(',')[1], 'base64');
  writeFileSync(join(OUT, `${id}.webp`), data);
  console.log(`${id}.webp  ${(data.length / 1024).toFixed(0)}KB`);
}
await browser.close();
