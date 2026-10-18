// 短い合図音（WebAudioでその場に生成）と振動（Vibration API）。
// 元はPomodoro.jsxだけが持っていたローカル関数だったが、音声学習（AudioMode.jsx）の
// 合図音・振動ティックでも同じ仕組みを使うため、単一の正としてここへ切り出した
// （両方が別々に同じAudioContextの組み立てを持つと、片方だけ直した時に食い違う）。

let audioBlockWarned = false; // 自動再生ブロックの警告は1ページ生存中に1回だけで十分

export function beep(times = 1, freq = 880, volumePct = 100, onBlocked) {
  if (volumePct <= 0) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    // 音量100%時の最大振幅（音割れしない範囲＝1.0未満を保ちつつ、はっきり気づける大きさにする）。
    const peakGain = Math.max(0.0001, 0.7 * Math.min(100, volumePct) / 100);
    let t = ctx.currentTime;
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peakGain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.start(t);
      o.stop(t + 0.26);
      t += 0.34;
    }
    // 鳴らし終わったらcloseする。開けっぱなしのAudioContextが積み重なると
    // ブラウザ側の上限に達しうるため。
    const totalMs = (t - ctx.currentTime) * 1000 + 100;
    setTimeout(() => {
      // ユーザー操作を伴わない自動再生はブラウザにブロックされることがある（resumeしても
      // suspendedのまま）。気づけるよう一度だけ知らせる。
      if (ctx.state === 'suspended' && !audioBlockWarned) {
        audioBlockWarned = true;
        onBlocked?.();
      }
      ctx.close().catch(() => {});
    }, totalMs);
  } catch (e) {
    /* noop */
  }
}

export function vibrate(pattern) {
  try { navigator.vibrate?.(pattern); } catch (e) { /* noop */ }
}
