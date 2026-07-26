// ============================================================
// ハンドリフレの「手の向きを示す図」（自作SVG）
// 研修マニュアルの写真は転載せず、同じ方向・動きを
// 手の輪郭＋青い線／矢印のオリジナル図で表現する。
// 手順番号(no)ごとに view（arm/palm/back）と青い overlay を対応させる。
// ============================================================
import React from "react";

const BLUE = "#1497c2";
const OUTLINE = "#b39a7c";

// ---- ベースの輪郭 ----
function HandOutline() {
  // 手のひら／甲の輪郭（指を上に）。viewBox 0 0 120 150 前提。
  const f = { fill: "#ffffff", stroke: OUTLINE, strokeWidth: 2 };
  return (
    <g>
      {/* 指 */}
      <rect x={44} y={18} width={9} height={44} rx={4.5} {...f} />
      <rect x={55} y={11} width={9} height={51} rx={4.5} {...f} />
      <rect x={66} y={16} width={9} height={46} rx={4.5} {...f} />
      <rect x={77} y={26} width={8} height={36} rx={4} {...f} />
      {/* 親指 */}
      <rect x={17} y={72} width={9} height={30} rx={4.5} transform="rotate(-42 21 80)" {...f} />
      {/* 手のひら */}
      <rect x={42} y={54} width={46} height={60} rx={17} {...f} />
      {/* 手首 */}
      <rect x={52} y={110} width={26} height={28} rx={7} {...f} />
    </g>
  );
}

function ArmOutline() {
  // 手＋前腕（手を上、肘を下に）。viewBox 0 0 120 210 前提。
  const f = { fill: "#ffffff", stroke: OUTLINE, strokeWidth: 2 };
  return (
    <g>
      {/* 指（小さめ） */}
      <rect x={47} y={8} width={7} height={28} rx={3.5} {...f} />
      <rect x={55} y={4} width={7} height={32} rx={3.5} {...f} />
      <rect x={63} y={8} width={7} height={28} rx={3.5} {...f} />
      <rect x={71} y={14} width={6} height={22} rx={3} {...f} />
      {/* 親指 */}
      <rect x={30} y={44} width={7} height={22} rx={3.5} transform="rotate(-45 33 50)" {...f} />
      {/* 手のひら */}
      <rect x={45} y={30} width={33} height={30} rx={12} {...f} />
      {/* 前腕（下ほど広いトラペゾイド） */}
      <path d="M47 58 L75 58 L84 198 L38 198 Z" fill="#ffffff" stroke={OUTLINE} strokeWidth={2} />
      {/* 手首の目安線 */}
      <line x1={47} y1={62} x2={75} y2={62} stroke={OUTLINE} strokeWidth={1.5} strokeDasharray="3 3" />
    </g>
  );
}

// 青い線の共通スタイル
const line = { stroke: BLUE, strokeWidth: 3.5, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const dot = { fill: BLUE };

// arm 用の overlay（viewBox 0 0 120 210）
function armFig(no: number): React.ReactNode {
  switch (no) {
    case 3: // スイミング：手首→肘（下向き）中央の直線
    case 9:
    case 32:
      return (
        <>
          <line x1={60} y1={72} x2={60} y2={185} {...line} markerEnd="url(#arrow)" />
        </>
      );
    case 4: // 押し上げ：手首と骨の間から外肘へ（1本）
      return <line x1={64} y1={185} x2={58} y2={74} {...line} markerEnd="url(#arrow)" />;
    case 10: // 押し上げ 放射線状：手首から内肘・真ん中・外肘へ扇状
      return (
        <>
          <line x1={60} y1={78} x2={45} y2={185} {...line} markerEnd="url(#arrow)" />
          <line x1={60} y1={78} x2={61} y2={188} {...line} markerEnd="url(#arrow)" />
          <line x1={60} y1={78} x2={76} y2={185} {...line} markerEnd="url(#arrow)" />
        </>
      );
    case 5: // ドアノブ：外側→内側の横カーブ（3本）
    case 11: // ぞうきん絞り：横カーブ（内→外）
      return (
        <>
          <path d="M44 100 Q60 90 78 100" {...line} />
          <path d="M42 135 Q60 125 80 135" {...line} />
          <path d="M42 168 Q60 158 80 168" {...line} />
        </>
      );
    case 7: // めくりあげ：横カーブ2本
      return (
        <>
          <path d="M42 120 Q60 108 80 120" {...line} />
          <path d="M42 160 Q60 148 80 160" {...line} />
        </>
      );
    case 6: // ワイパー：ジグザグ（拇指を交互）
    case 12:
      return (
        <path
          d="M48 80 L72 100 L48 120 L72 140 L48 160 L72 180"
          {...line}
        />
      );
    default:
      return null;
  }
}

// palm 用の overlay（viewBox 0 0 120 150）
function palmFig(no: number): React.ReactNode {
  switch (no) {
    case 13: // 噴水：手のひら中央から指の付け根へ末広がり
      return (
        <>
          <line x1={62} y1={92} x2={49} y2={60} {...line} markerEnd="url(#arrow)" />
          <line x1={62} y1={92} x2={62} y2={56} {...line} markerEnd="url(#arrow)" />
          <line x1={62} y1={92} x2={75} y2={60} {...line} markerEnd="url(#arrow)" />
        </>
      );
    case 14: // ワイパー：拇指球と小指球（2つの横カーブ）
      return (
        <>
          <path d="M42 92 Q50 84 58 92" {...line} />
          <path d="M66 90 Q74 82 84 90" {...line} />
        </>
      );
    case 15: // ねじねじクリップ：各指に線＋指先に丸
      return (
        <>
          {[[48.5, 20], [59.5, 14], [70.5, 18], [81, 28]].map(([x, y], i) => (
            <g key={i}>
              <line x1={x} y1={y + 6} x2={x} y2={y + 34} {...line} />
              <circle cx={x} cy={y + 2} r={3.5} {...dot} />
            </g>
          ))}
        </>
      );
    case 16: // 直線：小指→親指の付け根へ 2本
      return (
        <>
          <line x1={80} y1={74} x2={46} y2={80} {...line} markerEnd="url(#arrow)" />
          <line x1={80} y1={90} x2={46} y2={96} {...line} markerEnd="url(#arrow)" />
        </>
      );
    case 17: // 拇指球カーブ
      return <path d="M46 104 Q40 88 47 74" {...line} />;
    case 18: // 拇指球ボタン押し（点）
      return <circle cx={45} cy={92} r={5} {...dot} />;
    case 19: // 拇指球押し出し：内→外の短い線
      return <line x1={57} y1={96} x2={42} y2={86} {...line} markerEnd="url(#arrow)" />;
    case 20: // 手のひら中央ボタン押し
      return <circle cx={61} cy={86} r={5} {...dot} />;
    case 21: // 生命線カーブ
      return <path d="M62 74 Q46 84 46 108" {...line} />;
    case 22: // ボタン押し2カ所（小指と薬指の間・縦）
      return (
        <>
          <circle cx={70} cy={66} r={4.5} {...dot} />
          <circle cx={70} cy={80} r={4.5} {...dot} />
        </>
      );
    case 23: // 2カ所つなぐ（縦線）
      return <line x1={70} y1={64} x2={70} y2={82} {...line} markerEnd="url(#arrow)" />;
    case 24: // 招き猫：中央より下に四角
      return <rect x={50} y={86} width={22} height={16} rx={4} {...line} />;
    case 25: // コの字
      return <path d="M70 66 L48 66 L48 96 L70 96" {...line} markerEnd="url(#arrow)" />;
    case 26: // 手首すれ違い：外→内の横矢印
      return <line x1={74} y1={120} x2={48} y2={120} {...line} markerEnd="url(#arrow)" />;
    default:
      return null;
  }
}

// back（手の甲）用の overlay（viewBox 0 0 120 150）
function backFig(no: number): React.ReactNode {
  switch (no) {
    case 27: // 親指側面直線：親指側→手首へ
      return <line x1={40} y1={62} x2={40} y2={108} {...line} markerEnd="url(#arrow)" />;
    case 28: // ボタン押し：親指と人差し指の間
      return <circle cx={44} cy={60} r={5} {...dot} />;
    case 29: // 直線：骨の間を中央へ（3本）
      return (
        <>
          <line x1={49} y1={62} x2={57} y2={98} {...line} markerEnd="url(#arrow)" />
          <line x1={60} y1={60} x2={60} y2={100} {...line} markerEnd="url(#arrow)" />
          <line x1={71} y1={62} x2={63} y2={98} {...line} markerEnd="url(#arrow)" />
        </>
      );
    case 30: // チョコ割り：外へ開く横カーブ2本
      return (
        <>
          <path d="M60 78 Q46 74 40 82" {...line} markerEnd="url(#arrow)" />
          <path d="M60 78 Q74 74 80 82" {...line} markerEnd="url(#arrow)" />
        </>
      );
    case 31: // 手首直線：手首→肘（下へ）
      return <line x1={60} y1={114} x2={60} y2={136} {...line} markerEnd="url(#arrow)" />;
    default:
      return null;
  }
}

const ARM_NOS = new Set([3, 4, 5, 6, 7, 9, 10, 11, 12, 32]);
const BACK_NOS = new Set([27, 28, 29, 30, 31]);
const PALM_NOS = new Set([13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]);

export function HandDiagram({ no }: { no: number }) {
  const isArm = ARM_NOS.has(no);
  const isBack = BACK_NOS.has(no);
  const isPalm = PALM_NOS.has(no);
  if (!isArm && !isBack && !isPalm) return null;

  const overlay = isArm ? armFig(no) : isBack ? backFig(no) : palmFig(no);
  if (!overlay) return null;

  const viewBox = isArm ? "0 0 120 210" : "0 0 120 150";

  return (
    <div className="mt-2 inline-block rounded-lg bg-cream-100 p-1">
      <svg
        viewBox={viewBox}
        width={isArm ? 78 : 96}
        height={isArm ? 136 : 120}
        role="img"
        aria-label="手の向きの図"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX={8}
            refY={5}
            markerWidth={5}
            markerHeight={5}
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill={BLUE} />
          </marker>
        </defs>
        {isArm ? <ArmOutline /> : <HandOutline />}
        {overlay}
      </svg>
    </div>
  );
}
