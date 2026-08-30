import React, { useMemo, useState } from 'react';
import { TACTICS, behaviorTactics } from '../data/tactics.js';
import { detectTactics, splitByHighlight, MIN_TEXT } from '../lib/detect.js';
import { summarizePersonal } from '../lib/privacy.js';
import { PLACES } from '../lib/records.js';
import { GLYPHS } from '../data/glyphs.js';
import { GapSigil, Rule } from './Ornament.jsx';
import TacticCard from './TacticCard.jsx';

/**
 * 貼って調べる画面。
 * mode:
 *   'received' … 届いた文面（既定）
 *   'draft'    … これから自分が送る文面（使う癖は、そのまま人に向く癖になる）
 */
export default function Check({ mode = 'received', onChangeMode, onSave, settings }) {
  const [text, setText] = useState('');
  const [openId, setOpenId] = useState('');
  const [placeId, setPlaceId] = useState('message');
  const [saved, setSaved] = useState(false);

  const result = useMemo(() => detectTactics(text, TACTICS), [text]);
  const parts = useMemo(() => splitByHighlight(text, result.matches), [text, result]);
  const personal = useMemo(() => summarizePersonal(text), [text]);

  const draft = mode === 'draft';
  const unreadable = behaviorTactics();

  function save() {
    onSave({
      text,
      placeId,
      tacticIds: result.matches.map((m) => m.tactic.id),
      keepRaw: !!settings.keepRaw,
    });
    setSaved(true);
  }

  return (
    <>
      <div className="head">
        <GapSigil size={70} className="sigil" />
        <h1>{draft ? '自分が送る文面を見る' : '届いた文面を調べる'}</h1>
        <p>
          {draft
            ? 'これから送る文章を貼ると、相手が断りにくくなる言い回しが入っていないか見えます。'
            : '届いたメッセージを貼ると、どの型の言い回しに当たるかが見えます。'}
        </p>
      </div>

      <div className="chips">
        <button className={`chip ${!draft ? 'on' : ''}`} onClick={() => onChangeMode('received')}>
          届いた文面
        </button>
        <button className={`chip ${draft ? 'on' : ''}`} onClick={() => onChangeMode('draft')}>
          自分が送る文面
        </button>
      </div>

      <div className="note">
        貼った文面は<strong>この端末の中だけ</strong>で調べます。送信も保存もしません（記録に残すと決めたときだけ、端末内に保存します）。
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        placeholder={
          draft
            ? '例）ここまでしてあげたのに、そんな言い方する？　今日会えないなら、もういいよ。'
            : '例）今日しかないから、もう一軒だけ行こうよ。終電もう無いし、うちで飲み直せばいいよ。'
        }
      />

      {personal.length > 0 && (
        <div className="note warn">
          個人情報らしきものが入っています（{personal.map((p) => `${p.label}${p.count}件`).join('・')}）。
          記録に残すときは
          {settings.keepRaw
            ? '設定で「そのまま残す」になっています。設定を見直せます。'
            : '自動で伏せます。'}
        </div>
      )}

      {result.status === 'short' && text.length > 0 && (
        <div className="card quiet">
          <p className="muted">
            短すぎて調べられません（{MIN_TEXT}文字以上）。短い文はたまたま当たるだけになるので、判定しないことにしています。
          </p>
        </div>
      )}

      {result.status === 'none' && (
        <div className="card quiet">
          <p>
            <strong>登録してある言い回しには当たりませんでした。</strong>
          </p>
          <p className="muted">
            当たらない＝問題がない、ではありません。見ているのは決まった言い回しだけで、
            言い方を変えられれば当たりません。
            <strong>読んで嫌な感じがしたことのほうが確かです。</strong>
          </p>
        </div>
      )}

      {result.status === 'ok' && (
        <>
          <h2>当たったところ</h2>
          <Rule mark={GLYPHS.star} />
          <div className="excerpt">
            {parts.map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}
          </div>

          <div className="note">
            {draft ? (
              <>
                当たった＝あなたが誰かを操っている、ではありません。同じ言葉はふつうの恋愛でも使います。
                ただ、<strong>相手が断りにくくなる形</strong>になっていないかを、送る前に一度見ておく価値はあります。
              </>
            ) : (
              <>
                当たった＝相手が悪い、ではありません。同じ言葉はふつうの恋愛でも使います。
                ここに出るのは<strong>言葉が一致したという事実だけ</strong>で、決めるのはあなたです。
              </>
            )}
          </div>

          <h2>{result.matches.length}件の型に当たりました</h2>
          {result.matches.map((m) => (
            <TacticCard
              key={m.tactic.id}
              tactic={m.tactic}
              cues={m.cues}
              open={openId === m.tactic.id}
              onToggle={() => setOpenId(openId === m.tactic.id ? '' : m.tactic.id)}
            />
          ))}

          {!draft && (
            <div className="card">
              <h3>記録に残す</h3>
              <p className="tiny">
                争うためではなく、あとから自分が迷わないために。相手の名前・連絡先は持ちません。
                {!settings.keepRaw && ' 本文の個人情報は自動で伏せます。'}
              </p>
              <div className="chips">
                {PLACES.map((p) => (
                  <button
                    key={p.id}
                    className={`chip ${placeId === p.id ? 'on' : ''}`}
                    onClick={() => setPlaceId(p.id)}
                  >
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
              <div className="row end">
                <button className="primary" onClick={save} disabled={saved}>
                  {saved ? '記録しました' : 'この端末に記録する'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {(result.status === 'ok' || result.status === 'none') && (
        <div className="card quiet">
          <p className="tiny" style={{ margin: 0 }}>
            なお、<strong>文面からは見つからない型が{unreadable.length}件</strong>あります（
            {unreadable.map((t) => t.name).join('・')}）。
            距離・席・沈黙・触れ方・連絡の間隔で効くもので、言葉として残らないので調べようがありません。
            「型」の一覧に見分け方を書いています。
          </p>
        </div>
      )}
    </>
  );
}
