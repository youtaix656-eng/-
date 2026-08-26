// 仕事の進行と成果。誰が何をしたか、どのエンジンで、いくらかかったかを全部見せる。

import { useState } from 'react';
import { Card, Doc, Empty, Bar, SectionTitle, Field } from './ui.jsx';
import { TASK_STATUS, taskProgress, nextStep, assembleResult, isRunnable, finalOutput } from '../lib/workflow.js';
import { roleById } from '../data/roles.js';
import { relTime, usd } from '../lib/format.js';
import { useAllTasks } from './useAllTasks.js';
import { openDecisions } from '../lib/decisions.js';
import { checkPromises } from '../lib/guard.js';
import { parseSections, OUTPUT_SECTIONS, sectionByKey } from '../lib/outline.js';
import { ticketOf, dueStateOf, DUE_LABELS } from '../lib/ledger.js';
import { checkSummary } from '../lib/checks.js';
import { similarOpenings } from '../lib/opening.js';

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
          <PromiseWarning text={deliverable} />
          <SameOpeningWarning task={task} store={store} go={go} />
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
              <button type="button" className="btn small primary" onClick={() => store.resumeTask(task.id)}>
                保留を解く
              </button>
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

/** 外へ出す前に、約束になっている表現を知らせる（止めはしない）。 */
function PromiseWarning({ text }) {
  const hits = checkPromises(text);
  if (!hits.length) return null;
  return (
    <Card glyph="⚠" title="外へ出す前に確かめてください">
      <p className="muted" style={{ marginTop: -6 }}>
        この文章には「約束」になる表現が {hits.length} か所あります。
        価格・納期・効果の確約は、AIではなくあなたが引き受けるところです。
      </p>
      <div className="chips">
        {hits.map((h) => (
          <span key={`${h.label}:${h.phrase}`} className="chip">
            {h.phrase}（{h.label}）
          </span>
        ))}
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

/** 書き出しが過去の成果物とそっくりでないか（AIは呼ばない）。 */
function SameOpeningWarning({ task, store, go }) {
  // **比べるものをそろえる。** 知識の body は全手順を連ねた文なので、
  // その書き出しは「最初の手順」の冒頭。こちらも同じ形で取り出さないと、
  // 別の層どうしを比べることになり、本当に似ているものを見落とす。
  const text = assembleResult(task);
  const past = (store.knowledge || [])
    .filter((k) => k.taskId && k.taskId !== task.id && k.body)
    .slice(0, 30)
    .map((k) => ({ id: k.id, title: k.title, text: k.body }));
  const hits = similarOpenings(text, past);
  if (!hits.length) return null;
  return (
    <Card glyph="≡" title="書き出しが前のものとそっくりです">
      <p className="muted" style={{ marginTop: -6 }}>
        中身は違っても、入口が同じだと読み手には同じものに見えます。冒頭だけ変えると効きます。
      </p>
      {hits.map((h) => (
        <button
          key={h.id}
          type="button"
          className="btn ghost small block"
          style={{ marginBottom: 6 }}
          onClick={() => go('knowledgeDetail', h.id)}
        >
          {h.title}（{Math.round(h.score * 100)}% 一致）
        </button>
      ))}
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
