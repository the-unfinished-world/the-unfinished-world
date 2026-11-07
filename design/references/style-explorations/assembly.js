// Shared particle-assembly engine for the round-2 mockups.
// Slots are given in a 1440x900 design space and mapped onto the canvas with
// "slice" fitting, so they line up with an SVG using preserveAspectRatio="xMidYMid slice".
window.Assembly = function (canvas, opts) {
  const o = Object.assign({
    cycle: 18, build: 12, hold: 3,   // seconds
    ink: '#161513', alphaMin: .8,
    spawn: null,                      // (slot) => {x,y}
    draw: null,                       // (ctx, slot, state) custom piece drawing
    onFrame: null,                    // (progress 0..1 of build, phase)
    jitter: .35, durMin: .9, durMax: 1.8,
  }, opts);
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, s = 1, ox = 0, oy = 0, dpr = Math.min(devicePixelRatio || 1, 2);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const slots = o.slots.map((sl, i) => {
    const N = o.slots.length;
    const order = (sl.order !== undefined ? sl.order : i / N);
    const sp = o.spawn ? o.spawn(sl) : { x: sl.x + rnd(-900, 900), y: sl.y - rnd(300, 900) };
    const mx = (sp.x + sl.x) / 2 + rnd(-220, 220), my = (sp.y + sl.y) / 2 + rnd(-160, 160);
    return Object.assign({}, sl, {
      t0: order * o.build + rnd(0, o.jitter), dur: rnd(o.durMin, o.durMax),
      sx: sp.x, sy: sp.y, mx, my, rot0: rnd(-1.4, 1.4), a: rnd(o.alphaMin, 1),
      dx: rnd(-80, 80), dy: rnd(-140, -40),
    });
  });
  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    s = Math.max(W / 1440, H / 900); ox = (W - 1440 * s) / 2; oy = (H - 900 * s) / 2;
  }
  addEventListener('resize', resize); resize();
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const bez = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
  const start = performance.now();
  function frame(now) {
    const time = ((now - start) / 1000) % o.cycle;
    const dissolveT = o.build + o.hold;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, ox * dpr, oy * dpr);
    let progress = Math.min(1, time / o.build), phase = 'build';
    if (time > dissolveT) { phase = 'dissolve'; }
    else if (time > o.build) { phase = 'hold'; }
    for (const sl of slots) {
      const A0 = sl.a * (sl.fade == null ? 1 : sl.fade);
      let x = sl.x, y = sl.y, rot = sl.rot || 0, alpha = A0, scale = 1, state = 'locked';
      if (phase === 'dissolve') {
        const q = (time - dissolveT) / (o.cycle - dissolveT);
        const e = q * q;
        x += sl.dx * e; y += sl.dy * e; alpha = A0 * (1 - q); rot += sl.rot0 * e; state = 'dissolve';
      } else {
        if (time < sl.t0) continue;
        const p = Math.min(1, (time - sl.t0) / sl.dur);
        if (p < 1) {
          const e = easeOut(p);
          x = bez(sl.sx, sl.mx, sl.x, e); y = bez(sl.sy, sl.my, sl.y, e);
          rot = (sl.rot || 0) + sl.rot0 * (1 - e); alpha = A0 * Math.min(1, p * 3); scale = .6 + .4 * e; state = 'flying';
        }
      }
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, scale); ctx.globalAlpha = alpha;
      if (o.draw) o.draw(ctx, sl, state); else { ctx.fillStyle = sl.color || o.ink; ctx.fillRect(-sl.w / 2, -sl.h / 2, sl.w, sl.h); }
      ctx.restore();
    }
    if (o.onFrame) o.onFrame(progress, phase, time);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { slots };
};
