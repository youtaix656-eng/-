import { useEffect, useRef, useState, useCallback } from 'react';
import { loadActivePomoSong } from '../lib/storage.js';
import { createYoutubePlayer } from '../lib/pomoYoutube.js';
import { setPomoRunning } from '../lib/runtimeFlags.js';
import { bellRing, beep } from '../lib/sound.js';
import * as audioEngine from '../lib/audioEngine.js';
import { isSpeechSupported, speak, cancelSpeech, resumeSpeech } from '../lib/speech.js';
import { COURSE_PHASES, catchUpCourse, courseScheduledEnd, coursePhaseOrdinal, courseCountdownText, hhmmOf } from '../lib/pomoCourse.js';
import { startTicker } from '../lib/pomoTicker.js';
import { loadPomoRun, savePomoRun, clearPomoRun, restorePomoRun } from '../lib/pomoRunState.js';
import { PomodoroConfigFields } from './PomodoroConfigFields.jsx';

// タイマー（全画面の上部に固定表示）。
// 2026-11-08、ユーザー指定で「全機能を一度リセットし、①タイマーの時間を自分で+/-で
// 設定できる ②スマホ内の音楽を1曲だけ設定し、勉強中はその1曲だけをループ再生する、の
// 2つだけに絞る」よう全面的に作り直した。
// 2026-11-14〜15、②を単曲→プレイリスト（取り込み・接続・YouTubeの3種類から追加できる、
// PomodoroConfigFields.jsx参照）へ拡張。選んだ1曲だけをループ再生する点は変えていない。
// 2026-11-16、ユーザー指定で「2時間コース」（25分勉強+5分休憩×4回）を追加（詳細は
// lib/pomoCourse.jsのコメント参照）。休憩の開始・終了に合わせて、Pomodoro自身の音楽と
// 音声学習×連結学習（AudioMode.jsx）の再生を自動で一時停止／再開する——AudioMode.jsxは
// 「音声学習は画面をまたいでも止めない」設計（audioEngine.jsがReact外のモジュールとして
// 再生ループを持つ）なので、Pomodoro.jsxからもaudioEngineの`stop()`/`play()`/
// `getSnapshot()`を直接呼べる。2時間経過したら`bellRing`（鈴の音、beepとは別の音色）で
// 知らせ、終了予定時刻も画面に出す。シンプルタイマー（既定）とは別モードとして追加した
// だけで、上記で削除した他の機能（短い休憩/長い休憩/サイクル回数の個別設定・通知等）を
// 再び持たせたわけではない（2時間コースは25分/5分/4回に固定、設定できるのはモードの
// 切り替えだけ）。
// 同日、ユーザー指定で休憩開始・休憩終了それぞれの10秒前から「休憩開始まで10秒前、9、8…」
// のような声のカウントダウンを追加（lib/speech.jsの既存speak()をそのまま使う。
// 当初は音声学習の読み上げと同じ列に並べるだけだったため、音声学習中は鳴らないまま
// 休憩に入る瞬間に捨てられていた。今は10秒前に音声学習を先に止めてから数える＝announceCountdown）。
// 以前にあった多数の機能（プリセット・短い休憩/長い休憩/サイクル回数・勉強中の通知・
// 1日の目標勉強時間・効果音・振動・画面常時点灯・集中モード自動最小化・バー位置の切替・
// タブを閉じる時の確認・勉強内容メモ・週間統計グラフ/CSV書き出し・複数タブの幹事タブ判定
// （BroadcastChannel）・アプリアイコンのバッジ・終了時刻の通知予約・定期バックグラウンド
// 確認・集中度セルフチェック・中断理由の記録等）は、このバッチで意図的にすべて削除した
// （ユーザー確認済み・CLAUDE.md参照）。保存していたタイマーの実行状態（phaseEndAt等）は
// 新しいスキーマでは使わないため、アプリを再読み込みするとタイマーは待機中に戻る
// （これも「全機能のリセット」の結果として意図したもの）。
//
// 時刻ベース設計は維持する：残り時間を1秒ずつ減算せず「終わる時刻（endAt）」を持ち、
// 今の時刻との差から毎回計算し直す（タブが裏に回っていても、戻ってきた時に正確な
// 残り時間を表示できる）。
export default function Pomodoro({ store, onToast }) {
  const cfg = store.settings.pomodoro || {};
  const { updateSettings } = store;
  const setCfg = useCallback(
    (patch) => updateSettings({ pomodoro: { ...(store.settings.pomodoro || {}), ...patch, updatedAt: Date.now() } }),
    [store.settings.pomodoro, updateSettings]
  );

  const durationSec = (cfg.durationMin || 25) * 60;
  // アプリを閉じる前の状態（lib/pomoRunState.js）。最初の1回だけ読み、閉じている間に
  // 進んだぶんを計算し直してから、下の各stateの初期値にする。
  const restoredRef = useRef(undefined);
  if (restoredRef.current === undefined) {
    restoredRef.current = restorePomoRun(loadPomoRun(), Date.now(), cfg.mode);
  }
  const restored = restoredRef.current;
  const [running, setRunning] = useState(() => !!restored?.running);
  const [endAt, setEndAt] = useState(() => restored?.endAt || 0);
  // 停止中の残り秒数
  const [remaining, setRemaining] = useState(() => (restored && !(restored.finished && cfg.mode !== 'course2h') ? restored.remaining : durationSec));
  const [finished, setFinished] = useState(() => !!restored?.finished);
  const [min, setMin] = useState(true); // 省スペース：既定は最小化
  const [open, setOpen] = useState(false);
  const [musicUrl, setMusicUrl] = useState(null); // 取り込み・接続（file/filehandle）用
  const [musicKind, setMusicKind] = useState(null); // 'file' | 'youtube' | null
  const [musicVersion, setMusicVersion] = useState(0); // 設定パネルで曲を変更したら読み直す
  const [tick, setTick] = useState(0); // 表示を1秒ごとに再計算させるためだけの値
  // 2時間コース：coursePhaseIndexがnull＝コース未開始（またはシンプルモード）。
  // 0〜7＝COURSE_PHASESの添字（study/breakが交互に4回ずつ）。courseFinishedAtは
  // コースが最後まで終わった時刻（完了バナー・終了時の通知に使う）。
  const [coursePhaseIndex, setCoursePhaseIndex] = useState(() => restored?.coursePhaseIndex ?? null);
  const [courseFinishedAt, setCourseFinishedAt] = useState(() => restored?.courseFinishedAt ?? null);
  // 休憩に入った時にaudioEngine（音声学習）を止めたかどうか。止めた場合だけ、次の
  // 勉強フェーズで再開する（止めていない＝元々使っていなかった場合は何もしない）。
  const audioPausedByBreakRef = useRef(false);
  // 休憩開始・休憩終了の10秒前カウントダウンで、同じ秒を2回読み上げないようにするための記録
  // （{phaseIndex, sec}。phaseIndexが変わったら新しいフェーズのカウントダウンとして扱う）。
  const lastCountdownRef = useRef({ phaseIndex: null, sec: null });

  const audioRef = useRef(null);
  const barRef = useRef(null);
  const ytContainerRef = useRef(null); // YouTubeプレイヤーの差し込み先（Reactは子要素を持たせない）
  const ytPlayerRef = useRef(null);

  // 停止中は分数設定の変更に合わせて残り時間を更新（2時間コース中はdurationMinを使わないため対象外）
  // 分数・モードが実際に変わった時だけ反応する（一時停止しただけ・開き直しただけの時に
  // 残り時間を満タンへ戻さない）。
  const prevCfgRef = useRef({ durationSec, mode: cfg.mode });
  useEffect(() => {
    const prev = prevCfgRef.current;
    prevCfgRef.current = { durationSec, mode: cfg.mode };
    if (prev.durationSec === durationSec && prev.mode === cfg.mode) return;
    if (!running && cfg.mode !== 'course2h') {
      setFinished(false);
      setRemaining(durationSec);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationSec, cfg.mode]);

  // いまの状態を端末内へ残す（閉じて開き直しても続きから数えるため）。
  // 待機中（まだ始めていない・リセット済み）は残さない。
  useEffect(() => {
    const full = cfg.mode === 'course2h' ? COURSE_PHASES[0].min * 60 : durationSec;
    const idle = !running && !finished && coursePhaseIndex == null && remaining >= full;
    if (idle) { clearPomoRun(); return; }
    savePomoRun({
      mode: cfg.mode === 'course2h' ? 'course2h' : 'simple',
      running, endAt, remaining, coursePhaseIndex, finished, courseFinishedAt,
    });
  }, [running, endAt, remaining, coursePhaseIndex, finished, courseFinishedAt, cfg.mode, durationSec]);

  // 開き直した時に、どうなったかを一度だけ知らせる（音は自動では鳴らせないので正直に書く）
  useEffect(() => {
    if (!cfg.enabled || !restored?.note) return;
    if (restored.note === 'continued') {
      onToast?.('⏱️ タイマーを続きから再開しました（曲は自動では鳴りません。一度止めて▶を押すと鳴ります）');
    } else if (restored.note === 'ended') {
      onToast?.(restored.courseFinishedAt
        ? `🔔 アプリを閉じている間に2時間コースが終了していました（${hhmmOf(restored.courseFinishedAt)}）`
        : '⏰ アプリを閉じている間にタイマーが終了していました');
    } else if (restored.note === 'paused') {
      onToast?.('⏸ タイマーは一時停止のまま残っています。▶で続きから始められます');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // シンプル→2時間コースへモードを切り替えた直後（まだコース未開始）は、表示を
  // 1コマ目（勉強25分）に合わせる。
  useEffect(() => {
    if (!running && cfg.mode === 'course2h' && coursePhaseIndex == null) {
      setRemaining(COURSE_PHASES[0].min * 60);
    }
  }, [cfg.mode, running, coursePhaseIndex]);

  // プレイリストで選ばれている曲を読み込む（設定パネルで追加・選択・削除された時も読み直す）。
  // 曲の種類（取り込み・接続＝musicUrl／YouTube＝YouTube IFrame Player）で読み込み方が違う。
  useEffect(() => {
    let url = null;
    let cancelled = false;
    (async () => {
      const song = await loadActivePomoSong(cfg.activeSongId);
      if (cancelled) return;
      try { ytPlayerRef.current?.destroy?.(); } catch (e) { /* noop */ }
      ytPlayerRef.current = null;
      if (!song) {
        setMusicUrl(null);
        setMusicKind(null);
        return;
      }
      if (song.kind === 'youtube') {
        setMusicUrl(null);
        setMusicKind('youtube');
        try {
          const player = await createYoutubePlayer(ytContainerRef.current, song.videoId, {
            volume: cfg.musicVolume ?? 1,
            onError: () => onToast?.('⚠️ YouTubeの動画を再生できませんでした（削除・非公開の可能性があります）'),
          });
          if (cancelled) { try { player.destroy(); } catch (e) { /* noop */ } return; }
          ytPlayerRef.current = player;
        } catch (e) {
          if (!cancelled) onToast?.('⚠️ YouTubeの読み込みに失敗しました（オフラインの可能性があります）');
        }
        return;
      }
      let blob = song.blob;
      if (song.kind === 'filehandle') {
        try {
          blob = await song.handle.getFile();
        } catch (e) {
          if (!cancelled) onToast?.(`⚠️「${song.name}」に再度アクセスできませんでした。設定でこの曲をもう一度選ぶと直るかもしれません。`);
          setMusicUrl(null);
          setMusicKind(null);
          return;
        }
      }
      if (cancelled) return;
      url = URL.createObjectURL(blob);
      setMusicUrl(url);
      setMusicKind('file');
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicVersion, cfg.activeSongId]);

  // 音量スライダー（設定画面側で変更された時も即座に反映する）
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = cfg.musicVolume ?? 1;
    try { ytPlayerRef.current?.setVolume?.(Math.round((cfg.musicVolume ?? 1) * 100)); } catch (e) { /* noop */ }
  }, [cfg.musicVolume]);

  // SW更新の反映保留判定（main.jsx）に、タイマーが実行中かどうかを伝える
  useEffect(() => {
    setPomoRunning(running);
    return () => setPomoRunning(false);
  }, [running]);

  const displayRemaining = running ? Math.max(0, Math.ceil((endAt - Date.now()) / 1000)) : remaining;
  void tick; // tickはこのレンダーを起こすためだけに参照する

  // 曲の操作は、いつ呼ばれても最新の曲・音量で動くようrefから読む（休憩に入る処理は
  // 少し前の描画で作られた関数から呼ばれることがあり、その時点の値を抱えたままだと
  // 「YouTubeの曲なのに止めに行く先が違う」ことが起き得る）。
  const musicRef = useRef({ kind: null, url: null, volume: 1 });
  musicRef.current = { kind: musicKind, url: musicUrl, volume: cfg.musicVolume ?? 1 };
  const playMusic = () => {
    duckMusic(false);
    if (musicRef.current.kind === 'youtube') {
      try { ytPlayerRef.current?.playVideo?.(); } catch (e) { /* noop */ }
      return;
    }
    if (musicRef.current.url && audioRef.current) {
      try {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      } catch (e) {
        /* noop */
      }
    }
  };
  // カウントダウンの声が曲に埋もれないよう、数えている間だけ曲の音量を下げる（duck=true）。
  // 戻す時（duck=false）は設定の音量へ戻す。
  const duckMusic = (duck) => {
    const base = musicRef.current.volume;
    const v = duck ? base * 0.2 : base;
    try { if (audioRef.current) audioRef.current.volume = v; } catch (e) { /* noop */ }
    try { ytPlayerRef.current?.setVolume?.(Math.round(v * 100)); } catch (e) { /* noop */ }
  };
  // 10秒前からの声のカウントダウン（「休憩開始まで10秒前、9、8…」）。
  // 2026-11-15 ユーザー報告「このカウントが鳴っていなかった」への修正：
  //  ①音声学習の読み上げ中だと、同じ読み上げの列の後ろに並んだまま、休憩に入る瞬間に
  //    まとめて捨てられていた → 10秒前の時点で音声学習を先に止めてから数える
  //    （休憩が明けたら今までどおり自動で再開する）。
  //  ②曲に埋もれていた → 数えている間だけ曲の音量を下げる。
  //  ③シンプルタイマーでは数えていなかった → 終了（＝休憩の開始）の10秒前から数える。
  //  ④読み上げが使えない・失敗した時は黙らず、短い合図音で代える。
  // first＝このコマのカウントダウンで最初の1回。ちょうど10秒の瞬間を拾えなくても
  // （見直しが遅れても）、最初の1回で必ず音声学習を止め、曲を下げてから数える。
  const announceCountdown = (phaseType, secLeft, first) => {
    if (first) {
      if (phaseType === 'study') {
        duckMusic(true);
        if (audioEngine.getSnapshot().playing) {
          audioPausedByBreakRef.current = true;
          audioEngine.stop();
        }
      }
      // 前の読み上げが列に残っていたら捨ててから数え始める
      try { cancelSpeech(); resumeSpeech(); } catch (e) { /* noop */ }
    }
    const fallback = () => beep(1, first ? 1320 : 880, 70);
    if (!isSpeechSupported()) { fallback(); return; }
    speak(courseCountdownText(phaseType, secLeft, first), { rate: 1.15 }).catch((e) => {
      if (e?.name !== 'AbortError') fallback();
    });
  };
  const stopMusic = () => {
    duckMusic(false);
    // 種類の取り違えで止め損ねないよう、両方とも止める（鳴っていない側は何も起きない）
    try { ytPlayerRef.current?.pauseVideo?.(); } catch (e) { /* noop */ }
    try { audioRef.current?.pause(); } catch (e) { /* noop */ }
  };

  const finish = useCallback(() => {
    setRunning(false);
    setRemaining(durationSec); // 終了後の表示は次の1回ぶん（以前からの見え方のまま）
    setFinished(true);
    stopMusic();
    // シンプルタイマーの終了＝休憩の開始。カウントダウンも「休憩開始まで」と数えているので、
    // 2時間コースの休憩と同じく音声学習もここで止める（2026-11-15 ユーザー報告
    // 「休憩に入るときに音声学習と音楽が止まらなかった」。以前はここで再開していた）。
    // 止めるだけで、勝手には再開しない——次に▶を押すのは本人。
    audioPausedByBreakRef.current = false;
    try {
      if (audioEngine.getSnapshot().playing) audioEngine.stop();
    } catch (e) { /* noop */ }
    onToast?.('⏰ タイマーが終了しました。休憩です（音楽・音声学習を止めました）');
  }, [onToast, durationSec]);

  // 2時間コースの1コマが終わる（または複数コマがまとめて終わっている）時に呼ぶ。
  // タブが長く裏に回っていても、catchUpCourseが「今本当はどのコマにいるべきか」を
  // 一度に求めてくれるので、ここでは最終的に着地したコマに合わせて音楽・音声学習の
  // 一時停止／再開だけを行う（裏に回っている間に何度も通知を出すことはしない）。
  const advanceCourse = useCallback(() => {
    const result = catchUpCourse(coursePhaseIndex, endAt);
    if (result.finished) {
      setRunning(false);
      setCoursePhaseIndex(null);
      setFinished(true);
      setCourseFinishedAt(Date.now());
      setRemaining(0);
      stopMusic();
      // 最後の休憩の終わりなので、音声学習はここでは自動再開しない（コース終了のため）。
      audioPausedByBreakRef.current = false;
      bellRing(85, () => onToast?.('⚠️ 自動再生がブロックされ、アラーム音が鳴らなかった可能性があります'));
      onToast?.(`🔔 2時間コースが終了しました（${hhmmOf(Date.now())}）`);
      return;
    }
    setCoursePhaseIndex(result.phaseIndex);
    setEndAt(result.endAt);
    setRemaining(Math.max(0, Math.ceil((result.endAt - Date.now()) / 1000)));
    const phase = COURSE_PHASES[result.phaseIndex];
    const ord = coursePhaseOrdinal(result.phaseIndex);
    if (phase.type === 'break') {
      stopMusic();
      const wasPlaying = audioEngine.getSnapshot().playing;
      if (wasPlaying) {
        audioPausedByBreakRef.current = true;
        audioEngine.stop();
      }
      onToast?.(`☕ 休憩${ord.n}/${ord.total}（${phase.min}分）に入りました。音楽・音声学習を一時停止しました`);
    } else {
      playMusic();
      if (audioPausedByBreakRef.current) {
        audioEngine.play();
        audioPausedByBreakRef.current = false;
      }
      onToast?.(`📖 勉強${ord.n}/${ord.total}（${phase.min}分）を始めます`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coursePhaseIndex, endAt, onToast]);

  const toggle = () => {
    if (running) {
      setRemaining(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
      setRunning(false);
      stopMusic();
      // シンプルタイマーのカウントダウン中に止めた時は、数えるために止めていた音声学習を戻す
      if (coursePhaseIndex == null && audioPausedByBreakRef.current) {
        audioPausedByBreakRef.current = false;
        audioEngine.play();
      }
      return;
    }
    if (cfg.mode === 'course2h') {
      if (coursePhaseIndex == null) {
        // 新しく2時間コースを開始する
        setFinished(false);
        setCourseFinishedAt(null);
        audioPausedByBreakRef.current = false;
        lastCountdownRef.current = { phaseIndex: null, sec: null };
        const dur = COURSE_PHASES[0].min * 60;
        setCoursePhaseIndex(0);
        setEndAt(Date.now() + dur * 1000);
        setRemaining(dur);
        setRunning(true);
        playMusic();
        onToast?.('▶ 2時間コース（25分勉強×4・各間に5分休憩）を開始しました');
        return;
      }
      // 一時停止からの再開（coursePhaseIndexは保ったまま、残りの秒数から続ける）
      const base = remaining > 0 ? remaining : COURSE_PHASES[coursePhaseIndex].min * 60;
      setEndAt(Date.now() + base * 1000);
      setRemaining(base);
      setRunning(true);
      if (COURSE_PHASES[coursePhaseIndex].type === 'study') playMusic();
      return;
    }
    const base = finished || remaining <= 0 ? durationSec : remaining;
    lastCountdownRef.current = { phaseIndex: null, sec: null };
    setFinished(false);
    setEndAt(Date.now() + base * 1000);
    setRemaining(base);
    setRunning(true);
    playMusic();
  };
  const reset = () => {
    setRunning(false);
    setFinished(false);
    setCoursePhaseIndex(null);
    setCourseFinishedAt(null);
    audioPausedByBreakRef.current = false;
    lastCountdownRef.current = { phaseIndex: null, sec: null };
    setRemaining(cfg.mode === 'course2h' ? COURSE_PHASES[0].min * 60 : durationSec);
    stopMusic();
  };

  // 1秒ごとの見直し（時刻ベース。表示はtickで再計算するだけ）。
  // 中身は毎回の描画で作り直してrefに置く（曲の種類・音量・コマなど、いつも最新の値で動く）。
  // 起こす側（下のstartTicker）は「動いているかどうか」だけで作り直す——以前は描画のたびに
  // タイマーを作り直していたので、作り直しが続くと1秒の見直しが飛ぶことがあった。
  const mediaTickAtRef = useRef(0); // 曲のtimeupdateから起こす見直しの間引き用
  const handledEndRef = useRef(0); // 同じ終わりの時刻を2回処理しない（Workerと本体の両方から起こされるため）
  const tickHandlerRef = useRef(() => {});
  tickHandlerRef.current = () => {
    if (!running) return;
    const now = Date.now();
    if (now >= endAt) {
      if (handledEndRef.current === endAt) return;
      handledEndRef.current = endAt;
      if (coursePhaseIndex != null) advanceCourse();
      else finish();
      return;
    }
    // 2時間コースは各コマの終わり、シンプルタイマーは終了（＝休憩の開始）の10秒前から数える
    const key = coursePhaseIndex != null ? coursePhaseIndex : -1;
    const phaseType = coursePhaseIndex != null ? COURSE_PHASES[coursePhaseIndex].type : 'study';
    const secLeft = Math.ceil((endAt - now) / 1000);
    if (secLeft >= 1 && secLeft <= 10) {
      const prev = lastCountdownRef.current;
      if (prev.phaseIndex !== key || prev.endAt !== endAt || prev.sec !== secLeft) {
        const first = prev.phaseIndex !== key || prev.endAt !== endAt;
        lastCountdownRef.current = { phaseIndex: key, endAt, sec: secLeft };
        announceCountdown(phaseType, secLeft, first);
      }
    }
    setTick((t) => t + 1);
  };
  useEffect(() => {
    if (!running) return undefined;
    const stop = startTicker(() => tickHandlerRef.current());
    // 画面へ戻った瞬間にも見直す（凍結されていた間に過ぎたぶんへ、すぐ追いつく）
    const onVis = () => { if (document.visibilityState === 'visible') tickHandlerRef.current(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [running]);

  // 最小化バーとフルバーで高さが違うため、ヘッダー側の--pomo-hへ実測値を反映する
  // （固定値だと最小化時に隙間ができる）。
  useEffect(() => {
    if (!barRef.current) return undefined;
    const el = barRef.current;
    const applyHeight = () => document.documentElement.style.setProperty('--pomo-h', `${el.offsetHeight}px`);
    applyHeight();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(applyHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [min, open]);

  if (!cfg.enabled) return null;

  // 2時間コースが今まさに進行中（開始済み・一時停止中含む）の時だけ、そのフェーズの
  // 情報を使う。それ以外（シンプルモード、またはコース未開始・終了後）はnull。
  const activeCoursePhase = cfg.mode === 'course2h' && coursePhaseIndex != null ? COURSE_PHASES[coursePhaseIndex] : null;
  const activePhaseDurationSec = activeCoursePhase ? activeCoursePhase.min * 60 : durationSec;
  const courseOrd = activeCoursePhase ? coursePhaseOrdinal(coursePhaseIndex) : null;
  const courseEndPreview = activeCoursePhase
    ? courseScheduledEnd(coursePhaseIndex, running ? endAt : Date.now() + displayRemaining * 1000)
    : null;
  const pct = activePhaseDurationSec > 0
    ? Math.min(100, Math.max(0, ((activePhaseDurationSec - displayRemaining) / activePhaseDurationSec) * 100))
    : 0;
  const phaseIcon = activeCoursePhase ? (activeCoursePhase.type === 'break' ? '☕' : '📖') : '⏱️';
  const phaseLabel = activeCoursePhase
    ? `${phaseIcon} ${activeCoursePhase.type === 'break' ? '休憩' : '勉強'} ${courseOrd.n}/${courseOrd.total}`
    : '⏱️ タイマー';

  // YouTubeプレイヤーの差し込み先はReactが子要素を持たず空のまま渡す
  // （YT APIがこのDOM要素をiframeへ置き換えるため、Reactに再描画で触らせない）。
  const musicEls = (
    <>
      {/* 曲が鳴っている間は、曲の再生位置の更新（timeupdate）からも見直しを起こす。
          画面を消した・裏に回した時にページ側のタイマーが止められても、鳴っている曲の
          イベントは届き続けるので、休憩に入る処理とカウントダウンを取りこぼしにくくなる。 */}
      <audio
        ref={audioRef}
        src={musicUrl || undefined}
        preload="auto"
        loop
        onTimeUpdate={() => {
          const now = Date.now();
          if (now - mediaTickAtRef.current < 900) return;
          mediaTickAtRef.current = now;
          tickHandlerRef.current();
        }}
      />
      <div ref={ytContainerRef} style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', bottom: 0, right: 0 }} />
    </>
  );

  if (min) {
    return (
      <div className="pomo-bar mini" ref={barRef}>
        {musicEls}
        <button className="pomo-mini-body" onClick={() => setMin(false)} aria-label="タイマーを開く">
          <span className="pomo-phase">{phaseIcon}</span>
          <span className="pomo-time sm">{mmssOf(displayRemaining)}</span>
          {running && <span className="pomo-mini-run">●</span>}
          <span className="pomo-mini-hint">{activeCoursePhase ? `${courseOrd.n}/${courseOrd.total} ▾` : 'タイマー ▾'}</span>
        </button>
        <div className="pomo-controls">
          <button className="pomo-btn main" onClick={toggle} aria-label="開始/一時停止">{running ? '⏸' : '▶'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pomo-bar" ref={barRef}>
      {musicEls}
      <div className="pomo-main">
        <span className="pomo-phase">{phaseLabel}</span>
        <span className="pomo-time">{mmssOf(displayRemaining)}</span>
        <div className="pomo-controls">
          <button className="pomo-btn main" onClick={toggle} aria-label="開始/一時停止">{running ? '⏸' : '▶'}</button>
          <button className="pomo-btn" onClick={reset} aria-label="リセット">⟲</button>
          <button className="pomo-btn" onClick={() => setOpen((v) => !v)} aria-label="設定">⚙</button>
          <button className="pomo-btn" onClick={() => { setOpen(false); setMin(true); }} aria-label="最小化">▴</button>
        </div>
      </div>
      <div className="pomo-progress"><span style={{ width: `${pct}%` }} /></div>
      {activeCoursePhase && (
        <p className="pomo-hint">
          🔔 2時間コース・終了予定 {hhmmOf(courseEndPreview)}
          {activeCoursePhase.type === 'break' ? '（休憩中：音楽・音声学習を一時停止しています）' : ''}
        </p>
      )}
      {finished && !running && (
        cfg.mode === 'course2h' && courseFinishedAt ? (
          <p className="pomo-hint" style={{ color: 'var(--accent)' }}>🔔 2時間コースが終了しました（{hhmmOf(courseFinishedAt)}）</p>
        ) : (
          <p className="pomo-hint" style={{ color: 'var(--accent)' }}>⏰ 終了しました</p>
        )
      )}
      {open && (
        <div className="pomo-config">
          <PomodoroConfigFields cfg={cfg} setCfg={setCfg} onToast={onToast} onMusicChange={() => setMusicVersion((v) => v + 1)} />
          <p className="pomo-hint" style={{ marginTop: 8 }}>
            間違って消してしまうことがあったため、ここには「閉じる」ボタンはありません。
            タイマーをオフにしたい時は、設定画面の「画面上部にポモドーロタイマーを表示」を
            オフにしてください。
          </p>
        </div>
      )}
    </div>
  );
}

function mmssOf(sec) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
