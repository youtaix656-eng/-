// 仕事の進行と成果。誰が何をしたか、どのエンジンで、いくらかかったかを全部見せる。

import { useState } from 'react';
import { Card, Doc, Empty, Bar, SectionTitle, Field } from './ui.jsx';
import {
  TASK_STATUS,
  taskProgress,
  nextStep,
  assembleResult,
  isRunnable,
  finalOutput,
  redoCount,
} from '../lib/workflow.js';
import { roleById } from '../data/roles.js';
import { relTime, usd } from '../lib/format.js';
import { useAllTasks } from './useAllTasks.js';
import { openDecisions } from '../lib/decisions.js';
import { personalAttack, rephraseHint } from '../lib/guard.js';
import { prepublishChecks, prepublishLine } from '../lib/prepublish.js';
import { isFlagged, overRedoLimit, REDO_LIMIT } from '../lib/workflow.js';
import { parseSections, OUTPUT_SECTIONS, sectionByKey } from '../lib/outline.js';
import { ticketOf, dueStateOf, DUE_LABELS, needsShare } from '../lib/ledger.js';
import { checkSummary } from '../lib/checks.js';

export default function TaskDetail({ store, taskId, go }) {
  // 古い仕事も要る画面なので、残りを読み足す
  useAllTasks(store);
  const task = store.tasks.find((t) => t.id === taskId);
  const [followUp, setFollowUp] = useState('');
  const [open, setOpen] = useState({});
  const [meta, setMeta] = useState(null); // 台帳の3列を編集中かどうか

  if (!task) return <div className="screen"><Empty>仕事が見つかりません。</Empty></div>;

  const busy = store.busy && store.busy.taskId === task.id;
  const live = store.live && store.live.taskId === task.id ? store.live : null;
  const pending = nextStep(task);
  // 失敗している間は「続きを実行する」を出さない。
  // 出しても runTask が即座に抜けるので、押しても何も起きない行き止まりになる。
  const failedSteps = (task.steps || []).filter((s) => s.status === 'failed');
  // 提出物は保存せず、その場で組み立てる（同じ文章を二重に持たないため）
  const deliverable = assembleResult(task);
  // AIが動いていない「仕事の型」は自動で知識にしない（知識を薄めないため）。
  // 型が役に立つなら、ここから手で知識にできる。
  const isTemplate = (task.steps || []).some((s) => s.status === 'done' && s.offline);
  const knowledge = store.knowledge.filter((k) => k.taskId === task.id);

  return (
    <div className="screen fade-in">
      <Card glyph="✎" title={task.title}>
        <p style={{ marginTop: -6, fontSize: 14.5 }}>{task.request}</p>
        {task.context && <p className="muted">補足：{task.context}</p>}
        <Bar pct={taskProgress(task)} />
        <div className="muted" style={{ marginTop: 6 }}>
          {TASK_STATUS[task.status]}・{relTime(task.createdAt)}
          {task.totalCost > 0 && `・${usd(task.totalCost)}`}
        </div>
        <div className="muted" style={{ fontSize: 11 }}>受付番号 {ticketOf(task)}</div>
      </Card>

      <LedgerCard task={task} store={store} meta={meta} setMeta={setMeta} />

      {openDecisions(task).length > 0 && <DecisionCard task={task} store={store} />}

      <FlaggedCard task={task} store={store} />

      <ShareCard task={task} store={store} go={go} />

      {task.missingApprovers?.length > 0 && (
        <Card glyph="⚠" title="確認を通していない成果物です">
          <p className="muted" style={{ marginTop: -6 }}>
            この仕事には
            {task.missingApprovers.map((r) => roleById(r)?.name || r).join('・')}
            の確認が入るはずですが、まだ雇っていないため通せていません。
            外へ出す前に、雇って確認させるか、ご自身で内容を確かめてください。
          </p>
          <button type="button" className="btn small primary" onClick={() => go('characters')}>
            確認役を雇う
          </button>
        </Card>
      )}

      {task.unstaffedRoles?.length > 0 && (
        <Card glyph="＋" title="この仕事に向いている未雇用の役職">
          <p className="muted" style={{ marginTop: -6 }}>
            {task.unstaffedRoles.map((r) => roleById(r)?.name || r).join('・')}
            が向いていますが、まだ雇っていないため今回は担当から外しました。
            雇うと次から自動で担当に入ります。
          </p>
          <button type="button" className="btn small" onClick={() => go('characters')}>
            AIキャラクター名鑑を見る
          </button>
        </Card>
      )}

      {task.status === 'awaiting_approval' && (
        <Card glyph="⚖" title="承認が必要です">
          <p className="muted" style={{ marginTop: -6 }}>
            この仕事の実行にはAPIの利用料が発生します。あなたの承認を待っています。
          </p>
          <button type="button" className="btn primary block" onClick={() => go('approvals')}>
            承認画面へ
          </button>
        </Card>
      )}

      <SectionTitle>仕事の流れ</SectionTitle>
      <div className="steps">
        {task.steps.map((s) => {
          const role = roleById(s.roleId);
          const isOpen = open[s.id];
          return (
            <div key={s.id} className={`step ${s.status}`}>
              <div className="who">
                {role?.glyph} {s.employeeName || role?.name}
                {s.status === 'running' && <span className="spinner" style={{ marginLeft: 8 }} />}
                {s.status === 'done' && <span className="badge" style={{ marginLeft: 6 }}>完了</span>}
                {s.status === 'failed' && <span className="badge warn" style={{ marginLeft: 6 }}>失敗</span>}
              </div>
              <div className="what">{s.instruction}</div>
              {s.providerName && (
                <div className="what" style={{ marginTop: 2 }}>
                  {s.providerName}／{s.model || '—'}
                  {s.reason ? `（${s.reason}）` : ''}
                  {s.cost > 0 ? `・${usd(s.cost)}` : ''}
                </div>
              )}
              {s.error && <div className="what" style={{ color: '#fff' }}>⚠ {s.error}</div>}
              {/* 項目26・27：完了を待たず、届いた文字から出す */}
              {live && live.stepId === s.id && (
                <div className="card tight live-out" style={{ marginTop: 6 }}>
                  <div className="muted" style={{ marginBottom: 4 }}>
                    <span className="spinner" style={{ marginRight: 6 }} />
                    {live.employeeName} が書いています…
                  </div>
                  {live.text ? (
                    // 流れている最中は折り畳まない（新項目18）。
                    // 途中で「続きを読む」が出ると、書き続けているのに止まって見える。
                    <Doc text={live.text} fold={0} />
                  ) : (
                    <div className="muted">受け取りを待っています</div>
                  )}
                </div>
              )}
              {/* 引き継ぎ会：受け取った側が「材料が足りない」と言える場（1往復だけ）。
                  **終わった手順でも聞ける。** 実行はひと続きで走るので、
                  「まだ動いていない手順」だけに限ると、押せる瞬間がほとんど無い。 */}
              {s.input && s.kind !== 'check' && s.status !== 'running' && (
                <HandoffReview task={task} step={s} store={store} />
              )}
              {s.output && (
                <>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => setOpen({ ...open, [s.id]: !isOpen })}
                  >
                    {isOpen ? '▲ 閉じる' : '▼ この社員の成果を見る'}
                  </button>
                  {isOpen && (
                    <div className="card tight" style={{ marginTop: 6 }}>
                      <Doc text={s.output} />
                      {s.citations?.length > 0 && (
                        <div className="muted">
                          出典：
                          {s.citations.slice(0, 6).map((c) => (
                            <a
                              key={c.url}
                              href={c.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              style={{ color: 'inherit', display: 'block' }}
                            >
                              ・{c.title || c.url}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* 保留・中止・完了は動かさない。押しても何も起きないボタンを出さないため
          （runTask 側も isRunnable で止めている）。 */}
      {pending && isRunnable(task) && task.status !== 'awaiting_approval' && task.status !== 'failed' && (
        <button
          type="button"
          className="btn block"
          onClick={() => store.runTask(task.id)}
          disabled={busy}
          style={{ marginBottom: 12 }}
        >
          {busy ? <><span className="spinner" /> 実行中…</> : '続きを実行する'}
        </button>
      )}

      {/* 失敗した仕事はここからやり直す（押しても何も起きないボタンを出さない） */}
      {task.status === 'failed' && !busy && (
        <Card glyph="⚠" title="途中で止まりました">
          <p className="muted" style={{ marginTop: 0 }}>
            {failedSteps[0]?.error || '実行に失敗しました。'}
          </p>
          <p className="muted">
            失敗した所からやり直します。すでに終わった手順はもう一度実行しないので、
            そのぶんの費用はかかりません。
          </p>
          <button type="button" className="btn primary block" onClick={() => store.retryTask(task.id)}>
            失敗した所からやり直す
          </button>
        </Card>
      )}

      {/* 新項目20：実行を途中でやめられるようにする。
          止めれば、そこから先のAIの利用料はかからない。 */}
      {busy && (
        <button
          type="button"
          className="btn ghost block"
          onClick={() => store.cancelRun()}
          style={{ marginBottom: 12 }}
        >
          やめる（ここまでの結果は残ります）
        </button>
      )}

      {task.status === 'done' && (
        <>
          <SectionTitle>会社としての提出物</SectionTitle>
          <CheckCard task={task} />
          <PrePublishCard task={task} text={deliverable} store={store} go={go} />
          <Card>
            {/* 見出しは「提出物を書いた手順」の本文から拾う（連結文からは拾わない） */}
            <Highlights text={finalOutput(task)} />
            <Doc text={deliverable} />
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  navigator.clipboard?.writeText(deliverable);
                }}
              >
                コピー
              </button>
              {knowledge[0] && (
                <button type="button" className="btn small" onClick={() => go('knowledgeDetail', knowledge[0].id)}>
                  知識として見る
                </button>
              )}
              <TeachButton task={task} store={store} />
              <FlagButton task={task} store={store} />
              {!knowledge[0] && isTemplate && (
                <button
                  type="button"
                  className="btn small"
                  onClick={async () => {
                    const k = await store.saveTaskAsKnowledge(task.id);
                    if (k) go('knowledgeDetail', k.id);
                  }}
                >
                  これを知識として残す
                </button>
              )}
            </div>
          </Card>

          {knowledge.length > 0 && (
            <p className="muted">
              ◉ この成果は会社の知識になりました。次の仕事で自動的に材料として使われます。
            </p>
          )}
          {!knowledge.length && isTemplate && (
            <p className="muted">
              ✳ これはAIが考えた結果ではなく「仕事の型」です（AIエンジンが未接続のため）。
              知識には自動で入れていません。役に立つと思ったら、上のボタンで残せます。
              設定でエンジンを1つ接続すると、この型のとおりに社員が実際に調べて書きます。
            </p>
          )}

          <SectionTitle>追加で聞く</SectionTitle>
          <Card className="tight">
            <Field label="この結果について、さらに依頼する">
              <textarea
                className="textarea"
                style={{ minHeight: 80 }}
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                placeholder="例：この内容を、初心者向けに1000字でまとめ直して"
              />
            </Field>
            <button
              type="button"
              className="btn primary block"
              disabled={!followUp.trim()}
              onClick={() => {
                const t = store.newTask({
                  request: followUp,
                  context: `前の仕事「${task.title}」の結果を踏まえてください。\n\n${deliverable.slice(0, 3000)}`,
                  dealId: task.dealId,
                });
                setFollowUp('');
                go('task', t.id);
                store.runTask(t.id);
              }}
            >
              続けて依頼する
            </button>
          </Card>
        </>
      )}

      <div className="btn-row" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            if (window.confirm('この仕事を削除しますか？')) {
              store.deleteTask(task.id);
              go('home');
            }
          }}
        >
          削除
        </button>
      </div>
    </div>
  );
}

/**
 * 台帳の3列（期限・次の対応・保留）。
 * **ここだけが手で書き換えられる列**で、残りは仕事から導かれる。
 */
function LedgerCard({ task, store, meta, setMeta }) {
  const editing = meta !== null;
  const dueState = dueStateOf(task.dueAt);
  const start = () =>
    setMeta({
      // **toISOString() を使わないこと**（UTCに直るので、日本時間の午前0時だと前日になる）
      dueAt: task.dueAt ? toDateInput(task.dueAt) : '',
      nextAction: task.nextAction || '',
    });
  const save = () => {
    store.setTaskMeta(task.id, {
      dueAt: meta.dueAt ? new Date(meta.dueAt).getTime() : null,
      nextAction: meta.nextAction,
    });
    setMeta(null);
  };

  return (
    <Card glyph="▦" title="台帳">
      {!editing ? (
        <>
          <div className="muted" style={{ marginTop: -6 }}>
            期限：
            {task.dueAt ? (
              <>
                {new Date(task.dueAt).toLocaleDateString('ja-JP')}
                {DUE_LABELS[dueState] && <span className="badge warn" style={{ marginLeft: 6 }}>{DUE_LABELS[dueState]}</span>}
              </>
            ) : (
              '未設定'
            )}
          </div>
          <div className="muted">次の対応：{task.nextAction || '（自動で表示しています）'}</div>
          {task.holdReason && <div className="muted">保留の理由：{task.holdReason}</div>}
          {task.spec && (task.spec.doneWhen || task.spec.deliverable) && (
            <div className="muted">
              完成の条件：{task.spec.doneWhen || task.spec.deliverable}
            </div>
          )}
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button type="button" className="btn small" onClick={start}>
              期限・次の対応を書く
            </button>
            {task.status === 'on_hold' ? (
              // 印のせいで止まっている時は、ここからは解かない
              // （印を外す方から解く。印だけ残った状態を作らないため）
              isFlagged(task) ? null : (
                <button type="button" className="btn small primary" onClick={() => store.resumeTask(task.id)}>
                  保留を解く
                </button>
              )
            ) : (
              task.status !== 'done' &&
              task.status !== 'cancelled' && (
                <button
                  type="button"
                  className="btn small ghost"
                  onClick={() => {
                    // 理由の無い保留は、あとで見た時に再開してよいか分からなくなる
                    const reason = window.prompt('保留にする理由を書いてください（あとで自分が読みます）');
                    if (reason === null) return;
                    store.holdTask(task.id, reason);
                  }}
                >
                  保留にする
                </button>
              )
            )}
          </div>
        </>
      ) : (
        <>
          <Field label="期限">
            <input
              className="input"
              type="date"
              value={meta.dueAt}
              onChange={(e) => setMeta({ ...meta, dueAt: e.target.value })}
            />
          </Field>
          <Field label="次の対応（誰が・何を）">
            <input
              className="input"
              value={meta.nextAction}
              onChange={(e) => setMeta({ ...meta, nextAction: e.target.value })}
              placeholder="例：自分が価格を決めてから、ライターに戻す"
            />
          </Field>
          <div className="btn-row">
            <button type="button" className="btn small primary" onClick={save}>
              保存
            </button>
            <button type="button" className="btn small ghost" onClick={() => setMeta(null)}>
              やめる
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

/**
 * 成果物の③から拾った「あなたの判断が要ること」。
 * AIをもう一度呼ばずに、本文から機械的に取り出しているだけ。
 */
function DecisionCard({ task, store }) {
  const items = openDecisions(task);
  return (
    <Card glyph="⚖" title={`あなたの判断が要ること ${items.length}件`}>
      <p className="muted" style={{ marginTop: -6 }}>
        成果物の中で、社員が「これは人が決めることです」と書いた所です。
        決めるまで、この仕事は台帳で「確認待ち」のままになります。
      </p>
      {items.map((d) => (
        <div key={d.id} className="card tight" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 14 }}>{d.text}</div>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn small primary"
              onClick={() => store.decideTask(task.id, d.id, 'approved')}
            >
              これで進める
            </button>
            <button
              type="button"
              className="btn small ghost"
              onClick={() => {
                // キャンセルは「やめる」。握り潰して却下を確定させない（保留の扱いとそろえる）
                const note = window.prompt('見送る理由（任意）');
                if (note === null) return;
                store.decideTask(task.id, d.id, 'rejected', note);
              }}
            >
              見送る
            </button>
          </div>
        </div>
      ))}
    </Card>
  );
}

/** 結論と最優先事項だけを先に出す（長い本文を頭から読まないで済ませる）。 */
function Highlights({ text }) {
  const { sections, found } = parseSections(text);
  const keys = OUTPUT_SECTIONS.map((s) => s.key).filter((k) => k !== 'deliverable' && found.includes(k));
  if (keys.length < 2) return null;
  return (
    <div className="card tight" style={{ marginBottom: 10 }}>
      {keys.map((k) => (
        <div key={k} style={{ marginBottom: 6 }}>
          <div className="muted" style={{ fontSize: 11 }}>
            {sectionByKey(k).num}
            {sectionByKey(k).title}
          </div>
          <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{sections[k]}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * 出す前チェック（1枚）。
 *
 * 見張りは前からあったが、**画面のあちこちにバラバラに出ていた**ので、
 * 出す直前にどれを見たのか分からなかった。判定は lib/prepublish.js が単一の正。
 *   ・お客さんの氏名・連絡先（ここだけ止める）
 *   ・完成条件／確約（価格・納期・効果）／人ではなく成果物を指しているか
 *   ・書き出しが前と同じでないか／結論から書けているか
 * どれも AI を呼ばずに、語の一致だけで見ている。**当たらなかった時も出す**
 * （出ない時だけ静かだと、確かめたのか忘れたのか分からない）。
 */
function PrePublishCard({ task, text, store, go }) {
  const past = (store.knowledge || [])
    .filter((k) => k.taskId && k.taskId !== task.id && k.body)
    .slice(0, 30)
    .map((k) => ({ id: k.id, title: k.title, text: k.body }));
  const result = prepublishChecks({ text, task, past });
  const shown = result.items.filter((i) => i.level !== 'skip');

  return (
    <Card glyph={result.blocked ? '⛔' : result.worst === 'warn' ? '⚠' : '✓'} title="出す前チェック">
      <p className="muted" style={{ marginTop: -6 }}>{prepublishLine(result)}</p>
      {shown.map((i) => (
        <div key={i.id} className="today-item">
          <span className="rune">{i.level === 'stop' ? '⛔' : i.level === 'warn' ? '⚠' : '✓'}</span>
          <div className="ti-body">
            <div className="ti-label">{i.title}</div>
            <div className="ti-why">{i.level === 'ok' ? i.ok : i.ng}</div>
            {i.hits.length > 0 && (
              <div className="chips" style={{ marginTop: 6 }}>
                {i.hits.map((h, n) => (
                  i.id === 'opening' && h.id ? (
                    <button
                      key={h.id}
                      type="button"
                      className="chip"
                      onClick={() => go('knowledgeDetail', h.id)}
                    >
                      {h.phrase}（{h.label}）
                    </button>
                  ) : (
                    <span key={`${i.id}:${h.phrase}:${n}`} className="chip">
                      {h.phrase}（{h.label}）
                    </span>
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      <p className="muted" style={{ fontSize: 11.5 }}>
        止めるのは個人情報だけです。ほかは「ここは見直す所」と伝えるだけで、書けなくはしません。
      </p>
    </Card>
  );
}

/**
 * 「この成果物は外へ出せない」。
 *
 * **見張りのカードの中に置かないこと。** 見張りは決まった語に当たった時しか
 * 出ないので、その中に入れると、決まった語に当たらない加害を止められなくなる。
 * 提出物があれば必ず押せる場所に置く。
 */
function FlagButton({ task, store }) {
  if (!task || !store || isFlagged(task)) return null;
  return (
    <button
      type="button"
      className="btn small ghost"
      onClick={() => {
        const reason = window.prompt('どこが問題か、ひと言で書いてください（記録に残ります）');
        if (reason === null || !reason.trim()) return;
        store.flagTask(task.id, reason.trim());
      }}
    >
      この成果物は外へ出せない
    </button>
  );
}

/** 外へ出せないと印を付けた仕事。知識にも掲示板にも入らない。 */
function FlaggedCard({ task, store }) {
  if (!isFlagged(task)) return null;
  return (
    <Card glyph="⛔" title="外へ出せない内容として止めています">
      <p className="muted" style={{ marginTop: -6 }}>
        理由：{task.flagged.reason || '（未記入）'}
      </p>
      <p className="muted">
        この仕事の中身は<strong style={{ color: '#fff' }}>知識にも掲示板にも入りません</strong>。
        加害的な文章が会社の共通記憶に残らないようにするためです。
      </p>
      <div className="btn-row">
        <button type="button" className="btn small ghost" onClick={() => store.unflagTask(task.id)}>
          印を外す
        </button>
      </div>
    </Card>
  );
}

/** 日付の入力欄用（ローカルの日付のまま YYYY-MM-DD にする）。 */
function toDateInput(ts) {
  const d = new Date(ts);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

/**
 * 完成条件の確認（新規）。
 * 「文章を出した＝完了」にしないための手順。読み取れなければ本文をそのまま出す
 * （勝手に「合格」にしない）。
 */
function CheckCard({ task }) {
  const sum = checkSummary(task);
  if (sum.state === 'none') {
    if (!task.checkUnstaffed) return null;
    return (
      <Card glyph="⚠" title="完成の確認ができていません">
        <p className="muted" style={{ marginTop: -6, marginBottom: 0 }}>
          完成条件は決めてありますが、確かめる担当（レビュアー）を雇っていないため確認できませんでした。
          レビュアーを雇うと、次から自動で1つずつ確かめます。
        </p>
      </Card>
    );
  }
  if (sum.state === 'pending') return null;
  if (sum.state === 'unread') {
    return (
      <Card glyph="?" title="完成の確認（読み取れませんでした）">
        <p className="muted" style={{ marginTop: -6 }}>
          決まった形で返ってこなかったので、○×として読み取れませんでした。中身はそのまま出します。
        </p>
        <Doc text={sum.step.output} fold={0} />
      </Card>
    );
  }
  const ng = sum.items.filter((x) => !x.ok);
  return (
    <Card
      glyph={sum.state === 'passed' ? '✓' : '⚠'}
      title={sum.state === 'passed' ? '完成条件を満たしています' : `満たしていない条件が${ng.length}件あります`}
    >
      {sum.items.map((x) => (
        <div key={x.text} style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 14 }}>
            <span className="badge" style={{ marginRight: 6 }}>{x.ok ? '○' : '×'}</span>
            {x.text}
          </div>
          {x.reason && <div className="muted" style={{ marginLeft: 4 }}>{x.reason}</div>}
        </div>
      ))}
      {sum.state !== 'passed' && (
        <p className="muted" style={{ marginBottom: 0 }}>
          直すところが分かっているので、「追加で聞く」から直させると早いです。
        </p>
      )}
    </Card>
  );
}

/**
 * この結果を見て、担当した社員に1行覚えさせる（改善ログ）。
 * 「①ミス → ②ルール化 → ③次回改善」を、結果を見ているその場で回すための入口。
 */
function TeachButton({ task, store }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const workers = (task.steps || [])
    .filter((s) => s.employeeId && s.status === 'done')
    .map((s) => ({ id: s.employeeId, name: s.employeeName || s.roleId }));
  const uniq = workers.filter((w, i) => workers.findIndex((x) => x.id === w.id) === i);
  const [who, setWho] = useState(uniq[0]?.id || '');
  if (!uniq.length) return null;

  if (!open) {
    return (
      <button type="button" className="btn small" onClick={() => setOpen(true)}>
        次から直してほしい所を教える
      </button>
    );
  }
  return (
    <div className="card tight" style={{ width: '100%', marginTop: 8 }}>
      <Field label="誰に覚えさせるか">
        <select className="select" value={who} onChange={(e) => setWho(e.target.value)}>
          {uniq.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </Field>
      <Field label="次からはこうしてほしい" hint="1行で。この社員が次に動くとき、必ず読んでから書きます。">
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例：見出しは1つ200字まで"
        />
      </Field>
      <div className="btn-row">
        <button
          type="button"
          className="btn small primary"
          disabled={!text.trim() || !who}
          onClick={() => {
            // **ここがいちばん効く場所。** 社員は傷つかないが、
            // 「使えない」と書く癖は、そのまま人に向く癖になる。
            // 止めはせず、行動で書き直すよう1度だけ促す。
            const hit = personalAttack(text);
            if (hit && !window.confirm(`${rephraseHint(hit.phrase)}\n\nこのまま覚えさせますか？`)) return;
            store.teachEmployee(who, text, task.id);
            setText('');
            setOpen(false);
          }}
        >
          覚えさせる
        </button>
        <button type="button" className="btn small ghost" onClick={() => setOpen(false)}>
          やめる
        </button>
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>
        全員に守らせたいことなら、会社 →「会社のルール」に書いてください。
      </p>
    </div>
  );
}

/**
 * 引き継ぎ会（新規）。
 *
 * これまでの引き継ぎは一方向で、受け取った側は「材料が足りない」と言えなかった。
 * **1往復だけ**にする（無限に往復させると費用が読めなくなる）。
 */
function HandoffReview({ task, step, store }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const run = async (fn, done) => {
    setBusy(true);
    try {
      const r = await fn();
      // **何も返ってこなかった時を「できた」にしない。**
      // 担当が見つからない等で何もしていないのに「確認しました」と出る。
      if (!r) setMsg('この手順では聞けませんでした。');
      else if (r.queued) setMsg('承認が要ります。承認画面から進めてください。');
      else if (r.error) setMsg(`聞けませんでした：${r.error}`);
      else setMsg(done);
    } finally {
      setBusy(false);
    }
  };

  // 「なし」と返ってきた時は、足りているのだから何も出さない
  if (step.gapChecked && !step.gap) {
    return <div className="muted" style={{ marginTop: 6 }}>◇ 受け取った材料は足りていました。</div>;
  }

  if (!step.gap) {
    return (
      <div style={{ marginTop: 6 }}>
        <button
          type="button"
          className="btn ghost small"
          disabled={busy}
          onClick={() =>
            run(() => store.askHandoffGap(task.id, step.id), '確認しました')
          }
        >
          {busy ? '聞いています…' : '受け取る前に「材料が足りているか」を聞く（AI1回）'}
        </button>
        {msg && <div className="muted" style={{ marginTop: 4 }}>{msg}</div>}
      </div>
    );
  }

  return (
    <div className="card tight" style={{ marginTop: 6 }}>
      <div className="muted" style={{ marginBottom: 4 }}>◇ 受け取った側からの返事</div>
      <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{step.gap}</div>
      {!step.supplement && (
        <button
          type="button"
          className="btn small"
          style={{ marginTop: 8 }}
          disabled={busy}
          onClick={() => run(() => store.supplementHandoff(task.id, step.id), '補ってもらいました')}
        >
          {busy ? '聞いています…' : '前の担当に補ってもらう（AI1回）'}
        </button>
      )}
      {step.supplement && (
        <>
          <div className="muted" style={{ marginTop: 8 }}>
            ✓ 補われた材料を、この手順の入力に足しました。
          </div>
          {step.status === 'done' && (
            <button
              type="button"
              className="btn small primary"
              style={{ marginTop: 8 }}
              disabled={busy}
              onClick={async () => {
                const n = redoCount(task, step.id);
                if (!window.confirm(`この手順からやり直します。${n}件の手順がもう一度動き、そのぶんAIの利用料がかかります。よろしいですか？`)) return;
                const r = await store.redoStep(task.id, step.id);
                // **際限のない差し戻しは型として持たない。**
                // ただし行き止まりにもしない——「それでもやり直す」で必ず抜けられる。
                if (r && r.blocked) {
                  const go = window.confirm(
                    `この仕事はもう${REDO_LIMIT}回やり直しています。\n\n` +
                      '指示の方に無理があるか、ここは自分で直した方が早いかもしれません。\n' +
                      'それでもやり直しますか？'
                  );
                  if (go) {
                    store.allowMoreRedo(task.id);
                    setMsg(`やり直しの回数を数え直しました。もう一度押してください。`);
                  } else {
                    setMsg(`${REDO_LIMIT}回やり直しています。指示を見直すか、自分で直す方が早いかもしれません。`);
                  }
                }
              }}
            >
              この手順からやり直す（{redoCount(task, step.id)}件）
            </button>
          )}
          {overRedoLimit(task) && (
            <div className="muted" style={{ marginTop: 4 }}>
              ※ この仕事は{REDO_LIMIT}回やり直しています。
            </div>
          )}
        </>
      )}
      {msg && <div className="muted" style={{ marginTop: 4 }}>{msg}</div>}
    </div>
  );
}

/**
 * 社内への共有（新規）。**書く場所を作っただけでは誰も書かない。**
 * 共有が書かれるまで、台帳ではこの仕事は「確認待ち」のままになる。
 * ただし逃げ道は必ず残す（「共有なしでよい」）——押しても何も起きない
 * 行き止まりを作らないのと同じ理由で、抜けられない関門も作らない。
 */
function ShareCard({ task, store, go }) {
  const require = store.settings.requireShare !== false;
  const need = needsShare(task, require);
  const [text, setText] = useState('');
  if (task.status !== 'done') return null;

  if (!need) {
    if (!task.shared) return null;
    return (
      <Card glyph="◈" title="社内へ共有しました">
        <p className="muted" style={{ marginTop: -6, marginBottom: 0 }}>{task.shared}</p>
        <button type="button" className="btn ghost small" style={{ marginTop: 8 }} onClick={() => go('team')}>
          掲示板を見る
        </button>
      </Card>
    );
  }

  return (
    <Card glyph="◈" title="社内へ共有する1行を書いてください">
      <p className="muted" style={{ marginTop: -6 }}>
        この仕事から、<strong style={{ color: '#fff' }}>他の社員が知っておくとよいこと</strong>を1行だけ。
        掲示板に載り、次に動く社員が必ず読みます。書くまで台帳では「確認待ち」のままです。
      </p>
      <div className="btn-row" style={{ marginBottom: 6 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          value={text}
          placeholder="例：この分野の統計は2024年版が最新。古い数字に注意。"
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="button"
          className="btn primary"
          disabled={!text.trim()}
          onClick={() => {
            store.shareTask(task.id, text);
            setText('');
          }}
        >
          共有する
        </button>
      </div>
      <button type="button" className="btn ghost small" onClick={() => store.shareTask(task.id, '', true)}>
        この仕事は共有なしでよい
      </button>
    </Card>
  );
}
