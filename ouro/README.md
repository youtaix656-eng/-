# Ouro — 自分専用のAI会社

> 「AIを使うのではなく、AIを雇う。」
> 「AIが働くほど、あなたの知識が資産になる。」

公開先：https://youtaix656-eng.github.io/-/ouro

Ouro はAIチャットアプリではありません。**あなたがオーナーの会社**です。
AI社員に仕事を依頼すると、社員どうしで引き継ぎながら仕事を進め、
その成果が**会社の知識資産**として積み上がっていきます。

```
情報 → 収集 → 整理 → 検証 → 保存 → 活用 → 新しい成果 → 再び知識へ
```

## いま出来ること（Phase 1 / MVP）

| | 機能 | どこ |
|---|---|---|
| 1 | ホーム（会社の司令室） | `components/Home.jsx` |
| 2 | AI社員 6役職 × 3席 = 18人 | `data/roles.js` / `data/employees.js` |
| 3 | 自然言語で仕事を依頼（担当は自動で決まる） | `Compose.jsx` / `lib/dispatcher.js` |
| 4 | 社員間のタスク受け渡し（ハンドオフ） | `lib/workflow.js` |
| 5 | 追加で聞く（AIチャット相当） | `TaskDetail.jsx` |
| 6 | 知識ベース（検索・タグ・カテゴリ） | `lib/knowledge.js` |
| 7 | Web / YouTube / PDF / メモの取り込み | `lib/ingest.js` |
| 8 | AI要約 → 知識化 | `lib/runtime.js` |
| 9 | 出典表示（AI生成と外部由来を区別） | `KnowledgeDetail.jsx` |
| 10 | AI社員を雇う（プリセット／オリジナル） | `Hire.jsx` |
| 11 | AI会議（意見 → 反論 → 統合） | `lib/meeting.js` |
| 12 | AI Router（重さと道具でモデル自動選択） | `lib/router.js` |
| 13 | 権限・承認・操作履歴 | `lib/permissions.js` / `lib/audit.js` |
| 14 | 案件・収益（稼ぐための層） | `lib/revenue.js` / `Deals.jsx` |
| 15 | 会社ダッシュボード・道具の接続 | `Company.jsx` / `Connect.jsx` |

設計の全体像（アーキテクチャ・DBスキーマ・API・拡張時の注意点）は
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## AIエンジンについて（お金をかけずに始める）

Ouro は**サーバーを持ちません**。月額費用はゼロです。

- **キーが1つも無くても全機能が動きます。** その場合は「ローカル社員」が
  仕事の型（チェックリスト）を組み立てます。AIではないことは画面に明記されます。
- 実際に社員に考えさせるには、設定でAPIキーを1つ登録します（BYOK）。
  無料枠のある Gemini から始めるのが最も費用がかかりません。
- キーは端末の IndexedDB にのみ保存され、**バックアップの書き出しにも含まれません**。
- 費用は仕事ごと・社員ごと・累計で常に表示されます（隠しません）。

## 設計上の約束（変えるときに壊さないための決まり）

1. **AI社員（人格・役割・記憶）とAIエンジン（Claude/GPT/Gemini）は分離する。**
   社員は `providerPref`（希望）だけを持ち、エンジンの実体を持たない。
   モデルが入れ替わっても社員データは無傷。
2. **出典のない知識を作らせない。** `createKnowledge()` は出典が空なら
   「AI生成（未検証）」の擬似ソースを自動で立てる。
3. **既定の権限は最小。** 送信・削除・支払い・外部公開は必ずユーザー承認を通る。
4. **接続数の上限をハードコードしない。** 判定は `plans.connectionLimit()` の1か所だけ。
5. **役職を足すときは `data/roles.js` に1件足すだけ。** 画面は直さない。
6. **保存キーは `storage.KEYS` に登録する。** 直接 `idbSet` を呼ばない。

これらはすべて `test/ouro.test.mjs` が機械チェックしている。

## 開発

```bash
npm install
npm run dev       # 開発サーバー
npm test          # node --test（62件）
npm run build     # 本番ビルド
npm run preview   # ビルド結果の確認
```

- React 18 + Vite（JSX・TypeScript なし・**外部ランタイム依存なし**）
- 保存は IndexedDB（localStorage フォールバック）。`lib/storage.js` は
  ネットワークに一切触れない。
