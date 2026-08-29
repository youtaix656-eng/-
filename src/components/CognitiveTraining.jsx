import { useEffect, useMemo, useRef, useState } from 'react';
import { TRAINING_GAMES } from '../lib/cognitiveProfile.js';
import { speak, cancelSpeech, isSpeechSupported, wait } from '../lib/speech.js';

// 認知特性そのものを鍛える専用トレーニング集。鍼灸国家試験の問題データには
// 依存しない（ここだけは独立したミニゲーム・練習ツールとして完結させる）。
// 汎用の単語だけを使い、専門知識が無くても遊べるようにしてある。
const WORD_BANK = [
  'りんご', '電車', '傘', '机', '海', '鳥', '花', '時計', '山', '本',
  '靴', '窓', '雲', '橋', '鏡', '布団', '自転車', 'コップ', '鉛筆', '地図',
  '扇風機', '冷蔵庫', '切手', '貝殻', '風船', '手紙', '階段', '砂時計', '虹', '灯台',
];
const pickRandom = (arr, n) => {
  const pool = [...arr];
  const out = [];
  while (out.length < n && pool.length > 0) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
};

export default function CognitiveTraining({ initialMode, onConsumeInitialMode }) {
  const [mode, setMode] = useState(null);

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
      onConsumeInitialMode?.();
    }
  }, [initialMode, onConsumeInitialMode]);

  const gamesBySection = useMemo(() => {
    const map = new Map();
    for (const g of TRAINING_GAMES) {
      if (!map.has(g.section)) map.set(g.section, []);
      map.get(g.section).push(g);
    }
    return map;
  }, []);

  if (!mode) {
    return (
      <div className="view">
        <h2 className="view-title">認知特性トレーニング</h2>
        <p className="view-desc">
          鍼灸国家試験の問題演習とは切り離した、認知特性そのものを鍛えるミニトレーニング集です。
          汎用の言葉だけを使うので、勉強の合間の気分転換にもどうぞ。
        </p>
        {[...gamesBySection.entries()].map(([section, games]) => (
          <div className="card" key={section}>
            <div className="section-label" style={{ marginTop: 0 }}>{section}</div>
            {games.map((g) => (
              <button
                key={g.id}
                className="menu-item wide"
                style={{ marginTop: 8 }}
                onClick={() => setMode(g.mode)}
              >
                <span className="ico">🎮</span>
                <span className="title">{g.title}（{g.type}）</span>
                <span className="desc">{g.desc}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  }

  const game = TRAINING_GAMES.find((g) => g.mode === mode);
  return (
    <div className="view">
      <button className="btn ghost sm" onClick={() => setMode(null)}>← メニューに戻る</button>
      <h2 className="view-title" style={{ marginTop: 10 }}>{game?.title || 'トレーニング'}</h2>
      {game?.desc && <p className="view-desc">{game.desc}</p>}
      {mode === 'spatial-memory' && <SpatialMemoryGame />}
      {mode === 'sequence-memory' && <SequenceMemoryGame />}
      {mode === 'story-builder' && <StoryBuilder />}
      {mode === 'assoc-chain' && <AssocChainGame />}
      {mode === 'read-copy' && <ReadCopyTrainer />}
      {mode === 'summarize' && <SummarizeTrainer />}
      {mode === 'fill-blank' && <FillBlankTrainer />}
      {mode === 'kanji-breakdown' && <KanjiBreakdownNote />}
      {mode === 'shadowing' && <ShadowingGuide />}
      {mode === 'qa-pacing' && <QaPacingMode />}
    </div>
  );
}

// ===== 1. 空間記憶ゲーム（3D空間タイプ）=====
// グリッドの光る位置と順番を覚えて、同じ順にタップする（スパンタスク）。
function SpatialMemoryGame() {
  const GRID = 16; // 4x4
  const [level, setLevel] = useState(3);
  const [sequence, setSequence] = useState([]);
  const [activeCell, setActiveCell] = useState(null);
  const [userSeq, setUserSeq] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | showing | input | correct | wrong
  const [best, setBest] = useState(0);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const startRound = (lvl) => {
    const cells = pickRandom(Array.from({ length: GRID }, (_, i) => i), lvl);
    setSequence(cells);
    setUserSeq([]);
    setStatus('showing');
    timers.current.forEach(clearTimeout);
    timers.current = [];
    cells.forEach((cell, i) => {
      timers.current.push(setTimeout(() => setActiveCell(cell), i * 700));
      timers.current.push(setTimeout(() => setActiveCell(null), i * 700 + 500));
    });
    timers.current.push(setTimeout(() => setStatus('input'), cells.length * 700));
  };

  const handleClick = (i) => {
    if (status !== 'input') return;
    const idx = userSeq.length;
    const next = [...userSeq, i];
    setUserSeq(next);
    if (sequence[idx] !== i) {
      setStatus('wrong');
      setBest((b) => Math.max(b, level - 1));
      return;
    }
    if (next.length === sequence.length) {
      setStatus('correct');
      setBest((b) => Math.max(b, level));
    }
  };

  return (
    <div className="card">
      <p className="inline-note" style={{ marginTop: 0 }}>
        レベル {level}（同時に覚えるマスの数）・自己ベスト {best}
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          maxWidth: 320,
          margin: '0 auto 12px',
        }}
      >
        {Array.from({ length: GRID }, (_, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            disabled={status !== 'input'}
            style={{
              aspectRatio: '1 / 1',
              borderRadius: 8,
              border: 'none',
              background: activeCell === i ? 'var(--accent, #4a9eff)' : 'var(--surface-2, #333)',
              cursor: status === 'input' ? 'pointer' : 'default',
            }}
          />
        ))}
      </div>
      {status === 'idle' && (
        <button className="btn primary block" onClick={() => startRound(level)}>▶ スタート</button>
      )}
      {status === 'showing' && <p className="inline-note" style={{ textAlign: 'center' }}>よく見て覚えてください…</p>}
      {status === 'input' && (
        <p className="inline-note" style={{ textAlign: 'center' }}>
          覚えた順にタップ（{userSeq.length}/{sequence.length}）
        </p>
      )}
      {status === 'correct' && (
        <>
          <p className="inline-note" style={{ textAlign: 'center', color: 'var(--correct)' }}>正解！レベルアップ</p>
          <button className="btn primary block" onClick={() => { setLevel((l) => l + 1); startRound(level + 1); }}>
            次のレベルへ（{level + 1}）
          </button>
        </>
      )}
      {status === 'wrong' && (
        <>
          <p className="inline-note" style={{ textAlign: 'center', color: 'var(--wrong)' }}>
            順番が違いました。正解は {sequence.length + 1 > level ? '' : ''}レベル{level}でした。
          </p>
          <button className="btn block" onClick={() => { setLevel(3); setStatus('idle'); }}>レベル3からやり直す</button>
        </>
      )}
    </div>
  );
}

// ===== 2. 順序記憶ゲーム（3D×体感タイプ）=====
// 1つずつ表示される言葉を覚え、あとで同じ順番に並べ直す（言語版スパンタスク）。
function SequenceMemoryGame() {
  const [count, setCount] = useState(4);
  const [words, setWords] = useState([]);
  const [phase, setPhase] = useState('idle'); // idle | showing | answer | result
  const [showIdx, setShowIdx] = useState(0);
  const [order, setOrder] = useState([]);
  const [pool, setPool] = useState([]);

  const start = () => {
    const picked = pickRandom(WORD_BANK, count);
    setWords(picked);
    setShowIdx(0);
    setPhase('showing');
  };

  useEffect(() => {
    if (phase !== 'showing') return undefined;
    if (showIdx >= words.length) {
      const t = setTimeout(() => {
        setPool(pickRandom(words, words.length)); // 選択肢はシャッフルして提示
        setOrder([]);
        setPhase('answer');
      }, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setShowIdx((i) => i + 1), 1100);
    return () => clearTimeout(t);
  }, [phase, showIdx, words]);

  const pick = (w) => {
    if (order.includes(w)) return;
    const next = [...order, w];
    setOrder(next);
    if (next.length === words.length) setPhase('result');
  };

  const correctCount = order.filter((w, i) => w === words[i]).length;

  return (
    <div className="card">
      <div className="chip-row" style={{ marginBottom: 10 }}>
        {[3, 4, 5, 6].map((n) => (
          <button key={n} className={`chip ${count === n ? 'active' : ''}`} onClick={() => setCount(n)} disabled={phase !== 'idle'}>
            {n}語
          </button>
        ))}
      </div>
      {phase === 'idle' && <button className="btn primary block" onClick={start}>▶ スタート</button>}
      {phase === 'showing' && (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <div style={{ fontSize: '1.6em', fontWeight: 700 }}>{words[showIdx] ?? '…'}</div>
          <p className="hint">{showIdx + 1} / {words.length}</p>
        </div>
      )}
      {phase === 'answer' && (
        <>
          <p className="inline-note" style={{ marginTop: 0 }}>表示された順にタップしてください（{order.length}/{words.length}）</p>
          <div className="chip-row">
            {pool.map((w) => (
              <button key={w} className={`chip ${order.includes(w) ? 'active' : ''}`} disabled={order.includes(w)} onClick={() => pick(w)}>
                {w}
              </button>
            ))}
          </div>
          {order.length > 0 && <p className="hint" style={{ marginTop: 8 }}>あなたの並び：{order.join(' → ')}</p>}
        </>
      )}
      {phase === 'result' && (
        <>
          <p style={{ fontWeight: 700, textAlign: 'center' }}>{correctCount} / {words.length} 問正解</p>
          <p className="hint" style={{ textAlign: 'center' }}>
            正解の順番：{words.join(' → ')}<br />
            あなたの順番：{order.join(' → ')}
          </p>
          <button className="btn primary block" onClick={() => setPhase('idle')}>もう一度</button>
        </>
      )}
    </div>
  );
}

// ===== 3. 物語生成トレーニング（ファンタジー/物語タイプ）=====
function StoryBuilder() {
  const [topics, setTopics] = useState(() => pickRandom(WORD_BANK, 3));
  const [story, setStory] = useState('');
  const [seconds, setSeconds] = useState(120);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return undefined;
    if (seconds <= 0) { setRunning(false); return undefined; }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [running, seconds]);

  const reroll = () => {
    setTopics(pickRandom(WORD_BANK, 3));
    setStory('');
    setSeconds(120);
    setRunning(false);
  };

  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <div className="card">
      <p className="inline-note" style={{ marginTop: 0 }}>お題の3つの言葉：</p>
      <p style={{ fontWeight: 700, fontSize: '1.1em' }}>{topics.join('・')}</p>
      <button className="btn ghost sm" onClick={reroll}>🔄 お題を変える</button>
      <textarea
        value={story}
        onChange={(e) => setStory(e.target.value)}
        placeholder="この3つの言葉が全部出てくる短い物語を、思いつくまま書いてみましょう。"
        rows={8}
        style={{ width: '100%', marginTop: 10 }}
      />
      <div className="btn-row" style={{ marginTop: 8 }}>
        {!running ? (
          <button className="btn primary" onClick={() => setRunning(true)}>⏱ タイマー開始（{mm}:{ss}）</button>
        ) : (
          <button className="btn" onClick={() => setRunning(false)}>一時停止（残り {mm}:{ss}）</button>
        )}
      </div>
      {seconds === 0 && <p className="inline-note" style={{ color: 'var(--warn, #e0a800)' }}>時間切れです。書けたところまでで大丈夫です。</p>}
    </div>
  );
}

// ===== 4. 連想チェーンゲーム（辞書引き＝言語抽象タイプ）=====
function AssocChainGame() {
  const [topic, setTopic] = useState(() => pickRandom(WORD_BANK, 1)[0]);
  const [chain, setChain] = useState([]);
  const [input, setInput] = useState('');
  const [seconds, setSeconds] = useState(60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!running) return undefined;
    if (seconds <= 0) { setRunning(false); setDone(true); return undefined; }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [running, seconds]);

  const reset = () => {
    setTopic(pickRandom(WORD_BANK, 1)[0]);
    setChain([]);
    setInput('');
    setSeconds(60);
    setRunning(false);
    setDone(false);
  };

  const add = () => {
    const v = input.trim();
    if (!v || !running) return;
    setChain((c) => [...c, v]);
    setInput('');
  };

  return (
    <div className="card">
      <p className="inline-note" style={{ marginTop: 0 }}>お題：<strong>{topic}</strong> から連想する言葉をつなげてください。</p>
      {!running && !done && <button className="btn primary block" onClick={() => setRunning(true)}>▶ スタート（60秒）</button>}
      {running && (
        <>
          <p className="hint">残り {seconds} 秒</p>
          <div className="kw-add">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="次に連想する言葉"
              autoFocus
            />
            <button className="btn sm primary" onClick={add}>追加</button>
          </div>
        </>
      )}
      {chain.length > 0 && (
        <p className="hint" style={{ marginTop: 8 }}>
          {topic} → {chain.join(' → ')}
        </p>
      )}
      {done && (
        <>
          <p style={{ fontWeight: 700, textAlign: 'center' }}>チェーンの長さ：{chain.length}</p>
          <button className="btn primary block" onClick={reset}>もう一度</button>
        </>
      )}
    </div>
  );
}

// ===== 5. 音読＆書き取りトレーナー（辞書＝文字タイプ）=====
function ReadCopyTrainer() {
  const [text, setText] = useState('');
  const [copy, setCopy] = useState('');
  const [stage, setStage] = useState('input'); // input | copy | check
  const [speaking, setSpeaking] = useState(false);
  const [err, setErr] = useState('');

  const read = async () => {
    if (!text.trim()) return;
    setErr('');
    setSpeaking(true);
    try {
      await speak(text, { rate: 0.9 });
    } catch (e) {
      setErr('読み上げに対応していないか、失敗しました。');
    } finally {
      setSpeaking(false);
    }
  };

  return (
    <div className="card">
      {stage === 'input' && (
        <>
          <p className="inline-note" style={{ marginTop: 0 }}>覚えたい文章を貼り付けてください（教科書の一節・専門用語の説明など、何でもOK）。</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} style={{ width: '100%' }} placeholder="ここに文章を貼り付け" />
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={read} disabled={!text.trim() || speaking || !isSpeechSupported()}>
              🔊 {speaking ? '読み上げ中…' : '読み上げる'}
            </button>
            <button className="btn primary" onClick={() => setStage('copy')} disabled={!text.trim()}>次へ：書き取りへ</button>
          </div>
          {!isSpeechSupported() && <p className="hint">この端末は読み上げに対応していません（文章はそのまま書き取り練習に使えます）。</p>}
          {err && <p className="inline-note" style={{ color: 'var(--wrong)' }}>{err}</p>}
        </>
      )}
      {stage === 'copy' && (
        <>
          <p className="inline-note" style={{ marginTop: 0 }}>もう一度聞いてから（または記憶を頼りに）、同じ文章を書き取ってください。</p>
          <button className="btn ghost sm" onClick={read} disabled={speaking}>🔊 もう一度聞く</button>
          <textarea value={copy} onChange={(e) => setCopy(e.target.value)} rows={5} style={{ width: '100%', marginTop: 8 }} placeholder="ここに書き取る" />
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn ghost" onClick={() => setStage('input')}>文章を変える</button>
            <button className="btn primary" onClick={() => setStage('check')}>答え合わせ</button>
          </div>
        </>
      )}
      {stage === 'check' && (
        <>
          <div className="section-label" style={{ marginTop: 0 }}>お手本</div>
          <p className="hint">{text}</p>
          <div className="section-label">あなたの書き取り</div>
          <p className="hint">{copy || '（未入力）'}</p>
          <button className="btn primary block" onClick={() => { setCopy(''); setStage('copy'); }}>もう一度書き取る</button>
          <button className="btn ghost block" style={{ marginTop: 6 }} onClick={() => { setText(''); setCopy(''); setStage('input'); }}>別の文章にする</button>
        </>
      )}
    </div>
  );
}

// ===== 6. 要約再構成トレーナー（辞書＝文字タイプ）=====
function SummarizeTrainer() {
  const [text, setText] = useState('');
  const [summary, setSummary] = useState('');
  const [stage, setStage] = useState('input'); // input | summarize | check

  return (
    <div className="card">
      {stage === 'input' && (
        <>
          <p className="inline-note" style={{ marginTop: 0 }}>要約したい文章を貼り付けてください。</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} style={{ width: '100%' }} placeholder="ここに文章を貼り付け" />
          <button className="btn primary block" style={{ marginTop: 8 }} onClick={() => setStage('summarize')} disabled={!text.trim()}>
            この文章を隠して要約する
          </button>
        </>
      )}
      {stage === 'summarize' && (
        <>
          <p className="inline-note" style={{ marginTop: 0 }}>文章は隠しました。読んだ内容を3行で要約してください（本を閉じて書くイメージ）。</p>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} style={{ width: '100%' }} placeholder="1行目：〜&#10;2行目：〜&#10;3行目：〜" />
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn ghost" onClick={() => setStage('input')}>文章を変える</button>
            <button className="btn primary" onClick={() => setStage('check')} disabled={!summary.trim()}>答え合わせ</button>
          </div>
        </>
      )}
      {stage === 'check' && (
        <>
          <div className="section-label" style={{ marginTop: 0 }}>元の文章</div>
          <p className="hint">{text}</p>
          <div className="section-label">あなたの要約</div>
          <p className="hint">{summary}</p>
          <button className="btn primary block" onClick={() => { setSummary(''); setStage('summarize'); }}>要約を書き直す</button>
          <button className="btn ghost block" style={{ marginTop: 6 }} onClick={() => { setText(''); setSummary(''); setStage('input'); }}>別の文章にする</button>
        </>
      )}
    </div>
  );
}

// ===== 7. 穴埋めセルフテスト・テキスト版（辞書＝文字タイプ）=====
// 文字を1つずつクリックして空欄にする範囲を自分で決められる（形態素解析なしで
// 日本語の任意の範囲を空欄にするための工夫）。
function FillBlankTrainer() {
  const [text, setText] = useState('');
  const [chars, setChars] = useState(null);
  const [blanked, setBlanked] = useState(new Set());
  const [stage, setStage] = useState('input'); // input | mark | quiz | result
  const [answers, setAnswers] = useState({});

  const startMarking = () => {
    setChars(Array.from(text));
    setBlanked(new Set());
    setStage('mark');
  };
  const toggleChar = (i) => {
    setBlanked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  // 連続した空欄インデックスを1つの穴としてまとめる
  const segments = useMemo(() => {
    if (!chars) return [];
    const segs = [];
    let i = 0;
    while (i < chars.length) {
      if (blanked.has(i)) {
        let j = i;
        while (j + 1 < chars.length && blanked.has(j + 1)) j++;
        segs.push({ type: 'blank', from: i, to: j, answer: chars.slice(i, j + 1).join('') });
        i = j + 1;
      } else {
        let j = i;
        while (j + 1 < chars.length && !blanked.has(j + 1)) j++;
        segs.push({ type: 'text', from: i, to: j, text: chars.slice(i, j + 1).join('') });
        i = j + 1;
      }
    }
    return segs;
  }, [chars, blanked]);

  const blankCount = segments.filter((s) => s.type === 'blank').length;

  return (
    <div className="card">
      {stage === 'input' && (
        <>
          <p className="inline-note" style={{ marginTop: 0 }}>穴埋め問題にしたい文章を貼り付けてください。</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} style={{ width: '100%' }} placeholder="ここに文章を貼り付け" />
          <button className="btn primary block" style={{ marginTop: 8 }} onClick={startMarking} disabled={!text.trim()}>
            空欄にする部分を選ぶ
          </button>
        </>
      )}
      {stage === 'mark' && (
        <>
          <p className="inline-note" style={{ marginTop: 0 }}>空欄にしたい文字をタップして選んでください（もう一度タップで解除）。</p>
          <p style={{ lineHeight: 2, wordBreak: 'break-all' }}>
            {chars.map((c, i) => (
              <span
                key={i}
                onClick={() => toggleChar(i)}
                style={{
                  cursor: 'pointer',
                  padding: '2px 0',
                  background: blanked.has(i) ? 'var(--accent, #4a9eff)' : 'transparent',
                  borderBottom: blanked.has(i) ? 'none' : '1px dotted var(--text-sub, #888)',
                }}
              >
                {c}
              </span>
            ))}
          </p>
          <button
            className="btn primary block"
            style={{ marginTop: 10 }}
            onClick={() => { setAnswers({}); setStage('quiz'); }}
            disabled={blankCount === 0}
          >
            この内容で問題を作る（空欄 {blankCount} 箇所）
          </button>
        </>
      )}
      {stage === 'quiz' && (
        <>
          <p className="inline-note" style={{ marginTop: 0 }}>空欄を埋めてください。</p>
          <p style={{ lineHeight: 2.4, wordBreak: 'break-all' }}>
            {segments.map((s, i) =>
              s.type === 'text' ? (
                <span key={i}>{s.text}</span>
              ) : (
                <input
                  key={i}
                  type="text"
                  value={answers[i] || ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                  style={{ width: `${Math.max(2, s.answer.length) * 1.2}em`, textAlign: 'center', margin: '0 2px' }}
                />
              )
            )}
          </p>
          <button className="btn primary block" onClick={() => setStage('result')}>答え合わせ</button>
        </>
      )}
      {stage === 'result' && (
        <>
          <p style={{ lineHeight: 2.4, wordBreak: 'break-all' }}>
            {segments.map((s, i) =>
              s.type === 'text' ? (
                <span key={i}>{s.text}</span>
              ) : (
                <strong
                  key={i}
                  style={{ color: (answers[i] || '') === s.answer ? 'var(--correct)' : 'var(--wrong)', margin: '0 2px' }}
                >
                  {answers[i] || '（未回答）'}
                  {(answers[i] || '') !== s.answer && <span className="hint">（正解：{s.answer}）</span>}
                </strong>
              )
            )}
          </p>
          <button className="btn primary block" onClick={() => { setAnswers({}); setStage('quiz'); }}>もう一度解く</button>
          <button className="btn ghost block" style={{ marginTop: 6 }} onClick={() => { setText(''); setChars(null); setStage('input'); }}>別の文章にする</button>
        </>
      )}
    </div>
  );
}

// ===== 8. 語源・部首分解ノート（辞書＝文字タイプ）=====
function KanjiBreakdownNote() {
  const [term, setTerm] = useState('');
  const [chars, setChars] = useState(null);
  const [notes, setNotes] = useState({});

  const breakdown = () => {
    setChars(Array.from(term));
    setNotes({});
  };

  const preview = chars ? chars.map((c, i) => `${c}（${notes[i] || '？'}）`).join(' + ') : '';

  return (
    <div className="card">
      <p className="inline-note" style={{ marginTop: 0 }}>覚えにくい専門用語を1文字ずつに分解し、自分なりの意味・イメージを書き添えます。</p>
      <div className="kw-add">
        <input type="text" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="例：伏兔骨" />
        <button className="btn sm primary" onClick={breakdown} disabled={!term.trim()}>分解する</button>
      </div>
      {chars && (
        <>
          {chars.map((c, i) => (
            <div key={i} className="kw-add" style={{ marginTop: 8 }}>
              <span style={{ fontSize: '1.3em', fontWeight: 700, width: 40, textAlign: 'center' }}>{c}</span>
              <input
                type="text"
                value={notes[i] || ''}
                onChange={(e) => setNotes((n) => ({ ...n, [i]: e.target.value }))}
                placeholder="この字の意味・イメージ"
              />
            </div>
          ))}
          <div className="section-label">まとめ（自分の覚え方）</div>
          <p className="hint">{preview}</p>
        </>
      )}
    </div>
  );
}

// ===== 9. シャドーイング練習ガイド（ラジオ＝聴覚言語タイプ）=====
function ShadowingGuide() {
  const [text, setText] = useState('');
  const [running, setRunning] = useState(false);
  const [pulse, setPulse] = useState(false);
  const abortRef = useRef(null);
  const pulseTimer = useRef(null);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (pulseTimer.current) clearInterval(pulseTimer.current);
    cancelSpeech();
  }, []);

  const start = async () => {
    if (!text.trim() || running) return;
    setRunning(true);
    pulseTimer.current = setInterval(() => setPulse((p) => !p), 800);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await speak(text, { rate: 0.8, signal: ctrl.signal });
    } catch (e) {
      /* 中断は正常系として無視 */
    } finally {
      clearInterval(pulseTimer.current);
      setPulse(false);
      setRunning(false);
    }
  };
  const stop = () => {
    abortRef.current?.abort();
    cancelSpeech();
  };

  return (
    <div className="card">
      <p className="inline-note" style={{ marginTop: 0 }}>
        文章を読み上げます。丸いガイドの光に合わせて、0.5〜1秒遅れで声に出して復唱してみてください。
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} style={{ width: '100%' }} placeholder="ここに練習したい文章を貼り付け" disabled={running} />
      <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: pulse ? 'var(--accent, #4a9eff)' : 'var(--surface-2, #333)',
            transition: 'background 0.2s',
          }}
        />
      </div>
      <div className="btn-row">
        {!running ? (
          <button className="btn primary" onClick={start} disabled={!text.trim() || !isSpeechSupported()}>▶ 開始</button>
        ) : (
          <button className="btn danger" onClick={stop}>■ 止める</button>
        )}
      </div>
      {!isSpeechSupported() && <p className="hint">この端末は読み上げに対応していません。</p>}
    </div>
  );
}

// ===== 10. Q&Aテンポ切り替えモード（ラジオ＝聴覚言語タイプ）=====
function QaPacingMode() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [pauseSec, setPauseSec] = useState(3);
  const [playing, setPlaying] = useState(null); // null | 'lecture' | 'qa'
  const abortRef = useRef(null);

  useEffect(() => () => { abortRef.current?.abort(); cancelSpeech(); }, []);

  const playLecture = async () => {
    setPlaying('lecture');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await speak(`${question}。${answer}`, { signal: ctrl.signal });
    } catch (e) { /* noop */ }
    setPlaying(null);
  };
  const playQa = async () => {
    setPlaying('qa');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await speak(question, { signal: ctrl.signal });
      await wait(pauseSec * 1000, ctrl.signal);
      await speak(answer, { signal: ctrl.signal });
    } catch (e) { /* noop */ }
    setPlaying(null);
  };
  const stop = () => { abortRef.current?.abort(); cancelSpeech(); setPlaying(null); };

  return (
    <div className="card">
      <p className="inline-note" style={{ marginTop: 0 }}>
        問題文と答えを登録し、「講義形式（続けて読む）」と「Q&A形式（問いの後に間を置く）」を聴き比べてみましょう。
      </p>
      <label className="mini-field">
        <span>問題文</span>
        <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="例：経穴の数はいくつ？" />
      </label>
      <label className="mini-field" style={{ marginTop: 8 }}>
        <span>答え</span>
        <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="例：361穴です" />
      </label>
      <div className="range-row" style={{ marginTop: 8 }}>
        <input type="range" min="1" max="8" value={pauseSec} onChange={(e) => setPauseSec(Number(e.target.value))} />
        <span className="range-val">間：{pauseSec}秒</span>
      </div>
      <div className="btn-row" style={{ marginTop: 10 }}>
        <button className="btn" onClick={playLecture} disabled={!question.trim() || !answer.trim() || !!playing || !isSpeechSupported()}>
          🎙 講義形式で聞く
        </button>
        <button className="btn primary" onClick={playQa} disabled={!question.trim() || !answer.trim() || !!playing || !isSpeechSupported()}>
          ❓ Q&A形式で聞く
        </button>
        {playing && <button className="btn danger" onClick={stop}>■ 止める</button>}
      </div>
      {!isSpeechSupported() && <p className="hint">この端末は読み上げに対応していません。</p>}
    </div>
  );
}
