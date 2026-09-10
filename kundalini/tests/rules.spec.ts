import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAKRAS, CHAKRA_DISCLAIMER } from '../src/data/chakras.js';
import { PRACTICES } from '../src/data/breathing.js';
import { TRIGGERS } from '../src/data/triggers.js';
import { BADGES } from '../src/data/badges.js';
import { WORDS } from '../src/data/words.js';
import { HELP_NOTE, OUT_OF_SCOPE } from '../src/data/safety.js';

// このアプリが自分で言っている約束を、機械でチェックする。
// ⚠ 見張るのは「アプリ自身が言っていること」だけ——コメント行は落としてから見る
//    （「責める言い方を置かない」と書いたコメント自身が引っかかるため）。

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function files(dir: string, ext: string[]): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    if (ext.some((e) => name.endsWith(e))) out.push(join(ROOT, dir, name));
  }
  return out;
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
}

const LIB = files('src/lib', ['.ts']);
const DATA = files('src/data', ['.ts']);
const COMPONENTS = files('src/components', ['.tsx']);
const ALL = [...LIB, ...DATA, ...COMPONENTS, join(ROOT, 'src/App.tsx')];

test('src/lib はネットワークに触れない（記録をどこへも送らない、の根拠）', () => {
  for (const file of LIB) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const bad of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'EventSource']) {
      assert.ok(!src.includes(bad), `${file} に ${bad} がある`);
    }
  }
});

test('画面・データからも外部へ送らない', () => {
  for (const file of [...DATA, ...COMPONENTS]) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const bad of ['fetch(', 'XMLHttpRequest', 'sendBeacon']) {
      assert.ok(!src.includes(bad), `${file} に ${bad} がある`);
    }
  }
});

test('データに URL を書かない（確かめられないリンクを載せない）', () => {
  for (const file of DATA) {
    const src = readFileSync(file, 'utf8');
    assert.ok(!/https?:\/\//.test(src), `${file} に URL がある`);
  }
});

test('人を責める言い方を置かない', () => {
  const banned = ['意志が弱', '甘え', '自業自得', 'だらしな', 'クズ', '負け組', '情けな', '落ち度', '堕落', '汚れた'];
  for (const file of ALL) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const word of banned) {
      assert.ok(!src.includes(word), `${file} に「${word}」がある`);
    }
  }
});

test('効果を言い切らない（確かめる手立てを持たないことは書かない）', () => {
  const banned = [
    'テストステロン',
    'モテ',
    '精力',
    '若返',
    '寿命が',
    '病気が治',
    '必ず良くなる',
    '効果があります',
    '科学的に証明',
    '覚醒します',
    '能力が上がる',
  ];
  for (const file of ALL) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const word of banned) {
      assert.ok(!src.includes(word), `${file} に「${word}」がある`);
    }
  }
});

test('効き目の大きさを数字で書かない（◯%・◯倍を持たない）', () => {
  for (const file of DATA) {
    const src = stripComments(readFileSync(file, 'utf8'));
    assert.ok(!/[0-9０-９]\s*[%％]/.test(src), `${file} に割合の数字がある`);
    assert.ok(!/[0-9０-９]\s*倍/.test(src), `${file} に倍率がある`);
  }
});

test('平均を返す関数を作らない（5段階の平均は誤解を生む）', () => {
  const src = stripComments(readFileSync(join(ROOT, 'src/lib/analysis.ts'), 'utf8'));
  assert.ok(!/function\s+(average|mean|avg)\b/.test(src));
  assert.ok(!/export\s+const\s+(average|mean|avg)\b/.test(src));
});

test('日付を UTC で読み書きしない（日本時間の午前0時が前日になるため）', () => {
  for (const file of ALL) {
    const src = stripComments(readFileSync(file, 'utf8'));
    assert.ok(!src.includes('toISOString('), `${file} に toISOString がある`);
  }
});

test('チャクラの前置き（医学ではない）を、ホームと設定の両方に出している', () => {
  const used = COMPONENTS.filter((f) => readFileSync(f, 'utf8').includes('CHAKRA_DISCLAIMER'));
  assert.ok(used.length >= 2, '前置きを出している画面が足りない');
  assert.ok(used.some((f) => f.endsWith('HomeView.tsx')));
  assert.ok(used.some((f) => f.endsWith('SettingsView.tsx')));
  assert.match(CHAKRA_DISCLAIMER, /医学/);
});

test('相談先の案内を、複数の画面から出している（消さない・弱めない）', () => {
  const used = [...COMPONENTS].filter((f) => readFileSync(f, 'utf8').includes('HELP_NOTE'));
  assert.ok(used.length >= 3, `相談先を出している画面が ${used.length} 件しかない`);
  assert.match(HELP_NOTE, /医療機関|相談窓口/);
  assert.ok(OUT_OF_SCOPE.length >= 4);
});

test('瞑想の画面は回数・連続日数を記録しない', () => {
  const src = readFileSync(join(ROOT, 'src/components/MeditateView.tsx'), 'utf8');
  assert.ok(!/actions\.log/.test(src), '瞑想の記録を残している');
  assert.ok(!/streak|連続日数/.test(stripComments(src)));
});

test('データがそろっている（1件でも欠けたら画面に穴があく）', () => {
  assert.equal(CHAKRAS.length, 7);
  for (const c of CHAKRAS) {
    assert.ok(c.name && c.reading && c.part && c.color && c.note && c.theme);
    assert.ok(PRACTICES.some((p) => p.id === c.practiceId), `${c.name} の瞑想が見つからない`);
  }
  for (const p of PRACTICES) {
    assert.ok(p.title && p.summary && p.stop, `${p.id} にやめどきが無い`);
  }
  for (const t of TRIGGERS) {
    assert.ok(t.label && t.care, `${t.id} に手当てが無い`);
  }
  for (const b of BADGES) {
    assert.ok(b.title && b.word);
  }
  assert.ok(WORDS.length >= 8);
});

test('ひとことに実在の人物の名前を付けない（出典を作らない）', () => {
  for (const w of WORDS) {
    assert.ok(!/氏|さんの言葉|より引用|『|』/.test(w), `「${w}」が引用の形になっている`);
  }
});

test('画面に出す文にマークダウンを書かない（** がそのまま表示されるため）', () => {
  const strings = [
    ...CHAKRAS.map((c) => c.note),
    ...PRACTICES.map((p) => `${p.summary}${p.stop}`),
    ...TRIGGERS.map((t) => t.care),
    ...BADGES.map((b) => b.word),
    ...WORDS,
    CHAKRA_DISCLAIMER,
    HELP_NOTE,
    ...OUT_OF_SCOPE,
  ];
  for (const s of strings) {
    assert.ok(!s.includes('**'), `「${s}」にマークダウンが入っている`);
  }
});
