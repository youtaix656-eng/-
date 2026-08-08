// 仮眠タイマー終了時のアラーム（Web Audio のビープ音 + バイブレーション）。
// 外部音声ファイルを持たず、その場で短い音を生成する。

export function playAlarm(): void {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([300, 150, 300, 150, 500]);
    }
  } catch {
    // バイブレーション未対応環境は無視
  }

  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const beepAt = (offsetSec: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offsetSec);
      gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + offsetSec + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offsetSec + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offsetSec);
      osc.stop(ctx.currentTime + offsetSec + 0.4);
    };
    [0, 0.5, 1.0].forEach(beepAt);
    setTimeout(() => ctx.close().catch(() => {}), 2000);
  } catch {
    // Web Audio 未対応環境は無視（バイブレーションのみで通知）
  }
}
