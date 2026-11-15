// アラーム用の音20種（2026-11-15追加・ユーザー指定「アラームに使えそうな音を20こ」）。
// 音声ファイルは持たず、WebAudioでその場に作る（sound.jsのbeep/bellRingと同じ方針）。
// 1つの音＝短いフレーズ（notes）で、鳴っている間は loop 秒ごとにくり返す。
//   note: [開始秒, 周波数Hz, 長さ秒, 波形?, 音量比?]

const N = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98,
};

function repeat(count, step, make) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(...make(i * step, i));
  return out;
}

export const ALARM_SOUNDS = [
  { id: 'bell', name: 'ベル（チリリン）', loop: 1.6, notes: repeat(6, 0.11, (t) => [[t, 2093, 0.3, 'sine', 0.8], [t, 3136, 0.2, 'sine', 0.35]]) },
  { id: 'digital', name: 'デジタル（ピピピピ）', loop: 1.0, notes: repeat(4, 0.12, (t) => [[t, 2000, 0.07, 'square', 0.5]]) },
  { id: 'classic', name: '目覚まし時計（ジリリリ）', loop: 1.5, notes: repeat(18, 0.055, (t, i) => [[t, i % 2 ? 1568 : 1319, 0.05, 'square', 0.45]]) },
  { id: 'dingdong', name: 'チャイム（ピンポン）', loop: 2.0, notes: [[0, N.E5, 0.6, 'sine', 0.9], [0.5, N.C5, 0.9, 'sine', 0.9]] },
  { id: 'school', name: '学校のチャイム', loop: 6.4, notes: [[0, N.E5, 0.55], [0.6, N.C5, 0.55], [1.2, N.D5, 0.55], [1.8, N.G4, 1.0], [3.0, N.G4, 0.55], [3.6, N.D5, 0.55], [4.2, N.E5, 0.55], [4.8, N.C5, 1.0]].map(([t, f, d]) => [t, f, d, 'sine', 0.85]) },
  { id: 'rise', name: '上昇音', loop: 1.6, notes: [N.C5, N.E5, N.G5, N.C6, N.E6].map((f, i) => [i * 0.14, f, 0.22, 'triangle', 0.8]) },
  { id: 'fall', name: '下降音', loop: 1.6, notes: [N.E6, N.C6, N.G5, N.E5, N.C5].map((f, i) => [i * 0.14, f, 0.22, 'triangle', 0.8]) },
  { id: 'xylophone', name: 'やさしい木琴', loop: 2.2, notes: [N.G5, N.E5, N.G5, N.C6].map((f, i) => [i * 0.3, f, 0.35, 'sine', 0.8]) },
  { id: 'bird', name: '小鳥のさえずり', loop: 1.8, notes: repeat(3, 0.4, (t) => [[t, 2600, 0.06, 'sine', 0.6], [t + 0.08, 3200, 0.06, 'sine', 0.6], [t + 0.16, 2800, 0.1, 'sine', 0.6]]) },
  { id: 'siren', name: 'サイレン', loop: 1.6, notes: repeat(2, 0.8, (t) => [[t, 880, 0.4, 'sawtooth', 0.4], [t + 0.4, 660, 0.4, 'sawtooth', 0.4]]) },
  { id: 'longbeep', name: 'ロングビープ', loop: 1.6, notes: [[0, 1000, 0.9, 'sine', 0.8]] },
  { id: 'double', name: 'ダブルビープ', loop: 1.2, notes: [[0, 1200, 0.15, 'sine', 0.8], [0.25, 1200, 0.15, 'sine', 0.8]] },
  { id: 'musicbox', name: 'オルゴール', loop: 3.4, notes: [N.E6, N.C6, N.G5, N.C6, N.E6, N.G6, N.E6, N.C6].map((f, i) => [i * 0.38, f, 0.7, 'sine', 0.6]) },
  { id: 'gong', name: 'ゴング（低い鐘）', loop: 3.0, notes: [[0, 196, 2.6, 'sine', 1], [0, 294, 2.0, 'sine', 0.4], [0, 523, 1.2, 'sine', 0.2]] },
  { id: 'harp', name: 'ハープ', loop: 2.6, notes: [N.C4, N.E4, N.G4, N.C5, N.E5, N.G5, N.C6].map((f, i) => [i * 0.12, f, 1.2, 'triangle', 0.6]) },
  { id: 'phone', name: '電話のベル', loop: 3.0, notes: repeat(2, 1.0, (t0) => repeat(14, 0.05, (t, i) => [[t0 + t, i % 2 ? 1400 : 1100, 0.045, 'sine', 0.7]])) },
  { id: 'radar', name: 'レーダー', loop: 1.4, notes: [[0, 1500, 0.08, 'sine', 0.9], [0.12, 1500, 0.5, 'sine', 0.25]] },
  { id: 'marimba', name: 'マリンバ', loop: 2.4, notes: [N.C5, N.G5, N.E5, N.G5, N.C5, N.A5, N.F5, N.A5].map((f, i) => [i * 0.2, f, 0.3, 'triangle', 0.8]) },
  { id: 'fanfare', name: 'ファンファーレ', loop: 2.4, notes: [[0, N.G4, 0.15], [0.18, N.C5, 0.15], [0.36, N.E5, 0.15], [0.54, N.G5, 0.45], [1.05, N.E5, 0.15], [1.23, N.G5, 0.7]].map(([t, f, d]) => [t, f, d, 'square', 0.4]) },
  { id: 'calm', name: 'おだやかな和音', loop: 3.6, notes: [[0, N.C4, 2.8, 'sine', 0.6], [0.3, N.E4, 2.6, 'sine', 0.5], [0.6, N.G4, 2.4, 'sine', 0.5], [0.9, N.C5, 2.2, 'sine', 0.45]] },
];

export function alarmSoundById(id) {
  return ALARM_SOUNDS.find((s) => s.id === id) || ALARM_SOUNDS[0];
}

export function alarmSoundName(id) {
  return alarmSoundById(id).name;
}

let sharedCtx = null;
function getCtx() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = new Ctx();
  if (sharedCtx.state === 'suspended') sharedCtx.resume().catch(() => {});
  return sharedCtx;
}

// ユーザー操作（タップ）の中で呼んでおくと、あとで操作なしに鳴らす時にブロックされにくくなる。
export function primeAlarmAudio() {
  try { getCtx(); } catch (e) { /* 鳴らせない環境では何もしない */ }
}

function schedulePhrase(ctx, sound, volume, out) {
  const t0 = ctx.currentTime + 0.03;
  const made = [];
  for (const [at, freq, dur, type = 'sine', rel = 1] of sound.notes) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(out);
    const peak = Math.max(0.0001, 0.6 * volume * rel);
    const s = t0 + at;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(peak, s + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    o.start(s);
    o.stop(s + dur + 0.03);
    made.push(o);
  }
  return made;
}

// 鳴らし始める。返り値の stop() で止める。loop=false なら1フレーズだけ（試聴用）。
// 鳴らせない環境（AudioContextなし）では blocked:true を返す。
export function playAlarmSound(id, { volume = 1, loop = true } = {}) {
  const sound = alarmSoundById(id);
  let ctx = null;
  try { ctx = getCtx(); } catch (e) { ctx = null; }
  if (!ctx) return { stop() {}, blocked: true, isBlocked: () => true };
  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(ctx.destination);
  let live = schedulePhrase(ctx, sound, volume, out);
  let timer = null;
  if (loop) {
    timer = setInterval(() => {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      live = schedulePhrase(ctx, sound, volume, out);
    }, Math.round(sound.loop * 1000));
  }
  return {
    blocked: false,
    // 操作なしの自動再生がブラウザに止められていると suspended のままになる
    isBlocked: () => ctx.state !== 'running',
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      try { out.gain.setValueAtTime(0, ctx.currentTime); } catch (e) { /* noop */ }
      for (const o of live) { try { o.stop(); } catch (e) { /* すでに止まっている */ } }
      try { out.disconnect(); } catch (e) { /* noop */ }
    },
  };
}
