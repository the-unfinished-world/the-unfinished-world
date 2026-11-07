// Walker 6: a simple, slender human silhouette. One soft closed outline for head, neck, sloped shoulders, hanging
// sleeve and an ankle-length robe; shins and feet show below the hem. Gait drives lean, bob, hem lift and swing,
// the visible arm, and the feet. Slight Murim touch: topknot with a trailing strand, a sash notch, a wide sleeve.
// drawWalker6(ctx, {x, y, h, phase, alpha, idle, yaw, color})
(function () {
  const D = Math.PI / 180;
  const lerp = (a, b, t) => a + (b - a) * t;
  function key(frames, g) { g = ((g % 1) + 1) % 1; let i = 0; while (i < frames.length - 1 && frames[i + 1][0] <= g) i++; const a = frames[i], b = frames[(i + 1) % frames.length]; const span = (b[0] > a[0] ? b[0] : b[0] + 1) - a[0]; const t = span === 0 ? 0 : (g - a[0]) / span; const s = .5 - .5 * Math.cos(Math.PI * t); return lerp(a[1], b[1], s); }
  const HIP = [[0, 30], [.12, 26], [.5, -12], [.62, -14], [.8, 22], [1, 30]];
  const KNEE = [[0, 4], [.12, 16], [.4, 6], [.6, 36], [.74, 60], [.9, 14], [1, 4]];
  const ANKLE = [[0, 0], [.08, -8], [.45, 8], [.62, -16], [.78, 2], [1, 0]];
  function spline(ctx, pts, closed, k) {
    const n = pts.length, P = i => pts[((i % n) + n) % n]; k = k == null ? .5 : k;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < (closed ? n : n - 1); i++) { const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2); ctx.bezierCurveTo(p1.x + (p2.x - p0.x) * k / 3, p1.y + (p2.y - p0.y) * k / 3, p2.x - (p3.x - p1.x) * k / 3, p2.y - (p3.y - p1.y) * k / 3, p2.x, p2.y); }
    if (closed) ctx.closePath();
  }
  window.drawWalker6 = function (ctx, o) {
    const { x, y, h } = o;
    const ph = o.phase || 0, A = o.alpha == null ? 1 : o.alpha, idle = o.idle || 0, yaw = o.yaw == null ? .6 : o.yaw;
    const g = ((ph / (2 * Math.PI)) % 1 + 1) % 1, dir = yaw >= 0 ? 1 : -1;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const mix = (a, b) => lerp(a, b, idle);
    // --- legs ---------------------------------------------------------------------------------------------
    const L1 = h * .245, L2 = h * .235, FOOT = h * .105, hipX = h * .045;
    function leg(gg, side) {
      const a = mix(key(HIP, gg), 2) * D, kf = mix(key(KNEE, gg), 4) * D, an = mix(key(ANKLE, gg), 0) * D;
      const knee = { X: side * hipX, Y: -L1 * Math.cos(a), Z: L1 * Math.sin(a) };
      const sh = a - kf;
      const ank = { X: side * hipX, Y: knee.Y - L2 * Math.cos(sh), Z: knee.Z + L2 * Math.sin(sh) };
      const fa = sh - Math.PI / 2 + an;
      const toe = { X: side * hipX, Y: Math.min(ank.Y - FOOT * Math.sin(fa), ank.Y + h * .008), Z: ank.Z + FOOT * Math.cos(fa) };
      const heel = { X: side * hipX, Y: ank.Y + FOOT * .2 * Math.sin(fa), Z: ank.Z - FOOT * .2 * Math.cos(fa) };
      return { knee, ank, toe, heel };
    }
    const Lg = leg(g, -1), Rg = leg(g + .5, 1);
    const lowest = Math.min(Lg.toe.Y, Rg.toe.Y, Lg.heel.Y, Rg.heel.Y);
    const pelvisY = -lowest + h * .004;
    // --- body frame: lean from the pelvis, bob, sway --------------------------------------------------------
    const leanA = mix(12, 4) * D;
    const bob = mix(-h * .015 * (1 - Math.cos(2 * ph)) / 2, 0);
    const swayX = mix(Math.sin(ph) * h * .006, 0);
    const P = (X, Y, Z) => { const above = Math.max(0, Y - pelvisY); const Zl = Z + above * Math.tan(leanA); return { x: x + swayX + X * cy + Zl * sy, y: y - Y - (Y > pelvisY ? bob : 0) }; };
    const pj = pt => P(pt.X, pt.Y + pelvisY, pt.Z);
    ctx.save(); ctx.globalAlpha = A; ctx.fillStyle = ctx.strokeStyle = o.color || '#1d1b18'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const wob = (p, i) => ({ x: p.x + Math.sin(i * 1.7 + ph * .3) * h * .004, y: p.y + Math.cos(i * 2.3) * h * .003 });
    function fillSoft(pts) { const w = pts.map(wob); spline(ctx, w, true, .5); ctx.fill(); ctx.save(); ctx.globalAlpha = A * .5; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore(); }
    // --- shins and feet ---------------------------------------------------------------------------------------
    function shin(gL) {
      const knee = pj(gL.knee), ank = pj(gL.ank), toe = pj(gL.toe), heel = pj(gL.heel);
      const dx = ank.x - knee.x, dy = ank.y - knee.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      const wK = h * .03, wA = h * .021;
      fillSoft([{ x: knee.x + nx * wK, y: knee.y + ny * wK }, { x: ank.x + nx * wA, y: ank.y + ny * wA }, heel, { x: toe.x, y: toe.y + h * .004 }, { x: toe.x - (toe.x - ank.x) * .3, y: ank.y - h * .01 }, { x: ank.x - nx * wA, y: ank.y - ny * wA }, { x: knee.x - nx * wK, y: knee.y - ny * wK }]);
    }
    const near = dir > 0 ? Lg : Rg, far = dir > 0 ? Rg : Lg;
    shin(far); shin(near);
    // --- the body: one outline ---------------------------------------------------------------------------------
    const shY = pelvisY + h * .40, neckY = pelvisY + h * .435, headY = pelvisY + h * .51;
    const shSpan = h * .11, hr = h * .055;
    const chestW = h * .085, waistW = h * .072, hipW = h * .10, hemW = h * .14;
    const waistY = pelvisY + h * .17, hipY = pelvisY + h * .02, hemY = h * .115;
    const hemSw = mix(Math.sin(ph) * h * .02, 0);
    const armA = mix(-20 * Math.cos(ph + (dir > 0 ? 0 : Math.PI)), 0) * D, elbow = mix(28 + 10 * Math.max(0, Math.cos(ph)), 18) * D;
    const UA = h * .15, FA = h * .14, sideN = dir;
    const shTip = { X: sideN * shSpan * .9, Y: shY - h * .02, Z: h * .01 };
    const elb = { X: shTip.X + sideN * h * .01, Y: shTip.Y - UA * Math.cos(armA), Z: shTip.Z + UA * Math.sin(armA) };
    const hand = { X: elb.X, Y: elb.Y - FA * Math.cos(armA - elbow), Z: elb.Z + FA * Math.sin(armA - elbow) };
    const sTip = P(shTip.X, shTip.Y, shTip.Z), eP = P(elb.X, elb.Y, elb.Z), hP = P(hand.X, hand.Y, hand.Z);
    const head = P(0, headY, h * .03);
    const L = (X, Y, Z) => P(X, Y, Z);
    const sleeveOut = { x: eP.x + sideN * h * .045, y: eP.y + h * .03 }, sleeveTip = { x: eP.x + sideN * h * .01, y: eP.y + h * .09 };
    const handR = h * .02;   // rounded forearm tip
    const nearArm = sideN > 0
      ? [sTip, { x: (sTip.x + eP.x) / 2 + h * .02, y: (sTip.y + eP.y) / 2 }, sleeveOut, sleeveTip, { x: eP.x - h * .015, y: eP.y + h * .05 }, { x: hP.x + handR, y: hP.y - handR * .4 }, { x: hP.x + handR * .5, y: hP.y + handR }, { x: hP.x - handR * .6, y: hP.y + handR * .6 }, { x: eP.x - h * .035, y: eP.y + h * .005 }]
      : [{ x: eP.x + h * .035, y: eP.y + h * .005 }, { x: hP.x + handR * .6, y: hP.y + handR * .6 }, { x: hP.x - handR * .5, y: hP.y + handR }, { x: hP.x - handR, y: hP.y - handR * .4 }, { x: eP.x + h * .015, y: eP.y + h * .05 }, sleeveTip, sleeveOut, { x: (sTip.x + eP.x) / 2 - h * .02, y: (sTip.y + eP.y) / 2 }, sTip];
    const farShoulderR = [L(shSpan * .95, shY - h * .09, 0), L(chestW + h * .025, shY - h * .16, 0)];
    const farShoulderL = [L(-chestW - h * .025, shY - h * .16, 0), L(-shSpan * .95, shY - h * .09, 0)];
    // hem: front edge lifts over whichever leg is swinging forward; robe bulges at knee height on that side
    const swingN = Math.max(0, Math.sin(ph) * dir), swingF = Math.max(0, -Math.sin(ph) * dir);
    const lift = mix(h * .07 * Math.max(swingN, swingF), 0), bulge = mix(h * .03 * Math.max(swingN, swingF), 0);
    const kneeScreenY = y - (pelvisY + h * .27);
    const hemFrontToBack = [
      { x: x + dir * (hipW + h * .02 + bulge) + hemSw, y: kneeScreenY },
      { x: x + dir * hemW + hemSw, y: y - hemY - lift },
      { x: x + dir * hemW * .4 + hemSw, y: y - hemY + h * .03 - lift * .5 },
      { x: x - dir * hemW * .4 + hemSw, y: y - hemY + h * .032 },
      { x: x - dir * hemW * .78 + hemSw, y: y - hemY + h * .036 },
      { x: x - dir * hemW + hemSw, y: y - hemY + h * .022 },
    ];
    const hemRightToLeft = dir > 0 ? hemFrontToBack : hemFrontToBack.slice().reverse();
    const pts = [
      L(-h * .02, neckY, h * .014), { x: head.x - hr * .95, y: head.y + hr * .4 }, { x: head.x - hr * 1.02, y: head.y - hr * .35 }, { x: head.x - hr * .5, y: head.y - hr * 1.05 },
      { x: head.x + hr * .2, y: head.y - hr * 1.1 }, { x: head.x + hr * .9, y: head.y - hr * .6 }, { x: head.x + hr * 1.02, y: head.y + hr * .2 }, { x: head.x + hr * .7, y: head.y + hr * .75 },
      L(h * .02, neckY, h * .014),
      L(h * .05, shY + h * .005, 0), L(shSpan, shY - h * .03, 0),
      ...(sideN > 0 ? nearArm : farShoulderR),
      L(chestW, pelvisY + h * .30, 0), L(waistW - (dir > 0 ? h * .012 : 0), waistY, 0), L(hipW, hipY, 0),
      ...hemRightToLeft,
      L(-hipW, hipY, 0), L(-waistW + (dir < 0 ? h * .012 : 0), waistY, 0), L(-chestW, pelvisY + h * .30, 0),
      ...(sideN < 0 ? nearArm : farShoulderL),
      L(-shSpan, shY - h * .03, 0), L(-h * .05, shY + h * .005, 0),
    ];
    fillSoft(pts);
    // topknot and a trailing strand
    const bun = { x: head.x - hr * .25 * dir, y: head.y - hr * 1.32 };
    ctx.beginPath(); ctx.ellipse(bun.x, bun.y, hr * .34, hr * .28, -.2 * dir, 0, Math.PI * 2); ctx.fill();
    const sw2 = mix(Math.sin(ph) * h * .008, 0);
    ctx.lineWidth = Math.max(.8, h * .014); ctx.beginPath(); ctx.moveTo(bun.x - dir * hr * .2, bun.y + hr * .1); ctx.quadraticCurveTo(bun.x - dir * hr * 1.0 + sw2, bun.y + hr * .6, bun.x - dir * hr * .9 + sw2 * 1.6, bun.y + hr * 1.9); ctx.stroke();
    ctx.restore();
  };
})();
