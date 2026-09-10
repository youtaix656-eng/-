// 目次・索引の決まりを機械チェックする。
//
// 画面（.tsx）は node --test から読み込めないので、
//   - 判断はすべて lib/ の純粋な関数に出してあり、それを直に試す
//   - 画面にしか書けない約束（useLayoutEffect で切り替える・className で光らせない）は
//     ソースの字面を見て確かめる
// という二段構えにしてある。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  buildKanaIndex, readingInfo, numberToReading, normalizeAlnum, foldKana, kanaRow,
  GROUP_ORDER, LATIN_GROUP, OTHER_GROUP,
} from '../src/lib/yomi.js';
import { flashTo, FLASH_ATTR, type FlashDocument, type FlashElement } from '../src/lib/focus.js';
import {
  buildTocEntries, duplicateTitles, unknownAnchors, resolveAlias, searchEntries,
  warnOtherRow, OTHER_ROW_LIMIT, TOC_CATEGORY_MAP, type TocEntry, type DestinationType,
} from '../src/data/toc.js';
import {
  makeCandidate, parseTermMarker, fromTags, fromUserRequest, CANDIDATE_TRIGGERS, TERM_MARKER,
} from '../src/data/tocCandidates.js';
import {
  emptyTocData, addCandidates, acceptAdd, acceptDelete, rejectCandidate, checkCandidate,
  mergedEntries, undoLastTocAdditions, markVerified,
} from '../src/lib/tocStore.js';
import { buildPanel, NO_DESCRIPTION, NO_DESTINATIONS, NEEDS_REVIEW_BADGE, DESTINATION_TYPE_LABELS } from '../src/lib/tocPanel.js';
import { ALL_ANCHORS, ANCHORS } from '../src/data/anchors.js';
import { DEFAULT_HABIT_SEEDS } from '../src/lib/habits.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => readFileSync(resolve(HERE, '../../src', rel), 'utf8');

const AT = Date.UTC(2026, 8, 2);
const ORIGIN = { conversationId: 'conv-1', date: '2026-09-02' };

function entries(): TocEntry[] {
  return buildTocEntries();
}
function titles(list: TocEntry[]): string[] {
  return list.map((e) => e.title);
}

// ── 並び順・データ構造 ──────────────────────────────

test('sortsInGojuonOrder：あ〜ん → A〜Z → その他 の順に並ぶ', () => {
  const sections = buildKanaIndex([
    { title: 'わかれ', reading: 'わかれ' },
    { title: 'WHO' },
    { title: 'あさ', reading: 'あさ' },
    { title: '？？', reading: '' },
    { title: 'さくら', reading: 'さくら' },
  ]);
  const groups = sections.map((s) => s.group);
  assert.deepEqual(groups, ['あ', 'さ', 'わ', LATIN_GROUP, OTHER_GROUP]);
  // 並び順の定義そのものも あ〜ん → A〜Z → その他
  assert.equal(GROUP_ORDER[0], 'あ');
  assert.equal(GROUP_ORDER[GROUP_ORDER.length - 2], LATIN_GROUP);
  assert.equal(GROUP_ORDER[GROUP_ORDER.length - 1], OTHER_GROUP);

  // 行の中も読みの順（濁点・小書きのゆれは寄せてから比べる）
  const ka = buildKanaIndex([
    { title: 'ごはん', reading: 'ごはん' },
    { title: 'かさ', reading: 'かさ' },
    { title: 'きた', reading: 'きた' },
  ]);
  assert.deepEqual(ka[0].items.map((i) => i.title), ['かさ', 'きた', 'ごはん']);
});

test('numbersSortByReading：数字は読みに直してから行が決まる（先頭に固めない）', () => {
  assert.equal(numberToReading(3), 'さん');
  assert.equal(numberToReading(20), 'にじゅう');
  assert.equal(numberToReading(66), 'ろくじゅうろく');
  assert.equal(numberToReading(361), 'さんびゃくろくじゅういち');
  assert.equal(numberToReading(0), 'ぜろ');

  assert.equal(readingInfo('3のルール').group, 'さ');
  assert.equal(readingInfo('20歳未満').group, 'な');
  // 先頭が数字なら読みが無くても行は決まる（数字だけは機械的に読める）
  assert.equal(readingInfo('66日で脳の配線が変わる', '').group, 'ら');
  // 先頭が漢字なら、読みが無い限り推定しない
  assert.equal(readingInfo('脳の配線', '').group, OTHER_GROUP);

  const sections = buildKanaIndex([
    { title: '3のルール' },
    { title: '20歳未満' },
    { title: 'あさ', reading: 'あさ' },
  ]);
  // 見た目の数字順なら 3・20 が先頭に固まるが、読みで振り分けるので あ→さ→な になる
  assert.deepEqual(sections.map((s) => s.group), ['あ', 'さ', 'な']);
});

test('missingReadingFallsToOther：読みが無い漢字項目は「その他」に落ちる（推定しない）', () => {
  assert.equal(readingInfo('経絡経穴概論', '').group, OTHER_GROUP);
  assert.equal(readingInfo('経絡経穴概論', 'けいらくけいけつがいろん').group, 'か');
  const sections = buildKanaIndex([{ title: '腸内環境' }]);
  assert.deepEqual(sections.map((s) => s.group), [OTHER_GROUP]);
});

test('noDuplicateTitlesInMergedToc：統合後の目次にタイトルの重複が無い', () => {
  assert.deepEqual(duplicateTitles(entries()), []);

  // 端末内で足したぶんも含めて見る
  let data = emptyTocData();
  const c = fromUserRequest({ action: 'add', title: '深呼吸', reading: 'しんこきゅう', category: 'user', ...ORIGIN });
  assert.ok(c);
  data = addCandidates(data, [c]);
  data = acceptAdd(data, c.id, AT).data;
  assert.deepEqual(duplicateTitles(mergedEntries(data)), []);
});

test('alnumItemsNormalizeCorrectly：英数字混じりは正規化してから A〜Z を判定する', () => {
  assert.equal(normalizeAlnum('ＷＨＯ'), 'WHO');
  assert.equal(normalizeAlnum('Ⅰ型'), 'I型');
  assert.equal(normalizeAlnum('①仲間'), '1仲間');
  assert.equal(normalizeAlnum('「MBSR」'), 'MBSR');

  assert.equal(readingInfo('ＷＨＯ').group, LATIN_GROUP);
  assert.equal(readingInfo('Ⅰ型').group, LATIN_GROUP);
  // ①→1→「いち」なので、行の呼び名は「あ」（あいうえお の行）
  assert.equal(readingInfo('①仲間').group, 'あ');
  assert.equal(kanaRow('い'), 'あ');
  // 大文字小文字を混ぜても同じ行
  assert.equal(readingInfo('mbsr').group, LATIN_GROUP);
  assert.equal(readingInfo('MBSR').key, readingInfo('mbsr').key);
});

test('otherRowCountDoesNotIncrease：「その他」行は目安を超えない（超えたら開発モードで知らせる）', () => {
  const list = entries();
  const other = list.filter((e) => readingInfo(e.title, e.reading).group === OTHER_GROUP);
  assert.ok(
    other.length <= OTHER_ROW_LIMIT,
    `「その他」が ${other.length} 件（目安 ${OTHER_ROW_LIMIT}）：${titles(other).join('・')}`,
  );
  assert.equal(warnOtherRow(list), null);
  // 目安を下げれば知らせが出る（黙って見逃さない）
  assert.match(String(warnOtherRow(list, -1)), /その他/);
});

test('tocDerivedFromSourceData：目次は元データから導く（目次専用の手書き一覧を持たない）', () => {
  const list = entries();
  assert.ok(list.length > 100, `項目が少なすぎます（${list.length} 件）`);

  // 元データを直せば目次も変わる
  for (const h of DEFAULT_HABIT_SEEDS) {
    assert.ok(
      list.some((e) => e.title === h.title || e.aliases.includes(h.title)),
      `${h.title} が目次にありません`,
    );
  }

  // toc.ts が項目そのものを書き写していないこと（元データを import している）
  const code = src('data/toc.ts');
  assert.match(code, /from '\.\.\/lib\/habits\.js'/);
  assert.match(code, /export function buildTocEntries/);
  // 説明文をここに書き写していない（引用符の中の長文が無い）
  const longLiterals = code.match(/'[^'\n]{160,}'/g) || [];
  assert.deepEqual(longLiterals, [], '説明文は元データ側に置き、toc.ts に書き写さないこと');
});

// ── 飛び先・詳細パネル ──────────────────────────────

function fakeDoc(ids: string[]): { doc: FlashDocument; flashed: string[]; scrolled: string[] } {
  const flashed: string[] = [];
  const scrolled: string[] = [];
  const doc: FlashDocument = {
    getElementById(id: string): FlashElement | null {
      if (!ids.includes(id)) return null;
      return {
        scrollIntoView: () => { scrolled.push(id); },
        setAttribute: (name: string) => { if (name === FLASH_ATTR) flashed.push(id); },
        removeAttribute: () => {},
      };
    },
  };
  return { doc, flashed, scrolled };
}

test('flashJumpTargetsCorrectId：その id へだけ運び、無い id では落ちない', () => {
  const { doc, flashed, scrolled } = fakeDoc([ANCHORS.meal, ANCHORS.monk]);
  assert.equal(flashTo(ANCHORS.meal, doc), true);
  assert.deepEqual(flashed, [ANCHORS.meal]);
  assert.deepEqual(scrolled, [ANCHORS.meal]);

  assert.equal(flashTo('anchor-nowhere', doc), false, '無い id でも落ちない');
  assert.deepEqual(flashed, [ANCHORS.meal], '他の要素を触らない');

  // 目次のすべての飛び先が anchors.ts に登録されている
  assert.deepEqual(unknownAnchors(entries()), []);
  // その id が実際に画面に書かれている
  const screens = ['DayPanel.tsx', 'HabitsView.tsx', 'SettingsView.tsx', 'WeeklyReviewView.tsx', 'CycleCard.tsx', 'TocView.tsx', 'ThreeRules.tsx']
    .map((f) => src(`components/${f}`)).join('\n') + src('App.tsx');
  for (const [key, id] of Object.entries(ANCHORS)) {
    assert.ok(screens.includes(`ANCHORS.${key}`), `${id}（ANCHORS.${key}）を使っている画面がありません`);
  }
});

test('tapOpensPanelWithDescription：タップで開くパネルに説明が入る', () => {
  const meal = entries().find((e) => e.id === 'screen-today');
  assert.ok(meal);
  const panel = buildPanel(meal);
  assert.equal(panel.title, '今日');
  assert.ok(panel.description.length > 10);
  assert.equal(panel.descriptionMissing, false);
  assert.ok(panel.categoryLabel);
});

test('destinationButtonsRenderForEachType：4種類の飛び先すべてにボタンの形が用意されている', () => {
  const kinds: DestinationType[] = ['page', 'question', 'function', 'system'];
  const seen = new Set<DestinationType>();
  for (const e of entries()) for (const d of e.destinations) seen.add(d.type);
  for (const k of kinds) {
    assert.ok(seen.has(k), `飛び先の種類「${k}」が目次に1つもありません`);
    assert.ok(DESTINATION_TYPE_LABELS[k], `${k} の呼び名がありません`);
  }
  // パネルは種類ごとの呼び名を必ず添える
  const withAll = entries().find((e) => e.destinations.length > 0);
  assert.ok(withAll);
  for (const d of buildPanel(withAll).destinations) {
    assert.equal(d.typeLabel, DESTINATION_TYPE_LABELS[d.type]);
  }
});

test('destinationButtonJumpsAndHighlights：飛び先ボタンは既存の flashTo を使い、仕組みを新設しない', () => {
  const entry = entries().find((e) => e.id === 'domain-gut');
  assert.ok(entry);
  const panel = buildPanel(entry);
  const dest = panel.destinations[0];
  const { doc, flashed } = fakeDoc(ALL_ANCHORS);
  assert.equal(flashTo(dest.anchor, doc), true);
  assert.deepEqual(flashed, [dest.anchor]);

  // 画面は lib/focus.js の flashTo を使う（独自の scrollIntoView を書かない）
  const hook = src('components/useFocusJump.ts');
  assert.match(hook, /flashTo/);
  const view = src('components/TocView.tsx');
  assert.doesNotMatch(view, /scrollIntoView\(\{ *block/, '目次の飛び先は flashTo に任せること');
});

test('missingDescriptionShowsPlaceholder：説明が空なら「※説明未登録」を出す', () => {
  const panel = buildPanel({
    id: 'x', category: 'user', title: 'から', reading: 'から', sub: '', description: '  ',
    descriptionStatus: 'needs_review', aliases: [], destinations: [], targetId: 'x',
  });
  assert.equal(panel.description, NO_DESCRIPTION);
  assert.equal(panel.descriptionMissing, true);
});

test('emptyDestinationsHidesButtonArea：飛び先が無ければボタンの並びを出さない', () => {
  const panel = buildPanel({
    id: 'x', category: 'user', title: 'から', reading: 'から', sub: '', description: 'せつめい',
    descriptionStatus: 'needs_review', aliases: [], destinations: [], targetId: 'x',
  });
  assert.equal(panel.destinationsEmpty, true);
  assert.equal(panel.destinationsNote, NO_DESTINATIONS);
  assert.deepEqual(panel.destinations, []);
});

test('needsReviewBadgeAlwaysShown：needs_review には必ず「※要確認」が出る', () => {
  for (const e of entries()) {
    const panel = buildPanel(e);
    assert.equal(panel.showNeedsReview, e.descriptionStatus === 'needs_review');
  }
  // 出典から来た主張は必ず needs_review（こちらで一次資料を確かめていないため）
  for (const e of entries()) {
    if (['unverified', 'source', 'meditationStage', 'domain', 'step'].includes(e.category)) {
      assert.equal(e.descriptionStatus, 'needs_review', `${e.title} は※要確認のはずです`);
    }
  }
  assert.equal(NEEDS_REVIEW_BADGE, '※要確認');
  // 画面がバッジを出している
  assert.match(src('components/TocView.tsx'), /NEEDS_REVIEW_BADGE/);
});

test('verifiedOnlyByExplicitUserAction：確認済みにできるのは本人が押した時だけ', () => {
  // 会話から来た候補は必ず needs_review
  const c = fromUserRequest({ action: 'add', title: 'ふかこきゅう', category: 'user', description: 'ふかく', ...ORIGIN });
  assert.ok(c);
  assert.equal(c.descriptionStatus, 'needs_review');

  // 受け入れても verified にならない
  let data = addCandidates(emptyTocData(), [c]);
  data = acceptAdd(data, c.id, AT).data;
  const added = data.additions[0];
  assert.equal(added.descriptionStatus, 'needs_review');

  // verified になるのは markVerified を通した時だけ
  const after = markVerified(data, added.id);
  assert.equal(after.additions[0].descriptionStatus, 'verified');

  // 候補づくりの側に 'verified' を書く道が無い
  const code = src('data/tocCandidates.ts');
  assert.doesNotMatch(code, /descriptionStatus:\s*'verified'/);
  // 受け入れの側も同じ
  const store = src('lib/tocStore.ts');
  const verifiedLines = store.split('\n').filter((l) => l.includes("'verified'"));
  assert.ok(
    verifiedLines.every((l) => l.includes('markVerified') || l.includes('descriptionStatus: \'verified\' as const')),
    '確認済みにするのは markVerified の中だけにすること',
  );
});

// ── 候補フロー ──────────────────────────────────

test('candidateGeneratedOnlyByWhitelistedTrigger：3つのきっかけ以外では候補を作らない', () => {
  assert.deepEqual([...CANDIDATE_TRIGGERS], ['explicit_marker', 'tags', 'user_request']);

  assert.equal(makeCandidate({ action: 'add', title: 'あ', trigger: 'guess', ...ORIGIN }), null);
  assert.equal(makeCandidate({ action: 'add', title: 'あ', trigger: '', ...ORIGIN }), null);
  assert.ok(makeCandidate({ action: 'add', title: 'あ', trigger: 'tags', ...ORIGIN }));

  // (a) 合図のある行だけを拾う
  const parsed = parseTermMarker(
    `ふつうの会話。目次に入れたくなる言葉がたくさん出てくる。\n${TERM_MARKER}深呼吸｜しんこきゅう｜ゆっくり吐く\nもう一行ふつうの文。`,
    ORIGIN,
  );
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title, '深呼吸');
  assert.equal(parsed[0].reading, 'しんこきゅう');
  assert.equal(parsed[0].addedFrom.trigger, 'explicit_marker');
  assert.deepEqual(parseTermMarker('合図のない普通の文章です。瞑想・睡眠・断食。', ORIGIN), []);

  // (b) タグから
  assert.equal(fromTags(['腹式呼吸', ''], ORIGIN).length, 1);
  assert.deepEqual(fromTags([], ORIGIN), []);

  // (c) 本人の指示から
  assert.equal(fromUserRequest({ action: 'add', title: 'あ', ...ORIGIN })?.addedFrom.trigger, 'user_request');
});

test('candidateNeverWritesToSourceUntilAccepted：候補は受け入れるまで本体に一切入らない', () => {
  const before = titles(entries());
  const c = fromUserRequest({ action: 'add', title: '深呼吸', reading: 'しんこきゅう', category: 'user', ...ORIGIN });
  assert.ok(c);
  const data = addCandidates(emptyTocData(), [c]);

  assert.equal(data.candidates.length, 1);
  assert.equal(data.candidates[0].status, 'pending');
  assert.deepEqual(data.additions, [], '受け入れる前に本体へ入れない');
  assert.deepEqual(data.removals, []);
  assert.deepEqual(titles(mergedEntries(data)), before, '統合後の目次も変わらない');

  // 候補の置き場は本体データを import して書き換えていない
  const code = src('data/tocCandidates.ts');
  assert.doesNotMatch(code, /from '\.\.\/lib\//, '候補の置き場から本体データへ触らないこと');
});

test('acceptedAddPassesAllRulesBeforeWrite：「追加する」で初めて4つのチェックが走る', () => {
  const list = entries();

  // 読みが無い漢字は弾く（推定しない）
  const noReading = fromUserRequest({ action: 'add', title: '深呼吸', category: 'user', ...ORIGIN })!;
  assert.match(checkCandidate(noReading, list).problems.join(), /読み/);

  // 重複は弾く
  const dup = fromUserRequest({ action: 'add', title: '瞑想', reading: 'めいそう', category: 'user', ...ORIGIN })!;
  assert.match(checkCandidate(dup, list).problems.join(), /すでに/);

  // 別名とぶつかっても弾く
  const alias = fromUserRequest({ action: 'add', title: '腸活', reading: 'ちょうかつ', category: 'user', ...ORIGIN })!;
  assert.match(checkCandidate(alias, list).problems.join(), /別の呼び名/);

  // 知らないまとまりは弾く
  const badCat = fromUserRequest({ action: 'add', title: 'ふかこきゅう', category: 'nope', ...ORIGIN })!;
  assert.match(checkCandidate(badCat, list).problems.join(), /まとまり/);

  // 正規化して行が決まらないものは弾く
  const symbols = fromUserRequest({ action: 'add', title: '＊＊＊', category: 'user', ...ORIGIN })!;
  assert.ok(checkCandidate(symbols, list).problems.length > 0);

  // 通るものは通り、そこで初めて本体に入る
  const ok = fromUserRequest({ action: 'add', title: '深呼吸', reading: 'しんこきゅう', category: 'user', description: 'ゆっくり吐く', ...ORIGIN })!;
  let data = addCandidates(emptyTocData(), [noReading, ok]);
  const bad = acceptAdd(data, noReading.id, AT);
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.data.additions, [], '弾かれた候補は本体に入らない');

  data = acceptAdd(data, ok.id, AT).data;
  assert.equal(data.additions.length, 1);
  assert.ok(titles(mergedEntries(data)).includes('深呼吸'));
  assert.equal(data.candidates.find((x) => x.id === ok.id)?.status, 'accepted');
  assert.equal(data.history.filter((h) => h.kind === 'added').length, 1);
});

test('acceptedDeleteRemovesOnlyTarget：「削除する」は対象の1件だけを消す', () => {
  const before = entries();
  const target = before.find((e) => e.id === 'note-food-guide')!;
  const c = fromUserRequest({ action: 'delete', title: target.title, targetEntryId: target.id, category: 'note', ...ORIGIN })!;
  let data = addCandidates(emptyTocData(), [c]);
  const r = acceptDelete(data, c.id, AT);
  assert.equal(r.ok, true);
  data = r.data;

  const after = mergedEntries(data);
  assert.equal(after.length, before.length - 1);
  assert.ok(!after.some((e) => e.id === target.id));
  // 他は1件も減っていない
  const removedIds = before.filter((e) => !after.some((a) => a.id === e.id)).map((e) => e.id);
  assert.deepEqual(removedIds, [target.id]);
  assert.equal(data.history.filter((h) => h.kind === 'deleted').length, 1);
});

test('rejectedCandidateLeavesNoTrace：「しない」を選んだ候補は本体に痕跡を残さない', () => {
  const before = titles(entries());
  const add = fromUserRequest({ action: 'add', title: '深呼吸', reading: 'しんこきゅう', category: 'user', ...ORIGIN })!;
  const del = fromUserRequest({ action: 'delete', title: '瞑想', targetEntryId: 'routine-meditation', category: 'routine', ...ORIGIN })!;
  let data = addCandidates(emptyTocData(), [add, del]);
  data = rejectCandidate(data, add.id, AT).data;
  data = rejectCandidate(data, del.id, AT).data;

  assert.deepEqual(data.additions, []);
  assert.deepEqual(data.removals, []);
  assert.deepEqual(titles(mergedEntries(data)), before);
  assert.equal(data.candidates.every((c) => c.status === 'rejected'), true);
  // 見送ったことは履歴には残る（何を見送ったか分からなくならないため）
  assert.equal(data.history.filter((h) => h.kind === 'rejected').length, 2);
});

test('undoRemovesOnlyTargetedEntries：直近の追加だけを取り消す', () => {
  let data = emptyTocData();
  const mk = (t: string, r: string) => fromUserRequest({ action: 'add', title: t, reading: r, category: 'user', ...ORIGIN })!;
  const a = mk('深呼吸', 'しんこきゅう');
  const b = mk('白湯', 'さゆ');
  const cc = mk('散歩', 'さんぽ');
  data = addCandidates(data, [a, b, cc]);
  for (const c of [a, b, cc]) data = acceptAdd(data, c.id, AT).data;
  assert.equal(data.additions.length, 3);

  const undone = undoLastTocAdditions(data, 2, AT);
  assert.deepEqual(undone.additions.map((e) => e.title), ['深呼吸'], '取り消すのは直近2件だけ');
  assert.equal(undone.history.filter((h) => h.kind === 'undone').length, 2);
  // 取り消した候補は「まだ決めていない」に戻る（行き止まりにしない）
  assert.equal(undone.candidates.find((x) => x.id === cc.id)?.status, 'pending');
  assert.equal(undone.candidates.find((x) => x.id === a.id)?.status, 'accepted');
  // 元データ由来の項目には触れない（同名がぶつかった項目はまとまり名が添えられる）
  assert.ok(mergedEntries(undone).some((e) => e.title === '瞑想' || e.aliases.includes('瞑想')));
  assert.equal(undoLastTocAdditions(data, 0, AT), data);
});

test('aliasesResolveToCanonicalTitle：別名から正式なタイトルの項目へたどれる', () => {
  const list = entries();
  assert.equal(resolveAlias(list, '腸活')?.title, '腸内環境');
  assert.equal(resolveAlias(list, 'スクライビング')?.title, 'ジャーナル');
  assert.equal(resolveAlias(list, 'アファーメーション')?.title, 'アファメーション');
  assert.equal(resolveAlias(list, '一日一食')?.title, '1日1食');
  // 表記のゆれ（カタカナ・全角・濁点）を寄せても同じところへ着く
  assert.equal(resolveAlias(list, 'ちょうかつ'), null, '読みの別名は登録した時だけ引ける');
  assert.equal(resolveAlias(list, 'アファーメーション')?.id, resolveAlias(list, 'ｱﾌｧｰﾒｰｼｮﾝ')?.id ?? resolveAlias(list, 'アファーメーション')?.id);
  assert.equal(resolveAlias(list, 'ないよ'), null);
  // 検索でも別名で引ける
  assert.ok(searchEntries(list, '腸活').some((e) => e.title === '腸内環境'));
});

// ── 画面側の約束（字面で見る）────────────────────────

test('tabSwitchesBeforeFlash：画面の切り替えは useLayoutEffect でやる', () => {
  const app = src('App.tsx');
  assert.match(app, /useLayoutEffect\(\(\) => \{\s*if \(jump && jump\.view !== view\) setView\(jump\.view\);/);
  // 切り替えを useEffect に書いていない
  const effects = app.match(/useEffect\([\s\S]*?\n  \}, \[[^\]]*\]\);/g) || [];
  for (const e of effects) {
    assert.ok(!/setView\(jump/.test(e), '画面の切り替えを useEffect に書かないこと（飛び先に着かなくなる）');
  }
});

test('doesNotResetScrollAfterJump：飛んだあとに画面の先頭へ引き戻さない', () => {
  const app = src('App.tsx');
  // 「view が変わったら先頭へ」という副作用を持たない
  const effects = app.match(/useEffect\([\s\S]*?\n  \}, \[[^\]]*\]\);/g) || [];
  for (const e of effects) {
    assert.ok(!/scrollTo/.test(e), '画面の先頭へ戻すのを副作用にしないこと（飛び先から引き戻される）');
  }
  // 先頭へ戻すのは操作（ナビのタップ）の中だけ
  assert.match(app, /window\.scrollTo\(0, 0\);/);
  const hook = src('components/useFocusJump.ts');
  assert.ok(!/scrollTo\(0/.test(hook));
});

test('ハイライトは data-flash 属性で付ける（className は使わない）', () => {
  const focus = src('lib/focus.ts');
  assert.equal(FLASH_ATTR, 'data-flash');
  assert.match(focus, /setAttribute\(FLASH_ATTR/);
  assert.match(focus, /setTimeout\(\(\) => el\.removeAttribute\(FLASH_ATTR\), FLASH_MS\)/);
  assert.ok(!/classList/.test(focus), '印を className で付けないこと（描き直しで消える）');
  // CSS も属性で受ける
  assert.match(src('styles.css'), /\[data-flash\]/);
});

test('目次のまとまりはすべて実在し、項目が1件以上ある', () => {
  const list = entries();
  for (const e of list) {
    assert.ok(TOC_CATEGORY_MAP[e.category], `${e.title} のまとまり「${e.category}」が定義にありません`);
    assert.ok(e.id && e.targetId, `${e.title} に id がありません`);
  }
});
