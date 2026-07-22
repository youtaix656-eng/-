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
1. **全科目のコンテンツ拡充＋網羅管理** — 医療概論92問＋サンプル中心の現状から、
   残り12科目を拡充。「出題基準の項目 × 収録数」の網羅マップで手薄な所を可視化し、
   抜け漏れなく作る。問題を足すたびに網羅状況を意識する。
2. **正確性・鮮度の管理** — 医療内容は正確に。毎年変わる数字（国民医療費・統計等）は
   更新前提。曖昧・要更新は「※要確認」を付け、数値問題を抽出した年1回の見直しを想定。
3. **本番同形式の模試** — 時間制限・科目配分・合格ライン判定（例年6割）付きの通し模試を
   強化（`src/components/Exam.jsx`）。
4. **復習（SRS）の前面化** — 「今日復習すべき問題」をホーム/カレンダーに出す導線
   （`src/lib/srs.js`）。間違い→復習→定着のループを回す。
5. **画像問題への対応** — 経穴図・解剖図など図が要る問題は音声だけでは不足。
   図つき問題の扱い（画像添付／「図を見る」誘導）を用意する。

## コンテンツ投入の型（過去問→教材化）
過去問1問ごとに「原問(4択)×1＋一問一答×4（角度A核心/B定義・逆引き/C鑑別/D○×）」を
**被りなく・網羅的**に生成し、音声学習・マインドマップ・一問一答へ組み込む。
各問に tags（正式名称の重要語）、まぎらわしい対比は `COMPARISONS`、数値は `NUMBER_FACTS`
（`src/data/mindmapData.js`）へ。過去問は著作物のため公開リポジトリに素の問題文を
大量常設しない方針（派生・自作解説で保持。医療概論の同梱は個人利用の範囲）。

### 問題作成後の必須チェック（毎回）
問題を作成・追加したら、取り込み/反映の前に必ず正誤チェックを行い、結果を報告する。
1. **答えの妥当性** — 正解番号が選択肢の範囲内・意図した選択肢を指すか（0/1始まりの取り違え注意）。
2. **医療的正確性** — 内容が正しいか。毎年変わる数字は最新か。曖昧は「※要確認」を付す。
3. **重複（被り）** — 問題文・答え・論点が既存や他の生成分と重複しないか（`dedupeAgainst` ＋
   答え＋論点の一致も確認）。同一問題文の別問は末尾に（第XX回）。
4. **形式** — 四択は選択肢4・正解1、○×は2択。解説あり。
アプリ内の誤りチェック機能（`src/components/QuestionTools.jsx` の `runAllChecks`）も活用する。

## データモデル / 実装メモ
- 問題: `{ id, subject, type:'choice'|'ox', question, choices[], answer(0始まり), explanation, round?, tags?, deck? }`。
- 検索の役割分担（音声学習）: **科目名=subject / ジャンル=q.genre（現状ほぼ未使用・枠は残す） /
  キーワード=tags∪連結キーワード**。
- 同梱データ `src/data/iryouQuestions.js`（医療概論92問）。起動時に一度だけバンクへ
  取り込む（`cfg.iryouSeeded`）。移行フラグ: `iryouSeeded / subjectTagsCleaned / genreFolded`。
- 音声学習（`src/components/AudioMode.jsx`）: 検索フィルタ＋連結学習モード1〜10
  （連鎖/比較/数値/穴埋め/弱点/選択肢読み/章通し/ナレーション/適応/今日の連結）。
- 端末だけに取り込むリンク: `#import=`（`src/lib/noteshare.js`）。重複は
  `dedupeAgainst`（問題文で判定、`src/lib/importer.js`）。同一問題文の別問は
  末尾に（第XX回）を付けて衝突回避。

## 検証
- `npm run build` と `node --test`（現状100件）を通す。
- 可能なら Chromium（`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`）で
  プレビュー描画を確認。
