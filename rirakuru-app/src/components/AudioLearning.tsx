"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, Play, Pause, Square } from "lucide-react";
import { isSpeechSupported, speakQueue, type SpeechQueueHandle } from "@/lib/tts";

export type AudioSegment = {
  /** 一覧に出す短い見出し（今どこを読んでいるか分かるように） */
  label: string;
  /** 実際に読み上げる文章 */
  text: string;
};

// ============================================================
// 音声学習パネル
// 端末の音声合成でこの目次の内容を順番に読み上げる。
// 「聞き取りやすく」：やや遅めの速度・日本語音声を優先選択。
// ============================================================
export function AudioLearning({ segments }: { segments: AudioSegment[] }) {
  const [supported, setSupported] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(0);
  const handleRef = useRef<SpeechQueueHandle | null>(null);

  useEffect(() => {
    setSupported(isSpeechSupported());
    return () => {
      handleRef.current?.stop();
    };
  }, []);

  const start = () => {
    if (!supported || segments.length === 0) return;
    setPlaying(true);
    setPaused(false);
    handleRef.current = speakQueue(
      segments.map((s) => s.text),
      {
        onIndexChange: (i) => setIndex(i),
        onEnd: () => {
          setPlaying(false);
          setIndex(0);
        },
      }
    );
  };

  const stop = () => {
    handleRef.current?.stop();
    setPlaying(false);
    setPaused(false);
    setIndex(0);
  };

  const togglePause = () => {
    if (!handleRef.current) return;
    if (paused) {
      handleRef.current.resume();
      setPaused(false);
    } else {
      handleRef.current.pause();
      setPaused(true);
    }
  };

  if (!supported) {
    return (
      <section className="rounded-xl2 border border-cream-200 bg-white p-4 dark:border-cocoa-800 dark:bg-cocoa-900">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-cocoa-800 dark:text-cream-50">
          <Volume2 size={18} />
          音声学習
        </h2>
        <p className="text-sm text-cocoa-500 dark:text-sand-200">
          このブラウザは読み上げ機能に対応していません。
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl2 border border-cream-200 bg-white p-4 dark:border-cocoa-800 dark:bg-cocoa-900">
      <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-cocoa-800 dark:text-cream-50">
        <Volume2 size={18} />
        音声学習
      </h2>
      <p className="mb-3 text-xs text-cocoa-400 dark:text-sand-200">
        端末の読み上げ機能で、この目次の内容を聞き取りやすい速度で再生します。
      </p>

      <div className="flex items-center gap-2">
        {!playing ? (
          <button
            onClick={start}
            disabled={segments.length === 0}
            className="flex min-h-[44px] items-center gap-2 rounded-full bg-cocoa-600 px-5 text-sm font-semibold text-white disabled:opacity-40"
          >
            <Play size={16} />
            再生
          </button>
        ) : (
          <>
            <button
              onClick={togglePause}
              className="flex min-h-[44px] items-center gap-2 rounded-full bg-cocoa-600 px-5 text-sm font-semibold text-white"
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
              {paused ? "再開" : "一時停止"}
            </button>
            <button
              onClick={stop}
              className="flex min-h-[44px] items-center gap-2 rounded-full border-2 border-cocoa-600 px-5 text-sm font-semibold text-cocoa-600 dark:text-cream-50"
            >
              <Square size={14} />
              停止
            </button>
          </>
        )}
      </div>

      {playing && segments[index] && (
        <p className="mt-3 rounded-lg bg-sand-100 px-3 py-2 text-sm text-cocoa-700 dark:bg-cocoa-800 dark:text-sand-200">
          再生中：{segments[index].label}
        </p>
      )}
    </section>
  );
}
