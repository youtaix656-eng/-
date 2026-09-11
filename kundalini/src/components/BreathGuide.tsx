import { useEffect, useRef, useState } from 'react';
import type { Practice } from '../data/breathing.js';

// 呼吸のガイド（円が広がる／縮む）。
// ⚠ 毎フレーム描き直さない：動きは CSS の transition に任せ、React は
//    「いまどの相か」が変わったときだけ描き直す（端末を熱くしないため）。
// ⚠ prefers-reduced-motion では動かさない（styles.css 側で止めている）。

export function BreathGuide({ practice, running }: { practice: Practice; running: boolean }) {
  const [index, setIndex] = useState(0);
  const [remain, setRemain] = useState(practice.phases[0]?.seconds ?? 0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    setIndex(0);
    setRemain(practice.phases[0]?.seconds ?? 0);
    startRef.current = Date.now();
  }, [practice.id]);

  useEffect(() => {
    if (!running || practice.phases.length === 0) return;
    const id = setInterval(() => {
      const phase = practice.phases[index];
      const passed = (Date.now() - startRef.current) / 1000;
      const left = Math.max(0, phase.seconds - passed);
      setRemain(Math.ceil(left));
      if (left <= 0) {
        startRef.current = Date.now();
        setIndex((i) => (i + 1) % practice.phases.length);
      }
    }, 200);
    return () => clearInterval(id);
  }, [running, index, practice]);

  if (practice.phases.length === 0) {
    return (
      <div className="breath-stage">
        <div className="breath-circle" style={{ transform: 'scale(.9)', transitionDuration: '4s' }}>
          そのまま
        </div>
      </div>
    );
  }

  const phase = practice.phases[index];
  const scale = phase.motion === 'in' ? 1 : phase.motion === 'out' ? 0.62 : index > 0 && practice.phases[index - 1].motion === 'in' ? 1 : 0.62;

  return (
    <div>
      <div className="breath-stage">
        <div
          className="breath-circle"
          style={{ transform: `scale(${scale})`, transitionDuration: `${phase.seconds}s` }}
          aria-hidden="true"
        >
          {remain}
        </div>
      </div>
      <div className="breath-label" role="status">
        {phase.label}（{remain}）
      </div>
    </div>
  );
}
