// 承認待ち。重要な操作は必ずここを通る（最終決定はユーザー）。

import { Card, Empty, SectionTitle } from './ui.jsx';
import { relTime } from '../lib/format.js';
import { REQUIRE_APPROVAL } from '../lib/permissions.js';
import { openDecisions } from '../lib/decisions.js';
import { useAllTasks } from './useAllTasks.js';
import { estimateRun, estimateLine, remainingThisMonth } from '../lib/estimate.js';
import { spentTodayOf, dailyCap } from '../lib/permissions.js';
import { usd } from '../lib/format.js';

/**
 * 承認する前に「およそいくらか」と「上限まであといくらか」を出す。
 * 押してから金額が分かるのでは、止める判断ができない。
 */
function CostNote({ approval, store }) {
  const task = approval.taskId ? store.tasks.find((t) => t.id === approval.taskId) : null;
  const steps = task ? (task.steps || []).filter((x) => x.status !== 'done') : [];
  const est = steps.length
    ? estimateRun({
        steps,
        employeeFor: (roleId) => store.employees.find((e) => e.roleId === roleId) || null,
        secrets: store.secrets,
        settings: { ...store.settings, costMode: (task && task.costMode) || store.settings.costMode },
        request: task ? task.request : '',
      })
    : null;
  const left = remainingThisMonth(store.settings);
  const today = spentTodayOf(store.settings);
  const dcap = dailyCap(store.settings);
  const line = est ? estimateLine(est) : '';
  if (!line && left === null) return null;
  return (
    <p className="muted" style={{ fontSize: 12 }}>
      {line ? `¥ ${line}　` : ''}
      {left === null ? '今月の上限は決めていません' : `今月の残り ${usd(left)}`}
      {dcap > 0 ? `／今日は ${usd(today)} 使用（上限 $${dcap}）` : ''}
    </p>
  );
}

export default function Approvals({ store, go }) {
  // 判断待ちは古い仕事にも残るので、ここでは全部の仕事を見る
  useAllTasks(store);
  const pending = store.approvals.filter((a) => a.status === 'pending');
  // 成果物の中身についての判断（実行前の承認とは別の層）。
  // 承認＝実行してよいか／判断＝出てきたものをどうするか。
  const judging = store.tasks
    .map((t) => ({ task: t, items: openDecisions(t) }))
    .filter((x) => x.items.length);
  const decided = store.approvals.filter((a) => a.status !== 'pending').slice(0, 12);

  return (
    <div className="screen fade-in">
      <Card glyph="⚖" title="最終決定はあなたです">
        <p className="muted" style={{ marginTop: -6, marginBottom: 0 }}>
          AI社員は調査・分析・提案までを担当します。
          送信・削除・購入・外部公開、そして費用の発生する実行は、
          あなたが承認するまで実行されません。
        </p>
      </Card>

      {judging.length > 0 && (
        <>
          <SectionTitle>あなたの判断が要ること {judging.reduce((n, x) => n + x.items.length, 0)}件</SectionTitle>
          <p className="muted" style={{ marginTop: -6 }}>
            こちらは「実行してよいか」ではなく、
            <strong style={{ color: '#fff' }}>出てきた成果物をどうするか</strong>です。
            仕事の画面で1件ずつ決められます。
          </p>
          {judging.slice(0, 8).map(({ task, items }) => (
            <button key={task.id} type="button" className="row" onClick={() => go('task', task.id)}>
              <span className="g">⚖</span>
              <span className="body">
                <span className="t">{task.title}</span>
                <span className="s">{items[0].text}{items.length > 1 ? `　ほか${items.length - 1}件` : ''}</span>
              </span>
              <span className="arrow">›</span>
            </button>
          ))}
        </>
      )}

      <SectionTitle>承認待ち {pending.length}件</SectionTitle>
      {pending.length ? (
        pending.map((a) => {
          const emp = store.employees.find((e) => e.id === a.employeeId);
          const rule = REQUIRE_APPROVAL[a.action];
          return (
            <Card key={a.id}>
              <div className="muted" style={{ marginTop: -4 }}>
                {relTime(a.createdAt)}・{rule?.label || a.action}
                {a.risk === 'high' && <span className="badge warn" style={{ marginLeft: 6 }}>要注意</span>}
              </div>
              <p style={{ fontSize: 14.5 }}>{a.label}</p>
              {emp && <p className="muted">依頼者：{emp.name}</p>}
              {a.action === 'costly' && <CostNote approval={a} store={store} />}
              <div className="btn-row">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => {
                    // 承認したら仕事の画面へ移る。ここに留まると、実行が
                    // 始まっているのに何も起きていないように見える（項目27）。
                    if (a.taskId) go('task', a.taskId);
                    else if (a.meetingId) go('meetingDetail', a.meetingId);
                    store.decideApproval(a.id, true);
                  }}
                >
                  承認して実行
                </button>
                <button type="button" className="btn" onClick={() => store.decideApproval(a.id, false)}>
                  却下する
                </button>
                {a.taskId && (
                  <button type="button" className="btn ghost" onClick={() => go('task', a.taskId)}>
                    内容を見る
                  </button>
                )}
              </div>
            </Card>
          );
        })
      ) : (
        <Empty>承認待ちはありません。</Empty>
      )}

      <Card glyph="⚙" title="毎回の確認を省く">
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14 }}>
          <input
            type="checkbox"
            checked={Boolean(store.settings.autoApproveCost)}
            onChange={(e) => store.updateSettings({ autoApproveCost: e.target.checked })}
            style={{ marginTop: 4 }}
          />
          <span>
            費用の発生する実行を自動で承認する
            <div className="muted">
              送信・削除・購入は、この設定に関わらず必ず確認します。
            </div>
          </span>
        </label>
      </Card>

      {decided.length > 0 && (
        <>
          <SectionTitle>過去の判断</SectionTitle>
          {decided.map((a) => (
            <div key={a.id} className="muted" style={{ padding: '3px 0' }}>
              {relTime(a.decidedAt)}・{a.status === 'granted' ? '承認' : '却下'}：{a.label}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
