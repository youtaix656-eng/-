// 承認待ち。重要な操作は必ずここを通る（最終決定はユーザー）。

import { Card, Empty, SectionTitle } from './ui.jsx';
import { relTime } from '../lib/format.js';
import { REQUIRE_APPROVAL } from '../lib/permissions.js';

export default function Approvals({ store, go }) {
  const pending = store.approvals.filter((a) => a.status === 'pending');
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
              <div className="btn-row">
                <button type="button" className="btn primary" onClick={() => store.decideApproval(a.id, true)}>
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
