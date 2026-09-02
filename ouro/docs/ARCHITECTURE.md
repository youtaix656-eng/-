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
| `ouro:ventures` | Venture[] | 事業（実行中は1つだけ・起動時に読む） |
| `ouro:posts` | Post[] | 発信ログ（出したものと反応・上限500件） |
| `ouro:patterns` | Pattern[] | 投稿の型（伸びた投稿を次の種にする） |
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
  status: 'draft'|'queued'|'running'|'awaiting_approval'|'on_hold'|'done'|'failed'|'cancelled',
  steps: [ Step ],              // 分割されたタスク
  currentStep, dealId, createdAt, finishedAt,
  // 台帳で人が手で持つ3つ。ここ以外に台帳用の表を作らない
  dueAt, nextAction, holdReason, heldFrom,
  spec: { deliverable, doneWhen, materials, constraints },  // 受付のときの条件（任意）
  checkUnstaffed,               // 完成条件はあるが、確かめる担当が未雇用だった
  decisions: [ { id, text, state:'open'|'approved'|'rejected', note, decidedAt } ],
  result: { knowledgeIds, sourceIds }   // 本文は持たない（assembleResult で組み立てる）
}
Step = {
  id, roleId, employeeId, instruction, status,
  kind: 'work' | 'check',       // check = 完成条件を確かめるだけの手順（提出物ではない）
  input,                        // 前ステップからの引き継ぎ
  output, providerId, model, usage, startedAt, finishedAt, error
}
Workflow = { id, name, description, steps: [{ roleId, instruction }] }
```

- 依頼 → `dispatcher.planTask()` が意図を判定して `steps` を生成
- `workflow.runTask()` が 1 ステップずつ実行し、`output` を次の `input` に渡す
  （＝社員間のハンドオフ）
- 途中で承認が必要な操作に当たると `awaiting_approval` で停止する
- 引き継ぎは `lib/handoff.js` が絞る（枠が拾えた時だけ②③と出典を落とす。
  拾えなければ全文をそのまま渡す）
- **提出物の枠（5項目）は最後の手順にだけ掛ける**（`runtime.isFinalStep`）。
  判断・見出しを読むときは `workflow.finalOutput(task)` を使い、
  全手順を連ねた `assembleResult` からは拾わない
- 台帳（`lib/ledger.js` / `Ledger.jsx`）は Task から**毎回導くビュー**。
  台帳側にレコードを持たない
- 完成条件（`spec.doneWhen`）があると `lib/checks.js` が `kind:'check'` の手順を
  **必ず単独で最後**に足す（番号は「残っている番号の最大＋1」。承認と同じく maxSteps で切らない）

---

### 6-1. 会社のルールと、社員の記憶

```js
Company.rules = {
  purpose, audience, product, tone,   // この会社について
  added: [ '守らせたいこと', ... ],     // 使う→失敗→1行足す、で育てる
  updatedAt,
}
Employee.memory.notes = [ { id, text, at, taskId } ]  // その社員にだけ効かせること
```

- `lib/rules.js` の `FIXED_RULES`（5行）は**足せるが外せない**。必ず先に読ませる
- 全員に効かせたいことは `company.rules`、1人に効かせたいことは `memory.notes`
- プロンプトに入る `memory.notes` は新しい5件だけ（`buildContext`）

### 6-2. 収益導線（`ouro:funnel`）

```js
Funnel = {
  labels: { [stageId]: '呼び名' },      // 段の数と順番は変えない
  entries: [ { id, weekStart, values: {reach, read, lead, sale}, note } ],
  updatedAt,
}
```

- **これは配列ではなくオブジェクト。** 起動時の読み込みで `asArray` に通さないこと
- 詰まっている所は自分の数字の中の相対で決める（手元に無い基準を持たない）
- 書き込み側は `lib/funnelInput.js`（起動時に読ませない）

---

### 6-3. 社員どうしの共有（`ouro:board` ほか）

```js
BoardPost = { id, text, kind:'share'|'blocked'|'decision'|'meeting'|'consult',
              employeeId, employeeName, roleId, taskId, at }   // 30日で消える
Meeting.materials  // 台帳・収益導線・掲示板から作った事前配布（AI費用ゼロ）
Meeting.hasGuard   // 反対役（守り）が入っていたか
Step.gap / gapChecked / supplement  // 引き継ぎ会（受け手が返した「足りない材料」）
Approval.consult = { employeeId, prompt, kind, taskId, stepId, question }  // 1回だけ呼ぶもの
```

**社員が仕事の前に読むもの（`buildContext`）は6層**：
知識 ／ 自分の記憶 ／ **掲示板** ／ **関係する仕事** ／ 引き継ぎ ／ この仕事の補足。
後ろの2つを足すまで、別の仕事にいる社員が何をしているかは誰も知らなかった。

- 共有のための仕組みは**AIを呼ばない**（在席・朝会・掲示板・関係する仕事・会議の材料）
- AIを呼ぶのは会議（人数×2＋1回）と相談（1回）だけ。**1回だけのものも `askOnce` で承認を通す**
- 掲示板の切り詰めは `memory.trimHead`（先頭＝新しい方を残す）

---

### 6-3. 進み具合を見える形にする（`ouro:pitfalls` ほか）

```js
Task.shareAsked  // この仕組みが動いている状態で終わった印（これが無い＝昔の仕事）
Task.shared      // 社内へ共有した1行
Task.shareWaived // 「この仕事は共有なしでよい」と決めた

Pitfall = { id, roleId, roleName, text, taskTitle, employeeName, count, at }  // ouro:pitfalls
```

- `lib/queue.js` … 誰のせいで何件止まっているか（実行中と未着手を分けて数える）
- `lib/load.js` … 役職ごとの1人あたり持ち数＋未雇用で外れた役職
- `lib/stall.js` … 人間待ちの時間（承認は承認の記録の時刻を使う）
- `lib/pitfalls.js` … 役職別の失敗。**エラーは `result.error` から取る**
  （ループの `step` は実行前の写しで、`step.error` はまだ null）
- `lib/promote.js` … 掲示板 → 会社のルール／知識 への昇格の**提案**
- どれも AI を1回も呼ばない

---

### 6-4. 加害を起こさない（`guard.js` / `privacy.js`）

```js
Task.flagged = { reason, at }   // 「外へ出せない」印。付けた時点で知識・掲示から取り除く
Task.redoCount                  // やり直した回数（REDO_LIMIT=3 で一度止める）
```

- 見張りは **止めない・書き換えない**。`checkPromises`（確約）／`checkRespect`（傷つけうる表現）／
  `checkPersonal`（個人を特定できるもの）はどれも判定を返すだけ
- **分類ごとに件数で打ち切らない**（後ろの分類が一度も当たらなくなる）。
  `personalAttack` はその型を直接当てる
- **後読み（lookbehind）を使わない**（古い Safari で構文エラー→チャンクごと読めなくなる）
- `flagTask` は印を付けるだけでなく、**知識・孤児の出典・掲示・共有の1行を実際に消す**。
  印が付いている間は共有も知識化もできず、`resumeTask` からは解けない
- `FIXED_RULES` に「人ではなく成果物を指す」「個人を特定できるものは書かない」の2行。
  **足したルールでは外せない**

---

### 6-5. 依頼の提案（`lib/suggest.js`）

```js
suggestPlan({ request, assign, customGenres, deals, fixed })
// → { ok, genreId, workflowId, steps[], staffedCount, unstaffedRoles,
//     needs, doneWhen, dealId, calls, reasons[] }
```

- **AIを1回も呼ばない**（語の一致と、既にある `planSteps` から作る）
- `fixed`（案件・進め方・分野）は**推測で上書きしない**。案件から依頼したのに
  紐づけが外れると、`task.dealId` は一方向なので二度と戻らない
- `ok:false`（依頼が短い）のときは中身を持たせない。画面は「自分で決める」だけ出す
- `staffedCount === 0` の提案は実行させない（最初の手順で必ず失敗するため）
- 提案から実行しても、費用の承認・今月の上限は今までどおり通る

---

### 6-6. 事業（`ouro:ventures` / `lib/venture.js`）

```js
Venture = {
  id, title, hypothesis, who, what,
  priceJpy, goalMonthlyJpy, days,          // 逆算とやめる基準に使う
  state,                                    // idea | running | paused | stopped | keep
  startedAt,                                // running にした時だけ立つ
  verdict: { metric, target, decidedAt, decision },
  createdAt, updatedAt,
}
```

- **結びつきは片方向だけ**：`task.ventureId` / `deal.ventureId`。
  事業の側に `taskIds` を**持たない**（`deal.taskIds` が誰にも更新されず、
  AI費用が常に¥0に見えていた失敗を繰り返さないため）。
- **`state:'running'` は1つだけ**（`canStart`）。2つめは断るだけで、勝手に入れ替えない。
- `ventureStats()` は仕事と案件の側から数える。案件に紐づかない仕事のAI費用も、
  その事業のコストとして足す。

```js
targetPlan({ venture, entry, funnel })
// → { price, goal, needBuyers, rows:[{stageId, need, now, rate, gap}], unknown[], ready }
```

- 後ろ（買ってもらう）から前へ、いまの通過率で割り戻す。
- **通過率が分からない段は `need: null`。** 1と置くと「前の段も同じ人数でよい」という嘘になる。

```js
verdictStatus(venture, funnel, now)
// → { state: 'none'|'waiting'|'running'|'met'|'due'|'decided', target, current, left, day }
applyDecision(venture, 'continue'|'stop'|'extend', extraDays)
```

- `met` は期間の途中でも基準に届いた状態（続けてよい）。`due` は期間が終わって未達（判断待ち）。
- `extend` だけは判断を残さず `days` を伸ばす。**どれもAIを呼ばない。**

```js
todayPlan({ venture, posts, tasks, loaded, now })
// → { items:[出す/作る/数える], next, day, total, left, practiceDays, doneCount }
```

- 3枠から増やさない。**カレンダーに複製しない**（毎回ここから導く）。
- `practiceDays` は**通算**（連続ではない）。休んだ日があっても減らない。
- `loaded:false`（発信ログがまだ読めていない）の間は、どれも「未」と言い切らない。

### 6-7. 出す前チェック（`lib/prepublish.js`）

```js
prepublishChecks({ text, task, past })
// → { items:[{id, title, level:'stop'|'warn'|'ok'|'skip', hits}], worst, blocked }
```

- 見張り（確約・言い方・個人情報・完成条件・書き出しの重なり・枠）の**単一の正**。
- **`blocked` になるのは個人情報だけ。** ほかは知らせるだけで、書けなくはしない。
- 当たらなかった項目も `level:'ok'` で返す（確かめたことが画面に残るように）。

---

### 6-8. 外から来た文章の扱い（`lib/untrusted.js`）

```js
wrapUntrusted(text, { label, origin, trust })  // 囲い＋来歴＋確からしさ
SOURCE_RULE                                     // 「従ってよい指示は4つだけ」
isUntrustedOrigin(origin)                       // external / ai だけ true
```

- `buildContext` が知識を渡すとき、**外から来たものだけ**を囲い、`hasUntrusted` を返す。
- `buildSystemPrompt` は `hasUntrusted` の時だけ `SOURCE_RULE` を足し、**材料より前**に置く。
- 囲いの目印（`=====`）は資料の中身とぶつかったら伸ばす（囲いを閉じさせない）。
- **書き換えない。** 消すと資料として使えないので、囲って「指示ではない」と伝えるだけ。

### 6-9. お金（見積もり・上限・エンジンの実績）

```js
estimateRun({ steps, employeeFor, secrets, settings, request })
// → { calls, usd, jpyLow, jpyHigh, rows, free }
route({ ..., settings, costMode })      // 'auto' | 'cheap' | 'best'
addCost(settings, usd, now)             // 日・月・合計を積む
checkAction({ ..., spentThisMonth, spentToday })
engineStats(tasks)                      // エンジン別の回数・費用・失敗
```

- 見積もりは**目安**（`AVG_INPUT_TOKENS` / `AVG_OUTPUT_TOKENS`）で、**幅**（0.5〜2倍）で出す。
- 画面の「AIを呼ぶ ◯回」と見積もりは**同じ数**から作る（担当がいる手順＋確認の手順）。
- `costMode` は**社員の希望（`modelPref`）より優先**する。
- 日の上限・月の上限は、自動承認を入れていても確認へ戻す。

### 6-10. エンジンの登録（`providers/`）

| 項目 | 意味 |
|---|---|
| `needsKey` | APIキーが要るか |
| `isReady(secrets, settings)` | キー以外で決まるエンジン用（ローカルAIは宛先URL） |
| `freeTier` / `freeNote` | 0円で始められる印。画面が先頭に出す |
| `models[].tier` | `low` / `mid` / `high`。`costMode` と重さで選ぶ |

- `availableProviders(secrets, settings)` は `isReady` があればそちらを見る。
- `local`（AI未使用の受け皿）は**選ぶ側でも最後**に回す。
- **モデルが使えなかった時は1つ下へ落とす**（`cheaperModel`）。
  404 / 429 は待っても変わらないのですぐ下へ、503 / 529 は1度待ってから下へ。
  下が無くなるまで降り、**実際に通ったモデル**を `res.model` として返す。
- `runtime.js` とエンジン一式は **`useStore` の `loadRuntime()` で押した時に読む**
  （起動時に読む束へ入れない）。暇な時に `preloadRuntime()` が先読みする。

---

### 6-11. 閉じても続きから（`lib/resume.js` / `lib/notify.js`）

```js
resumeTargets(tasks, { limit })   // 続きから走らせてよい仕事（既定1件）
finishedWhileAway(tasks, since)   // 見ていない間に終わったもの
progressOf(task)                  // 誰が・いつ・何秒・何字・どのエンジン
notifyDone(task, { onClick })     // 端末通知（許可があり、裏に回っている時だけ）
keepAwake() / releaseAwake()      // 走っている間だけ画面を眠らせない
```

- **閉じたら止まる**のは変えられない。埋めるのは「次に開いた時に続きから」。
- 再開の除外：`holdReason`（人が止めた）／`flagged`（外へ出せない）／`awaiting_approval`。
- `settings.lastSeenAt` が知らせの基準。**目の前で終わった時は完了時に進める**
  （進めないと、見たはずのものを次に開くたび知らせる）。
- `resumedRef` で同じ仕事を1セッションに何度も再開しない。

---

### 6-12. 発信の型を回す（`lib/patterns.js` / `lib/batch.js`）

```js
Pattern = { id, ventureId, text, origin:'seed'|'own', postId, label, archivedAt, ... }
Post    = { ..., patternId, taskId }   // 結びつきは投稿の側の片方向だけ

rankPatterns(patterns, posts)   // 3本以上 かつ 反応>0 の型にだけ順位
bestPattern(patterns, posts)
winnerCandidates(posts, patterns)  // 自分の平均の1.5倍以上のものを提案
candidateStatus(posts)             // 出せない時は「あと◯本」を返す
batchRequest({ venture, patterns, count, channel })  // 型は資料として囲う
splitPosts(text)                   // ④成果物の中だけを1本ずつに
overLimit(items, channel)          // 長さは知らせるだけ（切らない）
```

- 型の側に投稿の一覧を持たせない（`post.patternId` から数える）。
- 束の中どうしでも `similarOpenings` を掛ける（同じ型から作ると入口がそっくりになる）。
- 「まとめて作る」は依頼の道を通るので、費用の確認・日／月の上限がそのまま効く。

### 6-13. 稼ぎとして残るか（`lib/passive.js` / `lib/unit.js` / `lib/risk.js`）

速く作れることと、稼ぎとして残ることは別。残るかどうかを見る層。

```js
Venture = { ..., risks:{copy,platform,terms,liked,mine}, finishWhen, restedAt }
Deal    = { ..., ventureId }   // 画面（案件フォーム／案件の詳細）から必ず付けられる

// 手離れ＝不労所得の実測
lastTouchedAt(venture, { tasks, posts, deals })  // 依頼した・出した・案件を起こした だけ
passiveState({ venture, tasks, posts, deals })   // none / building / resting / passive
finishNudge(venture, passive)                    // 仕上げ線（伸びた時に手を止める線）

// 1件あたりの採算——線は1本だけ（稼ぎ ＞ AI費用）
unitEconomics({ venture, tasks, deals, usdJpy }) // 売れた数0なら1件あたりは null
costAdvice(unit, settings)                       // 赤のときの手（やめろとは言わない）

// 続くかどうかの見立て——採点しない
riskReview(venture)                              // 答えと「その時にできること」だけ
```

- **入金の記録を「手を入れた」に数えない。** 数えると売れるたびに日数が0に戻り、
  不労所得は永久に測れない。事業の `updatedAt`（説明文の手直し）も数えない。
- **やめる基準（`verdict.js`）と仕上げ線は別の層。** 前者は伸びない時に降りる線、
  後者は**伸びた時に手を止める線**。届いたかどうかを機械が判定しない。
- **手元に無い基準を持たない。** 採算は「稼ぎ ＞ AI費用」の1本だけ、見立ては点を付けない。
- **`deal.ventureId` を付ける口を画面に必ず置く**（`deal.taskIds` と同じ
  「誰も更新しない列」を作らない）。
- お金の話の確約（必ず稼げる／放置で増える／不労所得になる／リスクゼロ）も
  `guard.js` の `PROMISE_PATTERNS` で見張る。**止めない・書き換えない。**

### 6-14. 書き方の見本と有料記事（`lib/style.js` / `lib/paid.js`）

```js
// 決まり（rules.js）＝守らせること／見本（style.js）＝まねさせるもの。混ぜない。
StyleSample = { id, label, text, origin:'user'|'edited'|'ai'|'external', ... } // ouro:style
styleText(samples, roleId)    // 書く役でなければ ''（roles.js の writesForReaders）
checkEdited(original, edited) // AIの下書きのままは受け取らない
buildContext({ ..., styleText })  // 社員が読む層の7つめ

// 有料記事＝無料のレター＋有料の本文。レターは別の手順（workflows: paid_note）。
LETTER_ROLE_ID = 'writer'     // 最初から居る6役職に入っていない＝未雇用なら抜ける
pricePlan(venture.pricing, soldCount)  // 段の表は保存せず、売れた数から毎回導く
sellReview(venture)           // 出す前の確認。数えるだけ・通せない関門にしない
```

- 見本を読ませるのは**書く役だけ**。全員に読ませると、調べるだけの社員の料金にも毎回乗る。
- **来歴で囲いを変える**（自分で書いた／直した＝囲わない、AI／外＝囲う）。囲いの有無は
  `untrusted.FENCE_HEAD` で見る（囲いの目印は中身によって伸びるので、長さで判定しない）。
- 成果物から見本にするときの下敷きは `parseSections(x).sections.deliverable`。
  **`parseSections(x).deliverable` は必ず undefined**（一度踏んだのでテストが見張る）。
- **「自動で出す」は作らない**（規約違反でアカウントごと止まる）。
- REST_KEYS のものは、**読み込みが済むまで「無い」と言い切らない**（`store.hydrated`）。

### 6-15. 上流と下流（`lib/req.js` / `lib/accept.js` / `lib/weight.js`）

```js
reqReview({ request, spec })   // 6項目のうち足りないもの。AIを呼ばない・止めない
acceptReview(task)             // 完成条件を人が○×。AIの答え(ai)と人の答え(human)を別に持つ
setAccept(task, i, value, note)
weightOf(task)                 // 層ごとの文字数。知らせるだけ・削らない

CHECK_ROLE_IDS = ['tester', 'reviewer']  // テスター優先／最後は必ず core の役職
```

- **役職を足したら `data/employees.js` の `EXTRA_NAMES` も3名ずつ**
  （役職数×席数より少ないと別の役職に同じ名前が回る）。`order` の重複も要注意。
- 受け入れ確認は **AIの答えで人の欄を埋めない**。食い違いは「人が正」と出す。
- 読ませた量は `memory.buildContext` → `workflow.applyStepResult` の順で手順に残る。
  **「1手順あたりの最大」と「全手順の合計」を並べる時は必ず書き分ける。**
- 社員の記憶は `lib/notes.js` に分けてある（`memory.js` からも再輸出）。
  起動時に要るのは記憶の読み書きだけで、`buildContext` は実行時にしか要らない。

### 6-16. 回し方（`lib/loop.js`）

```js
// `lib/cycle.js`（知識の循環）とは別物。名前を混ぜない。
Loop = { id, ventureId, mode:'ooda'|'pdca', n, stepId, decision, decisionStage, closedAt } // ouro:loops
Venture = { ..., loopMode:''|'ooda'|'pdca' }   // 空ならアプリが導く

suggestMode({ venture, funnel, deals })  // 数字の週<2 or 売上0 → ooda
OODA_STEPS / PDCA_STEPS                  // 段ごとの kind: 'human'|'app'|'ai'
orientResult(funnel)                     // 詰まっている段＋直せること2つ（AIを呼ばない）
loopRequest(loop, { venture, funnel, plan, unit })  // 依頼文を組み立てる（AIを呼ばない）
advance(loop)                            // 人が押した時だけ。最後の段の次で閉じる
```

- **1周でAIを呼ぶのは1〜2段だけ**。観察・情勢判断・意思決定・評価はアプリの計算と人の判断。
- **自動で進めない**（`setTimeout` を持たないことをテストが見張る）。
- 依頼文は `Compose` へ `preset.request` で渡す。**費用の承認・日／月の上限はそのまま通る。**
- **周回は taskIds を持たない**（結びつきは片方向）。同時に回るのは1事業1周（`openLoop`）。
- `venture.loopMode` は **`makeVenture` の項目として持つ**（持たないと normalize で消える）。
- 売上0・費用0のとき `unit.black` は false になる。**そのまま「赤字」と書かない。**

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

### 6-17. 任せたら月いくら浮くか（`lib/offload.js`）

AIを入れる話は「速くなった」「楽になった」で終わりやすい。実際に効くのは、
**手でやっている作業が月に何時間あって、それが金額でいくらか**を出した時だけ。
ここは、その引き算だけをやる。**AIを呼ばない。**

```
chore { id, title, minutes, timesPerMonth, who:'me'|'ai', aiCostYen, note }
        ↓ choreMonthly(chore, hourlyYen)  → { hours, yen|null }
offloadReview({ chores, hourlyYen, revenueYen })
  mineHours / mineYen     … 自分でやっている作業
  movedHours / movedYen   … AI社員に任せた作業
  netYen  = movedYen − aiYen        （浮いた額）
  marginPct = netYen ÷ revenueYen   （売上に対して）
  top     … いちばん時間を食っている「自分でやっている作業」
```

**決まりごと（どれも他の機能と同じ線）**

| 決まり | なぜ |
|---|---|
| 時給はユーザーが入れる（既定0＝未入力） | 平均賃金・相場は**手元に無い基準**。初期値に置くと嘘の金額が出る |
| 時給が無ければ `yen` は `null` | 0 にすると「タダの作業」に見える（項目143と同じ線） |
| 浮いた額は時給が無ければ出さない | AI費用だけ引くと必ずマイナスになり、嘘になる |
| 利益率は売上が入っている時だけ | 入っていない所を0と置かない |
| 「◯割なら健全」を書かない | 比べるのは自分の数字どうしだけ |
| 勝手に任せない | 「これを任せませんか」と出すだけ。実行は依頼画面から人が押す |
| 上限 `MAX_CHORES`（40件） | 溜めるほど価値が上がる場所にしない |

保存は `ouro:chores`（REST_KEYS）。**読み込みが済むまで「まだ書き出していません」と
言い切らない**（`store.hydrated` を見る。項目138・93と同じ）。
形の整えは読む側（`offloadReview` → `normalizeChores`）が必ず通すので、書く側ではしない。

### 6-18. 走り出す前に止まる（`lib/risk.js` の6問目）

見立ての問いに「**同じことをやっている人を、実際に3人見ましたか**」を足した。
AIは速く走る方には効くが、**走り出す前に一度止まる材料はくれない**。
1人も見つからない時は、誰もやらない理由（需要が無い・規約で無理）が先にあることが多い。

あわせて、**件数を文言に直接書かないようにした**。以前は「5つとも答えました」と
直書きしていたので、6問目を足すと画面だけ5のまま残る状態だった。件数は必ず
`RISK_QUESTIONS.length`／`review.total` から出す（`test/offload.test.mjs` が機械チェック）。

### 6-19. 競合と市場（`lib/rivals.js` / `lib/demand.js`）

競合・市場調査は本質的に**外の数字**を扱うのに、このアプリの芯は
**手元に無い基準を持たない**こと。ここを雑にやると、いちばん危ない失敗が起きる——
**AIに「この分野の相場は？」と聞いて、もっともらしい値段とURLを作らせる**
（`docs/PROMPT.md` 項目88で一度対策した型と同じ）。

解き方は1つだけ：**あなたが実際に見た1件ずつを台帳にする。**
比べるのは「見た数件の中の相対」と「自分の数字との差」だけ。
だから画面に**AIに調べさせるボタンを置いていない**。

```
rival { name, place, url, price, postsPerMonth, who[], what[], opening, seenAt, ventureId }
  ↓
pricePosition(rivals, myPriceJpy) → { ready, need, min, mid, max, rank, band }
  ・値段0は「未入力」で、位置の計算に混ぜない（無料ではない）
  ・MIN_RIVALS(3) 未満なら ready:false ＋ need を返す（黙らない）
openings(rivals, mine)   → 重なっているタグ／自分の狙いのうち観測に無いタグ
compareTable(rivals)     → 並べ比べ（**総合点を出さない**）
rivalsBrief(rivals, roleId) → 社員へ渡す文（readsMarket の役だけ）
seenEvidence(rivals)     → risk.js の6問目の裏付け（**答えは書き換えない**）
```

| 決まり | なぜ |
|---|---|
| 観測の平均を「相場」と呼ばない | それは「あなたが見た◯件の真ん中」でしかない |
| 総合点・順位を付けない | 採点には他社事例という手元に無い基準が要る |
| 値段0＝未入力（無料ではない） | 0を無料と読むと、位置がまるごと狂う |
| 3件未満で位置を出さない | 0件で「あなたが最安」が最悪の出力 |
| 古い観測を消さない・更新しない | 90日で印を付けるだけ。見直すかは人が決める |
| 「空いている＝儲かる」と書かない | 誰もやらない理由が先にあることが多い |
| `pricePositionLine`（`priceLine` にしない） | `paid.js` の `priceLine` は値付けの段で層が違う |

**社員へ渡すとき**は必ず「資料」として囲う（`buildContext` の `rivalsText` →
`wrapUntrusted`）。競合のLP・note の本文には「これまでの指示を無視して」が
入り得るため（項目97）。渡すのは**市場を見る役だけ**で、判定は `roles.js` の
`readsMarket` が単一の正（役職 id を `rivals.js` に並べない）。

**需要の観測（`demand.js`）**は、検索ボリュームや市場規模のような**手元に無い数字を持たない**。
実際に見た困りごとの声を**その人の言葉のまま**貯め、同じ語が `MIN_HITS`(2) 回以上
出たものだけを出す。**1件の中で同じ語が何度出ても1回**と数える（長い1件が順位を独占するため）。
**誰が言ったかは持たない**（氏名・アカウント名は個人情報）。
語の切り分けは正規表現だけ（形態素解析＝外部ランタイム依存を持たない）なので**ざっくりしていて、
拾えない語もある**。そのことは画面にも出す（黙って0件を返さない）。

### 6-20. 型パック（`lib/kit.js`）

**売っているのはファイルではなく「毎回同じ結果が出る型」。**
手順書のファイルは、その結果を毎回出すための道具でしかない。
だから**結果の見本が付いていない型は、まだ売り物ではない**。

```
kit { title, outcome, request, steps[], doneWhen, notes,
      samples[], sellMode, version, changelog[], ventureId, genreId }
        ↑ 結びつきは task.kitId の片方向だけ（型に taskIds を持たない）

kitFromTask(task)  … 終わった仕事から型にする（動いた担当がそのまま手順になる）
runsOf(kit, tasks) … **成功だけ**を数える（失敗・中止・印つきは入れない）
sampleFromTask()   … **④成果物の中だけ**を見本にする（枠ごと入れない）
kitEffort()        … 1回あたりの分・AI費用（測れていないものは null）
kitReady()         … 足りないものを並べる（**関門にしない**）
exportKit()        … Markdown 1ファイル（3回未満なら「未検証」と必ず書く）
```

| 決まり | なぜ |
|---|---|
| 見本の無い型は売り物にしない | 買う人が欲しいのは手順ではなく、出てくる結果 |
| 数えるのは成功だけ | 失敗した回を数えると「3回やった」が嘘になる |
| 3回未満でも止めない・でも「未検証」と書く | 関門にはしないが、黙って出せるのがいちばん危ない |
| 質は担保できないと必ず言う | 同じ相手・同じ題材の3回は1回と大差ない |
| 型を作ったら元の仕事に `kitId` を書き戻す | その仕事は「その型が動いた1回」。付けないと回数0のまま |
| 値段の表を持たない | `paid.js` の値付けの段に渡すだけ |
| 手離れするのは「手順書を売る」だけ | 他4つは売れるほど自分の時間が減る（`offload.js` と同じ線） |
| 書き出しに会社のデータを混ぜない | キー・お客さんの氏名・掲示板・社員の記憶は商品ではない |
| 0件の競合台帳を「空いている」と読ませない | 0件は「まだ見ていない」（§6-19 と同じ線） |

**出す前チェック**は `prepublish.js` が単一の正のまま。`kit` を渡した時だけ
`kitRuns`／`kitSamples`／`kitMarket` の3項目が増え、**渡さなければ増えない**。
止めるのは今までどおり個人情報だけ。

**依頼との連携**：`go('compose', { request, kitId, genreId, ventureId })` で依頼画面へ渡す。
`arg` は**そのまま** `preset` になるので `{ preset: {...} }` と包まないこと。
`kitId` が仕事に残ることで回数が数えられ、費用の承認と日／月の上限は今までどおり通る。

### 6-21. SKILL.md の形とパック（`lib/kit.js`）

買う人が欲しいのは「そのまま置いて使える形」なので、中身だけでなく**形式**もそろえる。

```
exportSkillMd(kit) → { name, text, warnings }
  ---
  name: sns-posts            ← 小文字の英数字とハイフン。**日本語からは作らない**
  description: "…"           ← **いつ使うか**（何が出るか だけでは使いどきが分からない）
  ---
  # 題名 / 手順 / 依頼文 / 完成条件 / 注意 / 結果の見本

exportPack(pack) → { files: [{path, text}], warnings }
  README.md                  ← 目次。未検証が1つでもあれば先頭に書く
  <name>/SKILL.md            ← 型ごと。名前がぶつかったら -2 を足す
```

| 決まり | なぜ |
|---|---|
| `name` を題名から自動生成しない | ローマ字化は漢字の読みと同じで当てずっぽうになる |
| 決めていなければ `skill-<id末尾>` ＋警告 | 行き止まりにしない。ただし黙って埋めない |
| `description` は「いつ使うか」から作る | 出力だけ書いてもAIが使いどきを判断できない |
| YAML は改行を畳み引用符を escape | 壊れると読み込めないファイルになる |
| パックは未検証を目次の先頭に書く | 束にすると個々の「未検証」が埋もれる |
| 名前の衝突に番号を足す | 上書きすると型が1つ消える |
| `pack.kitIds` は目次であって同期列ではない | 型の側にパック id を持たせない（片方向のまま） |
| 消された型は静かに落とす | 無いものを商品の目次に出さない |

### 6-22. 目次・索引と用語（`data/terms.js` / `lib/focus.js` / `lib/tocCandidates.js`）

目次は**元データから毎回導出する**。用語そのものが元データで、目次専用の手書き一覧は持たない。

```
data/terms.js（24件）  title / reading / description / descriptionStatus
                       aliases[] / destinations[{type,label,view,anchor}]
        ＋ roles・genres・workflows・jobTemplates・tools・employees
        ↓
data/toc.js  buildTocEntries({ employees, customGenres, customTerms })
        ↓
lib/yomi.js  foldKana / kanaRow / numberToReading / normalizeAlnum / buildKanaIndex
        ↓
あ〜ん → A〜Z → その他 の順（「その他」は読みの入れ忘れが見える場所）
```

**飛び先（レベル2）**

```
Toc の項目をタップ → TermPanel（説明・別名・飛び先ボタン）
  → resolveDestination(d, { ventures })   … 見つからない目印を渡さない
  → go(view, arg, anchor)                 … 先頭へ戻してから目印を立てる
  → App の <FocusJumper> → useFocusJump → flashTo(id)
  → 要素に data-flash を付け、1.6秒で setTimeout で外す
```

| 決まり | なぜ |
|---|---|
| 印は `data-flash` 属性（class を使わない） | 開閉で className が変わると、印だけが消える |
| 先頭へ戻すのは `go()` の中、目印はそのあと | 逆にすると運んだ画面が引き戻される |
| 枠の切り替えは `useLayoutEffect` | `useEffect` だと描き直しが flashTo より後になる |
| 見つからない目印を渡さない | 飛んだのに何も光らないと「壊れている」に見える |
| 読みは推定しない | 誤読がそのまま索引に残る。無ければ「その他」に出す |
| `normalizeAlnum` は中黒（・）も落とす | かなの文字範囲に入っていて、記号だけの題名が通る |
| `markVerified` という名前にしない | `knowledge.js` に同名の別物がある（層が違う） |

**候補フロー（会話から目次を増やす／減らす）**

```
makeCandidate({ trigger })      … marker / tags / user の3つ以外は null
  → ouro:tocCandidates（別置き場。本体には1文字も書かない）
  → 画面で二択：「追加する／追加しない」「削除する／削除しない」
      追加 → checkCandidate の4つ（読み・重複・分類・正規化）を通ってから ouro:terms へ
             通らなければ書かずに理由を返す（履歴に「止めた」）
      削除 → 対象の1件だけを removed へ
      しない → 本体に一切影響しない（履歴には「見送り」）
  → undoLastTocAdditions(n) … 直近の「追加」だけを取り消す（削除は巻き戻さない）
```

`ouro:terms` と `ouro:tocCandidates` は**配列ではなくオブジェクト**なので、
起動時の読み込みで `asArray` に通さない（`OBJECT_FALLBACKS`。項目50と同じ形の事故を防ぐ）。
