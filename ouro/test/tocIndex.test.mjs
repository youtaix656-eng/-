// 目次・索引（用語・詳細パネル・候補フロー）の決まりを機械チェックする。
//
// 画面の描画そのものは node --test では動かせないので、
// **描画に関わる決まりは Toc.jsx / App.jsx のソースを見て確かめる**
// （どこを見て通したのかが分かるように、各テストで理由を書いてある）。
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

import {
  foldKana, kanaRow, numberToReading, buildKanaIndex, normalizeAlnum,
  readingInfo, compareReading, groupByBucket, BUCKETS, UNKNOWN_BUCKET, LATIN_BUCKET,
} from '../src/lib/yomi.js';
import { buildTocEntries, allTerms, filterToc, tocSections, TOC_KINDS } from '../src/data/toc.js';
import { TERMS, DESTINATION_TYPES, DESCRIPTION_STATUS, resolveAlias, resolveDestination } from '../src/data/terms.js';
import { flashTo, clearFlash, FLASH_ATTR } from '../src/lib/focus.js';
import {
  makeCandidate, checkCandidate, acceptAdd, acceptDelete, rejectCandidate,
  undoLastTocAdditions, markTermVerified, normalizeCustomTerms,
  CANDIDATE_TRIGGERS, OTHER_ROW_WARN_AT,
} from '../src/lib/tocCandidates.js';

const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const TOC_JSX = src('../src/components/Toc.jsx');
const APP_JSX = src('../src/App.jsx');
const FOCUS_JS = src('../src/lib/focus.js');
/** コメントを外したコード本体だけを見る（決まりを書いた文に当たらないように）。 */
const codeOf = (text) => text.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
const TOC_JS = src('../src/data/toc.js');

const entries = () => buildTocEntries({ employees: [], customGenres: [] });

/** 画面が無いので、詳細パネルが使うのと同じ規則で飛び先を組み立てる。 */
function destinationsOf(entry) {
  if (entry.destinations && entry.destinations.length) return entry.destinations;
  if (entry.view) return [{ type: 'page', label: 'この項目をひらく', view: entry.view, arg: entry.arg, anchor: entry.anchor }];
  return [];
}

function fakeDoc(ids = []) {
  const made = new Map();
  for (const id of ids) {
    made.set(id, {
      id,
      attrs: {},
      scrolled: false,
      setAttribute(k, v) { this.attrs[k] = v; },
      removeAttribute(k) { delete this.attrs[k]; },
      scrollIntoView() { this.scrolled = true; },
    });
  }
  return { getElementById: (id) => made.get(id) || null, el: (id) => made.get(id) };
}

// ── 並び順・データ構造（ルール1〜7・11）──────────────────────

test('sortsInGojuonOrder — あ〜ん → A〜Z → その他 の順に並ぶ', () => {
  const items = [
    { title: 'Zeta', reading: 'zeta', bucket: LATIN_BUCKET },
    { title: 'わたし', reading: 'わたし', bucket: kanaRow('わたし') },
    { title: 'あいさつ', reading: 'あいさつ', bucket: kanaRow('あいさつ') },
    { title: '謎', reading: '', bucket: UNKNOWN_BUCKET },
    { title: 'かいしゃ', reading: 'かいしゃ', bucket: kanaRow('かいしゃ') },
  ];
  const order = groupByBucket(items).map((g) => g.bucket);
  assert.deepEqual(order, ['あ', 'か', 'わ', LATIN_BUCKET, UNKNOWN_BUCKET]);
  // 枠の一覧そのものも あ〜ん → A-Z → その他 の順
  assert.equal(BUCKETS[BUCKETS.length - 2], LATIN_BUCKET);
  assert.equal(BUCKETS[BUCKETS.length - 1], UNKNOWN_BUCKET);
  // 同じ枠の中は読みの辞書順
  const kaRow = groupByBucket([
    { title: 'こ', reading: 'こころ', bucket: 'か' },
    { title: 'か', reading: 'かいしゃ', bucket: 'か' },
  ])[0];
  assert.deepEqual(kaRow.items.map((i) => i.title), ['か', 'こ']);
});

test('numbersSortByReading — 数字は読みで振り分ける（見た目の数字順で先頭に固めない）', () => {
  assert.equal(numberToReading(20), 'にじゅう');
  assert.equal(numberToReading(361), 'さんびゃくろくじゅういち');
  assert.equal(readingInfo('20歳未満').bucket, 'な');
  assert.equal(readingInfo('361穴').bucket, 'さ');
  assert.equal(readingInfo('3席').bucket, 'さ');
  // 数字ではじまる項目が先頭にまとまらないこと
  const rows = groupByBucket([
    { title: '20歳未満', ...readingInfo('20歳未満') },
    { title: 'あいさつ', ...readingInfo('あいさつ') },
  ]).map((g) => g.bucket);
  assert.deepEqual(rows, ['あ', 'な'], '数字が先頭に固まっている');
});

test('missingReadingFallsToOther — 読みが無い漢字混じりは推定せず「その他」へ落ちる', () => {
  const info = readingInfo('経絡経穴概論');
  assert.equal(info.source, 'missing');
  assert.equal(info.reading, '', '読みを勝手に作らない');
  assert.equal(info.bucket, UNKNOWN_BUCKET);
  // かなだけのものは機械変換で足りる（推定ではない）
  assert.equal(readingInfo('カタカナ').bucket, 'か');
  assert.equal(foldKana('カタカナ'), 'かたかな');
});

test('noDuplicateTitlesInMergedToc — 統合後の目次にタイトルの重複が無い', () => {
  const all = entries();
  const titles = all.map((e) => e.title);
  const dup = titles.filter((t, i) => titles.indexOf(t) !== i);
  assert.deepEqual([...new Set(dup)], [], `重複：${[...new Set(dup)].join('・')}`);
  // 用語どうしでも、用語と既存の項目どうしでも重複しない
  const termTitles = TERMS.map((t) => t.title);
  assert.equal(new Set(termTitles).size, termTitles.length);
  const ids = all.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'id も重複しない');
});

test('alnumItemsNormalizeCorrectly — 英数字混じりは正規化してから A〜Z へ入れる', () => {
  assert.equal(normalizeAlnum('ＷＨＯ'), 'WHO');
  assert.equal(normalizeAlnum('Ⅰ型'), 'I型');
  assert.equal(normalizeAlnum('e-mail 便'), 'EMAIL便');
  assert.equal(normalizeAlnum('（）・'), '', '記号だけなら空になる');
  assert.equal(readingInfo('ＷＨＯ').bucket, LATIN_BUCKET);
  assert.equal(readingInfo('Ⅰ型').bucket, LATIN_BUCKET);
  // かな・漢字は落とさない（落とすと別の項目とぶつかる）
  assert.ok(normalizeAlnum('Ⅰ型').includes('型'));
  // A-Z の枠の中でも字の順に並ぶ（全部「同じ」にならない）
  assert.ok(compareReading('who', 'zeta') < 0);
  assert.equal(compareReading('who', 'who'), 0);
});

test('otherRowCountDoesNotIncrease — 用語を足しても「その他」行が増えていない', () => {
  const index = buildKanaIndex(entries());
  assert.equal(index.otherCount, 0, `読みの入れ忘れ：${index.missing.map((m) => m.title).join('・')}`);
  assert.ok(index.otherCount <= OTHER_ROW_WARN_AT);
  // 用語はすべて読みを持っている（自動推定に頼らない）
  for (const t of TERMS) {
    assert.ok(t.reading && foldKana(t.reading), `${t.title} に読みが無い`);
  }
  // 開発時に増えたら気づけるように警告を出している（ルール11）
  assert.match(TOC_JSX, /import\.meta\.env\.DEV/);
  assert.match(TOC_JSX, /otherCount > OTHER_ROW_WARN_AT/);
  assert.match(TOC_JSX, /console\.warn/);
});

test('tocDerivedFromSourceData — 目次は元データから毎回導出する（手書きの目次を持たない）', () => {
  // 用語を1件消すと目次からも消える＝書き写しではない
  const base = entries();
  const less = buildTocEntries({ employees: [], customGenres: [], customTerms: { added: [], removed: ['venture'] } });
  assert.equal(base.length - less.length, 1);
  assert.ok(!less.some((e) => e.id === 'term:venture'));
  // 足したものも出る
  const more = buildTocEntries({
    employees: [], customGenres: [],
    customTerms: { added: [{ id: 'x', title: 'あたらしい用語', reading: 'あたらしいようご', destinations: [] }], removed: [] },
  });
  assert.ok(more.some((e) => e.title === 'あたらしい用語'));
  // toc.js に「目次専用の手書き一覧」が無いこと（元データを import して回すだけ）
  assert.match(TOC_JS, /import \{ TERMS \} from '\.\/terms\.js'/);
  assert.match(TOC_JS, /export function buildTocEntries/);
  // 呼び出し側は useMemo で包む（ルール7）
  assert.match(TOC_JSX, /useMemo\(\s*\n?\s*\(\) => buildTocEntries/);
});

// ── 飛び先（ルール8・9・10・14）─────────────────────────────

test('flashJumpTargetsCorrectId — 指定した id にだけ印が付く', () => {
  clearFlash();
  const doc = fakeDoc(['term-venture', 'other']);
  assert.equal(flashTo('term-venture', { doc, ms: 5 }), true);
  assert.equal(doc.el('term-venture').attrs[FLASH_ATTR], 'on');
  assert.equal(doc.el('other').attrs[FLASH_ATTR], undefined, '別の要素に印が付いている');
  assert.equal(doc.el('term-venture').scrolled, true);
  // 無い id では何も起きない（勝手にスクロールしない）
  assert.equal(flashTo('nope', { doc }), false);
  assert.equal(flashTo('', { doc }), false);
  clearFlash();
  assert.equal(doc.el('term-venture').attrs[FLASH_ATTR], undefined);
});

test('destinationButtonJumpsAndHighlights — 飛び先ボタンは既存の flashTo を使う', () => {
  // 印は className ではなく属性（ルール10）。class を触っていないことを見る。
  assert.equal(FLASH_ATTR, 'data-flash');
  assert.ok(!/classList|className/.test(codeOf(FOCUS_JS)), 'focus.js が className を触っている');
  assert.match(FOCUS_JS, /setTimeout/, '印を外すのは setTimeout（ルール10）');
  assert.match(FOCUS_JS, /removeAttribute\(FLASH_ATTR\)/);
  // 飛び先の仕組みを新設していない（Toc は flashTo と go を使うだけ・ルール14）
  assert.match(TOC_JSX, /import \{ flashTo \} from '\.\.\/lib\/focus\.js'/);
  assert.ok(!/scrollIntoView/.test(TOC_JSX.split('function TermPanel')[1] || ''), 'パネルが独自にスクロールしている');
  assert.match(TOC_JSX, /go\(r\.view, r\.arg \?\? null, r\.anchor \|\| null\)/);
  // App は anchor を受け取って FocusJumper へ渡す（画面をまたぐレベル2）
  assert.match(APP_JSX, /\(next, nextArg = null, anchor = null\)/);
  assert.match(APP_JSX, /<FocusJumper anchor=\{flash\}/);
  // CSS も属性で受ける
  assert.match(src('../src/styles.css'), /\[data-flash\]/);

  // 事業の中の目印は「いま実行中の事業」へ読み替える。
  // **見つからない目印を渡さない**（飛んだのに何も光らないと壊れて見える）。
  const d = { type: 'question', label: 'x', view: 'ventures', anchor: 'venture-risk' };
  assert.deepEqual(resolveDestination(d, { ventures: [] }).anchor, null, '事業が無いのに目印を渡している');
  const r = resolveDestination(d, { ventures: [{ id: 'v1', state: 'idea' }, { id: 'v2', state: 'running' }] });
  assert.equal(r.view, 'venture');
  assert.equal(r.arg, 'v2', '実行中の事業を選ばない');
  assert.equal(r.anchor, 'venture-risk');
  // 事業と関係ない飛び先はそのまま
  assert.deepEqual(resolveDestination({ type: 'page', label: 'y', view: 'kits', anchor: 'kit-runs' }, { ventures: [] }).view, 'kits');
  assert.equal(resolveDestination(null), null);
  assert.match(TOC_JSX, /resolveDestination\(d, \{ ventures: store\.ventures \|\| \[\] \}\)/);
});

test('tabSwitchesBeforeFlash — 枠の切り替えは useLayoutEffect（描く前に直す）', () => {
  assert.match(TOC_JSX, /useLayoutEffect\(\(\) => \{\s*\n\s*if \(preset\.termId && view !== 'kana'\) setView\('kana'\);/);
  // useEffect で切り替えていないこと（描き直しが flashTo より後になる）
  const bad = /useEffect\(\(\) => \{[^}]*setView\('kana'\)/s.test(TOC_JSX);
  assert.equal(bad, false, 'useEffect で枠を切り替えている');
});

test('doesNotResetScrollAfterJump — 飛んだあとに画面を先頭へ戻さない', () => {
  // 先頭へ戻すのは go() の中（操作の一部）で、目印を立てるのはそのあと。
  const goBody = APP_JSX.split('const go = useCallback(')[1].split('[view, arg]')[0];
  const scrollAt = goBody.indexOf('window.scrollTo(0, 0)');
  const flashAt = goBody.indexOf('setFlash(');
  assert.ok(scrollAt > -1 && flashAt > scrollAt, '目印を立ててから先頭へ戻している');
  // 目印を見る useEffect の中で scrollTo(0,0) を呼んでいないこと
  assert.ok(!/useEffect[^}]*scrollTo\(0, 0\)/s.test(src('../src/components/useFocusJump.js')));
  assert.ok(!/scrollTo\(0, 0\)/.test(src('../src/components/FocusJumper.jsx')));
});

// ── 詳細パネル（ルール12〜15）────────────────────────────────

test('tapOpensPanelWithDescription — 項目をタップするとパネルが開き説明が出る', () => {
  // 行のタップは画面遷移ではなくパネルを開く
  assert.match(TOC_JSX, /onClick=\{\(\) => setPicked\(it\)\}/);
  assert.match(TOC_JSX, /\{picked && \(\s*\n\s*<TermPanel/);
  assert.match(TOC_JSX, /function TermPanel\(\{ entry, store, go, onClose \}\)/);
  assert.match(TOC_JSX, /\{entry\.description\}/);
  // 目次の項目は description を運んでいる
  const venture = entries().find((e) => e.id === 'term:venture');
  assert.ok(venture && venture.description.length > 0);
  assert.equal(venture.descriptionStatus, 'verified');
});

test('destinationButtonsRenderForEachType — 4つの種類すべてにボタンが出る', () => {
  const types = new Set(TERMS.flatMap((t) => (t.destinations || []).map((d) => d.type)));
  assert.deepEqual([...types].sort(), Object.keys(DESTINATION_TYPES).sort());
  // 種類を知らない値は使わない
  for (const t of TERMS) {
    for (const d of t.destinations || []) {
      assert.ok(DESTINATION_TYPES[d.type], `${t.title}：知らない種類 ${d.type}`);
      assert.ok(d.label, `${t.title}：ボタンの文字が無い`);
    }
  }
  // パネルは飛び先ごとにボタンを描く
  assert.match(TOC_JSX, /dests\.map\(\(d, i\) => \(/);
  assert.match(TOC_JSX, /DESTINATION_TYPES\[d\.type\]/);
});

test('missingDescriptionShowsPlaceholder — 説明が空なら「※説明未登録」と出す', () => {
  assert.match(TOC_JSX, /※説明未登録/);
  assert.match(TOC_JSX, /\{entry\.description \? \(/);
  // 空の説明を勝手に埋めていないこと（作り話を書かない）
  const empty = { id: 'x', title: 'x', description: '', destinations: [], view: null };
  assert.deepEqual(destinationsOf(empty), []);
});

test('emptyDestinationsHidesButtonArea — 飛び先が無ければボタンを出さず、そう伝える', () => {
  assert.match(TOC_JSX, /関連する飛び先はありません。/);
  const none = { id: 'x', title: 'x', destinations: [], view: null };
  assert.equal(destinationsOf(none).length, 0);
  // 用語以外は元から1つ飛び先を持つので、そちらは出る（行き止まりを作らない）
  const role = entries().find((e) => e.kind === 'role');
  assert.equal(destinationsOf(role).length, 1);
  assert.equal(destinationsOf(role)[0].view, 'employees');
});

test('needsReviewBadgeAlwaysShown — 要確認の説明には必ず「※要確認」を出す', () => {
  assert.equal(DESCRIPTION_STATUS.needs_review.badge, '※要確認');
  assert.equal(DESCRIPTION_STATUS.verified.badge, '');
  assert.match(TOC_JSX, /\{status\.badge\}/);
  // 候補の一覧でも必ず出す（押す前に確かめてもらうため）
  assert.match(TOC_JSX.split('function Candidates')[1], /※要確認/);
  // 会話から来たものは、どう作っても needs_review になる
  const c = makeCandidate({ title: 'あ', trigger: 'user', descriptionStatus: 'verified' });
  assert.equal(c.descriptionStatus, 'needs_review', '渡された値で上書きされている');
});

test('verifiedOnlyByExplicitUserAction — 確認済みにできるのは人が押した時だけ', () => {
  const c = makeCandidate({ title: 'あたらしい', reading: 'あたらしい', trigger: 'user' });
  const r = acceptAdd(c, { customTerms: null, candidates: [c], history: [] });
  assert.equal(r.ok, true);
  assert.equal(r.terms.added[0].descriptionStatus, 'needs_review', '追加しただけで確認済みにしない');
  const after = markTermVerified(r.terms.added[0].id, { customTerms: r.terms });
  assert.equal(after.added[0].descriptionStatus, 'verified');
  // 画面のボタンからしか呼べない（自動で呼ぶ場所が無い）
  assert.match(TOC_JSX, /store\.verifyTerm\(/);
  const store = src('../src/lib/useStore.js');
  assert.match(store, /const verifyTerm = useCallback/);
  // 呼んでいるのは verifyTerm の中の1か所だけ（import 行は数えない）
  const calls = codeOf(store).split('\n').filter((l) => /markTermVerified\(/.test(l) && !/^\s*(import|const \{)/.test(l));
  assert.equal(calls.length, 1, `markTermVerified を他からも呼んでいる：${calls.join(' / ')}`);
  // **名前を knowledge.js の markVerified とぶつけない**（層が違う。項目162と同じ線）
  const cand = codeOf(src('../src/lib/tocCandidates.js'));
  assert.ok(!/export function markVerified\b/.test(cand), 'knowledge.js と同じ名前を輸出している');
});

test('aliasesResolveToCanonicalTitle — 別名から正式な題名に戻る', () => {
  assert.equal(resolveAlias('OODA'), '回し方');
  assert.equal(resolveAlias('ooda'), '回し方', '大文字小文字を問わない');
  assert.equal(resolveAlias('ライバル'), '競合台帳');
  assert.equal(resolveAlias('事業'), '事業', '正式な題名そのものも通る');
  assert.equal(resolveAlias('存在しない語'), null);
  assert.equal(resolveAlias(''), null);
  // 目次の検索も別名で当たる
  const all = entries();
  assert.ok(filterToc(all, { query: 'OODA' }).some((e) => e.title === '回し方'));
  assert.ok(filterToc(all, { query: 'BYOK' }).length > 0);
});

// ── 候補フロー（ルール16〜24）───────────────────────────────

test('candidateGeneratedOnlyByWhitelistedTrigger — 3つの合図以外では候補が生まれない', () => {
  assert.deepEqual(Object.keys(CANDIDATE_TRIGGERS).sort(), ['marker', 'tags', 'user']);
  for (const t of ['marker', 'tags', 'user']) {
    assert.ok(makeCandidate({ title: 'あ', trigger: t }), `${t} で作れない`);
  }
  for (const t of ['chat', 'auto', '', null, undefined, 'ai']) {
    assert.equal(makeCandidate({ title: 'あ', trigger: t }), null, `${t} で作れてしまう`);
  }
  // 題名が無ければ作らない
  assert.equal(makeCandidate({ title: '  ', trigger: 'user' }), null);
  // 出どころを必ず残す（ルール18）
  const c = makeCandidate({ title: 'あ', trigger: 'marker', conversationId: 'conv1' });
  assert.equal(c.addedFrom.trigger, 'marker');
  assert.equal(c.addedFrom.conversationId, 'conv1');
  assert.ok(c.addedFrom.date > 0);
  assert.equal(c.status, 'pending');
  assert.ok(['add', 'delete'].includes(c.action));
});

test('candidateNeverWritesToSourceUntilAccepted — 押すまで本体データに書かない', () => {
  const c = makeCandidate({ title: 'まだ入れない', reading: 'まだいれない', trigger: 'user' });
  // 候補を作っただけでは用語は増えない
  assert.equal(allTerms(null).length, TERMS.length);
  assert.equal(allTerms({ added: [], removed: [] }).some((t) => t.title === 'まだ入れない'), false);
  assert.ok(!entries().some((e) => e.title === 'まだ入れない'));
  // 保存先が分かれている（候補は別置き場）
  const storage = src('../src/lib/storage.js');
  assert.match(storage, /tocCandidates: 'ouro:tocCandidates'/);
  assert.match(storage, /terms: 'ouro:terms'/);
  // 反映は「押した時」だけ（decideTocCandidate の中でしか terms を書かない）
  const store = src('../src/lib/useStore.js');
  const writes = (store.match(/put\(KEYS\.terms,/g) || []).length;
  assert.ok(writes > 0);
  const inDecide = store.split('const decideTocCandidate')[1].split('const undoTocAdditions')[0];
  assert.match(inDecide, /if \(r\.ok\) put\(KEYS\.terms, r\.terms\)/);
  assert.equal(c.status, 'pending');
});

test('acceptedAddPassesAllRulesBeforeWrite — 追加を押した時に4つの確かめを通す', () => {
  const ok = makeCandidate({ title: 'あたらしい用語', reading: 'あたらしいようご', trigger: 'user' });
  const checked = checkCandidate(ok);
  assert.deepEqual(checked.checks.map((c) => c.id), ['reading', 'duplicate', 'kind', 'normalize']);
  assert.equal(checked.ok, true);

  // ① 読みが無ければ通さない
  const noRead = makeCandidate({ title: '漢字だけ', trigger: 'user' });
  assert.equal(checkCandidate(noRead).checks.find((c) => c.id === 'reading').ok, false);
  // ② 重複は通さない（別名ともぶつからない）
  assert.equal(checkCandidate(makeCandidate({ title: '事業', reading: 'じぎょう', trigger: 'user' })).checks.find((c) => c.id === 'duplicate').ok, false);
  assert.equal(checkCandidate(makeCandidate({ title: 'OODA', reading: 'うーだ', trigger: 'user' })).checks.find((c) => c.id === 'duplicate').ok, false);
  // ③ 知らない飛び先の種類は通さない
  const badDest = { ...ok, destinations: [{ type: 'unknown', label: 'x' }] };
  assert.equal(checkCandidate(badDest).checks.find((c) => c.id === 'kind').ok, false);
  // ④ 記号だけの題名は通さない
  assert.equal(checkCandidate({ ...ok, title: '（）・' }).checks.find((c) => c.id === 'normalize').ok, false);

  // 通らなかった時は**1文字も書かない**（履歴には「止めた」が残る）
  const dup = makeCandidate({ title: '事業', reading: 'じぎょう', trigger: 'user' });
  const blocked = acceptAdd(dup, { customTerms: null, candidates: [dup], history: [] });
  assert.equal(blocked.ok, false);
  assert.deepEqual(blocked.terms, { added: [], removed: [] });
  assert.equal(blocked.history[0].result, 'blocked');
  assert.ok(blocked.reason.length > 0);

  // 通った時だけ本体データへ入る
  const added = acceptAdd(ok, { customTerms: null, candidates: [ok], history: [] });
  assert.equal(added.ok, true);
  assert.equal(added.terms.added.length, 1);
  assert.equal(added.candidates.find((c) => c.id === ok.id).status, 'accepted');
  assert.equal(added.history[0].result, 'added');
  const before = entries().length;
  const after = buildTocEntries({ employees: [], customGenres: [], customTerms: added.terms }).length;
  assert.equal(after, before + 1, `目次に反映されていない（${before} → ${after}）`);
});

test('acceptedDeleteRemovesOnlyTarget — 削除は対象の1件だけを外す', () => {
  const c = makeCandidate({ title: '事業', termId: 'venture', action: 'delete', trigger: 'user' });
  const before = allTerms(null).length;
  const r = acceptDelete(c, { customTerms: null, candidates: [c], history: [] });
  assert.equal(r.ok, true);
  const after = allTerms(r.terms);
  assert.equal(after.length, before - 1);
  assert.equal(after.some((t) => t.id === 'venture'), false);
  // ほかは1件も減っていない
  for (const t of TERMS) {
    if (t.id === 'venture') continue;
    assert.ok(after.some((x) => x.id === t.id), `${t.title} まで消えている`);
  }
  assert.equal(r.history[0].result, 'removed');
  // 対象が決まっていなければ何もしない
  const noTarget = makeCandidate({ title: 'x', action: 'delete', trigger: 'user' });
  const r2 = acceptDelete(noTarget, { customTerms: null, candidates: [], history: [] });
  assert.equal(r2.ok, false);
  assert.deepEqual(r2.terms, { added: [], removed: [] });
});

test('rejectedCandidateLeavesNoTrace — 「しない」は本体データに一切影響しない', () => {
  const add = makeCandidate({ title: '入れない用語', reading: 'いれないようご', trigger: 'tags' });
  const cur = { added: [{ id: 'keep', title: 'のこす', reading: 'のこす', destinations: [] }], removed: ['venture'] };
  const r = rejectCandidate(add, { customTerms: cur, candidates: [add], history: [] });
  assert.deepEqual(r.terms, normalizeCustomTerms(cur), '本体データが変わっている');
  assert.equal(r.candidates.find((c) => c.id === add.id).status, 'rejected');
  // 目次にも出ない
  assert.ok(!buildTocEntries({ employees: [], customGenres: [], customTerms: r.terms }).some((e) => e.title === '入れない用語'));
  // 見送ったことは履歴には残る（ルール23）
  assert.equal(r.history[0].result, 'rejected');
  assert.equal(r.history[0].title, '入れない用語');
});

test('undoRemovesOnlyTargetedEntries — 取り消すのは直近の追加ぶんだけ', () => {
  const mk = (t) => makeCandidate({ title: t, reading: foldKana(t), trigger: 'user' });
  let terms = null;
  let history = [];
  for (const t of ['あいうえ', 'かきくけ', 'さしすせ']) {
    const c = mk(t);
    const r = acceptAdd(c, { customTerms: terms, candidates: [c], history });
    assert.equal(r.ok, true, `${t} が入らない`);
    terms = r.terms;
    history = r.history;
  }
  // 削除も1件混ぜておく（巻き戻してはいけないもの）
  const del = makeCandidate({ title: '事業', termId: 'venture', action: 'delete', trigger: 'user' });
  const dr = acceptDelete(del, { customTerms: terms, candidates: [del], history });
  terms = dr.terms;
  history = dr.history;

  assert.equal(terms.added.length, 3);
  const u = undoLastTocAdditions(1, { customTerms: terms, history });
  assert.equal(u.undone.length, 1);
  assert.equal(u.terms.added.length, 2);
  assert.deepEqual(u.terms.added.map((t) => t.title), ['あいうえ', 'かきくけ'], '古いほうまで消えている');
  assert.deepEqual(u.terms.removed, ['venture'], '削除まで巻き戻している');
  assert.equal(u.history[0].result, 'undone');

  // 2件まとめて
  const u2 = undoLastTocAdditions(2, { customTerms: terms, history });
  assert.equal(u2.terms.added.length, 1);
  assert.deepEqual(u2.terms.added.map((t) => t.title), ['あいうえ']);
  // 0件・取り消すものが無い時は何もしない
  assert.deepEqual(undoLastTocAdditions(0, { customTerms: terms, history }).undone, []);
  assert.deepEqual(undoLastTocAdditions(5, { customTerms: { added: [], removed: [] }, history: [] }).undone, []);
});

test('目次の分類に用語が入り、AIを呼ばない', () => {
  assert.ok(TOC_KINDS.some((k) => k.id === 'term'));
  const byKind = new Map();
  for (const e of entries()) byKind.set(e.kind, (byKind.get(e.kind) || 0) + 1);
  assert.equal(byKind.get('term'), TERMS.length);
  for (const f of ['../src/data/terms.js', '../src/lib/tocCandidates.js', '../src/lib/focus.js', '../src/lib/yomi.js']) {
    const code = src(f).replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/runtime|providers\/|fetch\(/.test(code), `${f} がAI・通信に触れている`);
  }
});

test('セクション分けは目次でもそのまま使える', () => {
  const secs = tocSections(entries());
  assert.ok(secs.length > 0);
  const order = secs.map((s) => s.bucket);
  assert.deepEqual(order, BUCKETS.filter((b) => order.includes(b)), '枠の順番が共通ルールと違う');
});
