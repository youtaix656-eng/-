import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PERSON_TYPES, CORES, CORE_MAP, SCENES, SCENE_MAP, allBehaviors } from '../src/data/people.js';
import { analyzePerson, coresOf, MIN_PER_TYPE, MIN_TOTAL } from '../src/lib/analysis.js';
import { REPLY_MAP } from '../src/data/replies.js';
import { TACTIC_MAP } from '../src/data/tactics.js';

test('id・名前は重複せず、読みを持つ', () => {
  const ids = PERSON_TYPES.map((t) => t.id);
  const names = PERSON_TYPES.map((t) => t.name);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(names).size, names.length);
  for (const t of PERSON_TYPES) assert.match(t.reading, /^[ぁ-ゖー・]+$/u, `${t.name}: 読みが不正`);
  for (const c of CORES) assert.match(c.reading, /^[ぁ-ゖー・]+$/u, `${c.label}: 読みが不正`);
  for (const sc of SCENES) assert.match(sc.reading, /^[ぁ-ゖー・]+$/u, `${sc.label}: 読みが不正`);
});

test('中身がそろっている（ふるまい・なぜ・距離）', () => {
  for (const t of PERSON_TYPES) {
    assert.ok(t.summary && t.why, `${t.name}: summary か why が空`);
    assert.ok(t.behaviors.length >= 3, `${t.name}: ふるまいが3つ未満`);
    assert.ok(t.distance && t.distance.length > 0, `${t.name}: 取れる距離が空`);
    for (const id of t.replyIds) assert.ok(REPLY_MAP[id], `${t.name}: 存在しない返し方 ${id}`);
    for (const id of t.relatedTacticIds) assert.ok(TACTIC_MAP[id], `${t.name}: 存在しない型 ${id}`);
    for (const c of t.cores || []) assert.ok(CORE_MAP[c], `${t.name}: 未知の芯 ${c}`);
    assert.ok((t.scenes || []).length > 0, `${t.name}: 場面がありません`);
    for (const x of t.scenes) assert.ok(SCENE_MAP[x], `${t.name}: 未知の場面 ${x}`);
  }
});

test('年齢・性別・属性で分けない（分けるのはふるまいだけ）', () => {
  // 「女性は」「高齢者は」のように人を属性でくくる書き方を弾く
  const attribute = /女(は|性は|の人は)|男(は|性は|の人は)|高齢者|お年寄り|年寄り|おばさん|おじさん|若者は|今の若い人(?!」)|主婦|ゆとり世代|外国人/;
  const texts = [];
  for (const t of PERSON_TYPES) texts.push(t.name, t.summary, t.why, t.distance, ...t.behaviors);
  for (const c of CORES) texts.push(c.label, c.summary);
  for (const text of texts) {
    const m = String(text).match(attribute);
    assert.ok(!m, `「${text}」に属性でくくる言い方「${m && m[0]}」が入っています`);
  }
});

test('人を採点しない・順位を付けない・診断名を当てない', () => {
  const judging = /危険度|点満点|\d+\s*点|ランク|レベル\d|サイコパス|人格障害|発達障害|うつ病|モラハラ加害者です/;
  for (const t of PERSON_TYPES) {
    const body = [t.summary, t.why, t.distance, ...t.behaviors].join(' ');
    const m = body.match(judging);
    assert.ok(!m, `${t.name}: 採点・診断の言い方「${m && m[0]}」が入っています`);
  }
});

test('「関わらないほうがいい人」というレッテルを貼らない（決めるのは距離）', () => {
  const labeling = /関わらないほうがいい人|縁を切るべき|排除|切り捨て|毒人間|クズ|最低な人間/;
  for (const t of PERSON_TYPES) {
    const body = [t.summary, t.why, t.distance].join(' ');
    const m = body.match(labeling);
    assert.ok(!m, `${t.name}: 人へのレッテル「${m && m[0]}」が入っています`);
  }
});

test('取れる距離は、相手の同意が要らないことにする', () => {
  const needsOther = /分からせ|納得させ|反省させ|謝らせ|改めさせ|変えさせる|やめさせる/;
  for (const t of PERSON_TYPES) {
    const m = t.distance.match(needsOther);
    assert.ok(!m, `${t.name}: 「${m && m[0]}」は相手の同意が要ります`);
  }
});

test('ふるまいの id は重複せず、型と1対1で対応する', () => {
  const all = allBehaviors();
  const ids = all.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(all.length, PERSON_TYPES.reduce((n, t) => n + t.behaviors.length, 0));
  for (const b of all) assert.ok(PERSON_TYPES.some((t) => t.id === b.typeId), `${b.id}: 型が見つからない`);
});

test('1つ当たっただけでは型を出さない（当てずっぽうの断定にしない）', () => {
  const r = analyzePerson(['mood_rules:0'], PERSON_TYPES);
  assert.deepEqual(r.matches, []);
  assert.equal(MIN_PER_TYPE >= 2, true);
});

test('チェックが少ないうちは黙らず「まだ足りない」と言い分ける', () => {
  assert.equal(analyzePerson([], PERSON_TYPES).status, 'empty');
  assert.equal(analyzePerson(['mood_rules:0', 'mood_rules:1'], PERSON_TYPES).status, 'few');
  // そろえば出る
  const ok = analyzePerson(['mood_rules:0', 'mood_rules:1', 'mood_rules:2'], PERSON_TYPES);
  assert.equal(ok.status, 'ok');
  assert.equal(ok.matches[0].type.id, 'mood_rules');
  // そろっていても同じ型が2つ未満なら none
  const none = analyzePerson(['mood_rules:0', 'never_wrong:0', 'drains:0'], PERSON_TYPES);
  assert.equal(none.status, 'none');
  assert.ok(MIN_TOTAL >= 3);
});

test('見立ては点数を返さない（返すのは選んだふるまいだけ）', () => {
  const r = analyzePerson(['mood_rules:0', 'mood_rules:1', 'never_wrong:0', 'never_wrong:1'], PERSON_TYPES);
  for (const m of r.matches) {
    assert.deepEqual(Object.keys(m).sort(), ['behaviors', 'type']);
    for (const bad of ['score', 'risk', 'level', 'rank', 'percent']) {
      assert.ok(!(bad in m), `${bad} を返しています`);
    }
  }
});

test('当たった数の多い順（同数はカタログの並び順）', () => {
  const r = analyzePerson(
    ['mood_rules:0', 'mood_rules:1', 'mood_rules:2', 'never_wrong:0', 'never_wrong:1'],
    PERSON_TYPES,
  );
  for (let i = 1; i < r.matches.length; i += 1) {
    assert.ok(r.matches[i - 1].behaviors.length >= r.matches[i].behaviors.length);
  }
});

test('芯は数えるだけにせず、当たった芯の一覧を返す', () => {
  const r = analyzePerson(['mood_rules:0', 'mood_rules:1', 'never_wrong:0', 'never_wrong:1'], PERSON_TYPES);
  const cores = coresOf(r.matches);
  assert.ok(cores.every((c) => CORE_MAP[c]), '未知の芯が入っています');
  assert.equal(new Set(cores).size, cores.length, '芯が重複しています');
});

test('結果を保存しない・ネットワークに触れない', () => {
  for (const f of ['../src/lib/analysis.js', '../src/data/people.js', '../src/components/People.jsx']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/, `${f}: ネットワークに触れています`);
    assert.doesNotMatch(src, /localStorage|indexedDB|from '\.\.\/lib\/storage\.js'|useStore/, `${f}: 保存しています`);
  }
});

test('画面に出る文にマークダウンを書かない', () => {
  const texts = [];
  for (const t of PERSON_TYPES) texts.push(t.name, t.summary, t.why, t.distance, ...t.behaviors);
  for (const c of CORES) texts.push(c.label, c.summary);
  for (const t of texts) assert.ok(!String(t).includes('**'), `「${t}」に ** が入っています`);
});

test('場面は「どこで起きたか」であって、誰がやったかではない', () => {
  // 場面の名前に人の属性が入っていないこと
  const attribute = /女|男|高齢|年寄|若者|主婦|外国人|世代/;
  for (const sc of SCENES) {
    const m = sc.label.match(attribute);
    assert.ok(!m, `場面「${sc.label}」が人の属性で分けられています`);
  }
  // どの場面にも、少なくとも1つの型がある
  for (const sc of SCENES) {
    const n = PERSON_TYPES.filter((t) => (t.scenes || []).includes(sc.id)).length;
    assert.ok(n > 0, `場面「${sc.label}」に型が1件もありません`);
  }
});

test('元にした文章のふるまいが、どこかの型に入っている（落としていない）', () => {
  const all = allBehaviors().map((b) => b.text).join(' ');
  const must = [
    ['二重基準', /自分には甘く/],
    ['利益になる時だけ近づく', /得がある時だけ/],
    ['苦労自慢', /私のほうが大変/],
    ['昔の価値観の押し付け', /昔のやり方/],
    ['引き際がない', /引き際がなく/],
    ['ドタキャン', /当日に、理由をつけて取りやめ/],
    ['噂で人を評価する', /噂と比べ合い/],
    ['恥をかかされると激怒', /恥をかかされた/],
    ['見て見ぬふり', /気づいているのに、注意しない/],
    ['実害が出ても止めない', /実害が出ているのに/],
    ['まだ小さいから', /まだ小さいから/],
    ['注意した側に怒る', /注意したほうに怒る/],
  ];
  for (const [name, re] of must) {
    assert.match(all, re, `「${name}」がどの型にも入っていません`);
  }
});
