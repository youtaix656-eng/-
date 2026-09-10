// オフィスの様子（席の絵）の決まりを機械チェックする。
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  officeLayout, officeLine, officeLegend, seatCaption, seatLook, phaseOf,
  runningSeconds, SEAT_LOOKS, SEAT_W, SEAT_H, MAX_SEATS, PER_ROW,
} from '../src/lib/office.js';
import { PRESENCE_STATES, buildPresence } from '../src/lib/presence.js';
import { ROLE_GROUPS, roleById } from '../src/data/roles.js';
import { LOADERS } from '../src/lib/preload.js';

const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const OFFICE_JSX = src('../src/components/Office.jsx');
const OFFICE_JS = src('../src/lib/office.js');
const CSS = src('../src/styles.css');
const codeOf = (t) => t.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');

const emp = (id, roleId = 'researcher') => ({ id, roleId, shortName: id.toUpperCase(), name: id });
const groups = ROLE_GROUPS.map((g) => ({ id: g.id, name: g.name }));
const groupOf = (roleId) => (roleById(roleId) || {}).group || 'knowledge';
const rowsOf = (...pairs) => pairs.map(([id, state, extra = {}]) => ({
  employee: emp(id), state, note: extra.note || '', task: extra.task || null,
}));

test('動くのは「本当にAIが動いている席」だけ', () => {
  // 実行中だけが moving
  assert.equal(seatLook('running').moving, true);
  for (const s of ['queued', 'waiting', 'held', 'stopped', 'idle']) {
    assert.equal(seatLook(s).moving, false, `${s} が動いてしまう`);
  }
  // 在席の状態はすべて見え方を持つ（足したのに描けない状態を作らない）
  for (const s of PRESENCE_STATES) {
    assert.ok(SEAT_LOOKS[s.id], `${s.id} の見え方が無い`);
  }
  // 知らない状態は「手あき」に落ちる（画面が落ちない）
  assert.equal(seatLook('なにか').motion, SEAT_LOOKS.idle.motion);
});

test('録画ではないことを画面に必ず書く', () => {
  assert.match(OFFICE_JSX, /録画ではありません/);
  assert.match(OFFICE_JSX, /本当にAIが動いている人だけ/);
  // 誰も動いていない時に黙らない・動いているように書かない
  const line = officeLine(rowsOf(['a', 'idle'], ['b', 'held']));
  assert.match(line, /動いている人はいません/);
  assert.match(line, /録画ではない/);
});

test('社員がいない時・読み込み中に言い切らない', () => {
  assert.match(officeLine([], true), /まだ社員がいません/);
  assert.match(officeLine(rowsOf(['a', 'idle']), false), /読み込み中/);
  assert.match(officeLine(null, true), /まだ社員がいません/);
});

test('乱数を使わない（描き直しても席と揺れが飛ばない）', () => {
  const code = codeOf(OFFICE_JS);
  assert.ok(!/Math\.random/.test(code), 'office.js が乱数を使っている');
  assert.ok(!/Math\.random/.test(codeOf(OFFICE_JSX)), 'Office.jsx が乱数を使っている');
  assert.equal(phaseOf('emp_1'), phaseOf('emp_1'));
  assert.notEqual(phaseOf('emp_1'), phaseOf('emp_2'));
  const p = phaseOf('emp_1');
  assert.ok(p >= 0 && p < 1);
  assert.equal(phaseOf(''), phaseOf(null), '壊れた id でも落ちない');
});

test('時計を持たない（経過時間は呼ぶ側が渡す）', () => {
  assert.ok(!/Date\.now\(\)/.test(codeOf(OFFICE_JS)), 'office.js が時計を読んでいる');
  const task = { id: 't1', steps: [{ employeeId: 'a', status: 'running', startedAt: 1000 }] };
  const rows = rowsOf(['a', 'running', { task }]);
  const seat = officeLayout(rows, groups, groupOf).islands[0].seats[0];
  assert.equal(runningSeconds(seat, 4500), 3);
  assert.strictEqual(runningSeconds(seat, 0), null, '時刻が無ければ出さない');
  assert.strictEqual(runningSeconds(seat, 500), null, '始まる前の時刻で負の秒を出さない');
  // 動いていない席には秒を出さない
  const idle = officeLayout(rowsOf(['b', 'idle']), groups, groupOf).islands[0].seats[0];
  assert.strictEqual(runningSeconds(idle, 9999), null);
  assert.strictEqual(runningSeconds(null, 1), null);
});

test('チームごとの島に分かれ、席の位置が重ならない', () => {
  const rows = [
    { employee: emp('a', 'researcher'), state: 'idle' },
    { employee: emp('b', 'writer'), state: 'idle' },
    { employee: emp('c', 'po'), state: 'idle' },
    { employee: emp('d', 'mkt_content'), state: 'idle' },
  ];
  const lay = officeLayout(rows, groups, groupOf);
  const names = lay.islands.map((i) => i.id);
  assert.ok(names.length >= 2, 'チームごとに分かれていない');
  for (const island of lay.islands) {
    const seen = new Set();
    for (const s of island.seats) {
      const key = `${s.x},${s.y}`;
      assert.ok(!seen.has(key), `${island.name} で席が重なっている`);
      seen.add(key);
      assert.ok(s.x >= 0 && s.y >= 0);
    }
    assert.ok(island.cols <= PER_ROW);
    assert.equal(island.rows, Math.ceil(island.seats.length / island.cols));
  }
  assert.ok(SEAT_W > 0 && SEAT_H > 0);
});

test('席が多すぎる時は黙って捨てず、残りの人数を出す', () => {
  const many = Array.from({ length: MAX_SEATS + 7 }, (_, i) => ({ employee: emp(`e${i}`), state: 'idle' }));
  const lay = officeLayout(many, groups, groupOf);
  assert.equal(lay.counted, MAX_SEATS);
  assert.equal(lay.hidden, 7);
  assert.match(OFFICE_JSX, /あと \{layout\.hidden\} 人/);
});

test('知らないチームの社員も席から落とさない', () => {
  const lay = officeLayout([{ employee: emp('x', 'なにか役職'), state: 'idle' }], groups, () => 'unknown');
  assert.equal(lay.counted, 1);
  assert.equal(lay.islands.length, 1);
  assert.equal(lay.islands[0].id, 'other');
});

test('動いていない人に作業内容を書かない', () => {
  const task = { id: 't', steps: [{ employeeId: 'a', status: 'running', startedAt: 1 }] };
  const run = officeLayout(rowsOf(['a', 'running', { note: '出典を確かめています', task }]), groups, groupOf)
    .islands[0].seats[0];
  assert.equal(seatCaption(run), '出典を確かめています');
  // 止まっている人には、その人の作業内容ではなく状態だけを出す
  const held = officeLayout(rowsOf(['b', 'held', { note: '本当は何かしていた' }]), groups, groupOf)
    .islands[0].seats[0];
  assert.equal(seatCaption(held), SEAT_LOOKS.held.label);
  assert.ok(!seatCaption(held).includes('本当は'));
  assert.equal(seatCaption(null), '');
});

test('凡例は在席の並び順のまま出す', () => {
  const legend = officeLegend(rowsOf(['a', 'running'], ['b', 'idle'], ['c', 'running']));
  assert.deepEqual(legend.map((l) => l.id), PRESENCE_STATES.map((s) => s.id));
  assert.equal(legend.find((l) => l.id === 'running').count, 2);
  assert.equal(legend.find((l) => l.id === 'idle').count, 1);
  assert.equal(legend.find((l) => l.id === 'held').count, 0);
  assert.deepEqual(officeLegend(null).every((l) => l.count === 0), true);
});

test('AIを呼ばない・通信しない・画像を持たない', () => {
  for (const [name, code] of [['office.js', codeOf(OFFICE_JS)], ['Office.jsx', codeOf(OFFICE_JSX)]]) {
    assert.ok(!/runtime|providers\/|fetch\(|XMLHttpRequest/.test(code), `${name} がAI・通信に触れている`);
    assert.ok(!/<img|\.png|\.jpg|\.webp|<video|background-image/.test(code), `${name} が画像・動画を持っている`);
  }
});

test('動きは CSS でやる（毎フレーム描き直さない）', () => {
  const code = codeOf(OFFICE_JSX);
  assert.ok(!/requestAnimationFrame/.test(code), 'React 側で毎フレーム描き直している');
  // 秒数だけは進むが、**その1か所だけ**（席ぜんぶを毎秒描き直さない）
  const intervals = code.split('\n').filter((l) => /setInterval/.test(l));
  assert.equal(intervals.length, 1, `setInterval は1か所だけ：${intervals.join(' / ')}`);
  assert.match(code, /function SeatSheet/);
  assert.ok(code.indexOf('setInterval') > code.indexOf('function SeatSheet'), '席の一覧側で毎秒描き直している');
});

test('重いCSSの書き方をしない・動きを止められる', () => {
  const office = CSS.slice(CSS.indexOf('.office-scroll'));
  assert.ok(!/will-change/.test(office), 'will-change を付けている（新項目19）');
  assert.ok(!/backdrop-filter/.test(office), 'backdrop-filter を付けている（新項目19）');
  assert.match(office, /prefers-reduced-motion/);
  assert.match(office, /animation: none !important/);
  // 動く状態ぶんのアニメーションが定義されている
  for (const motion of ['type', 'breathe', 'wait']) {
    assert.ok(office.includes(`.office-${motion} `), `.office-${motion} が無い`);
  }
});

test('画面が登録されている（読み込み関数は preload.js が単一の正）', () => {
  assert.equal(typeof LOADERS.office, 'function');
  assert.match(src('../src/App.jsx'), /const Office = lazy\(LOADERS\.office\)/);
  assert.match(src('../src/App.jsx'), /view === 'office'/);
  assert.match(src('../src/components/Company.jsx'), /go\('office'\)/);
});

test('本物の在席から作れる（presence.js と噛み合う）', () => {
  const employees = [emp('a', 'researcher'), emp('b', 'writer')];
  const tasks = [{
    id: 't1', status: 'running',
    steps: [
      { employeeId: 'a', status: 'running', startedAt: 1000, instruction: '調べています' },
      { employeeId: 'b', status: 'pending' },
    ],
  }];
  const rows = buildPresence(employees, tasks);
  const lay = officeLayout(rows, groups, groupOf);
  const seats = lay.islands.flatMap((i) => i.seats);
  assert.equal(seats.find((s) => s.id === 'a').moving, true);
  assert.equal(seats.find((s) => s.id === 'b').moving, false, '同じ仕事の順番待ちまで動かしている');
  assert.match(officeLine(rows), /1人 がいま手を動かして/);
});

test('席は線だけでなく面で押せる（指で押せる当たり判定）', () => {
  // 線だけを当たり判定にすると、線の上しか押せず指では実質押せない（実際に踏んだ）
  assert.match(OFFICE_JSX, /fill="transparent"/);
  const seatFn = OFFICE_JSX.split('function Seat(')[1].split('function SeatSheet')[0];
  assert.match(seatFn, /<rect[^>]*fill="transparent"/, '当たり判定の面が席の中に無い');
  // キーボードでも開ける
  assert.match(seatFn, /onKeyDown/);
  assert.match(seatFn, /tabIndex=\{0\}/);
  assert.match(seatFn, /aria-label/);
});
