import React, { useMemo, useState } from 'react';
import { actions } from '../lib/useStore.js';
import CopyBox from './CopyBox.jsx';
import { buildPlan, planGaps, planMarkdown, weeklyShape } from '../lib/plan.js';
import { COGNITIVE_QUESTIONS, COGNITIVE_DISCLAIMER, SCALE, CHANNELS, ORDERS } from '../data/cognitiveQuestions.js';
import { profileLine, isUnanswered, profileOf } from '../lib/cognitive.js';
import { METHODS, EFFECT_LEVELS, sortedMethods, methodById } from '../data/methods.js';
import { PHASE_META } from '../lib/schedule.js';

// 計画の画面：①期間 ②認知特性 ③勉強法 ④計画書
// **同じ本文を2か所に持たない**——計画書の本文は lib/plan.js の planMarkdown だけが作る。

export default function Plan({ state, go }) {
  const plan = useMemo(() => buildPlan(state), [state]);
  const gaps = planGaps(plan);
  const [tab, setTab] = useState('period');

  return (
    <div>
      <h2>🗺 計画</h2>

      {gaps.length > 0 && (
        <div className="card warn">
          <h3 style={{ marginTop: 0 }}>まだ足りないもの</h3>
          <ul>
            {gaps.map((g) => (
              <li key={g.id}>
                {g.text}
                {g.optional && <span className="muted">（なくても計画書は作れます）</span>}
              </li>
            ))}
          </ul>
          {!plan.exam && (
            <div className="btn-row">
              <button type="button" className="primary" onClick={() => go('exams')}>
                試験を選ぶ →
              </button>
            </div>
          )}
        </div>
      )}

      <div className="chips">
        <button type="button" className={`chip ${tab === 'period' ? 'on' : ''}`} onClick={() => setTab('period')}>
          ① 期間
        </button>
        <button type="button" className={`chip ${tab === 'cognitive' ? 'on' : ''}`} onClick={() => setTab('cognitive')}>
          ② 認知特性
        </button>
        <button type="button" className={`chip ${tab === 'methods' ? 'on' : ''}`} onClick={() => setTab('methods')}>
          ③ 勉強法
        </button>
        <button type="button" className={`chip ${tab === 'doc' ? 'on' : ''}`} onClick={() => setTab('doc')}>
          ④ 計画書
        </button>
      </div>

      {tab === 'period' && <Period state={state} plan={plan} />}
      {tab === 'cognitive' && <Cognitive state={state} />}
      {tab === 'methods' && <Methods state={state} plan={plan} />}
      {tab === 'doc' && <PlanDoc state={state} plan={plan} go={go} />}
    </div>
  );
}

function Period({ state, plan }) {
  const s = state.settings;
  const sc = plan.schedule;
  return (
    <>
      <div className="card">
        <label className="field">
          <span>試験日</span>
          <input type="date" value={s.examDate || ''} onChange={(e) => actions.setSettings({ examDate: e.target.value })} />
        </label>
        <div className="two-col">
          <label className="field">
            <span>平日に確保できる時間（分）</span>
            <input
              type="number"
              min="0"
              max="720"
              value={s.weekdayMin}
              onChange={(e) => actions.setSettings({ weekdayMin: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="field">
            <span>休日に確保できる時間（分）</span>
            <input
              type="number"
              min="0"
              max="960"
              value={s.weekendMin}
              onChange={(e) => actions.setSettings({ weekendMin: Number(e.target.value) || 0 })}
            />
          </label>
        </div>
        <p className="muted">
          出るのは<strong>「確保できる時間」だけ</strong>です。「合格に必要な時間」はこのアプリでは決めていません
          （人によって違いすぎるため、手元に無い基準を持たない方針です）。
        </p>
      </div>

      {!sc && <div className="card warn">試験日を入れると、ここに逆算が出ます。</div>}

      {sc && (
        <>
          <div className="card accent">
            <h3 style={{ marginTop: 0 }}>
              残り {sc.days}日（約{sc.weeks}週）
            </h3>
            <p>
              平日{sc.weekdayDays}日 × {sc.weekdayMin}分／休日{sc.weekendDays}日 × {sc.weekendMin}分
            </p>
            <p style={{ fontSize: '1.15em' }}>
              確保できる時間の合計：<strong>約{sc.totalHours}時間</strong>
            </p>
          </div>

          <h3>時期の分け方</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>時期</th>
                  <th>期間</th>
                  <th>確保時間</th>
                </tr>
              </thead>
              <tbody>
                {sc.phases.map((p) => (
                  <tr key={p.id} id={`phase-${p.id}`}>
                    <td>
                      <strong>{p.label}</strong>
                      <br />
                      <span className="muted">{p.aim}</span>
                    </td>
                    <td>
                      {p.startDate}
                      <br />〜{p.endDate}
                      <br />
                      <span className="muted">{p.days}日</span>
                    </td>
                    <td>約{Math.round(p.minutes / 60)}時間</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sc.phases.map((p) => (
            <div className="card" key={p.id}>
              <h3 style={{ marginTop: 0 }}>{p.label}にやること</h3>
              <ul>
                {p.dos.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <p className="muted">この時期にやらないこと：</p>
              <ul>
                {p.donts.map((d) => (
                  <li key={d} className="muted">
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {plan.tight.length > 0 && (
            <div className="card warn">
              <h3 style={{ marginTop: 0 }}>時間が足りないときに削る候補</h3>
              <p className="muted">「間に合いません」とは言いません。何を削るかを決めるのはあなたです。</p>
              <ul>
                {plan.tight.map((t) => (
                  <li key={t.title}>
                    <strong>{t.title}</strong>…{t.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {plan.allocation.length > 0 && (
            <>
              <h3>科目の割り振り</h3>
              <p className="muted">確保した時間の分け方です。各科目に必要な時間ではありません。</p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>科目</th>
                      <th>重み</th>
                      <th>確保時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.allocation.map((a) => (
                      <tr key={a.name}>
                        <td>{a.name}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.5"
                            value={state.settings.subjectWeights?.[a.name] ?? 1}
                            onChange={(e) =>
                              actions.setSettings({
                                subjectWeights: { ...(state.settings.subjectWeights || {}), [a.name]: Number(e.target.value) },
                              })
                            }
                          />
                        </td>
                        <td>約{Math.round(a.minutes / 60)}時間</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

function Cognitive({ state }) {
  const answers = state.cognitive || {};
  const answered = COGNITIVE_QUESTIONS.filter((q) => answers[q.id] != null).length;
  const profile = isUnanswered(answers) ? null : profileOf(answers);

  return (
    <div id="cognitive">
      <div className="card warn">
        <h3 style={{ marginTop: 0 }}>先に読んでください</h3>
        <ul>
          {COGNITIVE_DISCLAIMER.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </div>

      <p className="muted">
        {answered}/{COGNITIVE_QUESTIONS.length}問に回答
      </p>
      <div className="progress">
        {COGNITIVE_QUESTIONS.map((q) => (
          <i key={q.id} className={answers[q.id] != null ? 'on' : ''} />
        ))}
      </div>

      {COGNITIVE_QUESTIONS.map((q, i) => (
        <div className="card" key={q.id}>
          <p style={{ marginTop: 0 }}>
            <strong>Q{i + 1}.</strong> {q.text}
          </p>
          <div className="chips">
            {SCALE.map((sc) => (
              <button
                key={sc.value}
                type="button"
                className={`chip ${answers[q.id] === sc.value ? 'on' : ''}`}
                onClick={() => actions.answerCognitive(q.id, sc.value)}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {profile && (
        <div className="card accent">
          <h3 style={{ marginTop: 0 }}>今日の答え</h3>
          <p>{profileLine(profile)}</p>
          <p className="muted">
            「決まりませんでした」と出た時は、無理に1つに寄せていません。複数の入り口を試すのが向いている、という意味です。
          </p>
          <ScoreBars profile={profile} />
        </div>
      )}

      <div className="btn-row">
        <button
          type="button"
          className="ghost"
          onClick={() => {
            if (window.confirm('答えを全部消します。よろしいですか。')) actions.clearCognitive();
          }}
        >
          答えを消してやり直す
        </button>
      </div>
    </div>
  );
}

function ScoreBars({ profile }) {
  const rows = [
    ...Object.entries(profile.channel.scores).map(([k, v]) => ({ label: CHANNELS[k]?.label || k, value: v })),
    ...Object.entries(profile.order.scores).map(([k, v]) => ({ label: ORDERS[k]?.label || k, value: v })),
  ];
  return (
    <div className="table-wrap">
      <table>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>{r.value == null ? '未回答' : `${Math.round(r.value * 10) / 10} / 3`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Methods({ state, plan }) {
  const chosen = state.settings.chosenMethods || [];
  const [showAll, setShowAll] = useState(false);
  const suggestions = plan.suggestions;

  return (
    <>
      <div className="note">
        提案は<strong>「試験の性格 × 認知特性」から機械的に並べているだけ</strong>です。AIは呼んでいません。
        最後に選ぶのはあなたです。効果が低いとされる方法は提案には混ぜていませんが、下の「すべて見る」で見られます。
      </div>

      {plan.usingSuggested && (
        <div className="card warn">
          <p style={{ marginTop: 0 }}>まだ自分では選んでいません。計画書には<strong>提案の上位を仮に置いています</strong>。</p>
          <div className="btn-row">
            <button type="button" className="primary" onClick={() => actions.adoptMethods(suggestions.slice(0, 5).map((m) => m.id))}>
              提案の上位5つをそのまま採用する
            </button>
          </div>
        </div>
      )}

      <h3>あなたに向いていそうな順</h3>
      {suggestions.map((m) => (
        <div className={`card ${chosen.includes(m.id) ? 'ok' : ''}`} key={m.id} id={`method-${m.id}`}>
          <h3 style={{ marginTop: 0 }}>
            {EFFECT_LEVELS[m.effect].icon} {m.title}
          </h3>
          <p className="muted">{EFFECT_LEVELS[m.effect].label}</p>
          <p>{m.summary}</p>
          <ul>
            {m.how.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <p className="muted">気をつけること：{m.caution}</p>
          <p className="muted">出典：{m.source}</p>
          {m.reasons.length > 0 && <p className="muted">選んだ理由：{m.reasons.join(' / ')}</p>}
          <div className="btn-row">
            <button type="button" className={chosen.includes(m.id) ? 'on' : 'primary'} onClick={() => actions.toggleMethod(m.id)}>
              {chosen.includes(m.id) ? '✔ 使う（外す）' : 'これを使う'}
            </button>
          </div>
        </div>
      ))}

      <div className="btn-row">
        <button type="button" onClick={() => setShowAll((v) => !v)}>
          {showAll ? '閉じる' : '効果が低いとされる方法も見る'}
        </button>
      </div>
      {showAll &&
        METHODS.filter((m) => m.effect === 'low').map((m) => (
          <div className="card" key={m.id} id={`method-${m.id}`}>
            <h3 style={{ marginTop: 0 }}>
              {EFFECT_LEVELS[m.effect].icon} {m.title}
            </h3>
            <p>{m.summary}</p>
            <ul>
              {m.how.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <p className="muted">気をつけること：{m.caution}</p>
            <p className="muted">出典：{m.source}</p>
          </div>
        ))}
    </>
  );
}

function PlanDoc({ state, plan, go }) {
  const md = useMemo(() => planMarkdown(plan, state), [plan, state]);
  const shape = weeklyShape(plan);

  return (
    <>
      {shape.length > 0 && (
        <>
          <h3>1週間の型</h3>
          <div className="table-wrap">
            <table>
              <tbody>
                {shape.map((r) => (
                  <tr key={r.day}>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.day}</td>
                    <td>{r.body}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <label className="field">
        <span>自分のメモ（計画書の最後に付きます）</span>
        <textarea value={state.notes} onChange={(e) => actions.setNotes(e.target.value)} style={{ minHeight: 90 }} />
      </label>

      <CopyBox text={md} filename="study-plan.md" label="学習計画書（Markdown）" collapsed />

      <div className="card accent">
        <h3 style={{ marginTop: 0 }}>次にできること</h3>
        <p>この計画書から、<strong>自分専用の対策アプリを作らせるための設計書</strong>を出せます。</p>
        <div className="btn-row">
          <button type="button" className="primary" onClick={() => go('spec')}>
            設計書を作る →
          </button>
        </div>
      </div>
    </>
  );
}
