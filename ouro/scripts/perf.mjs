// 速さの回帰テスト（新項目30）。
//
//   npm run build && npm run perf
//
// 起動にかかった時間と、起動時に読んだ量を毎回同じ手順で測り、
// 前回の結果（scripts/perf-baseline.json）と並べて出す。
// **数字は端末とCPUの状態で揺れる**ので、合否は出さない。
// 「前より倍になった」に気づくためのもの。
//
// Playwright はこのアプリの依存には入れていない（外部ランタイム依存なしの方針）。
// 手元に無い時は、その旨だけ伝えて何もしない。

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { extname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const baselinePath = join(root, 'scripts', 'perf-baseline.json');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
};

function serve(port) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(dist, path === '/' ? 'index.html' : path.replace(/^\//, ''));
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

async function main() {
  if (!existsSync(join(dist, 'index.html'))) {
    console.error('先に npm run build を実行してください。');
    process.exit(1);
  }

  // playwright はこのアプリの依存に入れていないので、無ければ黙って飛ばす。
  // 別の場所に入れてある時は PLAYWRIGHT_PATH でその場所を渡せる。
  let chromium;
  // 絶対パスを渡された時は file:// に直してから読む（そのままでは import できない）。
  const given = process.env.PLAYWRIGHT_PATH;
  const asUrl = given && given.startsWith('/') ? pathToFileURL(given).href : given;
  for (const spec of [asUrl, given, 'playwright'].filter(Boolean)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const mod = await import(spec);
      // playwright は CommonJS なので、名前つきで取れない置き方もある
      chromium = mod.chromium || (mod.default && mod.default.chromium);
      if (chromium) break;
    } catch {
      /* 次の候補へ */
    }
  }
  if (!chromium) {
    console.log('playwright が見つからないので測定を飛ばします。');
    console.log('（測る時：npm i -D playwright、または PLAYWRIGHT_PATH で場所を指定）');
    return;
  }

  const port = 4399;
  const server = await serve(port);
  const url = `http://localhost:${port}/`;
  const exe = process.env.CHROME_PATH || undefined;

  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  // 実際の携帯に近づけるため、CPUを4倍遅くする
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  // **起動のあいだに読んだぶんだけ**を数える。
  // タブを押した後まで数えると、その時 Service Worker が効き始めたかどうかで
  // 数字が3倍ぶれる（実際にぶれた）。ready になったら数えるのをやめる。
  let bytes = 0;
  let counting = true;
  const pendingBodies = [];
  page.on('response', (r) => {
    if (!counting) return;
    if (new URL(r.url()).port !== String(port)) return;
    pendingBodies.push(
      r
        .body()
        .then((b) => {
          bytes += b.length;
        })
        .catch(() => {})
    );
  });

  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=会社をはじめる', { timeout: 30000 });
  const splashMs = Date.now() - t0;

  await page.click('text=会社をはじめる');
  await page.waitForSelector('.nav', { timeout: 30000 });
  const readyMs = Date.now() - t0;
  counting = false;
  await Promise.all(pendingBodies);

  // 画面の切り替え（アプリ自身の計測を借りる）
  for (const tab of ['目次', '社員', '依頼', '予定', '知識', 'ホーム']) {
    await page.click(`.nav button:has-text("${tab}")`);
    await page.waitForTimeout(400);
  }
  const views = await page.evaluate(() => {
    // 会社画面の「速さの記録」と同じ集計を、そのまま読み出す
    const w = window;
    return w.__ouroPerf ? w.__ouroPerf() : null;
  });

  await browser.close();
  server.close();

  const now = {
    at: new Date().toISOString().slice(0, 10),
    表紙まで_ms: splashMs,
    使えるまで_ms: readyMs,
    // この簡易サーバーは gzip しないので、ここは**無圧縮**の実バイト数。
    // 本番（GitHub Pages）は gzip されるので、実際の通信量はこの半分以下になる。
    起動時の通信_KB_無圧縮: Math.round(bytes / 1024),
    画面切替: views,
  };

  const before = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : null;
  console.log('\n今回:', JSON.stringify(now, null, 2));
  if (before) {
    console.log('前回:', JSON.stringify(before, null, 2));
    for (const k of ['表紙まで_ms', '使えるまで_ms', '起動時の通信_KB_無圧縮']) {
      const d = now[k] - before[k];
      const sign = d > 0 ? '+' : '';
      console.log(`  ${k}: ${sign}${d}`);
    }
  }
  if (process.argv.includes('--save')) {
    writeFileSync(baselinePath, `${JSON.stringify(now, null, 2)}\n`);
    console.log(`\n${baselinePath} を更新しました。`);
  } else {
    console.log('\n（この結果を基準にする時は --save を付けて実行）');
  }
}

main();
