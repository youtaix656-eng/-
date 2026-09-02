import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalize, normalizeCue, findCue, detectTactics, highlightRanges, splitByHighlight, MIN_TEXT } from '../src/lib/detect.js';
import { TACTICS } from '../src/data/tactics.js';

test('そろえ方：全角英数・カタカナ・空白', () => {
  assert.equal(normalize('ＡＢＣ').text, 'abc');
  assert.equal(normalize('カタカナ').text, 'かたかな');
  assert.equal(normalize('今日 中\nに').text, '今日中に');
});

test('そろえても、元の文面の位置に戻せる', () => {
  const src = '今日 中に';
  const norm = normalize(src);
  assert.equal(norm.text, '今日中に');
  // そろえた後の 2 文字目「中」は、元では 3 文字目（空白のぶんずれる）
  assert.equal(norm.map[2], 3);
});

test('語は空白をまたいでも当たり、元の範囲を返す', () => {
  const src = '本日 限りです';
  const hits = findCue(normalize(src), '本日限り');
  assert.equal(hits.length, 1);
  assert.equal(src.slice(hits[0].start, hits[0].end), '本日 限り');
});

test('カタカナ・全角で書かれていても当たる', () => {
  assert.equal(normalizeCue('ノリが悪い'), 'のりが悪い');
  const r = detectTactics('ジョウダンだよ、本気にしないで。ノリが悪いなあ。', TACTICS);
  assert.ok(r.matches.some((m) => m.tactic.id === 'just_joking'));
});

test('短すぎる文面は判定しない（が、黙りもしない）', () => {
  const r = detectTactics('今日中', TACTICS);
  assert.equal(r.status, 'short');
  assert.deepEqual(r.matches, []);
  assert.ok(r.length < MIN_TEXT);
});

test('当たらなかった時も status で言い分ける', () => {
  const r = detectTactics('明日は雨が降るそうなので、傘を持っていこうと思っています。', TACTICS);
  assert.equal(r.status, 'none');
  assert.deepEqual(r.matches, []);
});

test('当たった型には、当たった語が必ず添えられる（当てずっぽうを断定しない）', () => {
  const r = detectTactics('今日中に決めていただかないと、この場でご返事をお願いします。', TACTICS);
  assert.equal(r.status, 'ok');
  for (const m of r.matches) {
    assert.ok(m.cues.length > 0, `${m.tactic.name}: 当たった語が空`);
    assert.ok(m.hits.length > 0, `${m.tactic.name}: 当たった位置が空`);
    for (const h of m.hits) assert.ok(h.end > h.start, '範囲が不正');
  }
});

test('当たった語の多い型が先に来る（同数ならカタログの並び順）', () => {
  const text = '今日中に、この場で、本日限りでお願いします。皆さんやっていますよ。';
  const r = detectTactics(text, TACTICS);
  assert.equal(r.matches[0].tactic.id, 'deadline');
  for (let i = 1; i < r.matches.length; i += 1) {
    assert.ok(r.matches[i - 1].cues.length >= r.matches[i].cues.length, '語の数の順になっていません');
  }
});

test('点数を返さない（返しているのは当たった語だけ）', () => {
  const r = detectTactics('今日中に決めてください。皆さんやっていますよ。', TACTICS);
  for (const m of r.matches) {
    assert.ok(!('score' in m), 'score を返しています');
    assert.ok(!('risk' in m), 'risk を返しています');
    assert.ok(!('level' in m), 'level を返しています');
  }
});

test('同じ語が何度も出ても、拾う箇所には上限がある', () => {
  const text = '今日中。'.repeat(20);
  const r = detectTactics(text, TACTICS);
  const m = r.matches.find((x) => x.tactic.id === 'deadline');
  assert.ok(m.hits.length <= 3, `${m.hits.length} 箇所も拾っています`);
});

test('ハイライトの範囲は重ならず、元の文面を組み直せる', () => {
  const text = 'この場で今日中に決めてください。皆さんやっていますよ。';
  const r = detectTactics(text, TACTICS);
  const ranges = highlightRanges(r.matches);
  for (let i = 1; i < ranges.length; i += 1) {
    assert.ok(ranges[i].start >= ranges[i - 1].end, '範囲が重なっています');
  }
  const parts = splitByHighlight(text, r.matches);
  assert.equal(parts.map((p) => p.text).join(''), text, '組み直すと元の文面に戻ること');
  assert.ok(parts.some((p) => p.hit), '当たった部分が印されていません');
});

test('空文字・null でも落ちない', () => {
  for (const bad of ['', null, undefined]) {
    const r = detectTactics(bad, TACTICS);
    assert.equal(r.status, 'short');
    assert.deepEqual(splitByHighlight(bad, []), []);
  }
});

test('後読み（lookbehind）を使わない（古い Safari で読み込みごと落ちるため）', () => {
  for (const f of ['../src/lib/detect.js', '../src/lib/privacy.js']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    // 正規表現の (?<= / (?<! 。コメント中の説明文には現れない形で見る
    assert.ok(!/\(\?<[=!]/.test(src), `${f}: 後読みが使われています`);
  }
});
