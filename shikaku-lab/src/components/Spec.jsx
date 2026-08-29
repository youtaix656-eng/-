import React, { useMemo } from 'react';
import CopyBox from './CopyBox.jsx';
import { buildPlan, planGaps } from '../lib/plan.js';
import { specMarkdown, screensFor, skippedScreens, doneWhen, OUT_OF_SCOPE } from '../lib/spec.js';
import { exportJson } from '../lib/convert.js';

// 「この計画書をもとに、自分専用の対策アプリを Claude Code に作らせる」ための画面。
//
// 出すのは2つのファイルだけ：
//   ① 設計書（Markdown）… AIに読ませるもの
//   ② questions.json    … 取り込んだ問題（**設計書に貼らない**。読ませる量が跳ね上がるため）

export default function Spec({ state, go }) {
  const plan = useMemo(() => buildPlan(state), [state]);
  const spec = useMemo(() => specMarkdown(plan, state), [plan, state]);
  const screens = screensFor(plan);
  const skipped = skippedScreens(plan);
  const gaps = planGaps(plan).filter((g) => !g.optional);

  return (
    <div>
      <h2>🛠 自分専用アプリの設計書</h2>
      <p className="muted">
        計画書から、<strong>Claude Code に貼るだけの設計書</strong>を組み立てます。計画を直せば設計書も変わります
        （同じことを2か所に書かないため）。
      </p>

      {gaps.length > 0 && (
        <div className="card warn">
          <h3 style={{ marginTop: 0 }}>先に済ませたいこと</h3>
          <ul>
            {gaps.map((g) => (
              <li key={g.id}>{g.text}</li>
            ))}
          </ul>
          <p className="muted">このままでも設計書は作れますが、画面の選び方が大まかになります。</p>
          <div className="btn-row">
            <button type="button" onClick={() => go(plan.exam ? 'plan' : 'exams')}>
              {plan.exam ? '計画を作る →' : '試験を選ぶ →'}
            </button>
          </div>
        </div>
      )}

      <div className="card accent">
        <h3 style={{ marginTop: 0 }}>使い方（3手）</h3>
        <ol>
          <li>下の「設計書」をコピーして、Claude Code に貼る。</li>
          <li>問題を取り込んでいれば、<code>questions.json</code> も保存して同じフォルダに置く。</li>
          <li>「この設計書のとおりに作ってください」と伝える。</li>
        </ol>
        <p className="muted">
          設計書には「作らないもの」と「完成条件」が入っています。これが無いと機能が際限なく増え、
          どれも中途半端なまま終わります。
        </p>
      </div>

      <h3>この設計書で作られる画面（{screens.length}）</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>画面</th>
              <th>なぜ要るか</th>
            </tr>
          </thead>
          <tbody>
            {screens.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.title}</strong>
                  <br />
                  <span className="muted">{s.desc}</span>
                </td>
                <td className="muted">{s.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {skipped.length > 0 && (
        <p className="muted">
          今回は作らない画面：{skipped.map((s) => s.title).join('／')}
          <br />
          選んでいない勉強法の画面は設計書に入れていません（全部入りを渡すと、どれも中途半端になるため）。
        </p>
      )}

      <h3>完成条件</h3>
      <p className="muted">「決めただけ」で終わらせないための一覧です。読み取れないものは○にしません。</p>
      <ul>
        {doneWhen(plan).map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>

      <h3>作らないもの</h3>
      <ul>
        {OUT_OF_SCOPE.map((o) => (
          <li key={o} className="muted">
            {o}
          </li>
        ))}
      </ul>

      <CopyBox text={spec} filename="app-spec.md" label="設計書（Claude Code に貼る）" collapsed />

      {state.questions.length > 0 ? (
        <CopyBox
          text={exportJson(state.questions)}
          filename="questions.json"
          label={`問題データ（${state.questions.length}問）`}
          collapsed
        >
          <p className="muted">設計書とは別のファイルとして渡してください（設計書に貼ると読ませる量が跳ね上がります）。</p>
        </CopyBox>
      ) : (
        <div className="card">
          <p style={{ marginTop: 0 }}>まだ問題を取り込んでいません。問題が無くても、アプリの器は作れます。</p>
          <div className="btn-row">
            <button type="button" onClick={() => go('convert')}>
              過去問を変換する →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
