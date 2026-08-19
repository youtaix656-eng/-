import * as engine from '../lib/audioEngine.js';
import { useAudioEngine } from '../lib/audioEngine.js';

// どの画面からでも表示される音声ミニプレーヤー。
// 音声学習で再生を始めた後に他の画面へ移っても、ここから停止・スキップできる。
// （音声学習画面そのものにいる時は、フルプレーヤーがあるので非表示）
export default function MiniPlayer({ hidden, onOpen, lifted }) {
  const snap = useAudioEngine();
  if (hidden) return null;
  // 再生を始めた後だけ表示（読み込んだだけの停止状態では出さない）。
  // 一時停止中も表示を保ち、✕（最初へ戻す）で消える。
  if (!snap.hasPlan || !snap.started) return null;

  const d = snap.display;
  const label = labelOf(d);
  const sub = subOf(d);

  return (
    <div className={`mini-player${lifted ? ' lifted' : ''}`} role="region" aria-label="音声ミニプレーヤー">
      <button className="mini-open" onClick={onOpen} aria-label="音声学習を開く">
        <span className={`mini-eq ${snap.playing ? 'on' : ''}`}><i /><i /><i /></span>
        <span className="mini-texts">
          <span className="mini-title">{label}</span>
          <span className="mini-sub">{sub}</span>
        </span>
      </button>
      <div className="mini-controls">
        <button onClick={() => engine.skip(-1)} disabled={snap.index === 0} aria-label="前へ">⏮</button>
        <button className="mini-main" onClick={() => engine.toggle()} aria-label="再生 / 一時停止">
          {snap.playing ? '⏸' : '▶'}
        </button>
        <button onClick={() => engine.skip(1)} disabled={snap.index >= snap.total - 1} aria-label="次へ">⏭</button>
        <button className="mini-close" onClick={() => engine.resetToStart()} aria-label="停止して閉じる">✕</button>
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
