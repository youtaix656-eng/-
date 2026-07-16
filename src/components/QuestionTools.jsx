import { useMemo, useState } from 'react';
import { GENERATORS, generateQuestions, generateVariants } from '../lib/generator.js';
import { runAllChecks } from '../lib/checker.js';
import { REFERENCES } from '../data/knowledgeBase.js';

// 問題ツール：自動生成（KBテンプレート／既存問題の変形）と 誤りチェック（問題ドクター）
export default function QuestionTools({ store, onToast }) {
  const { questions, appendQuestions } = store;
  const [tab, setTab] = useState('generate');

  return (
    <div className="view">
      <h2 className="view-title">問題ツール</h2>
      <p className="view-desc">
        経穴マスタ（構造化データ）から問題を自動生成し、既存問題の誤りを点検します。
      </p>

      <div className="chip-row">
        <button
          className={`chip ${tab === 'generate' ? 'active' : ''}`}
          onClick={() => setTab('generate')}
        >
          自動生成
        </button>
        <button
          className={`chip ${tab === 'check' ? 'active' : ''}`}
          onClick={() => setTab('check')}
        >
          誤りチェック
        </button>
      </div>

      {tab === 'generate' ? (
        <Generate questions={questions} appendQuestions={appendQuestions} onToast={onToast} />
      ) : (
        <Check questions={questions} onToast={onToast} />
      )}

      <div className="section-label">参考文献</div>
      <div className="card">
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, lineHeight: 1.8, color: 'var(--text-sub)' }}>
          {REFERENCES.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ol>
        <p className="inline-note" style={{ marginTop: 10 }}>
          ⚠️ 自動生成・自動チェックはいずれも補助機能です。医療系の試験対策のため、
          出題プールに加える前に必ず内容をご自身（または有資格者）で確認してください。
        </p>
      </div>
    </div>
  );
}

// ===== 自動生成タブ =====
function Generate({ questions, appendQuestions, onToast }) {
  const allTypes = Object.keys(GENERATORS);
  const [selected, setSelected] = useState(allTypes);
  const [count, setCount] = useState(10);
  const [drafts, setDrafts] = useState([]);
  const [mode, setMode] = useState('kb'); // kb | variant

  const toggle = (t) =>
    setSelected((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const doGenerate = () => {
    let out;
    if (mode === 'kb') {
      out = generateQuestions({ types: selected, count });
    } else {
      // 既存の四択からランダムに選んで○×変形
      const pool = questions.filter((q) => q.type === 'choice');
      const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, count);
      out = generateVariants(picked, { perQuestion: 1 });
    }
    setDrafts(out);
    if (out.length === 0) onToast('生成対象がありませんでした');
  };

  const removeDraft = (id) => setDrafts((prev) => prev.filter((q) => q.id !== id));

  const adoptAll = () => {
    if (drafts.length === 0) return;
    // meta（generated等）は保存前に除去して通常の問題として取り込む
    const clean = drafts.map(stripMeta);
    appendQuestions(clean);
    onToast(`${clean.length}問を追加しました`);
    setDrafts([]);
  };

  return (
    <>
      <div className="card">
        <div className="chip-row">
          <button className={`chip ${mode === 'kb' ? 'active' : ''}`} onClick={() => setMode('kb')}>
            経穴マスタから生成
          </button>
          <button
            className={`chip ${mode === 'variant' ? 'active' : ''}`}
            onClick={() => setMode('variant')}
          >
            既存問題を○×に変形
          </button>
        </div>

        {mode === 'kb' && (
          <>
            <label className="section-label" style={{ marginTop: 6 }}>
              出題タイプ（複数選択可）
            </label>
            <div className="chip-row">
              {allTypes.map((t) => (
                <button
                  key={t}
                  className={`chip ${selected.includes(t) ? 'active' : ''}`}
                  onClick={() => toggle(t)}
                >
                  {GENERATORS[t].label}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="field" style={{ marginTop: 8, marginBottom: 8 }}>
          <label>生成数</label>
          <div className="range-row">
            <input
              type="range"
              min="1"
              max="30"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
            <span className="range-val">{count}問</span>
          </div>
        </div>

        <button
          className="btn primary block lg"
          onClick={doGenerate}
          disabled={mode === 'kb' && selected.length === 0}
        >
          生成する
        </button>
      </div>

      {drafts.length > 0 && (
        <>
          <div className="section-label">
            生成された下書き（{drafts.length}問）— 内容を確認して追加
          </div>
          {drafts.map((q) => (
            <div className="list-item" key={q.id}>
              <div className="li-subject">
                {q.subject}
                <span className="gen-badge">{q.source === 'variant-ox' ? '変形' : '自動生成'}</span>
              </div>
              <div className="li-q">{q.question}</div>
              <ol className="draft-choices">
                {q.choices.map((c, i) => (
                  <li key={i} className={i === q.answer ? 'correct' : ''}>
                    {c}
                    {i === q.answer && ' ✓'}
                  </li>
                ))}
              </ol>
              {q.explanation && <div className="li-memo">{q.explanation}</div>}
              <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => removeDraft(q.id)}>
                この問題を除く
              </button>
            </div>
          ))}
          <button className="btn accent block lg" onClick={adoptAll}>
            {drafts.length}問すべてを出題プールに追加
          </button>
        </>
      )}
    </>
  );
}

// ===== 誤りチェックタブ =====
function Check({ questions, onToast }) {
  const [result, setResult] = useState(null);
  const byId = useMemo(() => Object.fromEntries(questions.map((q) => [q.id, q])), [questions]);

  const run = () => {
    const r = runAllChecks(questions);
    setResult(r);
    if (r.summary.total === 0) onToast('問題は見つかりませんでした');
  };

  const sevLabel = { error: '要修正', warn: '要確認', info: '参考' };

  return (
    <>
      <div className="card">
        <p className="inline-note" style={{ marginBottom: 10 }}>
          収録中の {questions.length} 問を点検します（形式・重複・矛盾・経穴×経絡の照合）。
        </p>
        <button className="btn primary block lg" onClick={run}>
          点検する
        </button>
      </div>

      {result && (
        <>
          <div className="tiles">
            <div className="tile">
              <div className="num" style={{ color: 'var(--wrong)' }}>{result.summary.error}</div>
              <div className="lbl">要修正</div>
            </div>
            <div className="tile">
              <div className="num" style={{ color: 'var(--warn)' }}>{result.summary.warn}</div>
              <div className="lbl">要確認</div>
            </div>
            <div className="tile">
              <div className="num">{result.summary.info}</div>
              <div className="lbl">参考</div>
            </div>
          </div>

          {result.findings.length === 0 ? (
            <div className="empty">
              <div className="ico">✅</div>
              <p>指摘事項はありませんでした。</p>
            </div>
          ) : (
            result.findings.map((f, i) => {
              const q = byId[f.questionId];
              return (
                <div className={`list-item finding ${f.severity}`} key={i}>
                  <div className="finding-head">
                    <span className={`sev-badge ${f.severity}`}>{sevLabel[f.severity]}</span>
                    <span className="li-stat">{f.category}</span>
                  </div>
                  <div className="li-q">{q ? q.question || '（図の問題）' : f.questionId}</div>
                  <div className="finding-msg">{f.message}</div>
                </div>
              );
            })
          )}
        </>
      )}
    </>
  );
}

function stripMeta(q) {
  const { generated, source, confidence, tags, _base, ...rest } = q;
  return rest;
}
