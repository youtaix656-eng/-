"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, Play, Square, ChevronLeft, ChevronRight, Ear } from "lucide-react";
import { isSpeechSupported, speakQueue, type SpeechQueueHandle } from "@/lib/tts";
import { buildReviewQuizAudioPairs } from "@/lib/audioSegments";
import type { ReviewCard } from "@/lib/reviewPool";

// ============================================================
// 音声で問題を解くプレーヤー
// 「問題を再生」→（自分で考える）→「正解を聞く」の順に進む。
// 問題と答えを続けて自動再生しない（先に答えを言ってしまわないため）。
// ============================================================
export function QuizAudioPlayer({ cards }: { cards: ReviewCard[] }) {
  const pairs = useMemo(() => buildReviewQuizAudioPairs(cards), [cards]);
  const [supported, setSupported] = useState(true);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"question" | "speaking-q" | "ready" | "speaking-a" | "answered">(
    "question"
  );
  const handleRef = useRef<SpeechQueueHandle | null>(null);

  useEffect(() => {
    setSupported(isSpeechSupported());
    return () => handleRef.current?.stop();
  }, []);

  useEffect(() => {
    // カードの集合が変わったら（マスター済みが抜けた等）先頭からやり直す
    setIndex(0);
    setPhase("question");
    handleRef.current?.stop();
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

  const stop = () => {
    handleRef.current?.stop();
  };

  const goTo = (i: number) => {
    stop();
    setIndex(i);
    setPhase("question");
  };

  return (
    <section className="rounded-xl2 border border-cream-200 bg-white p-4 dark:border-cocoa-800 dark:bg-cocoa-900">
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-cocoa-800 dark:text-cream-50">
        <Volume2 size={18} />
        音声で聞く
      </h2>
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
            onClick={stop}
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
                onClick={stop}
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
    </section>
  );
}
