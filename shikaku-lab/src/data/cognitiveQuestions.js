// 認知特性の自己申告 — 質問そのもののデータ。
//
// ■ これは診断ではない ────────────────────────────
// 心理検査でも医学的な診断でもない。**学習の入口を選ぶための自己申告のメモ**。
// 出てくる結果は「今日そう答えた」以上のことを言わない。合わなければ変えてよい。
// だから lib/cognitive.js は
//   ・同点のときは無理に1つに決めない（「決まりません」と出す）
//   ・未回答があるときは断定しない
//   ・「あなたは◯◯型です」という言い方をしない
// を守る。
//
// 既存の市販の認知特性テストの設問は写していない（著作物のため）。
// 質問はすべて「試験勉強の場面で実際にどうしているか」を自分で答えるもの。

/** 入り口（どの形で入れると頭に残りやすいか） */
export const CHANNELS = {
  visual: { id: 'visual', label: '図・位置で入る', reading: 'ずいちではいる', icon: '👁' },
  verbal: { id: 'verbal', label: '文字・言葉で入る', reading: 'もじことばではいる', icon: '📝' },
  auditory: { id: 'auditory', label: '音・声で入る', reading: 'おとこえではいる', icon: '🔊' },
};

/** 進め方の好み */
export const ORDERS = {
  step: { id: 'step', label: '順番に一つずつ進める', reading: 'じゅんばんにひとつずつすすめる', icon: '🪜' },
  whole: { id: 'whole', label: '全体像を先に見る', reading: 'ぜんたいぞうをさきにみる', icon: '🗺' },
};

/** 答えの段階（4段階。真ん中を作らない＝どちらかに寄せてもらう） */
export const SCALE = [
  { value: 3, label: 'よく当てはまる' },
  { value: 2, label: 'やや当てはまる' },
  { value: 1, label: 'あまり当てはまらない' },
  { value: 0, label: '当てはまらない' },
];

/**
 * axis … 'channel' か 'order'
 * key  … channel なら visual/verbal/auditory、order なら step/whole
 * 各 key に必ず同じ数の質問を置く（数が偏ると点も偏るため。テストが機械チェックする）
 */
export const COGNITIVE_QUESTIONS = [
  // ── 図・位置で入る ──
  { id: 'v1', axis: 'channel', key: 'visual', text: '覚えるとき、教科書の「どのページのどのあたりに書いてあったか」を思い出せることがある' },
  { id: 'v2', axis: 'channel', key: 'visual', text: '説明を読むより、図や表になっているほうが早く飲み込める' },
  { id: 'v3', axis: 'channel', key: 'visual', text: '自分で図を描き直すと、覚えやすくなる実感がある' },

  // ── 文字・言葉で入る ──
  { id: 'w1', axis: 'channel', key: 'verbal', text: '図よりも、文章で筋道立てて説明されたほうが納得できる' },
  { id: 'w2', axis: 'channel', key: 'verbal', text: '覚えたことを自分の言葉で書き直すと、頭の中が整理される' },
  { id: 'w3', axis: 'channel', key: 'verbal', text: '語呂合わせや言い回しで覚えたものは、あとから思い出しやすい' },

  // ── 音・声で入る ──
  { id: 'a1', axis: 'channel', key: 'auditory', text: '声に出して読むと、黙って読むより頭に入る感じがする' },
  { id: 'a2', axis: 'channel', key: 'auditory', text: '人が説明しているのを聞くだけでも、内容をつかめることが多い' },
  { id: 'a3', axis: 'channel', key: 'auditory', text: '移動中に音声で勉強するのは、自分には向いていると思う' },

  // ── 順番に一つずつ ──
  { id: 's1', axis: 'order', key: 'step', text: '最初のページから順番に進めないと、落ち着かない' },
  { id: 's2', axis: 'order', key: 'step', text: '手順が決まっていると取りかかりやすい' },
  { id: 's3', axis: 'order', key: 'step', text: '一つの分野を終えてから次に移りたい' },

  // ── 全体像を先に ──
  { id: 'h1', axis: 'order', key: 'whole', text: '先に全体の地図（目次・出題範囲）を見ないと落ち着かない' },
  { id: 'h2', axis: 'order', key: 'whole', text: '細かい所より、まず「何のためにこれをやるのか」を知りたい' },
  { id: 'h3', axis: 'order', key: 'whole', text: '分からない所があっても、とりあえず先に進めるほうだ' },
];

/** 答えなくても先へ進める（関門にしない）ことを画面にも書くための文言 */
export const COGNITIVE_DISCLAIMER = [
  'これは診断ではありません。心理検査でも医学的な検査でもありません。',
  '出るのは「今日そう答えた」という記録だけです。日によって変わります。',
  '結果に合わない勉強法でも、自分に効いているなら続けてください。',
  '答えなくても、計画書も設計書も作れます（答えた分だけ提案が具体的になります）。',
];
