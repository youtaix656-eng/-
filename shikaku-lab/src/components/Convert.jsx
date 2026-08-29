import React, { useMemo, useState } from 'react';
import { actions } from '../lib/useStore.js';
import CopyBox from './CopyBox.jsx';
import { resolveExam } from '../lib/myExam.js';
import { FORMAT_VOCABULARY } from '../data/exams.js';
import {
  ANGLES,
  DEFAULT_ANGLES_BY_FORMAT,
  buildConvertPrompt,
  parseImported,
  reviewChecklist,
  exportJson,
  COPYRIGHT_NOTE,
} from '../lib/convert.js';

// 過去問 → AI変換。このアプリの芯。
//
// **AIをアプリから呼ばない**（lib/convert.js の頭に理由を書いてある）。
// ここでやるのは「貼るプロンプトを作る」と「返ってきたものを受け取る」の2つだけ。

export default function Convert({ state, go }) {
  const exam = resolveExam(state.settings.examId, state.myExams);
  const draft = state.settings.convertDraft || {};
  const [tab, setTab] = useState('make'); // make | import | list

  const set = (patch) => actions.setSettings({ convertDraft: { ...draft, ...patch } });

  const format = draft.format || exam?.formats?.[0] || 'choice';
  const angles = state.settings.angles?.length ? state.settings.angles : DEFAULT_ANGLES_BY_FORMAT[format] || ['core'];

  const prompt = useMemo(
    () =>
      buildConvertPrompt({
        examId: exam?.id,
        examName: exam?.name,
        subject: draft.subject,
        genre: draft.genre,
        round: draft.round,
        format,
        angles,
        choiceCount: draft.choiceCount || 4,
        extraNotes: draft.extraNotes,
      }),
    [exam, draft.subject, draft.genre, draft.round, format, angles, draft.choiceCount, draft.extraNotes],
  );

  return (
    <div>
      <h2>🔁 過去問をAIで教材に変える</h2>

      {!exam && (
        <div className="card warn">
          <p>まず受ける試験を選んでください。試験ごとに、作る問題の角度が変わります。</p>
          <div className="btn-row">
            <button type="button" className="primary" onClick={() => go('exams')}>
              試験を選ぶ →
            </button>
          </div>
        </div>
      )}

      <div className="chips">
        <button type="button" className={`chip ${tab === 'make' ? 'on' : ''}`} onClick={() => setTab('make')}>
          ① プロンプトを作る
        </button>
        <button type="button" className={`chip ${tab === 'import' ? 'on' : ''}`} onClick={() => setTab('import')}>
          ② 返答を取り込む
        </button>
        <button type="button" className={`chip ${tab === 'list' ? 'on' : ''}`} onClick={() => setTab('list')}>
          ③ 収録した問題（{state.questions.length}）
        </button>
      </div>

      {tab === 'make' && (
        <>
          <div className="note">
            <strong>このアプリはAIを呼びません。</strong>
            作った文章をコピーして、お使いのAI（Claude・ChatGPT など）に貼ってください。
            APIキーは要りません。返ってきた JSON を②で貼ると、この端末の中にだけ保存されます。
          </div>

          <div className="card">
            <label className="field">
              <span>科目</span>
              <select value={draft.subject || ''} onChange={(e) => set({ subject: e.target.value })}>
                <option value="">（選んでください）</option>
                {(exam?.subjects || []).map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>ジャンル（大項目｜中項目。空でよい）</span>
              <input type="text" value={draft.genre || ''} onChange={(e) => set({ genre: e.target.value })} />
            </label>
            <label className="field">
              <span>回（「第34回」など。空でよい）</span>
              <input type="text" value={draft.round || ''} onChange={(e) => set({ round: e.target.value })} />
            </label>
            <label className="field">
              <span>出題形式</span>
              <select value={format} onChange={(e) => set({ format: e.target.value })}>
                {Object.entries(FORMAT_VOCABULARY).map(([id, f]) => (
                  <option key={id} value={id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted">{FORMAT_VOCABULARY[format]?.hint}</p>
            <label className="field">
              <span>選択肢の数</span>
              <input
                type="number"
                min="2"
                max="8"
                value={draft.choiceCount || 4}
                onChange={(e) => set({ choiceCount: Number(e.target.value) || 4 })}
              />
            </label>

            <h3>作る問題の角度</h3>
            <p className="muted">
              1つの過去問から、違う角度で複数の問題を作ります。答えと論点が重ならないようにAIへ指示します。
            </p>
            <div className="chips">
              {ANGLES.map((a) => (
                <button
                  key={a.id}
                  id={`angle-${a.id}`}
                  type="button"
                  className={`chip ${angles.includes(a.id) ? 'on' : ''}`}
                  onClick={() => actions.toggleAngle(a.id)}
                  title={a.desc}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <ul>
              {ANGLES.filter((a) => angles.includes(a.id)).map((a) => (
                <li key={a.id}>
                  <strong>{a.label}</strong>：{a.desc}
                </li>
              ))}
            </ul>
            {angles.length === 0 && <p className="err">角度を1つ以上えらんでください（今は既定に戻しています）。</p>}

            <label className="field">
              <span>追加の指示（空でよい）</span>
              <textarea
                value={draft.extraNotes || ''}
                onChange={(e) => set({ extraNotes: e.target.value })}
                placeholder="例：計算問題は途中式も解説に入れてください"
                style={{ minHeight: 80 }}
              />
            </label>
          </div>

          <CopyBox text={prompt} filename="convert-prompt.txt" label="AIに貼るプロンプト" />

          <div className="card warn">
            <h3 style={{ marginTop: 0 }}>著作権について</h3>
            <ul>
              {COPYRIGHT_NOTE.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </>
      )}

      {tab === 'import' && <ImportPane state={state} exam={exam} draft={draft} />}
      {tab === 'list' && <QuestionList state={state} />}
    </div>
  );
}

function ImportPane({ state, exam, draft }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);

  const run = () => {
    const parsed = parseImported(text, {
      examId: exam?.id,
      subject: draft.subject,
      genre: draft.genre,
      round: draft.round,
    });
    if (parsed.items.length === 0) {
      setResult({ ...parsed, added: 0, duplicates: 0 });
      return;
    }
    const { added, duplicates } = actions.addQuestions(parsed.items);
    setResult({ ...parsed, added, duplicates });
    if (added > 0) setText('');
  };

  return (
    <>
      <div className="note">
        AIの返答のうち、<code>[</code> で始まり <code>]</code> で終わる部分を貼ってください
        （コードブロックの ``` ごと貼っても読めます）。
      </div>
      <label className="field">
        <span>AIの返答</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder='[ { "subject": "…" } ]' />
      </label>
      <div className="btn-row">
        <button type="button" className="primary" onClick={run} disabled={!text.trim()}>
          取り込む
        </button>
      </div>

      {result && (
        <div className={`card ${result.added > 0 ? 'ok' : 'warn'}`}>
          <h3 style={{ marginTop: 0 }}>取り込みの結果</h3>
          <p>
            追加 <strong>{result.added}問</strong>
            {result.duplicates > 0 && `／すでにある問題（同じ問題文）${result.duplicates}問は足していません`}
            {result.skipped > 0 && `／形が合わず取り込めなかったもの ${result.skipped}問`}
          </p>
          {result.errors.length > 0 && (
            <>
              <p className="muted">取り込めなかった理由（黙って捨てていません）：</p>
              <ul>
                {result.errors.slice(0, 20).map((e, i) => (
                  <li key={i} className="err">
                    {e}
                  </li>
                ))}
              </ul>
              {result.errors.length > 20 && <p className="muted">ほか {result.errors.length - 20}件</p>}
            </>
          )}
          {result.added > 0 && <ReviewChecks items={result.items} />}
        </div>
      )}
    </>
  );
}

function ReviewChecks({ items }) {
  const rows = reviewChecklist(items);
  return (
    <>
      <h3>取り込んだあとに人が見る所</h3>
      <p className="muted">
        合否を出しているのではありません。<strong>目を通す場所を指しているだけ</strong>です。
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>見る所</th>
              <th>件数</th>
              <th>なぜ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.label}</td>
                <td>{r.count}</td>
                <td className="muted">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function QuestionList({ state }) {
  const [query, setQuery] = useState('');
  const [onlyCheck, setOnlyCheck] = useState(false);
  const [limit, setLimit] = useState(50);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.questions.filter((item) => {
      if (onlyCheck && !item.needsCheck) return false;
      if (!q) return true;
      return `${item.question}${item.subject}${item.genre}${(item.tags || []).join('')}`.toLowerCase().includes(q);
    });
  }, [state.questions, query, onlyCheck]);

  if (state.questions.length === 0) {
    return (
      <div className="card">
        <p>まだ問題がありません。①でプロンプトを作り、AIの返答を②で取り込んでください。</p>
      </div>
    );
  }

  const json = exportJson(state.questions);

  return (
    <>
      <label className="field">
        <span>さがす</span>
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="問題文・科目・キーワード" />
      </label>
      <div className="chips">
        <button type="button" className={`chip ${onlyCheck ? 'on' : ''}`} onClick={() => setOnlyCheck((v) => !v)}>
          ※要確認だけ
        </button>
      </div>
      <p className="muted">
        {filtered.length}件（全{state.questions.length}件）
      </p>

      <CopyBox
        text={json}
        filename="questions.json"
        label="書き出し（自分で作るアプリに渡すファイル）"
        collapsed
      >
        <p className="muted">
          この JSON を、設計書といっしょに Claude Code へ渡してください（設計書に貼らず、別ファイルとして渡します）。
        </p>
      </CopyBox>

      <div className="card">
        {filtered.slice(0, limit).map((item) => (
          <div key={item.id} className="q-item">
            <div className="q-meta">
              {item.subject}
              {item.genre && `｜${item.genre}`}　{item.type === 'ox' ? '○×' : '択一'}
              {item.needsCheck && <span className="tag">※要確認</span>}
            </div>
            <p style={{ margin: '4px 0' }}>{item.question}</p>
            <ol style={{ margin: '4px 0' }}>
              {item.choices.map((c, i) => (
                <li key={i} style={i === item.answer ? { fontWeight: 700 } : undefined}>
                  {c}
                  {i === item.answer && ' ← 正解'}
                </li>
              ))}
            </ol>
            <p className="muted">{item.explanation}</p>
            <div>
              {(item.tags || []).map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
            <div className="btn-row">
              <button
                type="button"
                className="ghost small"
                onClick={() => {
                  if (window.confirm('この問題を消します。よろしいですか。')) actions.deleteQuestion(item.id);
                }}
              >
                消す
              </button>
            </div>
          </div>
        ))}
        {filtered.length > limit && (
          <div className="btn-row">
            <button type="button" onClick={() => setLimit((n) => n + 50)}>
              さらに表示（残り {filtered.length - limit}件）
            </button>
          </div>
        )}
      </div>
    </>
  );
}
