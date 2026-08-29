import React, { useMemo, useState } from 'react';
import { actions } from '../lib/useStore.js';
import { EXAMS, EXAM_CATEGORIES, TRAIT_VOCABULARY, FORMAT_VOCABULARY, TRAIT_IDS, FORMAT_IDS, checkPointsOf, examById } from '../data/exams.js';
import { allExams, resolveExam, makeExam, validateExam, missingReadings } from '../lib/myExam.js';

// 受ける試験を選ぶ／自分の試験を足す画面。
// 同梱の試験と自作の試験を、**後ろの仕組みから見て同じ形**で扱う（lib/myExam.js）。

export default function Exams({ state, go, focus }) {
  const [cat, setCat] = useState('all');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const selectedId = state.settings.examId;
  const selected = resolveExam(selectedId, state.myExams);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allExams(state.myExams).filter((e) => {
      if (cat !== 'all' && e.category !== cat) return false;
      if (!q) return true;
      return `${e.name}${e.reading || ''}${(e.subjects || []).map((s) => s.name).join('')}`.toLowerCase().includes(q);
    });
  }, [state.myExams, cat, query]);

  return (
    <div>
      <h2>🎓 受ける試験</h2>
      <p className="muted">
        選ぶと、この試験の性格に合わせて勉強法の提案・計画書・変換プロンプト・設計書がすべて変わります。
      </p>

      {selected && <SelectedExam exam={selected} state={state} go={go} />}

      <h3>試験を選ぶ</h3>
      <label className="field">
        <span>さがす</span>
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="試験名・科目名の一部" />
      </label>
      <div className="chips">
        <button type="button" className={`chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>
          すべて
        </button>
        {EXAM_CATEGORIES.map((c) => (
          <button key={c.id} type="button" className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <div className="card warn">
          <p>この条件に合う試験がありません。</p>
          <p className="muted">一覧に無い試験は、下の「自分の試験を足す」から追加できます。</p>
        </div>
      )}

      {list.map((e) => (
        <div key={e.id} className={`card ${e.id === selectedId ? 'accent' : ''}`} id={`exam-${e.id}`}>
          <h3 style={{ marginTop: 0 }}>
            {e.custom ? '📝 ' : ''}
            {e.name}
          </h3>
          {e.body && <p className="muted">実施：{e.body}</p>}
          {e.core && <p>{e.core}</p>}
          <div className="chips">
            {(e.traits || []).map((t) => (
              <span key={t} className="tag">
                {TRAIT_VOCABULARY[t]?.label || t}
              </span>
            ))}
          </div>
          <p className="muted">科目 {(e.subjects || []).length}／{(e.formats || []).map((f) => FORMAT_VOCABULARY[f]?.label).join('・')}</p>
          <div className="btn-row">
            {e.id === selectedId ? (
              <span className="ok-text">✔ これを受けます</span>
            ) : (
              <button type="button" className="primary" onClick={() => actions.setSettings({ examId: e.id })}>
                この試験にする
              </button>
            )}
            {e.custom && (
              <button
                type="button"
                className="ghost small"
                onClick={() => {
                  if (window.confirm(`「${e.name}」を消します。よろしいですか。`)) actions.deleteExam(e.id);
                }}
              >
                消す
              </button>
            )}
          </div>
        </div>
      ))}

      <h3>一覧に無い試験を足す</h3>
      <div className="note">
        同梱の一覧は雛形です。**毎年変わる数字（合格率・合格点・試験日・受験料）は、わざと持っていません。**
        アプリに書いてある古い数字を信じてしまうより、公式サイトで確かめてもらうほうが安全だからです。
      </div>
      {adding ? (
        <ExamForm onCancel={() => setAdding(false)} onDone={() => setAdding(false)} />
      ) : (
        <div className="btn-row">
          <button type="button" onClick={() => setAdding(true)}>
            ＋ 自分の試験を足す
          </button>
        </div>
      )}
    </div>
  );
}

function SelectedExam({ exam, state, go }) {
  const points = checkPointsOf(exam);
  const checked = state.settings.checkedPoints || {};
  const doneCount = points.filter((p) => checked[p]).length;
  const missing = missingReadings(exam);

  return (
    <div className="card accent">
      <h3 style={{ marginTop: 0 }}>いま選んでいる試験：{exam.name}</h3>
      {exam.pitfall && <p>⚠️ つまずきやすい所：{exam.pitfall}</p>}

      <h3>先に自分で確かめること（{doneCount}/{points.length}）</h3>
      <p className="muted">毎年変わるもの・制度で変わるものは、公式で確かめてください。印は自分で付けます。</p>
      <ul className="step-list">
        {points.map((p) => (
          <li key={p}>
            <button
              type="button"
              className="chip"
              aria-pressed={Boolean(checked[p])}
              onClick={() => actions.toggleCheckPoint(p)}
            >
              {checked[p] ? '✔' : '□'}
            </button>
            <span>{p}</span>
          </li>
        ))}
      </ul>

      {missing.length > 0 && (
        <div className="note">
          読み（ひらがな）が入っていない項目があります：{missing.join('、')}
          <br />
          読みが無いと目次の「その他」に入ります（誤読を出さないため、読みは自動で推測していません）。
        </div>
      )}

      <div className="btn-row">
        <button type="button" onClick={() => go('plan')}>
          計画を作る →
        </button>
        <button type="button" onClick={() => go('convert')}>
          過去問を変換する →
        </button>
      </div>
    </div>
  );
}

function ExamForm({ onCancel, onDone }) {
  const [form, setForm] = useState({
    name: '',
    reading: '',
    category: 'business',
    body: '',
    formats: ['choice'],
    traits: [],
    core: '',
    pitfall: '',
    subjectsText: '',
  });
  const [errors, setErrors] = useState([]);

  const patch = (p) => setForm((f) => ({ ...f, ...p }));
  const toggle = (key, value) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((x) => x !== value) : [...f[key], value] }));

  const submit = () => {
    // 「科目名, よみ」を1行に1科目
    const subjects = form.subjectsText
      .split('\n')
      .map((line) => {
        const [name, reading] = line.split(/[,、]/);
        return { name: (name || '').trim(), reading: (reading || '').trim() };
      })
      .filter((s) => s.name);
    const exam = makeExam({ ...form, subjects });
    const errs = validateExam(exam);
    if (errs.length) {
      setErrors(errs);
      return;
    }
    actions.addExam({ ...form, subjects });
    onDone();
  };

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>自分の試験を足す</h3>
      <label className="field">
        <span>試験名（必須）</span>
        <input type="text" value={form.name} onChange={(e) => patch({ name: e.target.value })} />
      </label>
      <label className="field">
        <span>読み（ひらがな）　※入れないと目次の「その他」に入ります</span>
        <input type="text" value={form.reading} onChange={(e) => patch({ reading: e.target.value })} placeholder="例：きほんじょうほうぎじゅつしゃ" />
      </label>
      <label className="field">
        <span>分野</span>
        <select value={form.category} onChange={(e) => patch({ category: e.target.value })}>
          {EXAM_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>実施団体（分かれば）</span>
        <input type="text" value={form.body} onChange={(e) => patch({ body: e.target.value })} />
      </label>

      <p className="muted">出題形式（1つ以上・必須）</p>
      <div className="chips">
        {FORMAT_IDS.map((f) => (
          <button key={f} type="button" className={`chip ${form.formats.includes(f) ? 'on' : ''}`} onClick={() => toggle('formats', f)}>
            {FORMAT_VOCABULARY[f].label}
          </button>
        ))}
      </div>

      <p className="muted">この試験の性格（当てはまるものを選ぶ。ここから勉強法が提案されます）</p>
      <div className="chips">
        {TRAIT_IDS.map((t) => (
          <button key={t} type="button" className={`chip ${form.traits.includes(t) ? 'on' : ''}`} onClick={() => toggle('traits', t)}>
            {TRAIT_VOCABULARY[t].label}
          </button>
        ))}
      </div>

      <label className="field">
        <span>科目（1行に1つ。「科目名, よみ」の形。必須）</span>
        <textarea
          value={form.subjectsText}
          onChange={(e) => patch({ subjectsText: e.target.value })}
          placeholder={'民法, みんぽう\n行政法, ぎょうせいほう'}
        />
      </label>
      <label className="field">
        <span>対策の芯（自分の言葉で。空でもよい）</span>
        <input type="text" value={form.core} onChange={(e) => patch({ core: e.target.value })} />
      </label>
      <label className="field">
        <span>つまずきやすい所（空でもよい）</span>
        <input type="text" value={form.pitfall} onChange={(e) => patch({ pitfall: e.target.value })} />
      </label>

      {errors.length > 0 && (
        <ul>
          {errors.map((e) => (
            <li key={e} className="err">
              {e}
            </li>
          ))}
        </ul>
      )}

      <div className="btn-row">
        <button type="button" className="primary" onClick={submit}>
          足してこの試験にする
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          やめる
        </button>
      </div>
    </div>
  );
}
