# 鍼灸国家試験 対策アプリ — 開発メモ

React + Vite（JSX・TypeScript なし・外部ランタイム依存なし）。データは IndexedDB
（`src/lib/storage.js`、localStorage フォールバック）。ブラウザのみで動作。
公開先：https://youtaix656-eng.github.io/-/

## デプロイ
- `.github/workflows/deploy.yml` は **main への push** でビルド＆GitHub Pages 公開。
- 作業は `claude/acupuncture-exam-app-7p4zdh` で行い、コミット後に
  `git push origin HEAD:main` で main を fast-forward してデプロイ（ユーザー了承済みの運用）。
- コンテナが作業ツリーを古いコミットへ戻すことがある。正は origin。
  `git fetch && git reset --hard origin/<branch>` で復旧してから作業する。
- 変更後は必ず最新URLを出す。読みやすい写真を使う。

## 継続して意識する開発方針（ユーザー指定・重要）
1. **全科目のコンテンツ拡充＋網羅管理** — 14科目（下記「科目一覧」参照）を拡充。
   「出題基準の項目 × 収録数」の網羅マップ（`CoverageMap.jsx`）で手薄な所を可視化し、
   抜け漏れなく作る。問題を足すたびに網羅状況を意識する。現状の手薄科目は
   関係法規(80)・医療概論(92)・衛生学公衆衛生学(92)・解剖学(117)・臨床医学各論(123)・
   生理学(127)（2026年8月時点、随時変わる）。
2. **正確性・鮮度の管理** — 医療内容は正確に。毎年変わる数字（国民医療費・統計等）は
   更新前提。曖昧・要更新は「※要確認」を付け、数値問題を抽出した年1回の見直しを想定。
3. **本番同形式の模試** — ✅実装済み（`src/components/Exam.jsx`）。午前90問／午後90問
   （科目別配分は`src/data/examBlueprint.js`）・得意な問題／苦手な問題（正答率から
   ジャンル・キーワードを自動提案）・選択式（科目/ジャンル/キーワード検索）の5モード。
   総合問題（連問）は`src/data/integratedQuestions.js`に過去問が届き次第追加。
4. **復習（SRS）の前面化** — ✅実装済み。ホーム画面に「今日の復習」カード
   （`dueReviewQuestions`、`src/lib/srs.js`）。間違い→復習→定着のループは
   `missTypes.js`（誤答理由：勘違い/知識不足/ケアレス）、`forgetting.js`（忘却予測）、
   `weakClusters.js`（弱点クラスタ）でも多角的に支援済み（下記「機能一覧」参照）。
5. **画像問題への対応** — ✅基盤は実装済み。`question.image`（外部URL）と
   `question.figure`（`src/data/figures.jsx`のオフラインSVG図、キーで参照）の2方式。
   図問題データは`src/data/zumondaiQuestions.js`（現状サンプルのみ、361穴同様に拡充余地あり）。

## コンテンツ投入の型（過去問→教材化）
過去問1問ごとに「原問(4択)×1＋一問一答×4（角度A核心/B定義・逆引き/C鑑別/D○×）」を
**被りなく・網羅的**に生成し、音声学習・マインドマップ・一問一答へ組み込む。
各問に tags（正式名称の重要語）、まぎらわしい対比は `COMPARISONS`、数値は `NUMBER_FACTS`
（`src/data/mindmapData.js`）へ。過去問は著作物のため公開リポジトリに素の問題文を
大量常設しない方針（派生・自作解説で保持。医療概論の同梱は個人利用の範囲）。
語呂合わせサイト等、外部の教材サイトを参考資料として渡された場合も同じ方針：
経穴名・順序・寸法などの**事実**は正確に引用してよいが、語呂合わせの**文章そのもの**
（著作権のある創作表現）はコピーしない。事実は保ったまま独自の語呂合わせ文を作る。

### 標準変換プロンプト（ユーザー指定・これを既定手順とする）
ユーザーが科目名＋過去問PDFを貼ったら、明示がなくても毎回この手順で教材化する:
1. **出題基準を先に読む** — PDFの1ページ目は国家試験の出題基準。記憶し、そこから科目名と
   ジャンル分け（大項目｜中項目 → `genre`）を導出する。
2. **ページ順の整列** — 各ページ下部の印刷ページ番号で並べ替えてから読み込む。
3. **生成物（過去問1問ごと）** — 原問(4択そのまま)×1＋一問一答×4を被りなく網羅生成:
   - 原問: 選択肢・正解は忠実に。解説は要点を"自分の言葉"で（出版社の文そのままにしない）。
   - 一問一答の角度: **A核心**（原問の事実を端的な四択）/ **B定義・逆引き**（正解語の意味・役割：語→説明 or 説明→語）/
     **C鑑別**（誤答選択肢の1つの"正しい内容"を問う四択＝ひっかけ対策）/ **D確認**（○×正誤×おまかせ：数字・年齢区分・年号があれば数値を問う）。
   - 4問の答えと論点は互いに異なること（言い換えの重複禁止）。4問で網羅しきれなければ例外的に増やす。
4. **図・表からも一問一答** を生成（網羅できるよう問題数はお任せ）。
5. **キーワード** — 各問に tags（重要語2〜4個）、表記は正式名称に統一（例「ケアマネ」→「介護支援専門員」）。
6. **マインドマップ** — 該当あれば comparisons（まぎらわしい対比）・numbers（数値の要点）を追加。
7. **厳守（誤り・被り防止）** — 医療的に正確に／曖昧は「※要確認」／原問の各選択肢(正・誤)と解説の要点を4問のどこかで必ずカバー／
   既出（同じ答え＋同じ論点）とは重複させない（既出は「重複」と記し作らない）／四択は選択肢4・正解1、○×は2択。
8. **反映先** — 音声学習・キーワード検索・目次・マインドマップすべてに追加（`subject`/`genre`/`tags`/`deck` で自動連携）。
   科目ごとに `src/data/<科目>Questions.js`＋`<X>_VERSION` を作り、`useStore.js` で `dedupeAgainst` 増分シード。
9. **読み取れないリスト（※1）** — 読み取れないページと該当問題を「1.日付 時間 2.科目名/タイトル 3.ページ下の印刷ページ数(P10等)」で控える。
   後で読み取れたらリストから削除し、**削除した旨を必ずユーザーへ連絡**する。
10. 完了後は最新URLを出し、下記「問題作成後の必須チェック」の結果を報告する。

### 問題作成後の必須チェック（毎回）
問題を作成・追加したら、取り込み/反映の前に必ず正誤チェックを行い、結果を報告する。
1. **答えの妥当性** — 正解番号が選択肢の範囲内・意図した選択肢を指すか（0/1始まりの取り違え注意）。
2. **医療的正確性** — 内容が正しいか。毎年変わる数字は最新か。曖昧は「※要確認」を付す。
3. **重複（被り）** — 問題文・答え・論点が既存や他の生成分と重複しないか（`dedupeAgainst` ＋
   答え＋論点の一致も確認）。同一問題文の別問は末尾に（第XX回）。
4. **形式** — 四択は選択肢4・正解1、○×は2択。解説あり。
アプリ内の誤りチェック機能（`src/components/QuestionTools.jsx` の `runAllChecks`）も活用する。

## データモデル / 実装メモ
- 問題: `{ id, subject, type:'choice'|'ox', question, choices[], answer(0始まり), explanation,
  round?, tags?, deck?, genre?, source?, image?, figure? }`。
- 検索の役割分担（音声学習）: **科目名=subject / ジャンル=q.genre（13/14科目で実利用中。
  医療概論=iryouQuestions.jsのみ未使用） / キーワード=tags∪連結キーワード**。
- 「回」フィールド（`round`）は科目データファイルによって`round: 34`（数値）と
  `round: "第34回"`（フル文字列）が混在する。比較・並び替え・表示は必ず
  `src/lib/round.js`の`roundKey`/`formatRound`/`isSameRound`を経由すること（直接
  `String(q.round)`比較や`第{r}回`のようなテンプレート結合をすると、フル文字列側で
  「第第34回回」のように二重表記される）。新しい画面で「回」の絞り込み・表示を追加する時も
  同様にこのヘルパーを使う。
- `source`：「4択問題」のファイル分け用（`ChoiceQuiz.jsx`）。未設定は既定で「過去問」扱い
  （`questionSourceId()`、`src/data/examScope.js`）。模試・その他を追加する時だけ明示指定。
- 科目一覧・正式表記は `src/data/examScope.js`（`SUBJECT_TAG_NAMES` / `EXAM_SUBJECTS` /
  `CHOICE_QUIZ_SUBJECTS`）を単一の正とする。14科目：医療概論・衛生学公衆衛生学・関係法規・
  解剖学・生理学・病理学概論・臨床医学総論・臨床医学各論・リハビリテーション医学・
  東洋医学概論・経絡経穴概論・東洋医学臨床論・はり理論・きゅう理論。
- 各科目の同梱データは `src/data/<科目>Questions.js`＋`<X>_VERSION`（バッチ増分方式）。
  `useStore.js`で`dedupeAgainst`により起動時に未収録分だけ取り込む。
- 音声学習（`src/components/AudioMode.jsx`）: 検索フィルタ＋連結学習モード1〜10
  （連鎖/比較/数値/穴埋め/弱点/選択肢読み/章通し/ナレーション/適応/今日の連結、よく使う順に自動並べ替え）。
  「今日のおすすめ」バナー（復習が溜まっていたら復習読み上げを提案）、セッション内の弱点分析
  （△✕をつけた問題からジャンル・キーワードを集計し読み上げ）、問題数ベースの「今日の目標」
  （タイマーの代わり）、自己採点にブックマークを追加、読み方の手動補正辞書（TTS誤読の修正、
  `settings.pronunciationFixes`）も実装済み。
- **「復習」の定義は `src/lib/reviewPool.js` を単一の正とする**（Session.jsx・AudioMode.jsx が共用。
  画面ごとに定義がズレて再発しないための集約）。
  - `isInReview`/`isDue`（`src/lib/srs.js`）：問題1問の復習対象・期限判定の基礎。
  - `dueReviewQuestions`（`useStore.js`）：ホーム「今日の復習」・`Review.jsx`が使う、期限が来た
    問題だけの単純なリスト（`isInReview`＋`isDue`のみ、忘却リスクは混ぜない）。
  - `reviewPoolFor(pool, srs)`（`reviewPool.js`）：Session.jsxの「すべて復習」・AudioModeの
    「間違えた問題を読み上げる」が使う、より広い定義。期限が来た問題を優先しつつ、一度も
    間違えていないが保持率が下がってきた問題（忘却リスク、しきい値`FORGETTING_THRESHOLD=0.4`）を
    「念のため確認」として少数混ぜる。
  - `buildWeaknessSummary`/`weaknessSummaryToText`：誤答・あいまい（△✕）問題からジャンル・
    キーワードの傾向を文章化（Session.jsxの完了画面／AudioModeのセッション内弱点分析で共用）。
  - `recommendNewPct`：新規問題と復習の比率を復習の溜まり具合から自動提案（Session.jsxの
    「今日のおすすめ」）。
  - 新しい画面で「復習」を扱う時は、この4関数を再実装せず`reviewPool.js`からimportすること。
- **Review.jsx（間違えた問題）の主な仕組み**（2026-08-19拡張）：
  - 出題対象は`reviewPoolFor(questions, srs)`（マスター後の「念のため確認」込み）。
    純粋な`isInReview`だけの`reviewQuestions`は件数表示など厳密な集計にのみ使う。
  - 絞り込み：科目（複数選択・`SUBJECT_TAG_NAMES`順）／キーワード（プルダウン）／回／
    ブックマーク／直近の誤答（今日・今週）／忘却リスク・誤答回数の下限。すべて
    `src/lib/reviewOrder.js`の`filterReview`が単一の実装（他画面から使う時もここを拡張する）。
  - リーチ（要注意）：`src/lib/srs.js`の`LEECH_THRESHOLD`（既定8）・`isLeech(state)`が単一の正。
    Review.jsxの一覧バッジと`MistakeNote.jsx`の自動並べ替え（要注意を先頭にピン留め）で共用。
  - 個別操作：`useStore.js`の`setNextDue(id, delayMs)`（スヌーズ・誤答理由別の間隔調整で共用）、
    `removeFromReview(id)`（○5回連続と同じ状態にして手動で外す）。
  - 出題順は`spaceByOrigin`で原問と派生（同じ過去問由来）を離す（Session.jsxの`spaceById`と同じ考え方、
    実装はReview.jsx内に独立）。
  - 誤答理由（型）別の再出題間隔は`src/lib/missTypes.js`の`MISS_TYPE_DELAY_MS`が単一の正。
  - 音声で復習（`onGoAudio`）は、Review画面で絞り込み中ならその条件のidだけをAudioModeへ渡す
    （`App.jsx`の`audioReview`が`true`（全体）または`{ids}`（絞り込み結果）を保持し、
    `AudioMode.jsx`の`customReviewIds`で反映）。
- **習慣化の仕組み**（「始めるまでに迷う」「戻るルールがない」対策、2026-08-19追加）：
  - `src/lib/nextTask.js`（明日の最初の1タスク）：Session.jsxの完了画面で次にやることを1つだけ
    決めて保存すると、Home.jsxの一番上に固定表示される。「何から始めるか」で迷う時間をなくす。
  - `src/lib/streakBreak.js`（できなかった日の原因分解）：`detectBrokenYesterday(history)`で
    「きのうだけ記録が無く前日には記録がある＝直前で連続が途切れた」状態を検知し、Home.jsxで
    理由（時間がなかった／やる気が出なかった等）をワンタップ記録できるカードを出す。責めるのが
    目的ではなく、記録して「また今日から戻る」ための一手間。同じ日に何度も出さないよう
    記録済み／「あとで」でdismissした日はidbで管理。
- **下部ナビ・合格ロードマップ**（2026-08-19変更）：下部ナビは6画面
  `ホーム／カレンダー／一問一答／復習／音声／模試`（`src/App.jsx`の`NAV`配列）。カレンダーは
  頻繁に使う下部ナビ相当のため即時import（lazyに戻さない）。加えて、下部ナビのすぐ上に
  常設の「🗺️ 合格ロードマップ」バー（`.roadmap-bar`、ロードマップ画面自体では非表示）があり、
  どの画面からでもロードマップを開ける。音声ミニプレーヤーはこのバーが出ている時だけ1段
  上（`.mini-player.lifted`）にずれて重ならないようにする。
  - **ロードマップのフェーズ定義は `src/data/roadmapPhases.js`（`ROADMAP_PHASES`）を単一の正とする**。
    以前はCalendar.jsx（日付範囲・色のみ）とRoadmap.jsx（やること/NG等の詳細）で別々に
    フェーズを持っていてズレる恐れがあったため統合した。**ロードマップの内容を追加・修正する時は
    必ずこのファイルだけを直す**（Roadmap.jsxに直接書き足さない）。Calendar.jsxとRoadmap.jsxは
    互いに「全期間のロードマップを見る」「カレンダーで予定に落とし込む」の相互リンクを持つ。
    Calendar.jsxはこの凡例を画面最上部（説明文の直下）に表示し、日付セルの背景色でフェーズを
    色分け（`hexToRgba`で半透明化）。Roadmap.jsxは`ROADMAP_MONTHS`＋`phasesInMonth`で
    フェーズ別カードとは別に「月別スケジュール（8月〜2月）」も自動生成する（月ごとにフェーズを
    書き直すのではなく、`ROADMAP_PHASES`の日付から導出するので二重管理にならない）。
- **長押しで削除**（`Home.jsx`の`useLongPress`）：「前回の続きから」カードなど、誤タップで
  失いたくない操作は、タップ＝通常動作／長押し（550ms）＝「削除しますか？ はい・いいえ」の
  確認を出す。同じパターンが必要な時はこのフックを再利用する。
- 端末だけに取り込むリンク: `#import=`（`src/lib/noteshare.js`）。重複は
  `dedupeAgainst`（問題文で判定、`src/lib/importer.js`）。同一問題文の別問は
  末尾に（第XX回）を付けて衝突回避。

## 機能一覧（早見表・2026年8月更新）— 新機能を提案・追加する前に必ずここを見る
「〇〇が無い」と判断する前に、下記と `components/`・`lib/` 全体を検索すること
（過去に誤って「未実装」と案内した失敗があるため）。
| 分野 | どこにあるか | 中身 |
|---|---|---|
| 模擬試験 | `Exam.jsx` | 午前/午後(本番同形式)・得意/苦手(自動提案)・選択式の5モード |
| 4択問題 | `ChoiceQuiz.jsx` | ファイル分け(過去問/模試/その他)→科目の2段階 |
| SRS復習 | `srs.js`／Home「今日の復習」／`Review.jsx` | 間隔反復。ホームに期限件数を前面化 |
| 忘却予測 | `lib/forgetting.js`（Analytics内`InsightsSection.jsx`） | 保持率を指数減衰で推定し先読み表示 |
| 弱点クラスタ | `lib/weakClusters.js`（同上） | タグ共起から弱点テーマを自動抽出 |
| 難易度推定 | `lib/difficulty.js`（同上） | 正答率から難問を抽出 |
| 誤答理由の分類 | `lib/missTypes.js`／`Review.jsx` | 勘違い/知識不足/ケアレスをワンタップ記録、型別に解説を出し分け |
| 自己説明ステップ | `QuestionCard.jsx`の`whyPrompt` | 誤答時に「なぜこの答え？」を自動で促す |
| 知識グラフ・連想 | `KnowledgeGraph.jsx`＋`AssocQuiz.jsx`／`AssocTrainer.jsx`／`RelationAuthor.jsx` | 経路クイズ・束グルーピング・対比識別ドリル・関係の手動オーサリング |
| 連結学習 | `ConnectedLearning.jsx`＋`lib/connectlab.js` | 今日の1問・キーワード自動提案・表記ゆれ統合・ヒートマップ |
| 語呂合わせ | `kwMeta`（保存）／`MnemonicNotebook.jsx`（一覧・編集） | 登録・一覧・関連問題数表示・**科目でしぼる検索**（`examScope.js`の科目順に1〜14で番号付き）・**ふりがな表示**（`reading`、手入力または`lib/yomi.js`の`TERM_READINGS`のみ。自動生成はしない＝誤読防止）。組み込みの語呂合わせは`src/data/defaultMnemonics.js`＋`DEFAULT_MNEMONICS_VERSION`（他の科目データと同じバッチ増分方式、`useStore.js`で初回のみ`kwMeta`へ追加。削除しても再追加されない） |
| フラッシュカード | `Flashcards.jsx` | 経穴カード＋全科目対応（問題から自動生成） |
| 画像・図問題 | `figures.jsx`（オフラインSVG）／`question.image` | `zumondaiQuestions.js`にサンプルあり |
| 網羅マップ | `CoverageMap.jsx` | 出題基準×収録数の可視化 |
| エラーログ | `lib/errorLog.js`／`ErrorLogCard.jsx`（Settings内） | 端末内エラーの閲覧・消去 |
| 3分の2バッファ術 | `lib/bufferSession.js`／`Session.jsx`／`Calendar.jsx` | 学習時間を基礎タスク:バッファ=2:1（設定で調整可）に自動分割。完了後はマネージャービュー（振り返り）でバッファ用途を自動判定、ハリオが声かけ。詳細は下記セクション |
| 鍼灸過去問題の傾向と対策 | `lib/pastExamTrends.js`／`PastExamTrends.jsx`（Home内） | 収録済み過去問（round付き＝原問のみ）を実際に集計し、複数回にまたがる頻出ジャンル・頻出キーワードをデータドリブンに可視化。科目別の対策優先度、学習法・音声学習での活かし方、やるべきこと／やってはいけないことも提示。頻出テーマ・キーワードから一問一答へワンタップで絞り込める |
| 機種変更・端末移行（2026-08-19拡張） | `MigrationGuide.jsx`（Home/Settings内導線）／`Settings.jsx`内 `SyncQR.jsx`・`SyncScan.jsx`・`FileBackupCard.jsx`・`CloudBackup.jsx`・`P2PTransfer.jsx` | QR受け渡し（`lib/transferCodec.js`で圧縮＋`lib/chunk.js`で自動分割・アニメーション連続表示、テキストのコピー＆ペーストでも可、`lib/sync.js`の`summarizeHistoryForTransfer`で古い履歴を要約し軽量化）／バックアップファイルの保存・復元・共有（Web Share API、非対応端末はダウンロードにフォールバック）／Googleドライブ連携（`lib/googleDrive.js`、任意・要OAuthクライアントID自己発行、appDataFolderのみ・プライバシー方針の明示的な例外）／WebRTC直接転送（`lib/webrtcTransfer.js`、公開STUNのみ・TURN無し、シグナリングはQR/テキストで手動交換）。`MigrationGuide.jsx`は`lib/migrationAdvice.js`の`recommendMigrationMethod`で現在のデータ量から最適な方法を自動提案 |
| クラウド自動同期（2026-08-19追加） | `CloudBackup.jsx`の「自動同期」トグル／`useStore.js`（同期エフェクト）／`lib/progressMerge.js`／`lib/googleDrive.js` | Googleドライブ連携で`settings.googleDriveAutoSync`をONにすると、アプリを開いた時・進捗（srs/history/memos/links/examResults）が変わった数秒後に、サイレント認証（同意画面を出さない`requestAccessToken(clientId, {silent:true})`）でappDataFolderの軽量ペイロード（`googleDrive.SYNC_FILENAME`、問題データは含まない）を確認・アップロードする。単純な新しい方で上書きだと片方の端末の進捗が消えるため、`lib/progressMerge.js`の`mergeProgress`で種類ごとにマージ（srsは問題ID単位でlastAnswered/dueが新しい方、historyはUNION+重複除去、examResultsはid単位UNION、memos/links/settingsはキー単位UNION＋競合時は全体updatedAtが新しい側を優先）。`storage.js`の`syncMeta`（`updatedAt`）がマージ判定の基準時刻。サイレント認証・通信失敗は静かに諦める（初回だけ手動の「保存」または「復元」でGoogleログインの同意を済ませる必要がある）。他端末の進捗を取り込んだ時は`cloudAutoSyncToast`でトースト通知（画面遷移はしない）。手動の全体バックアップ（`BACKUP_FILENAME`）とは別ファイルなので競合しない |
| 全機能一覧 | `src/data/featureRegistry.js`＋`FeatureIndex.jsx` | 上表と同じ内容の単一の正。検索・カテゴリ絞り込み付き |

上表は概要用のスナップショット。**正確な最新の全機能リストは `src/data/featureRegistry.js`**
（`{id,title,icon,category,view,desc,tags}`の配列）。**新機能を追加・削除・改名したら、
このファイルにも必ずエントリを追加/更新する**（`npm run validate` が `view` の実在を
機械チェックする。CLAUDE.mdのこの表は概要のみで自動生成ではないため、大きく変わったら
このセクションも合わせて更新する）。

## 3分の2バッファ術（2026-08-19 追加）
河野ゆかり著『「仕組み化」勉強法』の考え方（「やる気があるから勉強する」のではなく
「勉強が始まる形になっているから、やる気があとからついてくる」）を取り込んだ学習計画機能。
- **ロジックは `src/lib/bufferSession.js` を単一の正とする**。学習予定時間（分）を
  基礎タスク:バッファ=2:1（`DEFAULT_BASE_RATIO`）で自動分割する（`planStudySession`）。
  比率はハードコーディングせず、Settings画面（`settings.bufferBaseRatioPct`、40〜80%で調整可）
  から変更できる。基礎タスクの問題数は過去の解答間隔（`history`のタイムスタンプ差の中央値、
  休憩とみなす間隔は除外）から逆算し（`averageAnswerSeconds`）、履歴が少ない初回はジャンル別
  デフォルト解答時間（`DEFAULT_ANSWER_SECONDS`）にフォールバックする（`estimatedAnswerSeconds`）。
- **シフト連動・体調連携は未実装（将来拡張用の関数のみ用意）**：`baseRatioFor`は
  `shiftContext`（'work_day'|'off_day'）や`conditionScore`（0-100）を渡せる設計だが、
  実際に呼ぶ`Session.jsx`/`Calendar.jsx`はどちらも未指定のまま呼んでおり、常に標準比率
  （Settings値、既定2:1）で動作する。将来、勤務シフト・睡眠アプリ連携を追加する時は
  `planStudySession`の呼び出し側に`shiftContext`/`conditionScore`を渡すだけで良い設計。
- **Session.jsx への統合**：学習画面の開始前に「⏱ 時間で計画する」カードがあり、
  分数を選ぶと基礎タスク／バッファの問題数・時間が即座に計算される。「この計画で基礎タスクを
  始める」を押すと通常の学習セッションと同じ仕組みで開始し、`session.buffer`にプラン
  （`StudySession`相当のオブジェクト）を保持する（既存の`session`データ構造に追加フィールドとして
  同居させているだけで、一問一答・原問・音声学習・マインドマップのデータ構造とは衝突しない）。
  出題画面では基礎タスクであることを「🧩 基礎タスク・」とラベル表示し、残り5問以下になると
  ハリオが「あと◯問だけ頑張ろう」とリマインドする（`harioBaseTaskReminder`、`data/haripan.js`）。
- **マネージャービュー（振り返り）**：基礎タスクの問題を解き終えると、通常の完了画面より先に
  `ManagerReview`（Session.jsx内のローカルコンポーネント）が表示され、「予定通り完了したか」を
  Yes/Noで記録する（Noの場合は自由記述の理由メモを任意で追加）。**文言は一貫して
  「悪いのは実行役ではなく、無理な計画を立てたマネージャー」という前提**（自己否定を招く表現は
  使わない）。判定結果は`resolveBufferUsage(completed)`が`'review'`（ご褒美復習）／
  `'catchup'`（積み残し消化）を返し、通常の完了画面に「🧩 バッファ枠」カードとして表示。
  ハリオの声かけは`harioBufferEncourage(usage)`（同じく`data/haripan.js`）。カードのボタンから
  バッファ用途に応じたセッション（ご褒美復習＝`reviewPoolFor`で復習対象のみ／積み残し消化＝
  元の科目プールの続き）をそのまま開始できる。
- **カレンダー連携**：`Calendar.jsx`の日付詳細に「🧩 今日の学習ブロック（目安）」カードがあり、
  選択中の日が属する合格ロードマップのフェーズ（`phaseForDate`、`focus`/`mix`）と、
  60分プラン時の基礎タスク／バッファ目安（`planStudySession`）を並べて表示する
  （実際の時間入力・開始は学習画面で行う設計。カレンダー側はあくまで目安の提示のみ）。
- ハマりやすい点：Session.jsxの出題画面は完了画面・開始画面などの早期`return`が複数ある
  コンポーネント本体に直接書かれているため、**このセクション以降に新しいフックを増やす時は
  必ずコンポーネント本体の先頭（他の`useMemo`/`useState`と同じ場所）に置くこと**。
  条件分岐の後ろにフックを置くと「Rendered fewer hooks than expected」で本番ビルドが
  クラッシュする（このセクションの実装中に一度混入し、Playwrightのconsoleエラー監視で発見・修正した）。

## パフォーマンス方針（2026-08-17 追加）
- **コード分割**：`App.jsx`はホーム/カレンダー/一問一答/復習/音声/模試（下部ナビの6画面）と常時マウントの
  コンポーネント（`MiniPlayer`/`AuthGate`/`Pomodoro`/`HistoryPanel`）だけ即時import。
  それ以外の画面は`lazy(() => import(...))`＋`<Suspense>`。**新しい画面を追加する時も
  基本はlazy importにする**（頻繁に使う下部ナビ相当のみ例外）。
- **科目データの動的import**：`useStore.js`の`subjectDataModules()`が全科目データを
  `Promise.all([import(...)])`でまとめて動的読み込みする。**新しい科目データファイルを
  追加したら、ここにもimportを追加する**（トップレベルの`import X from '../data/...'`に
  戻さない。バンドルが再び1つの巨大ファイルに戻ってしまう）。
- **長いリストは無条件に全件描画しない**：`MindMap.jsx`の「中心にする言葉」（数千語になり得る）は
  検索フィルタ＋先頭80件キャップ方式（`CENTER_CHIP_CAP`）。新しく数百件以上になり得る
  一覧を作る時は、同じパターン（検索欄＋件数キャップ、または開閉アコーディオン）を使う。
  外部の仮想化ライブラリは導入しない方針（外部ランタイム依存なしのため）。

## ミス防止ルール（2026-08-17 追加・失敗の再発防止）
- **新機能を「無い」と判断する前に必ず調査する** — 上の機能一覧に加え、
  `grep -rln "<関連語>" src/components/*.jsx src/lib/*.js` で横断検索してから回答・実装する。
  似た名前の既存コンポーネント（Assoc*・Insights*・Connected*等）を見落としやすい。
- **自信がない・未確認の情報は断定しない** — 「実装済みかどうか未確認です」と明言してから、
  確認後に訂正する。
- **10個・全部のような大きな依頼は、まず一覧化→ユーザー確認→実装の順で進める**
  （すでに存在するものを重複実装しない）。
- 大きな変更ほど、実装後にブラウザ（Playwright＋Chromium）で実際に操作して確認する。
  ビルドが通ることと機能することは別。
- **過去問PDFの内容は、既存収録との突き合わせ作業中であっても記憶で再現しない** —
  同じ会話内で既にPDFを読んでいても、問題文・選択肢・問題番号を記憶から書き出すと
  番号のズレや「実際は収録済みなのに未収録と誤判定する」類の間違いが起きる
  （2026-08-19、第34回過去問の収録漏れ調査中に自己発見・修正）。既存収録と照合する時は
  ページ内容を再度読み直すか、直前のツール出力を直接参照し、記憶のみで一覧化しない。
- 同じ種類の間違いが起きたら、このセクションに追記して残す。

## 検証
- `npm run build` と `node --test`（現状240件）を通す。
- 可能なら Chromium（`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`）で
  プレビュー描画を確認（`npm run preview` → Playwrightでスクリーンショット）。
