// 図問題・フラッシュカード用のインライン図（SVG）レジストリ。
// 外部画像に依存せず、オフラインでも表示できる軽量な模式図。
// キー → React コンポーネント。QuestionCard は question.figure（キー）で参照する。

// 共通の枠。responsive（幅100%・最大300px）。
function Frame({ title, children, viewBox = '0 0 240 200' }) {
  return (
    <figure className="q-figure">
      <svg viewBox={viewBox} role="img" aria-label={title} preserveAspectRatio="xMidYMid meet">
        {children}
      </svg>
      {title && <figcaption>{title}</figcaption>}
    </figure>
  );
}

// 脊柱の区分（頸・胸・腰・仙・尾）。A〜Eのラベルで参照する模式図。
function Spine() {
  const seg = (y, h, fill, label) => (
    <g key={label}>
      <rect x="95" y={y} width="50" height={h} rx="6" fill={fill} stroke="#334155" strokeWidth="1.5" />
      <text x="120" y={y + h / 2 + 4} textAnchor="middle" fontSize="13" fontWeight="700" fill="#0f172a">{label}</text>
    </g>
  );
  return (
    <Frame title="脊柱の区分" viewBox="0 0 240 210">
      <text x="120" y="16" textAnchor="middle" fontSize="11" fill="#64748b">上（頭側）</text>
      {seg(24, 26, '#fde68a', 'A')}
      {seg(52, 46, '#fca5a5', 'B')}
      {seg(100, 30, '#93c5fd', 'C')}
      {seg(132, 22, '#a7f3d0', 'D')}
      {seg(156, 16, '#e2e8f0', 'E')}
      <text x="120" y="192" textAnchor="middle" fontSize="11" fill="#64748b">下（尾側）</text>
    </Frame>
  );
}

// 心臓の4つの部屋（ア〜エ）。上=心房、下=心室を模式化。
function Heart() {
  return (
    <Frame title="心臓（前面の模式図）" viewBox="0 0 240 200">
      <rect x="40" y="30" width="70" height="60" rx="10" fill="#bfdbfe" stroke="#334155" strokeWidth="1.5" />
      <rect x="130" y="30" width="70" height="60" rx="10" fill="#fecaca" stroke="#334155" strokeWidth="1.5" />
      <rect x="40" y="95" width="70" height="75" rx="10" fill="#93c5fd" stroke="#334155" strokeWidth="1.5" />
      <rect x="130" y="95" width="70" height="75" rx="10" fill="#fca5a5" stroke="#334155" strokeWidth="1.5" />
      <text x="75" y="65" textAnchor="middle" fontSize="15" fontWeight="700">ア</text>
      <text x="165" y="65" textAnchor="middle" fontSize="15" fontWeight="700">イ</text>
      <text x="75" y="138" textAnchor="middle" fontSize="15" fontWeight="700">ウ</text>
      <text x="165" y="138" textAnchor="middle" fontSize="15" fontWeight="700">エ</text>
      <text x="120" y="16" textAnchor="middle" fontSize="10" fill="#64748b">上＝心房／下＝心室</text>
      <line x1="120" y1="26" x2="120" y2="174" stroke="#94a3b8" strokeDasharray="4 3" />
    </Frame>
  );
}

// 手背：第1・第2中手骨間に経穴（●）。合谷の位置。
function HandGoukoku() {
  return (
    <Frame title="手背（手の甲）" viewBox="0 0 240 200">
      <path d="M70 180 L70 90 Q70 70 90 70 L150 70 Q170 70 170 90 L170 180 Z" fill="#fde9d9" stroke="#334155" strokeWidth="1.5" />
      <rect x="55" y="72" width="16" height="48" rx="7" fill="#fde9d9" stroke="#334155" strokeWidth="1.3" transform="rotate(-28 63 96)" />
      <rect x="80" y="24" width="14" height="52" rx="7" fill="#fde9d9" stroke="#334155" strokeWidth="1.3" />
      <rect x="100" y="18" width="14" height="58" rx="7" fill="#fde9d9" stroke="#334155" strokeWidth="1.3" />
      <rect x="120" y="24" width="14" height="52" rx="7" fill="#fde9d9" stroke="#334155" strokeWidth="1.3" />
      <rect x="140" y="34" width="13" height="44" rx="7" fill="#fde9d9" stroke="#334155" strokeWidth="1.3" />
      <circle cx="98" cy="92" r="7" fill="#dc2626" />
      <line x1="98" y1="92" x2="150" y2="60" stroke="#dc2626" strokeWidth="1.3" />
      <text x="152" y="58" fontSize="12" fontWeight="700" fill="#b91c1c">？</text>
      <text x="120" y="195" textAnchor="middle" fontSize="10" fill="#64748b">●＝第1・第2中手骨間のくぼみ</text>
    </Frame>
  );
}

// 下腿前面：膝下、脛骨稜の外方に経穴（●）。足三里の位置。
function LegSanri() {
  return (
    <Frame title="下腿の前面（右脚）" viewBox="0 0 240 210">
      <rect x="95" y="20" width="46" height="46" rx="12" fill="#fde9d9" stroke="#334155" strokeWidth="1.5" />
      <ellipse cx="118" cy="72" rx="20" ry="14" fill="#fef3c7" stroke="#334155" strokeWidth="1.3" />
      <path d="M100 84 L138 84 L132 190 L106 190 Z" fill="#fde9d9" stroke="#334155" strokeWidth="1.5" />
      <line x1="119" y1="90" x2="119" y2="188" stroke="#94a3b8" strokeDasharray="3 3" />
      <circle cx="132" cy="104" r="7" fill="#dc2626" />
      <line x1="132" y1="104" x2="176" y2="96" stroke="#dc2626" strokeWidth="1.3" />
      <text x="178" y="98" fontSize="12" fontWeight="700" fill="#b91c1c">？</text>
      <text x="120" y="204" textAnchor="middle" fontSize="10" fill="#64748b">●＝犢鼻の下・脛骨稜の外方</text>
    </Frame>
  );
}

// 経穴の印を付けない版（体表イラスト学習「名前→位置」のタップ問題用）。
// シルエットはHandGoukoku/LegSanriと同じ（印だけ省く）。座標はlib/acupointTap.jsで
// 単一のソースとして管理し、ここでは形の描画だけを担う。
function HandGoukokuBlank() {
  return (
    <Frame title="手背（手の甲）" viewBox="0 0 240 200">
      <path d="M70 180 L70 90 Q70 70 90 70 L150 70 Q170 70 170 90 L170 180 Z" fill="#fde9d9" stroke="#334155" strokeWidth="1.5" />
      <rect x="55" y="72" width="16" height="48" rx="7" fill="#fde9d9" stroke="#334155" strokeWidth="1.3" transform="rotate(-28 63 96)" />
      <rect x="80" y="24" width="14" height="52" rx="7" fill="#fde9d9" stroke="#334155" strokeWidth="1.3" />
      <rect x="100" y="18" width="14" height="58" rx="7" fill="#fde9d9" stroke="#334155" strokeWidth="1.3" />
      <rect x="120" y="24" width="14" height="52" rx="7" fill="#fde9d9" stroke="#334155" strokeWidth="1.3" />
      <rect x="140" y="34" width="13" height="44" rx="7" fill="#fde9d9" stroke="#334155" strokeWidth="1.3" />
    </Frame>
  );
}
function LegSanriBlank() {
  return (
    <Frame title="下腿の前面（右脚）" viewBox="0 0 240 210">
      <rect x="95" y="20" width="46" height="46" rx="12" fill="#fde9d9" stroke="#334155" strokeWidth="1.5" />
      <ellipse cx="118" cy="72" rx="20" ry="14" fill="#fef3c7" stroke="#334155" strokeWidth="1.3" />
      <path d="M100 84 L138 84 L132 190 L106 190 Z" fill="#fde9d9" stroke="#334155" strokeWidth="1.5" />
      <line x1="119" y1="90" x2="119" y2="188" stroke="#94a3b8" strokeDasharray="3 3" />
    </Frame>
  );
}

export const FIGURES = {
  spine: Spine,
  heart: Heart,
  'hand-goukoku': HandGoukoku,
  'leg-sanri': LegSanri,
  'hand-goukoku-blank': HandGoukokuBlank,
  'leg-sanri-blank': LegSanriBlank,
};

// キーから図コンポーネントを返す（無ければ null）
export function figureFor(key) {
  return (key && FIGURES[key]) || null;
}
