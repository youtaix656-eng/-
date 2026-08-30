// 競合台帳——**推測させない。実際に見た1件だけを残す。**
//
// 競合・市場の話は本質的に「外の数字」を扱うが、このアプリの芯は
// **手元に無い基準を持たない**こと。ここを雑にやると、いちばん危ない失敗が起きる：
// AIに「この分野の相場は？」と聞いて、**もっともらしい値段とURLを作らせてしまう**
// （docs/PROMPT.md の項目88で一度対策したのと同じ型の事故）。
//
// 解き方は1つだけ——**あなたが実際に見た1件ずつを台帳にする。**
// 比べるのは「見た数件の中の相対」と「自分の数字との差」だけ。
//
// 決まりごと：
//  ・**AIを呼ばない。** 並べ替えと引き算だけ。
//  ・**観測の平均を「相場」と呼ばない。** それは「あなたが見た◯件の真ん中」でしかない。
//  ・**総合点・順位を付けない。** 採点には他社事例という手元に無い基準が要る。
//  ・**「空いている＝儲かる」と書かない。** 誰もやらない理由が先にあることが多い
//    （risk.js の6問目と同じ線）。
//  ・**足りない時に黙らない。** 0件で「あなたが最安です」と出すのが最悪。
//  ・見た日を必ず持つ。**古い観測を勝手に消さない・勝手に更新しない**（印を付けるだけ）。

const DAY = 86400000;

/** 観測が古くなる線。ここを過ぎたら「見た日が古い」と印を付ける（消さない）。 */
export const STALE_DAYS = 90;

/** 値段の位置を出すのに要る観測の数。これ未満なら位置を出さない。 */
export const MIN_RIVALS = 3;

export const MAX_RIVALS = 40;

/** どこで見たか。**「たぶん」を入れない**ので、選べるのは実際に見た場所だけ。 */
export const RIVAL_PLACES = {
  note: 'note・ブログ',
  sns: 'SNS',
  shop: 'ストア・EC',
  site: '自分のサイト',
  offline: '対面・紙',
  other: 'その他',
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const str = (v, n) => String(v || '').trim().slice(0, n);

const tagsOf = (v) => {
  const list = Array.isArray(v) ? v : String(v || '').split(/[,、\s]+/);
  return [...new Set(list.map((x) => str(x, 20)).filter(Boolean))].slice(0, 8);
};

/**
 * 観測1件。**空で作れない**——名前と「どこで見たか」が無いものは観測ではない。
 * price / times は分からなければ0（＝不明）でよい。**0を「無料」「0回」と読まない。**
 */
export function makeRival(input = {}) {
  const name = str(input.name, 60);
  if (!name) return null;
  const now = Date.now();
  return {
    id: input.id || `rv_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    ventureId: input.ventureId || null,
    name,
    place: RIVAL_PLACES[input.place] ? input.place : 'other',
    url: str(input.url, 300),
    // 値段（円）。0 は**未入力**であって「無料」ではない。
    price: num(input.price),
    // 月に何本くらい出しているか。0 は未入力。
    postsPerMonth: num(input.postsPerMonth),
    // 誰に・何を（タグ。空いている所を探すのに使う）
    who: tagsOf(input.who),
    what: tagsOf(input.what),
    // 実際に見た書き出し（あれば。真似の事故を見つけるのに使う）
    opening: str(input.opening, 400),
    note: str(input.note, 500),
    // **見た日**。ここが無い観測は台帳に置かない。
    seenAt: input.seenAt || now,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeRival(r) {
  if (!r || !r.id || !r.name) return null;
  return {
    id: r.id,
    ventureId: r.ventureId || null,
    name: str(r.name, 60),
    place: RIVAL_PLACES[r.place] ? r.place : 'other',
    url: str(r.url, 300),
    price: num(r.price),
    postsPerMonth: num(r.postsPerMonth),
    who: tagsOf(r.who),
    what: tagsOf(r.what),
    opening: str(r.opening, 400),
    note: str(r.note, 500),
    seenAt: r.seenAt || r.createdAt || Date.now(),
    createdAt: r.createdAt || Date.now(),
    updatedAt: r.updatedAt || r.createdAt || Date.now(),
  };
}

export function normalizeRivals(list) {
  return (Array.isArray(list) ? list : []).map(normalizeRival).filter(Boolean).slice(0, MAX_RIVALS);
}

/** 事業で絞る（ventureId が無い観測は「どの事業にも属さない」ので常に含める）。 */
export function rivalsOf(rivals, ventureId) {
  const list = normalizeRivals(rivals);
  if (!ventureId) return list;
  return list.filter((r) => !r.ventureId || r.ventureId === ventureId);
}

/** 見た日が古いか。**古くても消さない**——印を付けて、見直すかは人が決める。 */
export function isStale(rival, now = Date.now()) {
  return now - (rival.seenAt || 0) > STALE_DAYS * DAY;
}

export function staleDays(rival, now = Date.now()) {
  return Math.floor((now - (rival.seenAt || 0)) / DAY);
}

/**
 * 値段の位置。**観測の平均を「相場」と呼ばない。**
 * 出すのは「あなたが見た◯件の中で、自分がどこにいるか」だけ。
 * @param {object[]} rivals 観測
 * @param {number} myPrice 自分の値段（0＝未入力）
 * @returns {{ready:boolean, need:number, counted:number, min, max, mid, mine, rank, band, stale:number}}
 */
export function pricePosition(rivals, myPrice = 0, now = Date.now()) {
  const list = normalizeRivals(rivals).filter((r) => r.price > 0);
  const counted = list.length;
  const base = {
    ready: false,
    need: Math.max(0, MIN_RIVALS - counted),
    counted,
    min: null,
    max: null,
    mid: null,
    mine: num(myPrice) || null,
    rank: null,
    band: null,
    stale: list.filter((r) => isStale(r, now)).length,
  };
  if (counted < MIN_RIVALS) return base;

  const prices = list.map((r) => r.price).sort((a, b) => a - b);
  const mid = prices.length % 2
    ? prices[(prices.length - 1) / 2]
    : Math.round((prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2);
  const mine = num(myPrice);
  const out = { ...base, ready: true, need: 0, min: prices[0], max: prices[prices.length - 1], mid };
  if (!mine) return out;
  // 自分より安い観測の数（同額は下に数えない）
  out.rank = prices.filter((p) => p < mine).length + 1;
  out.band = mine <= prices[0] ? 'low' : mine >= prices[prices.length - 1] ? 'high' : 'mid';
  return out;
}

/**
 * 値段の位置の1行。**足りない時も黙らない。**
 *
 * 名前を `priceLine` にしないこと——`paid.js` の `priceLine` は
 * 「売れた数から導く値付けの段」で、**層が違う**（`cycle.js` と `loop.js` を
 * 混ぜないのと同じ理由）。こちらは「観測の中でどこにいるか」。
 */
export function pricePositionLine(pos) {
  if (!pos) return '';
  if (!pos.ready) {
    return `値段の入った観測があと ${pos.need} 件で、位置が出せます（いま ${pos.counted} 件）。`
      + '観測が少ないうちは「あなたがいちばん安い」とは言えません。';
  }
  const y = (n) => `¥${n.toLocaleString('ja-JP')}`;
  const seen = `あなたが見た ${pos.counted} 件は ${y(pos.min)}〜${y(pos.max)}、真ん中が ${y(pos.mid)} でした`;
  if (!pos.mine) return `${seen}。これは相場ではなく、あなたが見た ${pos.counted} 件の中の話です。`;
  const where = pos.band === 'low' ? '見た中でいちばん安い側' : pos.band === 'high' ? '見た中でいちばん高い側' : '見た中の真ん中あたり';
  return `${seen}。あなたの ${y(pos.mine)} は${where}です（${pos.counted}件中 ${pos.rank}番目に高い）。`;
}

/**
 * 空いている所。競合が触れていない「誰に・何を」を出す。
 * **「空いている＝儲かる」とは言わない**——誰もやらない理由が先にあることが多い。
 * @param {object[]} rivals
 * @param {{who?:string[], what?:string[]}} mine 自分が狙っているもの
 */
export function openings(rivals, mine = {}) {
  const list = normalizeRivals(rivals);
  const count = (key) => {
    const m = new Map();
    for (const r of list) for (const t of r[key]) m.set(t, (m.get(t) || 0) + 1);
    return m;
  };
  const whoMap = count('who');
  const whatMap = count('what');
  const gapOf = (map, mineTags) =>
    tagsOf(mineTags)
      .filter((t) => !map.has(t))
      .map((t) => ({ tag: t, seen: 0 }));
  const crowdedOf = (map) =>
    [...map.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, seen]) => ({ tag, seen }));
  return {
    counted: list.length,
    whoGaps: gapOf(whoMap, mine.who),
    whatGaps: gapOf(whatMap, mine.what),
    whoCrowded: crowdedOf(whoMap),
    whatCrowded: crowdedOf(whatMap),
  };
}

export function openingsLine(gap) {
  if (!gap || !gap.counted) return '観測が0件なので、混んでいる所も空いている所も分かりません。';
  const parts = [];
  const crowded = [...gap.whoCrowded, ...gap.whatCrowded];
  if (crowded.length) parts.push(`見た中で重なっているのは「${crowded.map((c) => c.tag).join('・')}」`);
  const gaps = [...gap.whoGaps, ...gap.whatGaps];
  if (gaps.length) {
    parts.push(
      `あなたが狙っている「${gaps.map((g) => g.tag).join('・')}」は、見た ${gap.counted} 件には出てきませんでした`
    );
  }
  if (!parts.length) return `見た ${gap.counted} 件と、あなたの狙いはだいたい重なっています。`;
  return `${parts.join('。')}。**出てこない＝儲かる、ではありません**——誰もやらない理由が先にあることもあります。`;
}

/**
 * 並べ比べの1枚。**総合点は出さない。**
 * @returns {{rows:object[], stale:object[], counted:number}}
 */
export function compareTable(rivals, mine = {}, now = Date.now()) {
  const list = normalizeRivals(rivals).slice().sort((a, b) => b.seenAt - a.seenAt);
  const rows = list.map((r) => ({
    id: r.id,
    name: r.name,
    place: RIVAL_PLACES[r.place],
    url: r.url,
    price: r.price || null,
    postsPerMonth: r.postsPerMonth || null,
    who: r.who,
    what: r.what,
    seenAt: r.seenAt,
    stale: isStale(r, now),
    staleDays: staleDays(r, now),
  }));
  return {
    counted: rows.length,
    rows,
    stale: rows.filter((r) => r.stale),
    mine: {
      name: str(mine.name, 60) || 'あなた',
      price: num(mine.price) || null,
      postsPerMonth: num(mine.postsPerMonth) || null,
      who: tagsOf(mine.who),
      what: tagsOf(mine.what),
    },
  };
}

/** 台帳の1行（画面の見出し用）。**足りない時も黙らない。** */
export function rivalsLine(rivals, now = Date.now()) {
  const list = normalizeRivals(rivals);
  if (!list.length) {
    return `まだ1件も見ていません。${MIN_RIVALS}件たまると、値段の位置が出せます。`;
  }
  const stale = list.filter((r) => isStale(r, now)).length;
  const priced = list.filter((r) => r.price > 0).length;
  const parts = [`実際に見たのは ${list.length} 件（値段が入っているのは ${priced} 件）`];
  if (stale) parts.push(`${stale} 件は見てから ${STALE_DAYS} 日を過ぎています`);
  return `${parts.join('。')}。`;
}

/**
 * 次にやること。**提案するだけ・勝手に調べない。**
 */
export function rivalAdvice(rivals, { myPrice = 0, mine = {} } = {}, now = Date.now()) {
  const list = normalizeRivals(rivals);
  const out = [];
  if (list.length < MIN_RIVALS) {
    out.push({
      title: `あと ${MIN_RIVALS - list.length} 件、実際に見る`,
      body: '検索して開いた画面に書いてあることだけを入れてください。'
        + '**AIに聞いて埋めないこと**——もっともらしい値段とURLが返ってきます。',
    });
  }
  const noPrice = list.filter((r) => !r.price).length;
  if (list.length && noPrice) {
    out.push({
      title: `値段が入っていない観測が ${noPrice} 件`,
      body: '値段はいちばん効くレバーなので、ここが埋まると位置が出ます。分からなければ空のままでかまいません（0円とは書かないでください）。',
    });
  }
  const stale = list.filter((r) => isStale(r, now));
  if (stale.length) {
    out.push({
      title: `${stale.length} 件が古い観測です`,
      body: `見てから ${STALE_DAYS} 日を過ぎています。値段は変わります。もう一度開いて、見た日を入れ直してください（勝手には更新しません）。`,
    });
  }
  const pos = pricePosition(list, myPrice, now);
  if (pos.ready && pos.band === 'low') {
    out.push({
      title: '見た中でいちばん安い側にいます',
      body: '安いこと自体は悪くありませんが、**値段でしか競えない形になっていないか**を一度見てください（続くかどうかの見立ての「あなたにしか出せないもの」の問いと同じ話です）。',
    });
  }
  const gap = openings(list, mine);
  if (gap.whoCrowded.length || gap.whatCrowded.length) {
    const c = [...gap.whoCrowded, ...gap.whatCrowded].map((x) => x.tag).slice(0, 3);
    out.push({
      title: `重なっているのは「${c.join('・')}」`,
      body: '同じ所へ同じ書き方で出すと、読み手にはどれも同じに見えます。ずらすか、あなたの経験を1つ足すかを決めてください。',
    });
  }
  return out;
}

// ── 社員へ渡す形 ───────────────────────────────────────────────
// **競合の観測は「資料」であって「指示」ではない**（項目97と同じ線）。
// ここは文字を組み立てるだけで、囲うのは memory.buildContext の役目
//（囲いの目印は中身によって伸びるので、作る側で二重に囲わない）。

import { ROLES } from '../data/roles.js';

/** 競合の観測を読ませる役か。**役職 id をこのファイルに並べない**（項目131と同じ線）。 */
export function readsMarket(roleId) {
  const role = ROLES.find((r) => r.id === roleId);
  return Boolean(role && role.readsMarket);
}

/** 社員に渡す観測の数（多いほど毎回の料金に効く）。 */
export const BRIEF_RIVALS = 6;

/**
 * 社員へ渡す競合の要点。市場を見る役でなければ空文字（＝渡さない）。
 * **推測を混ぜない**——台帳に入っているものだけを、見た日つきで並べる。
 */
export function rivalsBrief(rivals, roleId, { ventureId = null, now = Date.now() } = {}) {
  if (!readsMarket(roleId)) return '';
  const list = rivalsOf(rivals, ventureId)
    .slice()
    .sort((a, b) => b.seenAt - a.seenAt)
    .slice(0, BRIEF_RIVALS);
  if (!list.length) return '';
  const lines = list.map((r) => {
    const bits = [`${r.name}（${RIVAL_PLACES[r.place]}）`];
    if (r.price) bits.push(`¥${r.price.toLocaleString('ja-JP')}`);
    if (r.postsPerMonth) bits.push(`月${r.postsPerMonth}本`);
    if (r.who.length) bits.push(`誰に：${r.who.join('・')}`);
    if (r.what.length) bits.push(`何を：${r.what.join('・')}`);
    const days = staleDays(r, now);
    bits.push(isStale(r, now) ? `見た日：${days}日前（古い）` : `見た日：${days}日前`);
    return `- ${bits.join(' / ')}`;
  });
  return [
    '## 競合の観測（オーナーが実際に見たもの）',
    ...lines,
    `※ これは ${list.length} 件の観測で、業界の相場ではありません。`
      + '**この件数から「相場は◯円」と書かないこと。**'
      + '足りないと思ったら「観測が足りない」と正直に書いてください。',
  ].join('\n');
}

/**
 * 「同じことをやっている人を、実際に3人見ましたか？」（risk.js の6問目）の裏付け。
 * **勝手に答えを書き換えない**——台帳が何を言っているかを見せるだけで、
 * 答えるのは人（画面のボタンから）。
 */
export function seenEvidence(rivals, ventureId = null) {
  const list = rivalsOf(rivals, ventureId);
  const counted = list.length;
  const enough = counted >= MIN_RIVALS;
  return {
    counted,
    enough,
    answer: enough ? 'yes' : counted > 0 ? 'unknown' : 'no',
    line: enough
      ? `競合台帳に ${counted} 件あります（実際に見たもの）。この問いは「はい」で答えられます。`
      : counted > 0
        ? `競合台帳は ${counted} 件です。あと ${MIN_RIVALS - counted} 件見ると「はい」と言えます。`
        : '競合台帳が空です。まず実際に見た1件を入れてください。',
  };
}
