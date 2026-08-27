// 今日やること（期限切れ・今日まで・判断待ち・止まっているもの）。
//
// **Home から切り出して後から読む。** 判定に使う lib/ledger.js は
// 台帳のビューを丸ごと組み立てるので、起動時に読む束としては重い。
// 中身は毎回 仕事から導くだけ（AIを呼ばない）。

import { Card } from './ui.jsx';
import { buildLedger, todayFocus } from '../lib/ledger.js';

export default function TodayCard({ store, go }) {
  const { tasks, deals } = store;
  const focus = todayFocus(
    buildLedger(tasks, { deals, requireShare: store.settings.requireShare !== false })
  );
  if (!focus.total) return null;

  return (
      <Card glyph="◎" title="今日やること">
        <div className="chips" style={{ marginTop: -4, marginBottom: 8 }}>
          {focus.overdue.length > 0 && <span className="chip on">期限切れ {focus.overdue.length}</span>}
          {focus.today.length > 0 && <span className="chip on">今日まで {focus.today.length}</span>}
          {focus.decisions.length > 0 && <span className="chip on">あなたの判断 {focus.decisions.length}</span>}
          {focus.stopped.length > 0 && <span className="chip on">止まっている {focus.stopped.length}</span>}
        </div>
        {/* 期限切れと判断待ちは重なりうる（同じ仕事が両方に入る）。
            そのまま並べると同じ行が2回出て件数も二重になるので、id で畳む。 */}
        {dedupeById([...focus.overdue, ...focus.today, ...focus.decisions])
          .slice(0, 3)
          .map((r) => (
          <button key={r.id} type="button" className="row" onClick={() => go('task', r.id)}>
            <span className="g">{r.decisions ? '⚖' : '⏳'}</span>
            <span className="body">
              <span className="t">{r.title}</span>
              <span className="s">
                {r.nextAction}
                {r.dueAt ? `・期限 ${new Date(r.dueAt).toLocaleDateString('ja-JP')}` : ''}
              </span>
            </span>
            <span className="arrow">›</span>
          </button>
          ))}
        <button type="button" className="btn small block" onClick={() => go('ledger')}>
          台帳で全部見る
        </button>
      </Card>
  );
}

function dedupeById(rows) {
  const seen = new Set();
  return rows.filter((r) => (seen.has(r.id) ? false : seen.add(r.id)));
}
