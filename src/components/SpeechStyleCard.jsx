import { useState } from 'react';

// 音声学習の「読み上げ方の工夫」カードと、読みの一覧・書き出し（2026-11-23）。
// AudioMode.jsx は起動時に読む画面なので、ここは開いた時にだけ読み込む（起動時の束を増やさない）。
function Opt({ on, onToggle, title, desc }) {
  return (
    <button className={`opt-row ${on ? 'on' : ''}`} onClick={onToggle} type="button">
      <span className={`opt-switch ${on ? 'on' : ''}`}><span className="opt-knob" /></span>
      <span className="opt-main">
        <span className="opt-title">{title}</span>
        <span className="opt-desc">{desc}</span>
      </span>
    </button>
  );
}

export default function SpeechStyleCard({ speechStyle, setSpeechStyle, recommended, dictCount, onToast }) {
  return (
    <>
      {/* 読み上げ方の工夫（2026-11-23）：誤読の対策と、耳だけでも思い浮かべやすくする工夫 */}
      <div className="card">
        <div className="section-label" style={{ marginTop: 0 }}>🗣️ 読み上げ方の工夫</div>
        <div className="hint" style={{ marginBottom: 8 }}>
          画面の文字は変えず、声に出す時だけ読み方を整えます。
        </div>
        <div className="btn-row" style={{ marginBottom: 8 }}>
          <button className="btn sm" onClick={() => { setSpeechStyle(recommended); onToast?.('おすすめの読み上げ方をまとめてオンにしました'); }}>✨ おすすめをまとめてオン</button>
        </div>
        <Opt
          on={speechStyle.readFix}
          onToggle={() => setSpeechStyle({ readFix: !speechStyle.readFix })}
          title="🔤 誤読の対策（経穴の読み・記号・略語・単位）"
          desc={`経穴361穴・経絡・よく誤読される言葉の読み（今${dictCount}語）を使い、→ や 〜、①、Ⅲ型、ADL のような略語、mmHg などの単位、2〜3・1/2・○×を言葉に直して読みます。`}
        />
        <Opt on={!!speechStyle.homophoneMeridian} onToggle={() => setSpeechStyle({ homophoneMeridian: !speechStyle.homophoneMeridian })}
          title="🈁 同じ読みの経穴に経絡を添える" desc="少海・小海・照海（どれも「しょうかい」）のように同じ読みの経穴が出てきたら、「心経のしょうかい」「腎経のしょうかい」のように経絡を先に言います（文の中に経絡がもう書いてあれば言いません）。" />
        <Opt on={!!speechStyle.homophoneKanji} onToggle={() => setSpeechStyle({ homophoneKanji: !speechStyle.homophoneKanji })}
          title="🔤 同じ読みの経穴に字の説明を添える" desc="「少ないに、海」「照らすに、海」のように、どの字かを言葉で説明します（同じ経穴は1つの文につき最初の1回だけ）。" />
        <Opt on={!!speechStyle.homophoneLocation} onToggle={() => setSpeechStyle({ homophoneLocation: !speechStyle.homophoneLocation })}
          title="📍 同じ読みの経穴に場所を添える（サブ）" desc="「場所は肘前内側」のように、経穴カードの部位の最初の言葉を添えます。長くなるので必要な時だけオンにしてください。" />
        <Opt on={speechStyle.figureDesc} onToggle={() => setSpeechStyle({ figureDesc: !speechStyle.figureDesc })}
          title="🖼️ 図の説明を読む" desc="図のある問題は、図に描かれている内容を言葉で説明します（図に無いことは足しません）。" />
        <Opt on={!!speechStyle.kindLabel} onToggle={() => setSpeechStyle({ kindLabel: !speechStyle.kindLabel })}
          title="🏷️ 問題の種類を先に言う" desc="「誤っているものを選ぶ問題です」「場所を思い浮かべる問題です」「数字の問題です」など、何を考えればよいかを先に伝えます（はっきり分かる時だけ）。" />
        <Opt on={!!speechStyle.sentencePause} onToggle={() => setSpeechStyle({ sentencePause: !speechStyle.sentencePause })}
          title="⏸️ 長い解説は文ごとに区切る" desc="結論（正解）のあと、解説を1文ずつ区切って、間に少し間を入れます。" />
        <Opt on={!!speechStyle.bodyWords} onToggle={() => setSpeechStyle({ bodyWords: !speechStyle.bodyWords })}
          title="✋ 体の言葉をふだんの言い方で補う" desc="橈側は「親指がわ」、内果は「うちくるぶし」、示指は「人さし指」のように、教科書の言葉のあとに言い換えを添えます。" />
        <Opt on={!!speechStyle.sunNote} onToggle={() => setSpeechStyle({ sunNote: !speechStyle.sunNote })}
          title="📏 寸の目安を添える" desc="「◯寸」が出てきたら、1寸は親指の幅、1寸5分は指2本、3寸は指4本の幅、と添えます。" />
        <Opt on={!!speechStyle.meridianFlow} onToggle={() => setSpeechStyle({ meridianFlow: !speechStyle.meridianFlow })}
          title="🧭 経絡の流れを道順で言う" desc="肺経などが出てきたら「胸から手の指先へ流れます」のように、流れる向きを添えます。" />
        <Opt on={!!speechStyle.compareAfter} onToggle={() => setSpeechStyle({ compareAfter: !speechStyle.compareAfter })}
          title="⚖️ 似ているものとのちがいを続けて言う" desc="まぎらわしい対比のデータがある言葉なら、答えのあとに違いを読みます。" />
        <Opt on={!!speechStyle.numberFact} onToggle={() => setSpeechStyle({ numberFact: !speechStyle.numberFact })}
          title="🔢 数字の要点を続けて言う" desc="数値まとめのデータがある言葉なら、答えのあとに数字の要点を読みます。" />
        <Opt on={!!speechStyle.shortChoices} onToggle={() => setSpeechStyle({ shortChoices: !speechStyle.shortChoices })}
          title="✂️ 選択肢を短く読む" desc="選択肢を読む時、かっこの中の補足だけを外して読みます（言葉そのものは削りません）。" />
        <Opt on={!!speechStyle.directionPause} onToggle={() => setSpeechStyle({ directionPause: !speechStyle.directionPause })}
          title="↔️ 左右・上下・前後の前で一拍おく" desc="方向の言葉を聞き逃さないよう、前に短い間を入れます。" />
        <div className="hint" style={{ marginTop: 6 }}>
          答えの言葉を声でも強調するには「キーワードを声でも強調する」、新しい問題をゆっくり読むには「まだ解いていない新しい問題は等速で読む」をオンにしてください。
        </div>
      </div>
    </>
  );
}

export function ReadingDictTools({ readingDict, userFixes, onPreview, onImport, onToast }) {
  const [dictSearch, setDictSearch] = useState('');
  const [fixesIO, setFixesIO] = useState('');
  return (
    <>
      {/* 対策案12：アプリの読みの一覧（さがして・試しに聞ける） */}
      <details style={{ marginTop: 10 }}>
        <summary className="btn ghost sm" style={{ display: 'inline-block' }}>📚 アプリの読みの一覧（{readingDict.length}語）</summary>
        <input type="search" value={dictSearch} onChange={(e) => setDictSearch(e.target.value)}
          placeholder="言葉・読みでさがす（例：しょうかい）" aria-label="読みの一覧をさがす" style={{ width: '100%', marginTop: 8 }} />
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', maxHeight: 260, overflowY: 'auto' }}>
          {readingDict
            .filter(([t, r]) => !dictSearch.trim() || t.includes(dictSearch.trim()) || r.includes(dictSearch.trim()))
            .slice(0, 80)
            .map(([t, r]) => (
              <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                <span>{t} → {r}{userFixes[t] ? '（自分で登録）' : ''}</span>
                <button className="btn ghost sm" aria-label={`${t}を試しに聞く`}
                  onClick={() => onPreview(t)}>🔊</button>
              </li>
            ))}
        </ul>
      </details>
      {/* 対策案13：自分で登録した読みの書き出し・取り込み（別の端末・アプリ版へ持っていく） */}
      <details style={{ marginTop: 10 }}>
        <summary className="btn ghost sm" style={{ display: 'inline-block' }}>📤 自分の読みを書き出す・取り込む</summary>
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button className="btn sm" onClick={() => {
            const txt = JSON.stringify(userFixes || {});
            setFixesIO(txt);
            try { navigator.clipboard?.writeText(txt); onToast?.('コピーしました。別の端末で「取り込む」に貼り付けてください'); } catch (e) { onToast?.('下の欄の文字をコピーしてください'); }
          }}>書き出す（コピー）</button>
          <button className="btn sm" onClick={() => {
            let obj;
            try { obj = JSON.parse(fixesIO); } catch (e) { onToast?.('読み取れませんでした（書き出した文字をそのまま貼り付けてください）'); return; }
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { onToast?.('読み取れませんでした'); return; }
            const clean = {};
            for (const [k, v] of Object.entries(obj)) if (typeof k === 'string' && typeof v === 'string' && k.trim() && v.trim()) clean[k.trim()] = v.trim();
            const n = Object.keys(clean).length;
            if (!n) { onToast?.('取り込める読みがありませんでした'); return; }
            onImport(clean);
            onToast?.(`${n}語の読みを取り込みました（同じ言葉は取り込んだ方になります）`);
          }}>取り込む</button>
        </div>
        <textarea value={fixesIO} onChange={(e) => setFixesIO(e.target.value)} rows={3} aria-label="読みの書き出し・取り込み"
          style={{ width: '100%', marginTop: 8, boxSizing: 'border-box' }} placeholder='{"経穴":"けいけつ"}' />
      </details>
    </>
  );
}
