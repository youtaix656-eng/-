import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

import { WATER_STEPS } from '../src/data/scales.js';
import { emptyDay, normalizeDay } from '../src/lib/days.js';
import { missingDays, filledCount, gapLine, GAP_NOTE } from '../src/lib/gaps.js';
import { PERIOD_KINDS, normalizePeriod, normalizePeriods, periodsOn, openPeriods, periodLength } from '../src/lib/periods.js';
import {
  MIN_DAYS_EACH,
  foodCompare,
  foodCompareList,
  compareStatus,
  byWeekday,
  lifeOverlay,
  windowCompare,
  eliminationCompare,
  probioticOverlay,
  FOOD_COMPARE_NOTE,
  WINDOW_NOTE,
} from '../src/lib/compare.js';
import { weeklyReview, weeklyRows, diffLine, WEEKLY_NOTE } from '../src/lib/weekly.js';
import {
  normalizeVisit,
  normalizeVisits,
  nextVisit,
  daysUntil,
  visitLine,
  openQuestions,
  carryOverText,
  NO_REMINDER_NOTE,
} from '../src/lib/visits.js';
import { cell, daysToCsv, HEADERS, csvFilename } from '../src/lib/csv.js';
import { encodeTransfer, decodeTransfer, fitsInQr, QR_LIMIT } from '../src/lib/transfer.js';
import { toMatrix } from '../src/lib/qr.js';
import { makeEntry, addEntry, normalizeErrors, formatAt, toText, MAX_ITEMS } from '../src/lib/errorLog.js';
import { canSpeak, toSpeech } from '../src/lib/speak.js';
import { canListen, errorLine, VOICE_OPT_IN_NOTE } from '../src/lib/voice.js';
import { escapeHtml, printHtml, canShare } from '../src/lib/share.js';

const src = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');
const code = (rel) =>
  src(rel)
    .split('\n')
    .filter((line) => !/^(\/\/|\/\*|\*)/.test(line.trim()))
    .join('\n');

/** テスト用に1日ぶんを作る */
function day(date, patch = {}) {
  return normalizeDay({ ...emptyDay(date), ...patch, date });
}

function makeDays(n, endDay = 20, fn = () => ({})) {
  const days = {};
  for (let i = 1; i <= n; i += 1) {
    const key = `2026-08-${String(i).padStart(2, '0')}`;
    days[key] = day(key, fn(i));
  }
  return days;
}

// ───────────────────── 水分（提案1） ─────────────────────

test('水分は段だけを持ち、量の基準を持たない', () => {
  assert.ok(WATER_STEPS.length >= 3);
  for (const step of WATER_STEPS) {
    assert.ok(step.label);
    assert.doesNotMatch(step.label, /\d/, `${step.label}: 量を書かない`);
  }
  // 記録に入る
  const d = day('2026-09-01', { water: 'more' });
  assert.equal(d.water, 'more');
  // 知らない値は落とす
  assert.equal(day('2026-09-01', { water: 'たくさん' }).water, null);
});

// ───────────────────── 抜けている日（提案2） ─────────────────────

test('空いている日は出すが、責める言い方をしない', () => {
  const days = { '2026-08-20': day('2026-08-20', { belly: 'usual' }) };
  const missing = missingDays(days, 3, '2026-08-20');
  assert.deepEqual(missing, ['2026-08-19', '2026-08-18']);
  assert.equal(filledCount(days, 3, '2026-08-20'), 1);
  for (const text of [gapLine(missing, 3), gapLine([], 3), GAP_NOTE]) {
    for (const bad of [/さぼ/, /怠け/, /連続/, /途切/, /だめ/]) {
      assert.doesNotMatch(text, bad, text);
    }
  }
});

// ───────────────────── いつもと違う期間（提案6） ─────────────────────

test('期間の印は、予測も判定もしない', () => {
  const s = code('lib/periods.js');
  assert.doesNotMatch(s, /predict|よそく|次は|周期/);
  // 終わりが始まりより前なら、黙って入れ替えず空にする
  const p = normalizePeriod({ kind: 'travel', from: '2026-09-05', to: '2026-09-01' });
  assert.equal(p.to, '');
  // 知らない種類は作らない
  assert.equal(normalizePeriod({ kind: 'なぞ', from: '2026-09-01' }), null);
  const list = normalizePeriods([{ kind: 'period', from: '2026-09-01', to: '2026-09-04' }]);
  assert.equal(periodsOn(list, '2026-09-02').length, 1);
  assert.equal(periodsOn(list, '2026-09-09').length, 0);
  assert.equal(periodLength(list[0]), 4);
  assert.equal(openPeriods(list).length, 0);
  for (const kind of PERIOD_KINDS) assert.ok(kind.reading, kind.id);
});

// ───────────────────── 並べるだけ（提案7〜12） ─────────────────────

test('食べた日と食べなかった日は、少なすぎると並べない', () => {
  const days = makeDays(20, 20, (i) => ({
    belly: i % 3 === 0 ? 'hard' : 'usual',
    meals: [{ id: `m${i}`, at: '', text: i % 2 ? 'パン' : '米' }],
  }));
  const keys = Object.keys(days);
  const row = foodCompare(days, keys, 'パン');
  assert.ok(row.enough);
  assert.equal(row.with.days + row.without.days, 20);
  // 片方が足りない食べものは出さない
  const few = foodCompare(days, keys.slice(0, 4), 'パン');
  assert.equal(few.enough, few.with.days >= MIN_DAYS_EACH && few.without.days >= MIN_DAYS_EACH);
  assert.equal(foodCompareList(days, keys.slice(0, 2), ['パン']).length, 0);
  // 出せない時に黙らない
  assert.match(compareStatus([], ['パン']), /\d+日/);
  assert.match(compareStatus([], []), /少ない/);
});

test('並べる層は、矢印も割合も先に出さない', () => {
  const s = code('lib/compare.js');
  assert.doesNotMatch(s, /→/);
  // 「原因」という語は使ってよい——**使うのは「原因ではない」と断る一文の中だけ**。
  // だから語そのものを禁じず、断りの文があることを見る（README 決まり26と同じ線）。
  // パーセントを組み立てていない
  assert.doesNotMatch(s, /\* 100|toFixed\(/);
  // 因果として読ませない一文がある
  assert.match(FOOD_COMPARE_NOTE, /原因だという意味ではありません/);
  assert.match(WINDOW_NOTE, /良くなった・悪くなった/);
});

test('曜日・暮らし・期間の比べは、日数だけを返す', () => {
  const days = makeDays(20, 20, (i) => ({ belly: i % 4 === 0 ? 'hard' : 'usual', stress: 'some', water: 'usual' }));
  const keys = Object.keys(days);
  const wd = byWeekday(days, keys);
  assert.equal(wd.length, 7);
  assert.equal(wd.reduce((n, w) => n + w.days, 0), 20);
  const overlay = lifeOverlay(days, keys);
  const stress = overlay.find((a) => a.id === 'stress');
  assert.ok(stress);
  assert.ok(stress.rows.every((r) => Number.isInteger(r.days)));
  const win = windowCompare(days, 14, '2026-08-20');
  assert.equal(win.n, 14);
  assert.ok(win.now.days > 0);
});

test('やめてみた前後・整腸剤の前後は、効いたかを返さない', () => {
  const days = makeDays(20, 20, (i) => ({ belly: i % 2 ? 'hard' : 'usual', probiotic: true }));
  const elim = eliminationCompare(days, { targetId: 'wheat', startedOn: '2026-08-11', endedOn: '2026-08-20' }, '2026-08-20');
  assert.ok(elim);
  assert.equal(elim.span, 10);
  assert.ok(!('better' in elim) && !('worse' in elim) && !('effect' in elim));
  const prob = probioticOverlay(days, { name: 'テスト', startedOn: '2026-08-11' }, '2026-08-20');
  assert.ok(prob);
  assert.equal(prob.takenDays, 10);
  assert.ok(!('worked' in prob));
  // 登録していなければ何も出さない
  assert.equal(probioticOverlay(days, { name: '', startedOn: '' }, '2026-08-20'), null);
});

// ───────────────────── 週次のふりかえり（提案10・追加6） ─────────────────────

test('今週と先週は並べるだけ・良し悪しを書かない', () => {
  const days = makeDays(20, 20, (i) => ({
    belly: i % 5 === 0 ? 'hard' : 'usual',
    stools: i % 4 === 0 ? [{ id: `s${i}`, at: '08:00', bristol: 6, marks: ['blood'] }] : [],
  }));
  const review = weeklyReview(days, '2026-08-20');
  assert.equal(review.thisWeek.total, 7);
  assert.equal(review.lastWeek.total, 7);
  const rows = weeklyRows(review);
  assert.ok(rows.some((r) => r.id === 'flagged'));
  for (const row of rows) {
    const line = diffLine(row);
    for (const bad of [/良く/, /悪く/, /改善/, /悪化/]) assert.doesNotMatch(line, bad, line);
  }
  assert.match(WEEKLY_NOTE, /良くなった・悪くなったという意味ではありません/);
  // 平均を持たない
  const s = code('lib/weekly.js');
  assert.doesNotMatch(s, /average|mean\b|平均/);
  assert.doesNotMatch(s, /\bstreak\b|連続/);
});

// ───────────────────── 通院（提案14〜16） ─────────────────────

test('通院は鳴らさない・診断名に整えない', () => {
  const s = code('lib/visits.js');
  assert.doesNotMatch(s, /Notification|showNotification|alert\(/);
  assert.match(NO_REMINDER_NOTE, /鳴らしません/);
  const v = normalizeVisit({ on: '2026-09-10', place: 'ないか', questions: [{ text: '薬のこと' }] });
  assert.equal(v.questions.length, 1);
  assert.equal(v.questions[0].asked, false);
  assert.equal(normalizeVisit({ on: 'いつか' }), null);
  const list = normalizeVisits([{ on: '2026-09-20' }, { on: '2026-09-10' }]);
  assert.equal(list[0].on, '2026-09-10');
  assert.equal(daysUntil(nextVisit(list, '2026-09-03'), '2026-09-03'), 7);
  assert.match(visitLine(nextVisit(list, '2026-09-03'), '2026-09-03'), /あと7日/);
  assert.equal(openQuestions(v).length, 1);
  // 受診していなければ引き継がない
  assert.equal(carryOverText(v), '');
  const done = normalizeVisit({ on: '2026-09-01', after: { done: true, said: 'そのまま様子を見る' } });
  assert.match(carryOverText(done), /そのまま様子を見る/);
});

// ───────────────────── CSV（提案28・追加7） ─────────────────────

test('CSV はセルを数式にさせない・BOM を付ける・判定を書き出さない', () => {
  assert.equal(cell('=SUM(1)'), "'=SUM(1)");
  assert.equal(cell('+1'), "'+1");
  assert.equal(cell('あ,い'), '"あ,い"');
  assert.equal(cell('あ"い'), '"あ""い"');
  const days = { '2026-09-01': day('2026-09-01', { belly: 'hard', water: 'more' }) };
  const csv = daysToCsv(days, ['2026-09-01', '2026-09-02']);
  assert.ok(csv.startsWith('﻿'), 'BOM が無い');
  // 空の日を行にしない
  assert.equal(csv.trim().split('\r\n').length, 2);
  // 判定・平均の列を持たない
  for (const head of HEADERS) {
    for (const bad of [/平均/, /スコア/, /点/, /判定/, /危険/]) assert.doesNotMatch(head, bad, head);
  }
  assert.match(csvFilename(['2026-09-01', '2026-09-30']), /^chou-2026-09-01_2026-09-30\.csv$/);
});

// ───────────────────── 受け渡し（提案29） ─────────────────────

test('受け渡しは壊れていたら理由を返す・QR に入らなければ入ったふりをしない', () => {
  const text = encodeTransfer({ days: { '2026-09-01': { note: 'あ' } } });
  const back = decodeTransfer(text);
  assert.ok(back.ok);
  assert.equal(back.data.days['2026-09-01'].note, 'あ');
  assert.equal(decodeTransfer('').ok, false);
  assert.match(decodeTransfer('よそのもじれつ').reason, /このアプリの/);
  assert.match(decodeTransfer('chou1:%%%').reason, /切れて|読み取れ/);
  assert.ok(fitsInQr('a'.repeat(QR_LIMIT)));
  assert.ok(!fitsInQr('a'.repeat(QR_LIMIT + 1)));
  // 入らない時は null（**入ったふりをしない**）
  assert.equal(toMatrix(() => { throw new Error('too big'); }, 'x'), null);
});

// ───────────────────── エラーの記録（追加8） ─────────────────────

test('エラーは端末の中だけ・溜め続けない・人を責めない', () => {
  const s = code('lib/errorLog.js');
  for (const bad of [/fetch\s*\(/, /XMLHttpRequest/, /sendBeacon/]) assert.doesNotMatch(s, bad);
  assert.equal(makeEntry({ message: '' }), null);
  let list = [];
  for (let i = 0; i < MAX_ITEMS + 5; i += 1) list = addEntry(list, makeEntry({ message: `err${i}`, at: i + 1 }));
  assert.equal(list.length, MAX_ITEMS);
  assert.equal(list[0].message, `err${MAX_ITEMS + 4}`);
  assert.equal(normalizeErrors([{ message: 'a' }, { nope: 1 }]).length, 1);
  assert.match(formatAt(Date.now()), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.equal(formatAt(0), '');
  assert.match(toText([]), /ありません/);
  // 画面の文が人を責めない
  const boundary = src('components/ErrorBoundary.jsx');
  assert.match(boundary, /あなたの操作が悪かったわけではありません/);
  assert.match(boundary, /記録は消えていません/);
});

// ───────────────────── 読み上げ・音声入力（提案25・30） ─────────────────────

test('読み上げ・音声入力は、使えない端末で使えるふりをしない', () => {
  assert.equal(canSpeak(), false);
  assert.equal(canListen(), false);
  assert.equal(toSpeech('**あ**  い'), 'あ い');
  // 英語の状態名をそのまま出さない
  for (const kind of ['not-allowed', 'no-speech', 'audio-capture', 'network', 'なぞ']) {
    const line = errorLine(kind);
    assert.doesNotMatch(line, /[a-z]{4,}/, line);
  }
  // 端末内保存の例外だと必ず書く
  assert.match(VOICE_OPT_IN_NOTE, /例外/);
  assert.match(VOICE_OPT_IN_NOTE, /サーバー/);
  assert.match(VOICE_OPT_IN_NOTE, /既定/);
});

// ───────────────────── 印刷・共有（提案13・追加1・2） ─────────────────────

test('印刷は白い紙に黒い字・貼った文字をタグとして読ませない', () => {
  assert.equal(escapeHtml('<b>&"'), '&lt;b&gt;&amp;"');
  const html = printHtml('受診メモ', '<script>x</script>');
  assert.match(html, /background:#fff/);
  assert.match(html, /color:#000/);
  assert.doesNotMatch(html, /<script>x<\/script>/);
  assert.equal(canShare(), false);
});

// ───────────────────── まとめ・目次への登録（決まり77） ─────────────────────

test('新しい素材は、まとめの登録にも入っている', async () => {
  const { DIGEST_SUBJECTS } = await import('../src/lib/digest.js');
  for (const id of ['diseases', 'breathing', 'ibscare', 'eatingout', 'flora']) {
    assert.ok(DIGEST_SUBJECTS.some((s) => s.id === id), `${id} がまとめから漏れている`);
  }
});

// ───────────────────── 端末に入れる（提案27・追加3） ─────────────────────

test('PWA 一式がそろっていて、通知を持たない', () => {
  const dir = new URL('../public/', import.meta.url);
  for (const name of ['manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png', 'icon-maskable.png']) {
    assert.ok(existsSync(new URL(name, dir)), `${name} が無い`);
  }
  const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', dir), 'utf8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.length >= 2);
  assert.ok(manifest.shortcuts.some((s) => s.url.includes('view=home')), '「今日の記録」への近道が無い');
  const sw = readFileSync(new URL('sw.js', dir), 'utf8');
  // **通知を持たない**（決まり6）
  for (const bad of [/showNotification/, /periodicsync/i, /'push'/, /"push"/]) {
    assert.doesNotMatch(sw, bad, `sw.js: ${bad}`);
  }
  // ページ本体は network-first（開くたびに最新を取りに行く）
  assert.match(sw, /navigate/);
  assert.match(sw, /caches\.open/);
});

// ───────────────────── 印刷の見た目・読みやすさ（追加4・5） ─────────────────────

test('印刷は白地に反転し、読みやすさの設定は根っこだけで効かせる', () => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /@media print/);
  assert.match(css, /data-text='large'/);
  assert.match(css, /data-contrast='high'/);
  assert.match(css, /data-motion='reduce'/);
  // 画面ごとに書いていない（App が根っこの属性を立てるだけ）
  const app = src('App.jsx');
  assert.match(app, /data-text/);
  assert.match(app, /data-contrast/);
  assert.match(app, /data-motion/);
});

// ───────────────────── 画面がそろっている ─────────────────────

test('新しい画面はすべて App から開ける', () => {
  const app = src('App.jsx');
  for (const view of ['diseases', 'breathing', 'ibscare', 'eatingout', 'flora', 'visits', 'periods']) {
    assert.match(app, new RegExp(`view === '${view}'`), `${view} が App に無い`);
  }
  // しらべるからも辿れる（一覧は data/knowMenu.js が単一の正）
  const menu = src('data/knowMenu.js');
  for (const view of ['diseases', 'breathing', 'ibscare', 'eatingout', 'flora', 'visits', 'periods']) {
    assert.match(menu, new RegExp(`view: '${view}'`), `${view} へ行く道が無い`);
  }
  // 部品が置いてある
  for (const name of ['Finder.jsx', 'ErrorBoundary.jsx', 'ScrollArrows.jsx', 'RedFlagLink.jsx']) {
    assert.ok(readdirSync(new URL('../src/components/', import.meta.url)).includes(name), name);
  }
});

// ───────────────────── しらべるの一覧（2026-09-05） ─────────────────────

test('しらべるの一覧はデータから導く（画面に一覧を書かない）', async () => {
  const { KNOW_ITEMS, KNOW_GROUPS, groupItems } = await import('../src/data/knowMenu.js');
  const know = src('components/Know.jsx');
  // 画面はデータを読んで並べるだけ（行き先を画面に書き写さない）
  assert.match(know, /KNOW_ITEMS/);
  assert.doesNotMatch(know, /onGo\('(diseases|fodmap|settings|ibs)'\)/);
  // まとまりは4つで、並びが画面の並び
  assert.equal(KNOW_GROUPS.length, 4);
  assert.deepEqual(KNOW_GROUPS.map((g) => g.id), ['visit', 'tool', 'read', 'app']);
  // 空のまとまりは出さない
  assert.equal(groupItems([]).length, 0);
  assert.equal(groupItems(KNOW_ITEMS).length, 4);
});

test('しらべるは1画面につき入口ひとつ・読みを手で持つ', async () => {
  const { KNOW_ITEMS, KNOW_GROUPS } = await import('../src/data/knowMenu.js');
  const groups = new Set(KNOW_GROUPS.map((g) => g.id));
  const views = [];
  for (const item of KNOW_ITEMS) {
    assert.ok(item.id && item.title && item.desc, item.id);
    assert.ok(groups.has(item.group), `${item.id}: 知らないまとまり`);
    // **読みは手で持つ**（漢字の読みを機械が当てない。README 決まり11）
    assert.ok(item.reading, `${item.id}: 読みが無い`);
    assert.ok(!/[一-龠]/.test(item.reading), `${item.id}: 読みに漢字が残っている`);
    // 行き先は「画面」か「外のリンク」のどちらか一方だけ
    assert.ok(Boolean(item.view) !== Boolean(item.link), `${item.id}: 行き先が二重／無い`);
    if (item.view) views.push(item.view);
  }
  // **同じ行き先を2か所に置かない**
  assert.equal(new Set(views).size, views.length, '同じ画面への入口が2つある');
  // ふだんの言い方（任意）。**新しい主張を作らない**——あるのは呼び名だけ
  for (const item of KNOW_ITEMS) {
    for (const word of item.keywords || []) {
      assert.ok(word && !/[一-龠]{3,}/.test(word), `${item.id}: ${word}`);
    }
  }
  // URL はデータに書かない（画面側が持つ）
  const menu = src('data/knowMenu.js');
  assert.doesNotMatch(menu, /https?:/);
  assert.match(src('components/Know.jsx'), /const LINKS = \{/);
});

test('App が開ける画面は、ナビか しらべる のどちらかから必ず行ける', async () => {
  const { KNOW_ITEMS } = await import('../src/data/knowMenu.js');
  const app = src('App.jsx');
  const views = [...app.matchAll(/view === '([a-z]+)'/g)].map((m) => m[1]);
  // 下部ナビの5つと、常設バーの受診メモは別の道で行ける
  const nav = new Set(['home', 'calendar', 'look', 'know', 'toc', 'visitnote']);
  const inMenu = new Set(KNOW_ITEMS.map((i) => i.view));
  for (const view of views) {
    assert.ok(nav.has(view) || inMenu.has(view), `${view} へ行く道がどこにも無い`);
  }
  // 下部ナビは5つのまま（増やすときは列の数も一緒に直す）
  assert.match(app, /gridTemplateColumns: `repeat\(\$\{NAV\.length\}, 1fr\)`/);
});

test('記録の道具は、カレンダーからも行ける', () => {
  const cal = src('components/Calendar.jsx');
  assert.match(cal, /id="cal-tools"/);
  assert.match(cal, /onGo\('periods'\)/);
  assert.match(cal, /onGo\('visits'\)/);
  // **判定しないと必ず添える**
  assert.match(cal, /症状の理由をアプリが決めることはありません/);
});
