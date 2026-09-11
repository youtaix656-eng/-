// 合図の音。**音声ファイルを持たない**（端末の中でその場に作る）。
// 鳴らせない環境（自動再生の制限・古い端末）では黙って諦める＝落とさない。

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** 短い鐘の音（正弦波を減衰させるだけ） */
export function ding(enabled: boolean, freq = 528): void {
  if (!enabled) return;
  const c = context();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, c.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.6);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 1.7);
  } catch {
    /* 鳴らなくてもタイマー自体は動く */
  }
}
