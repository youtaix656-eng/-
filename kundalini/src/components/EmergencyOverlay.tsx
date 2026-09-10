import { useEffect, useRef, useState } from 'react';
import { practiceById } from '../data/breathing.js';
import { BreathGuide } from './BreathGuide.js';
import { WORDS, wordAt } from '../data/words.js';
import { HELP_NOTE } from '../data/safety.js';
import { ding } from '../lib/bell.js';
import { mmss } from '../lib/date.js';
import { actions } from '../lib/useStore.js';
import type { AppState } from '../types/index.js';

// 緊急ボタン（衝動が来たとき）。
// ⚠ ここで守ること：
//   ①**責めない・脅さない**（「ここで負けたら台無し」とは書かない）。
//   ②**閉じる口を必ず出しておく**（閉じられない画面を作らない）。
//   ③押した記録は残すが、押した＝戻った、ではないことを画面にも書く。
//   ④乗り切れなかったときの導線も置く（行き止まりにしない）。

export function EmergencyOverlay({ state, onClose }: { state: AppState; onClose: () => void }) {
  const total = state.settings.coolDownSeconds;
  const [left, setLeft] = useState(total);
  const [word, setWord] = useState(() => wordAt(Date.now()));
  const endRef = useRef(Date.now() + total * 1000);
  const doneRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      const rest = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setLeft(rest);
      if (rest <= 0 && !doneRef.current) {
        doneRef.current = true;
        ding(state.settings.bell, 396);
      }
    }, 250);
    return () => clearInterval(id);
  }, [state.settings.bell]);

  // 言葉は30秒ごとに入れ替える（乱数ではなく時刻から決める）
  useEffect(() => {
    const id = setInterval(() => setWord(wordAt(Date.now())), 30000);
    return () => clearInterval(id);
  }, []);

  const finish = (finished: boolean) => {
    actions.logUrge(total - left, finished);
    onClose();
  };

  return (
    <div className="sos-overlay" role="dialog" aria-modal="true" aria-label="衝動が来たとき">
      <div className="sos-inner">
        <p className="small">波が過ぎるまで、ここで一緒に待ちます。</p>
        <div className="sos-timer">{mmss(left)}</div>
        <BreathGuide practice={practiceById('long-exhale')} running={true} />
        <p className="sos-word">{word}</p>
        <div className="btn-row" style={{ justifyContent: 'center' }}>
          <button className="ghost" onClick={() => setWord(WORDS[(WORDS.indexOf(word) + 1) % WORDS.length])}>
            別の言葉
          </button>
          <button className="ghost" onClick={() => { endRef.current += 60000; doneRef.current = false; }}>
            あと1分のばす
          </button>
        </div>
        <div className="card" style={{ textAlign: 'left' }}>
          <h3>いま、できること</h3>
          <p className="small">・立ち上がって、いまいる部屋から出る（場面が変わると波の形が変わります）</p>
          <p className="small">・水を飲む／顔を洗う／シャワーを浴びる</p>
          <p className="small">・誰かに一言だけ連絡する（内容は何でもかまいません）</p>
          <p className="small">・端末を手の届かない場所に置いて、5分だけ横になる</p>
        </div>
        <div className="btn-row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <button className="primary wide" onClick={() => finish(left <= 0)}>
            {left <= 0 ? '波が過ぎました' : '閉じる'}
          </button>
        </div>
        <p className="small">
          押したことは記録に残りますが、押した＝戻った、ではありません。乗り越えた回数もここに入ります。
        </p>
        <div className="note warn" style={{ textAlign: 'left' }}>{HELP_NOTE}</div>
      </div>
    </div>
  );
}
