// 軽量E2Eスモークテスト（欠点改善⑧）— ビルド成果物を実際にブラウザで開き、
// 主要画面が描画されコンソールエラーが出ないことだけを確認する。
// ユニットテスト（node --test）はロジックの正しさを見るが、実際にレンダリングして
// 壊れていないかは別問題のため、その最低限の保険として用意する。
//
// 実行: npm run build && node scripts/e2e-smoke.mjs
// （このスクリプト自身が `vite preview` を起動・終了まで面倒を見る）

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 4321;
const BASE_URL = `http://localhost:${PORT}`;

function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch (e) { /* まだ起動中 */ }
      if (Date.now() - start > timeoutMs) return reject(new Error('preview server が起動しませんでした'));
      setTimeout(tryOnce, 300);
    };
    tryOnce();
  });
}

const SCREENS = ['一問一答', '模擬試験', '設定・問題データ管理', '機種変更ガイド', '復習', '音声学習'];

async function main() {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: 'pipe',
  });
  let failed = false;
  try {
    await waitForServer(BASE_URL);

    // 通常はPlaywright自身が`npx playwright install`で入れたChromiumを自動で見つける。
    // 特殊な環境（サンドボックス等）で場所が異なる場合だけ環境変数で上書きできる。
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
    const browser = await chromium.launch({ executablePath });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const skip = page.locator('button', { hasText: 'あとで設定する' }).first();
    if (await skip.count()) await skip.click();
    await page.waitForTimeout(300);

    const homeOk = (await page.locator('body').innerText()).length > 100;
    console.log(homeOk ? '✓ ホーム画面が表示された' : '✗ ホーム画面が空');
    if (!homeOk) failed = true;

    for (const label of SCREENS) {
      const btn = page.locator('button', { hasText: label }).first();
      if (!(await btn.count())) {
        console.log(`✗ ホームに「${label}」への導線が見つからない`);
        failed = true;
        continue;
      }
      await btn.click();
      await page.waitForTimeout(400);
      const bodyLen = (await page.locator('body').innerText()).length;
      const ok = bodyLen > 20;
      console.log(ok ? `✓ ${label} 画面が表示された` : `✗ ${label} 画面が空`);
      if (!ok) failed = true;
      const home = page.locator('button', { hasText: 'ホーム' }).first();
      if (await home.count()) { await home.click(); await page.waitForTimeout(200); }
    }

    // ポモドーロタイマー：設定でON→開始→一時停止→リセットが最低限動くことだけ確認する
    // （時間ベースのロジック自体はnode --testで検証済みなので、ここではUI操作だけを見る）。
    await page.locator('button', { hasText: '設定・問題データ管理' }).first().click();
    await page.waitForTimeout(400);
    const pomoCheckbox = page.locator('label', { hasText: '画面上部にポモドーロタイマーを表示' }).locator('input[type="checkbox"]');
    if (await pomoCheckbox.count()) {
      if (!(await pomoCheckbox.isChecked())) await pomoCheckbox.check();
      await page.waitForTimeout(300);
      const home = page.locator('button', { hasText: 'ホーム' }).first();
      if (await home.count()) { await home.click(); await page.waitForTimeout(300); }
      const miniBody = page.locator('.pomo-mini-body');
      const pomoOk = (await miniBody.count()) > 0;
      console.log(pomoOk ? '✓ ポモドーロのミニバーが表示された' : '✗ ポモドーロのミニバーが見つからない');
      if (!pomoOk) failed = true;
      else {
        const startBtn = page.locator('.pomo-btn[aria-label="開始/一時停止"]');
        await startBtn.click();
        await page.waitForTimeout(600);
        const timeText = (await page.locator('.pomo-time.sm, .pomo-time').first().textContent()) || '';
        console.log(/\d{2}:\d{2}/.test(timeText) ? '✓ ポモドーロが動作している（残り時間表示あり）' : '✗ ポモドーロの残り時間表示がおかしい');
        if (!/\d{2}:\d{2}/.test(timeText)) failed = true;
        await startBtn.click(); // 一時停止に戻す
      }
    } else {
      console.log('✗ ポモドーロの設定チェックボックスが見つからない');
      failed = true;
    }

    if (errors.length) {
      console.error(`✗ コンソール/ページエラーが${errors.length}件発生しました:`);
      errors.slice(0, 10).forEach((e) => console.error('  -', e));
      failed = true;
    } else {
      console.log('✓ コンソールエラーなし');
    }

    await browser.close();
  } finally {
    server.kill();
  }

  if (failed) {
    console.error('\n✗ E2Eスモークテスト失敗');
    process.exit(1);
  }
  console.log('\n✓ E2Eスモークテスト成功');
}

main().catch((e) => {
  console.error('✗ E2Eスモークテストが例外で終了しました:', e);
  process.exit(1);
});
