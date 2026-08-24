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
  { id: 'buffer-technique', title: '3分の2バッファ術', icon: '🧩', category: '学習・演習', view: 'session', sub: true, desc: '学習予定時間を入力すると基礎タスク:バッファ=2:1（設定画面で調整可）に自動分割し、過去の平均解答時間から基礎タスクの問題数を逆算（学習画面内）。「今日の調子」（元気/普通/しんどい）を記録している日は、この比率が±5%の範囲で自動調整される。完了後は「マネージャービュー」で予定通り完了したか振り返り、バッファ枠の用途（ご褒美復習／積み残し消化）を自動判定。振り返りは常に「悪いのは実行役ではなくマネージャー」という前向きなトーンで、ハリオ先生がバッファ突入時・基礎タスク未達が近い時に声かけ。カレンダーの日付詳細にも、その日のロードマップフェーズを参考にした学習ブロックの目安を表示。', tags: ['3分の2バッファ術', '仕組み化', 'マネージャービュー', 'ハリオ先生', '今日の調子'] },
  { id: 'connect', title: '連結学習（今日の1問）', icon: '🔗', category: '学習・演習', view: 'connect', desc: '過去問を一生モノの知識に。1日1問を深掘りし、キーワードでつなげて知識の地図を育てる。', tags: ['連結学習', 'キーワード'] },
  { id: 'quiz', title: '一問一答', icon: '✏️', category: '学習・演習', view: 'quiz', desc: '科目別に問題演習。○×・四択に対応。', tags: ['一問一答'] },
  { id: 'quiz-why', title: '自己説明ステップ（なぜこの答え？）', icon: '🤔', category: '学習・演習', view: 'quiz', sub: true, desc: '誤答時に「なぜこの答え？」を自分の言葉で一言書くよう自動で促す（一問一答・復習画面）。', tags: ['自己説明', '誤答', 'whyPrompt'] },
  { id: 'explainnotes', title: '説明ノート（人に教えるつもりで書く）', icon: '🗣️', category: '学習・演習', view: 'explain', desc: 'マスター済みの問題から日替わりで1問を出し、自分の言葉で説明を書いて蓄積する（ファインマン式）。誤答時のwhyPromptとは対象が別（こちらは「定着したはず」の確認）。', tags: ['アウトプット', 'ファインマン', '説明ノート'] },
  { id: 'choicequiz', title: '4択問題', icon: '4️⃣', category: '学習・演習', view: 'choicequiz', desc: '過去問／模試／その他から選び、科目別に四択だけを演習。', tags: ['4択', 'ファイル分け'] },
  { id: 'builder', title: '出題を作る', icon: '🎛️', category: '学習・演習', view: 'builder', desc: '科目・回次・ジャンル・問題数を指定して出題。検索も。', tags: ['カスタム出題'] },
  { id: 'toc', title: '目次', icon: '📖', category: '学習・演習', view: 'toc', desc: '取り込んだ問題を科目・キーワードで一覧。範囲を選んで演習。', tags: ['目次', '一覧'] },
  { id: 'flashcards', title: 'フラッシュカード', icon: '🃏', category: '学習・演習', view: 'flashcards', desc: '経穴カード＋全科目対応。問題からその場でカードを作って反復。経穴カードは「覚えた/まだ」を記録するSRSに対応し、苦手なカードだけに絞って出題できる。', tags: ['フラッシュカード', '経穴', 'SRS'] },
  { id: 'acupointtap', title: '経穴の体表イラスト学習', icon: '🗺️', category: '学習・演習', view: 'acupointtap', desc: '位置→名前（4択）／名前→位置（タップ）の2方向で経穴の位置を練習できる。座標が確認できている経穴（既存の図問題と同じデータ）だけを対象にした現状サンプル（拡充予定）。フラッシュカード画面（経穴カードモード）から遷移。', tags: ['経穴', '体表イラスト', 'タップ'] },
  { id: 'mnemonics', title: '語呂合わせノート', icon: '💡', category: '学習・演習', view: 'mnemonics', desc: '登録した語呂合わせを一覧で見返す。その場で追加・編集も。', tags: ['語呂合わせ'] },
  { id: 'audio', title: '音声学習', icon: '🎧', category: '学習・演習', view: 'audio', desc: '検索フィルタ＋連結学習モード1〜10（よく使う順）。今日のおすすめ・弱点分析・問題数の目標・ブックマーク・読み方の手動補正辞書つき。', tags: ['音声学習', 'ながら学習', '弱点分析', 'ブックマーク'] },
  { id: 'exam', title: '模擬試験', icon: '📝', category: '学習・演習', view: 'exam', desc: '午前/午後(本番同形式)・得意/苦手(自動提案)・選択式の5モード。午前/午後は解答中に「今ごろ何問目のペースか」を表示し遅れを検知、終了後は時間を使いすぎた問題トップ5を表示する。', tags: ['模試', '本番形式', 'ペース管理'] },

  // ---- 復習・弱点対策 ----
  { id: 'review', title: '間違えた問題', icon: '🔁', category: '復習・弱点対策', view: 'review', desc: '間隔反復（SRS）で弱点を集中復習。科目（複数選択）・キーワード・回・ブックマーク・忘却リスク/誤答回数・直近の誤答で絞り込み。リーチ（要注意）バッジ・個別スヌーズ/リストから外す・マスター後の「念のため確認」・週間→月間ヒートマップ・科目別マスター率・弱点テーマの改善トレンド・完了画面のジャンル別正答率と弱点分析。', tags: ['SRS', '復習', 'リーチ', 'マスター率'] },
  { id: 'home-due-review', title: '今日の復習カード（ホーム前面化）', icon: '🔁', category: '復習・弱点対策', view: 'home', sub: true, desc: 'SRSで期限が来ている件数をホーム画面に大きく表示。タップで復習へ直行。', tags: ['SRS', 'ホーム'] },
  { id: 'next-task', title: '明日の最初の1タスク', icon: '📌', category: '復習・弱点対策', view: 'home', sub: true, desc: '学習セッション完了画面で次にやることを1つだけ決めておくと、次回ホーム画面の一番上に固定表示。「何から始めるか」で迷う時間をなくす。', tags: ['習慣化', 'ホーム', '次のタスク'] },
  { id: 'today-focus', title: '今日集中すべき科目 自動レコメンド', icon: '🎯', category: '復習・弱点対策', view: 'home', sub: true, desc: '残り日数×科目別の手薄度（収録数の少なさ）×直近正答率からTop3科目をホームに提示し、タップでその科目の一問一答へ直行。「明日の最初の1タスク」が決まっている日は表示しない。', tags: ['レコメンド', 'ホーム', '優先度'] },
  { id: 'mascot', title: 'ハリオ先生（AIマスコット）', icon: '🧑‍⚕️', category: '復習・弱点対策', view: 'home', sub: true, desc: '状況に応じた一言（試験日・復習件数・連続日数・前日の理由・模試結果・今日の調子など）に加え、苦手・忘却リスクの分析／今日の進捗（1日の目標との差）をタップで各画面へ。今日の調子（元気・普通・しんどい）をワンタップ記録するとノルマも自動調整。', tags: ['マスコット', 'ハリオ先生', '分析', '今日の進捗', '今日の調子'] },
  { id: 'streak-break', title: 'できなかった日の原因分解', icon: '🌱', category: '復習・弱点対策', view: 'home', sub: true, desc: '連続日数が前日で途切れると、責めずに理由（時間がなかった／やる気が出なかった等）をワンタップ記録。また今日から戻れるようにする。', tags: ['ストリーク', 'ホーム', '習慣化'] },
  { id: 'mistakes', title: '間違いノート', icon: '📓', category: '復習・弱点対策', view: 'mistakes', desc: '間違えた問題＋メモをPDF/テキスト出力。移動中の見返しに。', tags: ['間違いノート', '出力'] },
  { id: 'misstypes', title: '誤答理由の分類・型別の集中特訓', icon: '🏷️', category: '復習・弱点対策', view: 'review', sub: true, desc: '勘違い／知識不足／ケアレスをワンタップ記録し、型別に解説の出し方を変える。復習画面の絞り込みチップから型を指定すれば、その型だけを集中的に出題できる。', tags: ['誤答理由', 'missTypes', '集中特訓'] },
  { id: 'dashboard', title: '弱点分析', icon: '📊', category: '復習・弱点対策', view: 'dashboard', desc: '科目別の正答率をグラフで確認。', tags: ['正答率'] },
  { id: 'analytics', title: '分析・攻略率・合格診断', icon: '📈', category: '復習・弱点対策', view: 'analytics', desc: '合格ラインまであと何%・出題範囲の攻略率・合格者スタイルを診断。「進捗サマリーを書き出す」から通算問題数・正答率・攻略率・バッジなどを1枚にまとめてPDF/印刷で書き出せる（既存の間違いノートと同じ印刷方式）。', tags: ['分析', '合格診断', '進捗レポート'] },
  { id: 'forgetting', title: '忘却予測', icon: '🧠', category: '復習・弱点対策', view: 'analytics', sub: true, desc: '保持率をエビングハウス的な指数減衰で推定し、忘れそうな問題を先読み表示（分析画面内）。', tags: ['忘却曲線', 'forgetting.js'] },
  { id: 'weakclusters', title: '弱点クラスタ', icon: '🧩', category: '復習・弱点対策', view: 'analytics', sub: true, desc: 'タグの共起から弱点テーマを自動抽出（分析画面内）。', tags: ['弱点クラスタ', 'weakClusters.js'] },
  { id: 'difficulty', title: '難易度推定', icon: '🎚️', category: '復習・弱点対策', view: 'analytics', sub: true, desc: '正答率から難問を抽出（分析画面内）。', tags: ['難易度'] },
  { id: 'subjectbalance', title: '科目バランス警告', icon: '⚖️', category: '復習・弱点対策', view: 'analytics', sub: true, desc: '他の科目は解けているのに特定の科目だけ極端に正答率が低いまま学習が進んでいないかを検知して知らせる（分析画面内、十分な解答数がある科目のみ対象）。', tags: ['科目バランス', '偏り警告'] },
  { id: 'coverage', title: '網羅マップ', icon: '🗺️', category: '復習・弱点対策', view: 'coverage', desc: '出題基準×収録数を色で俯瞰。手薄・未収録の科目が一目で分かる。', tags: ['網羅マップ'] },
  { id: 'weeklyjournal', title: '週次の弱点ジャーナル', icon: '📓', category: '復習・弱点対策', view: 'journal', desc: '直近7日間の解答から誤答理由・弱点テーマの週報を自動生成し、来週の方針を一言書き込める。3分の2バッファ術のマネージャービューと同じく「悪いのは実行役ではなく計画の立て方」という前向きな前提でまとめる。分析画面から遷移。', tags: ['週報', '振り返り', 'ジャーナル'] },
  { id: 'pasttrends', title: '鍼灸過去問題の傾向と対策', icon: '📈', category: '復習・弱点対策', view: 'pasttrends', desc: '収録済み過去問（round・tags・genre）を実際に集計し、複数回にまたがる頻出テーマ・頻出キーワードをデータドリブンに可視化。科目別の対策優先度、日々の学習法・音声学習での活かし方、やるべきこと／やってはいけないことも提示。頻出テーマ・キーワードから一問一答へワンタップで絞り込める。', tags: ['傾向と対策', '頻出テーマ', '頻出キーワード', 'データ分析'] },

  // ---- 知識の整理 ----
  { id: 'mindmap', title: 'マインドマップ', icon: '🧠', category: '知識の整理', view: 'mindmap', desc: 'つながる語・比較・数値注意を1枚に。引っかけに強くなる。', tags: ['マインドマップ', '比較'] },
  { id: 'kgraph', title: '知識グラフ', icon: '🕸️', category: '知識の整理', view: 'kgraph', desc: '解くたびに概念が自動でつながる。中心概念・強い連想・次に広がる問題を提示。', tags: ['知識グラフ'] },
  { id: 'assoctrainer', title: '連想トレーニング', icon: '🔂', category: '知識の整理', view: 'kgraph', sub: true, desc: '連結リコール（辺のSRS）＋対比識別ドリルで、つながり・対比を間隔反復（知識グラフ画面内）。', tags: ['対比識別', 'AssocTrainer'] },
  { id: 'assocquiz', title: '連想クイズ', icon: '🧭', category: '知識の整理', view: 'kgraph', sub: true, desc: '経路クイズ（A-?-Bの中間当て）＋束グルーピング（仲間はどれ）（知識グラフ画面内）。', tags: ['経路クイズ', 'AssocQuiz'] },
  { id: 'relationauthor', title: '関係オーサリング', icon: '🖇️', category: '知識の整理', view: 'kgraph', sub: true, desc: '概念どうしを自分で型付きに結び、知識グラフへ反映（知識グラフ画面内）。', tags: ['関係オーサリング', 'RelationAuthor'] },

  // ---- 記録・管理 ----
  { id: 'memos', title: 'メモ一覧', icon: '📌', category: '記録・管理', view: 'memos', desc: '付箋を残した問題をまとめて確認。', tags: ['メモ'] },
  { id: 'calendar', title: 'カレンダー', icon: '🗓️', category: '記録・管理', view: 'calendar', desc: '勉強や試験の予定を書き込み。試験までのカウントダウンも。下部ナビの2番目。画面上部に合格ロードマップのフェーズ凡例、日付セルは背景色でフェーズを色分け表示。「全期間のロードマップを見る」で合格ロードマップへ。', tags: ['カレンダー', 'ロードマップ', '色分け'] },
  { id: 'venues', title: '試験会場・ホテル', icon: '🏛️', category: '記録・管理', view: 'venues', desc: '受験会場と近くの宿泊候補を登録・メモ。', tags: ['試験会場'] },
  { id: 'examcontent', title: '鍼灸国家試験の内容', icon: '📋', category: '記録・管理', view: 'examcontent', desc: '試験概要・出題基準・持ち物などを貼り付けて管理。', tags: ['試験情報'] },
  { id: 'examday', title: '試験当日チェックリスト', icon: '✅', category: '記録・管理', view: 'examday', desc: '持ち物・当日の流れを「前日までに／当日の朝／会場に着いたら」の時系列でチェックできる。既定項目は一般的な例で、自分の項目も追加できる（正式な持ち物は受験票・公式案内で確認）。', tags: ['当日', 'チェックリスト', 'タイムライン'] },
  { id: 'experiences', title: '体験談ノート', icon: '🗣️', category: '記録・管理', view: 'experiences', desc: '体験談や体調・生活の気づきを記録。端末内だけに保存（非公開）。「学習ログから合格体験記の下書きを作る」ボタンで、通算問題数・正答率・連続学習日数・模試ベストスコアから下書きを自動生成し、合格体験談として編集・保存できる（任意・遊び要素）。', tags: ['体験談', '合格体験記', '自動生成'] },
  { id: 'numbers', title: '数値の棚卸し・一括更新', icon: '🔢', category: '記録・管理', view: 'numbers', desc: '国民医療費・平均寿命・出生率など毎年変わる数値を、全科目まとめて更新。', tags: ['数値', '棚卸し'] },
  { id: 'unread', title: '読み取れないページ', icon: '📄', category: '記録・管理', view: 'unread', desc: '取り込みで読み取れなかったページ・問題を控えておく。あとで読み取れたら消せる。', tags: ['読み取れないリスト'] },
  { id: 'roadmap', title: '合格するためのロードマップ', icon: '🗺️', category: '記録・管理', view: 'roadmap', desc: '本番までの計画・やること/NG・新規→△✕の切替時期・音声学習の使い方まで。フェーズ別カードに加えて8月〜2月の月別スケジュール表示もあり。下部ナビの直上に常設バーがあり、ロードマップ画面以外のどこからでも開ける。「カレンダーで予定に落とし込む」でカレンダー画面へ。', tags: ['ロードマップ', '計画', '常設バー', '月別スケジュール'] },
  { id: 'scope', title: '試験範囲', icon: '🗂️', category: '記録・管理', view: 'scope', desc: '全14科目（午前/午後）と収録状況・合格ライン。', tags: ['試験範囲'] },

  // ---- 取り込み・作問支援 ----
  { id: 'import', title: '問題を取り込む（PDF・写真・文章・ファイル）', icon: '📥', category: '取り込み・作問支援', view: 'import', desc: 'PDFや本のページ写真、CSV/JSON、貼り付けた文章から問題を追加。', tags: ['取り込み'] },
  { id: 'ocr', title: '写真から取り込み', icon: '📷', category: '取り込み・作問支援', view: 'ocr', sub: true, desc: '問題集や参考書のページ写真から文字を読み取って取り込む（取り込み画面内）。', tags: ['OCR'] },
  { id: 'parse', title: '自由文から自動作成', icon: '📝', category: '取り込み・作問支援', view: 'parse', sub: true, desc: '貼り付けた自由文から問題を自動で作る（取り込み画面内）。', tags: ['自動作成'] },
  { id: 'notegen', title: '文章から問題を作る', icon: '✍️', category: '取り込み・作問支援', view: 'notegen', sub: true, desc: '教科書などの説明文から問題を生成する（取り込み画面内）。', tags: ['問題生成'] },
  { id: 'tools', title: '問題ツール（自動生成・誤りチェック）', icon: '🧪', category: '取り込み・作問支援', view: 'tools', desc: '経穴マスタから問題を自動生成。既存問題の形式・重複・矛盾・経穴×経絡の誤りを点検（runAllChecks）。', tags: ['自動生成', '誤りチェック'] },

  // ---- 設定・その他 ----
  { id: 'settings', title: '設定・問題データ管理', icon: '⚙️', category: '設定・その他', view: 'settings', desc: 'CSV / JSON のインポート、音声設定、データ管理。問題データとは別に、自分の解答履歴（学習ログ）だけをCSVで書き出す機能もあり、表計算ソフトでの独自分析に使える。', tags: ['設定', '学習ログ', 'CSV書き出し'] },
  { id: 'errorlog', title: 'エラーログ', icon: '🪵', category: '設定・その他', view: 'settings', sub: true, desc: '端末内エラーの閲覧・消去（外部送信なし、設定画面内）。', tags: ['エラーログ'] },
  { id: 'syncqr', title: 'QRで端末移行', icon: '📱', category: '設定・その他', view: 'settings', sub: true, desc: '進捗・設定をQR/URLで別端末へ受け渡し。大きい時は圧縮＋自動でQRを複数枚に分割して連続表示（テキストのコピー＆ペーストでも可）、履歴の要約による軽量化オプションあり（設定画面内）。', tags: ['QR', '機種変更', '移行'] },
  { id: 'sharebackup', title: 'バックアップの共有', icon: '📤', category: '設定・その他', view: 'settings', sub: true, desc: 'バックアップファイルをWeb Share API対応端末でAirDrop/LINE/Google Drive等の共有シートへ直接渡す（設定画面内）。', tags: ['共有', '機種変更'] },
  { id: 'clouddrive', title: 'Googleドライブ連携', icon: '☁️', category: '設定・その他', view: 'settings', sub: true, desc: '（任意・要OAuthクライアントID自己発行）Googleドライブのアプリ専用領域へバックアップを保存・復元。他機能と異なりGoogleのサーバーと通信する明示的な例外（設定画面内）。「自動同期」をONにすると、アプリを開くたび・進捗が変わるたびに裏で自動同期し、どの端末でも最新の進捗が反映される（差分マージにより片方の端末の進捗を失わない）。', tags: ['クラウド', 'Googleドライブ', '機種変更', '自動同期'] },
  { id: 'p2ptransfer', title: 'WebRTCで直接転送', icon: '📶', category: '設定・その他', view: 'settings', sub: true, desc: 'サーバーを経由せず端末間を直接つなぎ、容量制限なくバックアップを転送。接続の合図（オファー/アンサー）だけQR/テキストで手動交換（設定画面内）。TURN未使用のため一部ネットワークでは接続できないことがある。', tags: ['WebRTC', '機種変更', 'P2P'] },
  { id: 'migrationguide', title: '機種変更ガイド', icon: '🧭', category: '設定・その他', view: 'migrationguide', desc: 'QR・共有・Googleドライブ・WebRTC・バックアップファイルの全移行方法を1画面に集約し、今のデータ量から最適な方法を自動でおすすめ。ホーム・設定画面から導線あり。', tags: ['機種変更', '移行', 'ガイド'] },
];

export default featureRegistry;
