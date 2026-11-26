import { useEffect, useState } from 'react';
import * as engine from '../lib/audioEngine.js';
import { useAudioEngine } from '../lib/audioEngine.js';
import {
  loadAudioHistory, subscribeAudioHistory, deleteAudioHistory, clearAudioHistory,
  historyTitle, positionText, historyTimeText, saveCurrentAsPinned,
} from '../lib/audioPlayHistory.js';

// どの画面からでも表示される音声ミニプレーヤー。
// 音声学習で再生を始めた後に他の画面へ移っても、ここから停止・スキップできる。
// 2026-11-15（ユーザー指定）：①問題番号を出す ②アプリを閉じて開き直しても、最後に聞いていた
// ところを出す（▶でそこから再開） ③再生履歴を持ち、押すとその位置へ飛ぶ。
// ※ アプリを閉じている間は音は鳴らない。開き直した時に「続きから」を出すだけ。
export default function MiniPlayer({ hidden, onOpen, onJump, lifted }) {
  const snap = useAudioEngine();
  const [history, setHistory] = useState(() => loadAudioHistory());
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [savedNote, setSavedNote] = useState('');
  const saveHere = () => {
    const e = saveCurrentAsPinned();
    setSavedNote(e ? `💾 保存しました（${positionText(e)}）` : 'この読み上げ方は保存できません（連結学習モード・キーワード単位の読み上げ）');
    setTimeout(() => setSavedNote(''), 2600);
  };
  useEffect(() => subscribeAudioHistory(setHistory), []);
  const live = snap.hasPlan && snap.started;
  // 再生を始めたら、「閉じた」印は外す（次に止めた時にまた続きが出るように）
  useEffect(() => { if (live) setDismissed(false); }, [live]);

  if (hidden) return null;
  // 「続きから」に出すのは自動の履歴の先頭（本人が保存したものは🕘の一覧から開く）
  const last = history.find((h) => !h.pinned) || history[0] || null;
  // 再生中・一時停止中はいまの内容。そうでなければ、最後に聞いていたところ（閉じる前の続き）。
  if (!live && (!last || dismissed)) return null;

  const d = snap.display;
  const label = live ? labelOf(d) : historyTitle(last);
  const sub = live ? subOf(d)
    : last.done ? '▶ で最初から再生'
      : last.kind === 'review' ? `▶ でまだ聞いていない${last.total - (last.heard || []).length}問を再生`
      : ((last.text || '').length > 30 ? last.text.slice(0, 30) + '…' : (last.text || ''));
  const pos = live ? (snap.total > 0 ? `${snap.index + 1} / ${snap.total}` : '') : positionText(last);

  const jump = (entry, autoPlay) => { setOpen(false); onJump?.(entry, autoPlay); };

  return (
    <div className={`mini-player${lifted ? ' lifted' : ''}`} role="region" aria-label="音声ミニプレーヤー">
      {open && (
        <div className="mini-history" role="dialog" aria-label="音声の再生履歴">
          <div className="mini-history-head">
            <span>🕘 再生履歴（押すとその問題から再生）</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="履歴を閉じる">✕</button>
          </div>
          {history.length === 0 && <p className="mini-history-empty">まだ履歴はありません。科目などを選んで再生すると、ここに残ります。</p>}
          <ul>
            {history.map((h) => (
              <li key={h.key}>
                <button type="button" className="mini-history-item" onClick={() => jump(h, true)}>
                  <span className="mini-history-title">{h.pinned && <span className="mini-pin" aria-label="保存したもの">💾</span>}{historyTitle(h)}<b>{positionText(h)}</b></span>
                  <span className="mini-history-sub">{h.done ? '最後まで聞きました。押すと最初から再生します。' : h.kind === 'review' ? `まだ聞いていない${h.total - (h.heard || []).length}問を流します${h.text ? `・${h.text}` : ''}` : (h.text || '（問題文なし）')}</span>
                  <span className="mini-history-at">{historyTimeText(h.at)}</span>
                </button>
                <button type="button" className="mini-history-del" onClick={() => deleteAudioHistory(h.key)} aria-label={`${historyTitle(h)}の履歴を消す`}>🗑</button>
              </li>
            ))}
          </ul>
          <div className="mini-history-foot">
            <span>間違えた問題（△✕）は、聞いていた並びのまま残り、押すとまだ聞いていない問題だけ流します。連結学習モード・キーワード単位の読み上げは履歴に残りません。💾は下部バーの「💾」で本人が保存したもので、消すまで残ります。</span>
            {history.length > 0 && <button type="button" onClick={() => clearAudioHistory()}>履歴をすべて消す</button>}
          </div>
        </div>
      )}
      {savedNote && <div className="mini-saved-note" role="status">{savedNote}</div>}
      <button
        className="mini-open"
        onClick={() => (live ? onOpen?.() : jump(last, false))}
        aria-label={live ? '音声学習を開く' : '前回の続きを開く'}
      >
        <span className={`mini-eq ${live && snap.playing ? 'on' : ''}`}><i /><i /><i /></span>
        <span className="mini-texts">
          <span className="mini-title">
            {!live && <span className="mini-tag">{last.done ? 'もう一度' : '続きから'}</span>}
            <span className="mini-title-text">{label}</span>
            {live && pos && <span className="mini-pos">{pos}</span>}
          </span>
          {/* 続きから（再生していない時）は位置の文が長いので、題名の行ではなく下の行に出す
              （幅360pxで題名が「誤…」まで切れて、何を聞いていたか分からなかった） */}
          <span className="mini-sub">{!live && pos ? `${pos}・${sub}` : sub}</span>
        </span>
      </button>
      <div className="mini-controls">
        {live && <button onClick={() => engine.skip(-1)} disabled={snap.index === 0} aria-label="前へ">⏮</button>}
        <button
          className="mini-main"
          onClick={() => (live ? engine.toggle() : jump(last, true))}
          aria-label={live ? '再生 / 一時停止' : '前回の続きから再生'}
        >
          {live && snap.playing ? '⏸' : '▶'}
        </button>
        {live && <button onClick={() => engine.skip(1)} disabled={snap.index >= snap.total - 1} aria-label="次へ">⏭</button>}
        {live && <button className="mini-save" onClick={saveHere} aria-label="いま聞いているところを保存">💾</button>}
        <button className="mini-hist" onClick={() => setOpen((v) => !v)} aria-label="再生履歴" aria-expanded={open}>🕘</button>
        <button
          className="mini-close"
          onClick={() => { setOpen(false); if (live) engine.close(); setDismissed(true); }}
          aria-label="停止して閉じる（聞いた位置は残ります）"
        >✕</button>
      </div>
    </div>
  );
}

function labelOf(d) {
  if (!d) return '音声学習';
  if (d.kind === 'flashcard') return `用語：${d.keyword}`;
  if (d.kind === 'summary') return `まとめ：${d.keyword}`;
  if (d.kind === 'compare') return `比較：${d.comp?.title || ''}`;
  if (d.kind === 'number') return `数字：${d.num?.topic || ''}`;
  const q = d.q;
  return (q && q.subject) || d.keyword || '音声学習';
}

function subOf(d) {
  if (!d) return '';
  if (d.kind === 'compare') return (d.comp?.members || []).join(' ⇔ ');
  if (d.kind === 'number') return d.num?.value || '';
  if (d.kind === 'summary' || d.kind === 'flashcard') return d.text || '';
  const q = d.q;
  const t = (q && q.question) || (q && q.image ? '図の問題' : '');
  return t.length > 30 ? t.slice(0, 30) + '…' : t;
}
