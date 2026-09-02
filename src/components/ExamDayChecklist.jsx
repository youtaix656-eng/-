import { useEffect, useMemo, useState } from 'react';
import { daysUntil, formatExamDate } from '../lib/gamify.js';
import {
  STAGES,
  loadChecked,
  setChecked as saveChecked,
  loadCustomItems,
  addCustomItem,
  removeCustomItem,
  buildChecklist,
} from '../lib/examDayChecklist.js';
import { phaseChecks } from '../lib/g100Progress.js';
import { loadSelfKindCounts } from '../lib/starWeak.js';
import { loadRoundLog } from '../lib/roundLog.js';
import { loadTimeAttackLog } from '../lib/timeAttackLog.js';
import { maruStatusList, excludeMastered, maruSubjectBreakdown } from '../lib/maruPool.js';

const PHASE_LABELS = { phase1: 'Phase1（全問精読）', phase2: 'Phase2（即答化）', phase3: 'Phase3（反射化）', complete: '卒業相当' };

// 試験当日チェックリスト・タイムライン（⑧）。
// 持ち物・当日の流れを「前日までに／当日の朝／会場に着いたら」の時系列でまとめて確認できる。
export default function ExamDayChecklist({ store, onNavigate }) {
  const { settings, questions, history, srs, examResults } = store;
  const examLeft = daysUntil(settings.examDate);

  const [checked, setCheckedState] = useState({});
  const [customItems, setCustomItems] = useState([]);
  const [draftStage, setDraftStage] = useState('before');
  const [draftText, setDraftText] = useState('');

  useEffect(() => {
    loadChecked().then(setCheckedState);
    loadCustomItems().then(setCustomItems);
  }, []);

  const checklist = useMemo(() => buildChecklist(customItems, checked), [customItems, checked]);

  // 「実際に準備できているか」の目安（G-100の推定フェーズ・網羅率・★3件数はすでに他画面で
  // 計算済みだったのに、当日チェックリストは持ち物チェックだけの静的な画面だった）。
  const [selfKindCounts, setSelfKindCounts] = useState(null);
  const [roundLog, setRoundLog] = useState(null);
  const [timeAttackLog, setTimeAttackLog] = useState(null);
  useEffect(() => { loadSelfKindCounts().then(setSelfKindCounts); }, []);
  useEffect(() => { loadRoundLog().then(setRoundLog); }, []);
  useEffect(() => { loadTimeAttackLog().then(setTimeAttackLog); }, []);
  const readiness = useMemo(() => {
    if (selfKindCounts == null || roundLog == null || timeAttackLog == null) return null;
    return phaseChecks({ questions, history, srs, selfKindCounts, examResults, roundLog, timeAttackLog });
  }, [questions, history, srs, examResults, selfKindCounts, roundLog, timeAttackLog]);

  // #9：直前期の「○総ざらい」導線。○にした問題（学習画面「○にした問題をふりかえる」と同じデータ）を
  //   本番前にもう一度確認できるよう、ここからも件数・弱い科目の目安と導線を出す。
  //   #5：マスター済み（5連続○）を除いた件数を主に見せる。#6：得意科目分析と同じ内訳データを使う。
  const maruAll = useMemo(() => maruStatusList(questions, history, srs), [questions, history, srs]);
  const maruUnmastered = useMemo(() => excludeMastered(maruAll), [maruAll]);
  const maruWeakestSubject = useMemo(() => {
    const rows = maruSubjectBreakdown(maruAll).filter((s) => s.total >= 3);
    return rows.length > 0 ? [...rows].sort((a, b) => a.masteredPct - b.masteredPct)[0] : null;
  }, [maruAll]);

  const toggle = async (itemId, done) => {
    const next = await saveChecked(itemId, done);
    setCheckedState(next);
  };
  const addItem = async () => {
    if (!draftText.trim()) return;
    const next = await addCustomItem(draftStage, draftText);
    setCustomItems(next);
    setDraftText('');
  };
  const removeItem = async (itemId) => {
    const next = await removeCustomItem(itemId);
    setCustomItems(next);
  };

  return (
    <div className="view">
      <h2 className="view-title">試験当日チェックリスト</h2>
      <p className="view-desc">
        持ち物・当日の流れを時系列でまとめました。ここに挙げた項目は一般的な例です。正式な持ち物・
        注意事項は必ず<strong>受験票・公式の受験案内</strong>で最終確認してください。
      </p>

      {settings.examDate && (
        <div className="tiles">
          <div className="tile">
            <div className="num">{examLeft != null ? examLeft : '—'}</div>
            <div className="lbl">試験まであと（日）</div>
          </div>
          <div className="tile">
            <div className="num" style={{ fontSize: 15 }}>{formatExamDate(settings.examDate)}</div>
            <div className="lbl">試験日</div>
          </div>
          <div className="tile">
            <div className="num">{checklist.done}/{checklist.total}</div>
            <div className="lbl">チェック済み</div>
          </div>
        </div>
      )}

      {readiness && (
        <div className="card">
          <div className="section-label" style={{ marginTop: 0 }}>📍 実際の準備状況（実データから）</div>
          <p className="inline-note" style={{ marginTop: 0 }}>
            推定フェーズ：<strong>{PHASE_LABELS[readiness.currentPhaseId]}</strong>
            {readiness.phase3.checks.find((c) => c.label.includes('★3'))?.value > 0 && (
              <> ・ ★3（要注意）が<strong>{readiness.phase3.checks.find((c) => c.label.includes('★3')).value}件</strong>残っています</>
            )}
          </p>
          <button className="btn ghost sm" onClick={() => onNavigate?.('g100guide')}>G-100ガイドで詳しく見る</button>
        </div>
      )}

      {/* #9：○にした問題の総ざらい（直前期向け）。学習画面「○にした問題をふりかえる」と同じデータを共有する */}
      {maruAll.length > 0 && (
        <div className="card">
          <div className="section-label" style={{ marginTop: 0 }}>✅ ○にした問題の総ざらい</div>
          <p className="inline-note" style={{ marginTop: 0 }}>
            自己採点で○にした問題は全部で{maruAll.length}問。うちマスター（5連続○）に至っていないのは
            <strong>{maruUnmastered.length}問</strong>です。
            {maruWeakestSubject && (
              <> 特に「{maruWeakestSubject.subject}」は定着率{Math.round(maruWeakestSubject.masteredPct * 100)}%とやや低めなので優先してください。</>
            )}
          </p>
          <p className="inline-note" style={{ marginTop: 0 }}>
            本番前は時間が限られるので、学習画面で「マスター済みは除く」にチェックを入れて絞り込み、
            ⚡高速回転で素早く総ざらいするのがおすすめです。
          </p>
          <button className="btn primary sm" onClick={() => onNavigate?.('session')}>学習画面の「○にした問題をふりかえる」へ</button>
        </div>
      )}

      {checklist.byStage.map((s) => (
        <div key={s.id}>
          <div className="section-label">{s.label}</div>
          <div className="card">
            {s.items.map((item) => (
              <label className="switch-row" key={item.id} style={{ alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(e) => toggle(item.id, e.target.checked)}
                />
                <span style={{ textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
                {customItems.some((c) => c.id === item.id) && (
                  <button className="btn ghost sm" onClick={() => removeItem(item.id)} style={{ marginLeft: 'auto' }}>
                    削除
                  </button>
                )}
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="section-label">＋ 自分の項目を追加</div>
      <div className="card">
        <div className="field">
          <label>タイミング</label>
          <select value={draftStage} onChange={(e) => setDraftStage(e.target.value)}>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="btn-row" style={{ marginTop: 8 }}>
          <input
            type="text"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="例：常備薬を持った"
            style={{ flex: 1 }}
          />
          <button className="btn primary sm" onClick={addItem}>追加</button>
        </div>
      </div>

      <div className="ana-jump">
        <button className="btn ghost sm" onClick={() => onNavigate && onNavigate('venues')}>🏛️ 試験会場・ホテルへ</button>
        <button className="btn ghost sm" onClick={() => onNavigate && onNavigate('examcontent')}>📋 試験の内容メモへ</button>
      </div>
    </div>
  );
}
