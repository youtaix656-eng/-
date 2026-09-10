import { useMemo } from 'react';
import {
  MIN_FOR_TREND,
  dayPoints,
  distributionByDayBand,
  relapsesByBand,
  relapsesByTrigger,
  relapsesByWeekday,
  urgesByBand,
  pastStreakDays,
} from '../lib/analysis.js';
import { BarChart } from './BarChart.js';
import { TRIGGERS } from '../data/triggers.js';
import type { AppState } from '../types/index.js';

// 分析。
// ⚠ ここは**並べるまで**。矢印で結ばない・平均を出さない・順位を断定しない。
//    件数が少ないうちは「まだ傾向とは言えない」と正直に書く。

const SCALE_SHADES = ['#3a3a46', '#4d4d5c', '#6b6b7e', '#8e7cc3', '#b3a4dd'];

export function AnalyzeView({ state, now }: { state: AppState; now: number }) {
  const weekday = useMemo(() => relapsesByWeekday(state), [state]);
  const band = useMemo(() => relapsesByBand(state), [state]);
  const trig = useMemo(() => relapsesByTrigger(state), [state]);
  const urges = useMemo(() => urgesByBand(state), [state]);
  const points = useMemo(() => dayPoints(state, now), [state, now]);
  const streaks = useMemo(() => pastStreakDays(state, now), [state, now]);
  const enough = state.relapses.length >= MIN_FOR_TREND;

  return (
    <div>
      <h2 className="view-title">分析</h2>
      <div className="note">
        ここに出るのは、あなたが入れた記録を数えて並べたものだけです。
        「◯◯だからリラプスした」という原因を示すものではありません（きっかけの記録も、あなたの見立てです）。
      </div>

      <div className="card">
        <h3>リラプスの記録：曜日別</h3>
        {state.relapses.length === 0 ? (
          <p className="small">まだ記録がありません。</p>
        ) : (
          <>
            <BarChart rows={weekday} highlight={enough} />
            {!enough && <p className="small">記録が{MIN_FOR_TREND}件に満たないので、多い曜日を強調していません。</p>}
          </>
        )}
      </div>

      <div className="card">
        <h3>リラプスの記録：時間帯別</h3>
        {state.relapses.length === 0 ? (
          <p className="small">まだ記録がありません。</p>
        ) : (
          <BarChart rows={band} highlight={enough} />
        )}
      </div>

      <div className="card">
        <h3>きっかけ別</h3>
        {trig.length === 0 ? (
          <p className="small">きっかけを選んだ記録がまだありません。</p>
        ) : (
          <BarChart rows={trig.map((r) => ({ ...r, label: TRIGGERS.find((t) => t.id === r.id)?.label ?? r.id }))} highlight={enough} />
        )}
      </div>

      <div className="card">
        <h3>衝動が来た時間帯（緊急ボタンを押した回数）</h3>
        {state.urges.length === 0 ? (
          <p className="small">まだ記録がありません。</p>
        ) : (
          <BarChart rows={urges} highlight={state.urges.length >= MIN_FOR_TREND} />
        )}
        <p className="small">押した＝戻った、ではありません。押して乗り越えた回数もここに入っています。</p>
      </div>

      <div className="card">
        <h3>継続日数と、体調・集中力・気分</h3>
        <p className="small">
          継続日数の帯ごとに、5段階の答えが何件ずつあったかを並べています。
          <strong>平均は出しません</strong>（5段階は順番のある目盛りで、間隔が等しいとは限らないため）。
        </p>
        {(['body', 'focus', 'mood'] as const).map((key) => (
          <Distribution key={key} title={{ body: '体調', focus: '集中力', mood: '気分' }[key]} rows={distributionByDayBand(points, key)} />
        ))}
        <p className="small">
          日数が進むと数字が上がって見えることがありますが、それは日数のおかげとは限りません
          （季節・仕事・睡眠など、記録していないものが動いている可能性があります）。
        </p>
      </div>

      <div className="card">
        <h3>これまでの継続（古い順）</h3>
        {streaks.length === 0 ? (
          <p className="small">まだ記録がありません。</p>
        ) : (
          <StreakSpark values={streaks} />
        )}
      </div>
    </div>
  );
}

function Distribution({ title, rows }: { title: string; rows: ReturnType<typeof distributionByDayBand> }) {
  const any = rows.some((r) => r.total > 0);
  return (
    <div style={{ marginTop: 14 }}>
      <strong style={{ fontSize: 14 }}>{title}</strong>
      {!any && <p className="small">この項目の記録はまだありません。</p>}
      {any &&
        rows.map((r) => (
          <div className="dist-row" key={r.label}>
            <span className="lbl">{r.label}</span>
            <span className="dist-bar">
              {r.total > 0 &&
                r.counts.map((c, i) => (
                  <span
                    key={i}
                    className="dist-seg"
                    style={{ width: `${(c / r.total) * 100}%`, background: SCALE_SHADES[i] }}
                    title={`${i + 1}：${c}件`}
                  />
                ))}
            </span>
            <span className="n">{r.total}件</span>
          </div>
        ))}
      {any && <p className="small">左が「1」、右へ行くほど「5」。棒の長さは件数の割合です。</p>}
    </div>
  );
}

function StreakSpark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const w = 320;
  const h = 90;
  const bw = Math.max(3, Math.min(24, w / Math.max(1, values.length) - 4));
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="これまでの継続日数">
      {values.map((v, i) => {
        const x = i * (bw + 4) + 2;
        const bh = (v / max) * (h - 22);
        return (
          <g key={i}>
            <rect className={i === values.length - 1 ? 'bar hot' : 'bar'} x={x} y={h - 18 - bh} width={bw} height={Math.max(1, bh)} rx="2" />
            <text x={x + bw / 2} y={h - 4} textAnchor="middle">{v}</text>
          </g>
        );
      })}
    </svg>
  );
}
