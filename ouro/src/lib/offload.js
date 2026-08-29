// 任せたら月いくら浮くか——**「便利になった」ではなく、算数で言う。**
//
// AIを入れる話は「速くなった」「楽になった」で終わりやすい。
// けれど実際に効くのは、**手でやっている作業が月に何時間あって、それが金額でいくらか**を
// 出したときだけ。FAXの手打ちを自動化して事務が1人月ぶん浮く、のような話は
// 感想ではなく引き算で出ている。ここはその引き算だけをやる。
//
// 決まりごと：
//  ・**AIを呼ばない。** 掛け算と引き算だけ。
//  ・**手元に無い基準を持たない。** 平均賃金・相場・「◯割なら健全」は書かない。
//    時給は必ずあなたが入れる（入っていなければ時間だけ出して、金額は出さない）。
//  ・**分からないものを0と書かない。** 時給が無ければ `yen` は null（0 ではない）。
//  ・**採点しない・順位を煽らない。** 出すのは自分の数字の中の大小だけ。
//  ・**勝手に任せない。** 「これを任せませんか」と出すだけで、決めるのは人。

/** 作業の状態。任せた後も消さずに残す（実際に浮いたかを見るため）。 */
export const CHORE_WHO = {
  me: '自分でやっている',
  ai: 'AI社員に任せた',
};

export const MAX_CHORES = 40;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** 1件の作業。分数・回数は0でも保存できる（あとから埋められる）。 */
export function makeChore(input = {}) {
  const title = String(input.title || '').trim().slice(0, 60);
  if (!title) return null;
  const now = Date.now();
  return {
    id: input.id || `chore_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    title,
    minutes: num(input.minutes),          // 1回あたりの分
    timesPerMonth: num(input.timesPerMonth), // 月に何回
    who: CHORE_WHO[input.who] ? input.who : 'me',
    aiCostYen: num(input.aiCostYen),      // 任せたあとに実際にかかった月のAI費用（分かれば）
    note: String(input.note || '').trim().slice(0, 200),
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeChore(c) {
  if (!c || !c.id) return null;
  return {
    id: c.id,
    title: String(c.title || '').slice(0, 60),
    minutes: num(c.minutes),
    timesPerMonth: num(c.timesPerMonth),
    who: CHORE_WHO[c.who] ? c.who : 'me',
    aiCostYen: num(c.aiCostYen),
    note: String(c.note || '').slice(0, 200),
    createdAt: c.createdAt || Date.now(),
    updatedAt: c.updatedAt || c.createdAt || Date.now(),
  };
}

export function normalizeChores(list) {
  return (Array.isArray(list) ? list : []).map(normalizeChore).filter(Boolean).slice(0, MAX_CHORES);
}

/**
 * 1件ぶんの月あたり。
 * **時給が入っていなければ金額は null**（0 ではない。0 と書くと「タダの作業」に見える）。
 * @returns {{hours:number, yen:number|null}}
 */
export function choreMonthly(chore, hourlyYen) {
  const c = normalizeChore(chore);
  if (!c) return { hours: 0, yen: null };
  const hours = (c.minutes * c.timesPerMonth) / 60;
  const rate = num(hourlyYen);
  return { hours, yen: rate ? Math.round(hours * rate) : null };
}

/**
 * 棚卸し。
 * @param {object} o { chores, hourlyYen, revenueYen }
 *   revenueYen … 月の売上（分かれば）。**入っていなければ利益率は出さない。**
 * @returns {object}
 */
export function offloadReview({ chores = [], hourlyYen = 0, revenueYen = 0 } = {}) {
  const list = normalizeChores(chores);
  const rate = num(hourlyYen);
  const rev = num(revenueYen);

  const withCalc = list.map((c) => ({ ...c, ...choreMonthly(c, rate) }));
  const mine = withCalc.filter((c) => c.who === 'me');
  const moved = withCalc.filter((c) => c.who === 'ai');

  const sumHours = (a) => a.reduce((n, c) => n + c.hours, 0);
  const sumYen = (a) => (rate ? a.reduce((n, c) => n + (c.yen || 0), 0) : null);

  const movedYen = sumYen(moved);
  const aiYen = moved.reduce((n, c) => n + c.aiCostYen, 0);
  // 浮いた額 ＝ 任せた作業の人件費 − 実際にかかったAI費用。
  // 時給が無ければ出さない（AI費用だけ引くと必ずマイナスになり、嘘になる）。
  const netYen = movedYen === null ? null : movedYen - aiYen;

  return {
    hourly: rate || null,
    counted: list.length,
    mine,
    moved,
    mineHours: sumHours(mine),
    mineYen: sumYen(mine),
    movedHours: sumHours(moved),
    movedYen,
    aiYen,
    netYen,
    // 売上に対して、浮いた額がどれだけか。**売上が入っていなければ出さない。**
    marginPct: netYen === null || !rev ? null : Math.round((netYen / rev) * 1000) / 10,
    // いちばん時間を食っている「自分でやっている作業」。0件なら null。
    top: mine.slice().sort((a, b) => b.hours - a.hours)[0] || null,
  };
}

const yen = (n) => `¥${Math.round(n).toLocaleString('ja-JP')}`;
const hrs = (n) => `${Math.round(n * 10) / 10}時間`;

/** 画面に出す1行。**分からない所は「不明」と正直に出す。** */
export function offloadLine(review) {
  if (!review || !review.counted) return 'まだ作業を書き出していません。手でやっていることを1つ入れてみてください。';
  if (!review.hourly) {
    return `自分でやっている作業が月 ${hrs(review.mineHours)}。時給を入れると、これが金額で出ます。`;
  }
  const parts = [`自分でやっている作業が月 ${hrs(review.mineHours)}（${yen(review.mineYen)}ぶん・目安）`];
  if (review.moved.length) {
    parts.push(
      review.netYen === null
        ? `任せたぶんが月 ${hrs(review.movedHours)}`
        : `任せたぶんで ${yen(review.netYen)} 浮いた計算（目安）`
    );
  }
  return `${parts.join('。')}。`;
}

/**
 * 次にやること。**提案するだけ・順位は自分の数字の中だけ。**
 * @returns {{title:string, body:string}[]}
 */
export function offloadAdvice(review) {
  if (!review) return [];
  const out = [];
  if (!review.counted) {
    out.push({
      title: 'まず書き出す',
      body: '毎月くり返している手作業を、思いつく順に3つだけ入れてください。分数と回数は目分量でかまいません。',
    });
    return out;
  }
  if (!review.hourly) {
    out.push({
      title: '時給を1つ決める',
      body: 'あなたの1時間をいくらと置くかは、あなたにしか決められません（相場は使いません）。決めると、上の時間がそのまま金額になります。',
    });
  }
  if (review.top && review.top.hours > 0) {
    const y = review.top.yen === null ? '' : `（${yen(review.top.yen)}ぶん・目安）`;
    out.push({
      title: `いちばん重いのは「${review.top.title}」`,
      body: `月 ${hrs(review.top.hours)}${y}。ここを1つ任せるだけで、他をどれだけ速くするより効きます。`,
    });
  }
  if (review.moved.length && review.aiYen === 0) {
    out.push({
      title: '任せたあとのAI費用を入れる',
      body: '入っていないと「浮いた額」が多めに出ます。会社画面の費用から、その作業ぶんの目安を入れてください。',
    });
  }
  if (review.marginPct !== null) {
    out.push({
      title: '売上に対してどれだけか',
      body: `浮いた額は、いま入れている月の売上の ${review.marginPct}% にあたります（あなたの数字どうしの比較で、よその基準ではありません）。`,
    });
  }
  return out;
}
