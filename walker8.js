// Walker 8 (round 2): profile silhouettes to the verifier's proportions. Pure 2D profile (x forward, y up from the
// hip joint, fractions of total height h); yaw only decides facing. Both arms drawn. Flat feet with heel strike and
// toe push-off. Two subtle interior lines. The brush pass (brushfigure.js) merges the parts.
// drawWalker8(ctx, o)       o: {x, y, h, phase, idle, yaw, variant:'male'|'female', color}
// drawWalker8Lines(ctx, o)  interior lines in o.lineColor
(function () {
  const D = Math.PI / 180;
  const lerp = (a, b, t) => a + (b - a) * t;
  function key(frames, g) { g = ((g % 1) + 1) % 1; let i = 0; while (i < frames.length - 1 && frames[i + 1][0] <= g) i++; const a = frames[i], b = frames[(i + 1) % frames.length]; const span = (b[0] > a[0] ? b[0] : b[0] + 1) - a[0]; const t = span === 0 ? 0 : (g - a[0]) / span; const s = .5 - .5 * Math.cos(Math.PI * t); return lerp(a[1], b[1], s); }
  const HIP = [[0, 36], [.12, 30], [.5, -22], [.6, -24], [.8, 26], [1, 36]];            // thigh from vertical, + forward
  const KNEE = [[0, 6], [.12, 14], [.4, 8], [.56, 10], [.68, 40], [.8, 54], [.92, 16], [1, 6]];        // flexion
  const FOOT = [[0, -8], [.1, -3], [.3, 0], [.45, 8], [.56, 22], [.64, 16], [.74, 3], [.86, -5], [1, -8]];   // sole pitch, + heel up
  const ARM = [[0, -26], [.5, 26], [1, -26]];                                             // shoulder, + forward
  const ELB = [[0, 28], [.5, 20], [1, 28]];                                               // elbow flexion
  function spline(ctx, pts, closed, k) {
    const n = pts.length, P = i => pts[((i % n) + n) % n]; k = k == null ? .5 : k;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < (closed ? n : n - 1); i++) { const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2); ctx.bezierCurveTo(p1.x + (p2.x - p0.x) * k / 3, p1.y + (p2.y - p0.y) * k / 3, p2.x - (p3.x - p1.x) * k / 3, p2.y - (p3.y - p1.y) * k / 3, p2.x, p2.y); }
    if (closed) ctx.closePath();
  }
  const rot = (p, c, a) => { const s = Math.sin(a), co = Math.cos(a), dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * co - dy * s, c[1] + dx * s + dy * co]; };

  function rig(o) {
    const { x, y, h } = o, ph = o.phase || 0, idle = o.idle || 0, yaw = o.yaw == null ? 1 : o.yaw;
    const fem = o.variant === 'female', dir = yaw >= 0 ? 1 : -1;
    const g = ((ph / (2 * Math.PI)) % 1 + 1) % 1, mix = (a, b) => lerp(a, b, idle);
    const L1 = .23, L2 = .22, FL = .14, AH = .028;                      // thigh, shank, foot length, ankle height above sole
    const slope = o.slope || 0, tanS = Math.tan(slope);                  // ground rises tanS per unit forward (climbing > 0)
    function leg(gg) {
      const a = mix(key(HIP, gg), 2) * D, k = mix(key(KNEE, gg), 4) * D, p = mix(key(FOOT, gg), 0) * D;   // flat-ground gait; the incline is applied below
      const knee = [L1 * Math.sin(a), -L1 * Math.cos(a)], sa = a - k;
      const ank = [knee[0] + L2 * Math.sin(sa), knee[1] - L2 * Math.cos(sa)];
      const fw = [Math.cos(p), -Math.sin(p)], up = [Math.sin(p), Math.cos(p)];
      const heel = [ank[0] - up[0] * AH - fw[0] * FL * .35, ank[1] - up[1] * AH - fw[1] * FL * .35];
      const toe = [heel[0] + fw[0] * FL, heel[1] + fw[1] * FL];
      return { knee, ank, heel, toe, up, fw };
    }
    const near = leg(g), far = leg(g + .5); far.far = true;
    // Put the flat gait onto the incline: every foot point rises by x*tanS (x = forward of the hip), then each
    // knee is re-solved with two-bone IK so the leg actually reaches its foot. If a downhill foot is out of reach,
    // the hip drops until it is not. Ground origin: the flat gait's lowest point, directly under the hip.
    const lowestFlat = Math.min(near.heel[1], near.toe[1], far.heel[1], far.toe[1]);
    const shear = pt => [pt[0], pt[1] + pt[0] * tanS];
    for (const Lg of [near, far]) { Lg.ank = shear(Lg.ank); Lg.heel = shear(Lg.heel); Lg.toe = shear(Lg.toe); }
    const reach = L1 + L2 - 1e-3; let drop = 0;
    for (const Lg of [near, far]) { const [ax, ay] = Lg.ank; if (Math.hypot(ax, ay) > reach) drop = Math.max(drop, -ay - Math.sqrt(Math.max(0, reach * reach - ax * ax))); }
    if (drop > 0) for (const Lg of [near, far]) for (const kk of ['ank', 'heel', 'toe']) Lg[kk] = [Lg[kk][0], Lg[kk][1] + drop];
    for (const Lg of [near, far]) {
      const [ax, ay] = Lg.ank, dd = Math.min(Math.hypot(ax, ay), reach), th = Math.atan2(ay, ax), A = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd))));
      const k1 = [L1 * Math.cos(th + A), L1 * Math.sin(th + A)], k2 = [L1 * Math.cos(th - A), L1 * Math.sin(th - A)];
      Lg.knee = k1[0] > k2[0] ? k1 : k2;                                   // knees bend forward
      const fx = Lg.toe[0] - Lg.heel[0], fy = Lg.toe[1] - Lg.heel[1], fl = Math.hypot(fx, fy) || 1; Lg.fw = [fx / fl, fy / fl]; Lg.up = [-Lg.fw[1], Lg.fw[0]];
    }
    const lowest = lowestFlat + drop;
    const bob = mix(-.006 * (1 - Math.cos(2 * ph)) / 2, 0);
    const rawPelvis = -lowest + bob; const st = (window.__w8 = window.__w8 || {}); const kk = o.variant || 'x'; st[kk] = st[kk] == null ? rawPelvis : st[kk] + (rawPelvis - st[kk]) * .25; const pelvisY = o.idle ? rawPelvis : st[kk];
    const leanA = mix(4, 2) * D;
    const S = (p, noLean) => { let q = p; if (!noLean && p[1] > 0) q = rot(p, [0, 0], -leanA); return { x: x + dir * q[0] * h, y: y - (q[1] + pelvisY) * h }; };
    function arm(gg) {
      const sa = mix(key(ARM, gg), 0) * D, fl = mix(key(ELB, gg), 18) * D;
      const sh = fem ? [-.038, .285] : [-.042, .305];
      const el = [sh[0] + .15 * Math.sin(sa), sh[1] - .15 * Math.cos(sa)];
      const fa = sa + fl;
      const wr = [el[0] + .14 * Math.sin(fa), el[1] - .14 * Math.cos(fa)];
      const ta = fa + 14 * D; const tip = [wr[0] + .05 * Math.sin(ta), wr[1] - .05 * Math.cos(ta)];
      return { sh, el, wr, tip };
    }
    return { h, fem, dir, mix, S, near, far, armN: arm(g), armF: arm(g + .5), pitch: mix(fem ? 15 : 3, fem ? 10 : 2) * D };
  }
  const BODY_M = [[.33, .02], [.32, .046], [.27, .066], [.22, .064], [.16, .052], [.10, .043], [.04, .046], [0, .052], [-.03, .03], [-.035, -.03], [.0, -.06], [.04, -.072], [.09, -.063], [.15, -.057], [.21, -.062], [.26, -.074], [.30, -.084], [.325, -.072], [.335, -.03]];
  const BODY_F = [[.31, .02], [.30, .042], [.24, .072], [.19, .05], [.12, .04], [.06, .046], [0, .052], [-.03, .028], [-.035, -.036], [.03, -.082], [.10, -.056], [.18, -.058], [.25, -.072], [.285, -.078], [.305, -.064], [.315, -.03]];

  window.drawWalker8 = function (ctx, o) {
    const r = rig(o); const { h, fem, S, near, far, armN, armF, pitch } = r;
    ctx.save(); ctx.fillStyle = ctx.strokeStyle = o.color || '#1d1b18'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const segAB = (A, B, w0, w1) => { const n = 6; for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n; ctx.lineWidth = lerp(w0, w1, (t0 + t1) / 2) * h; ctx.beginPath(); ctx.moveTo(lerp(A.x, B.x, t0), lerp(A.y, B.y, t0)); ctx.lineTo(lerp(A.x, B.x, t1), lerp(A.y, B.y, t1)); ctx.stroke(); } };
    const seg = (a, b, w0, w1) => segAB(S(a, true), S(b, true), w0, w1);
    const segL = (a, b, w0, w1) => segAB(S(a), S(b), w0, w1);
    const poly = (pts, k, noLean) => { spline(ctx, pts.map(p => S(p, noLean)), true, k); ctx.fill(); };
    function legShape(L) {
      const [kx, ky] = L.knee, bulge = [kx + (L.ank[0] - kx) * .36, ky + (L.ank[1] - ky) * .36];
      seg([0, .012], L.knee, .08, .055);
      seg(L.knee, bulge, .055, .06); seg(bulge, L.ank, .06, .03);
      const { heel, toe, up, fw } = L, k = L.far ? .8 : 1, dy = L.far ? .012 : 0;
      const F = p => [L.ank[0] + (p[0] - L.ank[0]) * k, L.ank[1] + (p[1] - L.ank[1]) * k + dy];
      const h0 = [heel[0] + up[0] * .035, heel[1] + up[1] * .035], t0 = [toe[0] + up[0] * .012, toe[1] + up[1] * .012];
      const mid = [heel[0] + fw[0] * .077 + up[0] * .024, heel[1] + fw[1] * .077 + up[1] * .024];
      poly([h0, [heel[0] - fw[0] * .006, heel[1] - fw[1] * .006], [heel[0] + fw[0] * .02, heel[1] + fw[1] * .02], [toe[0] - fw[0] * .01, toe[1] - fw[1] * .01], [toe[0] + fw[0] * .004 + up[0] * .006, toe[1] + fw[1] * .004 + up[1] * .006], t0, mid, [L.ank[0] + up[0] * .01, L.ank[1] + up[1] * .01]].map(F), .35, true);
    }
    function armShape(A) { const Sh = S(A.sh); ctx.beginPath(); ctx.ellipse(Sh.x, Sh.y - .012 * h, .044 * h, .05 * h, 0, 0, Math.PI * 2); ctx.fill(); segL(A.sh, A.el, .056, .037); segL(A.el, A.wr, .037, .03); segL(A.wr, A.tip, .03, .02); }
    function head() {
      const nb = fem ? [0, .31] : [0, .33], nt = [.008, .375];
      segL(nb, nt, fem ? .038 : .045, fem ? .038 : .045);
      const c = [.005, .438];
      const H = p => rot([c[0] + p[0], c[1] + p[1]], nt, pitch);
      const Sc = S(H([0, 0]));
      ctx.save(); ctx.translate(Sc.x, Sc.y); ctx.rotate(-r.dir * (pitch + r.mix(4, 2) * D)); ctx.beginPath(); ctx.ellipse(0, 0, .052 * h, .062 * h, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      poly([[.044, .03], [.053, .027], [.056, .018], [.051, .01], [.052, .0], [.048, -.012], [.04, -.05], [.012, -.062], [-.025, -.05], [-.014, -.01], [0, .03]].map(H), .4);
      const hair = fem ? [[-.058, -.02], [-.063, .025], [-.047, .058], [-.015, .07], [.018, .066], [.038, .048], [.03, .01], [-.02, -.03]] : [[-.058, -.02], [-.063, .025], [-.047, .06], [-.015, .071], [.02, .067], [.042, .046], [.032, .005], [-.02, -.03]];
      poly(hair.map(H), .5);
      if (fem) { const k = S(H([-.06, -.03])); ctx.beginPath(); ctx.ellipse(k.x, k.y, .015 * h, .013 * h, 0, 0, Math.PI * 2); ctx.fill(); }
      const e = S(H([-.045, -.01])); ctx.beginPath(); ctx.ellipse(e.x, e.y, .007 * h, .011 * h, 0, 0, Math.PI * 2); ctx.fill();
    }
    armShape(armF); legShape(far);
    poly((fem ? BODY_F : BODY_M).map(p => [p[1], p[0]]), .5);
    head();
    legShape(near); armShape(armN);
    ctx.restore();
  };
  window.drawWalker8Lines = function (ctx, o) {
    const r = rig(o); const { h, fem, S, near } = r;
    ctx.save(); ctx.strokeStyle = o.lineColor || '#f1ede4'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(.8, h * .005); ctx.globalAlpha = .4;
    const curve = (a, c, b) => { const A = S(a), C = S(c), B = S(b); ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo(C.x, C.y, B.x, B.y); ctx.stroke(); };
    if (fem) curve([.0, .30], [.03, .305], [.05, .29]); else curve([-.07, .27], [-.06, .22], [-.062, .17]);
    const K = S(near.knee, true); ctx.beginPath(); ctx.moveTo(K.x - .008 * h * r.dir, K.y - .022 * h); ctx.quadraticCurveTo(K.x + .01 * h * r.dir, K.y, K.x - .006 * h * r.dir, K.y + .024 * h); ctx.stroke();
    ctx.restore();
  };
})();
