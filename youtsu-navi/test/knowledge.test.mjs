import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeNote, emptyNote, validateNote, applyFirstCheck, applySecondCheck, rejectNote, reopenNote,
  dueForSecondCheck, filterNotes, activeNotesFor, upsertNote, removeNote, sortNotes,
  summarizeKnowledge, notesToJson, parseNotesJson, toIndexItems, criticalUnchecked, isCheckComplete,
  FIRST_CHECK_ITEMS, SECOND_CHECK_ITEMS, REVIEW_GAP_MS, SUMMARY_MAX, STAGES, SOURCE_KINDS, MAX_NOTES,
} from '../src/lib/knowledge.js';
import { buildKanaIndex } from '../src/lib/yomi.js';

const AT = 1_700_000_000_000;

function goodInput(over = {}) {
  return {
    title: '急性腰痛の安静',
    reading: 'きゅうせいようつうのあんせい',
    summary: '強い痛みでも長く寝込むより、動ける範囲で日常を続けた方が経過が良いとされる。痛みの範囲で動かす。',
    practice: '初回で不安が強い方には、痛みの出ない範囲の動きを一緒に確認する。',
    source: { kind: 'book', title: '腰痛診療ガイドライン2019', author: '日本整形外科学会', locator: 'CQ', sourceIds: ['jpn_lbp_gl2019'] },
    tags: ['duration:acute'],
    patternIds: ['nonspecific'],
    symptomIds: ['lowback'],
    ...over,
  };
}

const allFirst = Object.fromEntries(FIRST_CHECK_ITEMS.map((i) => [i.id, true]));
const allSecond = Object.fromEntries(SECOND_CHECK_ITEMS.map((i) => [i.id, true]));

test('作ったばかりのメモは下書きで、提案には出ない', () => {
  const n = makeNote(goodInput(), { at: AT, seed: 1 });
  assert.equal(n.stage, 'draft');
  assert.equal(activeNotesFor([n], { patternIds: ['nonspecific'] }).length, 0);
});

test('出典が無いメモは第1チェックへ進めない', () => {
  const n = makeNote(goodInput({ source: { kind: 'video', title: '', author: '', locator: '' } }), { at: AT });
  const v = validateNote(n);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes('出典')));
  assert.equal(applyFirstCheck(n, allFirst, { at: AT }).ok, false);
});

test('要約が無い・長すぎる（書き写しの疑い）はエラー', () => {
  assert.ok(validateNote(makeNote(goodInput({ summary: '' }), { at: AT })).errors.some((e) => e.includes('要約')));
  const long = makeNote(goodInput({ summary: 'あ'.repeat(SUMMARY_MAX + 50) }), { at: AT });
  // makeNote が上限で切り詰めるので、ここでは切り詰め前の値を直接検査する
  const raw = { ...long, summary: 'あ'.repeat(SUMMARY_MAX + 50) };
  assert.ok(validateNote(raw).errors.some((e) => e.includes('自分の言葉')));
  assert.equal(long.summary.length, SUMMARY_MAX); // 保存時は必ず上限内
});

test('漢字を含む見出しは読み必須・ひらがなのみ（目次の共通ルール）', () => {
  const noReading = makeNote(goodInput({ reading: '' }), { at: AT });
  assert.ok(validateNote(noReading).errors.some((e) => e.includes('読み')));
  const katakana = makeNote(goodInput({ reading: 'キュウセイ' }), { at: AT });
  assert.ok(validateNote(katakana).errors.some((e) => e.includes('ひらがな')));
  // ひらがなだけの見出しなら読みは省ける
  const hira = makeNote({ ...goodInput(), title: 'しびれのみかた', reading: '' }, { at: AT });
  assert.equal(validateNote(hira).ok, true);
});

test('見出しの重複は弾く（探せなくなるため）', () => {
  const a = makeNote(goodInput(), { at: AT, seed: 1 });
  const b = makeNote(goodInput(), { at: AT + 1, seed: 2 });
  assert.ok(validateNote(b, { others: [a] }).errors.some((e) => e.includes('同じ見出し')));
  assert.equal(validateNote(a, { others: [a] }).ok, true); // 自分自身とは重複しない
});

test('言い切り表現は警告として出す（保存は止めない）', () => {
  const n = makeNote(goodInput({ summary: 'この手技をすれば必ず治る。ヘルニアと診断できる。' }), { at: AT });
  const v = validateNote(n);
  assert.equal(v.ok, true);
  assert.ok(v.warnings.some((w) => w.includes('必ず')));
  assert.ok(v.warnings.some((w) => w.includes('診断')));
});

test('動画だけを根拠にした数字入りの内容は「※要確認」をすすめる', () => {
  const n = makeNote(goodInput({ source: { kind: 'video', title: '腰痛の解説', author: 'A', locator: '12:34' }, summary: '3週間で8割が軽快する。' }), { at: AT });
  assert.ok(validateNote(n).warnings.some((w) => w.includes('要確認')));
  const withCaution = { ...n, caution: true };
  assert.equal(validateNote(withCaution).warnings.some((w) => w.includes('要確認')), false);
});

test('第1チェックは全項目そろって初めて通る', () => {
  const n = makeNote(goodInput(), { at: AT });
  const partial = { ...allFirst, noAssert: false };
  assert.equal(isCheckComplete(FIRST_CHECK_ITEMS, partial), false);
  assert.equal(applyFirstCheck(n, partial, { at: AT }).ok, false);
  const r = applyFirstCheck(n, allFirst, { at: AT });
  assert.equal(r.ok, true);
  assert.equal(r.note.stage, 'checked');
  assert.equal(r.note.checks.first.all, true);
});

test('第1チェックだけでは提案に出ない（二段階が要件）', () => {
  const n = applyFirstCheck(makeNote(goodInput(), { at: AT }), allFirst, { at: AT }).note;
  assert.equal(activeNotesFor([n], { patternIds: ['nonspecific'] }).length, 0);
});

test('第1チェックを飛ばして第2チェックはできない', () => {
  const n = makeNote(goodInput(), { at: AT });
  const r = applySecondCheck(n, allSecond, { at: AT });
  assert.equal(r.ok, false);
  assert.match(r.reason, /第1チェック/);
});

test('二段階を通ると運用中になり、結果画面に出る', () => {
  const first = applyFirstCheck(makeNote(goodInput(), { at: AT }), allFirst, { at: AT }).note;
  const r = applySecondCheck(first, allSecond, { at: AT + REVIEW_GAP_MS + 1000 });
  assert.equal(r.ok, true);
  assert.equal(r.note.stage, 'active');
  assert.equal(r.sameDay, false);
  const hits = activeNotesFor([r.note], { patternIds: ['nonspecific'], tags: [] });
  assert.equal(hits.length, 1);
  assert.deepEqual(hits[0].hitPatterns, ['nonspecific']);
});

test('同じ日に続けて第2チェックした場合は記録に残す（止めはしない）', () => {
  const first = applyFirstCheck(makeNote(goodInput(), { at: AT }), allFirst, { at: AT }).note;
  const r = applySecondCheck(first, allSecond, { at: AT + 60_000 });
  assert.equal(r.ok, true);
  assert.equal(r.sameDay, true);
  assert.equal(r.note.checks.second.sameDay, true);
});

test('受診をすすめる判断を弱める内容は運用に進めず見送りにする', () => {
  const first = applyFirstCheck(makeNote(goodInput(), { at: AT }), allFirst, { at: AT }).note;
  const answers = { ...allSecond, keepsRedFlag: false };
  assert.equal(criticalUnchecked(answers).length, 1);
  const r = applySecondCheck(first, answers, { at: AT + REVIEW_GAP_MS + 1 });
  assert.equal(r.rejected, true);
  assert.equal(r.note.stage, 'rejected');
  assert.equal(activeNotesFor([r.note], { patternIds: ['nonspecific'] }).length, 0);
});

test('見送りは消さずに理由を残し、直して出し直せる', () => {
  const n = rejectNote(makeNote(goodInput(), { at: AT }), { at: AT + 1, memo: '出典が見つからない' });
  assert.equal(n.stage, 'rejected');
  assert.equal(n.checks.second.memo, '出典が見つからない');
  const back = reopenNote(n, { at: AT + 2 });
  assert.equal(back.stage, 'draft');
  assert.equal(back.checks.first, null);
});

test('第2チェック待ちは、日を改めたものだけを「今日の見直し」に出す', () => {
  const first = applyFirstCheck(makeNote(goodInput(), { at: AT }), allFirst, { at: AT }).note;
  assert.equal(dueForSecondCheck([first], AT + 60_000).length, 0);
  assert.equal(dueForSecondCheck([first], AT + REVIEW_GAP_MS + 1).length, 1);
});

test('関係のないメモは結果画面に出さない', () => {
  const first = applyFirstCheck(makeNote(goodInput(), { at: AT }), allFirst, { at: AT }).note;
  const active = applySecondCheck(first, allSecond, { at: AT + REVIEW_GAP_MS + 1 }).note;
  assert.equal(activeNotesFor([active], { patternIds: ['knee_oa'], tags: ['aggr:stairs_up'] }).length, 0);
});

test('パターン一致はタグ一致より優先して並べる', () => {
  const mk = (over, seed) => {
    const f = applyFirstCheck(makeNote(goodInput(over), { at: AT, seed }), allFirst, { at: AT }).note;
    return applySecondCheck(f, allSecond, { at: AT + REVIEW_GAP_MS + 1 }).note;
  };
  const byTag = mk({ title: 'タグ側', reading: 'たぐがわ', patternIds: [], tags: ['duration:acute'] }, 1);
  const byPattern = mk({ title: 'パターン側', reading: 'ぱたーんがわ', patternIds: ['nonspecific'], tags: [] }, 2);
  const out = activeNotesFor([byTag, byPattern], { patternIds: ['nonspecific'], tags: ['duration:acute'] });
  assert.equal(out.length, 2);
  assert.equal(out[0].note.title, 'パターン側');
});

test('一覧の絞り込み（段階・出典の種別・語句）', () => {
  const a = makeNote(goodInput(), { at: AT, seed: 1 });
  const b = makeNote(goodInput({ title: '膝の外側の痛み', reading: 'ひざのそとがわのいたみ', source: { kind: 'video', title: '腸脛靭帯の解説', author: 'B', locator: '3:00' } }), { at: AT + 1, seed: 2 });
  const list = [a, b];
  assert.equal(filterNotes(list, { kind: 'video' }).length, 1);
  assert.equal(filterNotes(list, { stage: 'draft' }).length, 2);
  assert.equal(filterNotes(list, { stage: 'active' }).length, 0);
  assert.equal(filterNotes(list, { query: '腸脛' }).length, 1);
  assert.equal(filterNotes(list, { query: 'ガイドライン' }).length, 1); // 出典名でも探せる
});

test('保存は上限件数を超えず、新しい順に残る', () => {
  let list = [];
  for (let i = 0; i < MAX_NOTES + 5; i += 1) {
    list = upsertNote(list, makeNote(goodInput({ title: `メモ${i}`, reading: 'めも' }), { at: AT + i, seed: i }));
  }
  assert.equal(list.length, MAX_NOTES);
  assert.equal(sortNotes(list)[0].title, `メモ${MAX_NOTES + 4}`);
  const id = list[0].id;
  assert.equal(removeNote(list, id).length, MAX_NOTES - 1);
});

test('同じidの更新は増えずに置き換わる', () => {
  const n = makeNote(goodInput(), { at: AT, seed: 1 });
  const list = upsertNote(upsertNote([], n), { ...n, title: '直した見出し' });
  assert.equal(list.length, 1);
  assert.equal(list[0].title, '直した見出し');
});

test('集計は段階別と「見直し待ち」を返す', () => {
  const draft = makeNote(goodInput(), { at: AT, seed: 1 });
  const checked = applyFirstCheck(makeNote(goodInput({ title: '別のメモ', reading: 'べつのめも' }), { at: AT, seed: 2 }), allFirst, { at: AT }).note;
  const s = summarizeKnowledge([draft, checked], AT + REVIEW_GAP_MS + 1);
  assert.equal(s.total, 2);
  assert.equal(s.draft, 1);
  assert.equal(s.checked, 1);
  assert.equal(s.due, 1);
});

test('書き出し→取り込みで内容が戻る', () => {
  const n = makeNote(goodInput(), { at: AT, seed: 1 });
  const parsed = parseNotesJson(notesToJson([n]));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.notes.length, 1);
  assert.equal(parsed.notes[0].title, n.title);
  assert.equal(parsed.notes[0].source.title, n.source.title);
});

test('他アプリ・壊れたファイルは取り込まない', () => {
  assert.equal(parseNotesJson('こわれています').ok, false);
  assert.equal(parseNotesJson(JSON.stringify({ app: 'other', kind: 'knowledge', notes: [] })).ok, false);
  assert.equal(parseNotesJson(JSON.stringify({ app: 'youtsu-navi', kind: 'records', records: [] })).ok, false);
  const partial = parseNotesJson(JSON.stringify({ app: 'youtsu-navi', kind: 'knowledge', notes: [{ id: 'a', title: 'ok' }, { nope: 1 }] }));
  assert.equal(partial.ok, true);
  assert.equal(partial.notes.length, 1);
  assert.match(partial.error, /読み飛ばし/);
});

test('取り込んだメモの知らない段階は下書きに戻す（勝手に運用中にしない）', () => {
  const parsed = parseNotesJson(JSON.stringify({
    app: 'youtsu-navi', kind: 'knowledge', notes: [{ id: 'a', title: 'ok', stage: 'なりすまし' }],
  }));
  assert.equal(parsed.notes[0].stage, 'draft');
});

test('索引はアプリ共通の あ〜ん / A〜Z 規則に乗る', () => {
  const items = toIndexItems([
    { id: '1', title: '20歳未満への注意', reading: '', stage: 'active' },
    { id: '2', title: 'あたらしい知見', reading: '', stage: 'draft' },
    { id: '3', title: 'NICE の要点', reading: '', stage: 'active' },
  ]);
  const sections = buildKanaIndex(items);
  const groups = sections.map((s) => s.group);
  assert.ok(groups.includes('あ'));
  assert.ok(groups.includes('な')); // 「20歳」→ にじゅう… → な行
  assert.ok(groups.includes('A〜Z'));
});

test('段階と出典種別の定義が揃っている', () => {
  assert.deepEqual(Object.keys(STAGES).sort(), ['active', 'checked', 'draft', 'rejected']);
  for (const k of SOURCE_KINDS) {
    assert.ok(k.id && k.label && k.locatorLabel);
  }
  // 第1チェックと第2チェックは同じ観点をなぞらない
  const firstIds = new Set(FIRST_CHECK_ITEMS.map((i) => i.id));
  assert.ok(SECOND_CHECK_ITEMS.every((i) => !firstIds.has(i.id)));
  assert.equal(SECOND_CHECK_ITEMS.filter((i) => i.critical).length, 1);
});

test('空の下書きはそのまま保存できない（入口で止める）', () => {
  const v = validateNote(emptyNote(AT));
  assert.equal(v.ok, false);
  assert.ok(v.errors.length >= 3);
});
