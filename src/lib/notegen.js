// 説明文・ノート（普通の文章）から穴埋め式の四択問題を自動生成する。
//
// 使い方の想定:
//   教科書のまとめ、自分のノート、ネットの解説文などを貼り付けると、
//   重要語（経穴名・カタカナ用語・漢字熟語・数値）を空欄にした四択問題を作る。
//   選択肢の「まぎらわしい候補（ダミー）」は、同じ文章内の同種の語から選ぶので、
//   ほどよく自然な四択になる。
//
// あくまで下処理。生成結果はプレビューで人が確認・修正して確定する前提。
// （※ freetext.js は「すでに問題形式になった文章」を読み取る別機能）

// 全角英数字を半角へ寄せる（数値の判定を安定させる）
function toHalfNum(s) {
  return String(s).replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

// 文への分割：。！？改行で区切り、短すぎる断片は捨てる
function splitSentences(text) {
  return String(text)
    .replace(/\r\n?/g, '\n')
    .split(/(?<=[。．！？!?])|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.replace(/\s/g, '').length >= 8);
}

// よく出るが問題にしても意味の薄い漢字語を軽く除外
const KANJI_STOP = new Set([
  '場合', '以下', '以上', '一般', '一方', '存在', '関係', '関連', '影響', '状態',
  '部分', '全体', '意味', '内容', '結果', '理由', '目的', '方法', '種類', '複数',
  '自分', '相手', '今回', '前回', '次回', '本文', '文章', '問題', '解説', '正解',
]);

const NUM_RE = /\d+(?:\.\d+)?(?:\s?(?:%|パーセント|℃|度|回|個|本|対|時間|分|秒|歳|週間|週|日|か月|ヶ月|mmHg|mm|cm|kg|mg|mL|ml|L|Hz))?/g;
const KATA_RE = /[ァ-ヶ][ァ-ヶー・]{2,}/g;
const KANJI_RE = /[一-龥々]{2,}/g;

// 語のカテゴリ判定
function categoryOf(term) {
  if (/^\d/.test(toHalfNum(term))) return 'num';
  if (/[ァ-ヶ]/.test(term)) return 'kata';
  return 'kanji';
}

// 文章全体から候補語を集める（カテゴリ別に重複なし）
function collectTerms(sentences) {
  const pools = { num: new Set(), kata: new Set(), kanji: new Set() };
  for (const s of sentences) {
    const half = toHalfNum(s);
    (half.match(NUM_RE) || []).forEach((t) => {
      // 単なる桁だけ（単位なし1〜2桁）は弱いので、単位付きか3桁以上のみ採用
      if (/[^\d.]/.test(t) || t.replace(/[.\s]/g, '').length >= 3) pools.num.add(t.trim());
    });
    (s.match(KATA_RE) || []).forEach((t) => pools.kata.add(t));
    (s.match(KANJI_RE) || []).forEach((t) => {
      if (!KANJI_STOP.has(t)) pools.kanji.add(t);
    });
  }
  return { num: [...pools.num], kata: [...pools.kata], kanji: [...pools.kanji] };
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 文の中から空欄にする「最良の語」を選ぶ
function pickBlankTerm(sentence, pools) {
  const half = toHalfNum(sentence);
  const cands = [];
  (sentence.match(KATA_RE) || []).forEach((t) => cands.push({ term: t, cat: 'kata', w: t.length + 3 }));
  (sentence.match(KANJI_RE) || []).forEach((t) => {
    if (!KANJI_STOP.has(t)) cands.push({ term: t, cat: 'kanji', w: t.length + (t.length >= 3 ? 2 : 0) });
  });
  (half.match(NUM_RE) || []).forEach((t) => {
    const v = t.trim();
    if (/[^\d.]/.test(v) || v.replace(/[.\s]/g, '').length >= 3) cands.push({ term: v, cat: 'num', w: 2 });
  });
  if (cands.length === 0) return null;
  // ダミー候補が確保できる（同カテゴリに他の語が2つ以上ある）ものを優先
  cands.sort((a, b) => {
    const da = pools[a.cat].filter((x) => x !== a.term).length;
    const db = pools[b.cat].filter((x) => x !== b.term).length;
    if ((db >= 2) - (da >= 2) !== 0) return (db >= 2) - (da >= 2);
    return b.w - a.w;
  });
  return cands[0];
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ダミー選択肢を作る（同カテゴリ優先 → 不足分は他カテゴリから補う）
function buildDistractors(answer, cat, pools, need, rng) {
  const bad = (t) => t === answer || t.includes(answer) || answer.includes(t);
  let pool = pools[cat].filter((t) => !bad(t));
  let picks = shuffle(pool, rng).slice(0, need);
  if (picks.length < need) {
    const others = ['kanji', 'kata', 'num']
      .filter((c) => c !== cat)
      .flatMap((c) => pools[c])
      .filter((t) => !bad(t) && !picks.includes(t));
    picks = picks.concat(shuffle(others, rng).slice(0, need - picks.length));
  }
  return picks;
}

let seq = 0;
function pid() {
  seq += 1;
  return `ng-${Date.now().toString(36)}-${seq}`;
}

// メイン：text から穴埋め四択を生成
export function generateFromNotes(text, opts = {}) {
  const max = opts.max || 20;
  const choiceCount = Math.min(Math.max(opts.choiceCount || 4, 2), 5);
  const rng = opts.rng || Math.random;
  const warnings = [];

  if (!text || !text.trim()) return { questions: [], warnings: ['文章が空です。'] };

  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return { questions: [], warnings: ['問題にできる文が見つかりませんでした。もう少し長い文章を貼ってください。'] };
  }
  const pools = collectTerms(sentences);

  const questions = [];
  const seenBlank = new Set();
  let skipped = 0;

  for (const s of sentences) {
    if (questions.length >= max) break;
    const pick = pickBlankTerm(s, pools);
    if (!pick) {
      skipped++;
      continue;
    }
    const distractors = buildDistractors(pick.term, pick.cat, pools, choiceCount - 1, rng);
    if (distractors.length < 1) {
      skipped++; // 選択肢が作れない（＝ダミーが無い）ものは飛ばす
      continue;
    }
    // 空欄化（最初の1か所だけ）
    const blanked = s.replace(new RegExp(escapeReg(pick.term)), '（　　　）');
    const qtext = `${blanked}\n空欄（　）に入る語句として最も適切なものはどれか。`;
    const key = blanked;
    if (seenBlank.has(key)) continue;
    seenBlank.add(key);

    const options = shuffle([pick.term, ...distractors], rng);
    const answer = options.indexOf(pick.term);
    questions.push({
      id: pid(),
      subject: '',
      type: 'choice',
      question: qtext,
      choices: options,
      answer,
      explanation: `元の文：${s}`,
      _generated: true,
    });
  }

  if (questions.length === 0) {
    warnings.push('選択肢（ダミー）を作れる語が足りず、問題を生成できませんでした。用語が複数含まれる文章だと作りやすくなります。');
  } else if (skipped > 0) {
    warnings.push(`${skipped}件の文はダミー選択肢を作れず除外しました。`);
  }
  warnings.push('自動生成のため、必ずプレビューで正解と選択肢を確認・修正してください。');

  return { questions, warnings };
}
