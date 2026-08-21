import { daysUntil, formatExamDate } from '../lib/gamify.js';
import { ROADMAP_PHASES, ROADMAP_MONTHS, phasesInMonth } from '../data/roadmapPhases.js';

const MONTH_LABEL = (year, month) => `${year}年${month + 1}月`;
const FMT_DAY = (dateStr) => {
  const [, mo, d] = dateStr.split('-');
  return `${Number(mo)}/${Number(d)}`;
};
// フェーズの日付範囲を、その月の中に収まる範囲だけに切り詰める
function clampToMonth(p, year, month) {
  const pad = (n) => String(n).padStart(2, '0');
  const first = `${year}-${pad(month + 1)}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const last = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
  return { s: p.start < first ? first : p.start, e: p.end > last ? last : p.end };
}

// 合格するためのロードマップ（本日→令和9年2月28日 本番）
// フェーズ・やること/NG・新規→△✕の切替時期・手が使えない時の音声学習を、図つきでまとめる。

// ---- 図（自作インラインSVG・テーマ配色） ----
function MountainSVG() {
  return (
    <svg viewBox="0 0 300 120" className="rm-hero-svg" aria-hidden="true">
      <defs>
        <linearGradient id="rmSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.25" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="300" height="120" fill="url(#rmSky)" />
      <path d="M0 110 L70 60 L110 82 L170 30 L210 66 L260 44 L300 78 L300 120 L0 120 Z"
        fill="var(--navy-light)" opacity="0.55" />
      <path d="M0 118 L60 86 L120 100 L180 66 L240 92 L300 70 L300 120 L0 120 Z"
        fill="var(--surface-2)" />
      {/* 登山ルート（点線） */}
      <path d="M18 112 C70 100 90 96 130 84 S200 52 250 38" fill="none"
        stroke="var(--text-sub)" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round" />
      {/* スタート地点 */}
      <circle cx="18" cy="112" r="5" fill="var(--accent)" />
      {/* 山頂の旗＝合格 */}
      <g transform="translate(250 22)">
        <line x1="0" y1="0" x2="0" y2="18" stroke="var(--text)" strokeWidth="2" />
        <path d="M0 1 L16 6 L0 12 Z" fill="var(--correct)" />
      </g>
    </svg>
  );
}

// 新規→復習→△✕ の切替を表す帯グラフ
function SwitchSVG() {
  const rows = [
    { label: '今〜11月末', neww: 62, rev: 38, tag: '新規メイン' },
    { label: '12月〜1月', neww: 22, rev: 78, tag: '復習中心' },
    { label: '2週間前〜本番', neww: 0, rev: 100, tag: '△✕だけ' },
  ];
  return (
    <div className="rm-switch">
      {rows.map((r) => (
        <div className="rm-switch-row" key={r.label}>
          <span className="rm-switch-lbl">{r.label}</span>
          <div className="rm-switch-bar">
            {r.neww > 0 && <span className="seg-new" style={{ width: `${r.neww}%` }}>{r.neww ? '新規' : ''}</span>}
            <span className="seg-rev" style={{ width: `${r.rev}%` }}>復習/△✕</span>
          </div>
          <span className="rm-switch-tag">{r.tag}</span>
        </div>
      ))}
    </div>
  );
}

function HeadphoneSVG() {
  return (
    <svg viewBox="0 0 64 64" className="rm-audio-svg" aria-hidden="true">
      <path d="M14 38 v-4 a18 18 0 0 1 36 0 v4" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <rect x="10" y="36" width="10" height="16" rx="4" fill="var(--accent)" />
      <rect x="44" y="36" width="10" height="16" rx="4" fill="var(--accent)" />
      <g stroke="var(--correct)" strokeWidth="2.4" strokeLinecap="round">
        <path d="M56 30 q5 6 0 12" fill="none" opacity="0.8" />
        <path d="M60 26 q8 10 0 20" fill="none" opacity="0.5" />
      </g>
    </svg>
  );
}

export default function Roadmap({ store, onNavigate }) {
  const examDate = store.settings.examDate;
  const left = daysUntil(examDate);

  return (
    <div className="view rm">
      {/* ヒーロー */}
      <div className="rm-hero">
        <MountainSVG />
        <div className="rm-hero-text">
          <h2>合格するためのロードマップ</h2>
          {left != null && left >= 0 ? (
            <p>本番（{formatExamDate(examDate)}）まで <strong>残り{left}日</strong>。今日の一歩が合格につながります。</p>
          ) : (
            <p>
              まず<button className="rm-link" onClick={() => onNavigate('settings')}>設定→試験日</button>に「2027/02/28」を登録しましょう。残り日数が毎日効きます。
            </p>
          )}
        </div>
      </div>

      {/* 新規→△✕ の切替 */}
      <div className="section-label">🔀 新規はいつまで？ いつから△✕に絞る？</div>
      <div className="card">
        <SwitchSVG />
        <ul className="rm-rule">
          <li><b>新規（まだ解いてない問題）</b>を解くのは <b>8月〜11月末まで</b>。ここで全範囲を1周＋穴埋めします。</li>
          <li><b>12月〜1月</b>は新規を「残った穴だけ」に減らし、<b>復習中心</b>に。</li>
          <li><b>2週間前（2月中旬）からは新規を完全ストップ</b>。<b>△・✕（間違えた問題）だけ</b>に絞って穴を消します。</li>
        </ul>
        <div className="rm-jump">
          <button className="btn ghost sm" onClick={() => onNavigate('session')}>📚 学習（割合を設定）</button>
          <button className="btn ghost sm" onClick={() => onNavigate('review')}>🔁 間違えた問題</button>
        </div>
      </div>

      {/* フェーズ */}
      <div className="section-label">🗓️ フェーズ別カレンダー</div>
      <p className="inline-note" style={{ marginTop: 0 }}>
        「1日の分量」は目安です。使える時間に合わせて調整を。
        <button className="rm-link" onClick={() => onNavigate('calendar')} style={{ marginLeft: 6 }}>
          📅 カレンダーで予定に落とし込む →
        </button>
      </p>
      {ROADMAP_PHASES.map((p) => (
        <div className={`rm-phase ${p.kind}`} key={p.no}>
          <div className="rm-phase-top">
            <span className="rm-phase-no">{p.no}</span>
            <span className="rm-phase-title">{p.title}</span>
            <span className="rm-phase-when">{p.when}</span>
          </div>
          <div className="rm-phase-focus">{p.focus}</div>
          <div className="rm-mix">配分：<b>{p.mix}</b></div>
          <div className="rm-dd">
            <div className="rm-do">
              <div className="rm-dd-h">✅ やること</div>
              <ul>{p.dos.map((d, i) => <li key={i}>{d}</li>)}</ul>
            </div>
            <div className="rm-dont">
              <div className="rm-dd-h">🚫 やってはいけない</div>
              <ul>{p.donts.map((d, i) => <li key={i}>{d}</li>)}</ul>
            </div>
          </div>
        </div>
      ))}

      {/* 月別スケジュール（8月〜2月）。上のフェーズ別カードと同じ内容を、カレンダーの月単位で見られるようにしたもの。 */}
      <div className="section-label">📅 月別スケジュール（8月〜2月）</div>
      <p className="inline-note" style={{ marginTop: 0 }}>
        フェーズ別カード（上）と同じ内容を月ごとにまとめたものです。
        <button className="rm-link" onClick={() => onNavigate('calendar')} style={{ marginLeft: 6 }}>
          📅 カレンダーで見る →
        </button>
      </p>
      {ROADMAP_MONTHS.map(({ year, month }) => {
        const phases = phasesInMonth(year, month);
        return (
          <div className="card rm-month" key={`${year}-${month}`}>
            <div className="rm-month-title">{MONTH_LABEL(year, month)}</div>
            {phases.map((p) => {
              const { s, e } = clampToMonth(p, year, month);
              return (
                <div className="rm-month-phase" key={p.id}>
                  <span className="rm-month-dot" style={{ background: p.color }} />
                  <span className="rm-month-range">{FMT_DAY(s)}{s !== e ? `〜${FMT_DAY(e)}` : ''}</span>
                  <span className="rm-month-label">{p.label}</span>
                  <span className="rm-month-mix">{p.mix}</span>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* 全期間 共通の心得 */}
      <div className="section-label">🧠 なぜこの方法が効くのか（科学的根拠）</div>
      <details className="card">
        <summary style={{ fontWeight: 700, cursor: 'pointer' }}>
          「読む」より「解く」、詰め込みより間隔をあけた復習が効く理由
        </summary>
        <div style={{ marginTop: 12 }}>
          <p>
            <b>①解く（検索練習）が読むより効く：テスト効果</b><br />
            記憶は「思い出そうとする」という行為そのもので強化されます（検索誘発性強化）。ただ読むだけだと
            "わかった気になる"錯覚（流暢性の錯覚）が起きやすく、実際の定着とは別物です。Roediger &amp; Karpicke（2006）の
            実験でも、同じ時間なら読み返すより思い出す練習をしたグループの方が1週間後の成績が高くなりました。
            → <b>一問一答は「解く→裏で解説」の1セット</b>なので、これ自体が検索練習になっています。
          </p>
          <p>
            <b>②今すぐ完璧を狙わなくていい：望ましい困難</b><br />
            Bjork（UCLA）の提唱する考え方で、学習中に「ちょっと苦労する」状態の方が、後々の記憶保持率が高くなります。
            間違えた問題をその場ですぐ完璧に理解しようとせず、時間を空けてもう一度思い出す機会を作る方が理にかなっています。
          </p>
          <p>
            <b>③間隔をあけて繰り返すと定着する：間隔効果</b><br />
            記憶はEbbinghausの忘却曲線通り時間とともに薄れますが、忘れかけたタイミングで思い出すと
            再固定化（reconsolidation）という過程を経て、前より強く保持されます。同じ日に詰め込むより、
            日をまたいで間隔をあけた方が最終的な定着率が高いことが多数の研究で確認されています。
            → <b>SRS（間隔反復）はこの効果を自動計算</b>して、忘れる直前のタイミングで復習に出しています。
          </p>
          <p style={{ marginBottom: 0 }}>
            <b>④睡眠が記憶を定着させる</b><br />
            学習した内容は睡眠中（特に深いノンレム睡眠）に海馬から大脳皮質へ転写され、長期記憶として定着すると
            考えられています。夜遅くまで新規問題を詰め込むより、ある程度で切り上げて眠る方が、その日解いた分の定着には有利です。
          </p>
        </div>
      </details>

      <div className="section-label">🎓 レベル別：問題演習の進め方</div>
      <details className="card">
        <summary style={{ fontWeight: 700, cursor: 'pointer' }}>
          初級者・中級者・上級者で、使う機能をどう変えるか
        </summary>
        <div style={{ marginTop: 12 }}>
          <p className="inline-note" style={{ marginTop: 0 }}>
            レベルが上がるほど「広く浅く」から「狭く深く」に絞っていくのが基本です。
          </p>

          <div style={{ marginTop: 14 }}>
            <b>🔰 初級者（まだ全体像がない・正答率が低い時期）</b>
            <div className="inline-note" style={{ marginTop: 2, marginBottom: 4 }}>目的：広く浅く「知ってる/知らない」を仕分ける</div>
            <ul style={{ marginTop: 4 }}>
              <li><button className="rm-link" onClick={() => onNavigate('quiz')}>一問一答</button>：科目・ジャンル絞り込みなし「すべて」から手当たり次第に</li>
              <li><button className="rm-link" onClick={() => onNavigate('audio')}>⚡高速回転モード</button>（音声学習内）：3秒想起→答え、をサクサク周回</li>
              <li><button className="rm-link" onClick={() => onNavigate('toc')}>目次</button>／<button className="rm-link" onClick={() => onNavigate('mindmap')}>マインドマップ</button>：知らない科目だけ10分ほど眺めて地図を掴む</li>
              <li><button className="rm-link" onClick={() => onNavigate('flashcards')}>フラッシュカード</button>：経穴など視覚的に覚えやすいものから</li>
              <li><button className="rm-link" onClick={() => onNavigate('coverage')}>網羅マップ</button>：手つかずの科目を把握するだけでOK（今埋めようとしなくていい）</li>
              <li>誤答理由の分析やリーチ管理はまだ気にしなくていい。間違いだらけで当然の時期</li>
            </ul>
          </div>

          <div style={{ marginTop: 14 }}>
            <b>📘 中級者（正答率が上がり、間違いパターンが見えてきた時期）</b>
            <div className="inline-note" style={{ marginTop: 2, marginBottom: 4 }}>目的：弱点を可視化して、そこだけ繰り返す</div>
            <ul style={{ marginTop: 4 }}>
              <li><button className="rm-link" onClick={() => onNavigate('review')}>復習</button>が主戦場に。SRSが出す問題を優先的に解く</li>
              <li>誤答理由（勘違い／知識不足／ケアレス）を記録し始める → 弱点パターンが見えてくる</li>
              <li>リーチ（8回誤答）バッジの付いた問題を意識的に潰す</li>
              <li><button className="rm-link" onClick={() => onNavigate('dashboard')}>弱点分析</button>／<button className="rm-link" onClick={() => onNavigate('analytics')}>分析</button>：弱点クラスタ・忘却予測でテーマを把握</li>
              <li><button className="rm-link" onClick={() => onNavigate('mindmap')}>まぎらわしい対比</button>で紛らわしい選択肢を集中的に潰す</li>
              <li><button className="rm-link" onClick={() => onNavigate('choicequiz')}>4択問題</button>で本番形式（選択肢を選ぶ）に慣れる</li>
              <li><button className="rm-link" onClick={() => onNavigate('connect')}>連結学習</button>で知識を「点」から「線」につなぐ</li>
              <li>「今日のおすすめ」バナーに従い、新規:復習の比率を自動調整に任せる</li>
              <li><button className="rm-link" onClick={() => onNavigate('session')}>学習（3分の2バッファ術）</button>で時間を計画的に配分（基礎2:バッファ1）</li>
            </ul>
          </div>

          <div style={{ marginTop: 14, marginBottom: 0 }}>
            <b>🎯 上級者（合格前提・直前期）</b>
            <div className="inline-note" style={{ marginTop: 2, marginBottom: 4 }}>目的：本番シミュレーションと穴の最終確認</div>
            <ul style={{ marginTop: 4, marginBottom: 0 }}>
              <li><button className="rm-link" onClick={() => onNavigate('exam')}>模試（午前/午後）</button>：本番同形式・時間制限ありを週1で</li>
              <li><button className="rm-link" onClick={() => onNavigate('exam')}>模試「苦手な問題」</button>：正答率データから自動抽出された弱点だけに演習</li>
              <li><button className="rm-link" onClick={() => onNavigate('exam')}>模試「選択式」</button>：科目・ジャンル・キーワードでピンポイント演習</li>
              <li><button className="rm-link" onClick={() => onNavigate('analytics')}>分析・攻略率・合格診断</button>：合格ラインまでの距離を定期チェック</li>
              <li>復習は<button className="rm-link" onClick={() => onNavigate('review')}>△✕（間違えた問題）</button>だけに絞る（新規はストップ）</li>
              <li><button className="rm-link" onClick={() => onNavigate('pasttrends')}>鍼灸過去問題の傾向と対策</button>：頻出テーマ・キーワードの最終チェック</li>
              <li><button className="rm-link" onClick={() => onNavigate('numbers')}>数値の棚卸し</button>：毎年変わる統計数値の最終確認</li>
              <li><button className="rm-link" onClick={() => onNavigate('coverage')}>網羅マップ</button>：手薄科目が残っていないか最終確認</li>
              <li><button className="rm-link" onClick={() => onNavigate('audio')}>音声学習「今日の連結」「弱点読み」</button>：スキマ時間も総仕上げに</li>
            </ul>
          </div>
        </div>
      </details>

      <div className="section-label">🧭 全期間つらぬく心得</div>
      <div className="rm-dd card">
        <div className="rm-do">
          <div className="rm-dd-h">✅ やること</div>
          <ul>
            <li>毎日必ず少しでも触れる（連続日数を切らさない）</li>
            <li>間違いは忘却曲線に任せ、○5回連続でマスターまで回す</li>
            <li>週1で模試＋分析。予想得点率の伸びを見る</li>
            <li>睡眠・生活リズムを一定に保つ</li>
          </ul>
        </div>
        <div className="rm-dont">
          <div className="rm-dd-h">🚫 やってはいけない</div>
          <ul>
            <li>直前に新しい教材・新範囲へ手を出す</li>
            <li>完璧主義で1科目に沈む（全体を回す）</li>
            <li>点数に一喜一憂して復習を飛ばす</li>
            <li>一夜漬け・詰め込み（すぐ忘れる）</li>
          </ul>
        </div>
      </div>

      {/* 手が使えない時の音声学習 */}
      <div className="section-label">🎧 手が使えない時の音声学習（仕事・移動・家事）</div>
      <div className="card rm-audio">
        <div className="rm-audio-head">
          <HeadphoneSVG />
          <p>手がふさがっていても「耳」で学べます。<b>問題→頭で想起→答え</b>を音声で回します。</p>
        </div>
        <div className="rm-scenes">
          <div className="rm-scene"><b>🚃 通勤・運転中</b><span>「表面のみ（問題だけ）」で流し、頭の中で答える → 信号待ち等で「裏面のみ（答え）」で答え合わせ。ハンズフリーで自己テスト。</span></div>
          <div className="rm-scene"><b>🏢 仕事の休憩・移動</b><span>連結モード「数値まとめ読み」「比較・対比読み」で、覚えにくい数字と紛らわしい語を耳から。</span></div>
          <div className="rm-scene"><b>🧹 家事・入浴</b><span>「章（カテゴリ）通し読み」で範囲を俯瞰。速度は1.2〜1.5倍で回転数アップ。</span></div>
          <div className="rm-scene"><b>🌙 寝る前</b><span>スリープタイマー10分で流し聞き。就寝前は記憶が定着しやすい。</span></div>
          <div className="rm-scene"><b>☀️ 朝の支度</b><span>昨日の「間違えた問題」を音声で復習（裏面のみ）。1日の始めに弱点を1回転。</span></div>
        </div>
        <div className="rm-audio-note">
          再生中は<b>ロック画面・通知のプレーヤー</b>で停止・前へ/次へを操作できます。
          ※ 端末を完全にバックグラウンド化・画面OFFにするとOSの仕様で読み上げが止まることがあります。アプリを前面に／画面をつけたままが確実です。
        </div>
        <div className="rm-jump">
          <button className="btn primary sm" onClick={() => onNavigate('audio')}>🎧 音声学習をひらく</button>
        </div>
      </div>

      {/* 今日の一歩 */}
      <div className="section-label">👣 今日の一歩</div>
      <div className="card rm-today">
        <ol>
          <li><button className="rm-link" onClick={() => onNavigate('settings')}>設定→試験日</button>に「2027/02/28」を登録＋朝のリマインドON</li>
          <li><button className="rm-link" onClick={() => onNavigate('exam')}>模擬試験</button>でミニ模試を1回（現在地の記録）</li>
          <li><button className="rm-link" onClick={() => onNavigate('session')}>学習</button>を今日の分だけスタート（まずは40問）</li>
        </ol>
      </div>

      <p className="inline-note" style={{ marginTop: 14 }}>
        ※ 合格ラインは例年おおむね総得点の6割。本計画は「11月末に6割・本番前に7割」を目安に、余裕をもって合格ラインを超える設計です。数値問題は年度で変わるため直前に最新値を確認します。
      </p>
    </div>
  );
}
