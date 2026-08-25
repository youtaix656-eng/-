// 仕事の進行と成果。誰が何をしたか、どのエンジンで、いくらかかったかを全部見せる。

import { useState } from 'react';
import { Card, Doc, Empty, Bar, SectionTitle, Field } from './ui.jsx';
import { TASK_STATUS, taskProgress, nextStep } from '../lib/workflow.js';
import { roleById } from '../data/roles.js';
import { relTime, usd } from '../lib/format.js';

export default function TaskDetail({ store, taskId, go }) {
  const task = store.tasks.find((t) => t.id === taskId);
  const [followUp, setFollowUp] = useState('');
  const [open, setOpen] = useState({});

  if (!task) return <div className="screen"><Empty>仕事が見つかりません。</Empty></div>;

  const busy = store.busy && store.busy.taskId === task.id;
  const pending = nextStep(task);
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
      </Card>

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

      {pending && task.status !== 'awaiting_approval' && (
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

      {task.status === 'done' && (
        <>
          <SectionTitle>会社としての提出物</SectionTitle>
          <Card>
            <Doc text={task.result?.text || ''} />
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  navigator.clipboard?.writeText(task.result?.text || '');
                }}
              >
                コピー
              </button>
              {knowledge[0] && (
                <button type="button" className="btn small" onClick={() => go('knowledgeDetail', knowledge[0].id)}>
                  知識として見る
                </button>
              )}
            </div>
          </Card>

          {knowledge.length > 0 && (
            <p className="muted">
              ◉ この成果は会社の知識になりました。次の仕事で自動的に材料として使われます。
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
                  context: `前の仕事「${task.title}」の結果を踏まえてください。\n\n${(task.result?.text || '').slice(0, 3000)}`,
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
