import { useMemo, useState } from 'react';
import { haripanMessages, MASCOT_NAME } from '../data/haripan.js';
import { studyStreak } from '../lib/stats.js';
import { speak, cancelSpeech, isSpeechSupported } from '../lib/speech.js';

const HARIO_IMG = `${import.meta.env.BASE_URL}haripan.png`;

// ハリオ先生 — アプリのAIマスコット。状況に合わせて一言を返し、読み上げもする。
export default function Mascot({ store }) {
  const { history, dueReviewQuestions, settings } = store;
  const ctx = useMemo(
    () => ({
      examDate: settings.examDate,
      dueCount: (dueReviewQuestions || []).length,
      streak: studyStreak(history).streak,
      historyLen: history.length,
    }),
    [settings.examDate, dueReviewQuestions, history]
  );
  const messages = useMemo(() => haripanMessages(ctx), [ctx]);
  const [i, setI] = useState(() => Math.floor(Math.random() * Math.max(1, haripanMessages(ctx).length)));
  const msg = messages[i % messages.length] || '……よう。';

  const next = () => {
    cancelSpeech();
    setI((v) => (v + 1) % messages.length);
  };
  const readAloud = () => {
    if (!isSpeechSupported()) return;
    cancelSpeech();
    speak(msg, { rate: settings.speechRate || 1, pitch: settings.speechPitch || 1 }).catch(() => {});
  };

  return (
    <div className="mascot">
      <img className="mascot-img" src={HARIO_IMG} alt={MASCOT_NAME} loading="lazy" width="64" height="64" />
      <div className="mascot-body">
        <div className="mascot-name">{MASCOT_NAME}<span className="mascot-role">鍼灸師AI</span></div>
        <div className="mascot-bubble">{msg}</div>
        <div className="mascot-actions">
          {isSpeechSupported() && (
            <button className="mascot-btn" onClick={readAloud} aria-label="読み上げ">🔊 喋ってもらう</button>
          )}
          <button className="mascot-btn ghost" onClick={next} aria-label="次のひとこと">↻ 次のひとこと</button>
        </div>
      </div>
    </div>
  );
}
