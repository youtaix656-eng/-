// 目次（あ〜ん / A〜Z 索引）— 用語集（glossaryTerms.js）から毎回導出する。
//
// **目次専用の手書きデータは作らない**（buildTocEntries()が元データから導出する）。
// 呼び出し側（Toc.jsx）はuseMemoでメモ化して使うこと。
//
// 別名（aliases）は、canonical項目とは別の1行として展開する（世に出回っている略称・
// 別の呼び名からも引けるようにするため）。別名の行をタップすると、type:'system'の
// destinationとしてcanonicalの項目IDへジャンプする（本体の説明はcanonical側にしか
// 持たせない＝二重管理にしない）。

import { GLOSSARY_TERMS } from './glossaryTerms.js';
import { buildKanaIndex } from '../lib/yomi.js';

// glossary: glossaryTerms.jsのeffectiveGlossary(extra, removedIds)の戻り値
//   （省略時は本体データ GLOSSARY_TERMS のみ）。
export function buildTocEntries(glossary = GLOSSARY_TERMS) {
  const entries = [];
  for (const term of glossary) {
    entries.push({
      id: `term-${term.id}`,
      title: term.title,
      reading: term.reading || '',
      category: term.category,
      sub: '',
      description: term.description || '',
      descriptionStatus: term.descriptionStatus || 'needs_review',
      destinations: term.destinations || [],
      targetId: term.id,
      isAlias: false,
    });
    for (const alias of term.aliases || []) {
      entries.push({
        id: `alias-${term.id}-${alias.title}`,
        title: alias.title,
        reading: alias.reading || '',
        category: term.category,
        sub: `→ ${term.title}`,
        description: term.description || '',
        descriptionStatus: term.descriptionStatus || 'needs_review',
        destinations: [{ type: 'system', target: term.id, label: `「${term.title}」を見る` }],
        targetId: term.id,
        isAlias: true,
      });
    }
  }
  return entries;
}

// あ〜ん → A〜Z → その他 の順のセクションに分ける。
//   readingが空の項目は必ず「その他」へ落とす（strict:true。目次・索引パターンの
//   共通ルール#3。既存の音声学習等のキーワード一覧が使う緩いbuildKanaIndexとは
//   ここだけ挙動を変える——用語集は必ずreadingを人が明示するデータのため）。
export function tocSections(entries, opts = {}) {
  const byTitle = new Map(entries.map((e) => [e.title, e]));
  const readings = Object.fromEntries(entries.map((e) => [e.title, e.reading || '']));
  const sections = buildKanaIndex(entries.map((e) => e.title), readings, {
    strict: true,
    warnOtherThreshold: opts.warnOtherThreshold,
  });
  return sections.map((sec) => ({ label: sec.label, items: sec.items.map((title) => byTitle.get(title)) }));
}

// 検索・分類の絞り込み。
export function filterToc(entries, { query = '', category = '' } = {}) {
  const q = String(query).trim().toLowerCase();
  return entries.filter((e) => {
    if (category && e.category !== category) return false;
    if (!q) return true;
    return e.title.toLowerCase().includes(q) || String(e.reading || '').includes(q);
  });
}

// 重複したタイトル（canonical・別名を合わせた統合後のtoc全体でチェックする）。
export function duplicateTitles(entries) {
  const seen = new Map();
  for (const e of entries) seen.set(e.title, (seen.get(e.title) || 0) + 1);
  return [...seen.entries()].filter(([, n]) => n > 1).map(([title]) => title);
}

// destination（{type, target, arg?}）を実行可能な「意図」に正規化する。
//   実際の副作用（画面遷移・クイズ開始・ジャンプ）はToc.jsx側が行う——ここでは
//   型ごとの分岐だけを切り出し、Reactに依存せずnode:testから検証できるようにする。
export function resolveDestination(dest) {
  if (!dest) return null;
  switch (dest.type) {
    case 'page':
      return { kind: 'navigate', view: dest.target };
    case 'function':
      return { kind: 'relay', relay: dest.target, arg: dest.arg };
    case 'question':
      return { kind: 'startQuestion', questionId: dest.target };
    case 'system':
      return { kind: 'jumpTerm', targetId: dest.target };
    default:
      return null;
  }
}

// 用語をタップして開く時の「意図」。タブは常に索引タブへ固定する
// （どのタブから開かれても、飛び先のパネルが見える状態にしてからハイライトするため。
//   Roadmap.jsx/ConnectedLearning.jsxのfocusLevel/focusKeywordと同じ「先に状態を
//   合わせてから飛ぶ」考え方——ただしこの画面は1つのイベントハンドラ内で全部の
//   stateを一緒に更新するため、useLayoutEffectのタイミング問題は起きない）。
export function openTermAction(targetId) {
  return { tab: 'index', openTermId: targetId, anchor: `toc-term-${targetId}` };
}

// 詳細パネルの表示用データ（#12〜#15）。説明・destinationsが空の場合の
// プレースホルダー文言もここに集約する（Toc.jsxとテストの両方から同じ文言を参照する）。
export const NO_DESCRIPTION_TEXT = '※説明未登録';
export const NO_DESTINATIONS_TEXT = '関連する飛び先はありません';
export function termPanelViewModel(entry) {
  return {
    title: entry.title,
    reading: entry.reading || '',
    showNeedsReview: entry.descriptionStatus === 'needs_review',
    descriptionText: entry.description && entry.description.trim() ? entry.description : NO_DESCRIPTION_TEXT,
    destinations: entry.destinations || [],
    hasDestinations: !!(entry.destinations && entry.destinations.length > 0),
    emptyDestinationsMessage: NO_DESTINATIONS_TEXT,
  };
}
