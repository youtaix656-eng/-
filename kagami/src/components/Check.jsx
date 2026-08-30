import React, { useEffect, useMemo, useState } from 'react';
import { TACTICS, behaviorTactics } from '../data/tactics.js';
import { detectTactics, splitByHighlight, MIN_TEXT } from '../lib/detect.js';
import { summarizePersonal, mask } from '../lib/privacy.js';
import { PLACES, TEXT_MAX } from '../lib/records.js';
import { GLYPHS } from '../data/glyphs.js';
import { EyeSigil, Rule } from './Ornament.jsx';
import TacticCard from './TacticCard.jsx';

/**
 * 貼って調べる画面。
 * mode:
 *   'received' … 言われた側（既定）
 *   'draft'    … 自分が書いたものを見る（項目77の線。使う癖は人に向く癖になる）
 */
export default function Check({
  mode = 'received', onChangeMode, onSave, settings, ui = {}, onGoSettings, onGoTactic, records = [],
}) {
  // 画面を移っても、貼った本文を捨てない（端末には保存しない。開いている間だけ）
  const kept = ui.check || (ui.check = {});
  const [text, setText] = useState(() => kept.text || '');
  const [openId, setOpenId] = useState('');
  const [placeId, setPlaceId] = useState(() => kept.placeId || 'other');
  // **記録したことも覚えておく。** 画面を移って戻るとボタンが戻り、
  // 同じ本文をもう一度記録できてしまっていた（同じものが2件並ぶ）。
  const [savedText, setSavedText] = useState(() => kept.savedText || '');
  useEffect(() => {
    kept.text = text;
    kept.placeId = placeId;
    kept.savedText = savedText;
  }, [kept, text, placeId, savedText]);

  // 端末に同じ本文の記録が既にあるか（伏せ字にしてから比べる）
  const already = useMemo(
    () => records.some((r) => r.text && r.text.slice(0, 60) === mask(text).slice(0, 60) && text.trim()),
    [records, text],
  );
  const saved = savedText === text && !!text;

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
    setSavedText(text);
  }

  return (
    <>
      <div className="head">
        <EyeSigil size={70} className="sigil" />
        <h1>{draft ? '自分の言い方を見る' : '貼って調べる'}</h1>
        <p>
          {draft
            ? 'これから送る文章を貼ると、操作の型に当たる言い回しが入っていないか見えます。'
            : '言われた言葉・届いたメッセージを貼ると、どの型の言い回しに当たるかが見えます。'}
        </p>
      </div>

      <div className="chips">
        <button className={`chip ${!draft ? 'on' : ''}`} onClick={() => onChangeMode('received')}>
          言われた側
        </button>
        <button className={`chip ${draft ? 'on' : ''}`} onClick={() => onChangeMode('draft')}>
          自分が書いた側
        </button>
      </div>

      <div className="note">
        貼った文面は<strong>この端末の中だけ</strong>で調べます。送信も保存もしません（記録に残すと決めたときだけ、端末内に保存します）。
      </div>

      <textarea
        value={text}
        aria-label={draft ? 'これから送る文章' : '言われた言葉'}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          draft
            ? '例）前にやると言っていましたよね。他の人はできているのに。'
            : '例）今日中に決めていただかないと、この枠は埋まってしまいます。皆さんやっていますよ。'
        }
      />

      {personal.length > 0 && (
        <div className="note warn">
          個人情報らしきものが入っています（{personal.map((p) => `${p.label}${p.count}件`).join('・')}）。
          記録に残すときは{settings.keepRaw ? '設定で「そのまま残す」になっています。' : '自動で伏せます。'}
          {settings.keepRaw && onGoSettings && (
            <button className="chip" style={{ marginLeft: 8 }} onClick={onGoSettings}>
              設定を見直す
            </button>
          )}
        </div>
      )}

      {result.status === 'short' && text.length > 0 && (
        <div className="card quiet">
          <p className="muted">
            短すぎて調べられません。空白を除いて{MIN_TEXT}文字以上でお願いします
            （いまは{result.length}文字ぶんとして数えています）。
            短い文はたまたま当たるだけになるので、判定しないことにしています。
          </p>
          <p className="tiny">言われたことが一言だけなら、型の一覧から近いものを探すほうが早いことがあります。</p>
        </div>
      )}

      {result.status === 'none' && (
        <div className="card quiet">
          <p>
            <strong>登録してある言い回しには当たりませんでした。</strong>
          </p>
          <p className="muted">
            当たらない＝問題がない、ではありません。このアプリが見ているのは決まった言い回しだけで、
            言い方を変えられれば当たりません。<strong>読んで嫌な感じがしたことのほうが確かです。</strong>
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
                当たった＝あなたが誰かを操っている、ではありません。同じ言葉はふつうの会話でも使います。
                ただ、<strong>相手が断りにくくなる形</strong>になっていないかを、送る前に一度見ておく価値はあります。
              </>
            ) : (
              <>
                当たった＝相手が悪い、ではありません。同じ言葉はふつうの会話でも使います。
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
              onGoTactic={onGoTactic}
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
                    onClick={() => {
                      setPlaceId(p.id);
                      setSavedText(''); // 場面を選び直したら記録し直せる
                    }}
                  >
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
              {text.length > TEXT_MAX && (
                <p className="tiny">
                  {GLYPHS.reference} 長いので、記録に残すのは先頭の{TEXT_MAX}文字までです
                  （いまは{text.length}文字）。調べるほうは全文で見ています。
                </p>
              )}
              {already && !saved && (
                <p className="tiny">
                  {GLYPHS.reference} 同じ書き出しの記録がすでにあります。二重に残す必要が
                  なければ、そのままで大丈夫です。
                </p>
              )}
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
            間・目線・動く速さ・会う回数で効くもので、言葉として残らないので調べようがありません。
            「型」の一覧に見分け方を書いています。
          </p>
        </div>
      )}

    </>
  );
}
