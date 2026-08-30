// 有料記事の値付けと、売る前の確認。
//
// 有料の記事・教材で失敗する形は、だいたい決まっている：
//  ① 安すぎる …「AIで作ったから」と100円で出す。手数料を引くと手元にほとんど残らず、
//     しかも「大したことない情報なのかな」と思われて、かえって売れない。
//  ② いきなり高い … まだ誰にも知られていないうちに高額を出しても、買う人がいない。
//  ③ 自動で大量に投稿する … 規約違反でアカウントごと止められる。作るのは任せても、
//     **最後に出すのは自分の手で。**
//
// ②の答えが「段階的に値上げする」。最初は控えめに出して、
// **決めた数が売れるたびに、決めた額だけ上げていく。**
//
// 決まりごと：
//  ・**AIを呼ばない。** 売れた数と、自分で決めた段だけで出す。
//  ・**相場の表を持たない。** ジャンルごとの相場は手元に無い基準なので、
//    「このジャンルは◯円」とは書かない（自分で調べた数字を入れてもらう）。
//  ・**手数料を勝手に決めない。** 入っていなければ手取りを出さない（0と置かない）。

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
};

/** 値付けの段。事業に持たせる（`venture.pricing`）。 */
export function normalizePricing(p) {
  const base = { startJpy: 0, targetJpy: 0, everyN: 30, stepJpy: 1000, feePct: 0 };
  if (!p || typeof p !== 'object') return base;
  return {
    startJpy: num(p.startJpy),
    targetJpy: num(p.targetJpy),
    everyN: Math.max(1, num(p.everyN) || base.everyN),
    stepJpy: num(p.stepJpy) || base.stepJpy,
    // 販売する場所の手数料（%）。**自分で調べて入れる**——既定値を置くと
    // どこかの実数を全員に当てはめることになる。
    feePct: Math.min(100, num(p.feePct)),
  };
}

/**
 * 最終的に売りたい値段から、最初の値段の目安（半分）を出す。
 * **これは決まりではなく、そう始める人が多いというだけ**なので、
 * 画面では「まず半分から始めるなら」と書いて押させる。
 */
export function halfOf(targetJpy) {
  const t = num(targetJpy);
  return t ? Math.round(t / 2 / 100) * 100 : 0;
}

/**
 * いまの段。売れた数から毎回導く（段の表を保存しない）。
 * @returns {{ready:boolean, price:number, nextPrice:number|null, soldToNext:number|null,
 *            stage:number, stages:{from:number, price:number}[], atTop:boolean,
 *            netPerSale:number|null}}
 */
export function pricePlan(pricing, soldCount = 0) {
  const p = normalizePricing(pricing);
  const sold = num(soldCount);
  if (!p.startJpy) {
    return { ready: false, price: 0, nextPrice: null, soldToNext: null, stage: 0, stages: [], atTop: false, netPerSale: null };
  }
  const top = p.targetJpy && p.targetJpy > p.startJpy ? p.targetJpy : p.startJpy;

  // 段を作る（最終価格を超えない）。上限を持って無限ループを防ぐ。
  const stages = [{ from: 0, price: p.startJpy }];
  let price = p.startJpy;
  let from = 0;
  while (price < top && stages.length < 40) {
    price = Math.min(top, price + p.stepJpy);
    from += p.everyN;
    stages.push({ from, price });
  }

  let stage = 0;
  for (let i = 0; i < stages.length; i += 1) if (sold >= stages[i].from) stage = i;
  const now = stages[stage].price;
  const next = stages[stage + 1] || null;

  return {
    ready: true,
    price: now,
    nextPrice: next ? next.price : null,
    soldToNext: next ? Math.max(0, next.from - sold) : null,
    stage: stage + 1,
    stages,
    atTop: !next,
    // 手数料が入っていなければ手取りを出さない（0と置かない）。
    netPerSale: p.feePct ? Math.round(now * (1 - p.feePct / 100)) : null,
  };
}

/** 画面に出す1行。 */
export function priceLine(plan) {
  if (!plan || !plan.ready) return '値段の段をまだ決めていません。最初の値段と、最終的に売りたい値段を入れてください。';
  if (plan.atTop) return `いまは${plan.price.toLocaleString('ja-JP')}円（最後の段）。ここから先は自分で決めてください。`;
  return `いまは${plan.price.toLocaleString('ja-JP')}円。あと${plan.soldToNext}部売れたら${plan.nextPrice.toLocaleString('ja-JP')}円へ。`;
}

/**
 * 無料のレター（買うかどうかを決める部分）を書く役。
 * **最初から居る6役職には入っていない**ので、未雇用だとこの手順ごと計画から外れる。
 * `data/workflows.js` の `paid_note` と必ずそろえること。
 */
export const LETTER_ROLE_ID = 'writer';

// ── 売る前の確認 ──
//
// 出来のいい記事を作れても、売り方でつまずく人が多い。
// **「自動で出す」は入れない**——規約違反でアカウントごと止められるため。

export const SELL_CHECKS = [
  {
    id: 'byhand',
    label: '最後に出すのは自分の手でやる',
    why: '道具でまとめて大量に投稿すると、迷惑投稿と見なされてアカウントが止まることがあります。作るところまでを任せて、出すのは自分で。',
  },
  {
    id: 'terms',
    label: '出す場所の規約（禁止事項）を読んだ',
    why: '知らずに違反していた、が一番多い終わり方です。読むのは1回で済みます。',
  },
  {
    id: 'border',
    label: '無料で読める所と、有料の所の境目を決めた',
    why: '読む人はまず無料のところを読んで、続きを読みたいかを決めます。ここが売れるかどうかの分かれ目です。',
  },
  {
    id: 'cover',
    label: '表紙（サムネイル）を用意した',
    why: '一覧でまず目に入るのは表紙です。開かれなければ、中身は無いのと同じになります。',
  },
  {
    id: 'profile',
    label: 'プロフィールを整えた',
    why: '買う前に「この人は誰か」を見られます。実績・具体的な数字・読み手との共通点・親しみやすさの4つを入れておくと伝わります。',
  },
  {
    id: 'price',
    label: '値段を決めた（安すぎ・高すぎの両方を避けた）',
    why: '安すぎると手元に残らず、内容も軽く見られます。高すぎると、まだ知られていないうちは届きません。',
  },
  {
    id: 'refund',
    label: '返金の受け付けをどうするか決めた',
    why: '読み終えてから返金を求められる形になっていないか、出す前に一度だけ確かめます。',
  },
];

export function normalizeSellChecks(v) {
  const out = {};
  for (const c of SELL_CHECKS) out[c.id] = Boolean(v && v[c.id]);
  return out;
}

/** 済んだ数と、残っているもの。**通せない関門にはしない**（数えるだけ）。 */
export function sellReview(venture) {
  const done = normalizeSellChecks(venture && venture.sellChecks);
  const left = SELL_CHECKS.filter((c) => !done[c.id]);
  return { done, left, count: SELL_CHECKS.length - left.length, total: SELL_CHECKS.length };
}

export function sellLine(review) {
  if (!review) return '';
  if (!review.left.length) return `${review.total}つとも確かめました。`;
  return `${review.count}／${review.total}。残り：${review.left.map((c) => c.label).join('／')}`;
}
