import { useEffect, useRef, useState } from 'react';

// 休憩タイマー（5分/10分）。残り時間を表示し、終わると自動で続行。途中スキップ可。
//   元はSession.jsxのローカル関数だったが、音声学習の60問区切りの休憩でも同じ仕組みが
//   要るため切り出した（単一の正。Session.jsx・AudioMode.jsxの両方から使う）。
export default function BreakTimer({ minutes, onDone }) {
  const [remain, setRemain] = useState(null); // 秒。null=未開始
  const ivRef = useRef(null);
  // アンマウント時（「続ける」を押す・中断する等でこの画面ごと消える時）にインターバルを
  // 必ず止める。放置すると、残り時間ぶん裏で動き続けたタイマーが、あとで表示される
  // 別の（無関係な）休憩画面を勝手に閉じてしまう。
  useEffect(() => () => { if (ivRef.current) clearInterval(ivRef.current); }, []);
  const start = () => {
    setRemain(minutes * 60);
    ivRef.current = setInterval(() => {
      setRemain((r) => {
        if (r <= 1) {
          clearInterval(ivRef.current);
          ivRef.current = null;
          onDone?.();
          return null;
        }
        return r - 1;
      });
    }, 1000);
  };
  if (remain == null) {
    return (
      <button className="btn block" onClick={start}>⏱ {minutes}分休憩</button>
    );
  }
  const mm = Math.floor(remain / 60);
  const ss = String(remain % 60).padStart(2, '0');
  return (
    <div className="sess-timer">
      <span>休憩中… あと {mm}:{ss}</span>
      <button className="btn ghost sm" onClick={() => { if (ivRef.current) { clearInterval(ivRef.current); ivRef.current = null; } onDone?.(); }}>スキップして再開</button>
    </div>
  );
}
