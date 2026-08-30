// 需要の観測——**「困っている人を実際に見た」だけを貯める。**
//
// 市場調査というと検索ボリュームやキーワードツールの数字を思い浮かべるが、
// あれは**手元に無い基準**で、このアプリでは持てない（そして無料では正確に取れない）。
// 代わりにできることは1つ：**実際に見た「困りごと」を1件ずつ書き留める。**
// SNSの質問・お客さんの一言・レビューの不満——出所が自分の目にあるものだけ。
//
// 決まりごと：
//  ・**AIを呼ばない。** 語をそろえて数えるだけ。
//  ・**検索ボリューム・市場規模のような外の数字を持たない。**
//  ・出すのは**同じ言葉が何回出てきたか**だけ。**「◯回以上なら有望」とは言わない。**
//  ・1件でも「よく聞く声」と書かない（`MIN_HITS`）。
//  ・**誰の発言かを書かせない**（氏名・アカウント名は個人情報。lib/privacy.js と同じ線）。

const DAY = 86400000;

export const MAX_VOICES = 60;

/** 同じ言葉が何回出たら「重なっている」として出すか。1回は重なりではない。 */
export const MIN_HITS = 2;

/** どこで見た声か。 */
export const VOICE_PLACES = {
  sns: 'SNSで見た',
  customer: 'お客さんから直接',
  review: 'レビュー・感想',
  search: '検索の候補・関連語',
  other: 'その他',
};

const str = (v, n) => String(v || '').trim().slice(0, n);

/**
 * 声1件。**本文だけが必須**（誰が言ったかは持たない）。
 */
export function makeVoice(input = {}) {
  const text = str(input.text, 300);
  if (!text) return null;
  const now = Date.now();
  return {
    id: input.id || `vc_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    ventureId: input.ventureId || null,
    text,
    place: VOICE_PLACES[input.place] ? input.place : 'other',
    seenAt: input.seenAt || now,
    createdAt: now,
  };
}

export function normalizeVoice(v) {
  if (!v || !v.id || !v.text) return null;
  return {
    id: v.id,
    ventureId: v.ventureId || null,
    text: str(v.text, 300),
    place: VOICE_PLACES[v.place] ? v.place : 'other',
    seenAt: v.seenAt || v.createdAt || Date.now(),
    createdAt: v.createdAt || Date.now(),
  };
}

export function normalizeVoices(list) {
  return (Array.isArray(list) ? list : []).map(normalizeVoice).filter(Boolean).slice(0, MAX_VOICES);
}

export function voicesOf(voices, ventureId) {
  const list = normalizeVoices(voices);
  if (!ventureId) return list;
  return list.filter((v) => !v.ventureId || v.ventureId === ventureId);
}

// 数えても意味が無い語（助詞・言いよどみ）。**分野の語は入れない**
// （入れると、その分野の困りごとが数えられなくなる）。
const STOP = new Set([
  'こと', 'それ', 'これ', 'あれ', 'とき', 'ため', 'もの', 'ところ', 'よう', 'ほう',
  'すごい', 'とても', 'あと', 'いま', 'みたい', 'ぐらい', 'くらい', 'など', 'だけ',
  'した', 'する', 'して', 'ます', 'ません', 'です', 'でした', 'いる', 'ある', 'なる',
  'ない', 'なくて', 'いい', 'よく', 'すぎ', 'ちょっと', 'かなり', 'ほんと', 'たち',
  'thing', 'this', 'that', 'with', 'from', 'have', 'been',
]);

// 記号・助詞・つなぎ言葉で切る。**長いものから先に並べること**
// （'から' より先に 'か' が当たると、'から' で切れなくなる）。
const SPLIT = new RegExp(
  [
    '[\\s　。、,.!！?？「」『』（）()・:：;；\\-–—…"\'`*#>\\n/]+',
    'という|ですが|けれど|けども|ました|ません|ですね',
    'から|まで|より|ので|けど|ため|でも|ても|たい|ない|なく',
    // 名詞に直付きしやすい、ごく短い動詞。'行く時間' のような塊を割るためだけに置く。
    // **増やしすぎないこと**——辞書を持ち始めると外部依存と同じ重さになる。
    '行く|来る|する|できる|やる|見る|使う|買う|作る|読む|通う|続ける',
    '[はがをにへとでもやのねよなか]',
  ].join('|'),
  'g'
);

/**
 * 数えるための語に割る。**漢字の読みは推定しない**ので、表記のまま数える。
 * 形態素解析は持たない（外部ランタイム依存を増やさない）のでざっくりした切り方で、
 * **拾えない語もある**。そのことは画面にも「あなたが見た範囲の話」と書いてある。
 */
export function wordsOf(text) {
  return String(text || '')
    .split(SPLIT)
    .map((w) => (w || '').trim())
    .filter((w) => w.length >= 2 && w.length <= 20 && !STOP.has(w) && !/^[0-9０-９]+$/.test(w));
}

/**
 * 重なっている困りごと。**順位は自分の観測の中だけ。**
 * @returns {{counted:number, words:{word,hits,places:string[]}[], need:number}}
 */
export function demandReview(voices, { days = 0, now = Date.now() } = {}) {
  let list = normalizeVoices(voices);
  if (days > 0) list = list.filter((v) => now - v.seenAt <= days * DAY);
  const map = new Map();
  for (const v of list) {
    // 1件の中で同じ語が何度出ても1回と数える（長い1件が順位を独占しないため）
    for (const w of new Set(wordsOf(v.text))) {
      const e = map.get(w) || { word: w, hits: 0, places: new Set(), ids: [] };
      e.hits += 1;
      e.places.add(v.place);
      e.ids.push(v.id);
      map.set(w, e);
    }
  }
  const words = [...map.values()]
    .filter((e) => e.hits >= MIN_HITS)
    .sort((a, b) => b.hits - a.hits || a.word.localeCompare(b.word, 'ja'))
    .slice(0, 12)
    .map((e) => ({ word: e.word, hits: e.hits, places: [...e.places], ids: e.ids }));
  return {
    counted: list.length,
    words,
    need: Math.max(0, MIN_HITS - list.length),
  };
}

/** 1行。**足りない時も黙らない。** */
export function demandLine(review) {
  if (!review || !review.counted) {
    return 'まだ1件も書き留めていません。SNSの質問・お客さんの一言を、見たまま入れてください。';
  }
  if (!review.words.length) {
    return `${review.counted} 件ありますが、まだ同じ言葉の重なりが出ていません（同じ語が ${MIN_HITS} 回以上で出ます）。`;
  }
  const top = review.words.slice(0, 3).map((w) => `「${w.word}」${w.hits}回`).join('・');
  return `${review.counted} 件の中で重なっているのは ${top}。`
    + 'これは**あなたが見た範囲の話**で、世の中の検索数ではありません。';
}

/** 提案（AIを呼ばない）。 */
export function demandAdvice(review) {
  if (!review) return [];
  const out = [];
  if (!review.counted) {
    out.push({
      title: 'まず3件、見たまま入れる',
      body: '言い換えないでください。「腰が痛いけど病院に行く時間がない」のように、**その人が使った言葉のまま**残すほど、あとで効きます。',
    });
    return out;
  }
  if (!review.words.length) {
    out.push({
      title: 'あと数件で重なりが見えます',
      body: `いまは ${review.counted} 件。同じ言葉が ${MIN_HITS} 回出ると、重なりとして出します。`
        + '**言葉の切り分けはざっくりです**（辞書を持たないため）。'
        + '拾えていないと感じたら、短い言い方でもう1件足してみてください。',
    });
  }
  const top = review.words[0];
  if (top) {
    out.push({
      title: `いちばん重なっているのは「${top.word}」`,
      body: `${top.hits} 回出ています。この言葉をそのまま見出しに使うと、同じことで困っている人に届きやすくなります（言い換えると届きにくくなります）。`,
    });
  }
  return out;
}
