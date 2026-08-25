// ジャンルを足す。読み（ひらがな）は必須。
// 目次の並びに使うため、漢字の読みをアプリ側で推測しない決まりになっている。

import { useState } from 'react';
import { Card, Field, Empty } from './ui.jsx';
import { GENRES, allGenres } from '../data/genres.js';
import { seatsOf } from '../lib/seats.js';
import { ROLES } from '../data/roles.js';

export default function GenreEditor({ store, go, toast }) {
  const [form, setForm] = useState({ name: '', reading: '', glyph: '◇', desc: '' });
  const [error, setError] = useState('');
  const genres = allGenres(store.genres);

  const save = () => {
    try {
      const g = store.addGenre(form);
      setForm({ name: '', reading: '', glyph: '◇', desc: '' });
      setError('');
      toast(`「${g.name}」を足しました`);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="screen fade-in">
      <Card glyph="◈" title="ジャンルとは">
        <p className="muted" style={{ marginTop: -6, marginBottom: 0 }}>
          役職が「何ができるか」なら、ジャンルは「どの分野で」です。
          リサーチャー×医療 と リサーチャー×副業 は別の3人として雇えます。
          仕事を依頼するときにジャンルを選ぶと、その分野の社員が優先して担当します。
        </p>
      </Card>

      <Card glyph="＋" title="ジャンルを足す">
        <Field label="ジャンル名">
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="例：鍼灸・東洋医学"
          />
        </Field>
        <Field
          label="読み（ひらがな）※必須"
          hint="目次の並びに使います。漢字の読みはアプリでは推測しない決まりです（誤読を残さないため）。"
        >
          <input
            className="input"
            value={form.reading}
            onChange={(e) => setForm({ ...form, reading: e.target.value })}
            placeholder="例：しんきゅうとうよういがく"
          />
        </Field>
        <Field label="アイコン（1文字）">
          <input
            className="input"
            maxLength={2}
            value={form.glyph}
            onChange={(e) => setForm({ ...form, glyph: e.target.value })}
          />
        </Field>
        <Field label="どんな分野か（社員への説明になります）">
          <input
            className="input"
            value={form.desc}
            onChange={(e) => setForm({ ...form, desc: e.target.value })}
            placeholder="例：経穴・経絡・国家試験の範囲"
          />
        </Field>
        {error && <p className="muted" style={{ color: '#fff' }}>⚠ {error}</p>}
        <button
          type="button"
          className="btn primary block"
          onClick={save}
          disabled={!form.name.trim() || !form.reading.trim()}
        >
          このジャンルを足す
        </button>
      </Card>

      <div className="toc-head">いまあるジャンル（{genres.length}）</div>
      {genres.map((g) => {
        const count = store.activeEmployees.filter((e) => e.genreId === g.id).length;
        const roles = ROLES.filter((r) => seatsOf(store.employees, r.id, g.id).length > 0);
        return (
          <div key={g.id} className="card tight">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="rune" style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{g.glyph}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15 }}>{g.name}</div>
                <div className="muted">{g.reading}・{count}人在籍</div>
              </div>
              {g.custom && count === 0 && (
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => {
                    try {
                      store.removeGenre(g.id);
                      toast('削除しました');
                    } catch (e) {
                      toast(e.message);
                    }
                  }}
                >
                  削除
                </button>
              )}
            </div>
            {g.desc && <div className="muted" style={{ marginTop: 4 }}>{g.desc}</div>}
            {g.caution && <div className="muted" style={{ marginTop: 4 }}>⚠ {g.caution}</div>}
            {roles.length > 0 && (
              <div className="muted" style={{ marginTop: 4 }}>
                在籍：{roles.map((r) => `${r.name}${seatsOf(store.employees, r.id, g.id).length}`).join('・')}
              </div>
            )}
          </div>
        );
      })}

      {!genres.length && <Empty>ジャンルがありません。</Empty>}

      <button type="button" className="btn block" onClick={() => go('toc')} style={{ marginTop: 12 }}>
        目次に戻る
      </button>
    </div>
  );
}
