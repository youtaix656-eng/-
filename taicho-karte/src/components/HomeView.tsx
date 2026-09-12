import { useMemo } from 'react';
import { regionFullLabel, regionLabel } from '../data/bodyRegions.js';
import { effectDef } from '../data/effects.js';
import type { CareRecord, SymptomRecord } from '../types/index.js';
import { latestSymptoms, recentSummary } from '../lib/summary.js';
import { formatDate, formatDateTime } from '../lib/date.js';

interface Props {
  symptoms: readonly SymptomRecord[];
  cares: readonly CareRecord[];
  onNewSymptom: () => void;
  onNewCare: () => void;
  onGoSymptoms: () => void;
  onGoCares: () => void;
}

export function HomeView({ symptoms, cares, onNewSymptom, onNewCare, onGoSymptoms, onGoCares }: Props) {
  const week = useMemo(() => recentSummary(symptoms, cares, 7), [symptoms, cares]);
  const month = useMemo(() => recentSummary(symptoms, cares, 30), [symptoms, cares]);
  const latest = useMemo(() => latestSymptoms(symptoms, 3), [symptoms]);
  const latestCares = useMemo(() => [...cares].sort((a, b) => b.at - a.at).slice(0, 3), [cares]);

  return (
    <div>
      <h2 className="view-title">今日の記録</h2>
      <div className="big-btns">
        <button type="button" className="btn primary big" onClick={onNewSymptom}>症状を記録</button>
        <button type="button" className="btn big" onClick={onNewCare}>対応策を記録</button>
      </div>

      <div className="card">
        <h3>直近7日</h3>
        <div className="stat-row">
          <div className="stat"><div className="v">{week.symptomCount}</div><div className="k">症状の記録</div></div>
          <div className="stat"><div className="v">{week.recordedDays}</div><div className="k">記録した日</div></div>
          <div className="stat"><div className="v">{week.careCount}</div><div className="k">対応策</div></div>
          <div className="stat"><div className="v">{week.helpedCount}</div><div className="k">軽減・改善</div></div>
        </div>
        {week.vasRange && <p className="small">VAS の幅：{week.vasRange.min}〜{week.vasRange.max}（平均は出しません。1と9が1回ずつの平均5は「中くらいが2回」ではないため）</p>}
        {week.byRegion.length > 0 && (
          <p className="small">多い部位：{week.byRegion.slice(0, 3).map((b) => `${regionLabel(b.regionId)} ${b.count}回`).join(' ／ ')}</p>
        )}
        {week.symptomCount === 0 && <p className="small">この7日はまだ記録がありません。</p>}
      </div>

      <div className="card">
        <h3>直近30日</h3>
        <p className="small">症状 {month.symptomCount} 件（{month.recordedDays} 日）・対応策 {month.careCount} 件（うち軽減・改善 {month.helpedCount} 件）</p>
        {month.byRegion.length > 0 && (
          <ul className="bars" aria-label="部位別の件数（30日）">
            {month.byRegion.slice(0, 6).map((b) => (
              <li key={b.regionId}>
                <span className="bar-label">{regionLabel(b.regionId)}</span>
                <span className="bar" style={{ width: `${Math.round((b.count / month.byRegion[0].count) * 100)}%` }} />
                <span className="bar-n">{b.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>最近の症状</h3>
        {latest.length === 0 ? <p className="small">まだ記録がありません。上の「症状を記録」から始められます。</p> : (
          <ul className="sub-list">
            {latest.map((s) => (
              <li key={s.id}><span className="vas-badge small">{s.vas}</span> {regionFullLabel(s.regionId, s.side)} <small>{formatDateTime(s.at)}</small></li>
            ))}
          </ul>
        )}
        <button type="button" className="btn small-btn" onClick={onGoSymptoms}>一覧・検索へ</button>
      </div>

      <div className="card">
        <h3>最近の対応策</h3>
        {latestCares.length === 0 ? <p className="small">まだ記録がありません。</p> : (
          <ul className="sub-list">
            {latestCares.map((c) => (
              <li key={c.id}><span className={`eff eff-${c.effect}`}>{effectDef(c.effect).mark}</span> {c.content} <small>{formatDate(c.date)}</small></li>
            ))}
          </ul>
        )}
        <button type="button" className="btn small-btn" onClick={onGoCares}>効果順で見る</button>
      </div>

      <p className="note">これは自分のための主観的な記録です。診断ではなく、痛みが強い・長引く・しびれや脱力を伴うときは医療機関へ相談してください。</p>
    </div>
  );
}
