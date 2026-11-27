// 録音学習の型（2026-11-27）：今日の再生リスト・安全の注意・目で解く日の案内・設定。
// 音声学習の画面（AudioMode.jsx）は起動時に読む画面なので、画面の部品はここへ分けて後から読む。
import * as rs from '../lib/recStudy.js';

const DAY = 24 * 60 * 60 * 1000;

function Toggle({ on, onChange, label, desc }) {
  return (
    <label className="rec-opt">
      <input type="checkbox" checked={!!on} onChange={(e) => onChange(e.target.checked)} />
      <span><strong>{label}</strong>{desc ? <span className="rec-opt-desc">{desc}</span> : null}</span>
    </label>
  );
}

export default function RecStudyCard({
  rec, updateRec, voices, mainVoiceURI, slots, day, onStart, onReviewOnly,
  lastEyeAt, lastFullExamAt, onEye, secPerItem, now = Date.now(),
}) {
  const hour = new Date(now).getHours();
  const hint = rs.slotForHour(hour);
  const reviewOnly = !!day.reviewOnly;
  const recommended = reviewOnly && hint.slot === 'new' ? 'review' : hint.slot;
  const trackMin = Math.max(1, Math.round((secPerItem * rs.TRACK_SIZE) / 60));
  const eyeDays = lastEyeAt ? Math.floor((now - lastEyeAt) / DAY) : null;
  const fullDays = lastFullExamAt ? Math.floor((now - lastFullExamAt) / DAY) : null;
  const recentReviewOnly = (rec.reviewOnlyDays || []).filter((d) => Date.parse(d) > now - 7 * DAY).length;
  const slotRows = [
    { id: 'weak', icon: '🧩', label: '苦手', ids: slots.weak, note: `△✕で入り、3回続けて○で外れます（${slots.weak.length}問）` },
    { id: 'review', icon: '🔁', label: '復習', ids: slots.reviewIds, note: `箱の日程で今日の分 ${slots.boxDue.length}問＋期限の来た復習` },
    { id: 'new', icon: '🆕', label: '新しい', ids: slots.newIds, note: `今日 ${Math.min(rs.NEW_LISTENS_PER_DAY, day.newListens)} / ${rs.NEW_LISTENS_PER_DAY}回（同じ10問を1日3回）`, hidden: reviewOnly },
  ].sort((a, b) => (a.id === recommended ? -1 : b.id === recommended ? 1 : 0));

  return (
    <div className="card rec-card" style={{ marginBottom: 12 }}>
      {!rec.safetyAck && (
        <div className="rec-safety" role="note">
          <strong>⚠️ 聞く前に</strong>
          <ul>
            <li>運転中・ライン作業中は聞かない（職場のイヤホンのルールも確認）</li>
            <li>耳を休め、音量は小さめに</li>
            <li>寝る前はスリープタイマーで止める。眠りが浅くなるならやめる</li>
          </ul>
          <button className="btn sm" onClick={() => updateRec({ safetyAck: true })}>確認しました</button>
        </div>
      )}

      <h3 style={{ margin: '4px 0' }}>📼 今日の再生リスト</h3>
      <p className="inline-note" style={{ marginTop: 0 }}>
        🕐 いまのおすすめ：{reviewOnly && hint.slot === 'new' ? '今日は復習だけの日なので復習から' : hint.label}
        （時間帯は目安です。勤務に合わせて選んでください）。1トラック{rs.TRACK_SIZE}問・約{trackMin}分。
      </p>
      <div className="rec-slots">
        {slotRows.filter((r) => !r.hidden).map((r) => (
          <button key={r.id} className={`btn block rec-slot${r.id === recommended ? ' accent' : ''}`} disabled={!r.ids.length} onClick={() => onStart(r.id)}>
            <span className="rec-slot-main">{r.icon} {r.label}（{r.ids.length}問）{r.id === recommended ? '・おすすめ' : ''}</span>
            <span className="rec-slot-sub">{r.ids.length ? r.note : 'まだ入る問題がありません'}</span>
          </button>
        ))}
      </div>
      <div className="btn-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        <button className={`btn sm${reviewOnly ? ' accent' : ''}`} onClick={() => onReviewOnly(!reviewOnly)}>
          {reviewOnly ? '✓ 今日は復習だけの日（解除する）' : '😮‍💨 今日は復習だけにする（疲れた日・週1〜2日）'}
        </button>
      </div>
      {!reviewOnly && recentReviewOnly === 0 && (
        <p className="inline-note">この1週間、復習だけの日がまだありません。週に1〜2日は新しい問題を出さない日にすると定着しやすい、とされています。</p>
      )}

      {(eyeDays == null || eyeDays >= 7) && (
        <div className="rec-eye">
          <p className="inline-note" style={{ marginTop: 0 }}>
            👀 {eyeDays == null ? '目で解いた記録がまだありません。' : `目で解いてから${eyeDays}日たちました。`}
            音声だけだと、選択肢を見比べる力が育ちにくいので、週に1回は文字で解く日を作りましょう。
            {fullDays == null || fullDays >= 30 ? '月に1回は本番形式の模試で一気に解くのもおすすめです。' : ''}
          </p>
          <div className="btn-row" style={{ flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={() => onEye('session')}>📝 学習（文字）で解く</button>
            <button className="btn sm" onClick={() => onEye('exam')}>📋 模試を開く</button>
          </div>
        </div>
      )}

      <details className="rec-settings" style={{ marginTop: 8 }}>
        <summary>🔧 録音学習の型の設定</summary>
        <Toggle on={rec.themeIntro} onChange={(v) => updateRec({ themeIntro: v })} label="最初にテーマと問題数を言う" desc="「解剖学。10問です。」" />
        <Toggle on={rec.answerVoice} onChange={(v) => updateRec({ answerVoice: v })} label="答えを別の声で読む（声B）" desc="問題＝いつもの声、答え・解説＝別の声。声が1つしか無い端末では高さを変えます。ボイスクローン使用中は効きません" />
        {rec.answerVoice && (
          <label className="rec-opt-select">
            答えの声：
            <select value={rec.answerVoiceURI || ''} onChange={(e) => updateRec({ answerVoiceURI: e.target.value })}>
              <option value="">同じ声で高さを変える</option>
              {voices.filter((v) => v.voiceURI !== mainVoiceURI).map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
            </select>
          </label>
        )}
        <Toggle on={rec.answerTwice} onChange={(v) => updateRec({ answerTwice: v })} label="一問一答は答えを2回読む" desc="数字が入る答えは3回" />
        <Toggle on={rec.oxCorrect} onChange={(v) => updateRec({ oxCorrect: v })} label="○×で✕の時は正しい内容まで言う" />
        <Toggle on={rec.number3} onChange={(v) => updateRec({ number3: v })} label="数値は3回読む" />
        <Toggle on={rec.beepCloze} onChange={(v) => updateRec({ beepCloze: v })} label="穴埋めは本物の「ピー」音で伏せる" />
        <Toggle on={rec.compareIppou} onChange={(v) => updateRec({ compareIppou: v })} label="比較は「一方」で区切る" />
        <Toggle on={rec.earChoices} onChange={(v) => updateRec({ earChoices: v })} label="耳用の四択（選択肢を2回読む）" desc="四択のうち5問に1問（全体の2割まで）" />
        <Toggle on={rec.mixFormats} onChange={(v) => updateRec({ mixFormats: v })} label="同じ論点を穴埋めでもう一度" desc="問題の3問あとに同じ所を穴埋めで（正解の語が解説にある問題だけ）" />
        <Toggle on={rec.twoPass} onChange={(v) => updateRec({ twoPass: v })} label="1回の中で2周" desc="1周目＝間5秒・等速まで、2周目＝間2.5秒・1.25倍。2周目の○△✕は記録しません" />
        <Toggle on={rec.reappear} onChange={(v) => updateRec({ reappear: v })} label="△✕の問題を3問あとにもう一度" />
        <Toggle on={rec.confidence} onChange={(v) => updateRec({ confidence: v })} label="自信の度合い（確実／たぶん／勘）" desc="たぶん・勘は当たっていても○にしません（たぶん＝△、勘＝✕）" />
        <Toggle on={rec.box} onChange={(v) => updateRec({ box: v })} label="箱方式の日程を記録する" desc={`${rs.BOX_STAGES.map((b) => `${b.label}（${b.rate}倍・${b.gap}秒）`).join('→')}。○で次へ、△は同じ間隔、✕は翌日へ戻す`} />
        <Toggle on={rec.weak} onChange={(v) => updateRec({ weak: v })} label="苦手トラックを記録する" />
        <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => updateRec({ safetyAck: false })}>聞く前の注意をもう一度表示する</button>
        <p className="inline-note">速さ・秒数・日数・回数は、元にした「録音学習 総まとめ」の目安で、アプリが確かめた基準ではありません。</p>
      </details>
    </div>
  );
}
