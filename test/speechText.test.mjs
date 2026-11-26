import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReadingDict, applyReadingDict, toSpeechText, readSymbols, termsWithReading, addBodyWords,
  questionKindText, meridianFlowText, hasSun, shortenChoice, FIGURE_DESCRIPTIONS, splitSentences,
  pauseBeforeDirections, kanjiWords, buildHomophoneInfo, annotateHomophones, homophoneDrillItems, meridianShort,
} from '../src/lib/speechText.js';
import { KEIKETSU_CARDS } from '../src/data/keiketsuCards.js';
import { SPEECH_READINGS, HOMOPHONE_KANJI_HINTS } from '../src/data/speechReadings.js';
import { TERM_READINGS } from '../src/lib/yomi.js';
import { SEED_BANKS } from '../src/data/seedRegistry.js';

const dict = buildReadingDict({ cards: KEIKETSU_CARDS, termReadings: TERM_READINGS, common: SPEECH_READINGS });

test('経穴の読みで読む（少海・小海・照海はどれも「しょうかい」）', () => {
  assert.equal(applyReadingDict('少海と照海', dict), 'しょうかいとしょうかい');
  const card = KEIKETSU_CARDS.find((c) => c.name === '腹通谷');
  assert.equal(applyReadingDict('腹通谷', dict), card.yomi);
});

test('本人の手動補正がいちばん強い', () => {
  const d = buildReadingDict({ cards: KEIKETSU_CARDS, common: SPEECH_READINGS, userFixes: { 経穴: 'つぼ' } });
  assert.equal(applyReadingDict('経穴', d), 'つぼ');
});

test('長い言葉の一部に当たって漢字が1文字取り残される時は置き換えない', () => {
  assert.equal(applyReadingDict('上腕骨', dict), '上腕骨');
  assert.equal(applyReadingDict('膝関節', dict), '膝関節');
  assert.equal(applyReadingDict('加水分解', dict), '加水分解');
  // 決まった1文字（穴・左右）だけは付いていてもよい
  assert.equal(applyReadingDict('少海穴', dict), 'しょうかい穴');
  assert.equal(applyReadingDict('左少海', dict), '左しょうかい');
  // 2文字以上残るなら置き換えてよい
  assert.equal(applyReadingDict('橈骨神経は', dict), 'とうこつしんけいは');
  assert.deepEqual(termsWithReading('上腕骨と少海', dict).map((x) => x.term), ['少海']);
});

test('1文字の言葉は、決まった一覧にあるものだけ', () => {
  const d = buildReadingDict({ termReadings: { 心: 'しん' }, common: { 艾: 'もぐさ' } });
  assert.equal(applyReadingDict('中心', d), '中心');
  assert.equal(applyReadingDict('艾を', d), 'もぐさを');
});

test('記号・丸数字・ローマ数字・単位・範囲・分数', () => {
  assert.equal(readSymbols('120mmHg'), '120水銀柱ミリメートル');
  assert.equal(readSymbols('Ⅲ型'), '3型');
  assert.equal(readSymbols('IV型アレルギー'), '4型アレルギー');
  assert.equal(readSymbols('2〜3倍'), '2から3倍');
  assert.equal(readSymbols('1/7以上'), '7分の1以上');
  assert.equal(readSymbols('要件は①意思②死亡'), '要件は、1、意思、2、死亡');
  assert.equal(readSymbols('A→B→C'), 'A、つぎに、B、つぎに、C');
  assert.equal(readSymbols('ADLとWHO'), 'エーディーエルとダブリューエイチオー');
  assert.equal(readSymbols('C5神経根'), 'シー5神経根');
  assert.equal(readSymbols('5mg/dL'), '5ミリグラムパーデシリットル');
});

test('○×は読み分け、穴埋めの伏せ字（○○）はそのまま', () => {
  assert.equal(readSymbols('○'), 'まる');
  assert.equal(readSymbols('×'), 'ばつ');
  assert.equal(readSymbols('○○に入る'), '○○に入る');
  assert.equal(readSymbols('3×4'), '3かける4');
});

test('体の言葉の言い換えは、長い言葉の途中に割り込まない', () => {
  assert.equal(addBodyWords('橈側にある'), '橈側、つまり親指がわにある');
  assert.equal(addBodyWords('長母指屈筋'), '長母指屈筋');
  assert.equal(addBodyWords('内果尖の上方'), '内果尖の上方');
});

test('問題の種類はっきり分かる時だけ言う', () => {
  assert.match(questionKindText({ question: '誤っているのはどれか。' }), /誤っている/);
  assert.match(questionKindText({ question: '少海の部位はどれか。' }), /場所/);
  assert.match(questionKindText({ question: '頸椎は何個か。' }), /数字/);
  assert.equal(questionKindText({ question: '正しいのはどれか。' }), '');
  assert.match(questionKindText({ question: 'x', type: 'ox' }), /正しいか誤りか/);
});

test('経絡の流れ（心包経を心経と取り違えない）', () => {
  assert.match(meridianFlowText('手の厥陰心包経'), /^心包経は、手の三陰経/);
  assert.match(meridianFlowText('足の陽明胃経'), /頭から足/);
  assert.equal(meridianFlowText('関係なし'), '');
});

test('寸・選択肢・文の区切り・方向・漢字のかたまり', () => {
  assert.equal(hasSun('上方3寸'), true);
  assert.equal(hasSun('寸口'), false);
  assert.equal(shortenChoice('正中神経（C6〜T1）'), '正中神経');
  assert.equal(splitSentences('短い。').length, 1);
  assert.equal(splitSentences('あいうえおかきくけこさしすせそたちつてと。なにぬねのはひふへほまみむめもやゆよらりるれろ。').length, 2);
  assert.equal(pauseBeforeDirections('体の左右'), '体の、左右');
  assert.deepEqual(kanjiWords('少海は肘の内側', 5), ['少海', '内側']);
});

test('図のある問題には、図の説明がそろっている', () => {
  const keys = new Set();
  for (const b of SEED_BANKS) for (const q of b.questions) if (q.figure) keys.add(q.figure);
  for (const k of keys) assert.ok(FIGURE_DESCRIPTIONS[k], `図「${k}」の説明がありません`);
});

test('実際の問題文を読み上げ用に直しても落ちない', () => {
  let n = 0;
  for (const b of SEED_BANKS) for (const q of b.questions) {
    const out = toSpeechText(`${q.question || ''}${q.explanation || ''}`, dict);
    assert.equal(typeof out, 'string');
    n++;
  }
  assert.ok(n > 3000);
});

const homo = buildHomophoneInfo(KEIKETSU_CARDS, HOMOPHONE_KANJI_HINTS);

test('同じ読みの経穴は全部、字の説明を持っている', () => {
  assert.ok(homo.groups.length >= 17);
  for (const g of homo.groups) for (const m of g.members) assert.ok(m.hint, `${m.name}（${g.yomi}）の字の説明がありません`);
  assert.equal(meridianShort('手の少陰心経'), '心経');
  assert.equal(meridianShort('手の厥陰心包経'), '心包経');
  assert.equal(meridianShort('督脈'), '督脈');
});

test('同じ読みの経穴に経絡・字の説明を添える（同じ文では1回だけ・書いてあれば言わない）', () => {
  assert.equal(annotateHomophones('少海を取る', homo), '心経の少海、少ないに、海、を取る');
  assert.equal(annotateHomophones('少海と少海', homo), '心経の少海、少ないに、海、と少海');
  assert.equal(annotateHomophones('心経の少海', homo, { kanji: false }), '心経の少海');
  assert.equal(annotateHomophones('照海穴', homo, { kanji: false }), '腎経の照海穴');
  assert.equal(annotateHomophones('合谷', homo), '合谷');
  assert.match(annotateHomophones('照海', homo, { meridian: false, kanji: false, location: true }), /場所は足内側/);
  assert.equal(annotateHomophones('少海', homo, { meridian: false, kanji: false }), '少海');
});

test('同じ読みのドリル：経絡が同じ組（天宗・天窓）は場所で問う', () => {
  const items = homophoneDrillItems(homo);
  assert.ok(items.length >= homo.groups.length * 3);
  const tenso = items.filter((x) => /てんそう/.test(x.recallPrompt) && /どの字/.test(x.recallPrompt));
  assert.equal(tenso.length, 2);
  for (const t of tenso) assert.doesNotMatch(t.recallPrompt, /小腸経の/);
  for (const x of items) assert.doesNotMatch(x.recallPrompt, /少海|小海|照海/);
});

test('readSymbols：言葉どうしの「／」は区切り、「＝」は「は」と読む（数どうしの分数はそのまま）', () => {
  assert.equal(readSymbols('筋皮神経／正中神経'), '筋皮神経、正中神経');
  assert.equal(readSymbols('左心室＝体循環の起点'), '左心室は体循環の起点');
  assert.equal(readSymbols('1/2の量'), '2分の1の量');
});

import { applyContextReadings } from '../src/lib/speechText.js';
test('東洋医学の「風邪」は ふうじゃ、ふつうの風邪（かぜ）はそのまま', () => {
  assert.equal(applyContextReadings('行痺は風邪による'), '行痺はふうじゃによる');
  assert.equal(applyContextReadings('2週間前に風邪を引いた。風邪薬を飲んだ'), '2週間前に風邪を引いた。風邪薬を飲んだ');
});
test('脈の「数」は さく（年数などは変えない）', () => {
  assert.equal(applyContextReadings('脈は細数、弦数。数脈'), '脈は細さく、弦さく。さくみゃく');
  assert.equal(applyContextReadings('脈数、喫煙年数'), '脈さく、喫煙年数');
});
