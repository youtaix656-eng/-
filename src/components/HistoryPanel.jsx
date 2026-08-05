import { useRef } from 'react';

// 直近の閲覧履歴パネル（ホーム右上から開く）
//  - 横スライドで1件ずつ履歴を確認できる
//  - カードをダブルタップするとその画面へ飛べる
//  - 各カードに 日付・時間・曜日・タイトル・ジャンル を表示

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

function fmt(at) {
  const d = new Date(at);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return { date: `${y}/${m}/${day}`, time: `${hh}:${mm}`, week: WEEK[d.getDay()] };
}

export default function HistoryPanel({ activity, onClose, onJump, onClear }) {
  // ダブルタップ検出（スマホでも確実に拾えるよう自前で判定）
  const lastTap = useRef({ id: null, t: 0 });
  const handleTap = (entry) => {
    const now = Date.now();
    if (lastTap.current.id === entry.id && now - lastTap.current.t < 350) {
      lastTap.current = { id: null, t: 0 };
      onJump(entry);
    } else {
      lastTap.current = { id: entry.id, t: now };
    }
  };

  return (
    <div className="hist-overlay" onClick={onClose}>
      <div className="hist-panel" onClick={(e) => e.stopPropagation()}>
        <div className="hist-head">
          <span className="hist-title">🕘 直近の履歴</span>
          <div className="hist-head-actions">
            {activity.length > 0 && (
              <button className="btn ghost sm" onClick={onClear} aria-label="履歴をすべて消す">消去</button>
            )}
            <button className="hist-close" onClick={onClose} aria-label="閉じる">✕</button>
          </div>
        </div>

        {activity.length === 0 ? (
          <div className="hist-empty">まだ履歴がありません。<br />各画面を開くとここに記録されます。</div>
        ) : (
          <>
            <div className="hist-hint">← 横にスライドで確認／カードを<strong>ダブルタップ</strong>で開く →</div>
            <div className="hist-track">
              {activity.map((e) => {
                const f = fmt(e.at);
                return (
                  <button
                    key={e.id}
                    className="hist-card"
                    onClick={() => handleTap(e)}
                    aria-label={`${e.title}（ダブルタップで開く）`}
                  >
                    <div className="hist-when">
                      <span className="hist-date">{f.date}</span>
                      <span className="hist-week">（{f.week}）</span>
                      <span className="hist-time">{f.time}</span>
                    </div>
                    <div className="hist-card-title">{e.title || '（画面）'}</div>
                    {e.genre ? <div className="hist-genre">{e.genre}</div> : <div className="hist-genre muted">ジャンル指定なし</div>}
                    <div className="hist-jump">ダブルタップで開く →</div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
