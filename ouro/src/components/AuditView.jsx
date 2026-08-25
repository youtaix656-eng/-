// Audit Log。社員の操作をすべて残す（追記のみ・端末内のみ）。

import { useState } from 'react';
import { Card, Empty, SectionTitle } from './ui.jsx';
import { actionLabel, totalCost } from '../lib/audit.js';
import { relTime, usd } from '../lib/format.js';

export default function AuditView({ store }) {
  const [filter, setFilter] = useState('all');
  // 新項目09：起動時は新しいぶんだけ読んでいる。古いぶんはここで読み足す。
  const [loadingAll, setLoadingAll] = useState(false);
  const [partial, setPartial] = useState(store.auditPartial);

  const readAll = async () => {
    setLoadingAll(true);
    try {
      await store.loadAllAudit();
      setPartial(false);
    } finally {
      setLoadingAll(false);
    }
  };
  const list = store.audit
    .slice()
    .reverse()
    .filter((e) => (filter === 'all' ? true : filter === 'cost' ? (e.cost || 0) > 0 : e.actor === 'user'));

  return (
    <div className="screen fade-in">
      <Card glyph="▤" title="操作履歴">
        <p className="muted" style={{ marginTop: -6, marginBottom: 8 }}>
          AI社員とあなたの操作をすべて記録しています。書き換えはせず、追記だけを行います。
          この記録は端末の外に出ません。
        </p>
        <div className="muted">
          {partial ? '直近' : '累計'} {store.audit.length} 件・AI費用 {usd(totalCost(store.audit))}
        </div>
        {partial && (
          <>
            <p className="muted" style={{ marginTop: 6 }}>
              起動を速くするため、いまは新しいぶんだけを読み込んでいます。
              30日より古い記録は日ごとに1件へまとめてあります（件数と費用は残ります）。
            </p>
            <button type="button" className="btn ghost small" disabled={loadingAll} onClick={readAll}>
              {loadingAll ? '読み込み中…' : '古い記録もすべて読み込む'}
            </button>
          </>
        )}
      </Card>

      <div className="chips" style={{ marginBottom: 12 }}>
        {[
          ['all', 'すべて'],
          ['user', 'あなたの操作'],
          ['cost', '費用が発生したもの'],
        ].map(([id, label]) => (
          <button key={id} type="button" className={`chip ${filter === id ? 'on' : ''}`} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      <SectionTitle>{list.length}件</SectionTitle>
      {list.length ? (
        list.slice(0, 200).map((e) => {
          const emp = store.employees.find((x) => x.id === e.actor);
          return (
            <div key={e.id} className="card tight" style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 13.5 }}>
                <span className="dim">{emp ? emp.shortName : 'あなた'}</span>
                {' が '}
                {actionLabel(e.action)}
                {e.target ? `：${e.target}` : ''}
              </div>
              <div className="muted">
                {relTime(e.at)}
                {e.detail && `・${e.detail}`}
                {e.cost > 0 && `・${usd(e.cost)}`}
              </div>
            </div>
          );
        })
      ) : (
        <Empty>記録がありません。</Empty>
      )}
    </div>
  );
}
