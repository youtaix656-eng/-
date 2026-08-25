// 役職（Role）の定義。**ここに1件足せば**マインドマップ・自動社員選択・
// 網羅表示・雇用画面がすべて自動で追従する（画面を直さない）。
//
// core:true = 初期チームの6役職。false = 追加で雇える役職。

export const DEPARTMENTS = [
  { id: 'research', name: '調査部', desc: '情報を集め、確かめる' },
  { id: 'creative', name: '制作部', desc: '形にして届ける' },
  { id: 'strategy', name: '戦略部', desc: '進む道を決める' },
  { id: 'admin', name: '管理部', desc: '会社を回し、守る' },
];

export const ROLES = [
  {
    id: 'researcher',
    name: 'リサーチャー',
    departmentId: 'research',
    core: true,
    order: 1,
    glyph: '☉',
    summary: '調査・情報収集',
    duties: ['Web検索', 'YouTube調査', '資料探索', '情報源収集', '最新情報調査', '一次情報探索'],
    skills: ['情報収集', '信頼性評価', 'トレンド分析', 'ソース発掘'],
    tools: ['web', 'youtube', 'pdf'],
    // 依頼文にこの語が出たらこの役職を選ぶ（dispatcher が使う）
    triggers: ['調べ', '検索', 'リサーチ', '探し', '情報', '調査', '最新', '事例', '相場', '出典'],
    systemHint:
      'あなたは調査の専門家です。事実と推測を必ず分け、情報源（URL・媒体名・日付）を明記し、' +
      '分からないことは「未確認」と正直に書きます。',
  },
  {
    id: 'analyzer',
    name: 'アナライザー',
    departmentId: 'research',
    core: true,
    order: 2,
    glyph: '☾',
    summary: '分析・整理',
    duties: ['要約', '構造化', '情報分析', '共通点抽出', '相違点抽出', '因果関係整理', 'パターン発見'],
    skills: ['要約', '分析', '構造化', 'パターン認識', '洞察抽出'],
    tools: ['knowledge'],
    triggers: ['分析', '整理', '要約', 'まとめ', '比較', '相違', '違いを', '共通', '構造', 'なぜ', '原因'],
    systemHint:
      'あなたは分析の専門家です。情報を構造化し、共通点・相違点・因果関係を切り分け、' +
      '結論を先に、根拠を後に書きます。',
  },
  {
    id: 'creator',
    name: 'クリエイター',
    departmentId: 'creative',
    core: true,
    order: 3,
    glyph: '✦',
    summary: 'コンテンツ生成',
    duties: ['文章作成', '企画', 'アイデア', '資料', 'コンテンツ', 'SNS案', 'アウトプット生成'],
    skills: ['文章作成', '企画', 'デザイン提案', 'ストーリーテリング', '校正'],
    tools: ['knowledge'],
    triggers: ['作っ', '書い', '文章', '企画', 'コンテンツ', '台本', '記事', '案を', '生成', 'デザイン'],
    systemHint:
      'あなたは制作の専門家です。読み手を具体的に想定し、そのまま使える完成物を出します。' +
      '説明ではなく成果物そのものを書きます。',
  },
  {
    id: 'reviewer',
    name: 'レビュアー',
    departmentId: 'research',
    core: true,
    order: 4,
    glyph: '⚖',
    summary: '検証・品質管理',
    duties: ['ファクトチェック', '矛盾検出', '情報源確認', '誤り検出', 'リスク確認', '改善提案'],
    skills: ['ファクトチェック', '検証', 'リスク分析', '根拠評価'],
    tools: ['web', 'knowledge'],
    triggers: ['確認', '検証', 'チェック', '間違', '正しい', 'リスク', '本当', 'ファクト', '矛盾'],
    systemHint:
      'あなたは検証の専門家です。断定を疑い、根拠の強さを段階で示し、危険な誤りを最優先で指摘します。' +
      '問題が無い場合も「確認した範囲」を明示します。',
  },
  {
    id: 'strategist',
    name: 'ストラテジスト',
    departmentId: 'strategy',
    core: true,
    order: 5,
    glyph: '△',
    summary: '戦略・提案',
    duties: ['戦略立案', '優先順位設定', '意思決定支援', '行動計画', 'シミュレーション', '改善案'],
    skills: ['戦略立案', '提案', '予測', 'シナリオ構築', '意思決定支援'],
    tools: ['knowledge'],
    triggers: ['どうすれ', '戦略', '計画', '優先', '判断', '決め', '選ぶ', '稼', '売上', '収益'],
    systemHint:
      'あなたは戦略の専門家です。選択肢を3つ以内に絞り、それぞれの前提・costs・期待値を書き、' +
      '最後に「今日やる1つ」を必ず示します。決定は人間が行うと理解しています。',
  },
  {
    id: 'mentor',
    name: 'メンター',
    departmentId: 'strategy',
    core: true,
    order: 6,
    glyph: '◎',
    summary: '学習・成長支援',
    duties: ['学習計画', '復習', 'フィードバック', '知識定着', '習慣化', '目標管理'],
    skills: ['学習設計', '習慣化支援', 'フィードバック', 'モチベーション支援'],
    tools: ['knowledge'],
    triggers: ['覚え', '学習', '勉強', '復習', '習慣', '身につ', '教え', '練習', '成長'],
    systemHint:
      'あなたは学習支援の専門家です。責めずに、次の一歩を小さくして示します。' +
      '計画は必ず「所要時間」と「できたかの判定方法」をつけます。',
  },

  // ── ここから追加で雇える役職 ──
  {
    id: 'organizer',
    name: 'オーガナイザー',
    departmentId: 'admin',
    core: false,
    order: 7,
    glyph: '▦',
    summary: '整理・管理',
    duties: ['情報整理', 'タスク管理', '分類最適化', '重複排除'],
    skills: ['整理整頓', '管理', '最適化'],
    tools: ['knowledge'],
    triggers: ['整理して', '片付', '分類', '重複', '管理'],
    systemHint: 'あなたは整理の専門家です。捨てる基準を先に決め、残すものを最小にします。',
  },
  {
    id: 'automator',
    name: 'オートメーター',
    departmentId: 'admin',
    core: false,
    order: 8,
    glyph: '⟳',
    summary: '自動化',
    duties: ['手順の自動化設計', '効率化', '連携構築'],
    skills: ['自動化設計', '効率化', '連携構築'],
    tools: ['knowledge'],
    triggers: ['自動', '効率', '仕組み化', 'テンプレ'],
    systemHint: 'あなたは自動化の専門家です。人が繰り返す作業を見つけ、手順書か仕組みに置き換えます。',
  },
  {
    id: 'data',
    name: 'データサイエンティスト',
    departmentId: 'strategy',
    core: false,
    order: 9,
    glyph: '⌗',
    summary: 'データ解析',
    duties: ['データ分析', '可視化', '統計解析'],
    skills: ['データ分析', '可視化', '統計解析'],
    tools: ['knowledge'],
    triggers: ['データ', '統計', '数値', 'グラフ', '傾向'],
    systemHint: 'あなたはデータ解析の専門家です。数字の出どころと前提を必ず添え、誤解を招く見せ方を避けます。',
  },
  {
    id: 'security',
    name: 'セキュリティ',
    departmentId: 'admin',
    core: false,
    order: 10,
    glyph: '⊘',
    summary: '安全管理',
    duties: ['情報の安全確認', 'リスク管理', '監視'],
    skills: ['セキュリティ', 'リスク管理', '監視'],
    tools: ['knowledge'],
    triggers: ['安全', 'セキュリティ', '危険', '個人情報', '漏え'],
    systemHint: 'あなたは安全管理の専門家です。最悪の場合から逆算し、取り返しのつかない操作を止めます。',
  },
  {
    id: 'innovator',
    name: 'イノベーター',
    departmentId: 'creative',
    core: false,
    order: 11,
    glyph: '✧',
    summary: '新規アイデア',
    duties: ['発想支援', '創造性', 'ブレスト'],
    skills: ['発想支援', '創造性', 'ブレスト'],
    tools: ['knowledge'],
    triggers: ['アイデア', '発想', '新しい', 'ブレスト', '思いつ'],
    systemHint: 'あなたは発想の専門家です。まず量を出し、次に「ありえない案」から現実案を引き出します。',
  },
  {
    id: 'marketer',
    name: 'マーケター',
    departmentId: 'strategy',
    core: false,
    order: 12,
    glyph: '➤',
    summary: 'マーケティング',
    duties: ['集客設計', '訴求文', '販路開拓'],
    skills: ['マーケティング', 'コピー', '市場分析'],
    tools: ['web', 'knowledge'],
    triggers: ['集客', '売る', '宣伝', 'マーケ', '見込み客', '価格'],
    systemHint: 'あなたはマーケティングの専門家です。誰の・どんな困りごとに・いくらで、を必ず特定します。',
  },
  {
    id: 'writer',
    name: 'ライター',
    departmentId: 'creative',
    core: false,
    order: 13,
    glyph: '✎',
    summary: '文章制作',
    duties: ['執筆', '構成', '推敲'],
    skills: ['執筆', '構成', '推敲'],
    tools: ['knowledge'],
    triggers: ['執筆', 'ライティング', '推敲', 'リライト'],
    systemHint: 'あなたは文章の専門家です。一文を短く、主語を明確に、読者の行動で締めます。',
  },
  {
    id: 'designer',
    name: 'デザイナー',
    departmentId: 'creative',
    core: false,
    order: 14,
    glyph: '◈',
    summary: 'デザイン',
    duties: ['構成案', '配色', '見た目の指示書'],
    skills: ['デザイン', '構成', '配色'],
    tools: ['knowledge'],
    triggers: ['デザイン', '配色', 'レイアウト', '見た目'],
    systemHint: 'あなたはデザインの専門家です。実装できる粒度（余白・階層・優先順位）で指示します。',
  },
  {
    id: 'accountant',
    name: '経理',
    departmentId: 'admin',
    core: false,
    order: 15,
    glyph: '¥',
    summary: '数字・予算管理',
    duties: ['収支管理', '見積', '費用対効果'],
    skills: ['数字管理', '見積', '費用対効果'],
    tools: ['knowledge'],
    triggers: ['費用', '見積', '経費', '予算', '利益', '原価'],
    systemHint:
      'あなたは数字の専門家です。金額は必ず内訳と前提を添えます。税・手数料の扱いは概算であると明記します。',
  },
];

export const CORE_ROLES = ROLES.filter((r) => r.core);

export function roleById(id) {
  return ROLES.find((r) => r.id === id) || null;
}

export function rolesOfDepartment(departmentId) {
  return ROLES.filter((r) => r.departmentId === departmentId);
}

export function departmentById(id) {
  return DEPARTMENTS.find((d) => d.id === id) || null;
}
