// 1件あたりの採算——「稼ぎ ＞ API利用料」を、事業ごとに見る。
//
// AIに任せると速くなるが、**速くなっただけでは残らない。**
// 動画の言い方だと「稼ぎが API利用料 を上回っているうちは続ける」。
// これは業界平均のような外の基準を持ち出さずに引ける、たった1本の線なので、
// Ouro でもこの線だけを使う（1倍。上回っていれば黒、下回っていれば赤）。
//
// 決まりごと：
//  ・**AIを呼ばない。** 案件と仕事の記録から毎回導く。
//  ・**費用は仕事の側の dealId／ventureId から数える**（事業の側に一覧を持たない）。
//  ・**外の基準を持たない。** 「◯割なら健全」のような数字は書かない。
//    出すのは自分の売上・自分の費用と、その比だけ。

import { EARNED_STATUS, formatMoney } from './revenue.js';

/**
 * この事業の 1件あたりの採算。
 * @returns {{sales:number, earned:number, aiCost:number, net:number,
 *            perSale:number|null, costPerSale:number|null, marginPerSale:number|null,
 *            price:number, breakEven:number|null, remaining:number|null,
 *            ratio:number|null, black:boolean}}
 */
export function unitEconomics({ venture, tasks = [], deals = [], usdJpy = 155 } = {}) {
  if (!venture) return null;
  const myDeals = deals.filter((d) => d.ventureId === venture.id);
  const paid = myDeals.filter((d) => EARNED_STATUS.includes(d.status));
  const earned = paid.reduce((s, d) => s + (Number(d.fee) || 0), 0);

  // AI費用は仕事の側から。案件に紐づいていない仕事も、この事業のコスト。
  const aiCost = Math.round(
    tasks
      .filter((t) => t.ventureId === venture.id || myDeals.some((d) => d.id === t.dealId))
      .reduce((s, t) => s + (Number(t.totalCost) || 0), 0) * usdJpy
  );

  const sales = paid.length;
  const perSale = sales ? Math.round(earned / sales) : null;
  const costPerSale = sales ? Math.round(aiCost / sales) : null;
  const price = Number(venture.priceJpy) || perSale || 0;
  // いまのAI費用を取り戻すのに何本要るか。値段が分からなければ出さない（1と置かない）。
  const breakEven = price > 0 ? Math.ceil(aiCost / price) : null;

  return {
    sales,
    earned,
    aiCost,
    net: earned - aiCost,
    perSale,
    costPerSale,
    marginPerSale: sales ? Math.round((earned - aiCost) / sales) : null,
    price,
    breakEven,
    remaining: breakEven === null ? null : Math.max(0, breakEven - sales),
    ratio: aiCost > 0 ? Number((earned / aiCost).toFixed(1)) : null,
    black: earned > aiCost,
  };
}

/** 画面に出す1行。 */
export function unitLine(u) {
  if (!u) return '';
  if (!u.aiCost && !u.earned) return 'まだお金も費用も動いていません。';
  if (!u.earned) {
    return `AIに${formatMoney(u.aiCost)}使って、まだ1円も入っていません。${
      u.breakEven ? `${formatMoney(u.price)}のものが${u.breakEven}本売れると取り戻せます。` : ''
    }`;
  }
  if (!u.aiCost) return `${formatMoney(u.earned)}入って、AI費用はまだ0円です。`;
  return u.black
    ? `${formatMoney(u.earned)}入って、AIに${formatMoney(u.aiCost)}。AI費用1円あたり${u.ratio}円になっています。`
    : `${formatMoney(u.earned)}入って、AIに${formatMoney(u.aiCost)}。まだ費用のほうが多いです。`;
}

/**
 * 赤のときに出す「次にできること」。
 * **叱らない・やめろと言わない。** 手はいつも2つ（安く作る／値段を上げる）。
 */
export function costAdvice(u, settings = {}) {
  if (!u || u.black || !u.aiCost) return null;
  const tips = [];
  if (settings.costMode !== 'cheap') {
    tips.push({ id: 'cheap', text: '「安いモデルで」に切り替えると、同じ仕事のAI費用が下がります。' });
  }
  if (u.remaining) {
    tips.push({ id: 'sell', text: `いまの値段（${formatMoney(u.price)}）なら、あと${u.remaining}本で費用を取り戻せます。` });
  }
  if (!u.price) {
    tips.push({ id: 'price', text: '値段を決めると、あと何本で取り戻せるかが出せます。' });
  }
  return tips.length ? tips : null;
}
