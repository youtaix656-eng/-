import React, { useMemo, useState } from 'react';
import {
  PERSON_TYPES, PERSON_TYPE_MAP, CORES, CORE_MAP, SCENES, SCENE_MAP, allBehaviors,
} from '../data/people.js';
import { analyzePerson, coresOf, MIN_TOTAL } from '../lib/analysis.js';
import { displayName, LABEL_MAX } from '../lib/cases.js';
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

export default function People({ focus, onFocusDone, onGoTactic, cases = [], onSaveCase, onRemoveCase }) {
  const [checked, setChecked] = useState([]);
  const [open, setOpen] = useState('');
  const [catalogOpen, setCatalogOpen] = useState('');
  const [scene, setScene] = useState(() => (SCENES.some((sc) => sc.id === focus) ? focus : ''));
  const [core, setCore] = useState('');
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

  // 型と芯が同じ画面にあるので、どちらの飛び先かを id から決める
  const anchor = focus
    ? SCENES.some((sc) => sc.id === focus)
      ? 'toc-scenes'
      : CORES.some((c) => c.id === focus)
        ? `toc-core-${focus}`
        : `toc-person-${focus}`
    : '';
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

  /** チェック欄に出すふるまい（しぼり込み＋検索＋選んだものだけ） */
  const shownBehaviors = useMemo(() => {
    const typeIds = new Set(shownTypes.map((t) => t.id));
    const q = norm(query).trim();
    return behaviors.filter((b) => {
      if (!typeIds.has(b.typeId)) return false;
      if (onlyChecked && !checked.includes(b.id)) return false;
      if (!q) return true;
      return norm(b.text).includes(q) || norm(PERSON_TYPE_MAP[b.typeId]?.name).includes(q);
    });
  }, [behaviors, shownTypes, query, onlyChecked, checked]);

  /** 型ごとにまとめる（アコーディオンの中身） */
  const groups = useMemo(() => {
    const byType = new Map();
    for (const b of shownBehaviors) {
      const list = byType.get(b.typeId) || [];
      list.push(b);
      byType.set(b.typeId, list);
    }
    return shownTypes
      .filter((t) => byType.has(t.id))
      .map((t) => ({ type: t, items: byType.get(t.id) }));
  }, [shownBehaviors, shownTypes]);

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
    const list = cases.filter((c) => {
      if (!q) return true;
      const scLabel = c.sceneId && SCENE_MAP[c.sceneId] ? SCENE_MAP[c.sceneId].label : '';
      return norm(displayName(c)).includes(q) || norm(c.note).includes(q) || norm(scLabel).includes(q);
    });
    if (caseSort === 'name') {
      return [...list].sort((a, b) => displayName(a).localeCompare(displayName(b), 'ja'));
    }
    if (caseSort === 'created') return [...list].sort((a, b) => b.createdAt - a.createdAt);
    return list; // 既定は更新の新しい順（呼び出し元が並べたものをそのまま使う）
  }, [cases, caseQuery, caseSort]);

  function toggle(id) {
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
    setSaved(false);
    setCopied(false);
  }

  function toggleGroup(id) {
    setOpenGroups((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));
  }

  function openCase(c) {
    setEditingId(c.id);
    setChecked(c.checkedIds);
    setLabel(c.label);
    setNote(c.note);
    setScene(c.sceneId || '');
    setSaved(false);
    setCopied(false);
    window.scrollTo(0, 0);
  }

  function newCase() {
    setEditingId('');
    setChecked([]);
    setLabel('');
    setNote('');
    setSaved(false);
  }

  function save() {
    onSaveCase({ id: editingId || undefined, label, note, sceneId: scene, checkedIds: checked });
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

      {/* 選択中の件数を、スクロールしても見える所に置く */}
      <div className="pick-bar">
        <span>
          {GLYPHS.squareFilled} 選択 <strong>{checked.length}</strong> 件
          {result.status === 'few' && `／あと${MIN_TOTAL - checked.length}件で見立て`}
          {result.status === 'ok' && `／近い型 ${result.matches.length}件`}
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
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ふるまいをさがす（例：機嫌／約束／謝）"
      />

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
              </span>
              <span className="s">
                {picked > 0 ? `${picked} / ${g.items.length} 件` : `${g.items.length} 件`}
              </span>
            </button>
            {isOpen &&
              g.items.map((b) => (
                <label className="check" key={b.id}>
                  <input type="checkbox" checked={checked.includes(b.id)} onChange={() => toggle(b.id)} />
                  <span>{b.text}</span>
                </label>
              ))}
          </div>
        );
      })}

      <h2 id="sec-result">見立て</h2>
      <Rule mark={GLYPHS.piece} />

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

          {result.matches.map((m) => (
            <PersonTypeCard
              key={m.type.id}
              type={m.type}
              matched={m.behaviors}
              open={open === m.type.id}
              onToggle={() => setOpen(open === m.type.id ? '' : m.type.id)}
              onGoTactic={onGoTactic}
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
                  </span>
                  <span className="s">
                    {c.sceneId && SCENE_MAP[c.sceneId] ? `${SCENE_MAP[c.sceneId].label}・` : ''}
                    ふるまい{c.checkedIds.length}件・{when(c.updatedAt)}
                    {c.note ? `／${c.note.slice(0, 24)}` : ''}
                  </span>
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
        </>
      )}

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

      <div className="note warn">
        身の危険を感じるとき、その場から離れられないときは、この画面ではなく人に頼ってください。
        緊急のときは110番。急を要しない警察への相談は #9110、家庭内の支配や暴力は DV相談＋。
        <span className="tiny">※番号・名称は変わることがあります。公式の案内で確かめてから使ってください。</span>
      </div>
    </>
  );
}
