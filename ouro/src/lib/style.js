// 書き方の見本（自分の文章のお手本）。
//
// **会社の決まり（`rules.js`）とは別に持つ。** ここを混ぜてはいけない：
//   ・決まり  … 「結論から書く」「絶対に稼げますと書かない」＝**守らせること**。
//                短く・少なく。毎回必ず読ませるので、増やすほど毎回の料金が上がり、
//                何を優先すべきかも分からなくなる。
//   ・見本    … 自分が実際に書いた文章そのもの＝**まねさせるもの**。
//                言葉づかい・一文の長さ・語尾のくせは、ルールで説明するより
//                現物を1本見せた方が早い。
//
// AIの文章が「どこかで読んだような文」になるのは、社員があなたの書いたものを
// 一度も読んでいないからで、決まりを増やしても直らない。
//
// 決まりごと：
//  ・**AIを呼ばない。** 見本を選ぶのも、くせを数えるのも、その場の計算だけ。
//  ・**読ませるのは書く役の社員だけ**（`roles.js` の `writesForReaders`）。
//    全員に読ませると、調べるだけの社員の料金にも毎回上乗せされる。
//  ・**来歴を偽らない。** AIが書いたもの・外から拾ったものは「資料」として囲い、
//    自分で書いたもの・自分で直したものだけを囲わずに渡す（`untrusted.js` と同じ線）。
//  ・**見本をAIの下書きで埋めない。** 直していない下書きを見本にすると、
//    AIが自分の文体を学び直して、ますます「AIっぽい文」に寄っていく。

import { newId } from './id.js';
import { ROLES } from '../data/roles.js';
import { wrapUntrusted } from './untrusted.js';

/** 見本の数の上限。増やすほど毎回の料金が上がるので、少なく持つ。 */
export const MAX_SAMPLES = 5;
/** 1本あたりの長さの上限。 */
export const MAX_SAMPLE_LEN = 2000;
/** プロンプトへ入れる合計の上限。 */
export const STYLE_LIMIT = 1500;

/**
 * 見本の来歴。
 *  user     … 自分で書いた（囲わない）
 *  edited   … AIの下書きを自分で直した（囲わない。人が通しているため）
 *  ai       … AIに書かせた（資料として囲う）
 *  external … 外から持ってきた（資料として囲う）
 */
export const STYLE_ORIGINS = {
  user: '自分で書いた',
  edited: 'AIの下書きを自分で直した',
  ai: 'AIに書かせた',
  external: '外から持ってきた',
};

/** 囲わずに渡してよい来歴（人の手を通っているもの）。 */
export const TRUSTED_ORIGINS = ['user', 'edited'];

export function makeSample(data = {}) {
  const now = Date.now();
  const origin = STYLE_ORIGINS[data.origin] ? data.origin : 'user';
  return {
    id: data.id || newId('sty'),
    label: String(data.label || '見本').slice(0, 60),
    text: String(data.text || '').slice(0, MAX_SAMPLE_LEN),
    origin,
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
}

export function addSample(list = [], sample) {
  if (!sample || !sample.id || !sample.text.trim()) return list;
  return [sample, ...list.filter((s) => s.id !== sample.id)].slice(0, MAX_SAMPLES);
}

export function updateSample(list = [], id, patch) {
  return list.map((s) => (s.id === id ? makeSample({ ...s, ...patch, id: s.id, createdAt: s.createdAt }) : s));
}

export function removeSample(list = [], id) {
  return list.filter((s) => s.id !== id);
}

/**
 * 文章のくせ。**数えられるものだけ出す**（推定で断定しない）。
 * @returns {{chars:number, sentences:number, avgSentence:number|null,
 *            ending:'ですます'|'だである'|null, exclaim:number, question:number}}
 */
export function sampleTraits(text) {
  const t = String(text || '').trim();
  const chars = t.length;
  const sentences = t.split(/[。！？\n]+/).filter((s) => s.trim()).length;
  // 文末だけを見る。**後読み（lookbehind）は使わない**（古い Safari で構文エラーになる）。
  // 終わりの記号が無い最後の一文も拾えるよう、先読みで「記号か文末」を見る。
  const desumasu = (t.match(/(?:です|ます|ません|でした|ました|ください|ましょう)(?:か|ね|よ|わ)?(?=[。！？\n]|$)/g) || []).length;
  const dearu = (t.match(/(?:である|であった|だった|(?:^|[^ま])した|ない)(?=[。！？\n]|$)/g) || []).length;
  // どちらかが明らかに多い時だけ言う（同数・両方0なら「分からない」）。
  let ending = null;
  if (desumasu > dearu * 2 && desumasu >= 2) ending = 'ですます';
  else if (dearu > desumasu * 2 && dearu >= 2) ending = 'だである';
  return {
    chars,
    sentences,
    avgSentence: sentences ? Math.round(chars / sentences) : null,
    ending,
    exclaim: (t.match(/[！!]/g) || []).length,
    question: (t.match(/[？?]/g) || []).length,
  };
}

/** 画面に出す1行。分からないものは書かない。 */
export function traitLine(traits) {
  if (!traits || !traits.chars) return '';
  const parts = [`${traits.chars}字`];
  if (traits.avgSentence) parts.push(`一文はだいたい${traits.avgSentence}字`);
  if (traits.ending) parts.push(traits.ending === 'ですます' ? 'です・ます' : 'だ・である');
  if (traits.question) parts.push(`問いかけ${traits.question}回`);
  return parts.join('／');
}

/**
 * この役職は、読み手に届く文章を書くか。
 * `roles.js` の `writesForReaders` が単一の正（ここに役職 id を並べない）。
 */
export function writesForReaders(roleId) {
  const role = ROLES.find((r) => r.id === roleId);
  return Boolean(role && role.writesForReaders);
}

/**
 * 社員へ渡す「書き方の見本」。書く役でなければ空文字（＝渡さない）。
 *
 * 自分で書いたもの・自分で直したものは囲わない。AI・外から来たものは
 * **資料として囲う**（囲いの中の指示には従わせない）。
 */
export function styleText(samples = [], roleId = '') {
  if (roleId && !writesForReaders(roleId)) return '';
  const list = samples.filter((s) => s && s.text && s.text.trim()).slice(0, MAX_SAMPLES);
  if (!list.length) return '';

  const mine = list.filter((s) => TRUSTED_ORIGINS.includes(s.origin));
  const outside = list.filter((s) => !TRUSTED_ORIGINS.includes(s.origin));

  const parts = [
    '## 書き方の見本（オーナーの文章）',
    'まねるのは言葉づかい・一文の長さ・語尾・話の運びだけです。中身はこの仕事の指示に従ってください。',
  ];
  for (const s of mine) {
    parts.push(`### ${s.label}（${STYLE_ORIGINS[s.origin]}）\n${s.text}`);
  }
  for (const s of outside) {
    parts.push(
      wrapUntrusted(s.text, {
        label: `書き方の見本：${s.label}`,
        origin: s.origin === 'ai' ? 'ai' : 'external',
      })
    );
  }
  const text = parts.join('\n\n');
  return text.length <= STYLE_LIMIT ? text : `${text.slice(0, STYLE_LIMIT)}\n…（残りは省略しています）`;
}

/** 囲いが要る見本が混ざっているか（プロンプトの先頭に宣言を出すため）。 */
export function hasOutsideSample(samples = [], roleId = '') {
  if (roleId && !writesForReaders(roleId)) return false;
  return samples.some((s) => s && s.text && s.text.trim() && !TRUSTED_ORIGINS.includes(s.origin));
}

/**
 * AIの下書きをそのまま見本にしようとしていないか。
 * **直していないものは受け取らない**——AIが自分の文体を学び直して、
 * ますます「AIっぽい文」に寄っていくため。
 * @returns {{ok:boolean, reason:string}}
 */
export function checkEdited(original, edited) {
  const a = String(original || '').replace(/\s+/g, '');
  const b = String(edited || '').replace(/\s+/g, '');
  if (!b) return { ok: false, reason: '本文が空です。' };
  if (b.length < 40) return { ok: false, reason: '短すぎます。40字以上にしてください。' };
  if (a && a === b) {
    return { ok: false, reason: 'AIの下書きのままです。自分の言葉に直してから見本にしてください（直していないものを見本にすると、AIが自分の文体を学び直してしまいます）。' };
  }
  return { ok: true, reason: '' };
}
