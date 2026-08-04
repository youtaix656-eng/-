// ============================================================
// 復習プール：一問一答・○×問題・自主基準テストの全問題を
// 共通のカード形式（表=問題／裏=答え）にまとめる。
// /review（間隔反復の復習）と 一問一答の暗記カードモードで使う。
// ============================================================
import { qaList, oxList } from "@/data/quiz";
import { standardsTest } from "@/data/standardsTest";
import { serviceSeminarTest } from "@/data/serviceSeminarTest";

export type ReviewCard = {
  id: string;
  source: "qa" | "ox" | "test";
  /** カード表面（問題） */
  front: string;
  /** 表面に添える選択肢（あれば） */
  choices?: string[];
  /** カード裏面（答え） */
  back: string;
  /** 解説（あれば） */
  explanation?: string;
  /** 出典（あれば） */
  ref?: string;
};

function buildPool(): ReviewCard[] {
  const fromQa: ReviewCard[] = qaList.map((q) => ({
    id: q.id,
    source: "qa",
    front: q.q,
    back: q.a,
    ref: q.ref,
  }));

  const fromOx: ReviewCard[] = oxList.map((o) => ({
    id: o.id,
    source: "ox",
    front: `${o.statement}（○か×か？）`,
    back: o.answer ? "○（正しい）" : "×（誤り）",
    explanation: o.explanation,
    ref: o.ref,
  }));

  const fromTest: ReviewCard[] = standardsTest.map((t) => ({
    id: t.id,
    source: "test",
    front: t.question,
    choices: t.options,
    back: t.correct.map((c) => t.options[c]).join("・"),
    explanation: t.explanation,
  }));

  const fromServiceTest: ReviewCard[] = serviceSeminarTest.map((t) => ({
    id: t.id,
    source: "test",
    front: t.question,
    choices: t.options,
    back: t.correct.map((c) => t.options[c]).join("・"),
    explanation: t.explanation,
  }));

  return [...fromQa, ...fromOx, ...fromTest, ...fromServiceTest];
}

export const reviewPool: ReviewCard[] = buildPool();

export function findCard(id: string): ReviewCard | undefined {
  return reviewPool.find((c) => c.id === id);
}
