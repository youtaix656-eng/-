import { useState } from 'react';
import { actions } from '../lib/useStore.js';
import { ScaleInput } from './ScaleInput.js';
import { RelapseForm } from './HomeView.js';
import { addDaysKey, formatDateTime, todayKey } from '../lib/date.js';
import { filledDays } from '../lib/analysis.js';
import { TRIGGERS } from '../data/triggers.js';
import type { AppState, DateKey } from '../types/index.js';

// 記録＝気分・エネルギーの5段階と、その日の気づき。
// ⚠ 空いた日を責めない：埋まり具合は出すが「◯日連続で書けていません」とは言わない。

export function RecordView({ state, now }: { state: AppState; now: number }) {
  const [date, setDate] = useState<DateKey>(() => todayKey(now));
  const [showRelapse, setShowRelapse] = useState(false);
  const rec = state.days[date];
  const fill = filledDays(state, now, 14);

  return (
    <div>
      <h2 className="view-title">記録</h2>

      <div className="card">
        <div className="cal-head">
          <button className="ghost" onClick={() => setDate(addDaysKey(date, -1))} aria-label="前の日">←</button>
          <strong>{date}</strong>
          <button
            className="ghost"
            onClick={() => setDate(addDaysKey(date, 1))}
            aria-label="次の日"
            disabled={date >= todayKey(now)}
          >
            →
          </button>
        </div>
        {date !== todayKey(now) && (
          <button className="ghost" style={{ marginTop: 8 }} onClick={() => setDate(todayKey(now))}>
            今日に戻る
          </button>
        )}

        <ScaleInput label="体調" low="つらい" high="よい" value={rec?.body ?? null} onChange={(v) => actions.setScale(date, 'body', v)} />
        <ScaleInput label="集中力" low="散らかる" high="続く" value={rec?.focus ?? null} onChange={(v) => actions.setScale(date, 'focus', v)} />
        <ScaleInput label="気分" low="重い" high="軽い" value={rec?.mood ?? null} onChange={(v) => actions.setScale(date, 'mood', v)} />
        <p className="small">同じ数字をもう一度押すと、未入力に戻せます。入れなかった項目は「0」ではなく「答えていない」として扱います。</p>

        <label htmlFor="journal">今日の気づき</label>
        <textarea
          id="journal"
          value={rec?.journal ?? ''}
          onChange={(e) => actions.setJournal(date, e.target.value)}
          placeholder="何があったか、どう感じたか。うまく書こうとしなくてかまいません。"
        />
        <p className="small">書いたそばから端末の中に保存されます（どこへも送られません）。</p>
        {rec && (
          <button className="ghost danger" onClick={() => actions.clearDay(date)}>
            この日の記録を消す
          </button>
        )}
      </div>

      <div className="card">
        <h3>この2週間</h3>
        <p className="small">
          {fill.total}日のうち {fill.filled}日ぶんの記録があります。空いている日は「まだ書いていない日」です。
        </p>
      </div>

      <div className="card">
        <h3>リラプスの記録</h3>
        {showRelapse ? (
          <RelapseForm onDone={() => setShowRelapse(false)} />
        ) : (
          <button className="danger wide" onClick={() => setShowRelapse(true)}>リラプスを記録する</button>
        )}
        {state.relapses.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {[...state.relapses]
              .sort((a, b) => b.at - a.at)
              .slice(0, 10)
              .map((r) => (
                <div key={r.id} className="list-item">
                  <div className="small">{formatDateTime(r.at)}</div>
                  {r.triggers.length > 0 && (
                    <div className="small">
                      {r.triggers.map((t) => TRIGGERS.find((x) => x.id === t)?.label ?? t).join('・')}
                    </div>
                  )}
                  {r.note && <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{r.note}</div>}
                  <button className="ghost" onClick={() => actions.deleteRelapse(r.id)}>この記録を消す</button>
                </div>
              ))}
            {state.relapses.length > 10 && <p className="small">※ 新しい10件だけ表示しています。</p>}
          </div>
        )}
      </div>

      <div className="card">
        <h3>ジャーナルのふりかえり</h3>
        <Timeline state={state} />
      </div>
    </div>
  );
}

function Timeline({ state }: { state: AppState }) {
  const [limit, setLimit] = useState(10);
  const list = Object.values(state.days)
    .filter((d) => d.journal.trim().length > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  if (list.length === 0) return <p className="small">まだ気づきの記録はありません。</p>;
  return (
    <div>
      {list.slice(0, limit).map((d) => (
        <div key={d.date} className="list-item">
          <div className="small">{d.date}</div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{d.journal}</div>
        </div>
      ))}
      {list.length > limit && (
        <button className="ghost" onClick={() => setLimit((n) => n + 20)}>
          もっと見る（残り{list.length - limit}件）
        </button>
      )}
    </div>
  );
}
