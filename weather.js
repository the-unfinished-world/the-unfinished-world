// Weather: the scene's wind, and what it carries. One slow gusting wind blows across the gorge toward the left; every
// few seconds a stronger gust passes. The walker's cloth and hair read the same wind (Weather.wind), and two things
// make it visible, both drawn in screen space over the scene:
//   leaves  - small ink leaves (an occasional one in the moon's pink) that blow in from upwind, tumble and flip
//   streaks - during a gust, dry-brush strokes sweep across: parallel hair-thin strands broken by gaps ("flying white")
//   Weather.wind(T) -> { x, gust }   x: signed wind along screen x (negative = toward the left), gust: 0..~1.4
//   Weather.draw(ctx, T, W, H, S)    call once per frame with the context in CSS pixels; S = scene scale
(function () {
  const INK = '#1c1a17', ACCENT = '#b07a72', R = Math.random;
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seeded = s => { let a = (s * 2654435761) >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  // gusts on a fixed schedule from time (same for every visitor at the same moment of the climb)
  const SLOT = 8;
  function gustAt(T) {
    let g = 0;
    for (let s = Math.floor(T / SLOT) - 1; s <= Math.floor(T / SLOT); s++) {
      const r = seeded(s * 977 + 13), t0 = s * SLOT + r() * 5, dur = 1.8 + r() * 1.6, amp = .55 + r() * .85, u = (T - t0) / dur;
      if (u > 0 && u < 1) g = Math.max(g, amp * Math.pow(Math.sin(Math.PI * u), 2));
    }
    return g;
  }
  function wind(T) { const base = .45 + .35 * Math.sin(T * .23) + .15 * Math.sin(T * .71 + 2), gust = gustAt(T); return { x: -(base + gust), gust }; }

  const leaves = [], streaks = [];
  let lastT = null, lastGust = 0, primed = false;
  function leaf(W, H, S, edge) {
    const depth = R();
    leaves.push({ x: edge ? W + 20 + R() * 60 : W * (.35 + R() * .65), y: H * (R() * .85 - .05), vx: 0, vy: 0, a: R() * 6.28, va: (R() - .5) * 3,
      flip: R() * 6.28, vf: 2 + R() * 5, size: (3.4 + depth * 5.6) * S, depth, red: R() < .14, sway: R() * 6.28 });
  }
  function streak(W, H, S, w) {
    const r = R;
    // one brush sweep: a cubic centre line from right to left that dips and lifts into a flick, a pressure profile
    // (thin touch-down, swell, thin flick), and 7-10 hairs that fan out where the brush presses
    const x0 = W * (.6 + r() * .45), y0 = H * (.1 + r() * .55), len = (190 + r() * 230) * S, dip = (r() * .5 + .2) * len * .22, lift = (r() * .6 + .4) * len * .2;
    streaks.push({ p: [[x0, y0], [x0 - len * .3, y0 + dip], [x0 - len * .7, y0 + dip * .4 - lift * .3], [x0 - len, y0 - lift]],
      width: (12 + r() * 12) * S, n: 10 + Math.floor(r() * 5), age: 0, dur: 1.6 + r() * 1.0, seed: Math.floor(r() * 1e6), drift: 0, amp: Math.min(1, .55 + w.gust * .55) });
  }
  function update(dt, T, W, H, S) {
    const w = wind(T);
    if (!primed) { for (let i = 0; i < 10; i++) leaf(W, H, S, false); primed = true; }
    // leaves: more while a gust blows; they come in from the upwind (right) edge
    const want = calm ? 4 : 10 + Math.round(18 * w.gust);
    if (leaves.length < want && R() < dt * (1.2 + 6 * w.gust)) leaf(W, H, S, true);
    for (const l of leaves) {
      const tvx = w.x * (55 + 150 * l.depth) * S * (1 + .25 * Math.sin(T * 1.7 + l.sway)), tvy = (10 + 22 * l.depth) * S * (1 + .8 * Math.sin(T * 2.3 + l.sway)) - w.gust * 18 * S * Math.sin(T * 3.1 + l.sway);
      l.vx += (tvx - l.vx) * Math.min(1, dt * 1.6); l.vy += (tvy - l.vy) * Math.min(1, dt * 1.2);
      l.x += l.vx * dt; l.y += l.vy * dt; l.a += (l.va + w.x * .9) * dt; l.flip += l.vf * (1 + w.gust) * dt;
    }
    for (let i = leaves.length - 1; i >= 0; i--) { const l = leaves[i]; if (l.x < -40 || l.y > H + 30 || l.y < -60) leaves.splice(i, 1); }
    // streaks: one or two as each gust rises
    if (!calm && w.gust > .35 && lastGust <= .35) { streak(W, H, S, w); if (w.gust > .8 || R() < .4) streak(W, H, S, w); }
    lastGust = w.gust;
    for (const s of streaks) { s.age += dt; s.drift += w.x * 35 * S * dt; }
    for (let i = streaks.length - 1; i >= 0; i--) if (streaks[i].age > streaks[i].dur) streaks.splice(i, 1);
  }

  function drawLeaf(ctx, l) {
    const s = l.size, f = Math.cos(l.flip);   // flipping over: the leaf narrows to its edge and back
    ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.a); ctx.scale(1, Math.abs(f) < .15 ? .15 * Math.sign(f || 1) : f);
    ctx.globalAlpha = (l.red ? .75 : .5 + .42 * l.depth);
    ctx.fillStyle = l.red ? ACCENT : INK; ctx.strokeStyle = ctx.fillStyle;
    ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(-s * .1, -s * .52, s, -s * .04); ctx.quadraticCurveTo(-s * .05, s * .4, -s, 0); ctx.fill();   // a brush dab: full belly, sharp tip
    ctx.lineWidth = Math.max(.5, s * .12); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(-s * 1.35, s * .12); ctx.stroke();       // stem
    ctx.restore();
  }
  function drawStreak(ctx, s, S) {
    // one soft, tapered grey stroke with a darker pressure edge; the dry-brush texture is paper-coloured streaks running
    // along it (never across, which would read as rungs and so as a bridge), breaking up toward the flick
    const u = s.age / s.dur, head = Math.min(1, u * 1.8), tail = Math.max(0, (u - .35) * 1.55);
    if (head <= tail) return;
    const env = Math.sin(Math.PI * Math.min(1, u * 1.05)), r = seeded(s.seed), P = s.p;
    const at = t => { const q = 1 - t; return [q * q * q * P[0][0] + 3 * q * q * t * P[1][0] + 3 * q * t * t * P[2][0] + t * t * t * P[3][0] + s.drift, q * q * q * P[0][1] + 3 * q * q * t * P[1][1] + 3 * q * t * t * P[2][1] + t * t * t * P[3][1]]; };
    const press = t => Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.12)), .8) * (1 - .4 * t);
    const N = 40, C = [], Nn = [];
    for (let i = 0; i <= N; i++) { const t = tail + (head - tail) * i / N, c = at(t), d = at(Math.min(1, t + .01)), nx = -(d[1] - c[1]), ny = d[0] - c[0], nl = Math.hypot(nx, ny) || 1; C.push([c, t]); Nn.push([nx / nl, ny / nl]); }
    const off = (i, f) => { const [c, t] = C[i], w = press(t) * s.width * .5; return [c[0] + Nn[i][0] * f * w, c[1] + Nn[i][1] * f * w]; };
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // body
    ctx.fillStyle = INK; ctx.globalAlpha = .11 * env * s.amp; ctx.beginPath();
    for (let i = 0; i <= N; i++) { const p = off(i, 1); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    for (let i = N; i >= 0; i--) { const p = off(i, -1); ctx.lineTo(p[0], p[1]); }
    ctx.closePath(); ctx.fill();
    // pressure edge along the top
    ctx.strokeStyle = INK; ctx.globalAlpha = .2 * env * s.amp; ctx.lineWidth = .9 * S; ctx.beginPath();
    for (let i = 0; i <= N; i++) { const p = off(i, -.92); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.stroke();
    // flying white: paper streaks along the stroke, in long runs that break up toward the end
    ctx.strokeStyle = '#f1ede4'; ctx.lineWidth = .8 * S;
    for (let k = 0; k < 4; k++) {
      const f = -.55 + k * .37 + (r() - .5) * .15, ph = r() * 40; let open = false;
      ctx.globalAlpha = .6 * env; ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const t = C[i][1], on = Math.sin(ph + t * 11) + Math.sin(ph * .7 + t * 4.3) > .9 - t * 1.4;
        const p = off(i, f);
        if (on) { open ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); open = true; } else open = false;
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function draw(ctx, T, W, H, S) {
    const dt = lastT == null ? 0 : Math.max(0, Math.min(.1, T - lastT)); lastT = T;
    if (dt > 0) update(dt, T, W, H, S); else if (!primed) update(0, T, W, H, S);
    for (const s of streaks) drawStreak(ctx, s, S);
    for (const l of leaves) drawLeaf(ctx, l);
  }
  window.Weather = { wind, gustAt, draw };
})();
