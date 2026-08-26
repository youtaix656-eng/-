# Ouro 設計書 — 自分専用のAI会社

> 「AIを使うのではなく、AIを雇う。」
> 「AIが働くほど、あなたの知識が資産になる。」

この文書は仕様書の「Claudeへの開発指示」で求められた 15 項目に答えるもの。
実装（Phase 1）は本書の設計に従っている。

---

## 1. Ouro 全体アーキテクチャ

```
             ユーザー（オーナー・最終意思決定者）
                        │  依頼／承認
                        ▼
┌──────────────────────────────────────────────┐
│ Layer 2 : AI Company                                       │
│   Company → Department → Role → Seat → AIEmployee          │
│   Task / Workflow / Meeting / Approval / AuditLog          │
└───────────────┬──────────────────────┬─────────────────────┘
                │ 読み書き（権限つき）      │ 実行を委譲
                ▼                      ▼
┌────────────────────────┐  ┌──────────────────────────────┐
│ Layer 1 : Knowledge OS │  │ Layer 3 : Connect            │
│  Knowledge / Source    │  │  AIProvider（思考エンジン）      │
│  Tag / Category / 出典 │  │  Tool（道具：Web・YouTube等）  │
│  信頼性 / 使用履歴      │  │  Plan（接続数の上限）           │
└────────────────────────┘  └──────────────────────────────┘
```

**分離の原則（最重要）**

- `AIEmployee`（人格・役割・能力・記憶）と `AIProvider`（Claude / GPT / Gemini
  という思考エンジン）は完全に別テーブル。社員は `providerPref` で「どのエンジンを
  使いたいか」を持つだけで、実体は持たない。将来モデルが入れ替わっても社員は残る。
- `Tool`（道具）も社員から分離。社員は `toolIds` で「使ってよい道具」を持つ。
- `Knowledge` はどの社員にも属さない会社の資産。社員は `knowledgeScopes` で
  読める範囲を持つ（全知識への無制限アクセスはしない）。

**知識の循環（Ouroboros）**

```
情報 → 収集(Researcher) → 整理(Analyzer) → 検証(Reviewer)
    → 保存(Knowledge) → 活用(Strategist/Creator) → 新しい成果 → 再び知識へ
```

`Task` が完了するたびに成果物が `Knowledge` になり、次の `Task` の入力になる。
これをコードで担保しているのが `lib/cycle.js`（成果 → 知識 → 再利用の記録）。

---

## 2. MVP（Version 1）の機能一覧

| # | 機能 | 実装 |
|---|---|---|
| 1 | ホーム（会社の司令室） | `components/Home.jsx` |
| 2 | AI社員（6役職 × 3席 = 18人） | `data/roles.js` / `data/employees.js` |
| 3 | AI社員への仕事依頼（自然言語） | `components/Compose.jsx` / `lib/dispatcher.js` |
| 4 | AIチャット（社員と対話） | `components/TaskDetail.jsx`（追撃質問） |
| 5 | 知識ベース | `lib/knowledge.js` / `components/Knowledge.jsx` |
| 6 | Web情報の追加 | `lib/ingest.js`（URL＋本文／Web検索ツール） |
| 7 | YouTube情報の追加 | `lib/ingest.js`（URL＋文字起こし貼り付け） |
| 8 | PDF追加 | `lib/ingest.js`（base64 document ブロック） |
| 9 | AI要約 | `lib/runtime.js`（要約 → Knowledge 化） |
| 10 | タグ・カテゴリ | `lib/knowledge.js` |
| 11 | 検索 | `lib/knowledge.js` `searchKnowledge()` |
| 12 | 社員間のタスク受け渡し | `lib/workflow.js`（ハンドオフ） |
| 13 | 成果物保存 | `lib/runtime.js` → `Knowledge` |
| 14 | 出典表示 | `KnowledgeSource` ＋ `origin:'ai'|'external'|'user'` |
| 15 | 収益（案件）管理 ※追加 | `lib/revenue.js` / `components/Deals.jsx` |

※15 は仕様書には無いが「稼ぎたい」という要件のために追加した層。
AI社員の成果物を「案件」に紐づけ、売上・見込み・時給換算を可視化する。

---

## 3. 画面遷移図

```
[起動]
  └─ Splash（ウロボロスの印章）
       └─ Home（司令室）
            ├─ Compose（依頼する）──▶ TaskDetail（進行・成果・追撃質問）
            │                              └─▶ Knowledge 保存 / Deal へ紐付け
            ├─ Employees（社員一覧・マインドマップ）
            │     ├─ EmployeeDetail（プロフィール／実績／権限）
            │     └─ Hire（AI社員を雇う：プリセット／オリジナル）
            ├─ Meeting（AI会議）──▶ MeetingDetail
            ├─ Knowledge（知識ベース）──▶ KnowledgeDetail（出典へ辿る）
            ├─ Deals（案件・収益）──▶ DealDetail
            └─ Company（会社）
                  ├─ Dashboard（成長の可視化）
                  ├─ Connect（会社で使える道具）
                  ├─ Approvals（承認待ち）
                  ├─ AuditLog（操作履歴）
                  └─ Settings（APIキー・プラン・データ）
```

下部ナビは 5 つ：`ホーム / 社員 / 依頼 / 知識 / 会社`。

---

## 4. DB スキーマ（IndexedDB / key-value）

`lib/storage.js` が単一の窓口。ネットワークには一切触れない。

| キー | 型 | 内容 |
|---|---|---|
| `ouro:company` | Company | 会社名・設立日・プラン・座席数 |
| `ouro:departments` | Department[] | 部署 |
| `ouro:employees` | AIEmployee[] | AI社員 |
| `ouro:tasks` | Task[] | 仕事 |
| `ouro:workflows` | Workflow[] | 定型フロー |
| `ouro:meetings` | Meeting[] | AI会議 |
| `ouro:knowledge` | Knowledge[] | 知識 |
| `ouro:sources` | KnowledgeSource[] | 出典 |
| `ouro:deals` | Deal[] | 案件（収益） |
| `ouro:approvals` | Approval[] | 承認待ち |
| `ouro:audit` | AuditEntry[] | 監査ログ（上限 2000 件で古い順に間引き） |
| `ouro:connections` | Connection[] | 外部サービス接続 |
| `ouro:secrets` | {providerId: apiKey} | APIキー（端末内のみ・書き出し対象外） |
| `ouro:settings` | Settings | 表示・既定モデル・自動実行 |

**`ouro:secrets` は書き出し（エクスポート）に含めない。** バックアップに
APIキーが混ざる事故を防ぐため `storage.exportAll()` が明示的に除外する。

---

## 5. AIEmployee のデータモデル

```js
{
  id, name, avatar,              // 人格
  roleId, departmentId, seat,    // 所属（role × seat が席）
  title,                         // 役職名
  specialties: [],               // 専門分野
  persona,                       // 性格
  style,                         // 回答スタイル
  providerPref: 'auto'|providerId,   // 使いたい思考エンジン（実体ではない）
  modelPref: 'auto'|modelId,
  toolIds: [],                   // 使ってよい道具
  knowledgeScopes: [],           // 読める知識の範囲（'company'|'dept:x'|'self'）
  permissions: { read, create, edit, send, delete, pay },
  autoRun: false,                // 自動実行の可否
  memory: { notes: [] },         // 社員専用記憶
  stats: { tasks, wins, tokens, lastActiveAt },
  rating: 0..5,
  hiredAt, archivedAt
}
```

記憶は 4 層に分離する（`lib/memory.js`）。

1. 会社共通知識 … `knowledgeScopes` に `'company'` があるときだけ
2. 部署知識 … `'dept:<id>'`
3. 社員専用記憶 … `employee.memory`
4. 現在のタスク情報 … `task.context`

`buildContext(employee, task)` がこの 4 層を権限つきで束ねる。無制限アクセスはしない。

---

## 6. Task / Workflow 設計

```js
Task = {
  id, title, request,           // ユーザーの自然言語依頼
  status: 'draft'|'queued'|'running'|'awaiting_approval'|'done'|'failed'|'cancelled',
  steps: [ Step ],              // 分割されたタスク
  currentStep, dealId, createdAt, finishedAt,
  result: { text, knowledgeIds, sourceIds }
}
Step = {
  id, roleId, employeeId, instruction, status,
  input,                        // 前ステップからの引き継ぎ
  output, providerId, model, usage, startedAt, finishedAt, error
}
Workflow = { id, name, description, steps: [{ roleId, instruction }] }
```

- 依頼 → `dispatcher.planTask()` が意図を判定して `steps` を生成
- `workflow.runTask()` が 1 ステップずつ実行し、`output` を次の `input` に渡す
  （＝社員間のハンドオフ）
- 途中で承認が必要な操作に当たると `awaiting_approval` で停止する

---

## 7. Knowledge Base 設計

```js
Knowledge = {
  id, title, summary, body,
  category, tags: [],
  origin: 'ai'|'external'|'user',   // AI生成か外部由来かを必ず区別
  sourceIds: [],                    // 出典（必須：origin='ai' でも根拠を残す）
  relatedIds: [],
  trust: 0..100,                    // 信頼性（レビュアーが更新）
  verifiedAt, verifiedBy,
  createdAt, updatedAt, usedCount, lastUsedAt,
  taskId, employeeId
}
KnowledgeSource = {
  id, type: 'web'|'youtube'|'pdf'|'note'|'audio'|'ai'|'user',
  title, url, excerpt, addedAt, addedBy, trust
}
```

**出典を必ず残す。** `knowledge.createKnowledge()` は `sourceIds` が空の場合、
`origin` が `'ai'` なら「AI生成（未検証）」という擬似ソースを自動で作る。
「どこから来た情報か分からない知識」を作らせない。

---

## 8. AI Provider 抽象化設計

```js
Provider = {
  id, name, models: [{ id, label, inputPer1M, outputPer1M, notes }],
  needsKey: true,
  keyHelpUrl,
  async run({ apiKey, model, system, messages, tools, maxTokens, signal })
      -> { text, usage:{input,output}, raw }
}
```

- `providers/anthropic.js` … Claude（`claude-opus-5` 既定）。ブラウザ直叩きのため
  `anthropic-dangerous-direct-browser-access: true` を付ける。Web検索・Web取得の
  サーバーツールに対応。
- `providers/openai.js` … ChatGPT 系
- `providers/gemini.js` … Gemini 系
- `providers/local.js` … **キー無しでも動くローカル社員**（規則ベース）。
  お金が無い状態でもアプリの全画面・全フローを試せるようにするための既定。

`lib/router.js`（AI Router）が `タスク種別 × 利用可能キー × 社員の希望` から
`{providerId, model}` を決める。ユーザーは「自動 / 手動」を切り替えられる。
**特定AIへの依存を作らない**ため、Provider は登録制（`providers/index.js` の配列）。

---

## 9. Tool / 外部サービス連携設計

```js
Tool = { id, name, category, capabilities:[], needs: 'none'|'key'|'oauth', status }
Connection = { toolId, enabled, connectedAt, scopes:[] }
```

カテゴリは「情報収集 / AI / ストレージ / コミュニケーション / 制作」。
UI は「連携アプリ一覧」ではなく **「会社で使える道具」**（`components/Connect.jsx`）。

接続上限はプラン定義から読む（`data/plans.js`）。**ハードコード禁止**：

```js
PLANS = { standard: { maxConnections: 3 }, pro: { maxConnections: 6 } }
```

上限判定は `plans.connectionLimit(planId, overrides)` の 1 か所だけ。

---

## 10. 権限・承認・Audit Log 設計

```js
Permission = 'read'|'create'|'edit'|'send'|'delete'|'pay'
Approval = { id, taskId, employeeId, action, payload, risk, status, decidedAt }
AuditEntry = { id, at, actor, action, target, detail, cost }
```

- 既定で社員が持つのは `read` と `create` のみ。
- `send`（メール送信）/ `delete`（削除）/ `pay`（決済）/ 外部公開 は
  **必ずユーザー承認を経る**（`lib/permissions.js` の `REQUIRE_APPROVAL`）。
- 社員のすべての実行（プロバイダ呼び出し・知識の作成/更新/削除・承認の可否）は
  `lib/audit.js` が記録する。監査ログは端末内のみ。

---

## 11. 推奨技術スタック

| 層 | 採用 | 理由 |
|---|---|---|
| UI | React 18 + Vite（JSX） | 同リポジトリの他アプリと揃える |
| 型 | 無し（JSDoc で補う） | 依存を増やさない方針 |
| 保存 | IndexedDB（localStorage フォールバック） | 端末内・オフライン |
| 外部AI | fetch 直叩き（BYOK） | サーバー不要＝運用費ゼロ |
| 配信 | GitHub Pages（`/-/ouro`） | 無料 |
| テスト | `node --test` | 依存なし |

**外部ランタイム依存は追加しない**（リポジトリ全体の方針）。
サーバーを持たないので月額費用ゼロ。APIキーはユーザー自身のものを端末内に置く。

---

## 12. ディレクトリ構成

```
ouro/
  docs/ARCHITECTURE.md      ← 本書
  index.html  vite.config.js  package.json
  public/ouro-seal.jpg  public/ouro-team.png
  src/
    main.jsx  App.jsx  styles.css
    data/       roles.js employees.js tools.js plans.js
                workflows.js jobTemplates.js
    lib/        storage.js db.js id.js schema.js seed.js
                dispatcher.js router.js workflow.js runtime.js
                meeting.js knowledge.js ingest.js memory.js
                permissions.js audit.js revenue.js cycle.js format.js
                providers/{index,anthropic,openai,gemini,local}.js
    components/ Home.jsx Employees.jsx EmployeeDetail.jsx Hire.jsx
                Compose.jsx TaskDetail.jsx Knowledge.jsx KnowledgeDetail.jsx
                Meeting.jsx Deals.jsx Company.jsx Dashboard.jsx
                Connect.jsx Approvals.jsx AuditView.jsx Settings.jsx
                OrgMap.jsx Splash.jsx ui.jsx
  test/*.test.mjs
```

---

## 13. API 設計（内部 API）

サーバーを持たないため、`lib/` の関数群が API にあたる。
将来サーバー化するときに 1:1 で REST へ写せるよう、名前と引数を揃えてある。

| 内部関数 | 将来の REST |
|---|---|
| `listEmployees()` / `hireEmployee(d)` / `updateEmployee(id,d)` | `GET/POST/PATCH /employees` |
| `createTask(req)` / `runTask(id)` / `getTask(id)` | `POST /tasks`, `POST /tasks/:id/run` |
| `searchKnowledge(q,opts)` / `createKnowledge(d)` | `GET/POST /knowledge` |
| `startMeeting(topic, ids)` / `runMeeting(id)` | `POST /meetings` |
| `listApprovals()` / `decideApproval(id, ok)` | `GET/POST /approvals` |
| `appendAudit(e)` / `listAudit()` | `GET /audit` |

すべて `Promise` を返す。同期版は作らない（後でネットワーク化しても壊れないため）。

---

## 14. MVP 実装順序

1. `storage` / `schema` / `id` / `seed`（土台）
2. `providers`（`local` を先に作り、キー無しで動く状態を確保）
3. `router` / `dispatcher` / `memory` / `permissions` / `audit`
4. `workflow` / `runtime`（1ステップ実行 → ハンドオフ）
5. `knowledge` / `ingest` / `cycle`（成果 → 知識）
6. UI：Splash → Home → Compose → TaskDetail
7. UI：Employees / OrgMap / Hire
8. UI：Knowledge / KnowledgeDetail
9. UI：Company（Dashboard / Connect / Approvals / Audit / Settings）
10. `revenue` / Deals（稼ぐ層）
11. `meeting`（AI会議）
12. テスト・ビルド・デプロイ

---

## 15. 将来拡張で壊れないための設計上の注意点

1. **社員とエンジンを混ぜない。** `employee.providerId` のようなフィールドを
   足したくなっても足さない。希望（`providerPref`）と実行時の決定（`step.providerId`）
   は別。モデルが廃止されても社員データは無傷。
2. **プラン上限をハードコードしない。** `3` や `6` を UI に直書きしない。
   必ず `plans.connectionLimit()` を通す。
3. **知識に出典を必ず持たせる。** `sourceIds` が空の知識を作れる抜け道を作らない。
   AI生成と外部由来を `origin` で必ず区別する（後から追跡不能になる）。
4. **権限は既定で最小。** 新しい道具を足すときは `capabilities` に危険操作を宣言し、
   `permissions.REQUIRE_APPROVAL` に登録する。「とりあえず全許可」を作らない。
5. **役職の追加はデータだけで済ませる。** `data/roles.js` に 1 件足せば、
   マインドマップ・自動社員選択・網羅表示が自動で追従する（画面を直さない）。
6. **席（seat）は可変。** 「1役職3人」は `company.seatsPerGenre` の初期値であって
   定数ではない。増席は `hireEmployee({roleId, seat})` だけで足りる。
7. **Task の steps は配列。** 単発実行を `task.output` に直書きしない。
   1 ステップでも `steps:[...]` に入れる（後で会議・並列化に拡張できる）。
8. **監査ログは追記のみ。** 既存エントリを書き換えない（改ざん耐性の素地）。
9. **保存キーを増やすときは `storage.KEYS` に登録する。** 直接 `idbSet('...')` を
   呼ばない（書き出し・移行から漏れる）。
10. **`ouro:secrets` を書き出しに混ぜない。** 追加テストで機械チェックしている。
