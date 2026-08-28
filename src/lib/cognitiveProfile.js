// 認知特性チェック（本田40式＋対話診断）の結果をもとにした、学習法の個別提案データ。
// CognitiveStyleGuide.jsx から参照する。名前などの個人情報は持たない
// （公開リポジトリ・GitHub Pagesで配信されるため）。
// あくまで参考プロファイルであり、医学的・心理学的な確定診断ではない。

export const PROFILE = {
  headline: '能動再構成型（空間×物語×論理）',
  summary:
    '見る・読む・聴くだけの受動的なインプットでは定着しにくく、体や手を動かす・自分の言葉で組み立て直すことで初めて記憶が固定化するタイプ。',
  strengths: [
    { type: '3D（空間）タイプ', note: '体を動かして位置関係を把握するのが得意' },
    { type: 'ファンタジー（物語）タイプ', note: '症例ストーリー形式で理解が深まる' },
    { type: '辞書引き（言語抽象）タイプ', note: '対比・因果関係のロジック整理が得意' },
  ],
  weaknesses: [
    { type: 'カメラ（写真）タイプ', note: '図表の見た目そのものは記憶に残りにくい' },
    { type: '辞書（文字）タイプ', note: '黙読だけでは定着しにくい' },
    { type: 'ラジオ（聴覚言語）タイプ', note: '講義・説明を聴くだけでは定着しにくい' },
    { type: 'サウンドタイプ', note: 'BGM・環境音は集中の妨げになりやすい（無音推奨）' },
  ],
};

// 各推奨事項 → 実際に使える既存機能への導線。
// links[].view は featureRegistry.js の view と対応させる
// （cognitiveProfile.test.mjs が featureRegistry.js に実在することを機械チェックする）。
export const RECOMMENDATIONS = [
  {
    id: 'acupoint-body',
    category: '経穴学習',
    title: '図解だけで終わらせず、体で取穴する練習をセットにする',
    reason: '3D（空間）タイプは、図の丸暗記より体を動かした位置関係の記憶が得意。',
    links: [
      { view: 'acupointtap', label: '🗺️ 経穴の体表イラスト学習へ' },
      { view: 'flashcards', label: '🃏 経穴フラッシュカードへ' },
    ],
  },
  {
    id: 'case-story',
    category: '病態機序の説明',
    title: '「この患者さんは〜」という症例ストーリーとして理解する',
    reason: 'ファンタジー（物語）タイプは、文脈がある内容ほど理解が定着する。',
    links: [{ view: 'keiketsureverse', label: '🩺 経穴の逆引きクイズ（症状から）へ' }],
    note: '総合問題（症例形式の連問）は一問一答・模試の中にも収録されています。',
  },
  {
    id: 'comparison-logic',
    category: '対比表（comparisons）',
    title: 'まぎらわしい知識は、対比・因果関係の図として整理する',
    reason: '辞書引き（言語抽象）タイプは、選択肢どうしの対比や理由づけで記憶に残りやすい。',
    links: [
      { view: 'mindmap', label: '🧠 マインドマップ（対比カード）へ' },
      { view: 'kgraph', label: '🔂 対比識別ドリル（知識グラフ内）へ' },
    ],
  },
  {
    id: 'audio-recap',
    category: '音声学習',
    title: '聞きっぱなしにせず、聞いた内容を自分の言葉で言い直す',
    reason: 'ラジオ（聴覚言語）タイプは弱いため、聴くだけでは定着しにくい。',
    links: [
      { view: 'audio', label: '🎧 音声学習へ' },
      { view: 'explain', label: '🗣️ 説明ノートに書き直す' },
    ],
  },
  {
    id: 'build-not-memorize',
    category: '一問一答',
    title: '受動的な暗記カードより、自分で対比表・図を作る形式を優先する',
    reason: '受け取るだけより、自分で関係性を組み立て直す作業のほうが定着する。',
    links: [
      { view: 'kgraph', label: '🖇️ 関係オーサリング（知識グラフ内）へ' },
      { view: 'mnemonics', label: '💡 語呂合わせを自分で作る' },
    ],
  },
  {
    id: 'mindmap-spatial',
    category: 'マインドマップ',
    title: 'ノード間の空間配置・つながりの矢印を意識して辿る',
    reason: '空間的な配置そのものが記憶の手がかりになるタイプ。',
    links: [{ view: 'mindmap', label: '🧠 マインドマップへ' }],
  },
];

// アプリの機能だけでは対応できない、環境面のアドバイス。
export const ENVIRONMENT_TIPS = [
  '学習中はBGM・環境音を避け、無音の環境のほうが集中しやすい傾向があります（サウンドタイプが弱いため）。',
];
