// 学習進捗サマリーレポート（②）— 通算問題数・正答率推移・攻略率・バッジなどを
//   1枚にまとめて振り返り・記念用に書き出す。既存の間違いノート(MistakeNote.jsx)と
//   同じ「印刷ウィンドウを開いてwindow.print()」方式でPDF化する（外部ライブラリ不要）。

import { overallStats, studyStreak, masteryStats, formatPercent } from './stats.js';
import { isInReview, MATURE_INTERVAL } from './srs.js';
import { computeBadges } from './gamify.js';
import { scopeCoverage } from '../data/examScope.js';

// store（history/questions/srs/examResults/links）から、レポートに載せる数値をまとめる
export function buildProgressSummary({ history = [], questions = [], srs = {}, examResults = [] } = {}) {
  const overall = overallStats(history);
  const { streak, longestStreak, activeDays } = studyStreak(history);
  const scope = scopeCoverage(questions, history);
  const mastery = masteryStats(questions, srs, isInReview, MATURE_INTERVAL, scope);
  const badges = computeBadges(history, srs, questions, examResults, isInReview, MATURE_INTERVAL);
  const earnedBadges = badges.filter((b) => b.earned).length;
  const bestExam = (examResults || [])
    .filter((r) => !r.mode || r.mode === 'am' || r.mode === 'pm')
    .reduce((best, r) => (best == null || r.scorePct > best.scorePct ? r : best), null);

  return {
    total: overall.total,
    accuracy: overall.accuracy,
    activeDays,
    longestStreak,
    streak,
    coverage: mastery.overall.coverage,
    masteryRate: mastery.overall.mastery,
    mastered: mastery.overall.mastered,
    earnedBadges,
    totalBadges: badges.length,
    bestExam,
    generatedAt: Date.now(),
  };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// レポート用HTML（印刷/PDF保存用の1ページ）を組み立てる
export function buildProgressReportHtml(summary) {
  const s = summary;
  const dateStr = new Date(s.generatedAt).toLocaleDateString('ja-JP');
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>学習進捗サマリー</title>
    <style>
      body{font-family:-apple-system,'Hiragino Kaku Gothic ProN',sans-serif;color:#111;margin:24px;line-height:1.7;}
      h1{font-size:20px;border-bottom:2px solid #333;padding-bottom:8px;}
      .meta{color:#666;font-size:12px;margin-bottom:20px;}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;}
      .tile{border:1px solid #ccc;border-radius:8px;padding:12px;text-align:center;}
      .tile .num{font-size:24px;font-weight:800;}
      .tile .lbl{font-size:12px;color:#555;margin-top:2px;}
      .note{font-size:12px;color:#666;margin-top:24px;}
      @media print{ .tile{border-color:#999;} }
    </style></head><body>
    <h1>🏆 学習進捗サマリー</h1>
    <div class="meta">作成日：${escapeHtml(dateStr)}</div>
    <div class="grid">
      <div class="tile"><div class="num">${s.total}</div><div class="lbl">通算解答数</div></div>
      <div class="tile"><div class="num">${s.accuracy != null ? formatPercent(s.accuracy) : '—'}</div><div class="lbl">通算正答率</div></div>
      <div class="tile"><div class="num">${s.activeDays}</div><div class="lbl">学習した日数</div></div>
      <div class="tile"><div class="num">${s.longestStreak}</div><div class="lbl">最長連続学習日数</div></div>
      <div class="tile"><div class="num">${formatPercent(s.coverage)}</div><div class="lbl">出題範囲カバー率</div></div>
      <div class="tile"><div class="num">${formatPercent(s.masteryRate)}</div><div class="lbl">攻略率（定着${s.mastered}問）</div></div>
      <div class="tile"><div class="num">${s.earnedBadges}/${s.totalBadges}</div><div class="lbl">達成バッジ</div></div>
      <div class="tile"><div class="num">${s.bestExam ? s.bestExam.scorePct + '%' : '—'}</div><div class="lbl">模試ベストスコア</div></div>
    </div>
    <div class="note">※このアプリでの学習記録から自動作成したサマリーです。振り返り・記念にご活用ください。</div>
    <script>window.onload=function(){setTimeout(function(){window.print();},300);}</script>
    </body></html>`;
}
