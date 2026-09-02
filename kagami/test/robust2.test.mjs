import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeRecord, TEXT_MAX } from '../src/lib/records.js';
import { mergeCases } from '../src/lib/personIO.js';
import { parseBackup, toBackup, mergeRecords, FORMAT } from '../src/lib/backup.js';
import { withSynonyms, matchesLoose, SYNONYMS } from '../src/lib/personSearch.js';
import { UNDO_KEEP } from '../src/lib/caseTools.js';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const src = (f) => read(`src/${f}`);

test('保存できなかったことを黙らない', () => {
  const s = src('lib/useStore.js');
  assert.match(s, /const \[saveFailed, setSaveFailed\] = useState\(false\)/);
  assert.match(s, /setSaveFailed\(!save\(persisted\)\)/);
  const app = src('App.jsx');
  assert.match(app, /store\.saveFailed &&/, '画面に出していません');
  assert.match(app, /この端末に保存できていません/);
  assert.match(app, /先に控えを取ってください/, '次にすることを書いていません');
  // **書けなかったことを飲み込まない**（手元の変数へ逃がして true を返していた）
  const st = src('lib/storage.js');
  assert.match(st, /return false;/, 'writeRaw が書けたかを返していません');
  assert.match(st, /return writeRaw\(JSON\.stringify\(state\)\);/);
});

test('取り込みで上書きしても、版と「いつ見たか」を消さない', () => {
  const mine = { id: 'a', updatedAt: 200, checkedIds: ['x'], snapshots: [{ at: 100, checkedIds: [] }], seenAt: { x: 50 } };
  const theirs = { id: 'a', updatedAt: 300, checkedIds: ['y'], snapshots: [], seenAt: { x: 900, y: 400 } };
  const out = mergeCases([mine], [theirs])[0];
  assert.equal(out.checkedIds[0], 'y', 'あとから直したほうを採っていません');
  assert.ok(out.snapshots.length >= 2, '版が消えています');
  assert.equal(out.seenAt.x, 50, '「いつ見たか」を新しい日付で上書きしています');
  assert.equal(out.seenAt.y, 400);
});

test('消したものは続けて何件か戻せる', () => {
  assert.ok(UNDO_KEEP >= 2, '1件だけだと、続けて消したとき前のが戻せなくなる');
  const s = src('lib/useStore.js');
  assert.match(s, /\[makeUndo\(gone\), \.\.\.\(s\.undoCases \|\| \[\]\)\]\.slice\(0, UNDO_KEEP\)/);
  assert.match(s, /const dismissUndo = useCallback/, '閉じる口がありません');
});

test('戻したら、そのまま続きを直せる', () => {
  assert.match(src('components/People.jsx'), /if \(back\) openCase\(back\)/, '戻しても編集中に入りません');
});

test('編集中の見立てを消しても、書きかけを捨てない', () => {
  const s = src('components/People.jsx');
  assert.match(s, /if \(editingId === c\.id\) setEditingId\(''\)/);
  assert.doesNotMatch(s, /if \(editingId === c\.id\) newCase\(\)/);
});

test('記録の本文に上限がある（丸ごと貼ったやりとりを貯めない）', () => {
  assert.ok(TEXT_MAX > 0 && TEXT_MAX <= 8000);
  const r = makeRecord({ text: 'あ'.repeat(TEXT_MAX + 500), keepRaw: true });
  assert.equal(r.text.length, TEXT_MAX);
  assert.equal(r.truncated, true, '切ったことを残していません');
  assert.equal(makeRecord({ text: 'みじかい', keepRaw: true }).truncated, false);
  assert.match(src('components/Records.jsx'), /r\.truncated &&/, '切ったことを画面に出していません');
});

test('同じ本文を二重に記録しにくくする', () => {
  const s = src('components/Check.jsx');
  assert.match(s, /const saved = savedText === text/, '記録したことを覚えていません');
  assert.match(s, /kept\.savedText = savedText/, '画面を移ると忘れます');
  assert.match(s, /同じ書き出しの記録がすでにあります/);
});

test('まるごと持ち出せる（記録も含む）', () => {
  const out = toBackup({ records: [{ id: 'r1' }], cases: [], tries: [], myHabits: [], settings: {} });
  assert.equal(out.format, FORMAT);
  assert.equal(out.records.length, 1);
  const bad = parseBackup('{}');
  assert.equal(bad.ok, false);
  assert.ok(bad.reason.includes('書き出しではないようです'));
  const ok = parseBackup(JSON.stringify(out));
  assert.equal(ok.ok, true);
  assert.equal(ok.counts.records, 1);
});

test('取り込みで、いまの記録を消さない', () => {
  assert.equal(mergeRecords([{ id: 'a' }], [{ id: 'b' }]).length, 2);
  assert.equal(mergeRecords([{ id: 'a', text: 'いま' }], [{ id: 'a', text: 'むかし' }])[0].text, 'いま');
});

test('設定に書き出しがあり、受け皿の案内が嘘にならない', () => {
  const s = src('components/Settings.jsx');
  assert.match(s, /持ち出す・取り込む/);
  assert.match(s, /書き出してコピー/);
  assert.match(s, /置き場所に気をつけてください/, '貼った文面が入ることを書いていません');
  assert.match(s, /取り込んだあとは元に戻せません/);
  assert.match(src('components/ErrorBoundary.jsx'), /設定（書き出し）へ/, '受け皿から書き出しへ行けません');
});

test('「型を読む」で開いても未読の印が消える', () => {
  assert.match(src('components/People.jsx'), /markSeen\(t\.id\); \/\/ ここで読んでも未読の印を消す/);
});

test('さがしている間は、まとまりの件数もその結果の数にする', () => {
  const s = src('components/Tactics.jsx');
  assert.match(s, /const countIn = \(catId\) =>/);
  assert.match(s, /\{countIn\(c\.id\)\}/);
});

test('ホームに見立ての件数も出す', () => {
  assert.match(src('components/Home.jsx'), /見立て\$\{cases\.length\}件/);
});

test('下部ナビで戻っただけで、調べる側を切り替えない', () => {
  const s = src('App.jsx');
  assert.match(s, /if \(arg === 'draft' \|\| arg === 'received'\) setCheckMode\(arg\)/);
  assert.doesNotMatch(s, /setCheckMode\(arg === 'draft' \? 'draft' : 'received'\)/);
});

test('型を読む枠から、選んだふるまいへ戻れる', () => {
  assert.match(src('components/People.jsx'), /選んだふるまい（\{checked\.length\}件）に戻る/);
});

test('飛び先の余白は文字の大きさに追いつく（px 決め打ちにしない）', () => {
  const css = read('src/styles.css');
  assert.match(css, /scroll-margin-top: [\d.]+rem/);
  assert.doesNotMatch(css, /scroll-margin-top: \d+px/);
});

test('当たった型から、型の一覧へ行ける', () => {
  assert.match(src('components/TacticCard.jsx'), /型の一覧で読む/);
  assert.match(src('components/Check.jsx'), /onGoTactic=\{onGoTactic\}/);
});

test('記録・出典から型へ飛べる（読めない文字にしない）', () => {
  const rec = src('components/Records.jsx');
  assert.match(rec, /<button className="chip" key=\{id\} onClick=\{\(\) => onGoTactic/);
  assert.match(rec, /onGoTactic && onGoTactic\(c\.tacticId\)/);
  assert.match(src('components/Sources.jsx'), /onGoTactic && onGoTactic\(t\.id\)/);
});

test('さがした語を消せる', () => {
  assert.match(src('components/People.jsx'), /さがした語を消す/);
});

test('記録をさがす・絞る・並べ替える・少しずつ出す', () => {
  const s = src('components/Records.jsx');
  assert.match(s, /const PAGE = 30/);
  assert.match(s, /もっと見る（残り/);
  assert.match(s, /場面で絞らない/);
  assert.match(s, /新しい順/);
  assert.match(s, /<Finder/);
});

test('どの画面にもさがす欄がある', () => {
  for (const f of ['Sources', 'Replies', 'Myths', 'Habits', 'Records']) {
    assert.match(src(`components/${f}.jsx`), /<Finder/, `${f} にさがす欄がありません`);
  }
});

test('さがす欄は0件のときに黙らない', () => {
  const s = src('components/Finder.jsx');
  assert.match(s, /見つかりませんでした/);
  assert.match(s, /件のうち/, '件数を出していません');
  assert.match(s, /aria-label=\{label\}/, 'ラベルがありません');
});

test('ふだんの言い方でも引ける（言い換えの手引き）', () => {
  assert.ok(SYNONYMS.length >= 10);
  assert.match(withSynonyms('せかす'), /急がせる/);
  assert.equal(matchesLoose('期限で急がせる', 'せかす'), true);
  assert.equal(matchesLoose('前提効果', 'せかす'), false, '関係ないものまで拾っています');
  // **新しい主張を作らない**——対応先はデータの中にある語だけ
  const data = read('src/data/tactics.js') + read('src/data/people.js') + read('src/data/replies.js');
  for (const [, words] of SYNONYMS) {
    const hit = words.split(' ').some((w) => data.includes(w));
    assert.ok(hit, `${words}: データの中に無い語を足しています`);
  }
});

test('入力欄にはラベルを付ける（入れると何の欄か分からなくなるため）', () => {
  for (const f of ['People', 'Check', 'Settings', 'Finder', 'Tactics', 'TableOfContents']) {
    const s = src(`components/${f}.jsx`);
    const inputs = (s.match(/<(input|textarea)\b/g) || []).length;
    const labels = (s.match(/aria-label=/g) || []).length + (s.match(/type="checkbox"/g) || []).length;
    assert.ok(labels >= inputs - 1, `${f}: ラベルの無い入力欄があります（${inputs} 対 ${labels}）`);
  }
});

test('横に長い表でも、左端の見出しは残す', () => {
  assert.match(read('src/styles.css'), /\.matrix tbody th \{[\s\S]*?position: sticky/);
});

test('長い文で画面が伸び続けない', () => {
  assert.match(read('src/styles.css'), /\.quote \{ max-height: \d+px; overflow: auto; \}/);
});

test('「元に戻す」は閉じられる（画面の下をずっと覆わない）', () => {
  assert.match(src('components/People.jsx'), /onDismissUndo\?\.\(\)/);
});

test('足したファイルはネットワークに触れない', () => {
  for (const f of ['lib/backup.js', 'components/Finder.jsx']) {
    assert.doesNotMatch(src(f), /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/, f);
    assert.doesNotMatch(src(f), /\(\?<[=!]/, `${f}: 後読みは古い Safari で落ちる`);
  }
});
