import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { normalizeCase, NOTE_MAX, LABEL_MAX } from '../src/lib/cases.js';
import { parseImport, mergePersonView, FORMAT } from '../src/lib/personIO.js';
import { untried, makeTry } from '../src/lib/tried.js';
import { PERSON_TYPES } from '../src/data/people.js';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const src = (f) => read(`src/${f}`);

test('欄の足りない見立てでも、画面が触れる形になる（落とさない）', () => {
  const c = normalizeCase({ id: 'z' });
  for (const k of ['label', 'note', 'nextAction', 'sceneId', 'status', 'nextMeetAt']) {
    assert.equal(typeof c[k], 'string', `${k} が文字列ではありません`);
  }
  assert.ok(Array.isArray(c.checkedIds));
  assert.ok(Array.isArray(c.snapshots));
  assert.equal(typeof c.seenAt, 'object');
  assert.equal(typeof c.stage, 'number');
  assert.equal(typeof c.createdAt, 'number');
  assert.equal(typeof c.updatedAt, 'number');
});

test('id の無いものは見立てにしない', () => {
  assert.equal(normalizeCase({}), null);
  assert.equal(normalizeCase(null), null);
});

test('形の壊れた値を、そのまま画面へ渡さない', () => {
  const c = normalizeCase({
    id: 'z', checkedIds: 'これは配列ではない', snapshots: 3, seenAt: [1, 2],
    stage: 'つよい', nextMeetAt: 'きのう', note: 42,
  });
  assert.deepEqual(c.checkedIds, []);
  assert.deepEqual(c.snapshots, []);
  assert.deepEqual(c.seenAt, {});
  assert.equal(c.stage, 0);
  assert.equal(c.nextMeetAt, '', '日付として読めないものを残さない');
  assert.equal(c.note, '');
});

test('取り込みも同じ形にそろえてから返す', () => {
  const r = parseImport(JSON.stringify({ format: FORMAT, cases: [{ id: 'z' }] }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.cases[0].checkedIds, []);
  assert.equal(r.cases[0].note, '');
});

test('取り込みで、しぼり込みと隠した手も受け取る', () => {
  const r = parseImport(JSON.stringify({
    format: FORMAT, cases: [], tries: [], myHabits: [],
    personView: { scene: 'work', hiddenByType: { unstable_words: ['deadline'] } },
  }));
  assert.equal(r.personView.scene, 'work');
  assert.deepEqual(r.personView.hiddenByType.unstable_words, ['deadline']);
});

test('しぼり込みを混ぜても、いまのものを消さない', () => {
  const mine = { hiddenByType: { a: ['x'] }, filters: [{ name: '職場' }] };
  const out = mergePersonView(mine, { hiddenByType: { a: ['y'], b: ['z'] }, filters: [{ name: '家' }] });
  assert.deepEqual(out.hiddenByType.a.sort(), ['x', 'y']);
  assert.deepEqual(out.hiddenByType.b, ['z']);
  assert.deepEqual(out.filters.map((f) => f.name).sort(), ['家', '職場'].sort());
});

test('取り込むものが無ければ、いまのしぼり込みをそのまま返す', () => {
  const mine = { hiddenByType: { a: ['x'] } };
  assert.equal(mergePersonView(mine, null), mine);
});

test('「まだ試していない手」は見立てごとに数える', () => {
  const counters = PERSON_TYPES[0].counters;
  const tries = [makeTry({ tacticId: counters[0].tacticId, caseId: 'c1', result: 'ok' })];
  assert.equal(untried(counters, tries, 'c1').length, counters.length - 1);
  assert.equal(untried(counters, tries, 'c2').length, counters.length, 'ほかの人の記録を数えています');
  assert.equal(untried(counters, tries).length, counters.length - 1, '見立てを渡さなければ今までどおり');
});

test('消したものを端末に残さない（undoCases は保存に混ぜない）', () => {
  const s = src('lib/useStore.js');
  assert.match(s, /const \{ undoCases, \.\.\.persisted \} = state;/, '消したものを保存から外していません');
  assert.match(s, /setSaveFailed\(!save\(persisted\)\)/, '保存できたかを見ていません');
});

test('隠した手は型ごとに持つ（型をまたいで消さない）', () => {
  const s = src('lib/useStore.js');
  assert.match(s, /hiddenByType/);
  assert.doesNotMatch(src('components/People.jsx'), /personView\.hidden\b/, '型をまたぐ hidden を読んでいます');
});

test('隠した手を「まず1つ」「今日試す1つ」で勧めない', () => {
  const s = src('components/People.jsx');
  assert.match(s, /const first = useMemo\(\(\) => firstMove\(visibleMatches\)/);
  assert.match(s, /hiddenByType\[t\.id\] \|\| \[\]\)\.includes/, '今日試す1つが隠した手を外していません');
});

test('「新しく作る」で前の人の欄を残さない', () => {
  const fn = src('components/People.jsx').split('function newCase()')[1].split('function save()')[0];
  for (const setter of ['setStage(0)', "setStatus('open')", "setNextAction('')", "setNextMeetAt('')"]) {
    assert.ok(fn.includes(setter), `newCase が ${setter} を呼んでいません`);
  }
});

test('ひとことは手ごとに持ち、カードを閉じても消えない', () => {
  const s = src('components/CounterList.jsx');
  assert.match(s, /const memoOf = \(id\) => box\[`\$\{type\.id\}:\$\{id\}`\]/, '手ごとに持っていません');
  assert.match(s, /note: memoOf\(c\.tacticId\)/);
  assert.match(src('components/People.jsx'), /kept\.memos/, '画面をまたいで覚えていません');
});

test('消す操作には必ず確認を出す', () => {
  assert.match(src('components/Records.jsx'), /confirmId === r\.id/, '記録の削除に確認がありません');
  assert.match(src('components/People.jsx'), /confirmTry === t\.id/, 'やってみた記録の削除に確認がありません');
  assert.match(src('components/People.jsx'), /confirmDelete === c\.id/);
  assert.match(src('components/Settings.jsx'), /confirming \?/);
});

test('やってみた記録を消せる口がある（作った記録は必ず消せる）', () => {
  assert.match(src('components/People.jsx'), /onRemoveTry\?\.\(t\.id\)/);
  assert.match(src('App.jsx'), /onRemoveTry=\{store\.removeTry\}/);
});

test('「すべて消す」は、実際に消えるものを全部書く', () => {
  const s = src('components/Settings.jsx');
  for (const word of ['やってみた記録', '自分に当てはまる癖', 'しぼり込み', '設定']) {
    assert.ok(s.includes(word), `確認文に「${word}」がありません`);
  }
});

test('何も入っていないのに「約1KB」と書かない', () => {
  const s = src('components/Settings.jsx');
  assert.match(s, /if \(!bytes\) return 'まだ何も入っていません'/);
  assert.doesNotMatch(s, /Math\.max\(1,/);
});

test('落ちても行き止まりにしない（受け皿がある）', () => {
  const s = src('App.jsx');
  assert.match(s, /<ErrorBoundary/);
  assert.match(s, /viewKey=\{view\}/, '画面を移っても出しっぱなしになります');
  const eb = src('components/ErrorBoundary.jsx');
  assert.match(eb, /getDerivedStateFromError/);
  assert.match(eb, /ホームへもどる/);
  assert.match(eb, /データは消していません/, '勝手に消したと誤解させない一言がありません');
});

test('画面を移っても書きかけを捨てない', () => {
  assert.match(src('App.jsx'), /const uiRef = useRef\(\{\}\)/);
  for (const [f, key] of [
    ['components/Check.jsx', 'ui.check'],
    ['components/People.jsx', 'ui.people'],
    ['components/Tactics.jsx', 'ui.tactics'],
    ['components/TableOfContents.jsx', 'ui.toc'],
  ]) {
    assert.ok(src(f).includes(key), `${f} が書きかけを覚えていません`);
  }
});

test('書きかけは端末に保存しない（貼った文面は残さないという約束）', () => {
  // uiRef は React の中だけ。storage を触っていないこと
  assert.doesNotMatch(src('App.jsx'), /localStorage|storage\.js/);
  assert.doesNotMatch(src('components/Check.jsx'), /localStorage|storage\.js/);
});

test('日付は Date に通さずに表記へ直す（UTC で前日にならない）', () => {
  const s = src('components/People.jsx');
  assert.match(s, /function showDate\(value\)/);
  assert.doesNotMatch(s, /new Date\('/);
  assert.doesNotMatch(s, /toISOString\(\)/);
});

test('目次の飛び先は目次が持っているものを使う（画面側で組み立て直さない）', () => {
  assert.match(src('App.jsx'), /setFocusAnchor\(entry\.anchor \|\| ''\)/);
  for (const f of ['Tactics', 'Replies', 'Sources', 'Myths', 'Habits', 'People']) {
    assert.match(src(`components/${f}.jsx`), /useFocusJump\((anchor|tocAnchor) \|\|/, `${f} が目次の飛び先を使っていません`);
  }
});

test('飛び先が固定バーの下に隠れない', () => {
  assert.match(read('src/styles.css'), /scroll-margin-top/);
});

test('「元に戻す」は、いる場所に出す（画面の上に置かない）', () => {
  assert.match(read('src/styles.css'), /\.undo-bar \{[\s\S]*?position: fixed/);
  assert.match(src('components/People.jsx'), /className="undo-bar"/);
});

test('型の一覧にもさがす欄がある', () => {
  const s = src('components/Tactics.jsx');
  assert.match(s, /型をさがす/);
  assert.match(s, /matchesLoose/);
  assert.match(s, /見つかりませんでした/, '0件のときに黙っています');
});

test('絞り込んだら件数の表示も変わる', () => {
  assert.match(src('components/TableOfContents.jsx'), /entries\.length === TOC_ENTRIES\.length/);
  assert.match(src('components/Tactics.jsx'), /件のうち <strong>\{shown\.length\}件<\/strong>/);
});

test('記録に残したあと、場面を選び直せる', () => {
  assert.match(src('components/Check.jsx'), /setSavedText\(''\); \/\/ 場面を選び直したら記録し直せる/);
});

test('「短すぎる」の数え方を画面に出す', () => {
  assert.match(src('components/Check.jsx'), /空白を除いて\{MIN_TEXT\}文字以上/);
  assert.match(src('components/Check.jsx'), /いまは\{result\.length\}文字ぶん/);
});

test('直したファイルはネットワークに触れない', () => {
  for (const f of ['lib/cases.js', 'lib/personIO.js', 'lib/tried.js', 'lib/useStore.js']) {
    assert.doesNotMatch(src(f), /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/, `${f}`);
  }
});

test('後読み（lookbehind）を使わない', () => {
  const walk = (dir) => {
    for (const e of readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${dir}/${e.name}`);
      else if (/\.jsx?$/.test(e.name)) {
        assert.doesNotMatch(read(`${dir}/${e.name}`), /\(\?<[=!]/, `${dir}/${e.name}`);
      }
    }
  };
  walk('src');
});
