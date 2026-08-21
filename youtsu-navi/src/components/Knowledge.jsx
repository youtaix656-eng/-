import React, { useMemo, useState } from 'react';
import { actions } from '../lib/useStore.js';
import {
  emptyNote, makeNote, validateNote, applyFirstCheck, applySecondCheck, rejectNote, reopenNote,
  dueForSecondCheck, filterNotes, sortNotes, summarizeKnowledge, toIndexItems, criticalUnchecked,
  isCheckComplete, notesToJson, STAGES, STAGE_ORDER, SOURCE_KINDS, SOURCE_KIND_MAP,
  FIRST_CHECK_ITEMS, SECOND_CHECK_ITEMS, TITLE_MAX, SUMMARY_MAX, PRACTICE_MAX,
} from '../lib/knowledge.js';
import { buildKanaIndex } from '../lib/yomi.js';
import { SOURCES } from '../data/sources.js';
import { SYMPTOMS, symptomById } from '../data/symptoms.js';
import { formatDate, formatDateTime, knowledgeFileName } from '../lib/exporter.js';
import { downloadText } from '../lib/share.js';
import VoiceMemo from './VoiceMemo.jsx';

/** 出典の1行表示 */
function SourceLine({ source }) {
  const kind = SOURCE_KIND_MAP[source.kind] || SOURCE_KIND_MAP.other;
  const parts = [source.author, source.locator].filter(Boolean).join('／');
  return (
    <p className="small muted" style={{ margin: 0 }}>
      {kind.icon} {source.title || '（出典なし）'}{parts ? `（${parts}）` : ''}
    </p>
  );
}

function StageBadge({ stage }) {
  const info = STAGES[stage] || STAGES.draft;
  return <span className={`stage-badge ${info.tone}`}>{info.icon} {info.label}</span>;
}

/** 取り込み・編集フォーム */
function NoteForm({ note, notes, symptomId, settings, onCancel, onSave }) {
  const [draft, setDraft] = useState(() => ({ ...emptyNote(0), ...note }));
  const [symptomFocus, setSymptomFocus] = useState(symptomId || 'lowback');

  const patch = (p) => setDraft((d) => ({ ...d, ...p }));
  const patchSource = (p) => setDraft((d) => ({ ...d, source: { ...d.source, ...p } }));
  const check = useMemo(() => validateNote(draft, { others: notes }), [draft, notes]);
  const kind = SOURCE_KIND_MAP[draft.source.kind] || SOURCE_KIND_MAP.other;
  const symptom = symptomById(symptomFocus);

  const toggle = (key, value) => {
    setDraft((d) => {
      const list = d[key] || [];
      return { ...d, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });
  };

  return (
    <div className="stack">
      <button type="button" className="btn slim secondary" onClick={onCancel}>← やめる</button>

      <div className="card">
        <h3>📥 学んだことを取り込む</h3>
        <p className="muted small">
          動画や本の文章をそのまま写さず、<strong>要点を自分の言葉で</strong>書いてください
          （書き写しは複製にあたります。ここは自分用の要約を貯める場所です）。
        </p>

        <label className="field">
          <span className="field-label">見出し（{TITLE_MAX}文字まで）</span>
          <input className="search" value={draft.title} maxLength={TITLE_MAX} placeholder="例：急性腰痛の安静" onChange={(e) => patch({ title: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">読み（ひらがな・漢字を含む見出しは必須）</span>
          <input className="search" value={draft.reading} maxLength={TITLE_MAX} placeholder="きゅうせいようつうのあんせい" onChange={(e) => patch({ reading: e.target.value })} />
        </label>
        <p className="small muted" style={{ margin: 0 }}>読みは目次で探すために使います（誤読を出さないため自動では付けません）。</p>

        <VoiceMemo
          label={`要約（自分の言葉で・${SUMMARY_MAX}文字まで）`}
          value={draft.summary}
          onChange={(v) => patch({ summary: v.slice(0, SUMMARY_MAX) })}
          rows={5}
          placeholder="何が言われていたか、要点だけ"
          settings={settings}
        />
        <p className="small muted" style={{ margin: 0 }}>{draft.summary.length} / {SUMMARY_MAX}文字</p>

        <VoiceMemo
          label={`施術での使いどころ（任意・${PRACTICE_MAX}文字まで）`}
          value={draft.practice}
          onChange={(v) => patch({ practice: v.slice(0, PRACTICE_MAX) })}
          rows={3}
          placeholder="どんな時に思い出したいか"
          settings={settings}
        />

        <button type="button" className="option" aria-pressed={draft.caution} onClick={() => patch({ caution: !draft.caution })}>
          <span className="mark" aria-hidden="true">{draft.caution ? '✓' : ''}</span>
          <span>
            <strong>※要確認を付ける</strong>
            <span className="muted small" style={{ display: 'block' }}>数字・解釈が分かれる内容、裏が取れていない内容に付けます。</span>
          </span>
        </button>
      </div>

      <div className="card">
        <h3>📚 出典</h3>
        <p className="muted small">どこで知ったかを必ず残します。あとから確認し直せない知識は提案に出しません。</p>
        <div className="chips">
          {SOURCE_KINDS.map((k) => (
            <button key={k.id} type="button" className={`chip-btn${draft.source.kind === k.id ? ' on' : ''}`} aria-pressed={draft.source.kind === k.id} onClick={() => patchSource({ kind: k.id })}>
              {k.icon} {k.label}
            </button>
          ))}
        </div>
        <label className="field">
          <span className="field-label">出典名（動画名・書名など）</span>
          <input className="search" value={draft.source.title} placeholder="例：腰痛診療ガイドライン2019" onChange={(e) => patchSource({ title: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">著者・発信者</span>
          <input className="search" value={draft.source.author} placeholder="例：日本整形外科学会" onChange={(e) => patchSource({ author: e.target.value })} />
        </label>
        <label className="field">
          <span className="field-label">{kind.locatorLabel}</span>
          <input className="search" value={draft.source.locator} placeholder={kind.locatorHint} onChange={(e) => patchSource({ locator: e.target.value })} />
        </label>
        <details className="acc">
          <summary>収録済みの出典と結び付ける（任意）</summary>
          <div className="chips">
            {SOURCES.map((s) => {
              const on = (draft.source.sourceIds || []).includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`chip-btn${on ? ' on' : ''}`}
                  aria-pressed={on}
                  onClick={() => patchSource({
                    sourceIds: on ? draft.source.sourceIds.filter((x) => x !== s.id) : [...(draft.source.sourceIds || []), s.id],
                  })}
                >
                  {s.tocTitle}
                </button>
              );
            })}
          </div>
        </details>
      </div>

      <div className="card">
        <h3>🔗 どんな時に思い出したいか</h3>
        <p className="muted small">
          結び付けた推定パターン・入力内容が結果画面に出た時だけ、このメモを「参考」として表示します
          （何も選ばないと、結果画面には出ません）。
        </p>
        <div className="chips">
          {SYMPTOMS.map((s) => (
            <button key={s.id} type="button" className={`chip-btn${symptomFocus === s.id ? ' on' : ''}`} onClick={() => setSymptomFocus(s.id)}>
              {s.icon} {s.name}
            </button>
          ))}
        </div>
        <button type="button" className="option" aria-pressed={(draft.symptomIds || []).includes(symptomFocus)} onClick={() => toggle('symptomIds', symptomFocus)}>
          <span className="mark" aria-hidden="true">{(draft.symptomIds || []).includes(symptomFocus) ? '✓' : ''}</span>
          <span>{symptom.name}全体に関わる内容として扱う</span>
        </button>

        <details className="acc" open>
          <summary>推定パターンと結び付ける（{(draft.patternIds || []).length}件選択中）</summary>
          <div className="chips">
            {symptom.patterns.map((p) => {
              const on = (draft.patternIds || []).includes(p.id);
              return (
                <button key={p.id} type="button" className={`chip-btn${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle('patternIds', p.id)}>
                  {p.name}
                </button>
              );
            })}
          </div>
        </details>

        <details className="acc">
          <summary>入力内容（お客様の状態）と結び付ける（{(draft.tags || []).length}件選択中）</summary>
          {symptom.fields.filter((f) => Array.isArray(f.options) && f.options.length > 0).map((f) => (
            <div key={f.id}>
              <p className="section-title">{f.label}</p>
              <div className="chips">
                {f.options.map((o) => {
                  const tag = (o.tags || [])[0];
                  if (!tag) return null;
                  const on = (draft.tags || []).includes(tag);
                  return (
                    <button key={o.value} type="button" className={`chip-btn${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle('tags', tag)}>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </details>
      </div>

      {check.errors.length > 0 && (
        <div className="alert danger">
          <strong>まだ保存できません</strong>
          <ul className="list tight alert-body small">
            {check.errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}
      {check.warnings.length > 0 && (
        <div className="alert warn">
          <strong>確認してください</strong>
          <ul className="list tight alert-body small">
            {check.warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}

      <button type="button" className="btn" disabled={!check.ok} onClick={() => onSave(draft)}>
        {note.id ? '保存する' : '下書きとして保存する'}
      </button>
      <p className="small muted center">保存しても、二段階チェックを通るまで結果画面には出ません。</p>
    </div>
  );
}

/** チェックリスト1つ分 */
function CheckList({ items, answers, onToggle, disabled }) {
  return (
    <div className="options">
      {items.map((i) => (
        <button
          key={i.id}
          type="button"
          className={`option${i.critical ? ' alarm' : ''}`}
          aria-pressed={Boolean(answers[i.id])}
          disabled={disabled}
          onClick={() => onToggle(i.id)}
        >
          <span className="mark" aria-hidden="true">{answers[i.id] ? '✓' : ''}</span>
          <span>
            {i.label}
            {i.critical && <span className="muted small" style={{ display: 'block' }}>ここが確認できない場合は見送りになります。</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

/** 詳細＋二段階チェック */
function NoteDetail({ note, notes, onBack, onEdit }) {
  const [first, setFirst] = useState({});
  const [second, setSecond] = useState({});
  const [rejectMemo, setRejectMemo] = useState('');
  const [status, setStatus] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const v = useMemo(() => validateNote(note, { others: notes }), [note, notes]);
  const stage = STAGES[note.stage] || STAGES.draft;
  const firstAt = note.checks?.first?.at || 0;
  const canSecondToday = firstAt > 0 && Date.now() - firstAt >= 20 * 60 * 60 * 1000;
  const critical = criticalUnchecked(second);
  const flash = (m) => { setStatus(m); setTimeout(() => setStatus(''), 4000); };

  const doFirst = () => {
    const r = applyFirstCheck(note, first, { at: Date.now(), others: notes });
    if (!r.ok) { flash(r.reason); return; }
    actions.putNote(r.note);
    flash('第1チェックを記録しました。日を改めて第2チェックを行ってください。');
  };
  const doSecond = () => {
    const r = applySecondCheck(note, second, { at: Date.now() });
    if (!r.ok) { flash(r.reason); return; }
    actions.putNote(r.note);
    flash(r.rejected ? r.reason : `運用中にしました${r.sameDay ? '（同じ日の見直しとして記録しました）' : ''}。結果画面に参考として出ます。`);
  };

  return (
    <div className="stack">
      <button type="button" className="btn slim secondary" onClick={onBack}>← 知識ベースへ</button>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <StageBadge stage={note.stage} />
          {note.caution && <span className="stage-badge warn">※要確認</span>}
        </div>
        <h2 style={{ marginBottom: 0 }}>{note.title}</h2>
        {note.reading && <p className="small muted" style={{ margin: 0 }}>{note.reading}</p>}
        <p style={{ whiteSpace: 'pre-wrap' }}>{note.summary}</p>
        {note.practice && (
          <div>
            <p className="section-title">施術での使いどころ</p>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{note.practice}</p>
          </div>
        )}
        <div>
          <p className="section-title">出典</p>
          <SourceLine source={note.source} />
        </div>
        <p className="small muted" style={{ margin: 0 }}>{stage.desc}</p>
      </div>

      {v.warnings.length > 0 && (
        <div className="alert warn">
          <strong>書き方の確認</strong>
          <ul className="list tight alert-body small">{v.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      <div className="card">
        <h3>🔍 第1チェック（取り込んだ本人の確認）</h3>
        {note.checks?.first ? (
          <p className="small" style={{ margin: 0 }}>✅ {formatDateTime(note.checks.first.at)} に完了</p>
        ) : (
          <>
            <p className="muted small">見聞きしたことをそのまま提案に混ぜないための1段階目です。</p>
            <CheckList items={FIRST_CHECK_ITEMS} answers={first} onToggle={(id) => setFirst((a) => ({ ...a, [id]: !a[id] }))} />
            <button type="button" className="btn" disabled={!isCheckComplete(FIRST_CHECK_ITEMS, first) || !v.ok} onClick={doFirst}>
              第1チェックを完了する
            </button>
            {!v.ok && <p className="notice-inline">先に内容を直してください：{v.errors[0]}</p>}
          </>
        )}
      </div>

      {note.checks?.first && (
        <div className="card">
          <h3>🧪 第2チェック（日を改めた裏取り）</h3>
          {note.checks?.second ? (
            <>
              <p className="small" style={{ margin: 0 }}>
                {note.stage === 'active' ? '✅' : '🚫'} {formatDateTime(note.checks.second.at)} に実施
                {note.checks.second.sameDay ? '（同じ日の見直し）' : ''}
              </p>
              {note.checks.second.memo && <p className="small muted" style={{ margin: '4px 0 0' }}>メモ：{note.checks.second.memo}</p>}
              <button type="button" className="btn secondary" onClick={() => { actions.putNote(reopenNote(note, { at: Date.now() })); flash('下書きに戻しました。直してから、もう一度チェックしてください。'); }}>
                下書きに戻してやり直す
              </button>
            </>
          ) : (
            <>
              {!canSecondToday && (
                <p className="notice-inline">
                  第1チェックから間もないため、<strong>日を改めてから</strong>の確認をおすすめします
                  （同じ日に続けて見直すと、同じ見落としを繰り返しやすいためです）。このまま進めた場合は「同じ日の見直し」として記録します。
                </p>
              )}
              <CheckList items={SECOND_CHECK_ITEMS} answers={second} onToggle={(id) => setSecond((a) => ({ ...a, [id]: !a[id] }))} />
              {critical.length > 0 && Object.keys(second).length > 0 && (
                <p className="notice-inline">「{critical[0].label}」が外れています。このまま進めると見送りになります。</p>
              )}
              <button type="button" className="btn" onClick={doSecond}>
                {critical.length > 0 ? '見送りとして記録する' : '第2チェックを完了して運用に入れる'}
              </button>
              <details className="acc">
                <summary>この内容は使わない（見送りにする）</summary>
                <label className="field">
                  <span className="field-label">理由（任意・次に活かすために残します）</span>
                  <textarea className="share-text" rows={2} value={rejectMemo} onChange={(e) => setRejectMemo(e.target.value)} placeholder="例：一次情報が見つからなかった" />
                </label>
                <button type="button" className="btn danger" onClick={() => { actions.putNote(rejectNote(note, { at: Date.now(), memo: rejectMemo })); flash('見送りとして記録しました。'); }}>
                  見送りにする
                </button>
              </details>
            </>
          )}
        </div>
      )}

      {status && <p className="notice-inline">{status}</p>}

      <div className="card">
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn slim secondary" onClick={onEdit}>✏️ 編集する</button>
          {/* 第2チェック済みの時は、そのカード側に同じボタンがあるので重ねて出さない */}
          {note.stage !== 'draft' && !note.checks?.second && (
            <button type="button" className="btn slim secondary" onClick={() => { actions.putNote(reopenNote(note, { at: Date.now() })); flash('下書きに戻しました。'); }}>
              ↩ 下書きに戻す
            </button>
          )}
        </div>
        {!confirmDelete ? (
          <button type="button" className="btn danger" onClick={() => setConfirmDelete(true)}>このメモを削除</button>
        ) : (
          <div className="stack">
            <p className="small">削除すると元に戻せません。使わないだけなら「見送り」にしておくと記録が残ります。</p>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <button type="button" className="btn secondary" onClick={() => setConfirmDelete(false)}>いいえ</button>
              <button type="button" className="btn danger" onClick={() => { actions.deleteNote(note.id); onBack(); }}>はい、削除する</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 知識ベース（Phase 3）— 二段階チェックを通ったものだけが結果画面に出る */
export default function Knowledge({ state, go }) {
  const [mode, setMode] = useState('list'); // 'list' | 'form' | 'detail'
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('all');
  const [kind, setKind] = useState('all');

  const notes = useMemo(() => sortNotes(state.knowledge || []), [state.knowledge]);
  const stats = useMemo(() => summarizeKnowledge(notes, Date.now()), [notes]);
  const due = useMemo(() => dueForSecondCheck(notes, Date.now()), [notes]);
  const shown = useMemo(() => filterNotes(notes, { query, stage, kind }), [notes, query, stage, kind]);
  const sections = useMemo(() => buildKanaIndex(toIndexItems(shown)), [shown]);
  const byId = useMemo(() => Object.fromEntries(notes.map((n) => [n.id, n])), [notes]);
  const current = openId ? byId[openId] : null;

  if (mode === 'form') {
    return (
      <div className="page">
        <NoteForm
          note={editing || emptyNote(0)}
          notes={notes}
          symptomId={state.settings.symptomId}
          settings={state.settings}
          onCancel={() => { setMode(current ? 'detail' : 'list'); setEditing(null); }}
          onSave={(draft) => {
            const at = Date.now();
            if (editing && editing.id) {
              actions.putNote({ ...makeNote(draft, { at: editing.at, seed: 0 }), id: editing.id, at: editing.at, updatedAt: at, stage: editing.stage, checks: editing.checks });
              setOpenId(editing.id);
              setMode('detail');
            } else {
              const saved = actions.addNote(draft, { seed: Math.floor(performance.now()) });
              setOpenId(saved.id);
              setMode('detail');
            }
            setEditing(null);
          }}
        />
      </div>
    );
  }

  if (mode === 'detail' && current) {
    return (
      <div className="page">
        {/* 段階が変わったら作り直す＝チェックリストの選択状態を持ち越さない
            （下書きに戻したのに前のチェックが残っていると、二段階チェックの意味がなくなる） */}
        <NoteDetail
          key={`${current.id}:${current.stage}`}
          note={current}
          notes={notes}
          onBack={() => { setMode('list'); setOpenId(null); }}
          onEdit={() => { setEditing(current); setMode('form'); }}
        />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <h2>📚 知識ベース</h2>
        <p className="muted small">
          動画・書籍・研修で学んだことを、<strong>自分の言葉の要約＋出典</strong>で貯めます。
          見聞きしたことをそのまま提案に混ぜないよう、<strong>二段階のチェック</strong>を通ったものだけが
          結果画面に「参考メモ」として出ます。この端末の中にだけ保存されます。
        </p>
        {notes.length > 0 && (
          <p className="small" style={{ margin: 0 }}>
            全{stats.total}件／📝下書き {stats.draft}・🔍第1チェック済み {stats.checked}・✅運用中 {stats.active}・🚫見送り {stats.rejected}
          </p>
        )}
        <button type="button" className="btn" onClick={() => { setEditing(null); setMode('form'); }}>＋ 学んだことを取り込む</button>
      </div>

      {due.length > 0 && (
        <div className="card">
          <h3>🧪 今日の見直し（{due.length}件）</h3>
          <p className="muted small">第1チェックから日が空きました。裏取りの第2チェックに進めます。</p>
          <div className="stack">
            {due.slice(0, 5).map((n) => (
              <button key={n.id} type="button" className="toc-item" onClick={() => { setOpenId(n.id); setMode('detail'); }}>
                <span className="toc-icon" aria-hidden="true">🧪</span>
                <span className="toc-text">
                  <span className="toc-title">{n.title}</span>
                  <span className="toc-sub">第1チェック {formatDate(n.checks.first.at)}</span>
                </span>
                <span className="toc-arrow" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <div className="card">
          <h3>使い方</h3>
          <ol className="list">
            <li><strong>取り込む</strong> — 見出し・自分の言葉の要約・出典を入れて下書き保存。</li>
            <li><strong>第1チェック</strong> — 書き写しになっていないか、言い切っていないかを自分で確認。</li>
            <li><strong>第2チェック</strong> — <strong>日を改めて</strong>、ガイドラインと矛盾しないか、
              受診をすすめる判断（レッドフラグ）を弱めていないかを確認。</li>
            <li>通ったメモだけが、関係する結果画面に「参考」として出ます。</li>
          </ol>
          <p className="notice-inline">
            動画や本の文章をそのまま貼り付ける場所ではありません（複製にあたります）。要点を自分の言葉で書いてください。
          </p>
        </div>
      ) : (
        <>
          <div className="card">
            <input className="search" type="search" value={query} placeholder="見出し・要約・出典で探す" onChange={(e) => setQuery(e.target.value)} aria-label="知識ベースを検索" />
            <div className="chips">
              <button type="button" className={`chip-btn${stage === 'all' ? ' on' : ''}`} onClick={() => setStage('all')}>すべて</button>
              {STAGE_ORDER.map((id) => (
                <button key={id} type="button" className={`chip-btn${stage === id ? ' on' : ''}`} aria-pressed={stage === id} onClick={() => setStage(id)}>
                  {STAGES[id].icon} {STAGES[id].label}（{stats[id]}）
                </button>
              ))}
            </div>
            <div className="chips">
              <button type="button" className={`chip-btn${kind === 'all' ? ' on' : ''}`} onClick={() => setKind('all')}>出典すべて</button>
              {SOURCE_KINDS.map((k) => (
                <button key={k.id} type="button" className={`chip-btn${kind === k.id ? ' on' : ''}`} onClick={() => setKind(k.id)}>
                  {k.icon} {k.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn slim secondary"
              onClick={() => downloadText(knowledgeFileName(Date.now()), notesToJson(notes), 'application/json')}
            >
              💾 知識ベースをバックアップ
            </button>
          </div>

          {sections.length === 0 && <p className="muted">条件に合うメモがありません。</p>}
          {sections.map((sec) => (
            <div className="card" key={sec.group}>
              <p className="section-title">{sec.group}</p>
              <div className="stack">
                {sec.items.map((item) => {
                  const n = byId[item.id];
                  if (!n) return null;
                  const info = STAGES[n.stage] || STAGES.draft;
                  return (
                    <button key={n.id} type="button" className="toc-item" onClick={() => { setOpenId(n.id); setMode('detail'); }}>
                      <span className="toc-icon" aria-hidden="true">{info.icon}</span>
                      <span className="toc-text">
                        <span className="toc-title">{n.title}{n.caution && <span className="pain-badge">※要確認</span>}</span>
                        <span className="toc-sub">
                          {info.label}／{(SOURCE_KIND_MAP[n.source.kind] || SOURCE_KIND_MAP.other).label}
                          {n.source.title ? `／${n.source.title}` : ''}
                        </span>
                      </span>
                      <span className="toc-arrow" aria-hidden="true">›</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      <p className="notice-inline">
        ここに貯めた内容は、アプリが最初から持っているガイドライン由来の情報とは区別して表示されます。
        施術の判断は、必ず施術者ご自身で行ってください。
      </p>
    </div>
  );
}
