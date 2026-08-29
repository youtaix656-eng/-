import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TACTICS, CATEGORIES, CATEGORY_MAP, tacticsInCategory, textTactics, behaviorTactics } from '../src/data/tactics.js';
import { SOURCE_MAP, SOURCES } from '../src/data/sources.js';
import { REPLY_MAP, REPLIES } from '../src/data/replies.js';
import { detectTactics } from '../src/lib/detect.js';
import { MYTHS } from '../src/data/myths.js';
import { STATES } from '../src/data/states.js';

test('型の id・名前は重複しない', () => {
  const ids = TACTICS.map((t) => t.id);
  const names = TACTICS.map((t) => t.name);
  assert.equal(new Set(ids).size, ids.length, 'id の重複');
  assert.equal(new Set(names).size, names.length, '名前の重複');
});

test('すべての型が実在するカテゴリに属する（カテゴリは空にならない）', () => {
  for (const t of TACTICS) assert.ok(CATEGORY_MAP[t.category], `${t.name}: 未知のカテゴリ ${t.category}`);
  for (const c of CATEGORIES) assert.ok(tacticsInCategory(c.id).length > 0, `${c.label}: 型が1件もない`);
});

test('すべての型が出典を持ち、その出典は実在する', () => {
  for (const t of TACTICS) {
    assert.ok(t.sourceIds && t.sourceIds.length > 0, `${t.name}: 出典（sourceIds）がありません`);
    for (const id of t.sourceIds) assert.ok(SOURCE_MAP[id], `${t.name}: 存在しない出典 ${id}`);
  }
});

test('すべての型が返し方を持ち、その返し方は実在する', () => {
  for (const t of TACTICS) {
    assert.ok(t.replyIds && t.replyIds.length > 0, `${t.name}: 返し方（replyIds）がありません`);
    for (const id of t.replyIds) assert.ok(REPLY_MAP[id], `${t.name}: 存在しない返し方 ${id}`);
  }
});

test('すべての型が 見分け方・なぜ効くか を持つ', () => {
  for (const t of TACTICS) {
    assert.ok(t.summary && t.summary.length > 0, `${t.name}: summary が空`);
    assert.ok(t.why && t.why.length > 0, `${t.name}: why が空`);
    assert.ok(t.signs && t.signs.length >= 2, `${t.name}: 見分け方が2つ未満`);
  }
});

test('型は「言葉の型」か「ふるまいの型」のどちらかに分かれている', () => {
  for (const t of TACTICS) {
    assert.ok(['text', 'behavior'].includes(t.channel), `${t.name}: channel が ${t.channel}`);
  }
  assert.equal(textTactics().length + behaviorTactics().length, TACTICS.length);
  assert.ok(behaviorTactics().length > 0, 'ふるまいの型が1件もありません');
});

test('言葉の型は、言われる形の例を持つ', () => {
  for (const t of textTactics()) {
    assert.ok(t.lines && t.lines.length >= 1, `${t.name}: 言われる形の例がありません`);
  }
});

test('ふるまいの型は判定用の語を持たない（言葉ではないものを言葉から当てない）', () => {
  for (const t of behaviorTactics()) {
    assert.deepEqual(t.cues, [], `${t.name}: ふるまいの型なのに cues があります`);
    assert.deepEqual(t.lines, [], `${t.name}: ふるまいの型なのに「言われる形」があります`);
  }
});

test('ふるまいの型は、何を貼っても判定に出てこない', () => {
  const ids = new Set(behaviorTactics().map((t) => t.id));
  // カタログ全部を渡しても（＝呼び出し側が絞り忘れても）出てこないこと
  const texts = [
    behaviorTactics().map((t) => `${t.name} ${t.summary} ${t.why}`).join(' '),
    '眉間をじっと見つめられて、三秒だまってからゆっくり話し始められました。',
  ];
  for (const text of texts) {
    const r = detectTactics(text, TACTICS);
    for (const m of r.matches) {
      assert.ok(!ids.has(m.tactic.id), `${m.tactic.name}: ふるまいの型が判定に出ています`);
    }
  }
});

test('判定用の語（cues）は空でなく、重複もしない', () => {
  const seen = new Map();
  for (const t of textTactics()) {
    assert.ok(t.cues && t.cues.length >= 3, `${t.name}: cues が3件未満`);
    for (const cue of t.cues) {
      assert.ok(cue.trim().length >= 2, `${t.name}: 「${cue}」が短すぎます`);
      const owner = seen.get(cue);
      assert.ok(!owner, `語「${cue}」が ${owner} と ${t.name} で重複しています`);
      seen.set(cue, t.name);
    }
  }
});

test('どこにでも出る語を cues に入れない（何を貼っても全部当たるのを防ぐ）', () => {
  const tooCommon = ['です', 'ます', 'ありがとう', 'お願い', 'こんにちは', 'した', 'する', 'ない', 'いい', 'そう'];
  for (const t of textTactics()) {
    for (const cue of t.cues) {
      assert.ok(!tooCommon.includes(cue.trim()), `${t.name}: 「${cue}」は普通の会話にも出ます`);
    }
  }
});

test('関係のない文面では、ほとんどの型が当たらない', () => {
  const plain = '明日の会議は10時から会議室Aで行います。資料は前日までに共有しますので、目を通しておいてください。';
  const r = detectTactics(plain, TACTICS);
  assert.ok(r.matches.length <= 1, `普通の連絡で ${r.matches.length} 件も当たっています: ${r.matches.map((m) => m.tactic.name)}`);
});

test('それぞれの言葉の型は、自分の cues を並べた文面でちゃんと当たる', () => {
  for (const t of textTactics()) {
    const text = t.cues.join('。') + '。';
    const r = detectTactics(text, TACTICS);
    assert.ok(r.matches.some((m) => m.tactic.id === t.id), `${t.name}: 自分の語で当たりません`);
  }
});

test('言われる形の例（lines）は、その型の語を少なくとも1つ含む', () => {
  for (const t of textTactics()) {
    const joined = t.lines.join('');
    if (!joined.trim()) continue; // 「（返事をしない）」のような例だけの型は除く
    const r = detectTactics(joined, TACTICS);
    const hit = r.matches.some((m) => m.tactic.id === t.id);
    assert.ok(hit || r.status === 'short', `${t.name}: 例文が自分の型に当たりません（cues と例文がずれています）`);
  }
});

test('効き目の大きさを断定しない（「◯％の人が従う」のような数字を型に書かない）', () => {
  for (const t of TACTICS) {
    const body = [t.summary, t.why, ...t.signs].join(' ');
    assert.doesNotMatch(body, /\d+\s*[%％]/, `${t.name}: 手元にない割合を書いています`);
    assert.doesNotMatch(body, /危険度|スコア|点満点/, `${t.name}: 点数を付けています`);
  }
});

test('出典と返し方に、使われていないものが残っていない', () => {
  const usedSources = new Set([
    ...TACTICS.flatMap((t) => t.sourceIds),
    ...MYTHS.flatMap((m) => m.sourceIds || []),
    ...STATES.flatMap((st) => st.sourceIds || []),
  ]);
  const usedReplies = new Set(TACTICS.flatMap((t) => t.replyIds));
  for (const s of SOURCES) {
    // 相談窓口は返し方（window）からも参照されるので、型からの参照が無くてもよい
    if (s.kind === '相談窓口' || s.kind === '法令・公的制度') continue;
    assert.ok(usedSources.has(s.id), `出典「${s.tocTitle}」がどの型からも参照されていません`);
  }
  for (const r of REPLIES) assert.ok(usedReplies.has(r.id), `返し方「${r.tocTitle}」がどの型からも参照されていません`);
});

test('返し方に「言い返して勝つ」ための言葉を置かない', () => {
  const fighting = /論破|言い負か|やり込め|恥をかかせ|見返して|反撃/;
  for (const r of REPLIES) {
    const body = [r.summary, r.detail, ...(r.lines || [])].join(' ');
    assert.doesNotMatch(body, fighting, `${r.tocTitle}: 言い合いに持ち込む言葉が入っています`);
  }
});

test('判定は端末内だけ（データと判定のファイルがネットワークに触れない）', () => {
  const files = ['../src/lib/detect.js', '../src/lib/storage.js', '../src/lib/privacy.js', '../src/lib/records.js', '../src/data/tactics.js'];
  for (const f of files) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|new WebSocket/, `${f}: ネットワークに触れています`);
  }
});

test('別名（aka）は、型の名前とも他の別名とも重複しない', () => {
  const names = new Set(TACTICS.map((t) => t.name));
  const seen = new Map();
  for (const t of TACTICS) {
    for (const a of t.aka || []) {
      assert.ok(a.name && a.reading, `${t.name}: 別名に名前と読みの両方が要ります`);
      assert.match(a.reading, /^[ぁ-ゖー・]+$/u, `${t.name}: 別名「${a.name}」の読みがひらがなではありません`);
      assert.ok(!names.has(a.name), `${t.name}: 別名「${a.name}」が別の型の名前と同じです`);
      const owner = seen.get(a.name);
      assert.ok(!owner, `別名「${a.name}」が ${owner} と ${t.name} で重複しています`);
      seen.set(a.name, t.name);
    }
  }
});

test('世に出回っている呼び名から辿れる（別名を持たせて重複追加を防ぐ）', () => {
  const wanted = ['間欠強化', '希少性の原理', 'ツァイガルニク効果', '感情ジェットコースター効果', '安全基地効果', 'サード・アイ', '沈黙の圧力', '捕食者のテンポ'];
  const all = new Set(TACTICS.flatMap((t) => [t.name, ...(t.aka || []).map((a) => a.name)]));
  for (const w of wanted) {
    const hit = [...all].some((n) => n.includes(w) || w.includes(n));
    assert.ok(hit, `「${w}」から辿れる型がありません`);
  }
});

test('画面に出る文にマークダウンの記号を書かない（そのまま「**」と表示される）', () => {
  const texts = [];
  for (const t of TACTICS) texts.push(t.summary, t.why, ...t.signs, ...t.lines, ...(t.aka || []).map((a) => a.name));
  for (const c of CATEGORIES) texts.push(c.label, c.summary);
  for (const r of REPLIES) texts.push(r.summary, r.detail, ...(r.lines || []));
  for (const s of SOURCES) texts.push(s.title, s.note, s.tocTitle);
  for (const text of texts) {
    assert.ok(!String(text || '').includes('**'), `「${text}」に ** が入っています（そのまま表示されます）`);
  }
});
