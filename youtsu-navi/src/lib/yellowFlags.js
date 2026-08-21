// イエローフラッグ（慢性化しやすさの手がかり）
//
// レッドフラッグ（危険信号＝受診の判断）とは別の観点で、「施術だけでは改善しにくく、
// 伝え方や生活の組み立てを変えたほうがよい」ことを示す因子。
// 責める材料ではなく、関わり方を選ぶための材料として扱う。

export const YELLOW_FLAGS = [
  {
    id: 'fear_avoidance',
    tags: ['yellow:fear_avoidance'],
    title: '恐怖回避思考',
    detail: '「動くと悪化する」という考えから活動を控えている状態。',
    advice: '安静そのものが回復を遅らせることを、責めない言い方で伝える。恐れている動作を痛みの出ない範囲から少しずつ試してもらう。',
  },
  {
    id: 'catastrophizing',
    tags: ['yellow:catastrophizing'],
    title: '破局的な受け止め',
    detail: '「このまま治らない」「重い病気では」と強く心配している状態。',
    advice: 'レッドフラグに該当しないことを具体的に説明し、回復の見通しを言葉にする。画像所見を強調しすぎない。',
  },
  {
    id: 'rest_seeking',
    tags: ['yellow:rest_seeking', 'impact:off_work'],
    title: '活動量の低下',
    detail: '安静の時間が長い、仕事を休んでいるなど、活動が大きく減っている状態。',
    advice: '完全休養ではなく、できる範囲での活動継続を提案する。復帰の段階を一緒に決める。',
  },
  {
    id: 'work_dissatisfaction',
    tags: ['yellow:work_dissatisfaction'],
    title: '仕事の負担・ストレス',
    detail: '仕事の負担や人間関係のストレスがある状態。腰痛の遷延と関連するとされる。',
    advice: '施術だけで解決しない領域であることを前提に、作業環境や休憩の取り方など変えられる部分に焦点を当てる。',
  },
  {
    id: 'low_mood',
    tags: ['yellow:low_mood'],
    title: '気分の落ち込み',
    detail: '気分の低下・意欲の低下がある状態。痛みと相互に悪循環をつくる。',
    advice: '強い落ち込みや「消えたい」などの発言があれば、医療・相談機関につなぐことを優先する。',
  },
  {
    id: 'sleep_disturbed',
    tags: ['impact:sleep_disturbed'],
    title: '睡眠の障害',
    detail: '痛みで眠れない・目が覚める状態。睡眠不足は痛みの感じ方を強める。',
    advice: '夜間痛はレッドフラグ（腫瘍・感染）の可能性も含むため、まず安全確認を済ませる。そのうえで寝る姿勢・寝具を確認する。',
  },
  {
    id: 'analgesic_ineffective',
    tags: ['meds:analgesic_ineffective'],
    title: '鎮痛薬が効かない',
    detail: '鎮痛薬を使っても変化がない状態。機械的な痛みらしくない可能性がある。',
    advice: '保存療法で1か月改善しない場合は、医療機関での再評価をすすめる。',
  },
];

/** 立っているタグから該当するイエローフラッグを返す */
export function yellowFlagsFor(tags = []) {
  const set = new Set(tags);
  return YELLOW_FLAGS.filter((f) => f.tags.some((t) => set.has(t)));
}

export const RISK_LEVELS = {
  none: { key: 'none', label: '該当なし', tone: 'ok' },
  low: { key: 'low', label: '低め', tone: 'ok' },
  mid: { key: 'mid', label: '中程度', tone: 'warn' },
  high: { key: 'high', label: '高め', tone: 'warn' },
};

/**
 * 慢性化リスクの目安。該当数と経過（慢性かどうか）から決める。
 * 3件以上、または慢性＋2件以上で「高め」。
 */
export function chronicityRisk(tags = []) {
  const hits = yellowFlagsFor(tags);
  const set = new Set(tags);
  const chronic = set.has('duration:chronic') || set.has('duration:subacute') || set.has('duration:recurrent');
  let level = 'none';
  if (hits.length >= 3 || (chronic && hits.length >= 2)) level = 'high';
  else if (hits.length === 2 || (chronic && hits.length === 1)) level = 'mid';
  else if (hits.length === 1) level = 'low';
  return { level, info: RISK_LEVELS[level], hits, chronic };
}

/** 施術者の控え・結果画面に出す一文 */
export function riskSummaryText(risk) {
  if (risk.level === 'none') return '慢性化に関わる項目の該当はありません。';
  const names = risk.hits.map((h) => h.title).join('・');
  if (risk.level === 'high') {
    return `慢性化に関わる項目が${risk.hits.length}件（${names}）該当しています。施術に加えて、伝え方と生活の組み立てを一緒に見直してください。`;
  }
  if (risk.level === 'mid') {
    return `慢性化に関わる項目が${risk.hits.length}件（${names}）該当しています。経過が長引く場合は関わり方を変える判断材料になります。`;
  }
  return `慢性化に関わる項目が1件（${names}）該当しています。`;
}
