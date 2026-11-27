// 音声再生エンジン（モジュールシングルトン）
//
// 画面（ビュー）を切り替えても再生が途切れないよう、再生ループを
// React コンポーネントの外（モジュール）に置く。AudioMode は「読み上げ計画
// （steps＋display）」を作ってこのエンジンに load し、再生・停止・スキップを
// 指示するだけ。ミニプレーヤーはどの画面からでもこのエンジンの状態を購読して表示する。
//
// ※ 端末の画面OFFやブラウザのバックグラウンド化では、OSの仕様で
//    Web Speech API が停止する（アプリ内での画面遷移のみ継続可能）。

import { useSyncExternalStore } from 'react';
import { speak, cancelSpeech, wait, speakCloned, cancelClonedSpeech, nativeTts } from './speech.js';
import { nativeAudioStart, nativeAudioUpdate, nativeAudioStop, onNativeAudioControl, isNativeApp } from './nativeBridge.js';
import { setAudioPlaying } from './runtimeFlags.js';
import { beep } from './sound.js';

const listeners = new Set();
let state = {
  playing: false,
  started: false, // 一度でも再生を始めたか（ミニプレーヤー表示の判定に使用）
  index: 0,
  phase: 'question',
  total: 0,
  hasPlan: false,
  display: null,
  planSig: null,
  finished: false, // 繰り返しオフで最後まで自動的に読み終えた直後だけtrue（再生・スキップ等で即false）
  ttsUnavailable: false, // アプリ版で端末の読み上げが使えず止めた直後だけtrue
  backgroundStopped: false, // タブの非表示化で読み上げを止めた直後だけtrue（AudioMode.jsxがトーストを出したら即false）
};

let plan = []; // [{ steps:[{phase, say?, wait?(ms), waitGap?:true|'cap2'}], display }]
const settings = { rate: 1, pitch: 1, volume: 1, gapSeconds: 2, nextGapSeconds: 1, voice: null, loop: false, cloneVoice: null, wakeLockEnabled: true };
// cloneVoice: { apiKey, voiceId } | null。設定されていればブラウザのspeechSynthesisの
// 代わりにボイスクローン（BYOK・ElevenLabs）で読み上げる（AudioMode.jsxのトグルで切替）。

let abort = null;
let running = false;
let sleepTimer = null;
let wakeLock = null;
let visInit = false;
let manualResolve = null; // アウトプットモード：「解答を見る」が押されるまで待つステップの解除関数
let resumeTimer = null; // skip/seekTo の「少し待ってから読み直す」予約（連打で2本走らせないため）
let sleepDeadline = 0; // スリープタイマーの止める時刻（0＝なし）。飛ばす・止めて再開しても残す

// ---- バックグラウンド表示（メディアセッション＋無音キープアライブ） ----
// 再生中に無音トラックを鳴らし、ロック画面/通知に「再生中」を表示する。
// これにより他アプリへ切り替えても通知が残り、タブが破棄されにくくなる。
// （※ 端末を完全にバックグラウンド化した際の読み上げ継続はOS仕様に依存）
let silentAudio = null;
let silentSrc = null;

function makeSilentWav() {
  const sr = 8000;
  const n = sr; // 1秒
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < n; i++) bytes[44 + i] = 128; // 8bit PCM の無音
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(bin);
}

function ensureSilentAudio() {
  if (silentAudio || typeof document === 'undefined') return;
  if (!silentSrc) silentSrc = makeSilentWav();
  silentAudio = document.createElement('audio');
  silentAudio.src = silentSrc;
  silentAudio.loop = true;
  silentAudio.preload = 'auto';
  silentAudio.volume = 0.0001; // ほぼ無音（メディアセッション維持のため実際に再生）
  silentAudio.setAttribute('playsinline', '');
  silentAudio.style.display = 'none';
  try { document.body.appendChild(silentAudio); } catch (e) { /* noop */ }
}

function mediaLabels(d) {
  if (!d) return { title: '音声学習', artist: '鍼灸国試 対策アプリ' };
  if (d.kind === 'compare') return { title: `比較：${d.comp?.title || ''}`, artist: '音声学習' };
  if (d.kind === 'number') return { title: `数字：${d.num?.topic || ''}`, artist: '音声学習' };
  if (d.kind === 'summary' || d.kind === 'flashcard') return { title: d.keyword || '用語', artist: '音声学習' };
  const q = d.q;
  const title = (q && q.question) || d.keyword || '音声学習';
  return { title: title.length > 60 ? title.slice(0, 60) + '…' : title, artist: (q && q.subject) || '音声学習' };
}

function setupMediaSession() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.setActionHandler('play', () => play());
    navigator.mediaSession.setActionHandler('pause', () => stop());
    navigator.mediaSession.setActionHandler('stop', () => stop());
    navigator.mediaSession.setActionHandler('nexttrack', () => skip(1));
    navigator.mediaSession.setActionHandler('previoustrack', () => skip(-1));
    // イヤホン・外部機器の「早送り/早戻し」ボタンも次へ/前へに割り当てる（対応端末のみ）。
    navigator.mediaSession.setActionHandler('seekforward', () => skip(1));
    navigator.mediaSession.setActionHandler('seekbackward', () => skip(-1));
    navigator.mediaSession.playbackState = 'playing';
  } catch (e) {
    /* noop */
  }
  updateMediaMetadata();
}

function updateMediaMetadata() {
  const { title, artist } = mediaLabels(state.display);
  // Androidにネイティブでラップされている時は、通知（フォアグラウンドサービス）の
  // 見出しもここで一緒に更新する（プレーンなWeb版ではnativeAudioUpdateは何もしない）。
  nativeAudioUpdate({ title, body: artist, playing: running });
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || typeof window === 'undefined' || !window.MediaMetadata) return;
  try {
    navigator.mediaSession.metadata = new window.MediaMetadata({ title, artist, album: '鍼灸国試 対策アプリ' });
  } catch (e) {
    /* noop */
  }
}

let nativeControlInit = false;
function initNativeControl() {
  if (nativeControlInit) return;
  nativeControlInit = true;
  // 通知のボタン（前へ/再生・一時停止/次へ）操作をアプリの通常の制御に変換する
  // （プレーンなWeb版では何も起きない。android/のBackgroundAudioPlugin.ktが送る）。
  onNativeAudioControl(({ action } = {}) => {
    if (action === 'playPause') toggle();
    // 電話がかかってきた・イヤホンが外れた・イヤホンのボタン（BackgroundAudioService.kt）
    else if (action === 'pause') { if (state.playing) stop(); }
    else if (action === 'play') { if (!state.playing) play(); }
    else if (action === 'next') skip(1);
    else if (action === 'prev') skip(-1);
  });
}

function startKeepAlive() {
  // アプリ版は端末のフォアグラウンドサービスが再生を保つので、無音の audio は鳴らさない
  // （WebView の audio が音の出口を取り合い、電話の時の一時停止などの判断を乱さないように）
  if (!isNativeApp()) {
    ensureSilentAudio();
    try { silentAudio?.play().catch(() => {}); } catch (e) { /* noop */ }
  }
  setupMediaSession();
  initNativeControl();
  const { title, artist } = mediaLabels(state.display);
  clearNativeHold();
  nativeAudioStart({ title, body: artist });
}
// アプリ版：一時停止しただけで通知（＝フォアグラウンドサービス）を消すと、通知・ロック画面から
// 再開できず、2時間コースの休憩明けにも裏から再開できなかった（Android 12 以上は裏に回っている間に
// 新しく始められない）。一時停止の間は「一時停止中」の通知のまま10分残し、聞き終えた・閉じた時は
// すぐ消す。※アプリ内部の目安で、ブラウザ版では何もしない。
const NATIVE_PAUSE_HOLD_MS = 10 * 60 * 1000;
let nativeHoldTimer = null;
function clearNativeHold() {
  if (nativeHoldTimer) { clearTimeout(nativeHoldTimer); nativeHoldTimer = null; }
}
function endNativeService() {
  clearNativeHold();
  nativeAudioStop();
}
function stopKeepAlive() {
  try { silentAudio?.pause(); } catch (e) { /* noop */ }
  try {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  } catch (e) { /* noop */ }
  if (!isNativeApp()) { nativeAudioStop(); return; }
  const { title, artist } = mediaLabels(state.display);
  nativeAudioUpdate({ title, body: artist ? `一時停止中・${artist}` : '一時停止中', playing: false });
  clearNativeHold();
  nativeHoldTimer = setTimeout(() => { nativeHoldTimer = null; if (!running) nativeAudioStop(); }, NATIVE_PAUSE_HOLD_MS);
}

function emit(patch) {
  state = { ...state, ...patch };
  // 「実際に読み上げ中か」をmain.jsxへ伝える（Service Worker更新の反映保留判定、
  // Pomodoro.jsxのsetPomoRunningと同じ理由。再生中に強制リロードされて
  // セッションが断りなく消えるのを防ぐ）。
  if ('playing' in patch) setAudioPlaying(state.playing);
  listeners.forEach((l) => l());
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getSnapshot() {
  return state;
}

// いまエンジンが読んでいる束の表示用データ（画面の束と食い違う時があるため、こちらを正とする）
export function getPlanDisplays() {
  return plan.map((it) => it?.display || null);
}

export function configure(patch) {
  Object.assign(settings, patch);
}
export function getSettings() {
  return { ...settings };
}

export function itemKey(it) {
  const d = it?.display;
  if (!d) return '';
  return `${d.kind || ''}|${d.q?.id || ''}|${d.keyword || ''}|${d.comp?.title || ''}|${d.num?.topic || ''}`;
}

// 読み上げ計画を読み込む。sig が現在と同じなら（＝画面再表示など）何もしない。
export function load(newPlan, { sig = null, startIndex = 0 } = {}) {
  if (sig != null && sig === state.planSig) {
    // 同一計画：再生位置を保つ。ただし並びは同じで読み方だけ変わった時（キーワードを声でも強調・
    // もし〜なら・頭文字法などの切り替え）は、中身だけ差し替える。以前はここで何もしなかったため、
    // 再生中にこれらを切り替えても束を読み直すまで一切効かなかった（次の問題から新しい読み方になる）。
    // 並び（どの問題をどの順で読むか）が1つでも違う時は差し替えない（読んでいる位置がずれるため）。
    if (Array.isArray(newPlan) && newPlan.length === plan.length && newPlan.every((it, i) => itemKey(it) === itemKey(plan[i]))) plan = newPlan;
    return;
  }
  stop();
  plan = newPlan || [];
  requeued = new Set();
  const i = plan.length ? Math.min(Math.max(0, startIndex), plan.length - 1) : 0;
  emit({
    planSig: sig,
    total: plan.length,
    hasPlan: plan.length > 0,
    index: i,
    display: plan[i]?.display || null,
    phase: 'question',
    started: false,
    finished: false,
    backgroundStopped: false,
  });
}

async function playOne(item, signal) {
  const steps = item?.steps || [];
  for (const step of steps) {
    if (signal.aborted) return;
    if (step.phase) emit({ phase: step.phase });
    if (step.say) {
      // 1つの読み上げが失敗しても（音声エンジンの一時的なエラー・通信の失敗など）、そこで
      // 全体を止めない。以前は1回のエラーで再生のループごと抜け、画面は「再生中」のまま
      // 何も聞こえなくなっていた（途中で止まる原因の1つ）。中断（AbortError）だけは本当に止める。
      try {
        if (settings.cloneVoice?.apiKey && settings.cloneVoice?.voiceId) {
          try {
            await speakCloned(step.say, { apiKey: settings.cloneVoice.apiKey, voiceId: settings.cloneVoice.voiceId, signal });
          } catch (e) {
            if (e?.name === 'AbortError') throw e;
            // クローン音声が使えない時は、端末の声で読む
            await speak(step.say, { rate: step.rate ?? settings.rate, pitch: step.pitch ?? settings.pitch, volume: settings.volume, voice: step.voice ?? settings.voice, signal });
          }
        } else {
          // step.rate：まだ解いていない新しい問題は等速以下で読む（#27）等、1ステップだけ
          // 速度を上書きしたい時に使う（省略時は設定どおりの速度）。
          // step.voice／step.pitch：答えだけ別の声（声B）で読む時に使う（録音学習の型）
          await speak(step.say, { rate: step.rate ?? settings.rate, pitch: step.pitch ?? settings.pitch, volume: settings.volume, voice: step.voice ?? settings.voice, signal });
        }
      } catch (e) {
        if (e?.name === 'AbortError') throw e;
        // 端末の読み上げそのものが使えない時は、全部の問題を無音で飛ばして「聞き終えた」にしない
        if (e?.name === 'TtsUnavailable') {
          stop();
          endNativeService();
          emit({ ttsUnavailable: true });
          throw new DOMException('aborted', 'AbortError');
        }
        console.warn('読み上げを1つ飛ばしました', e);
        await wait(400, signal);
      }
    }
    // 穴埋めの「ピー」：言葉で「ピー」と読まず、本物の短い音を鳴らす
    if (step.tone) {
      // step.tone が数値ならその高さ（問題の前の合図など）、true なら穴埋めの「ピー」
      beep(1, typeof step.tone === 'number' ? step.tone : 740, 60);
      await wait(typeof step.tone === 'number' ? 350 : 450, signal);
    }
    if (step.wait) await wait(step.wait, signal);
    if (step.waitGap) {
      // A2：数値を渡した時は、個人の解答ペースから計算した秒数をそのまま使う
      // （設定のgapSecondsを上書きする1ステップだけの指定。既存のtrue/'cap2'と共存する）。
      const g = typeof step.waitGap === 'number'
        ? step.waitGap
        : (step.waitGap === 'cap2' ? Math.min(settings.gapSeconds, 2) : settings.gapSeconds);
      await wait(g * 1000, signal);
    }
    // アウトプットモード：自動タイマーでは進めず、「解答を見る」（resumeManual）が
    // 押されるまでここで待つ（止めた・スキップした時は中断扱いで即解除する）。
    if (step.waitManual) {
      if (signal.aborted) return;
      // 待っている間だけ waitingManual を立てる（声で解答の聞き取り・「解答を見る」ボタンは、
      // 実際にここで待ち始めてから動かす。以前は「答えは？思い出してみよう」を読んでいる最中から
      // 聞き取りを始め、ここへ来る前に結果が出ると解除が空振りして止まったままになり得た）
      emit({ waitingManual: true });
      await new Promise((resolve) => {
        const done = () => { manualResolve = null; resolve(); };
        manualResolve = done;
        signal.addEventListener('abort', done, { once: true });
      });
      emit({ waitingManual: false });
    }
    // 解答・解説を読み終えてから次の問題へ移るまでの間（規定の時間で自動的に次へ進む）。
    if (step.waitNextGap) await wait(settings.nextGapSeconds * 1000, signal);
  }
}

let completedSeq = 0;
let requeued = new Set();

// トラック内で再登場：△✕にした問題を、今の位置から ahead 問あとにもう一度入れる（1問につき1回まで）。
// 画面側の束（AudioMode の plan）は変えず、エンジンが読んでいる束にだけ差し込む。
export function requeue(qid, ahead = 3) {
  if (!qid || requeued.has(qid) || !plan.length) return false;
  let src = -1;
  for (let i = Math.min(state.index, plan.length - 1); i >= 0; i -= 1) {
    if (plan[i]?.display?.q?.id === qid && !plan[i].display.reappear) { src = i; break; }
  }
  if (src < 0) return false;
  requeued.add(qid);
  const it = plan[src];
  const copy = {
    steps: [{ phase: 'keyword', say: 'もう一度出ます。' }, { wait: 300 }, ...it.steps.filter((s) => s.phase !== 'keyword' || !s.say)],
    display: { ...it.display, reappear: true, intro: undefined },
  };
  const at = Math.min(plan.length, state.index + ahead + 1);
  plan = [...plan.slice(0, at), copy, ...plan.slice(at)];
  emit({ total: plan.length });
  return true;
}

async function runFrom(start) {
  const controller = new AbortController();
  abort = controller;
  const signal = controller.signal;
  running = true;
  armSleep();
  startKeepAlive(); // 再開時（スキップ等）も無音キープアライブ＆通知を維持
  emit({ playing: true });
  try {
    let i = start;
    while (running) {
      if (i >= plan.length) {
        if (settings.loop && plan.length > 0) i = 0;
        else break;
      }
      emit({ index: i, display: plan[i]?.display || null });
      updateMediaMetadata();
      await playOne(plan[i], signal);
      // 止めた・飛ばした（中断）のではなく、最後まで読み終えた1件だけを知らせる
      // （誤答・△✕の「聞いた」印に使う。表面だけ・裏面だけの読み上げでも数えられるように）
      if (signal.aborted) break;
      completedSeq += 1;
      emit({ completedId: plan[i]?.display?.q?.id ?? null, completedSeq });
      i += 1;
    }
    if (!settings.loop && i >= plan.length && running) {
      stop();
      endNativeService();
      emit({ index: 0, phase: 'question', display: plan[0]?.display || null, started: false, finished: true, finishedBy: 'end' });
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.warn('audio engine error', e);
      // 想定外のエラーで止まった時は「再生中」の表示のまま黙らない（▶で続きから押し直せる状態に戻す）
      if (abort === controller) stop();
    }
  }
}

export function play() {
  if (!plan.length) return;
  // すでに読み上げ中なら何もしない。以前はロック画面・イヤホンの「再生」を再生中に押すと
  // 読み上げのループが2本同時に走り、2つの問題が重なって読まれていた。
  if (running) return;
  clearResumeTimer();
  requestWakeLock();
  initVisibility();
  startKeepAlive();
  emit({ started: true, finished: false, backgroundStopped: false, ttsUnavailable: false });
  const start = state.index < plan.length ? state.index : 0;
  runFrom(start);
}

// タブの非表示化で止めた読み上げが知らされないまま（＝トーストを出さないまま）
// 次の開始に至った場合に備え、念のためここでも下ろしておく。
export function clearTtsUnavailable() {
  emit({ ttsUnavailable: false });
}
export function clearBackgroundStopped() {
  emit({ backgroundStopped: false });
}

export function stop() {
  releaseWakeLock();
  clearSleep();
  clearResumeTimer();
  stopKeepAlive();
  running = false;
  if (abort) abort.abort();
  cancelSpeech();
  cancelClonedSpeech();
  emit({ playing: false });
}

// 下部バーの✕：止めて閉じる。以前は resetToStart（最初の問題へ戻す）を使っていたため、
// ✕で閉じると聞いていた位置まで消えていた。位置はそのまま残し、「再生中の束」だけを終える。
export function close() {
  stop();
  endNativeService();
  emit({ started: false, finished: false });
}

export function toggle() {
  if (state.playing) stop();
  else play();
}

function clearResumeTimer() {
  if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
}
// 止めてから少し待って index の位置から読み直す。連打した時は、前の予約を取り消して
// 最後に押した位置から1本だけ読む（以前は2回目の押下で「止まっている」と判定されて
// そのまま止まる・1回目の予約が古い位置から読み始める、の両方が起きていた）。
function restartAfterJump(wasPlaying, n) {
  const resume = wasPlaying || !!resumeTimer;
  stop();
  emit({ index: n, phase: 'question', display: plan[n]?.display || null, finished: false });
  if (resume) resumeTimer = setTimeout(() => { resumeTimer = null; runFrom(state.index); }, 120);
}

export function skip(delta) {
  const n = Math.max(0, Math.min(plan.length - 1, state.index + delta));
  restartAfterJump(running, n);
}

// 問題番号のバー（スクラバー）で、任意の位置へ直接ジャンプする（skipの「相対」ではなく「絶対」版、
// 考え方は同じ：再生中なら一度止めてから、目的の位置から読み直す）。
export function seekTo(targetIndex) {
  if (!plan.length) return;
  const n = Math.max(0, Math.min(plan.length - 1, Math.round(targetIndex)));
  restartAfterJump(running, n);
}

export function resetToStart() {
  stop();
  emit({ index: 0, phase: 'question', display: plan[0]?.display || null, started: false, finished: false });
}

// 声コマンド「全部できた」等で、残りを読まずにその場で「最後まで読み終えた」状態にする
// （新規#9）。自然に最後まで読み終えた時と同じ emit にして、終了検知の効果をそのまま使う。
export function finishNow() {
  stop();
  endNativeService();
  emit({ index: 0, phase: 'question', display: plan[0]?.display || null, started: false, finished: true, finishedBy: 'now' });
}

// アウトプットモード：「✅ 解答を見る」ボタンから呼ぶ。待機中でなければ何もしない。
export function resumeManual() {
  if (manualResolve) manualResolve();
}

// スリープタイマー。以前は「再生中の時だけ」タイマーを仕掛けていたため、▶を押す直前に
// 設定する通常の流れ（togglePlay）では一度も仕掛からず、また前へ/次へで止めて読み直すたびに
// 消えていた。止める時刻を覚えておき、読み上げを始める（再開する）たびに残り時間で仕掛け直す。
export function setSleep(min) {
  clearSleep();
  sleepDeadline = min > 0 ? Date.now() + min * 60 * 1000 : 0;
  armSleep();
}

function armSleep() {
  clearSleep();
  if (!sleepDeadline || !running) return;
  const left = sleepDeadline - Date.now();
  if (left <= 0) { sleepDeadline = 0; return; }
  sleepTimer = setTimeout(() => { sleepDeadline = 0; stop(); }, left);
}

function clearSleep() {
  if (sleepTimer) {
    clearTimeout(sleepTimer);
    sleepTimer = null;
  }
}

async function requestWakeLock() {
  if (!settings.wakeLockEnabled) return; // バッテリーを気にする人向けにオフにできる（設定）
  try {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener?.('release', () => {
        wakeLock = null;
      });
    }
  } catch (e) {
    /* 継続 */
  }
}
function releaseWakeLock() {
  try {
    wakeLock?.release();
  } catch (e) {
    /* noop */
  }
  wakeLock = null;
}
let hiddenAt = 0;
function initVisibility() {
  if (visInit || typeof document === 'undefined') return;
  visInit = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    // ここから visible に戻った直後
    if (running) requestWakeLock();
    // 他のアプリへ切り替えた・画面を見ていなかった間（1.2秒を超える離脱）は、
    // ブラウザ側の都合（Web Speech APIがタブのバックグラウンド化で読み上げを
    // 止めてしまう既知の制約、speech.js のヘッダーコメント参照）で
    // 読み上げが止まったまま戻ってくることがある。
    // 【2026-11-12】以前はここで自動的に runFrom() を呼び直していたが、
    // ユーザー報告で改善が見られなかった——`visibilitychange` ハンドラの呼び出しには
    // 直接のユーザー操作（クリック等のuser activation）が伴わないため、バックグラウンド化で
    // 一度止まった speechSynthesis を非ジェスチャー文脈から再開しようとしても、
    // ブラウザによっては音が出ないまま静かに失敗する可能性がある（確証は無いが、
    // 自動再開が効かないという報告と矛盾しない）。**止まったことを偽って
    // 「再生中のまま」に見せかけない**——`stop()`で状態を正直に「一時停止」へ戻し、
    // 今の位置（`state.index`）はそのまま保つ。実際に音を鳴らすのは、
    // ユーザーが▶を押す（＝正真正銘のユーザー操作）時のことにする。
    // アプリ版は端末の読み上げ（裏でも止まらない）で読んでいるので止めない。止めると、画面を
    // つけるたびに聞いていた音声が一時停止になってしまう。
    if (running && state.playing && hiddenAt && Date.now() - hiddenAt > 1200 && !nativeTts()) {
      recoverFromBackground();
    }
    hiddenAt = 0;
  });
}

function recoverFromBackground() {
  stop();
  emit({ backgroundStopped: true });
}

// React 用フック
export function useAudioEngine() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
