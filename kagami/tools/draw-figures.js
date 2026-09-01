/* eslint-disable */
// 地に敷く面（おもて）を、キャンバスに描いて画像へ焼く。
//
// **色を持たない。** ここで使う色は必ず g() が組み立てる灰色だけ。
// 1色でも入れた瞬間に、このアプリは図版ではなくなる（焼くときに機械が確かめる）。
//
// 怖さの作り方（見た目の決めごと）:
//   1. **目は真っ黒の穴**にする。ぼかすと優しくなる——ふちだけ細く光らせて、深さを出す。
//   2. **左右をわずかにずらす。** 完全な左右対称は飾りに見えて、こわくない。
//   3. **全部を照らさない。** 顔の半分は闇に残す。見えない所を人は補って怖がる。
//   4. **傷と縦のにじみ**を入れる（写真の劣化に見えるものは、それだけで不穏になる）。
//   5. それでも**文字の下に濃く敷かない**。読みにくくなった時点で本末転倒。

(function (global) {
  const g = (v, a) => (a === undefined ? `rgb(${v},${v},${v})` : `rgba(${v},${v},${v},${a})`);
  const rnd = (a, b) => a + Math.random() * (b - a);

  /** 黒地と、片側から差す弱い明かり（真ん中から均等に照らさない） */
  function ground(c, w, h, lx, ly) {
    c.fillStyle = g(4);
    c.fillRect(0, 0, w, h);
    const gd = c.createRadialGradient(w * (lx || 0.5), h * (ly || 0.24), 0, w * (lx || 0.5), h * (ly || 0.24), w * 1.05);
    gd.addColorStop(0, g(255, 0.075));
    gd.addColorStop(0.5, g(255, 0.02));
    gd.addColorStop(1, g(255, 0));
    c.fillStyle = gd;
    c.fillRect(0, 0, w, h);
  }

  function puff(c, x, y, rx, ry, alpha, rot) {
    c.save();
    c.translate(x, y);
    if (rot) c.rotate(rot);
    c.scale(1, ry / rx);
    const gd = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    gd.addColorStop(0, g(255, alpha));
    gd.addColorStop(0.6, g(255, alpha * 0.45));
    gd.addColorStop(1, g(255, 0));
    c.fillStyle = gd;
    c.beginPath();
    c.arc(0, 0, rx, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function shade(c, x, y, rx, ry, alpha, rot) {
    c.save();
    c.translate(x, y);
    if (rot) c.rotate(rot);
    c.scale(1, ry / rx);
    const gd = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    gd.addColorStop(0, g(0, alpha));
    gd.addColorStop(0.58, g(0, alpha * 0.6));
    gd.addColorStop(1, g(0, 0));
    c.fillStyle = gd;
    c.beginPath();
    c.arc(0, 0, rx, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function ellipse(c, x, y, rx, ry, fill, blur, rot) {
    c.save();
    if (blur) c.filter = `blur(${blur}px)`;
    c.fillStyle = fill;
    c.beginPath();
    c.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  /** **真っ黒の穴。** ふちだけ細く光らせて深さを出す（ぼかすと優しくなる） */
  function pit(c, x, y, rx, ry, rot, rim) {
    ellipse(c, x, y, rx * 1.55, ry * 1.9, g(0, 0.75), rx * 0.55, rot);
    ellipse(c, x, y, rx, ry, g(0, 1), rx * 0.1, rot);
    c.save();
    c.filter = `blur(${rx * 0.14}px)`;
    c.strokeStyle = g(255, rim === undefined ? 0.5 : rim);
    c.lineWidth = rx * 0.11;
    c.beginPath();
    c.ellipse(x, y + ry * 0.2, rx * 1.02, ry * 1.02, rot || 0, Math.PI * 0.12, Math.PI * 0.88);
    c.stroke();
    c.restore();
  }

  /** 光る目 */
  function litEye(c, x, y, r, bright) {
    puff(c, x, y, r * 2.4, r * 2.4, 0.42);
    ellipse(c, x, y, r, r, g(bright === undefined ? 240 : bright, 0.97), r * 0.1);
    ellipse(c, x - r * 0.24, y - r * 0.26, r * 0.36, r * 0.36, g(255, 0.85), r * 0.24);
  }

  /** ひび（面が割れている） */
  function crack(c, x, y, len, dir, w0) {
    c.save();
    c.strokeStyle = g(0, 0.42);
    c.lineWidth = w0 || 1.2;
    c.filter = 'blur(1.1px)';
    c.beginPath();
    c.moveTo(x, y);
    let px = x;
    let py = y;
    for (let i = 0; i < 8; i += 1) {
      px += Math.cos(dir + rnd(-0.32, 0.32)) * (len / 8);
      py += Math.sin(dir + rnd(-0.32, 0.32)) * (len / 8);
      c.lineTo(px, py);
    }
    c.stroke();
    c.restore();
  }

  /** 傷と縦のにじみ（写真が傷んで見えるだけで不穏になる） */
  function scratches(c, w, h, n) {
    c.save();
    for (let i = 0; i < (n || 7); i += 1) {
      const x = rnd(0, w);
      const y0 = rnd(0, h * 0.75);
      const len = rnd(h * 0.06, h * 0.36);
      c.strokeStyle = g(255, rnd(0.012, 0.05));
      c.lineWidth = rnd(0.6, 2.4);
      c.filter = `blur(${rnd(0.4, 2.2)}px)`;
      c.beginPath();
      c.moveTo(x, y0);
      c.lineTo(x + rnd(-4, 4), y0 + len);
      c.stroke();
    }
    c.restore();
  }

  function grain(c, w, h, amount) {
    const img = c.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * amount;
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = d[i];
      d[i + 2] = d[i];
    }
    c.putImageData(img, 0, 0);
  }

  function vignette(c, w, h) {
    const gd = c.createRadialGradient(w / 2, h * 0.36, w * 0.16, w / 2, h * 0.42, h * 0.72);
    gd.addColorStop(0, g(0, 0));
    gd.addColorStop(0.55, g(0, 0.4));
    gd.addColorStop(1, g(0, 0.96));
    c.fillStyle = gd;
    c.fillRect(0, 0, w, h);
  }

  /** 面の下地（片側だけ照らして、半分は闇に残す） */
  function faceBase(c, cx, cy, fr, ratio, tone, lightFromLeft) {
    ellipse(c, cx, cy, fr, fr * ratio, g(tone, 0.95), fr * 0.05);
    const s = lightFromLeft ? 1 : -1;
    shade(c, cx + fr * 0.85 * s, cy + fr * 0.1, fr * 0.85, fr * ratio * 1.05, 0.85);
    shade(c, cx, cy + fr * ratio * 1.02, fr * 1.05, fr * 0.75, 0.7);
    shade(c, cx, cy - fr * ratio * 0.98, fr * 1.1, fr * 0.6, 0.6);
  }

  /* ── ① 長い髪の面 ─────────────────────────── */
  function veil(c, w, h) {
    const cx = w * 0.5;
    const fy = h * 0.29;
    const fr = w * 0.2;
    c.save();
    c.filter = `blur(${w * 0.03}px)`;
    c.fillStyle = g(0, 1);
    c.beginPath();
    c.moveTo(cx - w * 0.33, h);
    c.bezierCurveTo(cx - w * 0.35, h * 0.5, cx - w * 0.31, h * 0.16, cx, h * 0.075);
    c.bezierCurveTo(cx + w * 0.31, h * 0.16, cx + w * 0.35, h * 0.5, cx + w * 0.33, h);
    c.closePath();
    c.fill();
    c.restore();
    faceBase(c, cx, fy, fr, 1.44, 205, true);
    // 目は真っ黒の穴。**わずかに高さをずらす**
    pit(c, cx - fr * 0.45, fy - fr * 0.24, fr * 0.3, fr * 0.2, -0.1, 0.42);
    pit(c, cx + fr * 0.46, fy - fr * 0.19, fr * 0.29, fr * 0.19, 0.08, 0.42);
    // 裂けた笑い
    c.save();
    c.filter = `blur(${fr * 0.04}px)`;
    c.fillStyle = g(0, 0.97);
    c.beginPath();
    c.moveTo(cx - fr * 0.72, fy + fr * 0.38);
    c.quadraticCurveTo(cx + fr * 0.04, fy + fr * 1.16, cx + fr * 0.7, fy + fr * 0.33);
    c.quadraticCurveTo(cx, fy + fr * 0.62, cx - fr * 0.72, fy + fr * 0.38);
    c.closePath();
    c.fill();
    c.restore();
    puff(c, cx, fy + fr * 0.72, fr * 0.5, fr * 0.16, 0.14);
    // 顔にかかる髪
    c.save();
    c.strokeStyle = g(0, 0.85);
    c.filter = `blur(${fr * 0.05}px)`;
    for (let i = 0; i < 9; i += 1) {
      const x = cx + rnd(-fr * 1.05, fr * 1.05);
      c.lineWidth = rnd(fr * 0.02, fr * 0.075);
      c.beginPath();
      c.moveTo(x, fy - fr * 1.5);
      c.quadraticCurveTo(x + rnd(-fr * 0.2, fr * 0.2), fy, x + rnd(-fr * 0.3, fr * 0.3), fy + fr * rnd(0.6, 1.6));
      c.stroke();
    }
    c.restore();
  }

  /* ── ② 笑う面 ─────────────────────────────── */
  function grin(c, w, h) {
    const cx = w * 0.5;
    const cy = h * 0.26;
    const r = w * 0.44;
    c.save();
    c.filter = `blur(${w * 0.028}px)`;
    c.fillStyle = g(0, 1);
    c.beginPath();
    c.ellipse(cx, cy, r, r * 1.12, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(cx - r * 1.1, h);
    c.bezierCurveTo(cx - r * 0.98, cy + r * 1.45, cx - r * 0.62, cy + r * 0.98, cx, cy + r * 0.98);
    c.bezierCurveTo(cx + r * 0.62, cy + r * 0.98, cx + r * 0.98, cy + r * 1.45, cx + r * 1.1, h);
    c.closePath();
    c.fill();
    c.restore();
    // 目の大きさを少し変える
    litEye(c, cx - r * 0.41, cy - r * 0.19, r * 0.16, 248);
    litEye(c, cx + r * 0.4, cy - r * 0.14, r * 0.135, 232);
    // 大きすぎる口。歯は不揃いに
    const my = cy + r * 0.44;
    const mw = r * 0.94;
    c.save();
    c.filter = `blur(${r * 0.012}px)`;
    c.fillStyle = g(236, 0.95);
    c.beginPath();
    c.moveTo(cx - mw, my - r * 0.14);
    c.quadraticCurveTo(cx - r * 0.02, my + r * 0.6, cx + mw, my - r * 0.16);
    c.quadraticCurveTo(cx, my + r * 0.14, cx - mw, my - r * 0.14);
    c.closePath();
    c.fill();
    c.restore();
    c.save();
    c.strokeStyle = g(0, 0.92);
    for (let i = 1; i < 19; i += 1) {
      const t = i / 19;
      const x = cx - mw + 2 * mw * t + rnd(-mw * 0.012, mw * 0.012);
      const top = my - r * 0.14 + r * 0.28 * 4 * t * (1 - t) * 0.5;
      const bot = my - r * 0.14 + r * 0.74 * 4 * t * (1 - t) * rnd(0.86, 1.06);
      c.lineWidth = rnd(r * 0.008, r * 0.022);
      c.beginPath();
      c.moveTo(x, top);
      c.lineTo(x, bot);
      c.stroke();
    }
    c.restore();
    shade(c, cx, my + r * 0.56, mw * 0.95, r * 0.3, 0.55);
  }

  /* ── ③ 水面の目 ───────────────────────────── */
  function water(c, w, h) {
    const cx = w * 0.5;
    const line = h * 0.41;
    const fr = w * 0.27;
    const fy = line - fr * 0.62;
    puff(c, cx, fy, fr * 1.5, fr * 1.5, 0.06);
    ellipse(c, cx, fy, fr * 0.9, fr * 1.2, g(146, 0.66), fr * 0.09);
    shade(c, cx, fy - fr * 0.84, fr * 1.3, fr * 0.72, 0.97);
    shade(c, cx - fr * 0.92, fy - fr * 0.08, fr * 0.62, fr * 1.18, 0.9);
    shade(c, cx + fr * 0.92, fy - fr * 0.08, fr * 0.62, fr * 1.18, 0.9);
    // 落ちくぼんだ頬
    shade(c, cx - fr * 0.5, fy + fr * 0.55, fr * 0.36, fr * 0.4, 0.55);
    shade(c, cx + fr * 0.5, fy + fr * 0.55, fr * 0.36, fr * 0.4, 0.55);
    litEye(c, cx - fr * 0.45, fy + fr * 0.1, fr * 0.145, 250);
    litEye(c, cx + fr * 0.44, fy + fr * 0.16, fr * 0.125, 236);
    c.save();
    c.filter = `blur(${h * 0.008}px)`;
    c.fillStyle = g(0, 0.98);
    c.fillRect(0, line, w, h - line);
    c.restore();
    // 水に映る影（左右反転した薄い顔）
    c.save();
    c.globalAlpha = 0.16;
    c.translate(0, line * 2 + fr * 0.2);
    c.scale(1, -1);
    c.filter = `blur(${h * 0.006}px)`;
    ellipse(c, cx, fy, fr * 0.86, fr * 1.1, g(120, 0.5), fr * 0.2);
    c.restore();
    c.save();
    c.strokeStyle = g(255, 0.32);
    c.lineWidth = Math.max(1.4, h * 0.0015);
    c.beginPath();
    c.moveTo(0, line);
    c.lineTo(w, line);
    c.stroke();
    for (let i = 0; i < 8; i += 1) {
      const y = line + h * (0.014 + i * i * 0.0055);
      c.globalAlpha = 0.3 - i * 0.034;
      c.beginPath();
      c.moveTo(-w * 0.05, y);
      c.bezierCurveTo(w * 0.3, y - h * 0.007, w * 0.7, y + h * 0.007, w * 1.05, y);
      c.stroke();
    }
    c.restore();
  }

  /* ── ④ 割れた面 ───────────────────────────── */
  function noh(c, w, h) {
    const cx = w * 0.5;
    const fy = h * 0.28;
    const fr = w * 0.225;
    c.save();
    c.filter = `blur(${w * 0.03}px)`;
    c.fillStyle = g(0, 0.97);
    c.beginPath();
    c.moveTo(cx - w * 0.36, h);
    c.bezierCurveTo(cx - w * 0.3, h * 0.6, cx - w * 0.24, h * 0.44, cx, h * 0.43);
    c.bezierCurveTo(cx + w * 0.24, h * 0.44, cx + w * 0.3, h * 0.6, cx + w * 0.36, h);
    c.closePath();
    c.fill();
    c.restore();
    faceBase(c, cx, fy, fr, 1.5, 224, false);
    // 細い目——中は真っ黒
    pit(c, cx - fr * 0.44, fy - fr * 0.27, fr * 0.27, fr * 0.085, -0.06, 0.3);
    pit(c, cx + fr * 0.44, fy - fr * 0.24, fr * 0.26, fr * 0.08, 0.05, 0.3);
    // 少し開いた口（奥は闇）
    ellipse(c, cx, fy + fr * 0.62, fr * 0.2, fr * 0.14, g(0, 1), fr * 0.03);
    ellipse(c, cx, fy + fr * 0.58, fr * 0.22, fr * 0.05, g(0, 0.7), fr * 0.06);
    // 眉
    ellipse(c, cx - fr * 0.46, fy - fr * 0.6, fr * 0.24, fr * 0.055, g(0, 0.6), fr * 0.08, -0.12);
    ellipse(c, cx + fr * 0.46, fy - fr * 0.58, fr * 0.24, fr * 0.055, g(0, 0.6), fr * 0.08, 0.1);
    // 面が割れている
    crack(c, cx - fr * 0.16, fy - fr * 1.42, fr * 2.0, Math.PI * 0.5, fr * 0.012);
    crack(c, cx + fr * 0.52, fy - fr * 0.05, fr * 0.6, Math.PI * 0.34, fr * 0.008);
  }

  /* ── ⑤ フードの影 ─────────────────────────── */
  function hood(c, w, h) {
    const cx = w * 0.5;
    const fy = h * 0.29;
    const fr = w * 0.2;
    c.save();
    c.filter = `blur(${w * 0.035}px)`;
    c.fillStyle = g(0, 1);
    c.beginPath();
    c.moveTo(cx - w * 0.44, h);
    c.bezierCurveTo(cx - w * 0.42, h * 0.4, cx - w * 0.35, h * 0.07, cx, h * 0.05);
    c.bezierCurveTo(cx + w * 0.35, h * 0.07, cx + w * 0.42, h * 0.4, cx + w * 0.44, h);
    c.closePath();
    c.fill();
    c.restore();
    // 顎のあたりにだけ光が入る
    ellipse(c, cx, fy + fr * 0.35, fr * 0.92, fr * 1.05, g(126, 0.6), fr * 0.18);
    shade(c, cx, fy - fr * 0.85, fr * 1.25, fr * 0.95, 0.98);
    shade(c, cx - fr * 0.95, fy, fr * 0.72, fr * 1.3, 0.82);
    shade(c, cx + fr * 0.95, fy, fr * 0.72, fr * 1.3, 0.82);
    pit(c, cx - fr * 0.42, fy - fr * 0.1, fr * 0.29, fr * 0.22, -0.08, 0.55);
    pit(c, cx + fr * 0.43, fy - fr * 0.05, fr * 0.28, fr * 0.21, 0.06, 0.55);
    ellipse(c, cx, fy + fr * 0.68, fr * 0.26, fr * 0.11, g(0, 0.85), fr * 0.08, 0.04);
    c.save();
    c.filter = `blur(${w * 0.01}px)`;
    c.strokeStyle = g(255, 0.1);
    c.lineWidth = w * 0.008;
    c.beginPath();
    c.ellipse(cx, fy, fr * 1.55, fr * 1.8, 0, Math.PI * 1.02, Math.PI * 1.98);
    c.stroke();
    c.restore();
  }

  /* ── ⑥ 後ろにもう一人 ─────────────────────── */
  function pair(c, w, h) {
    const fr = w * 0.185;
    const ax = w * 0.34;
    const ay = h * 0.28;
    const bx = w * 0.72;
    const by = h * 0.24;
    // 奥（ぼやけて、こちらを見ている）
    c.save();
    c.filter = `blur(${w * 0.04}px)`;
    c.fillStyle = g(0, 1);
    c.beginPath();
    c.ellipse(bx, by, fr * 0.95, fr * 1.2, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(bx - fr * 2.0, h);
    c.bezierCurveTo(bx - fr * 1.6, by + fr * 2.4, bx - fr * 0.95, by + fr * 1.2, bx, by + fr * 1.2);
    c.bezierCurveTo(bx + fr * 0.95, by + fr * 1.2, bx + fr * 1.6, by + fr * 2.4, bx + fr * 2.0, h);
    c.closePath();
    c.fill();
    c.restore();
    ellipse(c, bx, by, fr * 0.86, fr * 1.08, g(88, 0.55), fr * 0.28);
    pit(c, bx - fr * 0.32, by - fr * 0.14, fr * 0.19, fr * 0.14, 0, 0.22);
    pit(c, bx + fr * 0.33, by - fr * 0.1, fr * 0.18, fr * 0.13, 0, 0.22);
    // 手前
    c.save();
    c.filter = `blur(${w * 0.028}px)`;
    c.fillStyle = g(0, 1);
    c.beginPath();
    c.moveTo(ax - fr * 2.2, h);
    c.bezierCurveTo(ax - fr * 1.75, ay + fr * 2.5, ax - fr * 1.1, ay + fr * 1.3, ax, ay + fr * 1.3);
    c.bezierCurveTo(ax + fr * 1.1, ay + fr * 1.3, ax + fr * 1.75, ay + fr * 2.5, ax + fr * 2.2, h);
    c.closePath();
    c.fill();
    c.restore();
    faceBase(c, ax, ay, fr, 1.3, 200, true);
    pit(c, ax - fr * 0.41, ay - fr * 0.2, fr * 0.27, fr * 0.19, -0.09, 0.45);
    pit(c, ax + fr * 0.42, ay - fr * 0.16, fr * 0.26, fr * 0.18, 0.07, 0.45);
    ellipse(c, ax, ay + fr * 0.66, fr * 0.3, fr * 0.08, g(0, 0.85), fr * 0.08, 0.05);
  }

  /* ── ⑦ 近すぎる顔 ─────────────────────────── */
  function close(c, w, h) {
    const cx = w * 0.46;
    const cy = h * 0.26;
    const fr = w * 0.62;
    c.save();
    c.filter = `blur(${w * 0.02}px)`;
    c.fillStyle = g(0, 1);
    c.beginPath();
    c.ellipse(cx, cy, fr, fr * 1.3, 0.04, 0, Math.PI * 2);
    c.fill();
    c.restore();
    ellipse(c, cx, cy, fr * 0.94, fr * 1.22, g(150, 0.5), fr * 0.1, 0.04);
    shade(c, cx + fr * 0.72, cy, fr * 0.8, fr * 1.3, 0.92);
    shade(c, cx, cy - fr * 1.05, fr * 1.2, fr * 0.6, 0.9);
    shade(c, cx, cy + fr * 1.2, fr * 1.1, fr * 0.7, 0.8);
    // 片目だけがはっきり見える
    pit(c, cx - fr * 0.34, cy - fr * 0.1, fr * 0.19, fr * 0.13, -0.05, 0.62);
    ellipse(c, cx - fr * 0.34, cy - fr * 0.1, fr * 0.055, fr * 0.055, g(240, 0.85), fr * 0.03);
    pit(c, cx + fr * 0.28, cy - fr * 0.04, fr * 0.16, fr * 0.1, 0.04, 0.18);
    // 口はほとんど闇に沈む
    ellipse(c, cx - fr * 0.06, cy + fr * 0.6, fr * 0.3, fr * 0.07, g(0, 0.85), fr * 0.06, 0.03);
    crack(c, cx - fr * 0.52, cy - fr * 0.95, fr * 1.2, Math.PI * 0.48, fr * 0.004);
  }

  /* ── ⑧ 闇の中の目 ─────────────────────────── */
  function eyes(c, w, h) {
    // 近い順に並べる（近いほど大きく明るい＝奥行きが出る）
    const rows = [
      { x: 0.5, y: 0.235, s: 1.0 },
      { x: 0.22, y: 0.3, s: 0.72 },
      { x: 0.78, y: 0.28, s: 0.66 },
      { x: 0.37, y: 0.4, s: 0.5 },
      { x: 0.66, y: 0.44, s: 0.44 },
      { x: 0.5, y: 0.52, s: 0.34 },
    ];
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const { x, y, s } = rows[i];
      const px = w * x;
      const py = h * y;
      const fr = w * 0.15 * s;
      // 顔の気配（うっすら浮かぶだけ）
      c.save();
      c.filter = `blur(${fr * 0.55}px)`;
      c.fillStyle = g(255, 0.045 * s + 0.012);
      c.beginPath();
      c.ellipse(px, py, fr * 0.95, fr * 1.25, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
      // 目は必ず同じ間隔で対にする（ばらばらだと点にしか見えない）
      const r = fr * 0.15;
      const gap = fr * 0.42;
      const bright = 130 + 115 * s;
      litEye(c, px - gap, py, r, bright);
      litEye(c, px + gap, py + r * 0.25, r * 0.94, bright - 12);
    }
    // ぜんぶを闇で押さえる
    shade(c, w * 0.5, h * 0.72, w * 0.9, h * 0.4, 0.8);
  }

  /* ── ⑨ 伸びてくる手 ───────────────────────── */
  function hand(c, w, h) {
    const px = w * 0.5;
    const py = h * 0.42;
    const s = w * 0.2;
    c.save();
    c.filter = `blur(${w * 0.05}px)`;
    c.fillStyle = g(0, 1);
    c.beginPath();
    c.ellipse(px, h * 0.62, w * 0.5, h * 0.28, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
    puff(c, px, py, s * 2.4, s * 2.6, 0.09);
    // 手のひら
    ellipse(c, px, py + s * 0.5, s * 0.62, s * 0.78, g(178, 0.85), s * 0.09, 0.05);
    shade(c, px + s * 0.6, py + s * 0.5, s * 0.5, s * 0.85, 0.7);
    shade(c, px, py + s * 1.35, s * 0.7, s * 0.5, 0.75);
    // 指（長すぎる）
    const fingers = [
      [-0.42, -1.35, -0.16], [-0.14, -1.62, -0.05], [0.16, -1.55, 0.05], [0.44, -1.2, 0.17],
    ];
    for (const [dx, dy, rot] of fingers) {
      ellipse(c, px + s * dx, py + s * (0.5 + dy * 0.5), s * 0.115, s * Math.abs(dy) * 0.5, g(186, 0.85), s * 0.06, rot);
      shade(c, px + s * dx + s * 0.1, py + s * (0.5 + dy * 0.5), s * 0.09, s * Math.abs(dy) * 0.45, 0.6);
    }
    // 親指
    ellipse(c, px - s * 0.68, py + s * 0.62, s * 0.11, s * 0.36, g(170, 0.8), s * 0.06, -0.7);
    // 腕は闇へ
    shade(c, px, py + s * 2.1, s * 1.2, s * 1.1, 0.9);
  }

  /* ── ⑩ 覗いている顔 ───────────────────────── */
  function peek(c, w, h) {
    const cx = w * 0.68;
    const cy = h * 0.27;
    const fr = w * 0.2;
    // 手前の柱（暗い縦の帯）
    c.save();
    c.filter = `blur(${w * 0.02}px)`;
    c.fillStyle = g(0, 1);
    c.fillRect(0, 0, w * 0.44, h);
    c.restore();
    c.save();
    c.filter = `blur(${w * 0.03}px)`;
    c.fillStyle = g(0, 1);
    c.beginPath();
    c.ellipse(cx + fr * 0.5, cy, fr * 1.15, fr * 1.5, 0.06, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(cx - fr * 0.6, h);
    c.bezierCurveTo(cx - fr * 0.4, cy + fr * 2.4, cx + fr * 0.2, cy + fr * 1.4, cx + fr * 0.9, cy + fr * 1.4);
    c.lineTo(w, h);
    c.closePath();
    c.fill();
    c.restore();
    // 半分だけ出ている顔
    ellipse(c, cx + fr * 0.3, cy, fr * 0.9, fr * 1.24, g(198, 0.9), fr * 0.06, 0.05);
    shade(c, cx + fr * 1.05, cy, fr * 0.7, fr * 1.3, 0.85);
    shade(c, cx + fr * 0.3, cy - fr * 1.2, fr * 1.0, fr * 0.6, 0.85);
    shade(c, cx + fr * 0.3, cy + fr * 1.2, fr * 0.9, fr * 0.6, 0.8);
    pit(c, cx - fr * 0.02, cy - fr * 0.16, fr * 0.27, fr * 0.19, -0.06, 0.6);
    pit(c, cx + fr * 0.62, cy - fr * 0.12, fr * 0.24, fr * 0.17, 0.05, 0.35);
    ellipse(c, cx + fr * 0.3, cy + fr * 0.6, fr * 0.28, fr * 0.075, g(0, 0.85), fr * 0.07, 0.04);
    // 柱のふちの明かり
    c.save();
    c.filter = `blur(${w * 0.006}px)`;
    c.fillStyle = g(255, 0.09);
    c.fillRect(w * 0.435, 0, w * 0.008, h);
    c.restore();
  }

  const FIGURES = [
    { id: 'veil', draw: veil },
    { id: 'grin', draw: grin },
    { id: 'water', draw: water },
    { id: 'noh', draw: noh },
    { id: 'hood', draw: hood },
    { id: 'pair', draw: pair },
    { id: 'close', draw: close },
    { id: 'eyes', draw: eyes },
    { id: 'hand', draw: hand },
    { id: 'peek', draw: peek },
  ];

  /** 光の向きを図ごとに変える（毎回同じ所から照らすと作り物に見える） */
  const LIGHT = {
    veil: [0.44, 0.2], grin: [0.5, 0.22], water: [0.5, 0.28], noh: [0.58, 0.2],
    hood: [0.5, 0.3], pair: [0.34, 0.22], close: [0.32, 0.22], eyes: [0.5, 0.26],
    hand: [0.5, 0.36], peek: [0.7, 0.22],
  };

  /** 渡されたキャンバスに1枚描く */
  function paint(c, id, w, h) {
    const found = FIGURES.find((f) => f.id === id);
    const lit = LIGHT[id] || [0.5, 0.24];
    ground(c, w, h, lit[0], lit[1]);
    found.draw(c, w, h);
    scratches(c, w, h, 8);
    vignette(c, w, h);
    grain(c, w, h, 15);
  }

  /** 1枚描いて data URL を返す */
  function render(id, w, h) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    paint(cv.getContext('2d'), id, w, h);
    return cv.toDataURL('image/webp', 0.72);
  }

  global.KAGAMI_FIGURES = { FIGURES, paint, render };
})(window);
