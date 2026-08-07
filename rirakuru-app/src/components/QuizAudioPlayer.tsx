"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Volume2,
  Play,
  Pause,
  Square,
  ChevronLeft,
  ChevronRight,
  Ear,
  Repeat,
  Repeat1,
} from "lucide-react";
import { isSpeechSupported, speakQueue, type SpeechQueueHandle } from "@/lib/tts";
import { buildReviewQuizAudioPairs } from "@/lib/audioSegments";
import type { ReviewCard } from "@/lib/reviewPool";

// ============================================================
// 音声で問題を解くプレーヤー
// - 自分のペースモード：「問題を再生」→（自分で考える）→「正解を聞く」
//   問題と答えを続けて自動再生しない（先に答えを言ってしまわないため）。
// - 自動再生モード：問題→正解→次の問題…と流れ続ける「聞き流し」用。
//   1問リピート／1周リピートを選べる。勉強用にBGM的に流す想定。
// ============================================================

type RepeatMode = "none" | "one" | "all";

export function QuizAudioPlayer({ cards }: { cards: ReviewCard[] }) {
  const pairs = useMemo(() => buildReviewQuizAudioPairs(cards), [cards]);
  const [supported, setSupported] = useState(true);
  const [mode, setMode] = useState<"manual" | "auto">("manual");

  // ---- 自分のペースモード ----
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"question" | "speaking-q" | "ready" | "speaking-a" | "answered">(
    "question"
  );

  // ---- 自動再生モード ----
  const [autoIndex, setAutoIndex] = useState(0);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [autoPaused, setAutoPaused] = useState(false);
  const [autoSegment, setAutoSegment] = useState<0 | 1>(0); // 0=問題 1=正解
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("all");
  const repeatModeRef = useRef<RepeatMode>(repeatMode);
  const autoPlayingRef = useRef(false);

  const handleRef = useRef<SpeechQueueHandle | null>(null);

  useEffect(() => {
    setSupported(isSpeechSupported());
    return () => handleRef.current?.stop();
  }, []);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  useEffect(() => {
    // カードの集合が変わったら（マスター済みが抜けた等）先頭からやり直す
    handleRef.current?.stop();
    setIndex(0);
    setPhase("question");
    setAutoIndex(0);
    setAutoPlaying(false);
    autoPlayingRef.current = false;
  }, [pairs.length]);

  if (!supported) {
    return (
      <section className="rounded-xl2 border border-cream-200 bg-white p-4 dark:border-cocoa-800 dark:bg-cocoa-900">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-cocoa-800 dark:text-cream-50">
          <Volume2 size={18} />
          音声で聞く
        </h2>
        <p className="text-sm text-cocoa-500 dark:text-sand-200">
          このブラウザは読み上げ機能に対応していません。
        </p>
      </section>
    );
  }

  if (pairs.length === 0) return null;

  // ---------------- 自分のペースモード ----------------
  const current = pairs[index];

  const playQuestion = () => {
    setPhase("speaking-q");
    handleRef.current = speakQueue([current.question], {
      onEnd: () => setPhase("ready"),
    });
  };

  const playAnswer = () => {
    setPhase("speaking-a");
    handleRef.current = speakQueue([current.answer], {
      onEnd: () => setPhase("answered"),
    });
  };

  const stopManual = () => {
    handleRef.current?.stop();
  };

  const goTo = (i: number) => {
    stopManual();
    setIndex(i);
    setPhase("question");
  };

  // ---------------- 自動再生モード ----------------
  const playAutoFrom = (i: number) => {
    if (i < 0 || i >= pairs.length) return;
    setAutoIndex(i);
    setAutoPlaying(true);
    autoPlayingRef.current = true;
    setAutoPaused(false);
    handleRef.current = speakQueue([pairs[i].question, pairs[i].answer], {
      onIndexChange: (segIdx) => setAutoSegment(segIdx === 0 ? 0 : 1),
      onEnd: () => {
        if (!autoPlayingRef.current) return; // 停止済み
        const mode = repeatModeRef.current;
        if (mode === "one") {
          playAutoFrom(i);
          return;
        }
        if (i + 1 < pairs.length) {
          playAutoFrom(i + 1);
          return;
        }
        if (mode === "all") {
          playAutoFrom(0);
          return;
        }
        // 最後まで再生して終了
        autoPlayingRef.current = false;
        setAutoPlaying(false);
      },
    });
  };

  const startAuto = () => playAutoFrom(autoIndex);

  const pauseAuto = () => {
    handleRef.current?.pause();
    setAutoPaused(true);
  };

  const resumeAuto = () => {
    handleRef.current?.resume();
    setAutoPaused(false);
  };

  const stopAuto = () => {
    autoPlayingRef.current = false;
    handleRef.current?.stop();
    setAutoPlaying(false);
    setAutoPaused(false);
  };

  const goToAuto = (i: number) => {
    const wasPlaying = autoPlaying;
    stopAuto();
    setAutoIndex(i);
    if (wasPlaying) playAutoFrom(i);
  };

  return (
    <section className="rounded-xl2 border border-cream-200 bg-white p-4 dark:border-cocoa-800 dark:bg-cocoa-900">
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-cocoa-800 dark:text-cream-50">
        <Volume2 size={18} />
        音声で聞く
      </h2>

      <div className="my-3 grid grid-cols-2 gap-2 rounded-full bg-cream-100 p-1 dark:bg-cocoa-800">
        <button
          onClick={() => {
            stopAuto();
            setMode("manual");
          }}
          className={`min-h-[40px] rounded-full text-sm font-semibold transition-colors ${
            mode === "manual" ? "bg-cocoa-600 text-white" : "text-cocoa-600 dark:text-sand-200"
          }`}
        >
          自分のペース
        </button>
        <button
          onClick={() => {
            stopManual();
            setMode("auto");
          }}
          className={`min-h-[40px] rounded-full text-sm font-semibold transition-colors ${
            mode === "auto" ? "bg-cocoa-600 text-white" : "text-cocoa-600 dark:text-sand-200"
          }`}
        >
          自動再生（聞き流し）
        </button>
      </div>

      {mode === "manual" ? (
        <>
          <p className="mb-3 text-xs text-cocoa-400 dark:text-sand-200">
            「問題を再生」で問題文だけを読み上げます。自分で考えてから「正解を聞く」をタップしてください。
          </p>

          <p className="mb-2 text-sm text-cocoa-500 dark:text-sand-200">
            {index + 1} / {pairs.length}：{current.label}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {phase === "question" && (
              <button
                onClick={playQuestion}
                className="flex min-h-[44px] items-center gap-2 rounded-full bg-cocoa-600 px-5 text-sm font-semibold text-white"
              >
                <Play size={16} />
                問題を再生
              </button>
            )}
            {phase === "speaking-q" && (
              <button
                onClick={stopManual}
                className="flex min-h-[44px] items-center gap-2 rounded-full border-2 border-cocoa-600 px-5 text-sm font-semibold text-cocoa-600 dark:text-cream-50"
              >
                <Square size={14} />
                問題を再生中…停止
              </button>
            )}
            {(phase === "ready" || phase === "speaking-a" || phase === "answered") && (
              <>
                {phase !== "speaking-a" && (
                  <button
                    onClick={playQuestion}
                    className="flex min-h-[44px] items-center gap-2 rounded-full border-2 border-cocoa-600 px-4 text-sm font-semibold text-cocoa-600 dark:text-cream-50"
                  >
                    <Play size={14} />
                    問題をもう一度
                  </button>
                )}
                {phase === "ready" && (
                  <button
                    onClick={playAnswer}
                    className="flex min-h-[44px] items-center gap-2 rounded-full bg-green-600 px-5 text-sm font-semibold text-white"
                  >
                    <Ear size={16} />
                    正解を聞く
                  </button>
                )}
                {phase === "speaking-a" && (
                  <button
                    onClick={stopManual}
                    className="flex min-h-[44px] items-center gap-2 rounded-full border-2 border-green-600 px-5 text-sm font-semibold text-green-700 dark:text-green-300"
                  >
                    <Square size={14} />
                    正解を再生中…停止
                  </button>
                )}
              </>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-cream-100 pt-3 dark:border-cocoa-800">
            <button
              onClick={() => goTo((index - 1 + pairs.length) % pairs.length)}
              className="flex min-h-[44px] items-center gap-1 rounded-full px-3 text-sm font-semibold text-cocoa-500 dark:text-sand-200"
            >
              <ChevronLeft size={18} />
              前へ
            </button>
            <button
              onClick={() => goTo((index + 1) % pairs.length)}
              className="flex min-h-[44px] items-center gap-1 rounded-full px-3 text-sm font-semibold text-cocoa-500 dark:text-sand-200"
            >
              次へ
              <ChevronRight size={18} />
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-xs text-cocoa-400 dark:text-sand-200">
            問題→正解→次の問題…と自動で流れ続けます。聞き流し学習向けです。
          </p>

          <p className="mb-2 text-sm text-cocoa-500 dark:text-sand-200">
            {autoIndex + 1} / {pairs.length}：{pairs[autoIndex].label}
            {autoPlaying && (
              <span className="ml-2 font-semibold text-cocoa-700 dark:text-cream-100">
                {autoSegment === 0 ? "（問題を再生中）" : "（正解を再生中）"}
              </span>
            )}
          </p>

          {/* リピート設定 */}
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              onClick={() => setRepeatMode(repeatMode === "one" ? "none" : "one")}
              aria-pressed={repeatMode === "one"}
              className={`flex min-h-[36px] items-center gap-1.5 rounded-full border-2 px-3 text-xs font-semibold ${
                repeatMode === "one"
                  ? "border-cocoa-600 bg-cocoa-600 text-white"
                  : "border-cream-300 text-cocoa-500 dark:border-cocoa-700 dark:text-sand-200"
              }`}
            >
              <Repeat1 size={14} />
              1問リピート
            </button>
            <button
              onClick={() => setRepeatMode(repeatMode === "all" ? "none" : "all")}
              aria-pressed={repeatMode === "all"}
              className={`flex min-h-[36px] items-center gap-1.5 rounded-full border-2 px-3 text-xs font-semibold ${
                repeatMode === "all"
                  ? "border-cocoa-600 bg-cocoa-600 text-white"
                  : "border-cream-300 text-cocoa-500 dark:border-cocoa-700 dark:text-sand-200"
              }`}
            >
              <Repeat size={14} />
              1周リピート
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!autoPlaying ? (
              <button
                onClick={startAuto}
                className="flex min-h-[44px] items-center gap-2 rounded-full bg-cocoa-600 px-5 text-sm font-semibold text-white"
              >
                <Play size={16} />
                再生
              </button>
            ) : (
              <>
                <button
                  onClick={autoPaused ? resumeAuto : pauseAuto}
                  className="flex min-h-[44px] items-center gap-2 rounded-full bg-cocoa-600 px-5 text-sm font-semibold text-white"
                >
                  {autoPaused ? <Play size={16} /> : <Pause size={16} />}
                  {autoPaused ? "再開" : "一時停止"}
                </button>
                <button
                  onClick={stopAuto}
                  className="flex min-h-[44px] items-center gap-2 rounded-full border-2 border-cocoa-600 px-5 text-sm font-semibold text-cocoa-600 dark:text-cream-50"
                >
                  <Square size={14} />
                  停止
                </button>
              </>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-cream-100 pt-3 dark:border-cocoa-800">
            <button
              onClick={() => goToAuto((autoIndex - 1 + pairs.length) % pairs.length)}
              className="flex min-h-[44px] items-center gap-1 rounded-full px-3 text-sm font-semibold text-cocoa-500 dark:text-sand-200"
            >
              <ChevronLeft size={18} />
              前へ
            </button>
            <button
              onClick={() => goToAuto((autoIndex + 1) % pairs.length)}
              className="flex min-h-[44px] items-center gap-1 rounded-full px-3 text-sm font-semibold text-cocoa-500 dark:text-sand-200"
            >
              次へ
              <ChevronRight size={18} />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
