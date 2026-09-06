
(() => {
  const cloud = document.getElementById('cloud');
  if (!cloud) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fit = (cv) => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  };
  const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const ramp = (t) => {
    const stops = [[20, 40, 255], [30, 200, 255], [70, 255, 120], [250, 235, 60], [255, 70, 40]];
    t = Math.max(0, Math.min(.9999, t)) * (stops.length - 1);
    const i = Math.floor(t), f = t - i, a = stops[i], b = stops[i + 1];
    return `rgb(${a[0] + (b[0] - a[0]) * f | 0},${a[1] + (b[1] - a[1]) * f | 0},${a[2] + (b[2] - a[2]) * f | 0})`;
  };
  const R = rng(7), pts = [];
  const push = (x, y, z) => pts.push(x, y, z);
  for (let i = 0; i < 1400; i++) push((R() - .5) * 240, (R() - .5) * 240, R() * .6);
  for (let i = 0; i < 700; i++) { push((R() - .5) * 240, (R() - .5) * 7, .2); push((R() - .5) * 7, (R() - .5) * 240, .2); }
  const boxes = [];
  for (let b = 0; b < 26; b++) {
    const qx = R() < .5 ? -1 : 1, qy = R() < .5 ? -1 : 1;
    boxes.push([qx * (12 + R() * 90), qy * (12 + R() * 90), 14 + R() * 30, 14 + R() * 30, 8 + R() * 22]);
  }
  boxes.push([62, -58, 16, 16, 62]);
  for (const [cx, cy, w, d, h] of boxes) {
    const n = Math.floor((w * h + d * h) * 1.15);
    for (let i = 0; i < n; i++) {
      const side = R() * 4 | 0, u = R(), z = R() * h;
      if (side === 0) push(cx - w / 2 + u * w, cy - d / 2, z); else if (side === 1) push(cx - w / 2 + u * w, cy + d / 2, z);
      else if (side === 2) push(cx - w / 2, cy - d / 2 + u * d, z); else push(cx + w / 2, cy - d / 2 + u * d, z);
    }
    for (let i = 0; i < w * d * .25; i++) push(cx - w / 2 + R() * w, cy - d / 2 + R() * d, h + R() * .8);
  }
  for (let t = 0; t < 34; t++) {
    const along = (R() - .5) * 200, off = (R() < .5 ? -1 : 1) * (6 + R() * 3), vert = R() < .5;
    const tx = vert ? off : along, ty = vert ? along : off, r = 2.2 + R() * 1.6, zc = 4 + R() * 2;
    for (let i = 0; i < 60; i++) { const th = R() * 6.283, ph = Math.acos(2 * R() - 1); push(tx + r * Math.sin(ph) * Math.cos(th), ty + r * Math.sin(ph) * Math.sin(th), zc + r * Math.cos(ph)); }
  }
  const N = pts.length / 3, cols = new Array(N);
  for (let i = 0; i < N; i++) cols[i] = ramp(pts[i * 3 + 2] / 64 * 1.1);
  let ang = .6, raf = 0, visible = true;
  const draw = () => {
    const { ctx, w, h } = fit(cloud); ctx.clearRect(0, 0, w, h);
    const ca = Math.cos(ang), sa = Math.sin(ang), ct = Math.cos(.78), st = Math.sin(.78);
    const f = Math.min(w, h) * 1.25, cxp = w * .62, cyp = h * .58, camd = 330;
    ctx.globalAlpha = .92;
    for (let i = 0; i < N; i++) {
      const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
      const rx = x * ca - y * sa, ry = x * sa + y * ca, yy = ry * ct - z * st, zz = ry * st + z * ct + camd;
      if (zz < 40) continue;
      const s = f / zz, sz = Math.max(1, 2.6 * (330 / zz));
      ctx.fillStyle = cols[i]; ctx.fillRect(cxp + rx * s, cyp + yy * s, sz, sz);
    }
    ctx.globalAlpha = 1;
  };
  const loop = () => { if (!visible) return; ang += .0016; draw(); raf = requestAnimationFrame(loop); };
  new IntersectionObserver(en => { visible = en[0].isIntersecting; cancelAnimationFrame(raf); if (visible) (reduce ? draw() : loop()); }, { threshold: .05 }).observe(cloud);
  addEventListener('resize', draw, { passive: true });
  draw();
})();
