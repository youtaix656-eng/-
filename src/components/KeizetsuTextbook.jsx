import { useMemo, useState } from 'react';
import { KEIZETSU_TEXTBOOK_SECTIONS } from '../data/keizetsuTextbookMap.js';
import { computeSectionFrequency } from '../lib/keizetsuTextbookFreq.js';
import { meridianNameById } from '../data/knowledgeBase.js';

const LEVEL_LABEL = { hot: '頻出', warm: 'よく出る', cool: 'たまに出る', none: '過去問での出題なし' };
const LEVEL_ICON = { hot: '🔴', warm: '🟠', cool: '🟡', none: '⚪' };

// 経絡経穴概論の教科書を「ページ範囲＝章立て」で辿れる目次画面。
// 各章の内容は自分の言葉での要約（教科書原文はコピーしない）。過去問（keizetsuQuestions.js、
// 第25〜34回）の genre タグから出題頻度を集計し、色つきで「よく出るところ」を示す。
export default function KeizetsuTextbook({ store, onNavigate }) {
  const questions = store?.questions || [];
  const [openId, setOpenId] = useState(null);

  const sections = useMemo(
    () => computeSectionFrequency(KEIZETSU_TEXTBOOK_SECTIONS, questions),
    [questions]
  );

  const totalMatched = sections.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="view">
      <h2 className="view-title">経絡経穴概論 教科書目次（ページ順）</h2>
      <p className="view-desc">
        『新版 経絡経穴概論（第2版）』の章立てをページ順に要約しています（原文はコピーせず、
        自分の言葉でまとめた内容＋事実データです）。色は、収録済みの過去問（第25〜34回）から
        実際に集計した出題頻度です——
        {Object.entries(LEVEL_LABEL).map(([lv, label]) => (
          <span key={lv} style={{ marginLeft: 6 }}>{LEVEL_ICON[lv]}{label}</span>
        ))}
        。
      </p>

      <p className="inline-note">
        収録済み過去問（経絡経穴概論・genreタグつき）{totalMatched}問をもとに集計しています。
        教科書の原文をそのまま読みたい場合は、端末内保存の「教科書ライブラリ」に自分で貼り付けて
        保存してください。
      </p>
      <button
        type="button"
        className="btn ghost block"
        style={{ marginBottom: 12 }}
        onClick={() => onNavigate && onNavigate('keiketsulibrary')}
      >
        📚 教科書ライブラリへ（原文を自分で貼り付けて保存）
      </button>

      {sections.map((s) => (
        <div key={s.id} className="kz-page kz-tb-section">
          <button
            type="button"
            className="kz-tb-head"
            onClick={() => setOpenId(openId === s.id ? null : s.id)}
          >
            <span className="kz-tb-pages">p.{s.pageStart}{s.pageEnd !== s.pageStart ? `–${s.pageEnd}` : ''}</span>
            <span className="kz-tb-title">{s.title}</span>
            <span className={`kz-freq kz-freq-${s.level}`} title={LEVEL_LABEL[s.level]}>
              {LEVEL_ICON[s.level]} {s.count > 0 ? `${s.count}問` : LEVEL_LABEL[s.level]}
            </span>
          </button>

          {openId === s.id && (
            <div className="kz-page-body">
              <p className="kz-page-lead">{s.summary}</p>
              {s.meridianId && (
                <p className="inline-note-dark">経絡：{meridianNameById(s.meridianId)}（{s.meridianId}）</p>
              )}
              {s.roundsLabel && (
                <p className="inline-note-dark">出題実績：{s.roundsLabel}</p>
              )}
            </div>
          )}
        </div>
      ))}

      <p className="inline-note" style={{ marginTop: 14 }}>
        ※ ページ範囲は教科書を読み直して確認した章立て・各経脈の開始ページに基づきます。
        用語だけを引きたい場合は「索引・目次」画面（あ〜ん順）も使えます。
      </p>
      <button className="btn ghost block" style={{ marginTop: 8 }} onClick={() => onNavigate && onNavigate('keizetsuindex')}>
        🔖 索引・目次（あ〜ん順）へ
      </button>
    </div>
  );
}
