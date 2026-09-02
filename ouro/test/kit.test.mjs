// 型パック（売り物にする型）の決まりを機械チェックする。
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  makeKit, normalizeKit, normalizeKits, kitFromTask, runsOf, sampleFromTask,
  addSample, removeSample, bumpVersion, kitEffort, kitReady, kitLine, kitsLine, exportKit,
  slugOf, skillName, skillDescription, exportSkillMd,
  makePack, normalizePack, normalizePacks, kitsInPack, packReady, packLine, exportPack,
  SELL_MODES, MIN_RUNS, MIN_SAMPLES, MAX_SAMPLES, MAX_KITS, MAX_PACKS, MAX_PACK_KITS,
} from '../src/lib/kit.js';
import { prepublishChecks } from '../src/lib/prepublish.js';
import { createTask } from '../src/lib/workflow.js';
import { KEYS } from '../src/lib/storage.js';
import { LOADERS } from '../src/lib/preload.js';
import { makeFunnel, normalizeFunnel } from '../src/lib/funnelShape.js';
import * as funnel from '../src/lib/funnel.js';

const kit = (o) => makeKit({ title: '型', request: 'これをやって', ...o });
const runTask = (id, kitId, o = {}) => ({
  id, kitId, status: 'done', startedAt: 1000, finishedAt: 1000 + 300000, totalCost: 0.02, ...o,
});

test('題名が無ければ型にならない', () => {
  assert.equal(makeKit({}), null);
  assert.equal(makeKit({ title: '  ' }), null);
});

test('結びつきは task.kitId の片方向だけ（型に taskIds を持たない）', () => {
  const k = kit();
  assert.ok(!('taskIds' in k), '型の側に一覧を持つと、誰も更新しない列になる');
  // コメントでは「持たない」と書いてあるので、コードだけを見る
  const code = readFileSync(new URL('../src/lib/kit.js', import.meta.url), 'utf8')
    .replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/taskIds/.test(code));
  const t = createTask({ request: 'x', kitId: 'kit_1', assign: () => null });
  assert.equal(t.kitId, 'kit_1', 'createTask が kitId を仕事に残さないと回数が数えられない');
});

test('数えるのは成功だけ（失敗・中止・印つきは数えない）', () => {
  const k = kit();
  const tasks = [
    runTask('a', k.id),
    runTask('b', k.id, { status: 'failed' }),
    runTask('c', k.id, { status: 'cancelled' }),
    runTask('d', k.id, { flagged: true }),
    runTask('e', 'other'),
  ];
  assert.equal(runsOf(k, tasks).length, 1);
  assert.deepEqual(runsOf(null, tasks), []);
});

test(`${MIN_RUNS}回に足りなければ「出せる」にしない・でも止めない`, () => {
  const k = addSample(kit({ outcome: 'x' }), { id: 's1', excerpt: 'あ' });
  const two = kitReady(k, { tasks: [runTask('a', k.id), runTask('b', k.id)] });
  assert.equal(two.ready, false);
  assert.ok(two.reasons.some((r) => r.includes(`${MIN_RUNS} 回`)));
  const three = kitReady(k, { tasks: ['a', 'b', 'c'].map((i) => runTask(i, k.id)), rivalCount: 1 });
  assert.equal(three.ready, true);
  // 「出せる」になっても、質までは担保しないと必ず言う
  assert.ok(three.notes.some((n) => n.includes('中身の違う')));
});

test('見本が無い型は売り物にしない', () => {
  const k = kit({ outcome: 'x' });
  const r = kitReady(k, { tasks: ['a', 'b', 'c'].map((i) => runTask(i, k.id)) });
  assert.equal(r.ready, false);
  assert.ok(r.reasons.some((x) => x.includes('見本')));
  assert.ok(MIN_SAMPLES >= 1);
});

test('見本は④成果物の中だけから取る（枠ごと入れない）', () => {
  const text = [
    '### ①結論', 'けつろん',
    '### ②最優先', 'ゆうせん',
    '### ③あなたの判断が要ること', 'はんだん',
    '### ④成果物', 'ここが本体です。',
    '### ⑤TODO', 'todo',
  ].join('\n');
  const s = sampleFromTask({ id: 't1', title: 'x' }, text);
  assert.ok(s.excerpt.includes('ここが本体です'));
  assert.ok(!s.excerpt.includes('①結論'), '枠ごと入れると、枠を書き方のくせとして覚える');
  // 枠が無ければ全文を使う（拾えない時に空にしない）
  assert.ok(sampleFromTask({ id: 't2' }, 'ただの本文').excerpt.includes('ただの本文'));
  assert.equal(sampleFromTask({ id: 't3' }, '   '), null);
  assert.equal(sampleFromTask(null, 'x'), null);
});

test('見本の数に上限がある・外せる', () => {
  let k = kit();
  for (let i = 0; i < MAX_SAMPLES + 3; i += 1) k = addSample(k, { id: `s${i}`, excerpt: `本文${i}` });
  assert.equal(k.samples.length, MAX_SAMPLES);
  const first = k.samples[0].id;
  assert.equal(removeSample(k, first).samples.some((s) => s.id === first), false);
});

test('終わった仕事から型にすると、動いた担当がそのまま手順になる', () => {
  const task = {
    id: 't1', title: '記事を書く', request: 'AIについて書いて',
    ventureId: 'v1', genreId: 'g1', spec: { doneWhen: '出典がある' },
    steps: [[{ roleId: 'researcher' }, { roleId: 'writer' }], { roleId: 'writer' }, { roleId: 'tester', kind: 'check' }],
  };
  const k = kitFromTask(task);
  assert.deepEqual(k.steps, ['researcher', 'writer'], '重複を畳み、確認の手順は入れない');
  assert.equal(k.doneWhen, '出典がある');
  assert.equal(k.ventureId, 'v1');
  assert.equal(kitFromTask(null), null);
});

test('版を上げると、直した中身が1行残る', () => {
  const k = bumpVersion(kit(), '完成条件に出典を足した');
  assert.equal(k.version, 2);
  assert.equal(k.changelog[0].note, '完成条件に出典を足した');
  // 何も書かなくても行き止まりにしない
  assert.ok(bumpVersion(kit(), '').changelog[0].note.length > 0);
});

test('手間は実測から出す・測れていないものを0と書かない', () => {
  const k = kit();
  const e = kitEffort(k, [runTask('a', k.id), runTask('b', k.id, { startedAt: 0, finishedAt: 0 })], 155);
  assert.equal(e.runs, 2);
  assert.equal(e.timedRuns, 1);
  assert.equal(e.minutesPerRun, 5);
  const none = kitEffort(k, [runTask('a', k.id, { startedAt: 0, finishedAt: 0 })]);
  assert.strictEqual(none.minutesPerRun, null, '0分と書くと「一瞬で終わる」に見える');
  assert.strictEqual(kitEffort(k, []).yenPerRun, null);
});

test('0件の競合台帳を「空いている」と読ませない', () => {
  const r = kitReady(kit({ outcome: 'x' }), { tasks: [], rivalCount: 0 });
  assert.ok(r.notes.some((n) => n.includes('まだ見ていない')));
  const r2 = kitReady(kit({ outcome: 'x' }), { tasks: [], rivalCount: 3 });
  assert.ok(!r2.notes.some((n) => n.includes('まだ見ていない')));
});

test('5つの売り方があり、手離れするのは手順書だけ', () => {
  assert.equal(Object.keys(SELL_MODES).length, 5);
  assert.equal(SELL_MODES.guide.handsOff, true);
  for (const id of ['service', 'build', 'care', 'teach']) {
    assert.equal(SELL_MODES[id].handsOff, false, `${id} は自分の時間を使う`);
  }
  // 手離れしない売り方を選んだら、そのことを必ず伝える
  const r = kitReady(kit({ outcome: 'x', sellMode: 'care' }), { tasks: [], rivalCount: 1 });
  assert.ok(r.notes.some((n) => n.includes('そのあと面倒を見る')));
});

test('値段の表を持たない（paid.js に渡すだけ）', () => {
  const src = readFileSync(new URL('../src/lib/kit.js', import.meta.url), 'utf8');
  assert.ok(!/priceJpy|相場|円で売/.test(src.replace(/\/\/.*/g, '')));
  for (const m of Object.values(SELL_MODES)) assert.ok(!('price' in m));
});

test('書き出しに「未検証」を必ず書く／会社のデータを混ぜない', () => {
  const k = addSample(kit({ outcome: '投稿5本' }), { id: 's1', excerpt: '見本の本文' });
  const thin = exportKit(k, { tasks: [runTask('a', k.id)] });
  assert.match(thin, /未検証/);
  const full = exportKit(k, { tasks: ['a', 'b', 'c'].map((i) => runTask(i, k.id)) });
  assert.ok(!full.includes('未検証'));
  assert.match(full, /実際に回した回数/);
  assert.match(full, /見本の本文/);
  // 会社のデータを拾いに行かない（引数は型と仕事だけ）
  const src = readFileSync(new URL('../src/lib/kit.js', import.meta.url), 'utf8');
  assert.ok(!/secrets|board|memory\.notes|KEYS\./.test(src.replace(/\/\/.*/g, '')));
});

test('見本が無いまま書き出したら、書き出しにもそう書く', () => {
  const md = exportKit(kit({ outcome: 'x' }), { tasks: [] });
  assert.match(md, /見本がまだありません/);
  assert.match(md, /売り物になりません/);
});

test('出す前チェックは型を渡した時だけ増える・止めない', () => {
  const base = prepublishChecks({ text: 'ふつうの本文です。' });
  assert.equal(base.items.filter((i) => i.id.startsWith('kit')).length, 0);
  const withKit = prepublishChecks({ text: 'ふつうの本文です。', kit: kit(), kitTasks: [], rivalCount: 0 });
  const ids = withKit.items.filter((i) => i.id.startsWith('kit')).map((i) => i.id);
  assert.deepEqual(ids, ['kitRuns', 'kitSamples', 'kitMarket']);
  assert.equal(withKit.blocked, false, '止めるのは個人情報だけ');
  // 競合の件数を渡さなければ、その項目は出さない（当てずっぽうを書かない）
  const noRivals = prepublishChecks({ text: 'x', kit: kit(), kitTasks: [] });
  assert.ok(!noRivals.items.some((i) => i.id === 'kitMarket'));
});

test('件数の上限を超えて保存しない', () => {
  const many = Array.from({ length: MAX_KITS + 5 }, (_, i) => kit({ title: `k${i}` }));
  assert.equal(normalizeKits(many).length, MAX_KITS);
});

test('壊れた値でも落ちない', () => {
  assert.deepEqual(normalizeKits(null), []);
  assert.equal(normalizeKit(null), null);
  assert.equal(normalizeKit({ id: 'a' }), null);
  assert.equal(kitLine(null), '');
  assert.equal(exportKit(null), '');
  assert.match(kitsLine([], []), /まだ型がありません/);
  const k = normalizeKit({ id: 'a', title: 'x', samples: [null, {}, { id: 's', excerpt: 'あ' }], version: -3 });
  assert.equal(k.samples.length, 1);
  assert.equal(k.version, 1, '版が0や負にならない');
});

test('AIを呼ばない', () => {
  const src = readFileSync(new URL('../src/lib/kit.js', import.meta.url), 'utf8');
  const code = src.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/runtime|providers\/|fetch\(/.test(code));
});

test('保存キーと画面が登録されている', () => {
  assert.equal(KEYS.kits, 'ouro:kits');
  assert.equal(typeof LOADERS.kits, 'function', '画面の読み込みは preload.js が単一の正');
});

// ── 起動時に読む量を増やさないための切り出し ──

test('収益導線の形は funnelShape.js から読み、funnel.js からも同じものが出る', () => {
  const a = makeFunnel();
  assert.deepEqual(a, funnel.makeFunnel());
  assert.deepEqual(normalizeFunnel(null), a);
  assert.deepEqual(funnel.normalizeFunnel({ entries: [{ id: 'e1' }, null] }).entries, [{ id: 'e1' }]);
  // useStore は小さい方だけを読む（funnel.js を静的に読むと4段の定義まで起動時に入る）
  const src = readFileSync(new URL('../src/lib/useStore.js', import.meta.url), 'utf8');
  assert.ok(!/import \{[^}]*makeFunnel[^}]*\} from '\.\/funnel\.js'/.test(src));
  assert.match(src, /from '\.\/funnelShape\.js'/);
});

test('案件を作る revenue.js は押した時に読む', () => {
  const src = readFileSync(new URL('../src/lib/useStore.js', import.meta.url), 'utf8');
  assert.ok(!/^import .*from '\.\/revenue\.js'/m.test(src), '静的に読むと案件の画面が lazy でも起動時の束へ入る');
  assert.match(src, /await import\('\.\/revenue\.js'\)/);
  // 非同期になったので、呼ぶ側は await していること
  const deals = readFileSync(new URL('../src/components/Deals.jsx', import.meta.url), 'utf8');
  assert.match(deals, /await store\.addDeal\(/);
});

// ── 実際に踏んだ2つの失敗の再発防止 ──

test('型の元になった仕事は、その型が動いた1回として結びつける', () => {
  const src = readFileSync(new URL('../src/lib/useStore.js', import.meta.url), 'utf8');
  // kitFromTask のあとに、元の仕事へ kitId を書き戻していること
  assert.match(src, /kitFromTask[\s\S]{0,900}t\.id === task\.id[\s\S]{0,80}kitId: made\.id/);
  // 既に別の型に属している仕事は動かさない（1つの仕事は1つの型まで）
  assert.match(src, /if \(!task\.kitId\)/);
});

test("go('compose', arg) の arg は preset そのもの（1段包まない）", () => {
  const src = readFileSync(new URL('../src/components/Kits.jsx', import.meta.url), 'utf8');
  assert.ok(!/go\('compose', \{\s*preset:/.test(src),
    "{ preset: {...} } と包むと1段深くなり、依頼文も kitId も渡らない");
  assert.match(src, /go\('compose', \{[\s\S]{0,200}kitId: kit\.id/);
  // App 側は arg をそのまま preset に渡している、という前提の確認
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /<Compose store=\{store\} preset=\{arg \|\| \{\}\}/);
});

// ── SKILL.md の形で書き出す ──

test('英数字の名前を日本語から自動で作らない', () => {
  assert.equal(slugOf('SNS投稿の型'), 'sns', '入力そのものを整えるだけ');
  assert.equal(slugOf('日本語だけ'), '', 'ローマ字化は当てずっぽうになるのでしない');
  assert.equal(slugOf('  My Kit! '), 'my-kit');
  // 決めていない時は、型の id から**置き換えの名前**を作る（推定ではない）
  const k = makeKit({ title: '型' });
  assert.match(skillName(k), /^skill-[a-z0-9]+$/);
  assert.equal(skillName(makeKit({ title: '型', slug: 'my-kit' })), 'my-kit');
  assert.equal(skillName(null), 'skill-untitled', '壊れた値でも落ちない');
});

test('SKILL.md の形（先頭に name / description）で出る', () => {
  const k = addSample(makeKit({
    title: 'SNS投稿の型', slug: 'sns-posts', whenToUse: 'SNSの投稿をまとめて作りたいとき',
    outcome: '下書き5本', request: '5本つくって',
  }), { id: 's1', excerpt: '見本' });
  const tasks = ['a', 'b', 'c'].map((i) => ({ id: i, kitId: k.id, status: 'done' }));
  const out = exportSkillMd(k, { tasks });
  const lines = out.text.split('\n');
  assert.equal(lines[0], '---');
  assert.equal(lines[1], 'name: sns-posts');
  assert.match(lines[2], /^description: "/);
  assert.equal(lines[3], '---');
  assert.equal(out.name, 'sns-posts');
  assert.deepEqual(out.warnings, [], '揃っていれば警告は出ない');
});

test('description は「いつ使うか」から作る（何が出るかだけにしない）', () => {
  assert.match(skillDescription({ whenToUse: 'AとBのとき', outcome: 'C' }), /AとBのとき/);
  assert.match(skillDescription({ whenToUse: 'AとBのとき', outcome: 'C' }), /出てくるもの：C/);
  assert.equal(skillDescription({ outcome: 'C' }), 'C', '片方しか無ければそれを使う');
  assert.equal(skillDescription({}), '');
  assert.equal(skillDescription(null), '');
});

test('足りないものは黙って埋めず、警告に出す', () => {
  const k = makeKit({ title: '型', request: 'x' });
  const out = exportSkillMd(k, { tasks: [] });
  assert.ok(out.warnings.some((w) => w.includes('英数字の名前')));
  assert.ok(out.warnings.some((w) => w.includes('どんな時に使うか')));
  assert.ok(out.warnings.some((w) => w.includes(`${MIN_RUNS} 回`)));
  assert.ok(out.warnings.some((w) => w.includes('見本')));
  // それでも壊れないファイルが出る（行き止まりにしない）
  assert.match(out.text, /^---\nname: skill-/);
  assert.match(out.text, /未検証/);
});

test('description の改行と引用符で YAML を壊さない', () => {
  const k = makeKit({ title: '型', slug: 'x', whenToUse: '1行目\n2行目の "引用" つき' });
  const line = exportSkillMd(k, { tasks: [] }).text.split('\n')[2];
  assert.ok(!line.includes('\n'));
  assert.match(line, /^description: ".*"$/);
  assert.ok(line.includes('\\"'), '引用符を escape する');
});

// ── パック（束にして売る）──

test('パックは名前が無ければ作れない', () => {
  assert.equal(makePack({}), null);
  assert.equal(normalizePack({ id: 'p' }), null);
  assert.deepEqual(normalizePacks(null), []);
});

test('パックの一覧は商品の目次であって、同期する列ではない', () => {
  const k1 = makeKit({ title: 'A' });
  const k2 = makeKit({ title: 'B' });
  const pack = makePack({ title: 'パック', kitIds: [k1.id, k2.id, k1.id] });
  assert.equal(pack.kitIds.length, 2, '同じ型を二重に入れない');
  // 消された型は静かに落とす（無いものを目次に出さない）
  assert.deepEqual(kitsInPack(pack, [k1]).map((k) => k.title), ['A']);
  // 型の側にパックの id を持たせない
  assert.ok(!('packId' in k1) && !('packIds' in k1));
  const code = readFileSync(new URL('../src/lib/kit.js', import.meta.url), 'utf8')
    .replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/packId[s]?:/.test(code));
});

test('パックの順番は入れた順のまま（並べ替えない）', () => {
  const ks = ['A', 'B', 'C'].map((t) => makeKit({ title: t }));
  const pack = makePack({ title: 'p', kitIds: [ks[2].id, ks[0].id, ks[1].id] });
  assert.deepEqual(kitsInPack(pack, ks).map((k) => k.title), ['C', 'A', 'B']);
});

test('1つでも未検証の型が入っていたら、目次の先頭にそう書く', () => {
  const ok = addSample(makeKit({ title: 'できてる' }), { id: 's', excerpt: 'x' });
  const ng = addSample(makeKit({ title: 'まだ' }), { id: 's2', excerpt: 'y' });
  const tasks = ['a', 'b', 'c'].map((i) => ({ id: i, kitId: ok.id, status: 'done' }));
  const pack = makePack({ title: 'パック', outcome: 'できること', kitIds: [ok.id, ng.id] });
  const r = packReady(pack, { kits: [ok, ng], tasks, rivalCount: 1 });
  assert.equal(r.unverified, 1);
  assert.equal(r.ready, false);
  const out = exportPack(pack, { kits: [ok, ng], tasks });
  assert.match(out.files[0].text, /未検証/, '束にすると個々の印が埋もれるので目次に出す');
  assert.match(out.files[0].text, /※未検証（0回）/);
});

test('パックは目次と型ごとの SKILL.md を並べて出す', () => {
  const k = addSample(makeKit({ title: 'A', slug: 'a-kit' }), { id: 's', excerpt: 'x' });
  const tasks = ['a', 'b', 'c'].map((i) => ({ id: i, kitId: k.id, status: 'done' }));
  const out = exportPack(makePack({ title: 'パック', outcome: 'x', kitIds: [k.id] }), { kits: [k], tasks });
  assert.deepEqual(out.files.map((f) => f.path), ['README.md', 'a-kit/SKILL.md']);
  assert.match(out.files[1].text, /^---\nname: a-kit/);
});

test('名前がぶつかったら上書きせず番号を足す', () => {
  const a = makeKit({ title: 'A', slug: 'same' });
  const b = makeKit({ title: 'B', slug: 'same' });
  const out = exportPack(makePack({ title: 'p', kitIds: [a.id, b.id] }), { kits: [a, b], tasks: [] });
  const paths = out.files.map((f) => f.path);
  assert.equal(new Set(paths).size, paths.length, '同じ名前だと1つ消える');
  assert.ok(paths.includes('same/SKILL.md') && paths.includes('same-2/SKILL.md'));
});

test('パックにも上限がある・壊れた値で落ちない', () => {
  const ids = Array.from({ length: MAX_PACK_KITS + 5 }, (_, i) => `k${i}`);
  assert.equal(makePack({ title: 'p', kitIds: ids }).kitIds.length, MAX_PACK_KITS);
  assert.equal(normalizePacks(Array.from({ length: MAX_PACKS + 3 }, (_, i) => makePack({ title: `p${i}` }))).length, MAX_PACKS);
  assert.equal(packLine(null), '');
  assert.deepEqual(kitsInPack(null, []), []);
  assert.deepEqual(exportPack(null).files, []);
});

test('パックでも0件の競合台帳を「空いている」と読ませない', () => {
  const k = addSample(makeKit({ title: 'A' }), { id: 's', excerpt: 'x' });
  const r = packReady(makePack({ title: 'p', outcome: 'x', kitIds: [k.id] }), { kits: [k], tasks: [], rivalCount: 0 });
  assert.ok(r.notes.some((n) => n.includes('まだ見ていない')));
});

test('パックの保存キーが登録されている', () => {
  assert.equal(KEYS.packs, 'ouro:packs');
});
