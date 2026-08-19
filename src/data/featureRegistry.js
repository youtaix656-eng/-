// 全機能レジストリ（単一の正）。
// 「全機能一覧」画面（FeatureIndex.jsx）と CLAUDE.md の機能一覧は、どちらもこのファイルを参照する。
// 新しい機能を追加・削除・変更したら、必ずこの配列も更新すること
// （npm run validate で view が実在するかを機械チェックしている）。
//
// { id, title, icon, category, view, desc, tags, sub? }
//   view: App.jsx の case（画面の遷移先）。サブ機能は親画面の view を指す。
//   sub: true なら「単独の画面」ではなく、他画面の中にある機能。

const featureRegistry = [
  // ---- 学習・演習 ----
  { id: 'session', title: '学習（10・60・300・900）', icon: '📚', category: '学習・演習', view: 'session', desc: '60問で区切り・300問で今日の目標・900問で1周。1問ごと自動保存で、いつでも続きから。完了画面で「明日の最初の1タスク」も決められます。', tags: ['学習セッション', '習慣化', '明日のタスク'] },
  { id: 'connect', title: '連結学習（今日の1問）', icon: '🔗', category: '学習・演習', view: 'connect', desc: '過去問を一生モノの知識に。1日1問を深掘りし、キーワードでつなげて知識の地図を育てる。', tags: ['連結学習', 'キーワード'] },
  { id: 'quiz', title: '一問一答', icon: '✏️', category: '学習・演習', view: 'quiz', desc: '科目別に問題演習。○×・四択に対応。', tags: ['一問一答'] },
  { id: 'quiz-why', title: '自己説明ステップ（なぜこの答え？）', icon: '🤔', category: '学習・演習', view: 'quiz', sub: true, desc: '誤答時に「なぜこの答え？」を自分の言葉で一言書くよう自動で促す（一問一答・復習画面）。', tags: ['自己説明', '誤答', 'whyPrompt'] },
  { id: 'choicequiz', title: '4択問題', icon: '4️⃣', category: '学習・演習', view: 'choicequiz', desc: '過去問／模試／その他から選び、科目別に四択だけを演習。', tags: ['4択', 'ファイル分け'] },
  { id: 'builder', title: '出題を作る', icon: '🎛️', category: '学習・演習', view: 'builder', desc: '科目・回次・ジャンル・問題数を指定して出題。検索も。', tags: ['カスタム出題'] },
  { id: 'toc', title: '目次', icon: '📖', category: '学習・演習', view: 'toc', desc: '取り込んだ問題を科目・キーワードで一覧。範囲を選んで演習。', tags: ['目次', '一覧'] },
  { id: 'flashcards', title: 'フラッシュカード', icon: '🃏', category: '学習・演習', view: 'flashcards', desc: '経穴カード＋全科目対応。問題からその場でカードを作って反復。', tags: ['フラッシュカード', '経穴'] },
  { id: 'mnemonics', title: '語呂合わせノート', icon: '💡', category: '学習・演習', view: 'mnemonics', desc: '登録した語呂合わせを一覧で見返す。その場で追加・編集も。', tags: ['語呂合わせ'] },
  { id: 'audio', title: '音声学習', icon: '🎧', category: '学習・演習', view: 'audio', desc: '検索フィルタ＋連結学習モード1〜10（よく使う順）。今日のおすすめ・弱点分析・問題数の目標・ブックマーク・読み方の手動補正辞書つき。', tags: ['音声学習', 'ながら学習', '弱点分析', 'ブックマーク'] },
  { id: 'exam', title: '模擬試験', icon: '📝', category: '学習・演習', view: 'exam', desc: '午前/午後(本番同形式)・得意/苦手(自動提案)・選択式の5モード。', tags: ['模試', '本番形式'] },

  // ---- 復習・弱点対策 ----
  { id: 'review', title: '間違えた問題', icon: '🔁', category: '復習・弱点対策', view: 'review', desc: '間隔反復（SRS）で弱点を集中復習。', tags: ['SRS', '復習'] },
  { id: 'home-due-review', title: '今日の復習カード（ホーム前面化）', icon: '🔁', category: '復習・弱点対策', view: 'home', sub: true, desc: 'SRSで期限が来ている件数をホーム画面に大きく表示。タップで復習へ直行。', tags: ['SRS', 'ホーム'] },
  { id: 'next-task', title: '明日の最初の1タスク', icon: '📌', category: '復習・弱点対策', view: 'home', sub: true, desc: '学習セッション完了画面で次にやることを1つだけ決めておくと、次回ホーム画面の一番上に固定表示。「何から始めるか」で迷う時間をなくす。', tags: ['習慣化', 'ホーム', '次のタスク'] },
  { id: 'mascot', title: 'ハリオ先生（AIマスコット）', icon: '🧑‍⚕️', category: '復習・弱点対策', view: 'home', sub: true, desc: '状況に応じた一言（試験日・復習件数・連続日数・前日の理由・模試結果・今日の調子など）に加え、苦手・忘却リスクの分析／今日の進捗（1日の目標との差）をタップで各画面へ。今日の調子（元気・普通・しんどい）をワンタップ記録するとノルマも自動調整。', tags: ['マスコット', 'ハリオ先生', '分析', '今日の進捗', '今日の調子'] },
  { id: 'streak-break', title: 'できなかった日の原因分解', icon: '🌱', category: '復習・弱点対策', view: 'home', sub: true, desc: '連続日数が前日で途切れると、責めずに理由（時間がなかった／やる気が出なかった等）をワンタップ記録。また今日から戻れるようにする。', tags: ['ストリーク', 'ホーム', '習慣化'] },
  { id: 'mistakes', title: '間違いノート', icon: '📓', category: '復習・弱点対策', view: 'mistakes', desc: '間違えた問題＋メモをPDF/テキスト出力。移動中の見返しに。', tags: ['間違いノート', '出力'] },
  { id: 'misstypes', title: '誤答理由の分類', icon: '🏷️', category: '復習・弱点対策', view: 'review', sub: true, desc: '勘違い／知識不足／ケアレスをワンタップ記録し、型別に解説の出し方を変える。', tags: ['誤答理由', 'missTypes'] },
  { id: 'dashboard', title: '弱点分析', icon: '📊', category: '復習・弱点対策', view: 'dashboard', desc: '科目別の正答率をグラフで確認。', tags: ['正答率'] },
  { id: 'analytics', title: '分析・攻略率・合格診断', icon: '📈', category: '復習・弱点対策', view: 'analytics', desc: '合格ラインまであと何%・出題範囲の攻略率・合格者スタイルを診断。', tags: ['分析', '合格診断'] },
  { id: 'forgetting', title: '忘却予測', icon: '🧠', category: '復習・弱点対策', view: 'analytics', sub: true, desc: '保持率をエビングハウス的な指数減衰で推定し、忘れそうな問題を先読み表示（分析画面内）。', tags: ['忘却曲線', 'forgetting.js'] },
  { id: 'weakclusters', title: '弱点クラスタ', icon: '🧩', category: '復習・弱点対策', view: 'analytics', sub: true, desc: 'タグの共起から弱点テーマを自動抽出（分析画面内）。', tags: ['弱点クラスタ', 'weakClusters.js'] },
  { id: 'difficulty', title: '難易度推定', icon: '🎚️', category: '復習・弱点対策', view: 'analytics', sub: true, desc: '正答率から難問を抽出（分析画面内）。', tags: ['難易度'] },
  { id: 'coverage', title: '網羅マップ', icon: '🗺️', category: '復習・弱点対策', view: 'coverage', desc: '出題基準×収録数を色で俯瞰。手薄・未収録の科目が一目で分かる。', tags: ['網羅マップ'] },

  // ---- 知識の整理 ----
  { id: 'mindmap', title: 'マインドマップ', icon: '🧠', category: '知識の整理', view: 'mindmap', desc: 'つながる語・比較・数値注意を1枚に。引っかけに強くなる。', tags: ['マインドマップ', '比較'] },
  { id: 'kgraph', title: '知識グラフ', icon: '🕸️', category: '知識の整理', view: 'kgraph', desc: '解くたびに概念が自動でつながる。中心概念・強い連想・次に広がる問題を提示。', tags: ['知識グラフ'] },
  { id: 'assoctrainer', title: '連想トレーニング', icon: '🔂', category: '知識の整理', view: 'kgraph', sub: true, desc: '連結リコール（辺のSRS）＋対比識別ドリルで、つながり・対比を間隔反復（知識グラフ画面内）。', tags: ['対比識別', 'AssocTrainer'] },
  { id: 'assocquiz', title: '連想クイズ', icon: '🧭', category: '知識の整理', view: 'kgraph', sub: true, desc: '経路クイズ（A-?-Bの中間当て）＋束グルーピング（仲間はどれ）（知識グラフ画面内）。', tags: ['経路クイズ', 'AssocQuiz'] },
  { id: 'relationauthor', title: '関係オーサリング', icon: '🖇️', category: '知識の整理', view: 'kgraph', sub: true, desc: '概念どうしを自分で型付きに結び、知識グラフへ反映（知識グラフ画面内）。', tags: ['関係オーサリング', 'RelationAuthor'] },

  // ---- 記録・管理 ----
  { id: 'memos', title: 'メモ一覧', icon: '📌', category: '記録・管理', view: 'memos', desc: '付箋を残した問題をまとめて確認。', tags: ['メモ'] },
  { id: 'calendar', title: 'カレンダー', icon: '🗓️', category: '記録・管理', view: 'calendar', desc: '勉強や試験の予定を書き込み。試験までのカウントダウンも。', tags: ['カレンダー'] },
  { id: 'venues', title: '試験会場・ホテル', icon: '🏛️', category: '記録・管理', view: 'venues', desc: '受験会場と近くの宿泊候補を登録・メモ。', tags: ['試験会場'] },
  { id: 'examcontent', title: '鍼灸国家試験の内容', icon: '📋', category: '記録・管理', view: 'examcontent', desc: '試験概要・出題基準・持ち物などを貼り付けて管理。', tags: ['試験情報'] },
  { id: 'experiences', title: '体験談ノート', icon: '🗣️', category: '記録・管理', view: 'experiences', desc: '体験談や体調・生活の気づきを記録。端末内だけに保存（非公開）。', tags: ['体験談'] },
  { id: 'numbers', title: '数値の棚卸し・一括更新', icon: '🔢', category: '記録・管理', view: 'numbers', desc: '国民医療費・平均寿命・出生率など毎年変わる数値を、全科目まとめて更新。', tags: ['数値', '棚卸し'] },
  { id: 'unread', title: '読み取れないページ', icon: '📄', category: '記録・管理', view: 'unread', desc: '取り込みで読み取れなかったページ・問題を控えておく。あとで読み取れたら消せる。', tags: ['読み取れないリスト'] },
  { id: 'roadmap', title: '合格するためのロードマップ', icon: '🗺️', category: '記録・管理', view: 'roadmap', desc: '本番までの計画・やること/NG・新規→△✕の切替時期・音声学習の使い方まで。', tags: ['ロードマップ', '計画'] },
  { id: 'scope', title: '試験範囲', icon: '🗂️', category: '記録・管理', view: 'scope', desc: '全14科目（午前/午後）と収録状況・合格ライン。', tags: ['試験範囲'] },

  // ---- 取り込み・作問支援 ----
  { id: 'import', title: '問題を取り込む（PDF・写真・文章・ファイル）', icon: '📥', category: '取り込み・作問支援', view: 'import', desc: 'PDFや本のページ写真、CSV/JSON、貼り付けた文章から問題を追加。', tags: ['取り込み'] },
  { id: 'ocr', title: '写真から取り込み', icon: '📷', category: '取り込み・作問支援', view: 'ocr', sub: true, desc: '問題集や参考書のページ写真から文字を読み取って取り込む（取り込み画面内）。', tags: ['OCR'] },
  { id: 'parse', title: '自由文から自動作成', icon: '📝', category: '取り込み・作問支援', view: 'parse', sub: true, desc: '貼り付けた自由文から問題を自動で作る（取り込み画面内）。', tags: ['自動作成'] },
  { id: 'notegen', title: '文章から問題を作る', icon: '✍️', category: '取り込み・作問支援', view: 'notegen', sub: true, desc: '教科書などの説明文から問題を生成する（取り込み画面内）。', tags: ['問題生成'] },
  { id: 'tools', title: '問題ツール（自動生成・誤りチェック）', icon: '🧪', category: '取り込み・作問支援', view: 'tools', desc: '経穴マスタから問題を自動生成。既存問題の形式・重複・矛盾・経穴×経絡の誤りを点検（runAllChecks）。', tags: ['自動生成', '誤りチェック'] },

  // ---- 設定・その他 ----
  { id: 'settings', title: '設定・問題データ管理', icon: '⚙️', category: '設定・その他', view: 'settings', desc: 'CSV / JSON のインポート、音声設定、データ管理。', tags: ['設定'] },
  { id: 'errorlog', title: 'エラーログ', icon: '🪵', category: '設定・その他', view: 'settings', sub: true, desc: '端末内エラーの閲覧・消去（外部送信なし、設定画面内）。', tags: ['エラーログ'] },
];

export default featureRegistry;
