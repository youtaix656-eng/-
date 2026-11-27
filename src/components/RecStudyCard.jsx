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
  lastEyeAt, lastFullExamAt, onEye, secPerItem, measured, now = Date.now(),
}) {
  const hour = new Date(now).getHours();
  // 起きた時刻を入れていれば、時計ではなく「起きてから何時間か」で決める（夜勤・交代勤務向け）
  const sinceWake = rec.wakeTime ? rs.hoursSinceWake(rec.wakeTime, now) : null;
  const hint = (sinceWake != null && rs.slotForElapsed(sinceWake)) || rs.slotForHour(hour);
  const listenMin = Math.floor((day.listenSec || 0) / 60);
  const perQ = Math.round(secPerItem);
  const reviewOnly = !!day.reviewOnly;
  const recommended = reviewOnly && hint.slot === 'new' ? 'review' : hint.slot;
  const trackMin = Math.max(1, Math.round((secPerItem * rs.TRACK_SIZE) / 60));
  const eyeDays = lastEyeAt ? Math.floor((now - lastEyeAt) / DAY) : null;
  const fullDays = lastFullExamAt ? Math.floor((now - lastFullExamAt) / DAY) : null;
  // 日付は端末の日付の文字列どうしで比べる（Date.parse('YYYY-MM-DD') は UTC として読まれ、朝は前日になる）
  const ymd = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const weekAgo = ymd(now - 7 * DAY);
  const recentReviewOnly = (rec.reviewOnlyDays || []).filter((d) => d > weekAgo).length;
  const slotRows = [
    { id: 'weak', icon: '🧩', label: '苦手', ids: slots.weak, note: `△✕で入り、3回続けて○で外れます（${slots.weak.length}問）` },
    { id: 'box', icon: '📦', label: '箱の復習', ids: slots.boxDue.slice(0, rs.TRACK_SIZE), note: `今日の分 ${slots.boxDue.length}問。段ごとに速さと考える間が変わります（翌日＝等速・4秒 … 1か月後＝1.5倍・2秒）` },
    { id: 'review', icon: '🔁', label: '復習', ids: slots.reviewIds, note: `箱の日程で今日の分 ${slots.boxDue.length}問＋期限の来た復習` },
    { id: 'known', icon: '🛁', label: '何度も聞いた', ids: slots.known, note: '箱の3段目より先まで進んだ問題。入浴・家事の間に' },
    { id: 'new', icon: '🆕', label: '新しい', ids: slots.newIds, note: `${slots.newTheme ? `テーマ「${slots.newTheme}」・` : ''}今日 ${Math.min(rs.NEW_LISTENS_PER_DAY, day.newListens)} / ${rs.NEW_LISTENS_PER_DAY}回（同じ10問を1日3回・毎回並びを変える）${day.newListens >= rs.NEW_LISTENS_PER_DAY ? '。今日の3回は聞き終えました（もう一度聞いてもかまいません）' : ''}`, hidden: reviewOnly },
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
        問題のあとの無音の間に、毎回頭の中で答えましょう。何度も聞くと「知っている気がする」ようになりますが、それだけでは答えられるようにはなりません。わからなくても、思い出そうとすること自体に意味があります。
      </p>
      <p className="inline-note" style={{ marginTop: 0 }}>
        🕐 いまのおすすめ：{reviewOnly && hint.slot === 'new' ? '今日は復習だけの日なので復習から' : hint.label}
        （{sinceWake != null ? `起きてから約${Math.floor(sinceWake)}時間` : '時計の時刻で決めた目安です。起きた時刻を入れると、勤務に合わせて決めます'}）。
        1トラック{rs.TRACK_SIZE}問・約{trackMin}分（1問あたり約{perQ}秒{measured ? '・あなたの聞いたペースから' : ''}。目安は15〜30秒{perQ > 30 ? '：長めです。考える間や次の問題までの間を短くすると近づきます' : ''}）。
      </p>
      <p className="inline-note" style={{ marginTop: 0 }}>
        🎧 今日聞いた時間：約{listenMin}分（1日の合計の目安40〜50分を、1回5〜10分に分けて）
      </p>
      <label className="rec-opt-select" style={{ marginLeft: 0 }}>
        起きた時刻（夜勤・交代勤務の時に）：
        <input type="time" value={rec.wakeTime || ''} onChange={(e) => updateRec({ wakeTime: e.target.value })} />
        {rec.wakeTime && <button type="button" className="btn ghost sm" style={{ marginLeft: 6 }} onClick={() => updateRec({ wakeTime: '' })}>消す</button>}
      </label>
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
        <Toggle on={rec.qBeep} onChange={(v) => updateRec({ qBeep: v })} label="問題の前に効果音を鳴らす" desc="効果音→問題→無音→答え" />
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
        <Toggle on={rec.mixFormats} onChange={(v) => updateRec({ mixFormats: v })} label="同じ論点を別の形式でもう一度" desc="3問あとに穴埋め（正解の語が解説にある問題だけ）、さらに3問あとに同じ過去問から作った一問一答・○×" />
        <Toggle on={rec.twoPass} onChange={(v) => updateRec({ twoPass: v })} label="1回の中で2周" desc="1周目＝間5秒・等速まで、2周目＝間2.5秒・1.25倍。2周目の○△✕は記録しません" />
        <Toggle on={rec.reappear} onChange={(v) => updateRec({ reappear: v })} label="△✕の問題を3問あとにもう一度" />
        <Toggle on={rec.reappearAll} onChange={(v) => updateRec({ reappearAll: v })} label="全部の問題を3問あとにもう一度" desc="トラック内の再登場。2回目の○△✕は記録しません" />
        <Toggle on={rec.glossHomophone !== false} onChange={(v) => updateRec({ glossHomophone: v })} label="同じ読みの用語に意味を添える" desc="正気・精気・清気（どれも「せいき」）など。経穴の同じ読みは別の設定（読み上げの工夫）" />
        <Toggle on={rec.workLink} onChange={(v) => updateRec({ workLink: v })} label="仕事とつなげる一言" desc="答えのあとに「施術や仕事のどの場面で使うか」を思い浮かべる一言" />
        <Toggle on={rec.confidence} onChange={(v) => updateRec({ confidence: v })} label="自信の度合い（確実／たぶん／勘）" desc="たぶん・勘は当たっていても○にしません（たぶん＝△、勘＝✕）" />
        <Toggle on={rec.box} onChange={(v) => updateRec({ box: v })} label="箱方式の日程を記録する" desc={`${rs.BOX_STAGES.map((b) => `${b.label}（${b.rate}倍・${b.gap}秒）`).join('→')}。○で次へ、△は同じ間隔、✕は翌日へ戻す`} />
        <Toggle on={rec.weak} onChange={(v) => updateRec({ weak: v })} label="苦手トラックを記録する" />
        <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => updateRec({ safetyAck: false })}>聞く前の注意をもう一度表示する</button>
        <p className="inline-note">速さ・秒数・日数・回数は、元にした「録音学習 総まとめ」の目安で、アプリが確かめた基準ではありません。</p>
      </details>
    </div>
  );
}
