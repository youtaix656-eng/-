// AI社員を雇う。プリセットから雇う／完全オリジナルを作る、の2通り。

import { useState } from 'react';
import { Card, Field, SectionTitle, Row } from './ui.jsx';
import { ROLES, roleById, DEPARTMENTS } from '../data/roles.js';
import { presetEmployee, archetypeFor } from '../data/employees.js';
import { nextSeat, seatsOf } from '../lib/seed.js';
import { allGenres, DEFAULT_GENRE_ID } from '../data/genres.js';
import { employeeLimit } from '../data/plans.js';
import { TOOLS } from '../data/tools.js';
import { PROVIDERS } from '../lib/providers/index.js';

export default function Hire({ store, initialRoleId, go }) {
  const arg = typeof initialRoleId === 'object' && initialRoleId ? initialRoleId : {};
  const [mode, setMode] = useState('preset');
  const [roleId, setRoleId] = useState(arg.roleId || (typeof initialRoleId === 'string' ? initialRoleId : 'researcher'));
  const [genreId, setGenreId] = useState(arg.genreId || DEFAULT_GENRE_ID);
  const [custom, setCustom] = useState(() => blankCustom());
  const genres = allGenres(store.genres);
  const seatsPerGenre = store.company?.seatsPerRole || 3;

  const limit = employeeLimit(store.company?.planId, store.company?.limitOverrides);
  const full = store.activeEmployees.length >= limit;

  const seat = nextSeat(store.employees, roleId, genreId);
  const preset = presetEmployee(roleId, seat, genreId, store.genres);
  const arche = archetypeFor(seat);
  const filled = seatsOf(store.employees, roleId, genreId).length;

  const hirePreset = () => {
    const emp = store.hireEmployee(preset);
    go('employee', emp.id);
  };

  const hireCustom = () => {
    const role = roleById(custom.roleId);
    const genre = genres.find((g) => g.id === custom.genreId);
    const emp = store.hireEmployee({
      name: custom.name || '名もなき社員',
      shortName: custom.name || '社員',
      // 読みは目次の並びに使う。漢字の読みは推定しないので、入力がなければ空のまま。
      reading: custom.reading.trim(),
      avatar: custom.avatar || '◉',
      roleId: custom.roleId,
      genreId: custom.genreId,
      departmentId: role?.departmentId || 'admin',
      seat: nextSeat(store.employees, custom.roleId, custom.genreId),
      title: custom.title || role?.name || '社員',
      specialties: custom.specialties.split(/[,、\s]+/).filter(Boolean),
      persona: custom.persona,
      style: custom.style,
      strength: 'オリジナル',
      seatHint: custom.instruction,
      toolIds: custom.toolIds,
      providerPref: custom.providerPref,
      genreHint: genre && genre.id !== DEFAULT_GENRE_ID
        ? `あなたの担当分野は「${genre.name}」です。${genre.desc || ''}`
        : '',
    });
    go('employee', emp.id);
  };

  return (
    <div className="screen fade-in">
      <p className="muted" style={{ marginTop: 0 }}>
        席（1役職あたりの人数）は固定ではありません。同じ役職でも持ち味の違う社員を並べると、
        仕事を分担できます。<br />
        在籍 {store.activeEmployees.length} / {limit} 人
      </p>

      <div className="btn-row" style={{ marginBottom: 14 }}>
        <button type="button" className={`chip ${mode === 'preset' ? 'on' : ''}`} onClick={() => setMode('preset')}>
          プリセットから雇う
        </button>
        <button type="button" className={`chip ${mode === 'custom' ? 'on' : ''}`} onClick={() => setMode('custom')}>
          オリジナル社員を作る
        </button>
      </div>

      {full && (
        <Card glyph="⚠" title="在籍数の上限です">
          <p className="muted" style={{ marginBottom: 0 }}>
            設定でプランを上げるか、使っていない社員を休職にしてください。
          </p>
        </Card>
      )}

      {mode === 'preset' ? (
        <>
          <SectionTitle>役職を選ぶ</SectionTitle>
          {DEPARTMENTS.map((d) => (
            <div key={d.id} style={{ marginBottom: 10 }}>
              <div className="muted" style={{ marginBottom: 4 }}>{d.name}</div>
              <div className="chips">
                {ROLES.filter((r) => r.departmentId === d.id).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`chip ${r.id === roleId ? 'on' : ''}`}
                    onClick={() => setRoleId(r.id)}
                  >
                    {r.glyph} {r.name}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <SectionTitle>ジャンルを選ぶ</SectionTitle>
          <p className="muted" style={{ marginTop: -4 }}>
            1つの組（役職 × ジャンル）につき{seatsPerGenre}席まで。同じ役職でも分野が違えば別の3人を雇えます。
          </p>
          <div className="chips" style={{ marginBottom: 12 }}>
            {genres.map((g) => {
              const n = seatsOf(store.employees, roleId, g.id).length;
              return (
                <button
                  key={g.id}
                  type="button"
                  className={`chip ${g.id === genreId ? 'on' : ''}`}
                  onClick={() => setGenreId(g.id)}
                >
                  {g.glyph} {g.name} {n}/{seatsPerGenre}
                </button>
              );
            })}
            <button type="button" className="chip" onClick={() => go('genre')}>
              ＋ ジャンルを足す
            </button>
          </div>

          {preset && (
            <Card glyph={preset.avatar} title={preset.name}>
              <div className="muted" style={{ marginTop: -6 }}>
                {preset.title}／{genres.find((g) => g.id === genreId)?.name}の{seat}席目
                {filled >= seatsPerGenre && '（既定の3席を超えます）'}
              </div>
              <p style={{ fontSize: 14.5 }}>{preset.persona}</p>
              <p className="muted">書き方：{preset.style}</p>
              <div className="chips" style={{ marginBottom: 12 }}>
                {preset.specialties.map((s) => (
                  <span key={s} className="chip">{s}</span>
                ))}
              </div>
              <p className="muted">
                この席の持ち味：<strong style={{ color: '#fff' }}>{arche.strength}</strong>
                — {arche.persona}
              </p>
              {preset.genreHint && <p className="muted">分野の指示：{preset.genreHint}</p>}
              <p className="muted">読み：{preset.reading}</p>
              <button type="button" className="btn primary block" onClick={hirePreset} disabled={full}>
                {preset.name} を雇う
              </button>
            </Card>
          )}
        </>
      ) : (
        <Card glyph="✎" title="オリジナル社員">
          <Field label="社員名">
            <input
              className="input"
              value={custom.name}
              onChange={(e) => setCustom({ ...custom, name: e.target.value })}
              placeholder="例：夜勤専門リサーチャー・ノクス"
            />
          </Field>
          <Field label="アイコン（1文字）">
            <input
              className="input"
              value={custom.avatar}
              maxLength={2}
              onChange={(e) => setCustom({ ...custom, avatar: e.target.value })}
              placeholder="◉"
            />
          </Field>
          <Field
            label="読み（ひらがな）"
            hint="目次の並びに使います。漢字を含む名前は入れてください（アプリでは読みを推測しません）。"
          >
            <input
              className="input"
              value={custom.reading}
              onChange={(e) => setCustom({ ...custom, reading: e.target.value })}
              placeholder="例：やきんせんもんりさーちゃーのくす"
            />
          </Field>
          <Field label="ジャンル（担当する分野）">
            <select
              className="select"
              value={custom.genreId}
              onChange={(e) => setCustom({ ...custom, genreId: e.target.value })}
            >
              {genres.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </Field>
          <Field label="役職（部署はここから決まります）">
            <select
              className="select"
              value={custom.roleId}
              onChange={(e) => setCustom({ ...custom, roleId: e.target.value })}
            >
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}（{r.summary}）
                </option>
              ))}
            </select>
          </Field>
          <Field label="肩書き">
            <input
              className="input"
              value={custom.title}
              onChange={(e) => setCustom({ ...custom, title: e.target.value })}
              placeholder="例：医療情報リサーチャー"
            />
          </Field>
          <Field label="専門分野（カンマ区切り）">
            <input
              className="input"
              value={custom.specialties}
              onChange={(e) => setCustom({ ...custom, specialties: e.target.value })}
              placeholder="例：鍼灸, 統計, 論文検索"
            />
          </Field>
          <Field label="性格">
            <input
              className="input"
              value={custom.persona}
              onChange={(e) => setCustom({ ...custom, persona: e.target.value })}
              placeholder="例：慎重で、根拠のない話を嫌う"
            />
          </Field>
          <Field label="回答スタイル">
            <input
              className="input"
              value={custom.style}
              onChange={(e) => setCustom({ ...custom, style: e.target.value })}
              placeholder="例：結論を先に、箇条書きで簡潔に"
            />
          </Field>
          <Field label="この社員への指示（常に守らせたいこと）">
            <textarea
              className="textarea"
              value={custom.instruction}
              onChange={(e) => setCustom({ ...custom, instruction: e.target.value })}
              placeholder="例：数字を出すときは必ず出典と年度を添えること"
            />
          </Field>
          <Field label="使いたいエンジン">
            <select
              className="select"
              value={custom.providerPref}
              onChange={(e) => setCustom({ ...custom, providerPref: e.target.value })}
            >
              <option value="auto">自動</option>
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label="使える道具">
            <div className="chips">
              {TOOLS.filter((t) => t.available).map((t) => {
                const on = custom.toolIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`chip ${on ? 'on' : ''}`}
                    onClick={() =>
                      setCustom({
                        ...custom,
                        toolIds: on ? custom.toolIds.filter((x) => x !== t.id) : [...custom.toolIds, t.id],
                      })
                    }
                  >
                    {t.glyph} {t.name}
                  </button>
                );
              })}
            </div>
          </Field>
          <button type="button" className="btn primary block" onClick={hireCustom} disabled={full || !custom.name}>
            この社員を雇う
          </button>
        </Card>
      )}
    </div>
  );
}

function blankCustom() {
  return {
    name: '',
    reading: '',
    avatar: '◉',
    roleId: 'researcher',
    genreId: DEFAULT_GENRE_ID,
    title: '',
    specialties: '',
    persona: '',
    style: '',
    instruction: '',
    providerPref: 'auto',
    toolIds: ['knowledge'],
  };
}
