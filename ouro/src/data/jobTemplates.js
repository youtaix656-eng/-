// 「AI社員を使って収入にする」ための案件テンプレート。
//
// 金額はすべて **目安** であり、実際の相場は時期・地域・実績で大きく変わる。
// アプリ内では必ず「※目安。相場はリサーチャーに調べさせてください」と添える
// （調べていない数字を確定した相場のように見せない）。

export const JOB_TEMPLATES = [
  {
    id: 'article',
    name: 'ブログ記事・コラム作成',
    glyph: '✎',
    feeHint: [3000, 15000],
    unit: '1記事',
    startCost: 0,
    skillNeed: '低',
    desc: '依頼者のテーマで記事を書く。AI社員が調べ、書き、誤りを潰すところまで担当する。',
    workflowId: 'make_content',
    firstStep:
      'まず自分が書けるテーマを3つ決め、リサーチャーに「そのテーマの需要と相場」を調べさせる。',
    caution: '納品物に事実の誤りがあると信用を失う。レビュアーの検証を必ず通すこと。',
  },
  {
    id: 'sns',
    name: 'SNS投稿の作成代行',
    glyph: '◍',
    feeHint: [5000, 30000],
    unit: '月10〜30本',
    startCost: 0,
    skillNeed: '低',
    desc: '店舗・個人事業の投稿文を作る。反応を見ながら改善するところまでやると継続になりやすい。',
    workflowId: 'make_content',
    firstStep: '身近な店・知人の事業で1か月無料で試させてもらい、実績のスクリーンショットを作る。',
    caution: '効果を保証しない。改善の記録を残すことが次の受注につながる。',
  },
  {
    id: 'research_report',
    name: 'リサーチ代行レポート',
    glyph: '⌕',
    feeHint: [5000, 50000],
    unit: '1件',
    startCost: 0,
    skillNeed: '中',
    desc: '「この分野の現状を知りたい」に対し、出典つきのレポートを出す。Ouro が最も得意な形。',
    workflowId: 'deep_research',
    firstStep: '徹底調査ワークフローで自分の興味分野を1本作り、それをサンプルとして提示する。',
    caution: '出典のない主張を入れない。ここが他の代行との差になる。',
  },
  {
    id: 'slides',
    name: '資料・スライド作成代行',
    glyph: '▤',
    feeHint: [5000, 40000],
    unit: '10〜30枚',
    startCost: 0,
    skillNeed: '中',
    desc: '話の骨組みと原稿を作る。図の指示までAI社員に出させ、自分は形にする。',
    workflowId: 'make_content',
    firstStep: '自分の得意分野で10枚の見本を作る。見本が無いと発注されない。',
    caution: '相手の社内用語・体裁に合わせる。ヒアリングを省かない。',
  },
  {
    id: 'transcript',
    name: '文字起こし・整文',
    glyph: '✍',
    feeHint: [1000, 10000],
    unit: '60分',
    startCost: 0,
    skillNeed: '低',
    desc: '録音を文字にし、読める文章に直す。単価は低いが最初の実績を作りやすい。',
    workflowId: 'quick',
    firstStep: '自分の声で30分録音し、整文の見本を1本作る。',
    caution: '守秘義務のある音源を扱うことがある。外部サービスに上げる前に確認する。',
  },
  {
    id: 'script',
    name: 'YouTube台本・構成',
    glyph: '▷',
    feeHint: [3000, 30000],
    unit: '1本',
    startCost: 0,
    skillNeed: '中',
    desc: '企画・構成・台本を作る。伸びている動画の型を調べるところから始める。',
    workflowId: 'make_content',
    firstStep: '狙うジャンルの動画を10本、リサーチャーに構成分析させて型を出す。',
    caution: '他人の台本をなぞらない。型は真似てよいが文章はコピーしない。',
  },
  {
    id: 'product_copy',
    name: '商品説明文・販売ページ',
    glyph: '➤',
    feeHint: [3000, 50000],
    unit: '1商品',
    startCost: 0,
    skillNeed: '中',
    desc: '売り手の言葉を、買い手の困りごとの言葉に翻訳する。',
    workflowId: 'make_content',
    firstStep: '既存の販売ページを3つ選び、改善案をマーケターに書かせて提案してみる。',
    caution: '効能・効果の断定は法律に触れることがある（healthcare・美容は特に注意）。',
  },
  {
    id: 'own_media',
    name: '自分の発信を資産にする',
    glyph: '◉',
    feeHint: [0, 0],
    unit: '長期',
    startCost: 0,
    skillNeed: '低',
    desc:
      '受注ではなく、自分の知識ベースを外へ出していく道。すぐには稼げないが、' +
      '蓄積した知識がそのまま元手になる。受注仕事と並行して積む。',
    workflowId: 'learn',
    firstStep: '知識ベースに10件たまったら、その中で一番役に立ったものを1本の記事にして公開する。',
    caution: '短期の収入にはならない。生活費は受注仕事で確保したうえで積む。',
  },
];

export function templateById(id) {
  return JOB_TEMPLATES.find((t) => t.id === id) || null;
}

/** 元手ゼロで始めやすい順（開始費用 → 必要スキル → 単価の下限）。 */
export function easiestFirst() {
  const need = { 低: 0, 中: 1, 高: 2 };
  return [...JOB_TEMPLATES].sort(
    (a, b) =>
      a.startCost - b.startCost ||
      (need[a.skillNeed] ?? 1) - (need[b.skillNeed] ?? 1) ||
      b.feeHint[0] - a.feeHint[0]
  );
}
