// AI社員の肖像（線画アバター）。
//
// 画像ファイルを持たず、その場でSVGを描く。黒背景に白の線画で、
// ウロボロス／錬金術の意匠（外周の円環と目盛り）を額縁にしている。
//
// **顔立ちで人種・民族を描き分けることはしない**（線が少なすぎて戯画になるため）。
// 見分けは髪型・装い・紋章でつける。出身はプロフィールの文章が持つ。
//
// 髪は「頭の輪郭より一回り大きい三日月」を黒で塗って描く。こうしないと
// 顔の輪郭線と重なって、髪ではなくベールのように見えてしまう。

import { portraitFor } from '../data/portraits.js';

const FACE =
  'M60,30 C74,30 82,39 82,53 C82,69 72,81 60,81 C48,81 38,69 38,53 C38,39 46,30 60,30 Z';

// 髪の外側の輪郭（頭より一回り大きい）
const HAIR_OUTER = 'M34,56 C31,27 43,19 60,19 C77,19 89,27 86,56';

// 前髪の生え際（外側の輪郭と閉じて三日月になる）
const FRINGES = {
  straight: 'C86,43 77,37 60,37 C43,37 34,43 34,56 Z',
  side: 'C86,41 74,32 55,34 C45,35 36,45 34,56 Z',
  angular: 'L81,35 L60,31 L39,35 L34,56 Z',
  wavy: 'C86,43 80,38 73,43 C67,47 60,37 52,42 C46,46 38,41 34,56 Z',
  high: 'C86,47 77,43 60,43 C43,43 34,47 34,56 Z',
  round: 'C86,45 78,34 60,34 C42,34 34,45 34,56 Z',
};

export default function Portrait({ employee, glyph, size = 72, frame = true, className = '' }) {
  const p = portraitFor(employee || {});

  return (
    <svg
      className={`portrait ${className}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={employee?.name ? `${employee.name} の肖像` : '社員の肖像'}
    >
      {frame && (
        <g stroke="rgba(255,255,255,0.24)" fill="none" strokeWidth="0.8">
          <circle cx="60" cy="60" r="58.5" />
          <circle cx="60" cy="60" r="55" strokeWidth="0.5" />
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i / 24) * Math.PI * 2;
            const r2 = i % 6 === 0 ? 50 : 52.5;
            return (
              <line
                key={i}
                x1={60 + Math.cos(a) * 55}
                y1={60 + Math.sin(a) * 55}
                x2={60 + Math.cos(a) * r2}
                y2={60 + Math.sin(a) * r2}
                strokeWidth={i % 6 === 0 ? 0.9 : 0.5}
              />
            );
          })}
        </g>
      )}

      {/* 内側を黒で塗り、線画が浮くようにする */}
      <circle cx="60" cy="60" r="50" fill="#000" />

      <g clipPath="url(#pf)">
        <g stroke="#fff" fill="none" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <HairBack style={p.hair} />
          <Shoulders collar={p.collar} />
          {/* 首（肩より先に描いて、肩の線で下が隠れるようにする） */}
          <path d="M52,77 L52,89 M68,77 L68,89" />
          {/* 顔 */}
          <path d={FACE} fill="#000" />
          <path d="M38,51 C34,51 34,59 38,59" />
          <path d="M82,51 C86,51 86,59 82,59" />
          <Features />
          <HairFront style={p.hair} />
          {p.glasses && <Glasses kind={p.glasses} />}
          {p.extra && <Extra kind={p.extra} />}
        </g>
      </g>

      <defs>
        <clipPath id="pf">
          <circle cx="60" cy="60" r="50" />
        </clipPath>
      </defs>

      {glyph && (
        <text
          x="60"
          y="116"
          textAnchor="middle"
          fill="rgba(255,255,255,0.75)"
          fontSize="9"
          fontFamily="serif"
        >
          {glyph}
        </text>
      )}
    </svg>
  );
}

function Features() {
  return (
    <>
      <path d="M45,48 C48,46 53,46 56,47" />
      <path d="M64,47 C67,46 72,46 75,48" />
      <path d="M46,56 C48,53 53,53 55,56 C53,59 48,59 46,56 Z" />
      <path d="M65,56 C67,53 72,53 74,56 C72,59 67,59 65,56 Z" />
      <circle cx="50.5" cy="56" r="1.3" fill="#fff" stroke="none" />
      <circle cx="69.5" cy="56" r="1.3" fill="#fff" stroke="none" />
      <path d="M60,57 L58,65 L61,66" />
      <path d="M54,71 C57,73.5 63,73.5 66,71" />
    </>
  );
}

function Shoulders({ collar }) {
  return (
    <>
      <path d="M20,120 C22,99 40,90 60,90 C80,90 98,99 100,120" fill="#000" />
      {collar === 'v' && <path d="M50,92 L60,105 L70,92" />}
      {collar === 'round' && <path d="M48,93 C52,100 68,100 72,93" />}
      {collar === 'shirt' && (
        <>
          <path d="M52,91 L60,101 L68,91" />
          <path d="M52,91 L46,99 M68,91 L74,99" />
        </>
      )}
      {collar === 'coat' && (
        <>
          <path d="M50,92 L58,107 L66,99 L70,92" />
          <path d="M58,107 L58,120" />
        </>
      )}
    </>
  );
}

/** 髪の三日月（頭より一回り大きい輪郭 ＋ 生え際）。黒で塗って頭頂を隠す。 */
function crescent(fringe) {
  return <path d={`${HAIR_OUTER} ${FRINGES[fringe] || FRINGES.straight}`} fill="#000" />;
}

/** 顔の後ろに描く髪（後ろ髪・結んだ毛先）。 */
function HairBack({ style }) {
  switch (style) {
    case 'long':
      // まっすぐ長い
      return <path d="M35,48 C30,68 29,88 31,108 M85,48 C90,68 91,88 89,108" />;
    case 'wave':
      return (
        <path d="M35,48 C28,63 32,73 27,85 C32,93 27,99 30,108 M85,48 C92,63 88,73 93,85 C88,93 93,99 90,108" />
      );
    case 'layered':
      // 段になった毛先（左右で長さを変える）
      return (
        <path d="M34,48 C29,60 33,66 29,74 C33,80 30,86 32,92 M86,48 C91,60 87,66 91,74 C87,78 90,82 88,86" />
      );
    case 'bob':
      return <path d="M34,50 C30,66 33,77 40,83 M86,50 C90,66 87,77 80,83" />;
    case 'halfup':
      return <path d="M35,50 C31,65 32,78 37,88 M85,50 C89,65 88,78 83,88" />;
    case 'braid':
      return <path d="M85,50 L91,60 L85,69 L91,78 L85,87 L90,95 L86,103" />;
    case 'pony':
      return <path d="M84,42 C97,49 100,66 92,83 C90,89 88,91 86,93" />;
    case 'locs':
      return (
        <path d="M35,52 C31,66 33,81 30,95 M44,56 C41,70 43,83 40,97 M76,56 C79,70 77,83 80,97 M85,52 C89,66 87,81 90,95" />
      );
    case 'bun':
      return <circle cx="60" cy="17" r="7" fill="#000" />;
    case 'topknot':
      return (
        <>
          <path d="M55,22 C56,11 64,11 65,22" fill="#000" />
          <path d="M60,11 C65,7 69,12 66,16" />
        </>
      );
    default:
      return null;
  }
}

/** 顔の上に描く髪（前髪・毛の流れ）。 */
function HairFront({ style }) {
  switch (style) {
    case 'buzz':
      return (
        <>
          {crescent('high')}
          <path d="M44,34 L46,30 M52,31 L54,27 M60,30 L61,26 M68,31 L70,27 M76,34 L78,30" strokeWidth="0.9" />
        </>
      );
    case 'crop':
      return (
        <>
          {crescent('angular')}
          <path d="M42,33 L60,28 L78,33" strokeWidth="0.9" />
        </>
      );
    case 'sidepart':
      return (
        <>
          {crescent('side')}
          <path d="M52,22 C46,30 40,42 36,52" strokeWidth="0.9" />
          <path d="M52,22 C64,25 76,32 84,42" strokeWidth="0.9" />
        </>
      );
    case 'curls':
      return (
        <>
          {crescent('wavy')}
          <path
            d="M36,40 a4,4 0 1,1 8,0 a4,4 0 1,1 8,0 a4,4 0 1,1 8,0 a4,4 0 1,1 8,0 a4,4 0 1,1 8,0"
            strokeWidth="0.9"
          />
        </>
      );
    case 'locs':
      return (
        <>
          {crescent('straight')}
          <path
            d="M42,36 L42,24 M50,33 L50,21 M60,32 L60,20 M70,33 L70,21 M78,36 L78,24"
            strokeWidth="1"
          />
        </>
      );
    case 'bun':
    case 'topknot':
      return (
        <>
          {crescent('round')}
          <path d="M44,30 C52,25 68,25 76,30" strokeWidth="0.9" />
        </>
      );
    case 'halfup':
      return (
        <>
          {crescent('round')}
          <path d="M48,26 C54,32 66,32 72,26" strokeWidth="0.9" />
        </>
      );
    case 'braid':
      return (
        <>
          {crescent('side')}
          <path d="M44,30 C54,24 66,24 78,31" strokeWidth="0.9" />
        </>
      );
    case 'pony':
      return (
        <>
          {crescent('round')}
          <path d="M44,30 C54,26 68,26 78,31" strokeWidth="0.9" />
        </>
      );
    case 'long':
      // 真ん中分け
      return (
        <>
          {crescent('straight')}
          <path d="M60,20 L60,36" strokeWidth="0.9" />
          <path d="M44,32 C50,27 54,26 58,25 M76,32 C70,27 66,26 62,25" strokeWidth="0.9" />
        </>
      );
    case 'wave':
      return (
        <>
          {crescent('wavy')}
          <path d="M42,31 C52,25 68,25 78,31" strokeWidth="0.9" />
        </>
      );
    case 'layered':
      return (
        <>
          {crescent('side')}
          <path d="M50,23 C58,27 70,31 82,36" strokeWidth="0.9" />
        </>
      );
    case 'bob':
      return (
        <>
          {crescent('round')}
          <path d="M43,34 C52,28 68,28 77,34" strokeWidth="0.9" />
          <path d="M40,50 L40,44 M80,50 L80,44" strokeWidth="0.9" />
        </>
      );
    case 'short':
    default:
      return (
        <>
          {crescent('straight')}
          <path d="M42,33 C50,28 70,28 78,33" strokeWidth="0.9" />
        </>
      );
  }
}

function Glasses({ kind }) {
  if (kind === 'square') {
    return (
      <g strokeWidth="1.2">
        <rect x="43" y="50" width="15" height="12" rx="2" />
        <rect x="62" y="50" width="15" height="12" rx="2" />
        <path d="M58,55 L62,55 M43,54 L37,53 M77,54 L83,53" />
      </g>
    );
  }
  return (
    <g strokeWidth="1.2">
      <circle cx="50.5" cy="56" r="7.5" />
      <circle cx="69.5" cy="56" r="7.5" />
      <path d="M58,56 L62,56 M43,54 L37,53 M77,54 L83,53" />
    </g>
  );
}

function Extra({ kind }) {
  switch (kind) {
    case 'earring':
      return <circle cx="83" cy="63" r="2.2" />;
    case 'stud':
      return <circle cx="83" cy="61" r="1.4" fill="#fff" stroke="none" />;
    case 'headband':
      return <path d="M36,45 C46,37 74,37 84,45" strokeWidth="2.2" />;
    case 'scarf':
      return (
        <>
          <path d="M46,90 C52,98 68,98 74,90" strokeWidth="2.2" />
          <path d="M74,92 L81,103 L72,100" />
        </>
      );
    case 'tie':
      return <path d="M58,101 L54,107 L58,119 L62,107 Z" />;
    default:
      return null;
  }
}
