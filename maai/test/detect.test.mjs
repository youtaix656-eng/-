import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TACTICS } from '../src/data/tactics.js';
import {
  normalize,
  findCue,
  detectTactics,
  highlightRanges,
  splitByHighlight,
  MIN_TEXT,
} from '../src/lib/detect.js';

test('そろえ方：全角・カタカナ・空白の違いを吸収する', () => {
  assert.equal(normalize('今日 中に').text, '今日中に');
  assert.equal(normalize('ラブ').text, 'らぶ');
  assert.equal(normalize('ＳＮＳ').text, 'sns');
});

test('当たった箇所は、元の文面での位置で返る（空白をまたいでも）', () => {
  const norm = normalize('もう 終電ないよ');
  const hits = findCue(norm, '終電ない');
  assert.equal(hits.length, 1);
  assert.equal('もう 終電ないよ'.slice(hits[0].start, hits[0].end), '終電ない');
});

test('短い文面は判定しない（たまたま当たるだけになるため）', () => {
  const r = detectTactics('今日中', TACTICS);
  assert.equal(r.status, 'short');
  assert.equal(r.matches.length, 0);
  assert.ok(MIN_TEXT >= 8);
});

test('当たらなかったときも黙らない（status を返す）', () => {
  const r = detectTactics('明日は雨が降るみたいだから、傘を持っていったほうがいいですよ。', TACTICS);
  assert.equal(r.status, 'none');
});

test('その日の段取りで決めさせる型に当たる', () => {
  const r = detectTactics(
    '今日しかないから、もう一軒だけ行こうよ。終電もう無いし、うちで飲み直そう。',
    TACTICS,
  );
  assert.equal(r.status, 'ok');
  const ids = r.matches.map((m) => m.tactic.id);
  assert.ok(ids.includes('today_only'));
  assert.ok(ids.includes('next_place'));
  assert.ok(ids.includes('last_train'));
});

test('断りを押し返す型に当たる', () => {
  const r = detectTactics('またまた、照れてるだけでしょ。ここまでしたのに、なんでダメなの？', TACTICS);
  const ids = r.matches.map((m) => m.tactic.id);
  assert.ok(ids.includes('no_as_yes'));
  assert.ok(ids.includes('guilt'));
  assert.ok(ids.includes('ask_again'));
});

test('自分の感覚を疑わせる型に当たる', () => {
  const r = detectTactics('そんなこと言ってないよ。考えすぎだって、思い込みが激しいよね。', TACTICS);
  const ids = r.matches.map((m) => m.tactic.id);
  assert.ok(ids.includes('gaslight'));
  assert.ok(ids.includes('too_heavy'));
});

test('当たった語を必ず返す（見せない判定は当てずっぽうと同じ）', () => {
  const r = detectTactics('こんな気持ちになったのは初めてです。運命だと思う。', TACTICS);
  const m = r.matches.find((x) => x.tactic.id === 'love_bomb');
  assert.ok(m);
  assert.ok(m.cues.includes('運命'));
  assert.ok(m.hits.length > 0);
});

test('当たった箇所は重ならない範囲にまとめられる', () => {
  const text = '今日しかないよ、今日しかない。';
  const r = detectTactics(text, TACTICS);
  const ranges = highlightRanges(r.matches);
  for (let i = 1; i < ranges.length; i += 1) {
    assert.ok(ranges[i - 1].end <= ranges[i].start, '範囲が重なっています');
  }
  const parts = splitByHighlight(text, r.matches);
  assert.equal(parts.map((p) => p.text).join(''), text, '元の文面が復元できること');
});

test('判定は端末の中だけで完結する（ネットワークに触れない）', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/lib/detect.js', import.meta.url), 'utf8');
  for (const word of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'navigator.sendBeacon']) {
    assert.ok(!src.includes(word), `detect.js が ${word} を使っています`);
  }
});
