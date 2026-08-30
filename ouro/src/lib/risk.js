// 続くかどうかの見立て——**速さでも品質でもなく、ここで終わる。**
//
// AIで作った稼ぎ方が終わる理由は、たいてい2つしかない：
//   ① 同じものを誰でも作れるようになる（コモディティ化）
//   ② 使っている場所の規約で止められる（アカウントごと消える）
// どちらも「もっと頑張る」では避けられないので、**始める前に自分で答えておく。**
//
// 決まりごと：
//  ・**AIを呼ばない。** いくつかの問いに自分で答えるだけ。
//  ・**採点しない・総合判定を出さない。** 「危険度72点」のような数字は、
//    手元に無い基準（他社の事例・業界平均）が無いと出せない。無いものは出さない。
//  ・**答えないことを責めない。** 分からない（unknown）が既定で、そのままでも先へ進める。
//  ・見立ての芯は「その場を使っている人から見て、うれしいものか」。
//    プラットフォームに嫌われる＝そこにいる人に嫌われている、が大体そのまま当てはまる。

export const RISK_ANSWERS = { yes: 'はい', no: 'いいえ', unknown: 'わからない' };

/**
 * 問いの一覧。**件数は必ず RISK_QUESTIONS.length から出す**
 * （文言に数を直接書くと、問いを足したときに画面だけ古い数のまま残る）。
 *  careWhen … この答えだった時に「気をつける側」として出す
 *  care     … その時にやること（**やめろとは言わない**）
 */
export const RISK_QUESTIONS = [
  {
    id: 'copy',
    q: '同じものを、他の人がすぐ真似できますか？',
    why: 'AIで作れるものは、AIで真似されます。真似された後に何が残るかで寿命が決まります。',
    careWhen: 'yes',
    care: '真似できない部分（あなたの経験・お客さん・続けた記録）を1つ足しておくと、真似された後も残ります。',
  },
  {
    id: 'platform',
    q: '1つの場所（SNS・ストアなど）が止めたら、この事業も止まりますか？',
    why: 'アカウントは自分のものではありません。消えた時に何も残らない形にしない。',
    careWhen: 'yes',
    care: '連絡先（メール・LINEなど）を自分の手元に持つと、場所が変わっても続けられます。',
  },
  {
    id: 'terms',
    q: 'その場所の規約を読んで、やっていいと確かめましたか？',
    why: '知らずに違反していた、が一番多い終わり方です。読むのは1回で済みます。',
    careWhen: 'no',
    care: '出す前に規約の「禁止事項」だけでも読んでおく。自動投稿・大量投稿・広告の扱いは特に。',
  },
  {
    id: 'liked',
    q: 'その場所を使っている人から見て、うれしいものですか？',
    why: 'プラットフォームに嫌われるものは、たいていそこにいる人に嫌われています。逆も同じです。',
    careWhen: 'no',
    care: '「自分が受け取ったら嬉しいか」で1本ずつ見直す。ここが「いいえ」のままだと、規約より先に人が離れます。',
  },
  {
    id: 'mine',
    q: 'あなたにしか出せないもの（経験・資格・お客さん）が入っていますか？',
    why: '入っていないものは、値段でしか競えなくなります。',
    careWhen: 'no',
    care: '自分の現場で見たこと・自分が失敗したことを1つ入れるだけで、代わりが利かなくなります。',
  },
  {
    id: 'seen',
    q: '同じことをやっている人を、実際に3人見ましたか？',
    why: 'AIは「速く走る」ほうには効きますが、走り出す前に一度止まる材料はくれません。'
      + '1人も見つからない時は、誰もやらない理由（需要が無い・規約で無理）が先にあることが多いです。',
    careWhen: 'no',
    care: '3人だけ探して、どこで・いくらで・何を出しているか見てください。'
      + '見つかれば「やってよい」と分かり、見つからなければ、なぜ誰もやっていないかを先に考えられます。',
  },
];

export function normalizeRisks(risks) {
  const out = {};
  for (const q of RISK_QUESTIONS) {
    const v = risks && risks[q.id];
    out[q.id] = RISK_ANSWERS[v] ? v : 'unknown';
  }
  return out;
}

/**
 * 見立て。**点は付けない。**
 * @returns {{answers:object, cares:object[], unanswered:object[], answered:number, total:number}}
 */
export function riskReview(venture) {
  const answers = normalizeRisks(venture && venture.risks);
  const cares = RISK_QUESTIONS.filter((q) => answers[q.id] === q.careWhen);
  const unanswered = RISK_QUESTIONS.filter((q) => answers[q.id] === 'unknown');
  return {
    answers,
    cares,
    unanswered,
    answered: RISK_QUESTIONS.length - unanswered.length,
    total: RISK_QUESTIONS.length,
  };
}

/** 画面に出す1行。 */
export function riskLine(review) {
  if (!review) return '';
  if (!review.answered) return `${review.total}つとも、まだ答えていません。始める前に1分で答えられます。`;
  if (review.cares.length === 0 && !review.unanswered.length) {
    return `${review.total}つとも答えました。気をつける所は、いまのところありません。`;
  }
  const parts = [];
  if (review.cares.length) parts.push(`気をつける所が${review.cares.length}つ`);
  if (review.unanswered.length) parts.push(`未回答が${review.unanswered.length}つ`);
  return `${review.answered}／${review.total}に答えました。${parts.join('・')}。`;
}
