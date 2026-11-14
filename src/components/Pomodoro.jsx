import { useEffect, useRef, useState, useCallback } from 'react';
import { loadActivePomoSong } from '../lib/storage.js';
import { createYoutubePlayer } from '../lib/pomoYoutube.js';
import { setPomoRunning } from '../lib/runtimeFlags.js';
import { bellRing } from '../lib/sound.js';
import * as audioEngine from '../lib/audioEngine.js';
import { COURSE_PHASES, catchUpCourse, courseScheduledEnd, coursePhaseOrdinal, hhmmOf } from '../lib/pomoCourse.js';
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
  const [running, setRunning] = useState(false);
  const [endAt, setEndAt] = useState(0);
  const [remaining, setRemaining] = useState(durationSec); // 停止中の残り秒数
  const [finished, setFinished] = useState(false);
  const [min, setMin] = useState(true); // 省スペース：既定は最小化
  const [open, setOpen] = useState(false);
  const [musicUrl, setMusicUrl] = useState(null); // 取り込み・接続（file/filehandle）用
  const [musicKind, setMusicKind] = useState(null); // 'file' | 'youtube' | null
  const [musicVersion, setMusicVersion] = useState(0); // 設定パネルで曲を変更したら読み直す
  const [tick, setTick] = useState(0); // 表示を1秒ごとに再計算させるためだけの値
  // 2時間コース：coursePhaseIndexがnull＝コース未開始（またはシンプルモード）。
  // 0〜7＝COURSE_PHASESの添字（study/breakが交互に4回ずつ）。courseFinishedAtは
  // コースが最後まで終わった時刻（完了バナー・終了時の通知に使う）。
  const [coursePhaseIndex, setCoursePhaseIndex] = useState(null);
  const [courseFinishedAt, setCourseFinishedAt] = useState(null);
  // 休憩に入った時にaudioEngine（音声学習）を止めたかどうか。止めた場合だけ、次の
  // 勉強フェーズで再開する（止めていない＝元々使っていなかった場合は何もしない）。
  const audioPausedByBreakRef = useRef(false);

  const audioRef = useRef(null);
  const barRef = useRef(null);
  const tickRef = useRef(null);
  const ytContainerRef = useRef(null); // YouTubeプレイヤーの差し込み先（Reactは子要素を持たせない）
  const ytPlayerRef = useRef(null);

  // 停止中は分数設定の変更に合わせて残り時間を更新（2時間コース中はdurationMinを使わないため対象外）
  useEffect(() => {
    if (!running && cfg.mode !== 'course2h') setRemaining(durationSec);
  }, [durationSec, running, cfg.mode]);

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

  const playMusic = () => {
    if (musicKind === 'youtube') {
      try { ytPlayerRef.current?.playVideo?.(); } catch (e) { /* noop */ }
      return;
    }
    if (musicUrl && audioRef.current) {
      try {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      } catch (e) {
        /* noop */
      }
    }
  };
  const stopMusic = () => {
    if (musicKind === 'youtube') {
      try { ytPlayerRef.current?.pauseVideo?.(); } catch (e) { /* noop */ }
      return;
    }
    try { audioRef.current?.pause(); } catch (e) { /* noop */ }
  };

  const finish = useCallback(() => {
    setRunning(false);
    setRemaining(0);
    setFinished(true);
    stopMusic();
    onToast?.('⏰ タイマーが終了しました');
  }, [onToast]);

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
      return;
    }
    if (cfg.mode === 'course2h') {
      if (coursePhaseIndex == null) {
        // 新しく2時間コースを開始する
        setFinished(false);
        setCourseFinishedAt(null);
        audioPausedByBreakRef.current = false;
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
    setRemaining(cfg.mode === 'course2h' ? COURSE_PHASES[0].min * 60 : durationSec);
    stopMusic();
  };

  // 1秒ごとの見直し（時刻ベース。表示はtickで再計算するだけ）
  useEffect(() => {
    if (!running) {
      if (tickRef.current) clearInterval(tickRef.current);
      return undefined;
    }
    tickRef.current = setInterval(() => {
      if (Date.now() >= endAt) {
        if (coursePhaseIndex != null) advanceCourse();
        else finish();
        return;
      }
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [running, endAt, finish, advanceCourse, coursePhaseIndex]);

  // タブが再表示された瞬間に即座に表示を追いつかせる
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible' && running) setTick((t) => t + 1); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
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
      <audio ref={audioRef} src={musicUrl || undefined} preload="auto" loop />
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
