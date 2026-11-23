import { useEffect, useState } from 'react';

// 読み上げを整える部品（speechText.js）と、よく誤読される言葉の一覧（speechReadings.js）は、
// 音声の画面を開いた時にだけ読み込む（AudioMode.jsx は起動時に読む画面なので、
// 静的に読むと起動時の束が増える。keiketsuCardsLoader.js と同じ考え方）。
// 読み込みが済むまでは null を返し、画面側は本人の手動補正だけで読む（今までどおり）。
let promise = null;
export function loadSpeechText() {
  if (!promise) {
    promise = Promise.all([import('./speechText.js'), import('../data/speechReadings.js')])
      .then(([st, sr]) => ({ ...st, SPEECH_READINGS: sr.SPEECH_READINGS }));
  }
  return promise;
}

export function useSpeechText(trigger = true) {
  const [mod, setMod] = useState(null);
  useEffect(() => {
    if (mod || !trigger) return;
    let cancelled = false;
    loadSpeechText().then((m) => { if (!cancelled) setMod(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, [trigger, mod]);
  return mod;
}
