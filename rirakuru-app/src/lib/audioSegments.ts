// ============================================================
// 音声学習用の読み上げ文章を、既存のデータから組み立てる。
// 新しい事実は作らず、既にアプリ内にある文章を読み上げ用に整形するだけ。
// ============================================================
import type { Item } from "@/data/types";
import type { AudioSegment } from "@/components/AudioLearning";
import type { HandStep } from "@/data/handReflex";
import type { FootStep } from "@/data/footReflex";
import type { ReviewCard } from "@/lib/reviewPool";

/** カテゴリの項目一覧から、読み上げ用セグメントを組み立てる */
export function buildItemAudioSegments(items: Item[]): AudioSegment[] {
  return items.map((item) => {
    const parts: string[] = [item.title + "。"];
    if (item.summary) parts.push(item.summary);
    if (item.body) parts.push(item.body);
    if (item.steps && item.steps.length > 0) {
      parts.push("手順は次のとおりです。");
      item.steps.forEach((s, i) => {
        parts.push(`${i + 1}、${s.text}${s.note ? "。" + s.note : ""}。`);
      });
    }
    if (item.warnings && item.warnings.length > 0) {
      parts.push("注意点です。");
      item.warnings.forEach((w) => {
        parts.push((w.level === "danger" ? "禁忌。" : "注意。") + w.text);
      });
    }
    return { label: item.title, text: parts.join(" ") };
  });
}

/** ハンドリフレの手順から読み上げ用セグメントを組み立てる */
export function buildHandAudioSegments(steps: HandStep[]): AudioSegment[] {
  return steps.map((s) => ({
    label: `手順${s.no}：${s.name}`,
    text: `手順${s.no}、${s.section}、${s.name}。${s.detail}`,
  }));
}

/** 足つぼの手順から読み上げ用セグメントを組み立てる */
export function buildFootAudioSegments(steps: FootStep[]): AudioSegment[] {
  return steps.map((s) => ({
    label: `手順${s.no}：${s.name}`,
    text: `手順${s.no}、${s.section}、${s.name}。${s.detail}`,
  }));
}

/** 復習カード（間違えた・自信がない問題）から読み上げ用セグメントを組み立てる */
export function buildReviewAudioSegments(cards: ReviewCard[]): AudioSegment[] {
  return cards.map((c) => {
    const parts: string[] = [c.front];
    if (c.choices && c.choices.length > 0) {
      parts.push("選択肢は、" + c.choices.join("、") + "です。");
    }
    parts.push("答えは、" + c.back + "です。");
    if (c.explanation) parts.push(c.explanation);
    const label = c.front.length > 24 ? c.front.slice(0, 24) + "…" : c.front;
    return { label, text: parts.join(" ") };
  });
}

export type QuizAudioPair = {
  label: string;
  /** 問題文＋選択肢（正答を含まない） */
  question: string;
  /** 答え＋解説 */
  answer: string;
};

/**
 * 復習カードを「問題」と「答え」を別々に読み上げられる形に分ける。
 * 問題を聞いてから、自分でタップして初めて答えが再生されるようにするため
 * （一文にまとめて自動で答えまで読み上げない）。
 */
export function buildReviewQuizAudioPairs(cards: ReviewCard[]): QuizAudioPair[] {
  return cards.map((c) => {
    const qParts: string[] = [c.front];
    if (c.choices && c.choices.length > 0) {
      qParts.push("選択肢は、" + c.choices.join("、") + "です。");
    }
    const aParts: string[] = ["答えは、" + c.back + "です。"];
    if (c.explanation) aParts.push(c.explanation);
    const label = c.front.length > 24 ? c.front.slice(0, 24) + "…" : c.front;
    return { label, question: qParts.join(" "), answer: aParts.join(" ") };
  });
}
