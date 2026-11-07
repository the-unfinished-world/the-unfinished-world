// Walker 7: an ordinary person. Short hair, shirt or light jacket, trousers, shoes. Rear three-quarter view.
// Gait from Muybridge plate 553 (rear + profile): hip/knee/ankle curves, arms swing opposite with bent elbows,
// slight forward lean, head a touch down. Everything is a soft spline outline with a hair of wobble, no hard caps.
// drawWalker7(ctx, {x, y, h, phase, alpha, idle, yaw, color})
(function () {
  const D = Math.PI / 180;
  const lerp = (a, b, t) => a + (b - a) * t;
  function key(frames, g) { g = ((g % 1) + 1) % 1; let i = 0; while (i < frames.length - 1 && frames[i + 1][0] <= g) i++; const a = frames[i], b = frames[(i + 1) % frames.length]; const span = (b[0] > a[0] ? b[0] : b[0] + 1) - a[0]; const t = span === 0 ? 0 : (g - a[0]) / span; const s = .5 - .5 * Math.cos(Math.PI * t); return lerp(a[1], b[1], s); }
  const HIP = [[0, 28], [.12, 24], [.5, -12], [.62, -14], [.8, 20], [1, 28]];
  const KNEE = [[0, 4], [.12, 16], [.4, 6], [.6, 36], [.74, 62], [.9, 14], [1, 4]];
  const ANKLE = [[0, 0], [.08, -8], [.45, 8], [.62, -16], [.78, 2], [1, 0]];
  const SHOULDER = [[0, -24], [.5, 22], [1, -24]];                 // + = forward; opposite to the same-side leg
  const ELBOW = [[0, 22], [.3, 14], [.5, 36], [.8, 30], [1, 22]];
  function spline(ctx, pts, closed, k) {
    const n = pts.length, P = i => pts[((i % n) + n) % n]; k = k == null ? .5 : k;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < (closed ? n : n - 1); i++) { const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2); ctx.bezierCurveTo(p1.x + (p2.x - p0.x) * k / 3, p1.y + (p2.y - p0.y) * k / 3, p2.x - (p3.x - p1.x) * k / 3, p2.y - (p3.y - p1.y) * k / 3, p2.x, p2.y); }
    if (closed) ctx.closePath();
  }
  window.drawWalker7 = function (ctx, o) {
    const { x, y, h } = o;
    const ph = o.phase || 0, A = o.alpha == null ? 1 : o.alpha, idle = o.idle || 0, yaw = o.yaw == null ? .6 : o.yaw;
    const g = ((ph / (2 * Math.PI)) % 1 + 1) % 1, dir = yaw >= 0 ? 1 : -1;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const mix = (a, b) => lerp(a, b, idle);
    // --- skeleton ---------------------------------------------------------------------------------------
    const L1 = h * .245, L2 = h * .235, FOOT = h * .1, hipX = h * .052;
    function leg(gg, side) {
      const a = mix(key(HIP, gg), 2) * D, kf = mix(key(KNEE, gg), 5) * D, an = mix(key(ANKLE, gg), 0) * D;
      const knee = { X: side * hipX, Y: -L1 * Math.cos(a), Z: L1 * Math.sin(a) };
      const sh = a - kf;
      const ank = { X: side * hipX, Y: knee.Y - L2 * Math.cos(sh), Z: knee.Z + L2 * Math.sin(sh) };
      const fa = sh - Math.PI / 2 + an;
      const toe = { X: side * hipX, Y: Math.min(ank.Y - FOOT * Math.sin(fa), ank.Y + h * .006), Z: ank.Z + FOOT * Math.cos(fa) };
      const heel = { X: side * hipX, Y: ank.Y - h * .012, Z: ank.Z - FOOT * .12 };
      return { knee, ank, toe, heel };
    }
    const Lg = leg(g, -1), Rg = leg(g + .5, 1);
    const lowest = Math.min(Lg.toe.Y, Rg.toe.Y, Lg.heel.Y, Rg.heel.Y);
    const pelvisY = -lowest + h * .004;
    const leanA = mix(8, 2) * D, bob = mix(-h * .014 * (1 - Math.cos(2 * ph)) / 2, 0), swayX = mix(Math.sin(ph) * h * .006, 0);
    const P = (X, Y, Z) => { const above = Math.max(0, Y - pelvisY); const Zl = Z + above * Math.tan(leanA); return { x: x + swayX + X * cy + Zl * sy, y: y - Y - (Y > pelvisY ? bob : 0) }; };
    const pj = pt => P(pt.X, pt.Y + pelvisY, pt.Z);
    const shY = pelvisY + h * .36, shX = h * .115, twist = mix(Math.sin(ph) * .012 * h, 0);
    function arm(gg, side) {
      const sa = mix(key(SHOULDER, gg), 0) * D, el = mix(key(ELBOW, gg), 10) * D, UA = h * .16, FA = h * .15;
      const sh = { X: side * shX * .72 + (side > 0 ? twist : -twist), Y: shY - h * .03, Z: h * .005 };
      const elb = { X: sh.X + side * h * .012, Y: sh.Y - UA * Math.cos(sa), Z: sh.Z + UA * Math.sin(sa) };
      const hand = { X: elb.X + side * h * .004, Y: elb.Y - FA * Math.cos(sa - el), Z: elb.Z + FA * Math.sin(sa - el) };
      return { sh, elb, hand };
    }
    const La = arm(g, -1), Ra = arm(g + .5, 1);
    // --- drawing helpers --------------------------------------------------------------------------------
    ctx.save(); ctx.globalAlpha = A; ctx.fillStyle = ctx.strokeStyle = o.color || '#1d1b18'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const wob = (p, i) => ({ x: p.x + Math.sin(i * 1.9 + ph * .3) * h * .003, y: p.y + Math.cos(i * 2.1) * h * .0025 });
    function fillSoft(pts, k) { const w = pts.map(wob); spline(ctx, w, true, k == null ? .5 : k); ctx.fill(); }
    const perp = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1; return { x: -dy / L, y: dx / L }; };
    const off = (p, n, w) => ({ x: p.x + n.x * w, y: p.y + n.y * w });
    // a tapered two-segment limb (hip->knee->ankle or shoulder->elbow->hand) as one smooth outline
    function limb(a, b, c, wa, wb, wc, tail) {
      const n1 = perp(a, b), n2 = perp(b, c), nk = { x: (n1.x + n2.x) / 2, y: (n1.y + n2.y) / 2 };
      const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
      const pts = [off(a, n1, wa), off(m1, n1, (wa + wb) / 2), off(b, nk, wb * .92), off(m2, n2, (wb + wc) / 2), off(c, n2, wc), ...(tail || [off(c, n2, -wc)]), off(m2, n2, -(wb + wc) / 2), off(b, nk, -wb * .92), off(m1, n1, -(wa + wb) / 2), off(a, n1, -wa)];
      fillSoft(pts, .4);
    }
    // --- legs in trousers, shoes --------------------------------------------------------------------------
    function legShape(gL, side) {
      const hip = P(side * hipX * .8, pelvisY + h * .07, 0), knee = pj(gL.knee), ank = pj(gL.ank), toe = pj(gL.toe), heel = pj(gL.heel);
      const n2 = perp(knee, ank);
      const shoe = [off(ank, n2, h * .016), { x: heel.x, y: heel.y + h * .004 }, { x: toe.x, y: toe.y + h * .006 }, { x: toe.x - (toe.x - ank.x) * .35, y: ank.y - h * .008 }];
      limb(hip, knee, ank, h * .048, h * .032, h * .023, shoe);
    }
    // --- arms ----------------------------------------------------------------------------------------------
    function armShape(a) {
      const s = P(a.sh.X, a.sh.Y, a.sh.Z), e = P(a.elb.X, a.elb.Y, a.elb.Z), hnd = P(a.hand.X, a.hand.Y, a.hand.Z);
      const n2 = perp(e, hnd);
      limb(s, e, hnd, h * .036, h * .027, h * .02, [off(hnd, n2, h * .012), { x: hnd.x + (hnd.x - e.x) * .1, y: hnd.y + (hnd.y - e.y) * .1 + h * .012 }, off(hnd, n2, -h * .018)]);
    }
    // --- torso + head: one outline --------------------------------------------------------------------------
    function body() {
      const neckY = shY + h * .035, headY = shY + h * .118, hr = h * .058;
      const head = P(0, headY, h * .012 + h * .01 * (1 - idle)), chestW = h * .095, waistW = h * .08, hipW = h * .095;
      const hemY = pelvisY - h * .02, waistY = pelvisY + h * .13, chestY = pelvisY + h * .25;
      const pts = [
        P(-h * .017, neckY - h * .01, 0), { x: head.x - hr * .92, y: head.y + hr * .45 }, { x: head.x - hr * 1.0, y: head.y - hr * .3 }, { x: head.x - hr * .55, y: head.y - hr * 1.0 },
        { x: head.x + hr * .15, y: head.y - hr * 1.1 }, { x: head.x + hr * .85, y: head.y - hr * .65 }, { x: head.x + hr * 1.0, y: head.y + hr * .15 }, { x: head.x + hr * .72, y: head.y + hr * .75 },
        P(h * .017, neckY - h * .01, 0),
        P(h * .06, shY + h * .008, 0), P(shX * .9, shY - h * .02, 0), P(shX, shY - h * .07, 0),
        P(chestW, chestY, 0), P(waistW, waistY, 0), P(hipW, hemY + h * .02, 0), P(hipW * .95, hemY, 0),
        P(0, hemY - h * .01, 0),
        P(-hipW * .95, hemY, 0), P(-hipW, hemY + h * .02, 0), P(-waistW, waistY, 0), P(-chestW, chestY, 0),
        P(-shX, shY - h * .07, 0), P(-shX * .9, shY - h * .02, 0), P(-h * .06, shY + h * .008, 0),
      ];
      fillSoft(pts, .5);
      // short hair: a soft cap on the back of the head
      ctx.beginPath(); ctx.ellipse(head.x - hr * .1 * dir, head.y - hr * .35, hr * 1.02, hr * .8, 0, Math.PI, Math.PI * 2); ctx.fill();
    }
    // order: far arm, far leg, body, near leg, near arm (near side = figure's left when walking away-right)
    const nearLeft = dir > 0;
    const drawAll = () => { armShape(nearLeft ? Ra : La); legShape(nearLeft ? Rg : Lg, nearLeft ? 1 : -1); body(); legShape(nearLeft ? Lg : Rg, nearLeft ? -1 : 1); armShape(nearLeft ? La : Ra); };
    drawAll();
    ctx.restore();
  };
})();
