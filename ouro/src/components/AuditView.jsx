// Audit Log。社員の操作をすべて残す（追記のみ・端末内のみ）。

import { useState } from 'react';
import { Card, Empty, SectionTitle } from './ui.jsx';
import Window from './Window.jsx';
import { actionLabel, totalCost } from '../lib/audit.js';
import { relTime, usd } from '../lib/format.js';

export default function AuditView({ store }) {
  const [filter, setFilter] = useState('all');
  // 新項目09：起動時は新しいぶんだけ読んでいる。古いぶんはここで読み足す。
  const [loadingAll, setLoadingAll] = useState(false);
  // **その場の値を useState の初期値にしないこと。** 操作履歴は起動から1.5秒ほど
  // 遅れて読み込まれるので、早く開くと「全部読んだ」と思い込んで
  // 「すべて読み込む」が出なくなる。毎回 store を見て、読み終えた時だけ手元で覆す。
  const [readAllDone, setReadAllDone] = useState(false);
  const partial = store.auditPartial && !readAllDone;

  const readAll = async () => {
    setLoadingAll(true);
    try {
      await store.loadAllAudit();
      setReadAllDone(true);
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
      {!list.length && <Empty>記録がありません。</Empty>}
      {/* 新項目14：件数が多い時だけ「見えている範囲だけ描く」に切り替える。
          行の高さがそろっていることが前提なので、その時は文字を2行で止める。 */}
      {list.length > 0 && list.length <= WINDOW_FROM && list.map((e) => <LogRow key={e.id} e={e} store={store} />)}
      {list.length > WINDOW_FROM && (
        <Window items={list} rowHeight={ROW_H}>
          {(e) => <LogRow key={e.id} e={e} store={store} fixed />}
        </Window>
      )}
    </div>
  );
}

// 一覧をこの件数より多く出す時だけ、窓表示に切り替える
const WINDOW_FROM = 200;
// 窓表示の1行の高さ（px）。**余白まで含めた値**にすること。
// 中身の高さだけにすると、行が増えるほど実際の位置とずれて空白が出る。
// CSS の .log-row（height + margin-bottom）と必ずそろえる。
const ROW_H = 68; // = 62px + 余白6px

function LogRow({ e, store, fixed = false }) {
  const emp = store.employees.find((x) => x.id === e.actor);
  return (
    // 窓表示の時は余白も CSS 側で持つ（高さの計算を1か所にするため）
    <div className={`card tight ${fixed ? 'log-row' : ''}`} style={fixed ? undefined : { marginBottom: 6 }}>
      <div style={{ fontSize: 13.5 }} className={fixed ? 'clip1' : ''}>
        <span className="dim">{emp ? emp.shortName : 'あなた'}</span>
        {' が '}
        {actionLabel(e.action)}
        {e.target ? `：${e.target}` : ''}
      </div>
      <div className={`muted ${fixed ? 'clip1' : ''}`}>
        {relTime(e.at)}
        {e.detail && `・${e.detail}`}
        {e.cost > 0 && `・${usd(e.cost)}`}
      </div>
    </div>
  );
}
