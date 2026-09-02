import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 色を持たない（README 決まりの「見た目」）。
// お腹の記録に赤や黄を1つ入れると、それだけで「危険度」に見える。

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function hexToRgb(hex) {
  const h = hex.length === 4 ? hex.slice(1).split('').map((c) => c + c).join('') : hex.slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

test('スタイルの色は、すべて R=G=B（灰色だけ）', () => {
  const hexes = css.match(/#[0-9a-fA-F]{3,6}\b/g) || [];
  assert.ok(hexes.length > 0, '色の指定が1つも見つからないのはおかしい');
  for (const hex of hexes) {
    const [r, g, b] = hexToRgb(hex);
    assert.ok(r === g && g === b, `${hex} は灰色ではない`);
  }
});

test('rgb / rgba も R=G=B', () => {
  const rgbs = css.match(/rgba?\(([^)]+)\)/g) || [];
  for (const value of rgbs) {
    const [r, g, b] = value
      .replace(/rgba?\(|\)/g, '')
      .split(',')
      .map((n) => Number(n.trim()));
    assert.ok(r === g && g === b, `${value} は灰色ではない`);
  }
});

test('名前つきの色を使わない', () => {
  assert.doesNotMatch(css, /:\s*(red|blue|green|yellow|orange|pink|purple|crimson|tomato)\b/i);
});

test('アイコン（HTML の中の SVG）も灰色だけ', () => {
  const hexes = (html.match(/%23[0-9a-fA-F]{6}/g) || []).map((h) => `#${h.slice(3)}`);
  for (const hex of hexes) {
    const [r, g, b] = hexToRgb(hex);
    assert.ok(r === g && g === b, `${hex} は灰色ではない`);
  }
});

test('画像ファイルを読み込まない（飾りはその場に線を引く）', () => {
  assert.doesNotMatch(css, /url\((?!["']?data:)/);
  assert.doesNotMatch(css, /\.(png|jpe?g|webp|gif|svg)['")]/i);
});

test('暗い面（夜の記録用）を持っている', () => {
  assert.match(css, /prefers-color-scheme: dark/);
  assert.match(css, /\[data-theme='dark'\]/);
  // 明るい面を選んだ人が、端末の設定で暗くされないこと
  assert.match(css, /:root:not\(\[data-theme='light'\]\)/);
});
