import React, { useMemo, useState } from 'react';
import { PERSON_TYPES, CORES, CORE_MAP, SCENES, SCENE_MAP, allBehaviors } from '../data/people.js';
import { analyzePerson, coresOf, MIN_TOTAL } from '../lib/analysis.js';
import { repliesOf } from '../data/replies.js';
import { TACTIC_MAP } from '../data/tactics.js';
import { GLYPHS } from '../data/glyphs.js';
import { EyeSigil, Rule } from './Ornament.jsx';
import { useFocusJump } from './useFocusJump.js';

export default function People({ focus, onFocusDone, onGoTactic }) {
  const [checked, setChecked] = useState([]);
  const [open, setOpen] = useState('');
  const [scene, setScene] = useState(() => (SCENES.some((sc) => sc.id === focus) ? focus : ''));
  // 型と芯が同じ画面にあるので、どちらの飛び先かを id から決める
  // （癖・状態の画面と同じ形。片方だけ直すと必ず取りこぼす）
  const anchor = focus
    ? SCENES.some((sc) => sc.id === focus)
      ? 'toc-scenes'
      : CORES.some((c) => c.id === focus)
        ? `toc-core-${focus}`
        : `toc-person-${focus}`
    : '';
  useFocusJump(anchor, onFocusDone);

  // 場面でしぼる（元の文章の章立てを「どこで起きたか」として残したもの）
  const behaviors = useMemo(() => {
    const all = allBehaviors();
    if (!scene) return all;
    const ids = new Set(PERSON_TYPES.filter((t) => (t.scenes || []).includes(scene)).map((t) => t.id));
    return all.filter((b) => ids.has(b.typeId));
  }, [scene]);
  const result = useMemo(() => analyzePerson(checked, PERSON_TYPES), [checked]);
  const cores = useMemo(() => coresOf(result.matches), [result]);

  function toggle(id) {
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

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

      <h2>見たものにチェック</h2>
      <Rule mark={GLYPHS.square} />

      <p className="tiny" id="toc-scenes" style={{ marginBottom: 4 }}>
        どこで起きたことか（しぼりたい時だけ。チェックは外れません）
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
      <p className="tiny">
        思い当たるものではなく、<strong>実際に見たもの</strong>だけを選んでください。
        {MIN_TOTAL}つ以上で見立てが出ます。<strong>この画面の内容は保存しません</strong>——
        端末の中に人物の記録を作らないためです。
      </p>

      <div className="card">
        {behaviors.map((b) => (
          <label className="check" key={b.id}>
            <input type="checkbox" checked={checked.includes(b.id)} onChange={() => toggle(b.id)} />
            <span>{b.text}</span>
          </label>
        ))}
      </div>

      {checked.length > 0 && (
        <div className="row end">
          <button className="ghost" onClick={() => setChecked([])}>
            全部はずす
          </button>
        </div>
      )}

      <h2>見立て</h2>
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
              触れている芯：
              <strong>{cores.map((c) => CORE_MAP[c].label).join('・')}</strong>
              <br />
              <span className="tiny">
                この3つは、性別も年代も関係なく共通するところです。いくつ当たったかは数えません。
              </span>
            </div>
          )}

          {result.matches.map((m) => (
            <div className="card" key={m.type.id} id={`toc-person-${m.type.id}`}>
              <div className="card-head">
                <div>
                  <h3 style={{ marginBottom: 2 }}>
                    {GLYPHS.piece} {m.type.name}
                  </h3>
                  <span className="tiny">
                    {(m.type.cores || []).map((c) => CORE_MAP[c].label).join('・') || '3つの芯には収まらない型'}
                    {' ／ '}
                    {(m.type.scenes || []).map((x) => SCENE_MAP[x].label).join('・')}
                  </span>
                </div>
                <button className="ghost" onClick={() => setOpen(open === m.type.id ? '' : m.type.id)}>
                  {open === m.type.id ? '閉じる' : 'くわしく'}
                </button>
              </div>

              <p>{m.type.summary}</p>

              <p className="tiny" style={{ marginBottom: 2 }}>
                あなたが選んだふるまい
              </p>
              <ul className="tiny">
                {m.behaviors.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>

              <h3>取れる距離</h3>
              <p>{m.type.distance}</p>

              {open === m.type.id && (
                <>
                  <h3>なぜ消耗するのか</h3>
                  <p>{m.type.why}</p>

                  <h3>使える返し方</h3>
                  <ul>
                    {repliesOf(m.type.replyIds).map((r) => (
                      <li key={r.id}>
                        {r.icon} <strong>{r.tocTitle}</strong> — {r.summary}
                      </li>
                    ))}
                  </ul>

                  <h3>組み合わせて出てくる型</h3>
                  <div className="chips">
                    {m.type.relatedTacticIds.map((id) => (
                      <button key={id} className="chip" onClick={() => onGoTactic(id)}>
                        {TACTIC_MAP[id]?.name || id}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </>
      )}

      <h2>3つの芯</h2>
      <Rule mark={GLYPHS.star} />
      <p className="tiny">
        性別・年代を問わず共通するのは、この3つでした。どれか1つでも当てはまらない人なら、
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
