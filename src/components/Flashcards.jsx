import { useEffect, useMemo, useState } from 'react';
import { KEIKETSU_CARDS, YOUKETSU_TABLE } from '../data/keiketsuCards.js';
import { figureFor } from '../data/figures.jsx';
import { CHOICE_QUIZ_SUBJECTS, subjectMatches } from '../data/examScope.js';
import { loadFlashcardSrs, gradeFlashcard, weakCardIds, cardMastered, cardWrongCount } from '../lib/flashcardSrs.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const KEIKETSU_MODE = '__keiketsu__';

// フラッシュカード：経穴専用カード（既存）＋ 全科目対応（一問一答の問題から自動生成）。
// 表＝問題文／裏＝正解＋解説。タップで裏返し、前後で移動。
export default function Flashcards({ store, onNavigate }) {
  const questions = store?.questions || [];
  const [mode, setMode] = useState(KEIKETSU_MODE);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // 経穴カードのSRS（③）：「覚えた/まだ」を記録し、苦手だけに絞れる。
  //   一問一答の本体SRSとは別データ（経穴カードはquestionsに属さないため）。
  const [cardSrs, setCardSrs] = useState({});
  const [weakOnly, setWeakOnly] = useState(false);
  useEffect(() => { loadFlashcardSrs().then(setCardSrs); }, []);

  const genericCards = useMemo(() => {
    if (mode === KEIKETSU_MODE) return [];
    return shuffle(questions.filter((q) => subjectMatches(q.subject, { name: mode })));
  }, [mode, questions]);

  const keiketsuCards = useMemo(() => {
    if (!weakOnly) return KEIKETSU_CARDS;
    const weakIds = new Set(weakCardIds(cardSrs, KEIKETSU_CARDS.map((c) => c.id)));
    const filtered = KEIKETSU_CARDS.filter((c) => weakIds.has(c.id));
    return filtered.length > 0 ? filtered : KEIKETSU_CARDS;
  }, [weakOnly, cardSrs]);

  useEffect(() => {
    setIdx(0);
    setFlipped(false);
  }, [mode, weakOnly]);

  const isKeiketsu = mode === KEIKETSU_MODE;
  const cards = isKeiketsu ? keiketsuCards : genericCards;
  // cards配列がidx変更より先に切り替わる描画（フィルタ切替直後など）でも範囲外参照にならないよう、
  // 表示に使うindexはその場でクランプする（idx自体のリセットはuseEffect側で行う）。
  const safeIdx = Math.min(idx, Math.max(0, cards.length - 1));
  const card = cards[safeIdx];
  const Fig = isKeiketsu && card?.figure ? figureFor(card.figure) : null;

  const go = (d) => {
    if (cards.length === 0) return;
    setFlipped(false);
    setIdx((i) => (i + d + cards.length) % cards.length);
  };

  const gradeCurrent = async (correct) => {
    if (!card) return;
    const next = await gradeFlashcard(card.id, correct);
    setCardSrs(next);
    go(1);
  };

  return (
    <div className="view">
      <h2 className="view-title">フラッシュカード</h2>
      <p className="view-desc">
        表を見て思い出し、タップで答えを確認します。科目を選べば、一問一答の問題からその場でカードを作ります。
      </p>

      {isKeiketsu && (
        <div className="btn-row" style={{ marginBottom: 10 }}>
          <button className="btn ghost block" onClick={() => onNavigate && onNavigate('acupointtap')}>
            🗺️ 体表イラストでタップして覚える
          </button>
          <button className="btn ghost block" onClick={() => onNavigate && onNavigate('keiketsureverse')}>
            🩺 症状から経穴を当てる
          </button>
          <button className="btn ghost block" onClick={() => onNavigate && onNavigate('keiketsulibrary')}>
            📚 教科書ライブラリ
          </button>
          <button className="btn ghost block" onClick={() => onNavigate && onNavigate('keizetsuindex')}>
            🔖 索引・目次から探す
          </button>
          <button className="btn ghost block" onClick={() => onNavigate && onNavigate('keizetsutextbook')}>
            📖 教科書目次（ページ順・出題頻度つき）
          </button>
          <button className="btn ghost block" onClick={() => onNavigate && onNavigate('keizetsupageimages')}>
            📷 教科書ページ写真（端末内限定）
          </button>
        </div>
      )}

      <div className="field" style={{ marginBottom: 14 }}>
        <label>科目</label>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value={KEIKETSU_MODE}>経穴カード（経絡・部位・主治／361穴へ拡充予定）</option>
          {CHOICE_QUIZ_SUBJECTS.map((s) => (
            <option key={s.name} value={s.name}>{s.label}</option>
          ))}
        </select>
      </div>

      {isKeiketsu && (
        <label className="switch-row" style={{ marginBottom: 10 }}>
          <input type="checkbox" checked={weakOnly} onChange={(e) => setWeakOnly(e.target.checked)} />
          <span>苦手なカードだけ出す（「まだ」を選んだカード）</span>
        </label>
      )}

      {cards.length === 0 ? (
        <div className="empty">
          <div className="ico">🃏</div>
          <p>この科目のカードはまだありません。</p>
        </div>
      ) : (
        <>
          <div className="fc-counter">{safeIdx + 1} / {cards.length}</div>

          <button className={`fc-card${flipped ? ' flipped' : ''}`} onClick={() => setFlipped((f) => !f)}>
            {isKeiketsu ? (
              !flipped ? (
                <div className="fc-front">
                  <div className="fc-name">{card.name}</div>
                  <div className="fc-yomi">{card.yomi}</div>
                  <div className="fc-tap">タップで答えを見る</div>
                </div>
              ) : (
                <div className="fc-back">
                  <div className="fc-back-name">{card.name}（{card.yomi}）</div>
                  {Fig && <Fig />}
                  <table className="fc-table">
                    <tbody>
                      <tr><th>経絡</th><td>{card.meridian}{card.ryaku ? `（${card.ryaku}）` : ''}</td></tr>
                      {card.type && <tr><th>分類</th><td>{card.type}</td></tr>}
                      <tr><th>部位・取穴</th><td>{card.location}</td></tr>
                      <tr><th>主治</th><td>{card.shuji}</td></tr>
                    </tbody>
                  </table>
                </div>
              )
            ) : !flipped ? (
              <div className="fc-front">
                <div className="fc-name" style={{ fontSize: 16, lineHeight: 1.5, fontWeight: 500 }}>
                  {card.question}
                </div>
                <div className="fc-tap">タップで答えを見る</div>
              </div>
            ) : (
              <div className="fc-back">
                <div className="fc-back-name">{card.choices[card.answer]}</div>
                {card.explanation && (
                  <p style={{ fontSize: 13, lineHeight: 1.6, marginTop: 10, textAlign: 'left' }}>
                    {card.explanation}
                  </p>
                )}
              </div>
            )}
          </button>

          {isKeiketsu && flipped && (
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className="btn block" onClick={() => gradeCurrent(false)}>😵 まだ</button>
              <button className="btn primary block" onClick={() => gradeCurrent(true)}>😄 覚えた</button>
            </div>
          )}
          {isKeiketsu && cardWrongCount(cardSrs, card.id) > 0 && (
            <p className="inline-note" style={{ textAlign: 'center', marginTop: 6 }}>
              {cardMastered(cardSrs, card.id) ? '✅ マスター済み' : `これまで「まだ」${cardWrongCount(cardSrs, card.id)}回`}
            </p>
          )}

          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn block" onClick={() => go(-1)}>← 前へ</button>
            <button className="btn block" onClick={() => setFlipped((f) => !f)}>🔄 裏返す</button>
            <button className="btn primary block" onClick={() => go(1)}>次へ →</button>
          </div>
        </>
      )}

      {isKeiketsu && (
        <>
          <p className="inline-note" style={{ marginTop: 10 }}>
            ※ 現在は{KEIKETSU_CARDS.length}枚（督脈28穴・任脈24穴・手の太陰肺経11穴・手の陽明大腸経20穴・足の陽明胃経45穴・足の太陰脾経21穴を完全収録）。今後361穴へ拡充していきます。
          </p>
          {/* 早見表（図や表も追加） */}
          <div className="section-label">📋 {YOUKETSU_TABLE.title}</div>
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="fc-youketsu">
              <thead>
                <tr>{YOUKETSU_TABLE.columns.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {YOUKETSU_TABLE.rows.map((r, i) => (
                  <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="inline-note">
            四総穴の語呂：「肚腹（おなか）は三里、腰背は委中、頭項は列缺、面口は合谷」。
          </p>
        </>
      )}
    </div>
  );
}
