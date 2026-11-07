// Ink painting helpers for canvas 2D (round 2, after art-director review).
// Principles: ink pools and breaks, it never feathers. Washes live inside the contour. Mist eats the base of masses.
(function () {
  const INK = '#1d1b18';
  function rng(seed) { let a = (seed * 2654435761) >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const lerp = (a, b, t) => a + (b - a) * t;
  function vnoise(x, seed) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(rng(i * 7 + seed)(), rng((i + 1) * 7 + seed)(), u); }

  function roughen(pts, seed, amp, step) {
    const r = rng(seed), out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.floor(len / (step || 9)));
      const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
      let drift = 0;
      for (let k = 0; k < n; k++) { const t = k / n; drift = drift * .6 + (r() - .5) * amp; out.push([a[0] + (b[0] - a[0]) * t + nx * drift, a[1] + (b[1] - a[1]) * t + ny * drift]); }
    }
    return out;
  }
  function smooth(pts, iters) {
    let p = pts.slice();
    for (let k = 0; k < (iters == null ? 2 : iters); k++) { const q = []; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; q.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25]); q.push([a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } p = q; }
    return p;
  }
  function pathOf(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }
  function bbox(pts) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } return { x0, y0, x1, y1 }; }

  // Wash inside the contour: flat grey, plus a darker pool along the top lip (inside only, no blur outward).
  function wash(ctx, pts, o) {
    const b = bbox(pts); ctx.save(); pathOf(ctx, pts); ctx.clip();
    ctx.fillStyle = `rgba(29,27,24,${o.base == null ? .22 : o.base})`; ctx.fillRect(b.x0 - 5, b.y0 - 5, b.x1 - b.x0 + 10, b.y1 - b.y0 + 10);
    const lip = (o.lip == null ? .16 : o.lip) * (b.y1 - b.y0);
    const g = ctx.createLinearGradient(0, b.y0, 0, b.y0 + lip); g.addColorStop(0, `rgba(29,27,24,${o.pool == null ? .3 : o.pool})`); g.addColorStop(1, 'rgba(29,27,24,0)');
    ctx.fillStyle = g; ctx.fillRect(b.x0 - 5, b.y0 - 5, b.x1 - b.x0 + 10, lip + 5);
    // dark pool hugging the inside of the contour, kept inside by the clip; small blur only
    ctx.globalAlpha = o.poolEdge == null ? .14 : o.poolEdge; ctx.lineWidth = o.poolWidth || 8; ctx.strokeStyle = INK; pathOf(ctx, pts); ctx.stroke();
    ctx.restore();
  }
  // Brush contour: width 2-5px varying along the length, alpha .6-1, 10-20% skipped on the lit (upper-left) side.
  function contour(ctx, pts, o) {
    const r = rng(o.seed || 1), n = pts.length, w0 = o.width || 3, al = o.alpha == null ? .85 : o.alpha;
    ctx.save(); ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const b = bbox(pts); let gap = 0;
    for (let i = 0; i < n - (o.open ? 1 : 0); i++) {
      const a = pts[i], c = pts[(i + 1) % n];
      const lit = (a[1] < b.y0 + (b.y1 - b.y0) * .35) && (a[0] < b.x0 + (b.x1 - b.x0) * .6);
      if (gap > 0) { gap--; continue; }
      if (lit && r() < .08) { gap = 2 + Math.floor(r() * 5); continue; }
      const wn = vnoise(i * .35, o.seed || 1);
      ctx.lineWidth = w0 * lerp(.5, 1.7, wn); ctx.globalAlpha = al * lerp(.65, 1, vnoise(i * .2 + 50, o.seed || 1));
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
    }
    ctx.restore();
  }
  // Texture strokes in 3-5 families, each family sharing a direction; denser near the top contour. Clipped to the mass.
  function cun(ctx, pts, o) {
    const r = rng(o.seed || 2), b = bbox(pts); ctx.save(); pathOf(ctx, pts); ctx.clip();
    ctx.strokeStyle = INK; ctx.lineCap = 'round';
    const fam = 3 + Math.floor(r() * 3), total = o.count || 100;
    for (let f = 0; f < fam; f++) {
      const ang = Math.PI / 2 + (r() - .5) * .7, fx = lerp(b.x0, b.x1, r()), fy = lerp(b.y0, b.y1, r() * .6), spread = (b.x1 - b.x0) * lerp(.15, .4, r());
      const n = Math.floor(total / fam);
      for (let i = 0; i < n; i++) {
        const x = fx + (r() - .5) * spread, y = fy + Math.pow(r(), 1.6) * (b.y1 - fy) * .9;
        const len = lerp(14, o.len || 56, r()), a2 = ang + (r() - .5) * .25;
        ctx.globalAlpha = lerp(.05, o.alpha || .2, r()) * (1 - (y - b.y0) / (b.y1 - b.y0) * .6);
        ctx.lineWidth = lerp(.7, 1.9, r());
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a2) * len * .5 + (r() - .5) * 6, y + Math.sin(a2) * len * .5, x + Math.cos(a2) * len, y + Math.sin(a2) * len); ctx.stroke();
      }
    }
    ctx.restore();
  }
  // Moss dots clustered along a ridge polyline: 2-6px, in 2-4 clusters.
  function dots(ctx, line, o) {
    const r = rng(o.seed || 3); ctx.save(); ctx.fillStyle = INK;
    const clusters = 2 + Math.floor(r() * 3);
    for (let c = 0; c < clusters; c++) {
      const i = Math.floor(r() * (line.length - 1)), a = line[i], b = line[i + 1], t0 = r();
      const cx = lerp(a[0], b[0], t0), cy = lerp(a[1], b[1], t0), n = 5 + Math.floor(r() * 9);
      for (let k = 0; k < n; k++) { const x = cx + (r() - .5) * 46, y = cy + (r() - .5) * 10 - r() * 3; const s = lerp(1.2, 3.2, r()); ctx.globalAlpha = lerp(.55, .95, r()); ctx.beginPath(); ctx.ellipse(x, y, s * 1.5, s * .9, (r() - .5) * 1.2, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
  // Pine: curved trunk 12-25 degrees off vertical tapering 2.5->1.5px, 2-3 arcs sweeping out and slightly down,
  // needle clusters as 12-25 short dark dashes radiating from each branch tip (Shen Zhou foreground pines).
  function pine(ctx, x, y, h, seed) {
    const r = rng(seed); ctx.save(); ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const dir = r() < .5 ? -1 : 1, tilt = dir * lerp(.18, .36, r());
    const top = { x: x + Math.sin(tilt) * h, y: y - Math.cos(tilt) * h }, c = { x: x + Math.sin(tilt) * h * .5 - dir * h * .09, y: y - h * .5 };
    const Q = t => { const q = 1 - t; return { x: q * q * x + 2 * q * t * c.x + t * t * top.x, y: q * q * y + 2 * q * t * c.y + t * t * top.y }; };
    const N = 14; for (let i = 0; i < N; i++) { const a = Q(i / N), b = Q((i + 1) / N); ctx.lineWidth = lerp(3.4, 1.6, i / N) * (h / 60); ctx.globalAlpha = .95; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    // needle pad: 2-3 overlapping flat dark lenses stacked slightly, dashes hanging from the lower edge and bristling the top
    const needles = (tx, ty, ang, count, len) => {
      const pads = 3 + Math.floor(r() * 3), rot = (r() - .5) * .7;
      for (let p = 0; p < pads; p++) {
        if (r() < .2) continue;
        const pw = lerp(8, 28, r()) * (h / 80), ph = pw * lerp(.22, .34, r());
        const px = tx + (r() - .5) * len * 1.2, py = ty - p * len * .16 + (r() - .5) * len * .2;
        const pts = []; const K = 11; for (let j = 0; j < K; j++) { const a = (j / K) * Math.PI * 2, rx = pw * lerp(.8, 1.1, r()), ry = ph * (Math.sin(a) > 0 ? 1.3 : .7) * lerp(.8, 1.15, r()); pts.push([px + Math.cos(a) * rx * Math.cos(rot) - Math.sin(a) * ry * Math.sin(rot), py + Math.cos(a) * rx * Math.sin(rot) + Math.sin(a) * ry * Math.cos(rot)]); }
        ctx.globalAlpha = lerp(.8, .95, r()); pathOf(ctx, pts); ctx.fill();
        const n = Math.floor(count / pads);
        for (let j = 0; j < n; j++) { const u = r(), sx = px - pw + 2 * pw * u, down = r() < .6; const sy = py + (down ? ph * .5 : -ph * .4); const a = (down ? Math.PI / 2 : -Math.PI / 2) + rot + (r() - .5) * 1.1; const L = len * lerp(.15, .38, r()); ctx.lineWidth = Math.max(.9, h * .02); ctx.globalAlpha = lerp(.6, .95, r()); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a) * L, sy + Math.sin(a) * L); ctx.stroke(); }
      }
    };
    const branches = 2 + Math.floor(r() * 2);
    for (let i = 0; i < branches; i++) {
      const t = .42 + .5 * (i / branches) + (r() - .5) * .08, side = i % 2 === 0 ? -dir : dir;
      const b = Q(t), L = h * lerp(.3, .5, r()), ex = b.x + side * L, ey = b.y + h * lerp(.04, .12, r());
      const cc = { x: b.x + side * L * .55, y: b.y - h * .04 };
      ctx.lineWidth = Math.max(1, h * .03); ctx.globalAlpha = .92; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(cc.x, cc.y, ex, ey); ctx.stroke();
      needles(ex, ey - h * .02, -Math.PI / 2 + side * .3, 22 + Math.floor(r() * 12), h * .13);
      if (L > h * .38) { const q = .55, qq = 1 - q; needles(qq * qq * b.x + 2 * qq * q * cc.x + q * q * ex, qq * qq * b.y + 2 * qq * q * cc.y + q * q * ey - h * .03, -Math.PI / 2, 16 + Math.floor(r() * 8), h * .1); }
    }
    needles(top.x, top.y - h * .02, -Math.PI / 2 + tilt, 24 + Math.floor(r() * 8), h * .14);
    ctx.restore();
  }
  // Mist band: hand-shaped paper band with a wobbly outline on its upper edge; soft edge 4-8px only.
  function mist(ctx, x, y, w, h, seed, o) {
    const r = rng(seed); const pts = []; const n = 28;
    for (let i = 0; i <= n; i++) { const t = i / n, px = x - w / 2 + w * t, env = Math.pow(Math.sin(t * Math.PI), .7), py = y - h * .55 * env * lerp(.35, 1.1, vnoise(t * 7 + seed, seed) * .6 + vnoise(t * 19 + 3, seed + 2) * .4) + (r() - .5) * 5; pts.push([px, py]); }
    for (let i = n; i >= 0; i--) { const t = i / n, px = x - w / 2 + w * t, env = Math.pow(Math.sin(t * Math.PI), .8), py = y + h * .4 * env * lerp(.4, 1, vnoise(t * 5 + 9, seed + 1)); pts.push([px, py]); }
    ctx.save(); ctx.fillStyle = (o && o.color) || '#f1ede4';
    ctx.filter = `blur(${(o && o.blur) || 5}px)`; ctx.globalAlpha = (o && o.alpha) || .95; pathOf(ctx, pts); ctx.fill(); ctx.filter = 'none';
    pathOf(ctx, pts); ctx.fill();
    if (!(o && o.noLine)) { ctx.globalAlpha = .3; ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); let on = true;
      for (let i = 2; i <= n - 2; i++) { const p = pts[i]; if (r() < .12) on = !on; if (on) ctx.lineTo(p[0], p[1] + 1); else ctx.moveTo(p[0], p[1] + 1); }
      ctx.stroke(); }
    ctx.restore();
  }
  // Fade the lower part of whatever was drawn in the rect to transparent (mass dissolves into paper).
  function fadeBase(ctx, x0, y0, w, h, from) {
    ctx.save(); ctx.globalCompositeOperation = 'destination-out';
    const g = ctx.createLinearGradient(0, y0 + h * (from == null ? .65 : from), 0, y0 + h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = g; ctx.fillRect(x0 - 10, y0 - 10, w + 20, h + 20); ctx.restore();
  }
  function rock(ctx, pts, o) {
    const rp = roughen(o.round === false ? pts : smooth(pts, o.round || 2), o.seed, o.amp || 5, 8);
    wash(ctx, rp, { base: o.base == null ? .22 : o.base, pool: o.pool == null ? .3 : o.pool, lip: o.lip || .18, poolEdge: o.poolEdge == null ? .22 : o.poolEdge, poolWidth: o.poolWidth || 10 });
    cun(ctx, rp, { seed: o.seed + 1, count: o.cun == null ? 100 : o.cun, len: o.cunLen || 56, alpha: o.cunAlpha || .2 });
    if (o.line !== false) contour(ctx, rp, { seed: o.seed + 2, width: o.lineWidth || 3, alpha: o.lineAlpha == null ? .85 : o.lineAlpha });
    if (o.ridge) dots(ctx, o.ridge, { seed: o.seed + 3 });
    return rp;
  }
  window.Ink = { rng, vnoise, roughen, smooth, pathOf, bbox, wash, contour, cun, dots, pine, mist, fadeBase, rock, INK };
})();
