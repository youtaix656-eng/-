// オフィスの様子。**録画ではなく、いまの状態から毎回描いている。**
//
// 動いて見えるのは、本当にその人の手順が走っている社員だけ
// （`lib/presence.js` → `lib/office.js`）。誰も動いていない時は誰も動かない。
//
// 決まりごと：
//  ・**AIを呼ばない・通信しない。**
//  ・**画像・動画ファイルを持たない**（肖像と同じ線。その場でSVGを描く）。
//  ・**動きは CSS のアニメーションでやる**（JSの毎フレーム描き直しをしない）。
//    18人ぶんを毎フレーム React で描き直すと、それだけで画面が重くなる。
//  ・**`will-change`／`backdrop-filter` を付けない**（新項目19）。
//  ・**動きを止めたい人のために止める**（`prefers-reduced-motion`）。

import { useEffect, useMemo, useState } from 'react';
import { Card, SectionTitle, Empty } from './ui.jsx';
import { buildPresence } from '../lib/presence.js';
import {
  officeLayout, officeLine, officeLegend, seatCaption, runningSeconds,
  SEAT_W, SEAT_H, SEAT_LOOKS,
} from '../lib/office.js';
import { ROLE_GROUPS, roleById } from '../data/roles.js';
import { useAllTasks } from './useAllTasks.js';

const groupOf = (roleId) => (roleById(roleId) || {}).group || 'knowledge';

export default function Office({ store, go }) {
  // 席に着いているかは古い仕事にも左右されるので、全部の仕事を見る
  useAllTasks(store);
  const [picked, setPicked] = useState(null);

  const rows = useMemo(
    () => buildPresence(store.activeEmployees || [], store.tasks || []),
    [store.activeEmployees, store.tasks]
  );
  const layout = useMemo(() => officeLayout(rows, ROLE_GROUPS, groupOf), [rows]);
  const legend = useMemo(() => officeLegend(rows), [rows]);

  return (
    <div className="screen fade-in">
      <SectionTitle>オフィスの様子</SectionTitle>
      <Card className="tight">
        <p className="muted" style={{ marginTop: 0 }}>
          {officeLine(rows, store.hydrated)}
        </p>
        <p className="muted" style={{ fontSize: 11.5 }}>
          これは<strong style={{ color: '#fff' }}>録画ではありません</strong>。
          いまの状態からその場で描いているので、
          <strong style={{ color: '#fff' }}>手が動いて見える人は、本当にAIが動いている人だけ</strong>です。
        </p>
        {/* 凡例。**色だけに意味を持たせない**——印（記号）と名前と人数を必ず一緒に出す。
            0人の状態も残す（色の見分け方そのものを読むための表なので、空箱ではない）。 */}
        <div className="chips" style={{ marginTop: 8 }}>
          {legend.map((l) => (
            <span
              key={l.id}
              className={`chip office-key${l.count ? '' : ' off'}`}
              title={l.moving ? 'この色の席だけが動きます' : '動きません'}
            >
              <i className="office-dot" style={{ background: l.color }} aria-hidden="true" />
              {l.glyph} {l.name} {l.count}
            </span>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 11.5, marginBottom: 0 }}>
          色は状態の色分けです。
          <strong style={{ color: SEAT_LOOKS.running.color }}>緑＝いま手が動いている（実行中）</strong>
          で、動くのはこの色の席だけ。ほかの色は止まっている理由の違いです。
        </p>
      </Card>

      {layout.counted === 0 ? (
        <Empty>まだ社員がいません。雇うと席に着きます。</Empty>
      ) : (
        layout.islands.map((island) => (
          <div key={island.id} style={{ marginTop: 14 }}>
            <div className="toc-head">
              {island.name}
              <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>{island.seats.length}席</span>
            </div>
            <div className="office-scroll">
              <svg
                className="office-floor"
                viewBox={`0 0 ${island.cols * SEAT_W} ${island.rows * SEAT_H}`}
                width={island.cols * SEAT_W}
                height={island.rows * SEAT_H}
                role="img"
                aria-label={`${island.name}の席。${island.seats.length}人。`}
              >
                <Desks cols={island.cols} rows={island.rows} />
                {island.seats.map((s) => (
                  <Seat key={s.id} seat={s} onPick={() => setPicked(s)} />
                ))}
              </svg>
            </div>
          </div>
        ))
      )}

      {layout.hidden > 0 && (
        <p className="muted" style={{ fontSize: 11.5 }}>
          席は {layout.counted} 人まで描いています（あと {layout.hidden} 人は社員の画面で見られます）。
        </p>
      )}

      {picked && <SeatSheet seat={picked} go={go} onClose={() => setPicked(null)} />}
    </div>
  );
}

/** 机（島の天板）。線だけで描く——画像ファイルを持たない。 */
function Desks({ cols, rows }) {
  const out = [];
  for (let r = 0; r < rows; r += 1) {
    const y = r * SEAT_H + SEAT_H - 22;
    out.push(
      <line
        key={`d${r}`}
        x1={6}
        y1={y}
        x2={cols * SEAT_W - 6}
        y2={y}
        stroke="currentColor"
        strokeOpacity="0.28"
        strokeWidth="1"
      />
    );
  }
  return <g>{out}</g>;
}

/**
 * 席1つ。頭・肩・腕・画面を線で描く。
 * **動くのは `moving` の人だけ**——CSS のアニメーション名で出し分ける。
 */
function Seat({ seat, onPick }) {
  const cx = seat.x + SEAT_W / 2;
  const top = seat.y + 10;
  // 揺れの位相を社員ごとにずらす（全員が同じ拍で動くと機械に見える）
  const delay = `${(seat.phase * -1.6).toFixed(2)}s`;

  return (
    <g
      className={`office-seat office-${seat.motion}${seat.moving ? ' office-live' : ''}`}
      style={{ animationDelay: delay, color: seat.color }}
      transform={`translate(${seat.x}, ${seat.y})`}
      onClick={onPick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPick(); }}
      aria-label={`${seat.employee.shortName || seat.employee.name}：${seatCaption(seat)}`}
    >
      {/* **当たり判定。** 線だけだと線の上しか押せず、指では実質押せない
          （実際に踏んだ）。席1つぶんを透明な面で覆って、どこを押しても開くようにする。 */}
      <rect x="2" y="2" width={SEAT_W - 4} height={SEAT_H - 4} fill="transparent" />
      {/* 画面（動いている時だけ、うっすら明滅する） */}
      <rect className="office-mon" x={SEAT_W / 2 - 17} y={SEAT_H - 34} width="34" height="16" rx="2"
        fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
      {/* 頭 */}
      <circle className="office-head" cx={SEAT_W / 2} cy={22} r="9"
        fill="none" stroke="currentColor" strokeOpacity="0.9" strokeWidth="1.2" />
      {/* 肩 */}
      <path className="office-body" d={`M ${SEAT_W / 2 - 16} ${SEAT_H - 36} q 16 -12 32 0`}
        fill="none" stroke="currentColor" strokeOpacity="0.75" strokeWidth="1.2" />
      {/* 腕（左右で別に動かす＝タイピングに見える） */}
      <path className="office-arm office-arm-l" d={`M ${SEAT_W / 2 - 14} ${SEAT_H - 34} l -5 9`}
        fill="none" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.1" />
      <path className="office-arm office-arm-r" d={`M ${SEAT_W / 2 + 14} ${SEAT_H - 34} l 5 9`}
        fill="none" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1.1" />
      {/* 動いている印。**動いている席にだけ出す**——ここが点滅していたら、
          本当にその人の手順が走っている（録画ではない）。 */}
      {seat.moving && (
        <circle className="office-live-dot" cx={SEAT_W / 2 + 20} cy={16} r="3"
          fill="currentColor" />
      )}
      {/* 名前 */}
      <text className="office-name" x={SEAT_W / 2} y={SEAT_H - 6} textAnchor="middle"
        fill="currentColor" fillOpacity={seat.moving ? 1 : 0.65} fontSize="9">
        {(seat.employee.shortName || seat.employee.name || '').slice(0, 5)}
      </text>
      {/* 担当している仕事。**動いている人にだけ書く**（動いていない人に作業内容を書かない）。 */}
      {seat.moving && seat.taskTitle && (
        <text className="office-task" x={SEAT_W / 2} y={9} textAnchor="middle"
          fill="currentColor" fillOpacity="0.8" fontSize="7.5">
          {seat.taskTitle.slice(0, 9)}
        </text>
      )}
      {/* 状態の印（動いていない人にだけ出す＝動きの無い理由が読める） */}
      {!seat.moving && (
        <text x={cx - seat.x + 20} y={16} textAnchor="middle"
          fill="currentColor" fillOpacity="0.8" fontSize="10">
          {seat.state === 'waiting' ? '⚖' : seat.state === 'stopped' ? '⚠' : seat.state === 'held' ? '‖' : seat.state === 'queued' ? '…' : ''}
        </text>
      )}
    </g>
  );
}

/** 席を押した時の中身。**動いていない人に作業内容を書かない。** */
function SeatSheet({ seat, go, onClose }) {
  // 経過秒だけは進む。**この1か所だけを1秒ごとに描き直す**
  //（画面ぜんぶを毎秒描き直すと、席が増えるほど重くなる）。
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!seat.moving) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [seat.moving]);
  const sec = runningSeconds(seat, now);
  const role = roleById(seat.employee.roleId);

  return (
    <div className="sheet-bg" onClick={onClose} role="presentation">
      <div className="sheet fade-in" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2>{seat.employee.shortName || seat.employee.name}</h2>
        <p className="muted" style={{ marginTop: -6 }}>
          {role ? `${role.glyph} ${role.name}` : ''}
          {seat.employee.genreName ? ` ／ ${seat.employee.genreName}` : ''}
        </p>
        <p style={{ fontSize: 14 }}>{seatCaption(seat)}</p>
        {sec !== null && (
          <p className="muted" style={{ fontSize: 12.5 }}>いま {sec} 秒 動いています。</p>
        )}
        {seat.task && (
          <button type="button" className="btn block" onClick={() => { onClose(); go('task', seat.task.id); }}>
            この仕事をひらく
          </button>
        )}
        <button type="button" className="btn block" onClick={() => { onClose(); go('employee', seat.employee.id); }}>
          この社員をひらく
        </button>
        <button type="button" className="btn ghost block" onClick={onClose} style={{ marginTop: 8 }}>
          閉じる
        </button>
      </div>
    </div>
  );
}
