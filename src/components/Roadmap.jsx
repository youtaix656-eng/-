import { daysUntil, formatExamDate } from '../lib/gamify.js';

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

// フェーズ定義
const PHASES = [
  {
    no: '0', kind: '', title: '土台づくり・現状把握', when: '7/28〜8/10（2週）',
    focus: '全体像をつかみ、学習リズムと過去問の投入体制を整える。',
    mix: '新規多め',
    dos: ['試験日を登録して残り日数を表示', 'ミニ模試を1回受けて現在地を記録', '毎日机に向かう習慣づけ'],
    donts: ['いきなり全科目を完璧にしようとする', '教材選びに時間をかけすぎる'],
  },
  {
    no: '1', kind: '', title: '全範囲を1周（インプット）', when: '8/11〜9/30（約7週）',
    focus: '14科目すべてに一度は触れる。正答率は気にせず「わからない」を炙り出す。',
    mix: '新規7：復習3',
    dos: ['学習セッションで毎日80〜120問', 'カバー率100%を目標に全科目へ', '間違いは復習に自動回収（忘却曲線）'],
    donts: ['1科目に沈んで先へ進めない', '正答率の低さで落ち込む（今は当然）'],
  },
  {
    no: '2', kind: '', title: '弱点つぶし・2周目', when: '10/1〜10/31（約4.5週）',
    focus: '復習を前面に。○（完璧）5回連続でマスターしていく。模試で時間配分に慣れる。',
    mix: '新規5：復習5',
    dos: ['間違えた問題を毎日回す', '模試を隔週（ハーフ）', '分析で弱点科目を特定して集中'],
    donts: ['模試の点数に一喜一憂して復習を飛ばす', '得意科目ばかり解いて安心する'],
  },
  {
    no: '3', kind: 'goal', title: '仕上げ・合格ライン超え 🎯', when: '11/1〜11/30（約4週）',
    focus: 'ここが「11月末に合格実力」のゴール。復習比率を上げ、模試で6割を安定させる。',
    mix: '新規3：復習7',
    dos: ['合格ライン診断を毎週チェック', '模試を週1、間違いノートを作り始める', '6割超えを2回連続＝合格実力'],
    donts: ['まだ新しい参考書に手を出す', '苦手を見ないふりをする'],
  },
  {
    no: '4', kind: '', title: '維持・上積み（余裕をつくる）', when: '12/1〜1/31（約9週）',
    focus: '落とさない。毎日1科目ずつ回して7割で安定させる。数値・統計の最新化も。',
    mix: '復習中心（新規は残りの穴だけ）',
    dos: ['毎日1科目の総ざらいローテ', '音声（裏面のみ）で答えの総ざらい', '模試を週1（フル）で7割安定'],
    donts: ['「もう大丈夫」と気を抜いて間隔をあける', '新範囲を大量に増やす'],
  },
  {
    no: '直前3週', kind: 'chokuzen', title: '3週間前 ― 総仕上げ', when: '2/1〜2/7ごろ',
    focus: '全科目を素早く総ざらい。フル模試を週2で本番の時間割に体を慣らす。',
    mix: '新規ストップ／復習・総ざらい',
    dos: ['フル模試を週2で通し練習', '間違いノートを完成させる', '午前90＋午後90の時間配分を体感'],
    donts: ['新しい問題集・新範囲に手を出す', '夜更かしで生活リズムを崩す'],
  },
  {
    no: '直前2週', kind: 'chokuzen', title: '2週間前 ― △✕だけに絞る', when: '2/8〜2/21ごろ',
    focus: 'ここから新規は完全ストップ。△・✕（間違えた問題）だけに集中して穴を消す。',
    mix: '△✕（間違えた問題）だけ',
    dos: ['間違えた問題＋間違いノートだけを回す', '○×・数値・語呂の最終確認', '起床〜就寝を本番当日に合わせる'],
    donts: ['新規問題を解く（この時期は逆効果）', '未習の分野を焦って詰め込む'],
  },
  {
    no: '直前1週', kind: 'chokuzen', title: '1週間前 ― 確認とコンディション', when: '2/22〜2/27',
    focus: '覚え直しは最小限。できる問題を確実に。体調・持ち物・会場を固める。',
    mix: '△✕の最終確認のみ',
    dos: ['間違いノートを見返す（PDFで移動中も）', '会場・ホテル・持ち物・受験票を確認', '睡眠を最優先、朝型に'],
    donts: ['徹夜・詰め込み（忘却が早い）', '難問に深入りして自信を失う'],
  },
  {
    no: '前日', kind: 'final', title: '前日 ― 早寝・軽い見直し', when: '2/27（土）',
    focus: '新しいことはしない。軽く総ざらいして早く寝る。',
    mix: '眺める程度',
    dos: ['間違いノートをさっと1周', '持ち物を準備して早寝', 'カフェイン・食事を整える'],
    donts: ['夜遅くまで詰め込む', '不安で新しい範囲に手を出す'],
  },
  {
    no: '当日', kind: 'final', title: '当日 ― 実力を出し切る', when: '2/28（日）本番',
    focus: '朝食をとり、時間配分を意識して午前・午後を戦い抜く。',
    mix: '本番',
    dos: ['分かる問題から解く／マークミス確認', '午前午後とも見直しの時間を残す', '休憩でリセットして午後へ'],
    donts: ['1問に固執して時間を溶かす', '周りのペースに飲まれる'],
  },
];

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
      <p className="inline-note" style={{ marginTop: 0 }}>「1日の分量」は目安です。使える時間に合わせて調整を。</p>
      {PHASES.map((p) => (
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

      {/* 全期間 共通の心得 */}
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
