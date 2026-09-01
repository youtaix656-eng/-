/* eslint-disable */
// 地に敷く面（おもて）を、キャンバスに描いて画像へ焼く。
//
// **色を持たない。** ここで使う色は必ず rgb(v,v,v) / rgba(v,v,v,a) の灰色だけ。
// 1色でも入れた瞬間に、このアプリは図版ではなくなる。
// 生成した画像は src/assets/figures/*.webp（tools/make-figures.mjs が書き出す）。

(function (global) {
  const g = (v, a) => (a === undefined ? `rgb(${v},${v},${v})` : `rgba(${v},${v},${v},${a})`);

  /** 黒地と、上から差す薄明かり */
  function ground(c, w, h) {
    c.fillStyle = g(6);
    c.fillRect(0, 0, w, h);
    const lit = c.createRadialGradient(w / 2, h * 0.26, 0, w / 2, h * 0.26, w * 0.95);
    lit.addColorStop(0, g(255, 0.1));
    lit.addColorStop(0.55, g(255, 0.028));
    lit.addColorStop(1, g(255, 0));
    c.fillStyle = lit;
    c.fillRect(0, 0, w, h);
  }

  /** ぼかした塊（エアブラシ） */
  function puff(c, x, y, rx, ry, alpha, rot) {
    c.save();
    c.translate(x, y);
    if (rot) c.rotate(rot);
    c.scale(1, ry / rx);
    const gd = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    gd.addColorStop(0, g(255, alpha));
    gd.addColorStop(0.62, g(255, alpha * 0.5));
    gd.addColorStop(1, g(255, 0));
    c.fillStyle = gd;
    c.beginPath();
    c.arc(0, 0, rx, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  /** 闇（黒い塊）。彫りを削るときに使う */
  function shade(c, x, y, rx, ry, alpha, rot) {
    c.save();
    c.translate(x, y);
    if (rot) c.rotate(rot);
    c.scale(1, ry / rx);
    const gd = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    gd.addColorStop(0, g(0, alpha));
    gd.addColorStop(0.6, g(0, alpha * 0.55));
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

  /** 炭の粒。**動かさない**——読みやすさを壊さないため薄く一度だけ */
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

  /** 縁を落とす */
  function vignette(c, w, h) {
    const gd = c.createRadialGradient(w / 2, h * 0.42, w * 0.22, w / 2, h * 0.46, h * 0.78);
    gd.addColorStop(0, g(0, 0));
    gd.addColorStop(0.62, g(0, 0.35));
    gd.addColorStop(1, g(0, 0.92));
    c.fillStyle = gd;
    c.fillRect(0, 0, w, h);
  }

  /** 目（黒く落ちくぼんだ穴）と、そのふちの明かり */
  function hollowEye(c, x, y, rx, ry, rim) {
    ellipse(c, x, y, rx * 1.5, ry * 1.7, g(0, 0.9), rx * 0.5);
    ellipse(c, x, y, rx, ry, g(0, 1), rx * 0.22);
    if (rim) {
      c.save();
      c.filter = `blur(${rx * 0.3}px)`;
      c.strokeStyle = g(255, rim);
      c.lineWidth = rx * 0.16;
      c.beginPath();
      c.ellipse(x, y + ry * 0.16, rx * 1.06, ry * 1.06, 0, Math.PI * 0.08, Math.PI * 0.92);
      c.stroke();
      c.restore();
    }
  }

  /** 光る目（水面・笑う面） */
  function litEye(c, x, y, r) {
    puff(c, x, y, r * 2.1, r * 2.1, 0.5);
    ellipse(c, x, y, r, r, g(238, 0.96), r * 0.14);
    ellipse(c, x - r * 0.22, y - r * 0.24, r * 0.4, r * 0.4, g(255, 0.9), r * 0.3);
  }

  /* ── ① 長い髪の面 ─────────────────────────── */
  function veil(c, w, h) {
    const cx = w / 2;
    const fy = h * 0.3;
    const fr = w * 0.215;
    // 髪と身体（黒い塊）。輪郭のふちにだけ薄く光を回す
    puff(c, cx, h * 0.34, w * 0.44, h * 0.34, 0.1);
    c.save();
    c.filter = `blur(${w * 0.035}px)`;
    c.fillStyle = g(0, 1);
    c.beginPath();
    c.moveTo(cx - w * 0.3, h);
    c.bezierCurveTo(cx - w * 0.32, h * 0.55, cx - w * 0.3, h * 0.2, cx, h * 0.09);
    c.bezierCurveTo(cx + w * 0.3, h * 0.2, cx + w * 0.32, h * 0.55, cx + w * 0.3, h);
    c.closePath();
    c.fill();
    c.restore();
    // 面
    puff(c, cx, fy, fr * 1.5, fr * 2.0, 0.16);
    ellipse(c, cx, fy, fr, fr * 1.42, g(214, 0.92), fr * 0.14);
    shade(c, cx, fy + fr * 1.15, fr * 1.1, fr * 0.8, 0.5);
    shade(c, cx - fr * 1.02, fy, fr * 0.6, fr * 1.3, 0.55);
    shade(c, cx + fr * 1.02, fy, fr * 0.6, fr * 1.3, 0.55);
    // 目・口
    hollowEye(c, cx - fr * 0.44, fy - fr * 0.2, fr * 0.3, fr * 0.19, 0.5);
    hollowEye(c, cx + fr * 0.44, fy - fr * 0.2, fr * 0.3, fr * 0.19, 0.5);
    ellipse(c, cx - fr * 0.44, fy - fr * 0.52, fr * 0.34, fr * 0.07, g(0, 0.8), fr * 0.14);
    ellipse(c, cx + fr * 0.44, fy - fr * 0.52, fr * 0.34, fr * 0.07, g(0, 0.8), fr * 0.14);
    // 三日月の口
    c.save();
    c.filter = `blur(${fr * 0.09}px)`;
    c.fillStyle = g(0, 0.95);
    c.beginPath();
    c.moveTo(cx - fr * 0.62, fy + fr * 0.42);
    c.quadraticCurveTo(cx, fy + fr * 1.12, cx + fr * 0.62, fy + fr * 0.42);
    c.quadraticCurveTo(cx, fy + fr * 0.68, cx - fr * 0.62, fy + fr * 0.42);
    c.closePath();
    c.fill();
    c.restore();
    puff(c, cx, fy + fr * 0.78, fr * 0.5, fr * 0.2, 0.18);
  }

  /* ── ② 笑う面 ─────────────────────────────── */
  function grin(c, w, h) {
    const cx = w / 2;
    const cy = h * 0.27;
    const r = w * 0.42;
    puff(c, cx, cy, r * 1.35, r * 1.5, 0.13);
    c.save();
    c.filter = `blur(${w * 0.03}px)`;
    c.fillStyle = g(0, 1);
    c.beginPath();
    c.ellipse(cx, cy, r, r * 1.14, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(cx - r * 1.05, h);
    c.bezierCurveTo(cx - r * 0.95, cy + r * 1.5, cx - r * 0.6, cy + r * 1.0, cx, cy + r * 1.0);
    c.bezierCurveTo(cx + r * 0.6, cy + r * 1.0, cx + r * 0.95, cy + r * 1.5, cx + r * 1.05, h);
    c.closePath();
    c.fill();
    c.restore();
    // 目
    litEye(c, cx - r * 0.4, cy - r * 0.16, r * 0.155);
    litEye(c, cx + r * 0.4, cy - r * 0.16, r * 0.155);
    // 大きな口と歯
    const my = cy + r * 0.42;
    const mw = r * 0.86;
    c.save();
    c.filter = `blur(${r * 0.02}px)`;
    c.fillStyle = g(232, 0.92);
    c.beginPath();
    c.moveTo(cx - mw, my - r * 0.1);
    c.quadraticCurveTo(cx, my + r * 0.52, cx + mw, my - r * 0.1);
    c.quadraticCurveTo(cx, my + r * 0.12, cx - mw, my - r * 0.1);
    c.closePath();
    c.fill();
    c.restore();
    c.save();
    c.strokeStyle = g(0, 0.85);
    c.lineWidth = Math.max(1.5, r * 0.014);
    for (let i = 1; i < 16; i += 1) {
      const t = i / 16;
      const x = cx - mw + 2 * mw * t;
      const top = my - r * 0.1 + (my + r * 0.12 - (my - r * 0.1)) * 4 * t * (1 - t) * 0.5;
      const bot = my - r * 0.1 + (my + r * 0.52 - (my - r * 0.1)) * 4 * t * (1 - t);
      c.beginPath();
      c.moveTo(x, top);
      c.lineTo(x, bot);
      c.stroke();
    }
    c.restore();
    shade(c, cx, my + r * 0.5, mw * 0.9, r * 0.3, 0.5);
  }

  /* ── ③ 水面の目 ───────────────────────────── */
  function water(c, w, h) {
    const cx = w / 2;
    const line = h * 0.42;
    const fr = w * 0.27;
    const fy = line - fr * 0.66;
    puff(c, cx, fy, fr * 1.6, fr * 1.6, 0.08);
    // 水から出ている頭
    ellipse(c, cx, fy, fr * 0.92, fr * 1.16, g(150, 0.66), fr * 0.1);
    // 髪で上と左右を落とす（顔の輪郭を出す）
    shade(c, cx, fy - fr * 0.86, fr * 1.25, fr * 0.72, 0.95);
    shade(c, cx - fr * 0.92, fy - fr * 0.1, fr * 0.62, fr * 1.15, 0.85);
    shade(c, cx + fr * 0.92, fy - fr * 0.1, fr * 0.62, fr * 1.15, 0.85);
    shade(c, cx, fy + fr * 0.98, fr * 1.0, fr * 0.5, 0.5);
    litEye(c, cx - fr * 0.44, fy + fr * 0.14, fr * 0.155);
    litEye(c, cx + fr * 0.44, fy + fr * 0.14, fr * 0.155);
    // 水面から下は落とす
    c.save();
    c.filter = `blur(${h * 0.012}px)`;
    c.fillStyle = g(0, 0.97);
    c.fillRect(0, line, w, h - line);
    c.restore();
    // 水面の線と波紋
    c.save();
    c.strokeStyle = g(255, 0.3);
    c.lineWidth = Math.max(1.5, h * 0.0016);
    c.filter = `blur(${h * 0.002}px)`;
    c.beginPath();
    c.moveTo(0, line);
    c.lineTo(w, line);
    c.stroke();
    for (let i = 0; i < 7; i += 1) {
      const y = line + h * (0.016 + i * i * 0.006);
      c.globalAlpha = 0.3 - i * 0.038;
      c.beginPath();
      c.moveTo(-w * 0.05, y);
      c.bezierCurveTo(w * 0.3, y - h * 0.008, w * 0.7, y + h * 0.008, w * 1.05, y);
      c.stroke();
    }
    c.restore();
    puff(c, cx, line, w * 0.5, h * 0.02, 0.16);
  }

  /* ── ④ 能の面 ─────────────────────────────── */
  function noh(c, w, h) {
    const cx = w / 2;
    const fy = h * 0.29;
    const fr = w * 0.23;
    puff(c, cx, fy, fr * 1.6, fr * 2.0, 0.14);
    ellipse(c, cx, fy, fr, fr * 1.46, g(222, 0.95), fr * 0.1);
    shade(c, cx, fy + fr * 1.3, fr * 1.0, fr * 0.7, 0.55);
    shade(c, cx - fr * 1.0, fy + fr * 0.1, fr * 0.55, fr * 1.3, 0.5);
    shade(c, cx + fr * 1.0, fy + fr * 0.1, fr * 0.55, fr * 1.3, 0.5);
    // 細い目と口
    ellipse(c, cx - fr * 0.42, fy - fr * 0.24, fr * 0.26, fr * 0.075, g(0, 0.95), fr * 0.05);
    ellipse(c, cx + fr * 0.42, fy - fr * 0.24, fr * 0.26, fr * 0.075, g(0, 0.95), fr * 0.05);
    ellipse(c, cx, fy + fr * 0.62, fr * 0.24, fr * 0.075, g(0, 0.9), fr * 0.05);
    // 眉
    ellipse(c, cx - fr * 0.44, fy - fr * 0.56, fr * 0.24, fr * 0.06, g(0, 0.55), fr * 0.09);
    ellipse(c, cx + fr * 0.44, fy - fr * 0.56, fr * 0.24, fr * 0.06, g(0, 0.55), fr * 0.09);
    // 髪と襟
    c.save();
    c.filter = `blur(${w * 0.03}px)`;
    c.fillStyle = g(0, 0.95);
    c.beginPath();
    c.moveTo(cx - w * 0.34, h);
    c.bezierCurveTo(cx - w * 0.3, h * 0.62, cx - w * 0.24, h * 0.46, cx, h * 0.45);
    c.bezierCurveTo(cx + w * 0.24, h * 0.46, cx + w * 0.3, h * 0.62, cx + w * 0.34, h);
    c.closePath();
    c.fill();
    c.restore();
    puff(c, cx, h * 0.47, w * 0.26, h * 0.02, 0.13);
  }

  /* ── ⑤ フードの影 ─────────────────────────── */
  function hood(c, w, h) {
    const cx = w / 2;
    const fy = h * 0.3;
    const fr = w * 0.2;
    puff(c, cx, h * 0.26, w * 0.5, h * 0.3, 0.12);
    c.save();
    c.filter = `blur(${w * 0.04}px)`;
    c.fillStyle = g(0, 1);
    c.beginPath();
    c.moveTo(cx - w * 0.42, h);
    c.bezierCurveTo(cx - w * 0.4, h * 0.42, cx - w * 0.34, h * 0.08, cx, h * 0.06);
    c.bezierCurveTo(cx + w * 0.34, h * 0.08, cx + w * 0.4, h * 0.42, cx + w * 0.42, h);
    c.closePath();
    c.fill();
    c.restore();
    // 頭巾の中の面（半分だけ光が入る）
    ellipse(c, cx, fy, fr, fr * 1.34, g(150, 0.62), fr * 0.22);
    shade(c, cx, fy - fr * 1.1, fr * 1.2, fr * 0.8, 0.85);
    shade(c, cx - fr * 0.95, fy, fr * 0.7, fr * 1.3, 0.7);
    shade(c, cx + fr * 0.95, fy, fr * 0.7, fr * 1.3, 0.7);
    hollowEye(c, cx - fr * 0.42, fy - fr * 0.16, fr * 0.28, fr * 0.2, 0.6);
    hollowEye(c, cx + fr * 0.42, fy - fr * 0.16, fr * 0.28, fr * 0.2, 0.6);
    ellipse(c, cx, fy + fr * 0.62, fr * 0.3, fr * 0.1, g(0, 0.75), fr * 0.12);
    // 頭巾のふち
    c.save();
    c.filter = `blur(${w * 0.012}px)`;
    c.strokeStyle = g(255, 0.13);
    c.lineWidth = w * 0.01;
    c.beginPath();
    c.ellipse(cx, fy, fr * 1.5, fr * 1.75, 0, Math.PI * 1.05, Math.PI * 1.95);
    c.stroke();
    c.restore();
  }

  /* ── ⑥ 二つの影 ───────────────────────────── */
  function pair(c, w, h) {
    const fr = w * 0.185;
    const ax = w * 0.35;
    const ay = h * 0.29;
    const bx = w * 0.72;
    const by = h * 0.35;
    puff(c, w * 0.5, h * 0.3, w * 0.5, h * 0.3, 0.1);
    // 奥
    c.save();
    c.filter = `blur(${w * 0.035}px)`;
    c.fillStyle = g(0, 1);
    c.beginPath();
    c.ellipse(bx, by, fr * 0.86, fr * 1.1, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(bx - fr * 1.9, h);
    c.bezierCurveTo(bx - fr * 1.5, by + fr * 2.2, bx - fr * 0.9, by + fr * 1.1, bx, by + fr * 1.1);
    c.bezierCurveTo(bx + fr * 0.9, by + fr * 1.1, bx + fr * 1.5, by + fr * 2.2, bx + fr * 1.9, h);
    c.closePath();
    c.fill();
    c.restore();
    ellipse(c, bx, by, fr * 0.8, fr * 1.0, g(96, 0.5), fr * 0.3);
    hollowEye(c, bx - fr * 0.32, by - fr * 0.1, fr * 0.18, fr * 0.12, 0.3);
    hollowEye(c, bx + fr * 0.32, by - fr * 0.1, fr * 0.18, fr * 0.12, 0.3);
    // 手前
    c.save();
    c.filter = `blur(${w * 0.03}px)`;
    c.fillStyle = g(0, 1);
    c.beginPath();
    c.moveTo(ax - fr * 2.1, h);
    c.bezierCurveTo(ax - fr * 1.7, ay + fr * 2.4, ax - fr * 1.05, ay + fr * 1.25, ax, ay + fr * 1.25);
    c.bezierCurveTo(ax + fr * 1.05, ay + fr * 1.25, ax + fr * 1.7, ay + fr * 2.4, ax + fr * 2.1, h);
    c.closePath();
    c.fill();
    c.restore();
    ellipse(c, ax, ay, fr, fr * 1.28, g(206, 0.9), fr * 0.16);
    shade(c, ax, ay + fr * 1.15, fr * 1.1, fr * 0.7, 0.55);
    shade(c, ax - fr * 1.0, ay, fr * 0.6, fr * 1.2, 0.55);
    shade(c, ax + fr * 1.0, ay, fr * 0.6, fr * 1.2, 0.55);
    hollowEye(c, ax - fr * 0.4, ay - fr * 0.18, fr * 0.26, fr * 0.17, 0.5);
    hollowEye(c, ax + fr * 0.4, ay - fr * 0.18, fr * 0.26, fr * 0.17, 0.5);
    ellipse(c, ax, ay + fr * 0.62, fr * 0.32, fr * 0.09, g(0, 0.8), fr * 0.1);
  }

  const FIGURES = [
    { id: 'veil', draw: veil },
    { id: 'grin', draw: grin },
    { id: 'water', draw: water },
    { id: 'noh', draw: noh },
    { id: 'hood', draw: hood },
    { id: 'pair', draw: pair },
  ];

  /** 渡されたキャンバスに1枚描く */
  function paint(c, id, w, h) {
    const found = FIGURES.find((f) => f.id === id);
    ground(c, w, h);
    found.draw(c, w, h);
    vignette(c, w, h);
    grain(c, w, h, 13);
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
