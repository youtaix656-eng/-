import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { pickFigureId } from '../src/lib/figure.js';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const figures = read('src/components/Figures.jsx');
const css = read('src/styles.css');

/** FIGURES の中身を、画面を動かさずに読む（JSX は node からは読めないので文字で見る） */
function entries() {
  const block = figures.slice(figures.indexOf('export const FIGURES = ['), figures.indexOf('];', figures.indexOf('export const FIGURES = [')));
  return [...block.matchAll(/\{ id: '([a-z]+)', name: '([^']+)', reading: '([^']+)', src: (\w+) \}/g)]
    .map(([, id, name, reading, src]) => ({ id, name, reading, src }));
}

test('地の面は2枚以上ある（1枚だと「開き直すと変わる」が成り立たない）', () => {
  assert.ok(entries().length >= 2, `いまは${entries().length}枚`);
});

test('id・題は重複せず、読みを持つ（目次・並びの共通ルール）', () => {
  const list = entries();
  assert.equal(new Set(list.map((f) => f.id)).size, list.length, '同じ id があります');
  assert.equal(new Set(list.map((f) => f.name)).size, list.length, '同じ題があります');
  for (const f of list) {
    assert.match(f.reading, /^[ぁ-んー]+$/, `${f.name}: 読みはひらがなだけ（推定しない）`);
    assert.ok(figures.includes(`import ${f.src} from '../assets/figures/${f.id}.webp'`), `${f.name}: 画像の読み込みがありません`);
  }
});

test('絵は焼いたものがあり、重くない（起動を遅くしない）', () => {
  let total = 0;
  for (const f of entries()) {
    const path = new URL(`../src/assets/figures/${f.id}.webp`, import.meta.url);
    assert.ok(existsSync(path), `${f.name}: 画像が焼かれていません（node tools/make-figures.mjs）`);
    total += statSync(path).size;
  }
  assert.ok(total < 400 * 1024, `全部で${Math.round(total / 1024)}KB。重すぎます`);
});

test('絵は手で塗り直さず、焼き直す（作り方が残っている）', () => {
  assert.ok(existsSync(new URL('../tools/draw-figures.js', import.meta.url)), '絵を描くもとがありません');
  assert.ok(existsSync(new URL('../tools/make-figures.mjs', import.meta.url)), '焼くものがありません');
  assert.match(figures, /tools\/make-figures\.mjs/, '焼き直し方を書いていません');
});

test('開き直すと必ず変わる（前に出したものを避ける）', () => {
  const ids = ['a', 'b', 'c'];
  for (let i = 0; i < 50; i += 1) {
    assert.notEqual(pickFigureId(ids, 'b'), 'b', '同じものが続けて出ます');
  }
  // 候補が1つしか無いときは、それを返す（行き止まりにしない）
  assert.equal(pickFigureId(['a'], 'a'), 'a');
  assert.equal(pickFigureId([], 'a'), '');
  // 前に出したものが候補に無ければ、そのまま全部から選ぶ
  assert.equal(pickFigureId(['a', 'b'], 'x', () => 0), 'a');
  assert.equal(pickFigureId(['a', 'b'], 'a', () => 0), 'b');
});

test('選び方は端まで含めて範囲に収まる', () => {
  const ids = ['a', 'b', 'c'];
  for (const r of [0, 0.4999, 0.5, 0.99999, 1]) {
    assert.ok(ids.includes(pickFigureId(ids, '', () => r)), `rand=${r} で外れました`);
  }
});

test('文字は入れない（地の絵に文字を焼き込まない）', () => {
  const gen = read('tools/draw-figures.js');
  assert.doesNotMatch(gen, /fillText|strokeText/, '絵に文字を焼き込んでいます');
  assert.match(figures, /alt=""/, '地の絵に説明を付けない（読み上げに出さない）');
});

test('地の面は操作の邪魔をしない', () => {
  assert.match(css, /\.figure-bg \{[\s\S]*?position: fixed/);
  assert.match(css, /\.figure-bg \{[\s\S]*?pointer-events: none/);
  assert.match(css, /\.figure-bg \{[\s\S]*?z-index: 0/);
  assert.match(css, /\.figure-bg img \{[\s\S]*?object-fit: cover/, '画面をおおっていません');
  assert.match(figures, /aria-hidden="true"/, '読み上げから外していません');
});

test('飾りより読みやすさを優先する（濃く敷かない）', () => {
  const m = css.match(/\.figure-bg \{[\s\S]*?opacity: ([\d.]+);/);
  assert.ok(m, '濃さの指定が見つかりません');
  assert.ok(Number(m[1]) <= 0.6, `濃すぎます（${m[1]}）。文字の下に濃く敷かない`);
  // 文字の多い下ほど薄くする
  assert.match(css, /\.figure-bg \{[\s\S]*?mask-image: linear-gradient\(to bottom/);
});

test('選んだ面を覚えておく（次に開いた時に避けるため）', () => {
  const app = read('src/App.jsx');
  assert.match(app, /pickFigureId\(FIGURES\.map\(\(f\) => f\.id\), store\.settings\.lastFigure\)/);
  assert.match(app, /setSetting\('lastFigure', figureId\)/);
  // 開くたびに1回だけ決める（描き直すたびに変わると、目がちらつく）
  assert.match(app, /const \[figureId\] = useState\(\(\) =>/);
});

test('絵を選ぶところはネットワークに触れない', () => {
  const src = read('src/lib/figure.js');
  assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage/);
  assert.doesNotMatch(src, /\(\?<[=!]/, '後読みは古い Safari で落ちる');
});
