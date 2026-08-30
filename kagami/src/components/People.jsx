import React, { useEffect, useMemo, useState } from 'react';
import {
  PERSON_TYPES, PERSON_TYPE_MAP, CORES, CORE_MAP, SCENES, SCENE_MAP, allBehaviors,
  STAGES, CASE_STATUSES, SCENE_HELPLINES, NOTE_TEMPLATE, STALE_DAYS,
} from '../data/people.js';
import {
  timelineOf, compare, isStale, daysSince, undoAlive, seenAtOf, UNDO_MS, SNAPSHOT_MAX,
} from '../lib/caseTools.js';
import { toExport, parseImport, toConsultText } from '../lib/personIO.js';
import {
  terms, haystackOf, matchesAll, splitByHit, suggestTerms, pushHistory, QUICK_TERMS,
} from '../lib/personSearch.js';
import { firstMove, untried, summarize, RESULT_MAP, MIN_TRIES } from '../lib/tried.js';
import { flashTo } from '../lib/focus.js';
import { TACTIC_MAP, akaNameOf, tacticLabel } from '../data/tactics.js';
import { analyzePerson, coresOf, MIN_TOTAL } from '../lib/analysis.js';
import { displayName, LABEL_MAX, newCaseId } from '../lib/cases.js';
import { caseToText, copyText } from '../lib/personExport.js';
import { GLYPHS } from '../data/glyphs.js';
import { EyeSigil, Rule } from './Ornament.jsx';
import { useFocusJump } from './useFocusJump.js';
import PersonTypeCard from './PersonTypeCard.jsx';

function when(at) {
  const d = new Date(at);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const norm = (s) => String(s || '').toLowerCase();

/**
 * 枠は3つ（28）。**目次から飛ぶ時は、飛び先のある枠へ先に切り替える**
 * ——切り替えないと、飛び先が描かれていないので着かない。
 */
const TABS = [
  { id: 'pick', label: '調べる' },
  { id: 'browse', label: '型を読む' },
  { id: 'saved', label: '保存したもの' },
];

export default function People({
  focus, onFocusDone, onGoTactic, cases = [], onSaveCase, onRemoveCase,
  tries = [], onAddTry, personView = {}, onSetPersonView,
  myHabits = [], undoCase, onUndoRemove, onClearPeople, onImportPeople,
}) {
  const [checked, setChecked] = useState([]);
  const [open, setOpen] = useState('');
  const [catalogOpen, setCatalogOpen] = useState('');
  const [scene, setSceneState] = useState(() =>
    SCENES.some((sc) => sc.id === focus) ? focus : personView.scene || '',
  );
  const [core, setCoreState] = useState(personView.core || '');
  const [caseType, setCaseType] = useState('');
  // 目次から型・芯へ飛んできた時は、最初から「型を読む」を開いておく
  const [tab, setTab] = useState(() =>
    focus && !SCENES.some((sc) => sc.id === focus) ? 'browse' : 'pick',
  );
  const [compareWith, setCompareWith] = useState('');
  const [practice, setPractice] = useState(false);
  const [sortBy, setSortBy] = useState(personView.sort || 'catalog');
  const [filterName, setFilterName] = useState('');
  const [importText, setImportText] = useState('');
  const [importAsk, setImportAsk] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [stage, setStage] = useState(0);
  const [status, setStatus] = useState('open');
  const [nextAction, setNextAction] = useState('');
  const [nextMeetAt, setNextMeetAt] = useState('');
  const [query, setQuery] = useState('');
  const [onlyChecked, setOnlyChecked] = useState(false);
  const [openGroups, setOpenGroups] = useState([]);
  // 保存まわり
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [caseQuery, setCaseQuery] = useState('');
  const [caseSort, setCaseSort] = useState('updated');
  const [copied, setCopied] = useState(false);
  const [consultCopied, setConsultCopied] = useState(false);
  const [exported, setExported] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [focusSeen, setFocusSeen] = useState(focus);

  // 型と芯が同じ画面にあるので、どちらの飛び先かを id から決める
  const anchor = focus
    ? SCENES.some((sc) => sc.id === focus)
      ? 'toc-scenes'
      : CORES.some((c) => c.id === focus)
        ? `toc-core-${focus}`
        : `toc-person-${focus}`
    : '';
  /**
   * 飛び先のある枠へ、**描く前に**切り替える。
   * useEffect で切り替えると、飛ぶ時（rAF）にはまだ古い枠が描かれているので着かない
   * ——実際にそうなった。prop が変わった時の state の直し方（描いている途中で直す）に寄せる。
   */
  if (focus !== focusSeen) {
    setFocusSeen(focus);
    if (focus) setTab(SCENES.some((sc) => sc.id === focus) ? 'pick' : 'browse');
  }

  // 消した直後の「元に戻す」を、時間が過ぎたら画面から下ろす
  useEffect(() => {
    if (!undoCase) return undefined;
    setNow(Date.now());
    const t = setTimeout(() => setNow(Date.now()), UNDO_MS + 200);
    return () => clearTimeout(t);
  }, [undoCase]);

  useFocusJump(anchor, onFocusDone);

  const behaviors = useMemo(() => allBehaviors(), []);

  /** 場面・芯でしぼった型 */
  const shownTypes = useMemo(
    () =>
      PERSON_TYPES.filter((t) => {
        if (scene && !(t.scenes || []).includes(scene)) return false;
        if (core && !(t.cores || []).includes(core)) return false;
        return true;
      }),
    [scene, core],
  );

  const words = useMemo(() => terms(query), [query]);

  /** チェック欄に出すふるまい（しぼり込み＋検索＋選んだものだけ） */
  const shownBehaviors = useMemo(() => {
    const typeIds = new Set(shownTypes.map((t) => t.id));
    return behaviors.filter((b) => {
      if (!typeIds.has(b.typeId)) return false;
      if (onlyChecked && !checked.includes(b.id)) return false;
      if (words.length === 0) return true;
      const type = PERSON_TYPE_MAP[b.typeId];
      const hay = haystackOf(b, {
        type,
        coreLabels: (type?.cores || []).map((c) => CORE_MAP[c].label),
        sceneLabels: (type?.scenes || []).map((x) => SCENE_MAP[x].label),
      });
      return matchesAll(hay, words);
    });
  }, [behaviors, shownTypes, words, onlyChecked, checked]);

  /** 0件のときの近い候補（勝手に検索し直さず、出すだけ） */
  const corpus = useMemo(
    () => [
      ...PERSON_TYPES.map((t) => ({ label: t.name, hay: t.reading })),
      ...QUICK_TERMS.map((t) => ({ label: t, hay: t })),
    ],
    [],
  );
  const nearby = useMemo(
    () => (words.length && shownBehaviors.length === 0 ? suggestTerms(query, corpus) : []),
    [words, shownBehaviors, query, corpus],
  );

  /** 型ごとにまとめる（アコーディオンの中身） */
  const groups = useMemo(() => {
    const byType = new Map();
    for (const b of shownBehaviors) {
      const list = byType.get(b.typeId) || [];
      list.push(b);
      byType.set(b.typeId, list);
    }
    const picked = new Set(checked.map((id) => id.split(':')[0]));
    const count = new Map();
    for (const c of cases) for (const id of c.checkedIds) {
      const t = id.split(':')[0];
      count.set(t, (count.get(t) || 0) + 1);
    }
    const list = shownTypes
      .filter((t) => byType.has(t.id))
      .map((t) => ({ type: t, items: byType.get(t.id) }));
    if (sortBy === 'kana') list.sort((a, b) => a.type.reading.localeCompare(b.type.reading, 'ja'));
    else if (sortBy === 'mine') list.sort((a, b) => (count.get(b.type.id) || 0) - (count.get(a.type.id) || 0));
    return list.sort((a, b) => (picked.has(b.type.id) ? 1 : 0) - (picked.has(a.type.id) ? 1 : 0));
  }, [shownBehaviors, shownTypes, checked, sortBy, cases]);

  // 検索中・「選んだものだけ」の時は、たたまずに開いておく（探しに来ているので）
  const forceOpen = !!query.trim() || onlyChecked;

  const result = useMemo(() => analyzePerson(checked, PERSON_TYPES), [checked]);
  const cores = useMemo(() => coresOf(result.matches), [result]);
  const checkedTexts = useMemo(() => {
    const map = new Map(behaviors.map((b) => [b.id, b.text]));
    return checked.map((id) => map.get(id)).filter(Boolean);
  }, [checked, behaviors]);

  const shownCases = useMemo(() => {
    const q = norm(caseQuery).trim();
    const textOf = new Map(behaviors.map((b) => [b.id, b.text]));
    const list = cases.filter((c) => {
      if (caseType && !c.checkedIds.some((id) => id.startsWith(`${caseType}:`))) return false;
      if (!q) return true;
      const scLabel = c.sceneId && SCENE_MAP[c.sceneId] ? SCENE_MAP[c.sceneId].label : '';
      const body = c.checkedIds.map((id) => textOf.get(id) || '').join(' ');
      return (
        norm(displayName(c)).includes(q) ||
        norm(c.note).includes(q) ||
        norm(scLabel).includes(q) ||
        norm(body).includes(q)
      );
    });
    if (caseSort === 'name') {
      return [...list].sort((a, b) => displayName(a).localeCompare(displayName(b), 'ja'));
    }
    if (caseSort === 'created') return [...list].sort((a, b) => b.createdAt - a.createdAt);
    return list; // 既定は更新の新しい順（呼び出し元が並べたものをそのまま使う）
  }, [cases, caseQuery, caseSort, caseType, behaviors]);

  // 前回のしぼり込みを覚えておく（次に開いた時に戻す）
  const setScene = (v) => {
    setSceneState(v);
    onSetPersonView?.({ scene: v });
  };
  const setCore = (v) => {
    setCoreState(v);
    onSetPersonView?.({ core: v });
  };
  const hidden = personView.hidden || [];
  const history = personView.history || [];

  function rememberQuery(q) {
    if (q && q.trim()) onSetPersonView?.({ history: pushHistory(history, q.trim()) });
  }

  function hideCounter(tacticId) {
    if (tacticId === null) onSetPersonView?.({ hidden: [] });
    else onSetPersonView?.({ hidden: [...new Set([...hidden, tacticId])] });
  }

  function toggle(id) {
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
    setSaved(false);
    setCopied(false);
  }

  const first = useMemo(() => firstMove(result.matches), [result]);
  const trySum = useMemo(() => summarize(tries), [tries]);
  const notTried = useMemo(() => {
    const all = result.matches.flatMap((m) => m.type.counters);
    const seen = new Set();
    return untried(all, tries).filter((c) => (seen.has(c.tacticId) ? false : seen.add(c.tacticId)));
  }, [result, tries]);

  /**
   * 今日試す1つ——保存した見立てのうち、いちばん最近直したものから、
   * まだ試していない手をひとつ。**選び直しの候補を並べない**（1つに絞らないと動けない）。
   */
  const todays = useMemo(() => {
    for (const c of cases) {
      const ids = new Set(c.checkedIds.map((id) => id.split(':')[0]));
      const cs = PERSON_TYPES.filter((t) => ids.has(t.id)).flatMap((t) => t.counters);
      const rest = untried(cs, tries);
      if (rest.length > 0) return { c, counter: rest[0] };
    }
    return null;
  }, [cases, tries]);

  const editing = cases.find((c) => c.id === editingId) || null;
  const timeline = useMemo(() => (editing ? timelineOf(editing) : []), [editing]);
  const other = cases.find((c) => c.id === compareWith) || null;
  const diff = useMemo(
    () => (editing && other ? compare(editing.checkedIds, other.checkedIds) : null),
    [editing, other],
  );
  const textOfId = useMemo(() => new Map(behaviors.map((b) => [b.id, b.text])), [behaviors]);

  /** 対応策の逆引き（この手はどの型に効くか） */
  const reverse = useMemo(() => {
    const map = new Map();
    for (const t of PERSON_TYPES) {
      for (const c of t.counters) {
        const cur = map.get(c.tacticId) || { tacticId: c.tacticId, types: [] };
        cur.types.push(t.name);
        map.set(c.tacticId, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.types.length - a.types.length);
  }, []);

  const seenTypes = personView.seenTypes || [];
  function markSeen(id) {
    if (!seenTypes.includes(id)) onSetPersonView?.({ seenTypes: [...seenTypes, id] });
  }
  const unseen = PERSON_TYPES.filter((t) => !seenTypes.includes(t.id)).length;

  /** 枠は左右キーでも移れる（18）。押せる所へ届かないと、道具として使えない */
  function onTabKey(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const i = TABS.findIndex((t) => t.id === tab);
    const d = e.key === 'ArrowRight' ? 1 : -1;
    setTab(TABS[(i + d + TABS.length) % TABS.length].id);
  }

  /** 型の一覧まで運ぶ（21・16）。開く・読んだ印・飛ぶ、をひと続きにする */
  function readType(id) {
    markSeen(id);
    setCatalogOpen(id);
    setTab('browse');
    requestAnimationFrame(() => flashTo(`toc-person-${id}`));
  }

  const canUndo = undoAlive(undoCase, now);

  /** 覚えさせたしぼり込み（17）。**勝手に足さない**——名前を付けて押した時だけ */
  const savedFilters = personView.filters || [];
  function saveFilter() {
    const name = filterName.trim();
    if (!name) return;
    const next = [
      ...savedFilters.filter((f) => f.name !== name),
      { name, query, scene, core, onlyChecked },
    ].slice(-8);
    onSetPersonView?.({ filters: next });
    setFilterName('');
  }
  function applyFilter(f) {
    setQuery(f.query || '');
    setScene(f.scene || '');
    setCore(f.core || '');
    setOnlyChecked(!!f.onlyChecked);
  }

  /** 型 × 見立ての重なり（20）。**点数でも順位でもない**——出るのは件数だけ */
  const matrixRows = useMemo(() => {
    const rows = [];
    for (const t of PERSON_TYPES) {
      const cells = shownCases.map(
        (c) => c.checkedIds.filter((id) => id.startsWith(`${t.id}:`)).length,
      );
      if (cells.some((n) => n > 0)) rows.push({ type: t, cells });
    }
    return rows;
  }, [shownCases]);

  const caseNameOf = (id) => {
    const c = cases.find((x) => x.id === id);
    if (!c) return '';
    return displayName(c);
  };

  /** 相談する時に渡す文（14）。事実だけを見た順に並べる */
  const consultText = useMemo(() => {
    if (!editing) return '';
    const rows = editing.checkedIds
      .map((id) => ({ at: seenAtOf(editing, id) || editing.createdAt, id }))
      .sort((a, b) => a.at - b.at)
      .map((r) => ({ when: when(r.at), text: textOfId.get(r.id) || r.id }));
    const sceneLabel = editing.sceneId && SCENE_MAP[editing.sceneId] ? SCENE_MAP[editing.sceneId].label : '';
    return toConsultText({ label: displayName(editing), sceneLabel, rows });
  }, [editing, textOfId]);

  async function copyConsult() {
    const ok = await copyText(consultText);
    setConsultCopied(ok ? 'done' : 'fail');
  }

  /** 持ち出す（6）。判定は入らない——入力と記録だけ */
  const exportText = () =>
    JSON.stringify(toExport({ cases, tries, myHabits, personView }), null, 1);

  async function copyExport() {
    const ok = await copyText(exportText());
    setExported(ok ? 'done' : 'fail');
  }

  function downloadExport() {
    try {
      const blob = new Blob([exportText()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kagami-people.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExported('fail');
    }
  }

  /** 取り込みは**必ず確認を出してから**（29）。ここでは検めるだけ */
  function checkImport() {
    setImportAsk(parseImport(importText));
  }
  function doImport() {
    if (!importAsk || !importAsk.ok) return;
    onImportPeople?.({
      cases: importAsk.cases,
      tries: importAsk.tries,
      myHabits: importAsk.myHabits,
    });
    setImportAsk(null);
    setImportText('');
  }

  function toggleGroup(id) {
    markSeen(id);
    setOpenGroups((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));
  }

  function openCase(c) {
    setEditingId(c.id);
    setChecked(c.checkedIds);
    // 選んだふるまいのある型をたたんだままにしない（何を選んだか見えなくなる）
    setOpenGroups([...new Set(c.checkedIds.map((id) => id.split(':')[0]))]);
    setLabel(c.label);
    setNote(c.note);
    setScene(c.sceneId || '');
    setStage(c.stage || 0);
    setStatus(c.status || 'open');
    setNextAction(c.nextAction || '');
    setNextMeetAt(c.nextMeetAt || '');
    setSaved(false);
    setCopied(false);
    setTab('pick');
    window.scrollTo(0, 0);
  }

  function newCase() {
    setEditingId('');
    setChecked([]);
    setOpenGroups([]);
    setLabel('');
    setNote('');
    setSaved(false);
  }

  function save() {
    // 新しく作る時も先に id を決めておき、保存後は「編集中」へ移す。
    // そうしないと、もう一度押した時に同じ人の見立てがもう1件できてしまう。
    const id = editingId || newCaseId();
    onSaveCase({
      id, label, note, sceneId: scene, checkedIds: checked,
      stage, status, nextAction, nextMeetAt,
    });
    setEditingId(id);
    setSaved(true);
  }

  async function copyResult() {
    const ok = await copyText(
      caseToText({
        label,
        note,
        sceneLabel: scene && SCENE_MAP[scene] ? SCENE_MAP[scene].label : '',
        behaviors: checkedTexts,
        matches: result.matches,
        tries,
        nameOf: tacticLabel,
      }),
    );
    setCopied(ok ? 'done' : 'fail');
  }

  function clearFilters() {
    setQuery('');
    setScene('');
    setCore('');
    setOnlyChecked(false);
  }

  const filtering = !!(query.trim() || scene || core || onlyChecked);

  return (
    <>
      <div className="head">
        <EyeSigil size={64} className="sigil" />
        <h1>人間分析</h1>
        <p>気になる相手との、距離の決め方を見立てる枠。</p>
      </div>
      <Rule mark={GLYPHS.piece} />

      <div className="note">
        <strong>人を採点する画面ではありません。</strong>
        出るのは「あなたが実際に見たふるまい」と「そこで取れる距離」だけで、
        点数も順位も、その人がどういう人間かという判定も出しません。
        決めるのは<strong>距離</strong>であって、相手の人格ではありません。
      </div>

      <div className="note warn">
        <strong>年齢や性別で分けていません。</strong>
        「若い人は」「女性は」「年寄りは」で分けた見方は、目の前の一人を見なくさせます。
        分けているのは<strong>ふるまい</strong>だけです。
      </div>

      {/* 3つに分ける（28）。長い1枚だと、探しに来た時に何度もスクロールすることになる */}
      <div className="chips tabs" role="tablist" onKeyDown={onTabKey}>
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`chip ${tab === t.id ? 'on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'saved' && cases.length > 0 ? `（${cases.length}）` : ''}
            {t.id === 'browse' && unseen > 0 ? `（未読${unseen}）` : ''}
          </button>
        ))}
      </div>

      {canUndo && (
        <div className="card quiet">
          <p>
            <strong>「{displayName(undoCase.item)}」を消しました。</strong>
          </p>
          <div className="row end">
            <button className="primary" onClick={onUndoRemove}>
              元に戻す
            </button>
          </div>
          <p className="tiny">この案内が消えると、もう戻せません。</p>
        </div>
      )}

      {tab === 'pick' && (
        <>
      {/* 選択中の件数を、スクロールしても見える所に置く */}
      <div className="pick-bar">
        <span>
          {GLYPHS.squareFilled} 選択 <strong>{checked.length}</strong> 件
          {result.status === 'few' && `／あと${MIN_TOTAL - checked.length}件で見立て`}
          {result.status === 'ok' && `／近い型 ${result.matches.length}件`}
          {words.length > 0 && `／さがした結果 ${shownBehaviors.length}件`}
          {editingId && <span className="badge" style={{ marginLeft: 8 }}>編集中</span>}
        </span>
        <span className="row" style={{ gap: 6 }}>
          {checked.length > 0 && (
            <button className="ghost" onClick={() => setChecked([])}>
              全部はずす
            </button>
          )}
          <button className="ghost" onClick={() => document.getElementById('sec-result')?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>
            見立てへ
          </button>
        </span>
      </div>

      <h2>見たものにチェック</h2>
      <Rule mark={GLYPHS.square} />
      <p className="tiny">
        思い当たるものではなく、<strong>実際に見たもの</strong>だけを選んでください。
        {MIN_TOTAL}つ以上で見立てが出ます。選んだだけでは残りません——
        <strong>下の「この見立てを残す」を押した時だけ</strong>この端末に保存します。
      </p>

      <input
        type="text"
        id="toc-lookup"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => rememberQuery(query)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            rememberQuery(query);
            document.getElementById('sec-result')?.focus?.();
          }
          if (e.key === 'Escape') setQuery('');
        }}
        placeholder="ふるまいをさがす（読みでも引けます。スペースで2語以上。Enterで覚え、Escで消します）"
      />

      <div className="chips">
        {QUICK_TERMS.map((t) => (
          <button key={t} className={`chip ${query === t ? 'on' : ''}`} onClick={() => { setQuery(t); rememberQuery(t); }}>
            {t}
          </button>
        ))}
      </div>

      {history.length > 0 && (
        <div className="chips">
          <span className="tiny">最近さがした語：</span>
          {history.map((h) => (
            <button key={h} className="chip" onClick={() => setQuery(h)}>
              {h}
            </button>
          ))}
        </div>
      )}

      {nearby.length > 0 && (
        <div className="card quiet">
          <p className="muted">
            「{query}」では見つかりませんでした。この語ではどうですか：
          </p>
          <div className="chips">
            {nearby.map((n) => (
              <button key={n} className="chip" onClick={() => setQuery(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="tiny" id="toc-scenes" style={{ margin: '10px 0 4px' }}>
        どこで起きたことか
      </p>
      <div className="chips">
        <button className={`chip ${scene === '' ? 'on' : ''}`} onClick={() => setScene('')}>
          すべて
        </button>
        {SCENES.map((sc) => (
          <button
            key={sc.id}
            className={`chip ${scene === sc.id ? 'on' : ''}`}
            onClick={() => setScene(scene === sc.id ? '' : sc.id)}
          >
            {sc.label}
          </button>
        ))}
      </div>

      {scene && (SCENE_HELPLINES[scene] || []).length > 0 && (
        <div className="note">
          {SCENE_MAP[scene].label}で行き詰まった時の相談先：
          <strong>{SCENE_HELPLINES[scene].join('／')}</strong>
          <br />
          <span className="tiny">
            {GLYPHS.reference} 名称・番号は変わることがあります。公式の案内で確かめてから使ってください。
          </span>
        </div>
      )}

      <p className="tiny" style={{ margin: '10px 0 4px' }}>
        どの芯にあたるか
      </p>
      <div className="chips">
        <button className={`chip ${core === '' ? 'on' : ''}`} onClick={() => setCore('')}>
          すべて
        </button>
        {CORES.map((c) => (
          <button
            key={c.id}
            className={`chip ${core === c.id ? 'on' : ''}`}
            onClick={() => setCore(core === c.id ? '' : c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="chips">
        <button className={`chip ${onlyChecked ? 'on' : ''}`} onClick={() => setOnlyChecked((v) => !v)}>
          選んだものだけ（{checked.length}）
        </button>
        {filtering && (
          <button className="chip" onClick={clearFilters}>
            {GLYPHS.cross} しぼり込みを外す
          </button>
        )}
      </div>

      <div className="chips">
        <span className="tiny">並び：</span>
        {[
          ['catalog', '元の並び'],
          ['kana', 'あいうえお順'],
          ['mine', '自分の見立てに多い順'],
        ].map(([id, lbl]) => (
          <button
            key={id}
            className={`chip ${sortBy === id ? 'on' : ''}`}
            onClick={() => {
              setSortBy(id);
              onSetPersonView?.({ sort: id });
            }}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* しぼり込みを覚える（17）。**勝手に覚えない**——名前を付けて押した時だけ */}
      <div className="chips">
        {savedFilters.map((f) => (
          <button key={f.name} className="chip" onClick={() => applyFilter(f)}>
            {GLYPHS.reference} {f.name}
          </button>
        ))}
        {filtering && (
          <>
            <input
              type="text"
              value={filterName}
              maxLength={20}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="このしぼり込みの名前"
              style={{ maxWidth: 220, margin: 0 }}
            />
            <button className="chip" onClick={saveFilter} disabled={!filterName.trim()}>
              {GLYPHS.circlePlus} 覚える
            </button>
          </>
        )}
        {savedFilters.length > 0 && (
          <button className="chip" onClick={() => onSetPersonView?.({ filters: [] })}>
            {GLYPHS.cross} 覚えたものを消す
          </button>
        )}
      </div>

      <p className="tiny">
        {behaviors.length}項目のうち <strong>{shownBehaviors.length}件</strong>を表示／
        {groups.length}の型
      </p>

      {groups.length === 0 && <p className="muted">見つかりませんでした。しぼり込みを外してみてください。</p>}

      {groups.map((g) => {
        const isOpen = forceOpen || openGroups.includes(g.type.id);
        const picked = g.items.filter((b) => checked.includes(b.id)).length;
        return (
          <div className="card quiet" key={g.type.id}>
            <button className="group-head" onClick={() => toggleGroup(g.type.id)} aria-expanded={isOpen}>
              <span className="t">
                {isOpen ? GLYPHS.triangleDown : GLYPHS.pointer} {g.type.name}
                {!seenTypes.includes(g.type.id) && (
                  <span className="badge" style={{ marginLeft: 8 }}>
                    未読
                  </span>
                )}
              </span>
              <span className="s">
                {words.length > 0 && `${g.items.length}件該当・`}
                {picked > 0 ? `${picked} / ${g.items.length} 件` : `${g.items.length} 件`}
              </span>
            </button>
            {isOpen &&
              g.items.map((b) => (
                <label className="check" key={b.id}>
                  <input type="checkbox" checked={checked.includes(b.id)} onChange={() => toggle(b.id)} />
                  <span>
                    {words.length === 0
                      ? b.text
                      : splitByHit(b.text, words).map((part, i) =>
                          part.hit ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>,
                        )}
                  </span>
                </label>
              ))}
            {isOpen && (
              <div className="row end">
                <button className="ghost" onClick={() => readType(g.type.id)}>
                  この型を読む（取れる距離・返し方）
                </button>
              </div>
            )}
          </div>
        );
      })}

      <h2 id="sec-result" tabIndex={-1}>見立て</h2>
      <Rule mark={GLYPHS.piece} />

      <div className="chips">
        <button className={`chip ${practice ? 'on' : ''}`} onClick={() => setPractice((v) => !v)}>
          {practice ? '下読みをやめる' : '言い方だけ大きく出す（下読み）'}
        </button>
        {practice && <span className="tiny">声に出して1度読んでおくと、その場で出てきます。</span>}
      </div>

      {result.status === 'empty' && (
        <div className="card quiet">
          <p className="muted">まだ何も選ばれていません。上のふるまいから、実際に見たものを選んでください。</p>
        </div>
      )}

      {result.status === 'few' && (
        <div className="card quiet">
          <p>
            <strong>あと{MIN_TOTAL - result.checked}つで見立てが出ます。</strong>
          </p>
          <p className="muted">
            1つや2つでは、誰にでも当てはまります。少ないうちに型を出すと、それは決めつけになります。
          </p>
        </div>
      )}

      {result.status === 'none' && (
        <div className="card quiet">
          <p>
            <strong>近い型は出ませんでした。</strong>
          </p>
          <p className="muted">
            同じ型のふるまいが2つ以上そろっていない、ということだけです。
            <strong>問題がないという意味ではありません。</strong>
            会ったあとに疲れが残るなら、それだけで距離を決めてよい理由になります。
          </p>
        </div>
      )}

      {result.status === 'ok' && (
        <>
          {cores.length > 0 && (
            <div className="note">
              触れている芯：<strong>{cores.map((c) => CORE_MAP[c].label).join('・')}</strong>
              <br />
              <span className="tiny">
                これは性別も年代も関係なく共通するところです。いくつ当たったかは数えません。
              </span>
            </div>
          )}

          {first && (
            <div className="card">
              <h3>まず1つだけやるなら</h3>
              <div className="row" style={{ gap: 8 }}>
                <button className="chip on" onClick={() => onGoTactic(first.tacticId)}>
                  {akaNameOf(first.tacticId) || TACTIC_MAP[first.tacticId]?.name || first.tacticId}
                </button>
                {akaNameOf(first.tacticId) && (
                  <span className="tiny">（{TACTIC_MAP[first.tacticId]?.name}）</span>
                )}
                {first.sharedBy > 1 && (
                  <span className="tiny">当たった{first.sharedBy}つの型に共通して出てくる手</span>
                )}
              </div>
              <p style={{ margin: '8px 0 4px' }}>{first.how}</p>
              <p className="script">「{first.script}」</p>
              <p className="tiny">
                いくつも同時にやろうとすると続きません。今日はこれだけ、で十分です。
              </p>
            </div>
          )}

          {notTried.length > 0 && (
            <p className="tiny">
              まだ試していない手が{notTried.length}件あります：
              {notTried.slice(0, 4).map((c) => akaNameOf(c.tacticId) || TACTIC_MAP[c.tacticId]?.name).join('／')}
            </p>
          )}

          {result.matches.map((m) => (
            <PersonTypeCard
              key={m.type.id}
              type={m.type}
              matched={m.behaviors}
              open={open === m.type.id}
              onToggle={() => setOpen(open === m.type.id ? '' : m.type.id)}
              onGoTactic={onGoTactic}
              showCounters
              scene={scene}
              tries={tries}
              hidden={hidden}
              onTry={onAddTry}
              onHide={hideCounter}
              caseId={editingId}
              myHabits={myHabits}
              practice={practice}
            />
          ))}
        </>
      )}

      <div className="card">
        <h3>{editingId ? 'この見立てを直す' : 'この見立てを残す'}</h3>
        <p className="tiny">
          残るのは<strong>チェックした内容だけ</strong>で、判定は開くたびに計算し直します
          （あとから型が増えても、過去の見立てを読み直せます）。
          <br />
          <strong>端末を人に見られる可能性があるなら、本名ではなく呼び名を。</strong>
          「職場のAさん」で十分です。電話番号・メール・リンクが混ざっていたら自動で伏せます。
        </p>

        <input
          type="text"
          value={label}
          maxLength={LABEL_MAX}
          onChange={(e) => {
            setLabel(e.target.value);
            setSaved(false);
          }}
          placeholder="呼び名（例：職場のAさん／空でも残せます）"
        />
        <textarea
          style={{ minHeight: 80, marginTop: 10 }}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setSaved(false);
          }}
          placeholder="メモ（いつ・どこで・何があったか。任意）"
        />

        {/* 記録のひな形（13）。**上書きしない**——空のときだけ入れる */}
        <div className="row end" style={{ marginTop: 6 }}>
          <button
            className="ghost"
            disabled={!!note.trim()}
            onClick={() => {
              setNote(NOTE_TEMPLATE);
              setSaved(false);
            }}
          >
            {note.trim() ? 'ひな形（メモが空のときだけ）' : 'ひな形を入れる'}
          </button>
        </div>
        <p className="tiny">
          <strong>「言われたこと」はそのまま書いてください。</strong>
          要約すると、あとから読んだ時に自分の解釈しか残りません。
        </p>

        <p className="tiny" style={{ margin: '12px 0 4px' }}>
          いまの距離
        </p>
        <div className="chips">
          {STAGES.map((st) => (
            <button
              key={st.id}
              className={`chip ${stage === st.id ? 'on' : ''}`}
              onClick={() => {
                setStage(st.id);
                setSaved(false);
              }}
            >
              {st.label}
            </button>
          ))}
        </div>
        <p className="tiny">
          <strong>右へ行くほど正しい、ではありません。</strong>
          いまどこにいるかを置くだけで、戻してもかまいません。
        </p>

        <p className="tiny" style={{ margin: '12px 0 4px' }}>
          この見立ての状態
        </p>
        <div className="chips">
          {CASE_STATUSES.map((st) => (
            <button
              key={st.id}
              className={`chip ${status === st.id ? 'on' : ''}`}
              onClick={() => {
                setStatus(st.id);
                setSaved(false);
              }}
            >
              {st.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={nextAction}
          maxLength={120}
          onChange={(e) => {
            setNextAction(e.target.value);
            setSaved(false);
          }}
          placeholder="次にすること（例：次に同じことを言われたら持ち帰る）"
        />
        <label className="tiny" style={{ display: 'block', marginTop: 10 }}>
          次に顔を合わせる日（任意）
          <input
            type="date"
            value={nextMeetAt}
            onChange={(e) => {
              setNextMeetAt(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        <p className="tiny">
          日付はこの端末の中だけに残ります。<strong>知らせは出しません</strong>
          （この画面を開いた時に並ぶだけです）。
        </p>

        <div className="row end" style={{ marginTop: 10 }}>
          {editingId && (
            <button className="ghost" onClick={newCase}>
              新しく作る
            </button>
          )}
          <button className="ghost" onClick={copyResult} disabled={checked.length === 0}>
            {copied === 'done' ? 'コピーしました' : copied === 'fail' ? 'コピーできません' : '文章にしてコピー'}
          </button>
          <button className="primary" onClick={save} disabled={checked.length === 0 || saved}>
            {saved ? '保存しました' : editingId ? '上書きして保存' : 'この見立てを残す'}
          </button>
        </div>
        {copied === 'fail' && (
          <p className="tiny">
            この環境ではコピーが使えません（端末やブラウザの設定によります）。保存のほうは使えます。
          </p>
        )}
      </div>
        </>
      )}

      {tab === 'saved' && (
        <>
      <h2>保存してある見立て（{cases.length}）</h2>
      <Rule mark={GLYPHS.reference} />

      {cases.length === 0 ? (
        <p className="tiny">まだありません。上で選んで「この見立てを残す」を押すと、ここに並びます。</p>
      ) : (
        <>
          <input
            type="text"
            value={caseQuery}
            onChange={(e) => setCaseQuery(e.target.value)}
            placeholder="呼び名・メモ・場面でさがす"
          />
          <div className="chips">
            <button className={`chip ${caseType === '' ? 'on' : ''}`} onClick={() => setCaseType('')}>
              型で絞らない
            </button>
            {PERSON_TYPES.filter((t) => cases.some((c) => c.checkedIds.some((id) => id.startsWith(`${t.id}:`)))).map((t) => (
              <button
                key={t.id}
                className={`chip ${caseType === t.id ? 'on' : ''}`}
                onClick={() => setCaseType(caseType === t.id ? '' : t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
          <div className="chips">
            {[
              ['updated', '直した順'],
              ['created', '作った順'],
              ['name', '呼び名順'],
            ].map(([id, lbl]) => (
              <button key={id} className={`chip ${caseSort === id ? 'on' : ''}`} onClick={() => setCaseSort(id)}>
                {lbl}
              </button>
            ))}
          </div>

          {shownCases.length === 0 && <p className="muted">見つかりませんでした。</p>}

          <ul className="list">
            {shownCases.map((c) => (
              <li key={c.id}>
                <button className="item" onClick={() => openCase(c)}>
                  <span className="t">
                    {GLYPHS.piece} {displayName(c)}
                    {c.id === editingId && <span className="badge" style={{ marginLeft: 8 }}>編集中</span>}
                    {c.status && c.status !== 'open' && (
                      <span className="badge" style={{ marginLeft: 8 }}>
                        {(CASE_STATUSES.find((st) => st.id === c.status) || {}).label}
                      </span>
                    )}
                    {isStale(c, now) && (
                      <span className="badge" style={{ marginLeft: 8 }}>
                        {daysSince(c.updatedAt, now)}日ぶり
                      </span>
                    )}
                  </span>
                  <span className="s">
                    {c.sceneId && SCENE_MAP[c.sceneId] ? `${SCENE_MAP[c.sceneId].label}・` : ''}
                    ふるまい{c.checkedIds.length}件・{when(c.updatedAt)}
                    {c.stage ? `／${(STAGES.find((st) => st.id === c.stage) || {}).label}` : ''}
                    {c.nextMeetAt ? `／次に会う ${c.nextMeetAt}` : ''}
                    {c.note ? `／${c.note.slice(0, 24)}` : ''}
                  </span>
                  {c.nextAction && (
                    <span className="s">
                      {GLYPHS.pointer} 次にすること：{c.nextAction}
                    </span>
                  )}
                </button>
                <div className="row end" style={{ paddingBottom: 8 }}>
                  {confirmDelete === c.id ? (
                    <>
                      <span className="tiny">元に戻せません。</span>
                      <button className="ghost" onClick={() => setConfirmDelete('')}>
                        やめる
                      </button>
                      <button
                        className="danger"
                        onClick={() => {
                          onRemoveCase(c.id);
                          if (editingId === c.id) newCase();
                          setConfirmDelete('');
                        }}
                      >
                        消す
                      </button>
                    </>
                  ) : (
                    <button className="danger ghost" onClick={() => setConfirmDelete(c.id)}>
                      消す
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <p className="tiny">
            {GLYPHS.reference} 「{STALE_DAYS}日ぶり」の印は、見直す目安を過ぎたというだけです。
            <strong>古い見立てを勝手に消したり、書き換えたりはしません。</strong>
          </p>

          {matrixRows.length > 0 && shownCases.length > 0 && (
            <>
              <h3>型 × 見立て（重なりを見る）</h3>
              <p className="tiny">
                数はチェックしたふるまいの件数です。
                <strong>点数でも順位でもありません。</strong>
                同じ型が何人にも並ぶなら、それはあなたが繰り返し出会っている型です。
              </p>
              <div className="scroll-x">
                <table className="matrix">
                  <thead>
                    <tr>
                      <th>型</th>
                      {shownCases.map((c) => (
                        <th key={c.id}>{displayName(c)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixRows.map((r) => (
                      <tr key={r.type.id}>
                        <th>{r.type.name}</th>
                        {r.cells.map((count, i) => (
                          <td key={shownCases[i].id}>{count > 0 ? count : ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {todays && (
        <div className="card">
          <h3>今日試す1つ</h3>
          <p className="tiny">
            保存してある「{displayName(todays.c)}」から、まだ試していない手をひとつ。
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button className="chip on" onClick={() => onGoTactic(todays.counter.tacticId)}>
              {tacticLabel(todays.counter.tacticId)}
            </button>
            <button className="ghost" onClick={() => openCase(todays.c)}>
              この見立てを開く
            </button>
          </div>
          <p style={{ margin: '8px 0 4px' }}>{todays.counter.how}</p>
          <p className="script">「{todays.counter.script}」</p>
        </div>
      )}

      {editing && (
        <>
          <h2>「{displayName(editing)}」を読み直す</h2>
          <Rule mark={GLYPHS.moonWax} />

          <h3>移り変わり</h3>
          <p className="tiny">
            直すたびに前の版を残しています（{SNAPSHOT_MAX}件まで）。
            <strong>良くなった・悪くなったという判定は出しません。</strong>
            同じ人でも、3か月前と今では見えているものが違うというだけです。
          </p>
          <ul className="list">
            {timeline.map((v, i) => (
              <li key={`${v.at}-${i}`}>
                <div className="item">
                  <span className="t">
                    {v.now ? 'いまの中身' : when(v.at)}・ふるまい{v.checkedIds.length}件
                  </span>
                  <span className="s">
                    {v.checkedIds
                      .slice(0, 3)
                      .map((id) => textOfId.get(id))
                      .filter(Boolean)
                      .join('／')}
                    {v.checkedIds.length > 3 && ` ほか${v.checkedIds.length - 3}`}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <h3>いつ見たことか</h3>
          <p className="tiny">
            最初にチェックした日です（チェックを外すと消えます）。
            <strong>いつ見たかが分かると、続いていることなのか一度きりなのかを自分で判断できます。</strong>
          </p>
          <ul className="tiny">
            {editing.checkedIds.map((id) => (
              <li key={id}>
                {when(seenAtOf(editing, id) || editing.createdAt)}：{textOfId.get(id) || id}
              </li>
            ))}
            {editing.checkedIds.length === 0 && <li className="muted">ありません。</li>}
          </ul>

          <h3>ほかの見立てと比べる</h3>
          <p className="tiny">
            <strong>どちらが重いかは出しません。</strong>
            同じふるまいが出ているかどうかを並べるだけです。
          </p>
          <div className="chips">
            <button
              className={`chip ${compareWith === '' ? 'on' : ''}`}
              onClick={() => setCompareWith('')}
            >
              比べない
            </button>
            {cases
              .filter((c) => c.id !== editing.id)
              .map((c) => (
                <button
                  key={c.id}
                  className={`chip ${compareWith === c.id ? 'on' : ''}`}
                  onClick={() => setCompareWith(compareWith === c.id ? '' : c.id)}
                >
                  {displayName(c)}
                </button>
              ))}
          </div>
          {cases.length < 2 && <p className="muted">比べるには、見立てが2件以上いります。</p>}
          {diff && other && (
            <div className="card quiet">
              <h3>どちらにもある（{diff.both.length}）</h3>
              <ul className="tiny">
                {diff.both.map((id) => (
                  <li key={id}>{textOfId.get(id) || id}</li>
                ))}
                {diff.both.length === 0 && <li className="muted">ありません。</li>}
              </ul>
              <h3>「{displayName(editing)}」だけ（{diff.onlyA.length}）</h3>
              <ul className="tiny">
                {diff.onlyA.map((id) => (
                  <li key={id}>{textOfId.get(id) || id}</li>
                ))}
                {diff.onlyA.length === 0 && <li className="muted">ありません。</li>}
              </ul>
              <h3>「{displayName(other)}」だけ（{diff.onlyB.length}）</h3>
              <ul className="tiny">
                {diff.onlyB.map((id) => (
                  <li key={id}>{textOfId.get(id) || id}</li>
                ))}
                {diff.onlyB.length === 0 && <li className="muted">ありません。</li>}
              </ul>
            </div>
          )}

          <h3>人に相談するときに渡す文</h3>
          <p className="tiny">
            見たことを、見た順に並べます。
            <strong>相手がどういう人かという判断は入りません。</strong>
            言い合いになりにくいのは、事実だけを時系列で置いた時です。
          </p>
          <div className="row end">
            <button className="ghost" onClick={copyConsult}>
              {consultCopied === 'done'
                ? 'コピーしました'
                : consultCopied === 'fail'
                  ? 'コピーできません'
                  : '文章にしてコピー'}
            </button>
          </div>
          <pre className="quote">{consultText}</pre>
        </>
      )}

      <h2>やってみた記録（{tries.length}）</h2>
      <Rule mark={GLYPHS.circle} />
      {tries.length === 0 ? (
        <p className="tiny">
          まだありません。型のカードの「黒い心理学で返すなら」から、試した手に ○△✕ を付けられます。
        </p>
      ) : (
        <ul className="list">
          {[...tries]
            .sort((a, b) => b.at - a.at)
            .slice(0, 40)
            .map((t) => (
              <li key={t.id}>
                <button className="item" onClick={() => onGoTactic(t.tacticId)}>
                  <span className="t">
                    {(RESULT_MAP[t.result] || {}).mark} {tacticLabel(t.tacticId)}
                  </span>
                  <span className="s">
                    {when(t.at)}
                    {caseNameOf(t.caseId) ? `・${caseNameOf(t.caseId)}` : ''}
                    {t.note ? `／${t.note}` : ''}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
      <p className="tiny">
        残しているのは<strong>自分がそれをやれたかどうか</strong>までです。
        効き目の割合も、相手がどう変わったかも記録していません（そこまでは分からないからです）。
      </p>

      <h2>持ち出す・取り込む</h2>
      <Rule mark={GLYPHS.diamondOutline} />
      <p className="tiny">
        この端末の中だけに保存しているので、機種を変えると消えます。
        持ち出すのは<strong>入力（チェックしたふるまい）と記録だけ</strong>で、判定は入りません。
        中身は人に見せたくないものです。<strong>置き場所に気をつけてください。</strong>
      </p>
      <div className="row end">
        <button className="ghost" onClick={copyExport}>
          {exported === 'done'
            ? 'コピーしました'
            : exported === 'fail'
              ? 'コピーできません'
              : '書き出してコピー'}
        </button>
        <button className="ghost" onClick={downloadExport}>
          ファイルに保存
        </button>
      </div>

      <textarea
        style={{ minHeight: 80, marginTop: 10 }}
        value={importText}
        onChange={(e) => {
          setImportText(e.target.value);
          setImportAsk(null);
        }}
        placeholder="書き出した文をここに貼ると、取り込めます"
      />
      <div className="row end">
        <button className="ghost" onClick={checkImport} disabled={!importText.trim()}>
          中身を検める
        </button>
      </div>
      {importAsk && !importAsk.ok && <p className="tiny">{importAsk.reason}</p>}
      {importAsk && importAsk.ok && (
        <div className="card quiet">
          <p>
            <strong>
              見立て{importAsk.cases.length}件・やってみた記録{importAsk.tries.length}件
            </strong>
            を取り込みます。
          </p>
          <p className="tiny">
            いまあるものは消えません。
            <strong>同じ見立てがあれば、あとから直したほうを残します。</strong>
            取り込んだあとは元に戻せません。
          </p>
          <div className="row end">
            <button className="ghost" onClick={() => setImportAsk(null)}>
              やめる
            </button>
            <button className="primary" onClick={doImport}>
              取り込む
            </button>
          </div>
        </div>
      )}

      <h2>人間分析だけを消す</h2>
      <Rule mark={GLYPHS.cross} />
      <p className="tiny">
        消えるのは<strong>この画面のもの（見立て・やってみた記録・しぼり込み）だけ</strong>です。
        型・癖・状態の記録は残ります。
      </p>
      <div className="row end">
        {confirmClear ? (
          <>
            <span className="tiny">元に戻せません。</span>
            <button className="ghost" onClick={() => setConfirmClear(false)}>
              やめる
            </button>
            <button
              className="danger"
              onClick={() => {
                onClearPeople?.();
                setConfirmClear(false);
                newCase();
              }}
            >
              消す
            </button>
          </>
        ) : (
          <button className="danger ghost" onClick={() => setConfirmClear(true)}>
            人間分析だけ消す
          </button>
        )}
      </div>

        </>
      )}

      {tab === 'browse' && (
        <>
      <h2>手から引く（逆引き）</h2>
      <Rule mark={GLYPHS.circlePlus} />
      <p className="tiny">
        ひとつの手が、どの型に出てくるか。自分の記録がある手には回数も出ます。
      </p>
      <ul className="list">
        {reverse.map((r) => {
          const s2 = trySum.get(r.tacticId);
          return (
            <li key={r.tacticId}>
              <button className="item" onClick={() => onGoTactic(r.tacticId)}>
                <span className="t">
                  {GLYPHS.circlePlus} {tacticLabel(r.tacticId)}
                  {s2 && s2.total >= MIN_TRIES && (
                    <span className="badge" style={{ marginLeft: 8 }}>
                      {s2.total}回 {GLYPHS.circle}{s2.ok}／{GLYPHS.cross}{s2.ng}
                    </span>
                  )}
                </span>
                <span className="s">
                  {r.types.length}の型に出てくる：{r.types.slice(0, 3).join('／')}
                  {r.types.length > 3 && ` ほか${r.types.length - 3}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <h2>型の一覧（{shownTypes.length}／{PERSON_TYPES.length}）</h2>
      <Rule mark={GLYPHS.moonWane} />
      <p className="tiny">
        見立てが出ていなくても、ここから全部読めます。上のしぼり込み（場面・芯・さがす）がそのまま効きます。
      </p>

      {shownTypes.map((t) => (
        <PersonTypeCard
          key={t.id}
          id={`toc-person-${t.id}`}
          type={t}
          open={catalogOpen === t.id}
          onToggle={() => setCatalogOpen(catalogOpen === t.id ? '' : t.id)}
          onGoTactic={onGoTactic}
          scene={scene}
          tries={tries}
          hidden={hidden}
          onTry={onAddTry}
          onHide={hideCounter}
          myHabits={myHabits}
        />
      ))}

      <h2>共通する芯</h2>
      <Rule mark={GLYPHS.star} />
      <p className="tiny">
        性別・年代を問わず共通するのは、この{CORES.length}つでした。どれか1つでも当てはまらない人なら、
        話し合いが成り立つことが多くあります。
      </p>
      {CORES.map((c) => (
        <div className="card quiet" key={c.id} id={`toc-core-${c.id}`}>
          <h3>{c.label}</h3>
          <p className="muted">{c.summary}</p>
        </div>
      ))}
        </>
      )}

      <div className="note warn">
        身の危険を感じるとき、その場から離れられないときは、この画面ではなく人に頼ってください。
        緊急のときは110番。急を要しない警察への相談は #9110、家庭内の支配や暴力は DV相談＋。
        <span className="tiny">※番号・名称は変わることがあります。公式の案内で確かめてから使ってください。</span>
      </div>
    </>
  );
}
