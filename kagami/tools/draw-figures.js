/* eslint-disable */
// 地に敷く面（おもて）を、キャンバスに描いて画像へ焼く。
//
// **色を持たない。** ここで使う色は必ず g() が組み立てる灰色だけ
// （焼くときに全画素を見て、1点でも色が付いていたら止める）。
//
// こわさの作り方（2026-08-30 の参考画像から決めたこと）:
//   1. **なめらかに塗らない。** 面は木炭を擦った線の重なりで作る——
//      きれいなグラデーションは「作り物」に見えて、こわくない。
//   2. **目は真っ黒の穴。** ふちだけ細く光らせて深さを出す。ぼかすと優しくなる。
//   3. **口は開けておく。** 閉じた口は落ち着いて見える。裂けた黒い穴＋不揃いの歯。
//   4. **左右をずらす。** 完全な左右対称は飾りに見える。
//   5. **全部を照らさない。** 半分は闇に残す（見えない所を人は補って怖がる）。
//   6. **傷・走査線・粒**を入れる。写真や複写が傷んで見えるだけで不穏になる。
//   7. それでも**文字の下に濃く敷かない**。読みにくくなった時点で本末転倒。

(function (global) {
  const g = (v, a) => (a === undefined ? `rgb(${v},${v},${v})` : `rgba(${v},${v},${v},${a})`);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ── 下地 ───────────────────────────────── */

  function ground(c, w, h, lx, ly, lit) {
    c.fillStyle = g(4);
    c.fillRect(0, 0, w, h);
    const gd = c.createRadialGradient(w * lx, h * ly, 0, w * lx, h * ly, w * 1.1);
    gd.addColorStop(0, g(255, lit === undefined ? 0.07 : lit));
    gd.addColorStop(0.5, g(255, 0.018));
    gd.addColorStop(1, g(255, 0));
    c.fillStyle = gd;
    c.fillRect(0, 0, w, h);
  }

  /* ── 木炭の線 ───────────────────────────── */

  /** 1本。**まっすぐ引かない**——手で擦った線は必ず揺れる */
  function chalk(c, x1, y1, x2, y2, width, alpha, tone) {
    c.save();
    c.strokeStyle = g(tone === undefined ? 236 : tone, alpha);
    c.lineWidth = width;
    c.lineCap = 'round';
    const mx = (x1 + x2) / 2 + rnd(-width * 2.2, width * 2.2);
    const my = (y1 + y2) / 2 + rnd(-width * 2.2, width * 2.2);
    c.beginPath();
    c.moveTo(x1, y1);
    c.quadraticCurveTo(mx, my, x2, y2);
    c.stroke();
    c.restore();
  }

  /**
   * 面を線の重なりで埋める。**塗りつぶさない**——線の間から地が見えるのが木炭。
   * @param {(c:CanvasRenderingContext2D)=>void} path 型（clip に使う）
   */
  function scrub(c, path, spec) {
    const { x, y, rx, ry, dir = -0.35, n = 260, len = 0.5, w = 2, alpha = 0.16, tone = 232, blur = 0 } = spec;
    c.save();
    if (blur) c.filter = `blur(${blur}px)`;
    c.beginPath();
    path(c);
    c.clip();
    for (let i = 0; i < n; i += 1) {
      const px = x + rnd(-rx, rx);
      const py = y + rnd(-ry, ry);
      const a = dir + rnd(-0.32, 0.32);
      const l = rx * len * rnd(0.35, 1.25);
      chalk(
        c, px - Math.cos(a) * l * 0.5, py - Math.sin(a) * l * 0.5,
        px + Math.cos(a) * l * 0.5, py + Math.sin(a) * l * 0.5,
        w * rnd(0.55, 1.6), alpha * rnd(0.4, 1.5), tone,
      );
    }
    c.restore();
  }

  /** 指で擦ったにじみ */
  function smudge(c, x, y, rx, ry, alpha, tone, rot) {
    c.save();
    c.translate(x, y);
    if (rot) c.rotate(rot);
    c.scale(1, ry / rx);
    const gd = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    gd.addColorStop(0, g(tone === undefined ? 255 : tone, alpha));
    gd.addColorStop(0.55, g(tone === undefined ? 255 : tone, alpha * 0.42));
    gd.addColorStop(1, g(tone === undefined ? 255 : tone, 0));
    c.fillStyle = gd;
    c.beginPath();
    c.arc(0, 0, rx, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  const dark = (c, x, y, rx, ry, a, rot) => smudge(c, x, y, rx, ry, a, 0, rot);

  function ellipse(c, x, y, rx, ry, fill, blur, rot) {
    c.save();
    if (blur) c.filter = `blur(${blur}px)`;
    c.fillStyle = fill;
    c.beginPath();
    c.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  const oval = (x, y, rx, ry, rot) => (c) => c.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);

  /**
   * 頭の形。**まん丸にしない**——上（頭蓋）が広く、下（顎）が細いだけで、
   * 人の顔として読めるようになり、こわさが段違いになる。
   * @param jaw 顎の細さ（小さいほど尖る）
   */
  const headPath = (cx, cy, rx, ry, jaw) => (c) => {
    const j = jaw === undefined ? 0.6 : jaw;
    c.moveTo(cx, cy - ry);
    c.bezierCurveTo(cx + rx * 1.05, cy - ry * 0.94, cx + rx * 1.08, cy + ry * 0.02, cx + rx * j, cy + ry * 0.5);
    c.bezierCurveTo(cx + rx * j * 0.66, cy + ry * 1.02, cx - rx * j * 0.66, cy + ry * 1.02, cx - rx * j, cy + ry * 0.5);
    c.bezierCurveTo(cx - rx * 1.08, cy + ry * 0.02, cx - rx * 1.05, cy - ry * 0.94, cx, cy - ry);
    c.closePath();
  };

  /* ── 顔の部品 ───────────────────────────── */

  /** 真っ黒の穴。ふちだけ細く光らせる */
  function pit(c, x, y, rx, ry, rot, rim) {
    dark(c, x, y, rx * 1.7, ry * 2.0, 0.7, rot);
    ellipse(c, x, y, rx, ry, g(0, 1), rx * 0.08, rot);
    c.save();
    c.filter = `blur(${rx * 0.16}px)`;
    c.strokeStyle = g(248, rim === undefined ? 0.45 : rim);
    c.lineWidth = rx * 0.1;
    c.beginPath();
    c.ellipse(x, y + ry * 0.22, rx * 1.02, ry * 1.02, rot || 0, Math.PI * 0.1, Math.PI * 0.9);
    c.stroke();
    c.restore();
  }

  /** 点のような瞳（骨の顔）。**大きい黒の中の小さな光**がいちばん落ち着かない */
  function pinPupil(c, x, y, r) {
    ellipse(c, x, y, r, r, g(252, 0.95), r * 0.25);
  }

  /** 叫ぶ口。裂けた黒い穴と、不揃いの歯 */
  function scream(c, cx, cy, rx, ry, teeth) {
    dark(c, cx, cy, rx * 1.6, ry * 1.7, 0.75);
    c.save();
    c.filter = `blur(${rx * 0.04}px)`;
    c.fillStyle = g(0, 1);
    c.beginPath();
    c.moveTo(cx - rx, cy - ry * 0.55);
    c.bezierCurveTo(cx - rx * 0.5, cy - ry * 1.1, cx + rx * 0.5, cy - ry * 1.1, cx + rx, cy - ry * 0.5);
    c.bezierCurveTo(cx + rx * 0.85, cy + ry * 1.15, cx - rx * 0.85, cy + ry * 1.15, cx - rx, cy - ry * 0.55);
    c.closePath();
    c.fill();
    c.restore();
    // ふちの明かり
    c.save();
    c.filter = `blur(${rx * 0.12}px)`;
    c.strokeStyle = g(232, 0.3);
    c.lineWidth = rx * 0.05;
    c.beginPath();
    c.ellipse(cx, cy, rx * 1.02, ry * 1.0, 0, 0, Math.PI * 2);
    c.stroke();
    c.restore();
    if (!teeth) return;
    c.save();
    c.fillStyle = g(226, 0.9);
    for (let i = 0; i < teeth; i += 1) {
      const t = (i + 0.5) / teeth;
      const x = cx - rx * 0.9 + rx * 1.8 * t;
      const shape = 4 * t * (1 - t);
      const tw = (rx * 1.8) / teeth * rnd(0.5, 0.78);
      const th = ry * rnd(0.24, 0.5) * (0.5 + shape);
      c.beginPath();
      c.moveTo(x - tw / 2, cy - ry * 0.82 * shape - ry * 0.1);
      c.lineTo(x + tw / 2, cy - ry * 0.82 * shape - ry * 0.1);
      c.lineTo(x + rnd(-tw * 0.2, tw * 0.2), cy - ry * 0.82 * shape - ry * 0.1 + th);
      c.closePath();
      c.fill();
      // 下の歯
      c.beginPath();
      c.moveTo(x - tw / 2, cy + ry * 0.78 * shape + ry * 0.1);
      c.lineTo(x + tw / 2, cy + ry * 0.78 * shape + ry * 0.1);
      c.lineTo(x + rnd(-tw * 0.2, tw * 0.2), cy + ry * 0.78 * shape + ry * 0.1 - th * 0.7);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  /** 横に裂けた笑い（歯が並ぶ） */
  function grinMouth(c, cx, cy, rx, ry, teeth) {
    c.save();
    c.filter = `blur(${rx * 0.02}px)`;
    c.fillStyle = g(228, 0.94);
    c.beginPath();
    c.moveTo(cx - rx, cy - ry * 0.35);
    c.quadraticCurveTo(cx + rx * 0.02, cy + ry * 1.5, cx + rx, cy - ry * 0.42);
    c.quadraticCurveTo(cx, cy + ry * 0.35, cx - rx, cy - ry * 0.35);
    c.closePath();
    c.fill();
    c.restore();
    c.save();
    c.strokeStyle = g(0, 0.92);
    for (let i = 1; i < teeth; i += 1) {
      const t = i / teeth;
      const x = cx - rx + 2 * rx * t + rnd(-rx * 0.012, rx * 0.012);
      const shape = 4 * t * (1 - t);
      c.lineWidth = rx * rnd(0.008, 0.02);
      c.beginPath();
      c.moveTo(x, cy - ry * 0.35 + ry * 0.7 * shape * 0.5);
      c.lineTo(x, cy - ry * 0.35 + ry * 1.85 * shape * rnd(0.85, 1.05));
      c.stroke();
    }
    c.restore();
    dark(c, cx, cy + ry * 1.3, rx * 0.95, ry * 0.8, 0.5);
  }

  /** 放射状のトゲ（参考画像1） */
  function spikes(c, cx, cy, rx, ry, n, len) {
    c.save();
    for (let i = 0; i < n; i += 1) {
      const a = Math.PI * rnd(0.98, 2.02) + (i / n) * 0.02;
      const sx = cx + Math.cos(a) * rx;
      const sy = cy + Math.sin(a) * ry;
      const l = len * rnd(0.4, 1.4);
      const tx = sx + Math.cos(a) * l + rnd(-6, 6);
      const ty = sy + Math.sin(a) * l + rnd(-6, 6);
      const bw = rnd(len * 0.035, len * 0.1);
      // 根元が太く先が尖る三角（線だと毛に見えて、こわくない）
      c.fillStyle = g(pick([0, 0, 0, 40]), rnd(0.65, 0.98));
      c.beginPath();
      c.moveTo(sx + Math.cos(a + 1.57) * bw, sy + Math.sin(a + 1.57) * bw);
      c.lineTo(sx - Math.cos(a + 1.57) * bw, sy - Math.sin(a + 1.57) * bw);
      c.lineTo(tx, ty);
      c.closePath();
      c.fill();
      c.strokeStyle = g(226, rnd(0.06, 0.22));
      c.lineWidth = rnd(0.5, 1.3);
      c.beginPath();
      c.moveTo(sx + Math.cos(a + 1.57) * bw, sy + Math.sin(a + 1.57) * bw);
      c.lineTo(tx, ty);
      c.stroke();
    }
    c.restore();
  }

  /* ── 傷み ───────────────────────────────── */

  function scratches(c, w, h, n) {
    c.save();
    for (let i = 0; i < n; i += 1) {
      const x = rnd(0, w);
      const y0 = rnd(0, h * 0.8);
      c.strokeStyle = g(255, rnd(0.01, 0.05));
      c.lineWidth = rnd(0.6, 2.2);
      c.filter = `blur(${rnd(0.4, 2)}px)`;
      c.beginPath();
      c.moveTo(x, y0);
      c.lineTo(x + rnd(-5, 5), y0 + rnd(h * 0.05, h * 0.35));
      c.stroke();
    }
    c.restore();
  }

  /** 走査線（参考画像3・6。ブラウン管の乱れ） */
  function scanlines(c, w, h, gap, alpha) {
    c.save();
    c.fillStyle = g(0, alpha);
    for (let y = 0; y < h; y += gap) c.fillRect(0, y, w, Math.max(1, gap * 0.42));
    // ときどき明るい帯が走る
    for (let i = 0; i < 4; i += 1) {
      const y = rnd(0, h);
      c.fillStyle = g(255, rnd(0.015, 0.05));
      c.fillRect(0, y, w, rnd(1, h * 0.012));
    }
    c.restore();
  }

  /** 縦の乱れ（信号が飛んだときのずれ） */
  function tear(c, w, h, n) {
    for (let i = 0; i < n; i += 1) {
      const y = Math.floor(rnd(0, h - 8));
      const th = Math.floor(rnd(2, 14));
      const dx = Math.round(rnd(-w * 0.03, w * 0.03));
      const band = c.getImageData(0, y, w, th);
      c.putImageData(band, dx, y);
    }
  }

  function grain(c, w, h, amount) {
    const img = c.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * amount;
      const v = Math.max(0, Math.min(255, d[i] + n));
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
    }
    c.putImageData(img, 0, 0);
  }

  /** 複写機でつぶしたような、白と黒だけの粒（参考画像7） */
  function dither(c, w, h, hard) {
    const img = c.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i] + (Math.random() - 0.5) * 96;
      const t = v > 118 ? 255 : 0;
      const out = d[i] + (t - d[i]) * hard;
      d[i] = out;
      d[i + 1] = out;
      d[i + 2] = out;
    }
    c.putImageData(img, 0, 0);
  }

  function vignette(c, w, h, strength) {
    const gd = c.createRadialGradient(w / 2, h * 0.34, w * 0.14, w / 2, h * 0.4, h * 0.74);
    gd.addColorStop(0, g(0, 0));
    gd.addColorStop(0.5, g(0, 0.34 * (strength || 1)));
    gd.addColorStop(1, g(0, 0.97));
    c.fillStyle = gd;
    c.fillRect(0, 0, w, h);
  }

  /** 首から下は闇に沈める（下に文字が来るので必ず落とす） */
  function sink(c, w, h, from) {
    const gd = c.createLinearGradient(0, h * from, 0, h);
    gd.addColorStop(0, g(0, 0));
    gd.addColorStop(0.45, g(0, 0.8));
    gd.addColorStop(1, g(0, 1));
    c.fillStyle = gd;
    c.fillRect(0, h * from, w, h * (1 - from));
  }

  /**
   * 木炭で描いた顔の下地（面を線で作る）。
   *
   * ここでいちばん大事なのは **明暗の境目を硬くする** こと。
   * なめらかに回り込ませると粘土の模型に見える。参考画像の顔が冷たいのは、
   * 光の当たった側がほぼ白、当たらない側がほぼ黒で、その境が**ぎざぎざ**だから。
   */
  function chalkFace(c, cx, cy, rx, ry, tone, lightLeft, opts) {
    const o = opts || {};
    const path = o.path || headPath(cx, cy, rx, ry, o.jaw);
    const s = lightLeft ? -1 : 1;
    smudge(c, cx, cy, rx * 1.35, ry * 1.25, 0.07);

    // 明るい側にだけ強く光を置く（全体を均一に塗らない）
    c.save();
    c.beginPath();
    path(c);
    c.clip();
    smudge(c, cx + rx * 0.5 * s, cy - ry * 0.16, rx * 0.9, ry * 0.92, 0.5, tone);
    smudge(c, cx + rx * 0.34 * s, cy - ry * 0.3, rx * 0.5, ry * 0.44, 0.42, Math.min(255, tone + 20));
    c.restore();

    // 木炭の筋（長め・形に沿わせる）
    scrub(c, path, {
      x: cx, y: cy, rx: rx * 1.05, ry: ry * 1.05, dir: -0.24, n: 620, len: 0.72,
      w: rx * 0.026, alpha: 0.1, tone,
    });
    scrub(c, path, {
      x: cx, y: cy, rx: rx * 1.05, ry: ry * 1.05, dir: 1.32, n: 320, len: 0.5,
      w: rx * 0.02, alpha: 0.07, tone: tone - 40,
    });

    // 明暗の境目：暗い側をぎざぎざの縁で落とす（ここが硬いほど冷たく見える）
    if (o.terminator !== false) {
      c.save();
      c.beginPath();
      path(c);
      c.clip();
      c.fillStyle = g(0, o.shade === undefined ? 0.9 : o.shade);
      c.beginPath();
      const edge = cx - rx * (o.split === undefined ? 0.22 : o.split) * s;
      // 傾き：まっすぐ縦に落とすと、どの面も同じ「加工」に見える
      const tilt = o.tilt === undefined ? 0.14 : o.tilt;
      c.moveTo(cx - rx * 1.6 * s, cy - ry * 1.6);
      c.lineTo(edge + rx * tilt * s, cy - ry * 1.6);
      for (let t = 0; t <= 1.0001; t += 0.055) {
        c.lineTo(
          edge + rx * tilt * s * (1 - t * 2) + rnd(-rx * 0.15, rx * 0.15) - s * rx * 0.1 * Math.sin(t * 3.1),
          cy - ry * 1.6 + ry * 3.2 * t,
        );
      }
      c.lineTo(cx - rx * 1.6 * s, cy + ry * 1.6);
      c.closePath();
      c.fill();
      c.restore();
    }

    // 影：暗い側・上・顎の下
    dark(c, cx - rx * 0.9 * s, cy + ry * 0.1, rx * 0.7, ry * 1.0, 0.9);
    dark(c, cx, cy - ry * 1.05, rx * 1.05, ry * 0.5, 0.8);
    dark(c, cx, cy + ry * 1.06, rx * 0.92, ry * 0.55, 0.86);

    // 輪郭のふちを一段暗く（面が浮き上がる）
    c.save();
    c.beginPath();
    path(c);
    c.strokeStyle = g(0, 0.5);
    c.lineWidth = rx * 0.07;
    c.filter = `blur(${rx * 0.045}px)`;
    c.stroke();
    c.restore();
  }

  /** 肩から下（文字が来るので必ず黒でつぶす） */
  function shoulders(c, w, h, cx, top, spread, blur) {
    c.save();
    c.filter = `blur(${w * (blur === undefined ? 0.03 : blur)}px)`;
    c.fillStyle = g(0, 1);
    c.beginPath();
    c.moveTo(cx - w * spread, h);
    c.bezierCurveTo(cx - w * spread * 0.8, h * (top + 0.14), cx - w * 0.17, h * top, cx, h * top);
    c.bezierCurveTo(cx + w * 0.17, h * top, cx + w * spread * 0.8, h * (top + 0.14), cx + w * spread, h);
    c.closePath();
    c.fill();
    c.restore();
  }

  /* ── ① 叫ぶ棘の頭 ─────────────────────────── */
  function scream_(c, w, h) {
    const cx = w * 0.5;
    const cy = h * 0.225;
    const rx = w * 0.29;
    const ry = h * 0.155;
    spikes(c, cx, cy - ry * 0.3, rx * 1.0, ry * 1.05, 54, w * 0.34);
    chalkFace(c, cx, cy, rx, ry, 240, true, { jaw: 0.42, split: 0.3, shade: 0.93, tilt: 0.3 });
    pit(c, cx - rx * 0.38, cy - ry * 0.32, rx * 0.23, ry * 0.28, -0.12, 0.2);
    pit(c, cx + rx * 0.4, cy - ry * 0.26, rx * 0.22, ry * 0.26, 0.1, 0.2);
    // 縦に裂けた口（叫び）
    scream(c, cx + rx * 0.02, cy + ry * 0.52, rx * 0.19, ry * 0.42, 0);
    shoulders(c, w, h, cx, 0.4, 0.42, 0.035);
    scratches(c, w, h, 16);
  }

  /* ── ② 逆さの顔 ───────────────────────────── */
  function upside(c, w, h) {
    const cx = w * 0.5;
    const cy = h * 0.245;
    const rx = w * 0.33;
    const ry = h * 0.19;
    c.save();
    c.translate(cx, cy);
    c.rotate(Math.PI);
    c.translate(-cx, -cy);
    chalkFace(c, cx, cy, rx, ry, 208, false, { jaw: 0.58, split: 0.26, shade: 0.88, tilt: -0.26 });
    pit(c, cx - rx * 0.36, cy - ry * 0.24, rx * 0.16, ry * 0.12, -0.05, 0.7);
    pit(c, cx + rx * 0.35, cy - 0.2 * ry, rx * 0.15, ry * 0.11, 0.04, 0.7);
    // 目のふちに白目（逆さだと下まぶたが上に来て落ち着かない）
    ellipse(c, cx - rx * 0.36, cy - ry * 0.24, rx * 0.05, rx * 0.05, g(252, 0.95), rx * 0.015);
    ellipse(c, cx + rx * 0.35, cy - ry * 0.2, rx * 0.045, rx * 0.045, g(252, 0.95), rx * 0.015);
    grinMouth(c, cx, cy + ry * 0.44, rx * 0.56, ry * 0.19, 18);
    c.restore();
    dark(c, cx, cy - ry * 1.35, rx * 1.5, ry * 0.9, 0.9);
    sink(c, w, h, 0.46);
    scratches(c, w, h, 12);
  }

  /* ── ③ 群れ ───────────────────────────────── */
  function crowd(c, w, h) {
    const faces = [
      { x: 0.2, y: 0.2, s: 1.0 },
      { x: 0.78, y: 0.17, s: 0.95 },
      { x: 0.5, y: 0.33, s: 0.86 },
      { x: 0.02, y: 0.38, s: 0.72 },
      { x: 0.98, y: 0.35, s: 0.7 },
      { x: 0.31, y: 0.46, s: 0.55 },
      { x: 0.69, y: 0.48, s: 0.52 },
    ];
    for (let i = faces.length - 1; i >= 0; i -= 1) {
      const f = faces[i];
      const cx = w * f.x;
      const cy = h * f.y;
      const rx = w * 0.23 * f.s;
      const ry = h * 0.125 * f.s;
      chalkFace(c, cx, cy, rx, ry, 150 + 86 * f.s, i % 2 === 0, { jaw: 0.56, split: 0.2, shade: 0.9, tilt: (i % 3) * 0.24 - 0.24 });
      pit(c, cx - rx * 0.36, cy - ry * 0.3, rx * 0.24, ry * 0.28, -0.07, 0.7);
      pit(c, cx + rx * 0.37, cy - ry * 0.25, rx * 0.23, ry * 0.27, 0.06, 0.7);
      ellipse(c, cx - rx * 0.36, cy - ry * 0.36, rx * 0.07, rx * 0.07, g(252, 0.92), rx * 0.02);
      ellipse(c, cx + rx * 0.37, cy - ry * 0.31, rx * 0.062, rx * 0.062, g(252, 0.92), rx * 0.02);
      grinMouth(c, cx, cy + ry * 0.55, rx * 0.64, ry * 0.24, 18);
    }
    sink(c, w, h, 0.55);
    scanlines(c, w, h, 4, 0.32);
    tear(c, w, h, 6);
  }

  /* ── ④ 骨の顔 ─────────────────────────────── */
  function skull(c, w, h) {
    const cx = w * 0.5;
    const cy = h * 0.225;
    const rx = w * 0.31;
    const ry = h * 0.17;
    chalkFace(c, cx, cy, rx, ry, 244, true, { jaw: 0.46, split: 0.3, shade: 0.9, tilt: 0.22 });
    // こめかみのくぼみ（骨に見えるかはここで決まる）
    dark(c, cx - rx * 0.94, cy - ry * 0.24, rx * 0.36, ry * 0.5, 0.7);
    dark(c, cx + rx * 0.94, cy - ry * 0.2, rx * 0.36, ry * 0.5, 0.7);
    dark(c, cx, cy + ry * 0.12, rx * 0.5, ry * 0.16, 0.45);
    // 大きすぎる眼窩と、その中の点
    pit(c, cx - rx * 0.38, cy - ry * 0.18, rx * 0.27, ry * 0.28, -0.06, 0.35);
    pit(c, cx + rx * 0.39, cy - ry * 0.13, rx * 0.26, ry * 0.27, 0.05, 0.35);
    pinPupil(c, cx - rx * 0.35, cy - ry * 0.14, rx * 0.032);
    pinPupil(c, cx + rx * 0.43, cy - ry * 0.08, rx * 0.028);
    // 鼻の穴（逆三角）
    c.save();
    c.fillStyle = g(0, 0.95);
    c.filter = `blur(${rx * 0.02}px)`;
    c.beginPath();
    c.moveTo(cx - rx * 0.02, cy + ry * 0.16);
    c.lineTo(cx - rx * 0.13, cy + ry * 0.44);
    c.lineTo(cx + rx * 0.11, cy + ry * 0.45);
    c.closePath();
    c.fill();
    c.restore();
    grinMouth(c, cx, cy + ry * 0.78, rx * 0.6, ry * 0.2, 22);
    shoulders(c, w, h, cx, 0.4, 0.48, 0.04);
    scratches(c, w, h, 14);
  }

  /* ── ⑤ 長い髪の面 ─────────────────────────── */
  function veil(c, w, h) {
    const cx = w * 0.5;
    const cy = h * 0.245;
    const rx = w * 0.22;
    const ry = h * 0.155;
    // 髪の塊（枠の幅いっぱい。面の周りを黒で囲うほど、面だけが浮く）
    c.save();
    c.filter = `blur(${w * 0.028}px)`;
    c.fillStyle = g(0, 1);
    c.beginPath();
    c.moveTo(cx - w * 0.44, h);
    c.bezierCurveTo(cx - w * 0.46, h * 0.42, cx - w * 0.36, h * 0.09, cx, h * 0.045);
    c.bezierCurveTo(cx + w * 0.36, h * 0.09, cx + w * 0.46, h * 0.42, cx + w * 0.44, h);
    c.closePath();
    c.fill();
    c.restore();
    chalkFace(c, cx, cy, rx, ry, 250, true, { jaw: 0.62, split: 0.34, shade: 0.8, tilt: -0.2 });
    pit(c, cx - rx * 0.42, cy - ry * 0.22, rx * 0.28, ry * 0.2, -0.1, 0.3);
    pit(c, cx + rx * 0.43, cy - ry * 0.17, rx * 0.27, ry * 0.19, 0.08, 0.3);
    grinMouth(c, cx, cy + ry * 0.5, rx * 0.62, ry * 0.16, 16);
    // 顔にかかる髪（面を横切る線があるだけで、覗いているように見える）
    c.save();
    c.strokeStyle = g(0, 0.85);
    c.filter = `blur(${rx * 0.045}px)`;
    for (let i = 0; i < 22; i += 1) {
      const x = cx + rnd(-rx * 1.15, rx * 1.15);
      c.lineWidth = rnd(rx * 0.015, rx * 0.075);
      c.beginPath();
      c.moveTo(x, cy - ry * 1.7);
      c.quadraticCurveTo(x + rnd(-rx * 0.24, rx * 0.24), cy, x + rnd(-rx * 0.34, rx * 0.34), cy + ry * rnd(0.5, 1.9));
      c.stroke();
    }
    c.restore();
    scratches(c, w, h, 10);
  }

  /* ── ⑥ 兎 ─────────────────────────────────── */
  function rabbit(c, w, h) {
    const cx = w * 0.5;
    const cy = h * 0.315;
    const rx = w * 0.24;
    const ry = h * 0.125;
    // 長い耳（枠の上まで届かせる。届かないと帽子に見える）
    // **中を埋める**——線だけで作ると角や毛束に見えて、兎として読めない
    for (const s of [-1, 1]) {
      const bx = cx + s * rx * 0.44;
      const by = cy - ry * 0.8;
      const tx = cx + s * rx * 0.82;
      const ty = h * 0.03;
      const wide = rx * 0.2;
      const earPath = (cc) => {
        cc.moveTo(bx - s * wide, by);
        cc.bezierCurveTo(bx - s * wide * 1.5, (by + ty) / 2, tx - s * wide * 0.9, ty + (by - ty) * 0.16, tx, ty);
        cc.bezierCurveTo(tx + s * wide * 1.1, ty + (by - ty) * 0.18, bx + s * wide * 1.3, (by + ty) / 2, bx + s * wide, by);
        cc.closePath();
      };
      c.save();
      c.beginPath();
      earPath(c);
      c.clip();
      c.fillStyle = g(150, 0.5);
      c.fill();
      smudge(c, bx - s * wide * 0.3, (by + ty) / 2, wide * 1.6, (by - ty) * 0.55, 0.5, 232);
      c.restore();
      scrub(c, earPath, {
        x: (bx + tx) / 2, y: (by + ty) / 2, rx: rx * 0.45, ry: (by - ty) * 0.6,
        dir: 1.35, n: 300, len: 0.5, w: rx * 0.024, alpha: 0.16, tone: 238,
      });
      c.save();
      c.beginPath();
      earPath(c);
      c.clip();
      // 耳の内側（濃い溝が1本あるだけで、面ではなく耳に見える）
      dark(c, bx + s * wide * 0.75, (by + ty) / 2, wide * 0.7, (by - ty) * 0.6, 0.9);
      dark(c, tx, ty + (by - ty) * 0.1, wide * 1.2, (by - ty) * 0.16, 0.6);
      c.restore();
      c.save();
      c.beginPath();
      earPath(c);
      c.strokeStyle = g(0, 0.6);
      c.lineWidth = rx * 0.055;
      c.filter = `blur(${rx * 0.035}px)`;
      c.stroke();
      c.restore();
    }
    chalkFace(c, cx, cy, rx, ry, 226, false, { jaw: 0.6, split: 0.24, shade: 0.86, tilt: -0.18 });
    pit(c, cx - rx * 0.37, cy - ry * 0.18, rx * 0.2, ry * 0.24, -0.05, 0.5);
    pit(c, cx + rx * 0.38, cy - ry * 0.14, rx * 0.19, ry * 0.23, 0.04, 0.5);
    ellipse(c, cx, cy + ry * 0.32, rx * 0.075, ry * 0.09, g(0, 0.9), rx * 0.025);
    grinMouth(c, cx, cy + ry * 0.68, rx * 0.58, ry * 0.2, 19);
    shoulders(c, w, h, cx, 0.47, 0.4, 0.045);
    // 砂嵐（この面だけは強くかける）
    scanlines(c, w, h, 3, 0.26);
    tear(c, w, h, 9);
    dither(c, w, h, 0.3);
  }

  /* ── ⑦ 影の人 ─────────────────────────────── */
  function shadow(c, w, h) {
    // 明るい壁の前に立つ黒い影
    const gd = c.createRadialGradient(w * 0.5, h * 0.17, 0, w * 0.5, h * 0.3, w * 0.95);
    gd.addColorStop(0, g(210, 0.62));
    gd.addColorStop(0.5, g(130, 0.28));
    gd.addColorStop(1, g(0, 0));
    c.fillStyle = gd;
    c.fillRect(0, 0, w, h);
    const cx = w * 0.5;
    const cy = h * 0.2;
    c.save();
    c.filter = `blur(${w * 0.01}px)`;
    c.fillStyle = g(0, 1);
    c.beginPath();
    headPath(cx, cy, w * 0.26, h * 0.15, 0.62)(c);
    c.fill();
    c.beginPath();
    c.moveTo(cx - w * 0.52, h);
    c.bezierCurveTo(cx - w * 0.46, h * 0.44, cx - w * 0.24, h * 0.29, cx, h * 0.29);
    c.bezierCurveTo(cx + w * 0.24, h * 0.29, cx + w * 0.46, h * 0.44, cx + w * 0.52, h);
    c.closePath();
    c.fill();
    c.restore();
    // 括弧のような目（この面のこわさはここだけに掛かっている）
    c.save();
    c.strokeStyle = g(255, 0.95);
    c.lineWidth = w * 0.016;
    c.lineCap = 'round';
    for (const s of [-1, 1]) {
      const ex = cx + s * w * 0.075;
      c.beginPath();
      c.arc(ex, cy - h * 0.006, w * 0.038, Math.PI * (s < 0 ? 0.42 : 1.42), Math.PI * (s < 0 ? 1.58 : 0.58));
      c.stroke();
    }
    c.restore();
    sink(c, w, h, 0.46);
    dither(c, w, h, 0.78);
    scratches(c, w, h, 6);
  }

  /* ── ⑧ 近すぎる顔 ─────────────────────────── */
  function close_(c, w, h) {
    const cx = w * 0.44;
    const cy = h * 0.2;
    const rx = w * 0.66;
    const ry = h * 0.3;
    chalkFace(c, cx, cy, rx, ry, 214, true, { jaw: 0.66, split: 0.16, shade: 0.9, tilt: 0.34 });
    dark(c, cx + rx * 0.72, cy, rx * 0.66, ry * 1.2, 0.92);
    pit(c, cx - rx * 0.32, cy - ry * 0.12, rx * 0.18, ry * 0.13, -0.05, 0.6);
    pinPupil(c, cx - rx * 0.32, cy - ry * 0.12, rx * 0.028);
    pit(c, cx + rx * 0.26, cy - ry * 0.05, rx * 0.15, ry * 0.1, 0.04, 0.18);
    scream(c, cx - rx * 0.06, cy + ry * 0.6, rx * 0.15, ry * 0.16, 0);
    sink(c, w, h, 0.5);
    scratches(c, w, h, 14);
  }

  /* ── ⑨ 闇の中の目 ─────────────────────────── */
  function eyes_(c, w, h) {
    // **数を減らして大きくする**——小さい点をばらまくと、ただの粒に見えて顔にならない
    const rows = [
      { x: 0.5, y: 0.2, s: 1.0 },
      { x: 0.17, y: 0.32, s: 0.62 },
      { x: 0.84, y: 0.29, s: 0.56 },
      { x: 0.46, y: 0.45, s: 0.36 },
    ];
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const { x, y, s } = rows[i];
      const px = w * x;
      const py = h * y;
      const fr = w * 0.3 * s;
      // 顔の輪郭をかすかに（目だけだと宙に浮く）
      smudge(c, px, py + fr * 0.1, fr * 0.95, fr * 1.35, 0.05 * s + 0.014, 210);
      const r = fr * 0.115;
      const gap = fr * 0.4;
      for (const side of [-1, 1]) {
        const ex = px + side * gap;
        const ey = py + (side > 0 ? r * 0.22 : 0);
        smudge(c, ex, ey, r * 3.2, r * 2.6, 0.34 * s + 0.1);
        ellipse(c, ex, ey, r, r * 0.82, g(130 + 80 * s, 0.9), r * 0.1);
        ellipse(c, ex + side * r * 0.12, ey, r * 0.42, r * 0.42, g(0, 0.92), r * 0.06);
        pinPupil(c, ex + side * r * 0.02, ey - r * 0.16, r * 0.14);
        // 上まぶたの影（まぶたが無いと目玉が転がっているだけに見える）
        c.save();
        c.filter = `blur(${r * 0.3}px)`;
        c.fillStyle = g(0, 0.75);
        c.beginPath();
        c.ellipse(ex, ey - r * 0.95, r * 1.25, r * 0.65, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    }
    sink(c, w, h, 0.54);
    scratches(c, w, h, 8);
  }

  /* ── ⑩ 伸びてくる手 ───────────────────────── */
  function hand(c, w, h) {
    const px = w * 0.5;
    const s = w * 0.3;
    const palmY = h * 0.34;
    smudge(c, px, palmY, s * 2.0, s * 2.2, 0.07);
    // 指（手のひらより先に描いて、付け根を手のひらで隠す）
    const fingers = [
      [-0.72, 1.28, -0.34], [-0.27, 1.62, -0.12], [0.16, 1.55, 0.08], [0.56, 1.2, 0.3],
    ];
    for (const [dx, len, rot] of fingers) {
      const fx = px + s * dx;
      const fl = s * len * 0.5;
      const fy = palmY - fl * Math.cos(rot) * 0.85;
      const fw = s * 0.115;
      const fPath = oval(fx, fy, fw, fl, rot);
      scrub(c, fPath, {
        x: fx, y: fy, rx: fw, ry: fl, dir: 1.5 + rot, n: 130, len: 0.9,
        w: s * 0.02, alpha: 0.2, tone: 236,
      });
      c.save();
      c.beginPath();
      fPath(c);
      c.clip();
      dark(c, fx + fw * 0.75, fy, fw * 0.8, fl, 0.85, rot);
      c.restore();
      c.save();
      c.beginPath();
      fPath(c);
      c.strokeStyle = g(0, 0.5);
      c.lineWidth = s * 0.03;
      c.filter = `blur(${s * 0.02}px)`;
      c.stroke();
      c.restore();
      // 指先の爪
      const tipX = fx + Math.sin(rot) * fl * 0.82;
      const tipY = fy - Math.cos(rot) * fl * 0.82;
      ellipse(c, tipX, tipY, fw * 0.52, fw * 0.62, g(246, 0.55), s * 0.012, rot);
    }
    // 親指
    const thX = px - s * 1.02;
    const thY = palmY + s * 0.22;
    const thPath = oval(thX, thY, s * 0.12, s * 0.4, -0.85);
    scrub(c, thPath, {
      x: thX, y: thY, rx: s * 0.12, ry: s * 0.4, dir: 0.72, n: 90, len: 0.9,
      w: s * 0.02, alpha: 0.18, tone: 226,
    });
    // 手のひら
    const palm = oval(px - s * 0.06, palmY + s * 0.42, s * 0.62, s * 0.7, 0.04);
    scrub(c, palm, {
      x: px - s * 0.06, y: palmY + s * 0.42, rx: s * 0.62, ry: s * 0.7, dir: 1.42, n: 300,
      len: 0.7, w: s * 0.026, alpha: 0.18, tone: 232,
    });
    c.save();
    c.beginPath();
    palm(c);
    c.clip();
    dark(c, px + s * 0.6, palmY + s * 0.42, s * 0.5, s * 0.85, 0.85);
    dark(c, px - s * 0.06, palmY + s * 1.1, s * 0.7, s * 0.45, 0.9);
    c.restore();
    dark(c, px, palmY + s * 1.9, s * 1.4, s * 1.1, 0.95);
    sink(c, w, h, 0.56);
    scratches(c, w, h, 11);
  }

  /* ── ⑪ 覗いている顔 ───────────────────────── */
  function peek(c, w, h) {
    const cx = w * 0.66;
    const cy = h * 0.23;
    const rx = w * 0.24;
    const ry = h * 0.16;
    c.save();
    c.filter = `blur(${w * 0.018}px)`;
    c.fillStyle = g(0, 1);
    c.fillRect(0, 0, w * 0.42, h);
    c.restore();
    chalkFace(c, cx + rx * 0.24, cy, rx, ry, 232, true, { jaw: 0.6, split: 0.26, shade: 0.9, tilt: -0.3 });
    dark(c, cx + rx * 1.2, cy, rx * 0.66, ry * 1.2, 0.85);
    pit(c, cx - rx * 0.06, cy - ry * 0.18, rx * 0.26, ry * 0.22, -0.06, 0.6);
    pit(c, cx + rx * 0.6, cy - ry * 0.13, rx * 0.22, ry * 0.19, 0.05, 0.28);
    pinPupil(c, cx - rx * 0.09, cy - ry * 0.18, rx * 0.04);
    grinMouth(c, cx + rx * 0.24, cy + ry * 0.5, rx * 0.46, ry * 0.15, 14);
    // 戸の縁がわずかに光る
    c.save();
    c.filter = `blur(${w * 0.004}px)`;
    c.fillStyle = g(255, 0.12);
    c.fillRect(w * 0.416, 0, w * 0.007, h);
    c.restore();
    sink(c, w, h, 0.5);
    scratches(c, w, h, 10);
  }

  /* ── ⑫ 水面の目 ───────────────────────────── */
  function water(c, w, h) {
    const cx = w * 0.5;
    const line = h * 0.32;
    const rx = w * 0.29;
    const ry = h * 0.165;
    const cy = line - ry * 0.5;
    chalkFace(c, cx, cy, rx, ry, 212, true, { jaw: 0.58, split: 0.26, shade: 0.9, tilt: 0.26 });
    dark(c, cx, cy - ry * 0.9, rx * 1.3, ry * 0.7, 0.95);
    dark(c, cx - rx * 0.52, cy + ry * 0.5, rx * 0.34, ry * 0.4, 0.65);
    dark(c, cx + rx * 0.52, cy + ry * 0.5, rx * 0.34, ry * 0.4, 0.65);
    for (const [side, r] of [[-1, 0.13], [1, 0.115]]) {
      const ex = cx + side * rx * 0.4;
      const ey = cy + ry * (side < 0 ? 0.06 : 0.12);
      smudge(c, ex, ey, rx * r * 2.6, rx * r * 2.4, 0.3);
      ellipse(c, ex, ey, rx * r, rx * r * 0.88, g(206, 0.9), rx * 0.018);
      ellipse(c, ex, ey, rx * r * 0.5, rx * r * 0.5, g(0, 0.95), rx * 0.012);
      pinPupil(c, ex - rx * r * 0.18, ey - rx * r * 0.2, rx * r * 0.14);
    }
    // 水面から下は完全な黒（顔の下半分は見えない）
    c.save();
    c.filter = `blur(${h * 0.005}px)`;
    c.fillStyle = g(0, 0.99);
    c.fillRect(0, line, w, h - line);
    c.restore();
    c.save();
    c.strokeStyle = g(255, 0.34);
    c.lineWidth = Math.max(1.4, h * 0.0016);
    c.beginPath();
    c.moveTo(0, line);
    c.lineTo(w, line);
    c.stroke();
    for (let i = 0; i < 9; i += 1) {
      const y = line + h * (0.012 + i * i * 0.0055);
      c.globalAlpha = 0.32 - i * 0.032;
      c.beginPath();
      c.moveTo(-w * 0.05, y);
      c.bezierCurveTo(w * 0.3, y - h * 0.006, w * 0.7, y + h * 0.006, w * 1.05, y);
      c.stroke();
    }
    c.restore();
    scratches(c, w, h, 9);
  }

  const FIGURES = [
    { id: 'scream', draw: scream_, light: [0.5, 0.2, 0.1] },
    { id: 'upside', draw: upside, light: [0.5, 0.28, 0.05] },
    { id: 'crowd', draw: crowd, light: [0.38, 0.22, 0.06] },
    { id: 'skull', draw: skull, light: [0.42, 0.2, 0.08] },
    { id: 'veil', draw: veil, light: [0.46, 0.2, 0.06] },
    { id: 'rabbit', draw: rabbit, light: [0.5, 0.26, 0.07] },
    { id: 'shadow', draw: shadow, light: [0.5, 0.2, 0] },
    { id: 'close', draw: close_, light: [0.3, 0.2, 0.06] },
    { id: 'eyes', draw: eyes_, light: [0.5, 0.26, 0.03] },
    { id: 'hand', draw: hand, light: [0.5, 0.36, 0.05] },
    { id: 'peek', draw: peek, light: [0.72, 0.2, 0.06] },
    { id: 'water', draw: water, light: [0.5, 0.28, 0.05] },
  ];

  function paint(c, id, w, h) {
    const f = FIGURES.find((x) => x.id === id);
    ground(c, w, h, f.light[0], f.light[1], f.light[2]);
    f.draw(c, w, h);
    vignette(c, w, h, id === 'shadow' ? 0.6 : 1);
    if (id !== 'shadow') grain(c, w, h, 17);
  }

  function render(id, w, h) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    paint(cv.getContext('2d'), id, w, h);
    return cv.toDataURL('image/webp', 0.7);
  }

  global.KAGAMI_FIGURES = { FIGURES, paint, render };
})(window);
