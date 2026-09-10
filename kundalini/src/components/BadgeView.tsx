import { badgeStates } from '../lib/badges.js';
import { currentDays, longestDays } from '../lib/streak.js';
import type { AppState } from '../types/index.js';

// 実績。
// ⚠ 解放状態は保存していない（日数から毎回導く）。
// ⚠ 未解放のものを「失敗」として見せない。届いていない＝まだ、というだけ。

export function BadgeView({ state, now }: { state: AppState; now: number }) {
  const days = currentDays(state.startedAt, now);
  const longest = longestDays(state, now);
  const list = badgeStates(days, longest);

  return (
    <div>
      <h2 className="view-title">実績</h2>
      <p className="small">
        いま {days}日／最長 {longest}日。いちど届いたバッジは、あとで戻っても消えません。
      </p>
      <div className="badge-grid">
        {list.map((b) => (
          <div
            key={b.badge.id}
            className={`badge${b.currentlyHeld ? ' held' : ''}${b.unlocked ? '' : ' locked'}${b.currentlyHeld && days === b.badge.days ? ' celebrate' : ''}`}
          >
            <div className="b-days">{b.badge.days}</div>
            <div className="b-state">
              {b.currentlyHeld ? '達成中' : b.unlocked ? '到達ずみ' : `あと${b.daysLeft}日`}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>ひとこと</h3>
        {list
          .filter((b) => b.unlocked)
          .map((b) => (
            <div key={b.badge.id} className="list-item">
              <strong style={{ fontSize: 14 }}>{b.badge.title}</strong>
              <p className="small">{b.badge.word}</p>
            </div>
          ))}
        {list.every((b) => !b.unlocked) && <p className="small">まだ届いたものはありません。届いたらここに出ます。</p>}
        <p className="small">※ ここにある言葉はこのアプリの言葉で、実在の人物の引用ではありません。</p>
      </div>
    </div>
  );
}
