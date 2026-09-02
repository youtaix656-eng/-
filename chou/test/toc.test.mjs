import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  foldKana,
  kanaRow,
  numberToReading,
  normalizeAlnum,
  buildKanaIndex,
  compareReading,
  readingKey,
  OTHER_ROW,
} from '../src/lib/yomi.js';
import { flashTo, shouldScrollTop, FLASH_ATTR } from '../src/lib/focus.js';
import {
  buildTocEntries,
  panelDataFor,
  resolveAlias,
  tabForTarget,
  entryMatches,
  foodTargetId,
  DESTINATION_TYPES,
  PLACEHOLDER_DESCRIPTION,
  EMPTY_DESTINATIONS_TEXT,
} from '../src/data/toc.js';
import { TERMS, SCREENS } from '../src/data/terms.js';
import { BRISTOL } from '../src/data/scales.js';
import { RED_FLAGS } from '../src/data/redFlags.js';
import { FODMAP_FOODS } from '../src/data/fodmap.js';
import { SPEED_NAMED, BAD_PAIRS, ADAMSKI_UNVERIFIED } from '../src/data/adamski.js';
import { BACTERIA, PRODUCTS, PROBIOTIC_UNVERIFIED, PROBIOTIC_CORRECTIONS } from '../src/data/probiotics.js';
import { SEASONINGS } from '../src/data/seasonings.js';
import {
  CLEANUP_STEPS,
  STRESS_RELIEF,
  POSTURE_TIPS,
  CLEANUP_CORRECTIONS,
  CLEANUP_UNVERIFIED,
} from '../src/data/cleanup.js';
import { makeCandidate, detectMarkerTerms, TRIGGERS, CANDIDATE_CHOICES } from '../src/data/tocCandidates.js';
import {
  emptyTocState,
  checkCandidate,
  acceptCandidate,
  rejectCandidate,
  undoLastTocAdditions,
  setVerified,
} from '../src/lib/tocCandidates.js';

const src = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

/**
 * コメント行を外した中身。**決まりを書いたコメント自体で落ちない**ようにするため
 * （「className に足さない」というコメントで className の不在チェックが落ちる）。
 * 行ごと落とすだけにしてあるのは、行の途中の文字列を壊さないため。
 */
const codeOf = (path) =>
  src(path)
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');

/** 素の JS のまま試験するための、document のふり */
function stubDoc(ids) {
  const els = new Map(
    ids.map((id) => [
      id,
      {
        id,
        attrs: {},
        scrolled: false,
        setAttribute(k, v) {
          this.attrs[k] = v;
        },
        removeAttribute(k) {
          delete this.attrs[k];
        },
        scrollIntoView() {
          this.scrolled = true;
        },
      },
    ]),
  );
  return { getElementById: (id) => els.get(id) || null, els };
}

// ───────────────────────── 並び順・データ構造 ─────────────────────────

test('sortsInGojuonOrder — 並びは「あ〜ん」→「A〜Z」→「その他」', () => {
  const entries = [
    { title: 'Z項目', reading: 'ZZZ' },
    { title: '読みなし', reading: '' },
    { title: 'わたし', reading: 'わたし' },
    { title: 'あさ', reading: 'あさ' },
    { title: 'Aこうもく', reading: 'ABC' },
    { title: 'なつ', reading: 'なつ' },
  ];
  const { rows, other } = buildKanaIndex(entries);
  assert.deepEqual(
    rows.map((r) => r.label),
    ['あ', 'な', 'わ', 'A', 'Z'],
  );
  assert.deepEqual(other.map((e) => e.title), ['読みなし']);
  // 行の中も読みの順
  const ka = buildKanaIndex([
    { title: 'こ', reading: 'こ' },
    { title: 'か', reading: 'か' },
    { title: 'き', reading: 'き' },
  ]).rows[0];
  assert.deepEqual(ka.items.map((e) => e.title), ['か', 'き', 'こ']);
  // 濁点・カタカナ・小書きは清音へ寄せてから比べる
  assert.equal(foldKana('ブリストル'), 'ふりすとる');
  assert.ok(compareReading('がっこう', 'かつこう') === 0);
});

test('numbersSortByReading — 数字は読みに直してから行を決める（見た目の数字順で先頭に固めない）', () => {
  assert.equal(numberToReading(20), 'にじゅう');
  assert.equal(numberToReading(361), 'さんびゃくろくじゅういち');
  assert.equal(numberToReading(7), 'なな');
  assert.equal(numberToReading(3000), 'さんぜん');
  assert.equal(numberToReading(800), 'はっぴゃく');
  // 「7段階」は な行、「361穴」は さ行、「20歳」は な行
  assert.equal(kanaRow('7だんかい'), 'na');
  assert.equal(kanaRow('361あな'), 'sa');
  assert.equal(kanaRow('20さい'), 'na');
  const { rows } = buildKanaIndex([
    { title: '7段階', reading: '7だんかい' },
    { title: 'あさ', reading: 'あさ' },
    { title: '361穴', reading: '361あな' },
  ]);
  // 数字が先頭に固まらず、読みの行へ散る
  assert.deepEqual(rows.map((r) => r.label), ['あ', 'さ', 'な']);
  // 実データのブリストルも「ぶ」→ は行（数字で先頭に来ない）
  const bristol = buildTocEntries().filter((e) => e.group === 'scale');
  assert.equal(bristol.length, BRISTOL.length);
  for (const entry of bristol) assert.equal(kanaRow(entry.reading), 'ha');
});

test('missingReadingFallsToOther — 読みが無いものは「その他」へ落ちる（推定して埋めない）', () => {
  const { rows, other } = buildKanaIndex([
    { title: '読みあり', reading: 'よみあり' },
    { title: '読み無し' },
    { title: '空の読み', reading: '   ' },
  ]);
  assert.equal(other.length, 2);
  assert.deepEqual(other.map((e) => e.title), ['読み無し', '空の読み']);
  assert.equal(rows.length, 1);
  assert.equal(kanaRow(undefined), OTHER_ROW.id);
  // 漢字だけを渡しても、読みを当てに行かない
  assert.equal(kanaRow('過敏性腸症候群'), OTHER_ROW.id);
});

test('noDuplicateTitlesInMergedToc — 統合後の目次にタイトルの重複が無い', () => {
  const entries = buildTocEntries();
  const titles = entries.map((e) => e.title);
  assert.equal(titles.length, new Set(titles).size, '重複したタイトルがあります');
  // 自分で追加したものを重ねても重複しない
  const merged = buildTocEntries({
    userTerms: [{ id: 'user-x', title: 'IBS', reading: 'IBS', aliases: [], destinations: [] }],
  });
  const mergedTitles = merged.map((e) => e.title);
  assert.equal(mergedTitles.length, new Set(mergedTitles).size);
  // 読みの入れ忘れも無い（あれば「その他」に出るので気づける）
  assert.equal(entries.filter((e) => !e.reading).length, 0);
});

test('alnumItemsNormalizeCorrectly — 英数字混じりは正規化してから A〜Z を判定する', () => {
  assert.equal(normalizeAlnum('ＦＯＤＭＡＰ'), 'FODMAP');
  assert.equal(normalizeAlnum('Ⅰ型'), 'I型');
  assert.equal(normalizeAlnum('ⅲ'), 'ⅲ'.toUpperCase());
  assert.equal(kanaRow('ＦＯＤＭＡＰ'), 'alpha-F');
  assert.equal(kanaRow('FODMAP'), 'alpha-F');
  assert.equal(kanaRow('ibs'), 'alpha-I');
  assert.equal(kanaRow('Ⅰがた'), 'alpha-I');
  // 全角と半角が別の行に分かれない
  assert.equal(kanaRow('ＩＢＳ'), kanaRow('IBS'));
});

test('otherRowCountDoesNotIncrease — 「その他」行が増えていない（読みの入れ忘れの見張り）', () => {
  const OTHER_MAX = 0; // いまは0件。増やす時は理由と一緒にこの数字を上げること
  const { other } = buildKanaIndex(buildTocEntries());
  assert.ok(other.length <= OTHER_MAX, `その他が${other.length}件あります（上限${OTHER_MAX}）`);
  // 閾値を超えたら開発中に知らせる（画面は止めない）
  let warned = null;
  buildKanaIndex([{ title: 'a' }, { title: 'b' }], { otherWarnThreshold: 1, onWarn: (m) => (warned = m) });
  assert.match(String(warned), /その他/);
});

test('tocDerivedFromSourceData — 目次は元データから導く（目次専用の手書きの一覧を作らない）', () => {
  const entries = buildTocEntries();
  for (const term of TERMS) assert.ok(entries.some((e) => e.id === term.id), term.title);
  for (const screen of SCREENS) assert.ok(entries.some((e) => e.id === screen.id), screen.title);
  for (const flag of RED_FLAGS) assert.ok(entries.some((e) => e.title === flag.title), flag.title);
  for (const food of FODMAP_FOODS) assert.ok(entries.some((e) => e.title === food.name), food.name);
  // 食べ合わせ（アダムスキー式）から来るぶん：低FODMAP に無い食べもの＋よくない組み合わせ＋裏が取れていない主張
  const fromAdamskiCount =
    SPEED_NAMED.filter((f) => !FODMAP_FOODS.some((x) => x.name === f.name)).length +
    BAD_PAIRS.length +
    ADAMSKI_UNVERIFIED.length;
  for (const claim of ADAMSKI_UNVERIFIED) assert.ok(entries.some((e) => e.title === claim.title), claim.title);
  // 整腸剤・調味料から来るぶん
  const fromCareCount =
    BACTERIA.length + PRODUCTS.length + PROBIOTIC_UNVERIFIED.length + PROBIOTIC_CORRECTIONS.length + SEASONINGS.length + 1;
  for (const b of BACTERIA) assert.ok(entries.some((e) => e.title === b.name), b.name);
  for (const s of SEASONINGS) assert.ok(entries.some((e) => e.title === `${s.title}の選び方`), s.title);
  // 腸のお掃除から来るぶん
  const fromCleanupCount =
    CLEANUP_STEPS.length +
    STRESS_RELIEF.length +
    POSTURE_TIPS.length +
    CLEANUP_CORRECTIONS.length +
    CLEANUP_UNVERIFIED.length;
  for (const step of CLEANUP_STEPS) assert.ok(entries.some((e) => e.title === step.title), step.title);
  assert.equal(
    entries.length,
    TERMS.length +
      SCREENS.length +
      BRISTOL.length +
      RED_FLAGS.length +
      FODMAP_FOODS.length +
      fromAdamskiCount +
      fromCareCount +
      fromCleanupCount,
  );
  // 元データを増やせば目次も増える（書き写していない証拠）
  const source = src('data/toc.js');
  assert.match(source, /import \{ FODMAP_FOODS/);
  assert.doesNotMatch(source, /const TOC_ENTRIES = \[/);
});

// ───────────────────────── 飛び先・ハイライト ─────────────────────────

test('flashJumpTargetsCorrectId — 指定した id の要素だけを掴んで光らせる', () => {
  const doc = stubDoc(['food-ばなな', 'food-うどん']);
  const fired = [];
  const ok = flashTo('food-ばなな', { doc, now: true, timer: (fn) => fired.push(fn) });
  assert.equal(ok, true);
  assert.equal(doc.els.get('food-ばなな').attrs[FLASH_ATTR], 'on');
  assert.equal(doc.els.get('food-ばなな').scrolled, true);
  // 他の要素には触らない
  assert.equal(doc.els.get('food-うどん').attrs[FLASH_ATTR], undefined);
  assert.equal(doc.els.get('food-うどん').scrolled, false);
  // 掴めなければ黙って成功と言わない
  assert.equal(flashTo('food-ない', { doc, now: true }), false);
  assert.equal(flashTo('', { doc, now: true }), false);
});

test('destinationButtonJumpsAndHighlights — 飛び先ボタンで飛んで光り、時間が経つと印が消える', () => {
  const entry = buildTocEntries().find((e) => e.id === 'term-bristol');
  const data = panelDataFor(entry);
  const dest = data.destinations[0];
  assert.equal(dest.targetId, 'rec-stool');
  const doc = stubDoc([dest.targetId]);
  let clear = null;
  flashTo(dest.targetId, { doc, now: true, timer: (fn) => (clear = fn) });
  assert.equal(doc.els.get(dest.targetId).attrs[FLASH_ATTR], 'on');
  clear();
  assert.equal(doc.els.get(dest.targetId).attrs[FLASH_ATTR], undefined, '時間が経ったら印は外す');
  // ボタンは押された飛び先をそのまま呼び出し側へ渡す（飛び先の仕組みを新しく作らない）
  assert.match(src('components/TermPanel.jsx'), /onClick=\{\(\) => onGo\(dest\)\}/);
  assert.match(src('components/TableOfContents.jsx'), /onGo\(dest\.view, dest\.targetId\)/);
  // 印は className ではなく属性で付ける
  assert.match(codeOf('lib/focus.js'), /setAttribute\(FLASH_ATTR/);
  assert.doesNotMatch(codeOf('lib/focus.js'), /classList|className/);
});

test('tabSwitchesBeforeFlash — 飛ぶ前にタブ・絞り込みを切り替える（useLayoutEffect）', () => {
  // 食材へ飛ぶ時は絞り込みを解いてから
  assert.deepEqual(tabForTarget('food-ばなな'), { level: 'all', query: '' });
  assert.deepEqual(tabForTarget('fodmap-source'), { level: 'all', query: '' });
  assert.deepEqual(tabForTarget('toc-candidates'), { tab: 'candidates' });
  assert.deepEqual(tabForTarget('rec-stool'), {});
  const fodmap = src('components/Fodmap.jsx');
  assert.match(fodmap, /useLayoutEffect\(\(\) => \{[\s\S]*tabForTarget\(focus\)/);
  const toc = src('components/TableOfContents.jsx');
  assert.match(toc, /useLayoutEffect\(\(\) => \{[\s\S]*tabForTarget\(focus\)/);
  // 切り替えを useEffect でやらない（描き終わる前に済ませないと飛び先がまだ無い）
  assert.doesNotMatch(fodmap, /useEffect\(\(\) => \{[\s\S]{0,200}setLevel/);
});

test('doesNotResetScrollAfterJump — 飛び先を指定した移動では画面の先頭へ戻さない', () => {
  assert.equal(shouldScrollTop('rec-stool'), false);
  assert.equal(shouldScrollTop(''), true);
  assert.equal(shouldScrollTop(undefined), true);
  const app = src('App.jsx');
  assert.match(app, /if \(shouldScrollTop\(targetId\)\) window\.scrollTo\(0, 0\);/);
  assert.doesNotMatch(app, /useEffect\([^)]*window\.scrollTo/);
});

// ───────────────────────── 詳細パネル ─────────────────────────

test('tapOpensPanelWithDescription — タップで開くパネルに説明と飛び先が出る', () => {
  const entry = buildTocEntries().find((e) => e.id === 'term-visit-note');
  const data = panelDataFor(entry);
  assert.equal(data.title, '受診メモ');
  assert.ok(data.hasDescription);
  assert.match(data.description, /記録から/);
  assert.ok(data.destinations.length >= 1);
  assert.equal(panelDataFor(null), null);
  // 画面はこの1か所から受け取る（画面ごとに条件を書かない）
  const panel = src('components/TermPanel.jsx');
  assert.match(panel, /panelDataFor\(entry\)/);
  assert.match(src('components/TableOfContents.jsx'), /setOpenId\(entry\.id\)/);
});

test('destinationButtonsRenderForEachType — 飛び先の4種すべてにボタンが出る', () => {
  assert.deepEqual(DESTINATION_TYPES, ['page', 'question', 'function', 'system']);
  const entries = buildTocEntries();
  const used = new Set(entries.flatMap((e) => (e.destinations || []).map((d) => d.type)));
  for (const type of DESTINATION_TYPES) assert.ok(used.has(type), `${type} の飛び先が1つもありません`);
  // 種類でボタンを間引かない（4種とも同じように並べる）
  const mixed = panelDataFor({
    title: 'x',
    descriptionStatus: 'verified',
    destinations: DESTINATION_TYPES.map((type) => ({ type, view: 'home', targetId: 't', label: type })),
  });
  assert.equal(mixed.destinations.length, 4);
  assert.match(src('components/TermPanel.jsx'), /data\.destinations\.map\(/);
  // 形の壊れた飛び先は落とす（押しても何も起きないボタンを出さない）
  const broken = panelDataFor({ title: 'x', destinations: [{ type: 'なぞ', view: 'home' }, { type: 'page' }] });
  assert.equal(broken.destinations.length, 0);
});

test('missingDescriptionShowsPlaceholder — 説明が空なら「※説明未登録」', () => {
  const data = panelDataFor({ title: 'x', description: '   ', destinations: [] });
  assert.equal(data.description, PLACEHOLDER_DESCRIPTION);
  assert.equal(data.hasDescription, false);
  const filled = panelDataFor({ title: 'x', description: 'ある', destinations: [] });
  assert.equal(filled.hasDescription, true);
  assert.match(src('components/TermPanel.jsx'), /data\.hasDescription \? '' : 'muted'/);
});

test('emptyDestinationsHidesButtonArea — 飛び先が無ければボタンを出さず、そう書く', () => {
  const data = panelDataFor({ title: 'x', description: 'あり', destinations: [] });
  assert.equal(data.hasDestinations, false);
  assert.equal(data.emptyDestinationsText, EMPTY_DESTINATIONS_TEXT);
  assert.equal(EMPTY_DESTINATIONS_TEXT, '関連する飛び先はありません');
  const panel = src('components/TermPanel.jsx');
  assert.match(panel, /data\.hasDestinations \? \(/);
  assert.match(panel, /emptyDestinationsText/);
});

test('needsReviewBadgeAlwaysShown — 確かめきれていない説明には必ず「※要確認」が出る', () => {
  for (const entry of buildTocEntries()) {
    const data = panelDataFor(entry);
    assert.equal(data.needsReview, entry.descriptionStatus !== 'verified', entry.title);
  }
  // 状態が入っていないものは「確かめていない」側に倒す（黙って verified にしない）
  assert.equal(panelDataFor({ title: 'x' }).needsReview, true);
  assert.equal(panelDataFor({ title: 'x', descriptionStatus: 'needs_review' }).needsReview, true);
  const panel = src('components/TermPanel.jsx');
  assert.match(panel, /data\.needsReview && <span className="badge-review">/);
  // 候補は必ず「※要確認」（会話由来のため）
  assert.match(src('components/TocCandidates.jsx'), /<span className="badge-review">\{NEEDS_REVIEW_BADGE\}<\/span>/);
});

test('verifiedOnlyByExplicitUserAction — 「確かめた」にできるのは人が明示的に押した時だけ', () => {
  const cand = makeCandidate({ trigger: 'marker', title: 'ぜん動運動', reading: 'ぜんどううんどう' });
  assert.equal(cand.descriptionStatus, 'needs_review');
  let state = { ...emptyTocState(), tocCandidates: [cand] };
  state = acceptCandidate(state, cand.id).state;
  assert.equal(state.userTerms[0].descriptionStatus, 'needs_review', '受け入れただけでは verified にしない');

  const noFlag = setVerified(state, state.userTerms[0].id, {});
  assert.equal(noFlag.ok, false);
  assert.equal(noFlag.state.userTerms[0].descriptionStatus, 'needs_review');
  const byUser = setVerified(state, state.userTerms[0].id, { byUser: true });
  assert.equal(byUser.ok, true);
  assert.equal(byUser.state.userTerms[0].descriptionStatus, 'verified');
  // 候補を作る側に verified への道を用意しない
  assert.doesNotMatch(src('data/tocCandidates.js'), /descriptionStatus: 'verified'/);
});

// ───────────────────────── 候補のながれ ─────────────────────────

test('candidateGeneratedOnlyByWhitelistedTrigger — 決めた3つの合図以外では候補を作らない', () => {
  assert.deepEqual(TRIGGERS, ['marker', 'tags', 'user_request']);
  for (const trigger of TRIGGERS) {
    assert.ok(makeCandidate({ trigger, title: 'てすと', reading: 'てすと' }), trigger);
  }
  for (const bad of ['guess', 'auto', '', undefined, null, 'conversation']) {
    assert.equal(makeCandidate({ trigger: bad, title: 'てすと' }), null, String(bad));
  }
  assert.equal(makeCandidate({ trigger: 'marker', title: '   ' }), null, '名前が無ければ作らない');
  // 「■用語追加：」の合図が無い本文からは1件も拾わない
  assert.deepEqual(detectMarkerTerms('腸内細菌の話をしました。ぜん動運動も大事です。'), []);
  assert.deepEqual(detectMarkerTerms('■用語追加：ぜん動運動\n本文\n■用語追加：腸内細菌'), ['ぜん動運動', '腸内細菌']);
  assert.deepEqual(detectMarkerTerms(null), []);
});

test('candidateNeverWritesToSourceUntilAccepted — 押すまで本体のデータに一切書き込まない', () => {
  const cand = makeCandidate({ trigger: 'tags', title: '腸内細菌', reading: 'ちょうないさいきん' });
  const state = { ...emptyTocState(), tocCandidates: [cand] };
  assert.equal(state.userTerms.length, 0);
  assert.equal(state.removedIds.length, 0);
  const before = buildTocEntries(state);
  assert.equal(before.some((e) => e.title === '腸内細菌'), false, '候補のうちは目次に出ない');
  assert.equal(before.length, buildTocEntries().length);
  // 候補は別の置き場に持つ（本体データのファイルへ書き込む口を持たない）
  assert.doesNotMatch(src('data/tocCandidates.js'), /TERMS\.push|userTerms/);
});

test('acceptedAddPassesAllRulesBeforeWrite — 「追加する」で初めて4つの確かめを通す', () => {
  const entries = buildTocEntries();
  const ok = checkCandidate(
    makeCandidate({ trigger: 'marker', title: '腸内細菌', reading: 'ちょうないさいきん' }),
    entries,
  );
  assert.deepEqual(ok.checks, { reading: true, duplicate: true, classification: true, normalization: true });
  assert.equal(ok.ok, true);

  // ① 読みが無い
  const noReading = checkCandidate(makeCandidate({ trigger: 'marker', title: '腸内細菌' }), entries);
  assert.equal(noReading.checks.reading, false);
  assert.equal(noReading.ok, false);
  // ② 名前が重なる（既存のタイトル・別名のどちらとも）
  assert.equal(checkCandidate(makeCandidate({ trigger: 'marker', title: 'IBS', reading: 'IBS' }), entries).checks.duplicate, false);
  assert.equal(
    checkCandidate(makeCandidate({ trigger: 'marker', title: '過敏性腸症候群', reading: 'かびんせい' }), entries).checks.duplicate,
    false,
    '既存の別名ともぶつけない',
  );
  // ③ 知らないまとまり
  const badGroup = { ...makeCandidate({ trigger: 'marker', title: 'あたらしい語', reading: 'あたらしいご' }), group: 'なぞ' };
  assert.equal(checkCandidate(badGroup, entries).checks.classification, false);

  // 落ちた候補は本体に入らない（状態がそのまま返る）
  const state = { ...emptyTocState(), tocCandidates: [makeCandidate({ trigger: 'marker', id: 'c1', title: '腸内細菌' })] };
  const failed = acceptCandidate(state, 'c1');
  assert.equal(failed.ok, false);
  assert.equal(failed.state, state, '落ちたら状態を変えない');
  assert.ok(failed.reasons.length >= 1);
  assert.equal(buildTocEntries(failed.state).some((e) => e.title === '腸内細菌'), false);

  // 通った候補だけが入る
  const good = { ...emptyTocState(), tocCandidates: [makeCandidate({ trigger: 'marker', id: 'c2', title: '腸内細菌', reading: 'ちょうないさいきん' })] };
  const passed = acceptCandidate(good, 'c2');
  assert.equal(passed.ok, true);
  assert.equal(passed.state.userTerms.length, 1);
  assert.equal(buildTocEntries(passed.state).some((e) => e.title === '腸内細菌'), true);
  assert.equal(passed.state.tocCandidates[0].status, 'accepted');
  assert.equal(passed.state.tocHistory.at(-1).status, 'accepted');
  assert.equal(CANDIDATE_CHOICES.add.yes, '追加する');
});

test('acceptedDeleteRemovesOnlyTarget — 「削除する」で消えるのは対象だけ', () => {
  const target = buildTocEntries().find((e) => e.id === 'term-toilet-map');
  const cand = makeCandidate({ trigger: 'user_request', action: 'delete', title: target.title, targetId: target.id });
  assert.equal(CANDIDATE_CHOICES.delete.yes, '削除する');
  const state = { ...emptyTocState(), tocCandidates: [cand] };
  const before = buildTocEntries(state);
  const after = acceptCandidate(state, cand.id);
  assert.equal(after.ok, true);
  const entries = buildTocEntries(after.state);
  assert.equal(entries.some((e) => e.id === target.id), false, '対象は消える');
  assert.equal(entries.length, before.length - 1, '巻き添えで他が消えていない');
  for (const e of before) {
    if (e.id !== target.id) assert.ok(entries.some((x) => x.id === e.id), `${e.title} が巻き添えで消えた`);
  }
  // 見つからない相手は消さない
  const ghost = makeCandidate({ trigger: 'user_request', action: 'delete', title: 'ない語', targetId: 'nope' });
  const miss = acceptCandidate({ ...emptyTocState(), tocCandidates: [ghost] }, ghost.id);
  assert.equal(miss.ok, false);
});

test('rejectedCandidateLeavesNoTrace — 「しない」を選んだものは本体に何も残さない', () => {
  const cand = makeCandidate({ trigger: 'marker', title: '腸内細菌', reading: 'ちょうないさいきん' });
  const state = { ...emptyTocState(), tocCandidates: [cand] };
  const after = rejectCandidate(state, cand.id);
  assert.equal(after.ok, true);
  assert.deepEqual(after.state.userTerms, []);
  assert.deepEqual(after.state.removedIds, []);
  assert.equal(buildTocEntries(after.state).length, buildTocEntries().length);
  assert.equal(after.state.tocCandidates[0].status, 'rejected');
  // 見送ったことは履歴にだけ残る
  const row = after.state.tocHistory.at(-1);
  assert.equal(row.status, 'rejected');
  assert.equal(row.entryId, null);
  assert.equal(row.title, '腸内細菌');
});

test('undoRemovesOnlyTargetedEntries — 直近の追加の取り消しは対象だけを外す', () => {
  let state = emptyTocState();
  const names = [['あ用語', 'あようご'], ['い用語', 'いようご'], ['う用語', 'うようご']];
  names.forEach(([title, reading], i) => {
    const c = makeCandidate({ trigger: 'marker', id: `c${i}`, title, reading });
    state = acceptCandidate({ ...state, tocCandidates: [...state.tocCandidates, c] }, `c${i}`).state;
  });
  assert.equal(state.userTerms.length, 3);

  const undone = undoLastTocAdditions(state, 2);
  assert.equal(undone.ok, true);
  assert.deepEqual(undone.undone.sort(), ['い用語', 'う用語']);
  assert.deepEqual(undone.state.userTerms.map((t) => t.title), ['あ用語'], '古いものは残す');
  // 元データの項目には触らない
  assert.equal(buildTocEntries(undone.state).length, buildTocEntries().length + 1);
  // 二度目は取り消すものが無い
  const again = undoLastTocAdditions(undone.state, 2);
  assert.equal(again.ok, true);
  assert.deepEqual(again.state.userTerms, []);
  assert.equal(undoLastTocAdditions(again.state, 2).ok, false);
  assert.equal(undoLastTocAdditions(state, 0).ok, false);
});

test('aliasesResolveToCanonicalTitle — 別名からも正式な名前に辿り着く', () => {
  const entries = buildTocEntries();
  assert.equal(resolveAlias(entries, '過敏性腸症候群'), 'IBS');
  assert.equal(resolveAlias(entries, 'フォドマップ'), 'FODMAP');
  assert.equal(resolveAlias(entries, 'ふぉどまっぷ'), 'FODMAP', '読みからも引ける');
  assert.equal(resolveAlias(entries, 'レッドフラグ'), '受診の目安');
  assert.equal(resolveAlias(entries, '受診の目安'), '受診の目安', '正式な名前はそのまま');
  assert.equal(resolveAlias(entries, 'ない語'), null, '当てずっぽうで返さない');
  // さがす時も別名で当たり、どの別名で当たったかを見せる
  const ibs = entries.find((e) => e.title === 'IBS');
  assert.deepEqual(entryMatches(ibs, '過敏性腸'), { hit: true, via: '過敏性腸症候群' });
  assert.equal(entryMatches(ibs, 'まったく別の語').hit, false);
  // 別名にも読みを持たせる（読みは推定しない）
  for (const entry of entries) {
    for (const alias of entry.aliases || []) {
      assert.ok(alias.name, entry.title);
      assert.ok(alias.reading, `${entry.title} の別名「${alias.name}」に読みがありません`);
    }
  }
});

test('食材の飛び先 id は読みから作る（一覧の並びを変えても飛び先が動かない）', () => {
  const readings = FODMAP_FOODS.map((f) => f.reading);
  assert.equal(readings.length, new Set(readings).size, '読みが重なると飛び先の id がぶつかる');
  assert.equal(foodTargetId({ reading: 'ばなな' }), 'food-ばなな');
  const entry = buildTocEntries().find((e) => e.title === 'バナナ');
  assert.equal(entry.destinations[0].targetId, 'food-ばなな');
  assert.equal(readingKey('ばなな'), 'はなな');
});
