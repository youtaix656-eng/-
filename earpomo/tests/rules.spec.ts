import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// このアプリが自分で言っている約束を、機械でチェックする。
// ⚠ 見張るのは「アプリ自身が言っていること」だけ——コメント行は落としてから見る。

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function files(dir: string, ext: string[]): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    if (ext.some((e) => name.endsWith(e))) out.push(join(ROOT, dir, name));
  }
  return out;
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
}

const LIB = files('src/lib', ['.ts']);
const DATA = files('src/data', ['.ts']);
const COMPONENTS = files('src/components', ['.tsx', '.ts']);
const ALL = [...LIB, ...DATA, ...COMPONENTS, join(ROOT, 'src/App.tsx')];

test('src/lib はネットワークに触れない（曲も記録もどこへも送らない、の根拠）', () => {
  for (const file of LIB) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const bad of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'EventSource']) {
      assert.ok(!src.includes(bad), `${file} に ${bad} がある`);
    }
  }
});

test('画面・データからも外部へ送らない・URLを書かない', () => {
  for (const file of [...DATA, ...COMPONENTS]) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const bad of ['fetch(', 'XMLHttpRequest', 'sendBeacon']) {
      assert.ok(!src.includes(bad), `${file} に ${bad} がある`);
    }
  }
  for (const file of DATA) assert.ok(!/https?:\/\//.test(readFileSync(file, 'utf8')), `${file} に URL がある`);
});

test('背景は黒固定：色を持たない（styles.css の色はすべて R=G=B）', () => {
  const css = stripComments(readFileSync(join(ROOT, 'src/styles.css'), 'utf8'));
  const hexes = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  for (const h of hexes) {
    const v = h.slice(1);
    if (v.length === 3 || v.length === 4) {
      assert.ok(v[0] === v[1] && v[1] === v[2], `色がある: ${h}`);
    } else {
      assert.ok(v.slice(0, 2).toLowerCase() === v.slice(2, 4).toLowerCase() && v.slice(2, 4).toLowerCase() === v.slice(4, 6).toLowerCase(), `色がある: ${h}`);
    }
  }
  assert.ok(!/rgb\(|hsl\(/.test(css), 'rgb()/hsl() を使わない（灰色は #xx で書く）');
  assert.ok(!/gradient|box-shadow|text-shadow/.test(css), '装飾（グラデーション・影）を持たない');
  assert.ok(/--bg:\s*#000000/.test(css), '背景は #000000');
});

test('ダーク／ライトの切り替えを持たない', () => {
  const css = readFileSync(join(ROOT, 'src/styles.css'), 'utf8');
  assert.ok(!/prefers-color-scheme/.test(css));
  assert.ok(!/data-theme/.test(css));
  for (const file of ALL) assert.ok(!/data-theme|lightMode|darkMode/.test(readFileSync(file, 'utf8')), `${file} にテーマ切替がある`);
});

test('画像・音声ファイルを持たない（アイコン以外）', () => {
  const pub = readdirSync(join(ROOT, 'public'));
  for (const name of pub) {
    assert.ok(/^icon-.*\.png$|^manifest\.webmanifest$|^sw\.js$/.test(name), `public に想定外のファイル: ${name}`);
  }
  assert.ok(!existsSync(join(ROOT, 'src/assets')), 'src/assets を持たない');
});

test('タイマーは時計を読まない（now は必ず外から渡す）・1秒ずつ減らさない', () => {
  const src = stripComments(readFileSync(join(ROOT, 'src/lib/session.ts'), 'utf8'));
  assert.ok(!src.includes('Date.now'), 'session.ts に Date.now がある');
  assert.ok(!src.includes('setInterval') && !src.includes('setTimeout'));
  assert.ok(!/remainingMs\s*-\s*1000/.test(src));
});

test('日付を UTC で読み書きしない', () => {
  for (const file of ALL) {
    const src = stripComments(readFileSync(file, 'utf8'));
    assert.ok(!src.includes('toISOString('), `${file} に toISOString がある`);
    assert.ok(!/new Date\(['"`]\d{4}-/.test(src), `${file} に new Date('YYYY-MM-DD') がある`);
  }
});

test('音を出す口は、イヤホンの確認（audioAllowed）を通ってからしか呼ばれない', () => {
  const app = stripComments(readFileSync(join(ROOT, 'src/App.tsx'), 'utf8'));
  assert.ok(app.includes('allowedRef.current') && app.includes('playSound('), 'App.tsx で確認を見てから鳴らす');
  assert.ok(/shouldPlay\s*=[^;]*headphone\.allowed/.test(app), 'BGM の再生条件に headphone.allowed が入っている');
  const bgm = stripComments(readFileSync(join(ROOT, 'src/lib/bgm.ts'), 'utf8'));
  assert.ok(!bgm.includes('autoplay'), 'bgm.ts で勝手に再生を始めない');
});

test('できないことをできるふりに書かない（イヤホン検知の但し書きが設定にある）', () => {
  const settings = readFileSync(join(ROOT, 'src/components/SettingsView.tsx'), 'utf8');
  assert.ok(settings.includes('抜き差しを直接教えてくれない'));
  assert.ok(settings.includes('アプリが生きている間だけ'));
});

test('画面に出す文にマークダウンを書かない', () => {
  for (const file of [...DATA, ...COMPONENTS]) {
    const src = stripComments(readFileSync(file, 'utf8'));
    assert.ok(!src.includes('**'), `${file} に ** がある`);
  }
});
