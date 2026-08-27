// 社員1人の詳細。プロフィール・役割・能力・仕事・使用AI・道具・権限・実績。

import { useState } from 'react';
import { Card, Field, SectionTitle, Row, Empty } from './ui.jsx';
import { notesOf } from '../lib/memory.js';
import { personalAttack, rephraseHint } from '../lib/guard.js';
import { roleById, departmentById } from '../data/roles.js';
import { allGenres, DEFAULT_GENRE_ID } from '../data/genres.js';
import { TOOLS, toolById } from '../data/tools.js';
import { PROVIDERS, providerById } from '../lib/providers/index.js';
import { PERMISSIONS, permissionLabel } from '../lib/permissions.js';
import { usd, relTime } from '../lib/format.js';
import Portrait from './Portrait.jsx';
import { useAllTasks } from './useAllTasks.js';

export default function EmployeeDetail({ store, employeeId, go }) {
  // 古い仕事も要る画面なので、残りを読み足す
  useAllTasks(store);
  const emp = store.employees.find((e) => e.id === employeeId);
  if (!emp) return <div className="screen"><Empty>社員が見つかりません。</Empty></div>;

  const role = roleById(emp.roleId);
  const dept = departmentById(emp.departmentId);
  const genres = allGenres(store.genres);
  const genre = genres.find((g) => g.id === (emp.genreId || DEFAULT_GENRE_ID));
  const myTasks = store.tasks.filter((t) => (t.steps || []).some((s) => s.employeeId === emp.id));
  const provider = providerById(emp.providerPref);

  const set = (patch) => store.updateEmployee(emp.id, patch);

  return (
    <div className="screen fade-in">
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Portrait employee={emp} size={150} glyph={emp.avatar} className="portrait-big" />
        </div>
        <div className="serif" style={{ fontSize: 22, letterSpacing: '0.08em', marginTop: 6 }}>
          {emp.name}
        </div>
        {emp.kana && <div className="char-kana">{emp.kana}</div>}
        {emp.origin && <div><span className="char-origin">{emp.origin}</span></div>}
        <div className="muted">
          {emp.title}／{dept?.name}
          {genre ? `／${genre.glyph} ${genre.name}` : ''}
        </div>
        {emp.reading && <div className="muted" style={{ fontSize: 11 }}>{emp.reading}</div>}
      </div>

      <Card glyph="◉" title="人物">
        <p style={{ marginTop: 0, fontSize: 14.5 }}>{emp.persona}</p>
        <p className="muted" style={{ marginBottom: 8 }}>書き方：{emp.style}</p>
        <div className="chips">
          {(emp.specialties || []).map((s) => (
            <span key={s} className="chip">{s}</span>
          ))}
        </div>
      </Card>

      <Card glyph="◈" title="ジャンル（担当する分野）">
        <Field label="分野" hint="変えると、この社員に与える分野の指示も切り替わります。">
          <select
            className="select"
            value={emp.genreId || DEFAULT_GENRE_ID}
            onChange={(e) => {
              const g = genres.find((x) => x.id === e.target.value);
              set({
                genreId: e.target.value,
                genreHint:
                  g && g.id !== DEFAULT_GENRE_ID
                    ? `あなたの担当分野は「${g.name}」です。${g.desc || ''}${g.caution ? ` ${g.caution}` : ''}`
                    : '',
              });
            }}
          >
            {genres.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </Field>
        {emp.genreHint && <p className="muted" style={{ marginBottom: 8 }}>{emp.genreHint}</p>}
        <Field
          label="読み（ひらがな）"
          hint="目次の並びに使います。空だと目次の「その他」に入ります（読みは推測しません）。"
        >
          <input
            className="input"
            value={emp.reading || ''}
            onChange={(e) => set({ reading: e.target.value })}
            placeholder="例：りさーちゃーるな"
          />
        </Field>
      </Card>

      <Card glyph={role?.glyph} title="役割">
        <p className="muted" style={{ marginTop: 0 }}>{role?.summary}</p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {(role?.duties || []).map((d) => (
            <li key={d} style={{ fontSize: 14 }}>{d}</li>
          ))}
        </ul>
      </Card>

      <Card glyph="✳" title="使用AI（思考エンジン）">
        <p className="muted" style={{ marginTop: 0 }}>
          社員とエンジンは別のものです。ここを変えても、この社員の人格・記憶・実績はそのまま残ります。
        </p>
        <Field label="使いたいエンジン">
          <select
            className="select"
            value={emp.providerPref}
            onChange={(e) => set({ providerPref: e.target.value, modelPref: 'auto' })}
          >
            <option value="auto">自動（AI Router に任せる）</option>
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.needsKey && !store.secrets[p.id] ? '（未接続）' : ''}
              </option>
            ))}
          </select>
        </Field>
        {provider && (
          <Field label="モデル">
            <select className="select" value={emp.modelPref} onChange={(e) => set({ modelPref: e.target.value })}>
              <option value="auto">自動（仕事の重さで選ぶ）</option>
              {provider.models.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </Field>
        )}
      </Card>

      <Card glyph="⚒" title="使える道具">
        <div className="chips">
          {TOOLS.filter((t) => t.available).map((t) => {
            const on = (emp.toolIds || []).includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                className={`chip ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() =>
                  set({
                    toolIds: on
                      ? emp.toolIds.filter((x) => x !== t.id)
                      : [...(emp.toolIds || []), t.id],
                  })
                }
              >
                {t.glyph} {t.name}
              </button>
            );
          })}
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          道具は「使ってよいもの」の指定です。実際に動くかは接続状況によります。
        </p>
      </Card>

      <Card glyph="⚖" title="権限">
        <p className="muted" style={{ marginTop: 0 }}>
          既定は「閲覧」と「作成」だけ。送信・削除・支払いは、有効にしても
          <strong style={{ color: '#fff' }}>実行前に必ずあなたの承認</strong>を通ります。
        </p>
        <div className="chips">
          {PERMISSIONS.map((p) => {
            const on = Boolean((emp.permissions || {})[p]);
            const dangerous = ['send', 'delete', 'pay'].includes(p);
            return (
              <button
                key={p}
                type="button"
                className={`chip ${on ? 'on' : ''}`}
                aria-pressed={on}
                onClick={() => set({ permissions: { ...emp.permissions, [p]: !on } })}
              >
                {permissionLabel(p)}
                {dangerous ? ' ⚠' : ''}
              </button>
            );
          })}
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={Boolean(emp.autoRun)}
            onChange={(e) => set({ autoRun: e.target.checked })}
          />
          自動実行を許す（危険な権限を持つ社員には効きません）
        </label>
      </Card>

      <Card glyph="✦" title="実績">
        <div className="stats">
          <div className="stat">
            <div className="v">{emp.stats?.tasks || 0}</div>
            <div className="k">仕事</div>
          </div>
          <div className="stat">
            <div className="v">{(emp.stats?.tokens || 0).toLocaleString()}</div>
            <div className="k">トークン</div>
          </div>
          <div className="stat">
            <div className="v">{usd(emp.stats?.costUsd || 0)}</div>
            <div className="k">費用</div>
          </div>
        </div>
        <p className="muted" style={{ marginBottom: 0, marginTop: 8 }}>
          最終稼働：{emp.stats?.lastActiveAt ? relTime(emp.stats.lastActiveAt) : 'まだ働いていません'}
        </p>
      </Card>

      <TeachCard employee={emp} store={store} />

      <SectionTitle>この社員の仕事</SectionTitle>
      {myTasks.length ? (
        myTasks.slice(0, 8).map((t) => (
          <Row key={t.id} glyph="✎" title={t.title} sub={relTime(t.createdAt)} onClick={() => go('task', t.id)} />
        ))
      ) : (
        <Empty>まだ担当した仕事がありません。</Empty>
      )}

      <div className="btn-row" style={{ marginTop: 16 }}>
        <button type="button" className="btn primary" onClick={() => go('compose', { employeeId: emp.id })}>
          この社員に依頼する
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (window.confirm(`${emp.name} を休職にしますか？（データは残ります）`)) {
              store.archiveEmployee(emp.id);
              go('employees');
            }
          }}
        >
          休職にする
        </button>
      </div>
    </div>
  );
}

/**
 * この社員に覚えさせたこと（改善ログ）。
 *
 * 会社全体のルールは「会社のルール」の画面、
 * **この社員にだけ効かせたいこと**はここ、と分ける。
 * 次にこの社員が動くとき、必ず読んでから書き始める。
 */
function TeachCard({ employee, store }) {
  const notes = notesOf(employee);
  const [draft, setDraft] = useState('');
  return (
    <Card glyph="◈" title={`覚えさせたこと（${notes.length}）`}>
      <p className="muted" style={{ marginTop: -6 }}>
        直してほしい所を1行だけ書きます。次からこの社員は、これを読んでから仕事をします。
        （例：見出しは1つ200字まで／同じ書き出しを続けて使わない）
      </p>
      <div className="btn-row" style={{ marginBottom: 8 }}>
        <input
          className="input"
          style={{ flex: 1 }}
          value={draft}
          placeholder="次からはこうしてほしい、を1行で"
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="button"
          className="btn primary"
          disabled={!draft.trim()}
          onClick={() => {
            // 人格否定のまま覚えさせない（止めはせず、1度だけ書き直しを促す）
            const hit = personalAttack(draft);
            if (hit && !window.confirm(`${rephraseHint(hit.phrase)}\n\nこのまま覚えさせますか？`)) return;
            store.teachEmployee(employee.id, draft);
            setDraft('');
          }}
        >
          覚えさせる
        </button>
      </div>
      {!notes.length && <p className="muted" style={{ marginBottom: 0 }}>まだありません。</p>}
      {notes
        .slice()
        .reverse()
        .map((n) => (
          <div key={n.id} className="card tight" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ flex: 1, fontSize: 13.5 }}>{n.text}</span>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => store.forgetEmployeeNote(employee.id, n.id)}
            >
              忘れさせる
            </button>
          </div>
        ))}
      {notes.length > 5 && (
        <p className="muted" style={{ marginBottom: 0 }}>
          ※ 仕事のときに読ませるのは、新しい5件です。
        </p>
      )}
    </Card>
  );
}
