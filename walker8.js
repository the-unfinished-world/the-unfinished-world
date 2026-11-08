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
  // ---- gait tuning (fractions of height H; degrees). Flat and 35-degree-climb targets, blended by slope. ----------
  // Targets from a gait review (stair-pitch norms on the bridges): step 36% H flat / ~23% H along a 35 deg slope,
  // stance 61/64%, hip bob 2.2% / 3.5% H, toe-up strike 20 / 8 deg, heel-off 32% / 23%, push-off 30 / 40 deg,
  // trunk lean 3 / 13 deg, arms +/-13 deg (centred forward when climbing), elbow 13 back to 37 front, arms lag 6%.
  const GAIT = {
    flat:  { step: .28, stance: .61, bob: .025, strikePitch: -20, flatFrom: .08, riseFrom: .32, toeOffPitch: 30, clearance: .03, lean: 3, lead: 0, armFwd: 0, peakAt: .3 },
    climb: { step: .205, stance: .64, bob: .035, strikePitch: -8, flatFrom: .06, riseFrom: .23, toeOffPitch: 40, clearance: .046, lean: 13, lead: .5, armFwd: 6, peakAt: .4 },
    arm: 13, elbowBack: 13, elbowFwd: 37, armLag: .06, reachMargin: .995 };
  const gaitAt = slope => { const k = Math.min(1, Math.abs(Math.tan(slope)) / .7), o = {}; for (const key in GAIT.flat) o[key] = GAIT.flat[key] + (GAIT.climb[key] - GAIT.flat[key]) * k; return o; };
  const stepLen = slope => gaitAt(slope).step;                                // horizontal step length, in heights
  window.walker8Stride = slope => 2 * stepLen(slope);                         // horizontal distance per gait cycle
  window.walker8Gait = GAIT;
  const H0cache = new Map();
  function hipBase(slope, Ls, foot, shear, wave, reach) {                    // highest base hip height both legs can reach all cycle
    const key = [slope, Ls].map(v => Math.round(v * 1000)).join(':') + ':' + JSON.stringify(GAIT).length;
    if (H0cache.has(key)) return H0cache.get(key);
    let H0 = 1;
    for (let i = 0; i < 96; i++) { const gg = i / 96;
      for (const F of [foot(gg), foot(gg + .5)]) { const a = shear(F.ank); const dx = Math.abs(a[0]); if (dx < reach) H0 = Math.min(H0, a[1] + Math.sqrt(reach * reach - dx * dx) * GAIT.reachMargin - wave(gg)); } }
    H0cache.set(key, H0); return H0;
  }
  const rot = (p, c, a) => { const s = Math.sin(a), co = Math.cos(a), dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * co - dy * s, c[1] + dx * s + dy * co]; };

  function rig(o) {
    const { x, y, h } = o, ph = o.phase || 0, idle = o.idle || 0, yaw = o.yaw == null ? 1 : o.yaw;
    const fem = o.variant === 'female', dir = yaw >= 0 ? 1 : -1;
    const g = ((ph / (2 * Math.PI)) % 1 + 1) % 1, mix = (a, b) => lerp(a, b, idle);
    const L1 = .23, L2 = .22, FL = .14, AH = .028, reach = L1 + L2 - 1e-3;
    const slope = o.slope || 0, tanS = Math.tan(slope), G = gaitAt(slope), xs = o.xScale == null ? 1 : o.xScale;
    // ---- feet first: stance foot locked to the ground, swing foot on a smooth arc, heel-strike / roll / toe-off ----
    const Ls = G.step * (o.stepScale == null ? 1 : o.stepScale), ST = G.stance, smooth = u => u * u * (3 - 2 * u);
    const pose = (x, p, pivot) => {                       // foot from ankle-x reference, pitch p (deg, + = heel up)
      const r = p * D, f = [Math.cos(r), -Math.sin(r)], n = [Math.sin(r), Math.cos(r)];
      let heel, toe;
      if (pivot === 'toe') { toe = [x + .75 * FL, 0]; heel = [toe[0] - FL * f[0], toe[1] - FL * f[1]]; }
      else { heel = [x - .25 * FL, 0]; toe = [heel[0] + FL * f[0], heel[1] + FL * f[1]]; }
      const ank = [heel[0] + .25 * FL * f[0] + AH * n[0], heel[1] + .25 * FL * f[1] + AH * n[1]];
      return { heel, toe, ank, f, n };
    };
    const stanceFoot = gg => { const x = ST * Ls * (1 - 2 * gg / ST);
      if (gg < G.flatFrom) return pose(x, G.strikePitch * (1 - smooth(gg / G.flatFrom)), 'heel');
      if (gg < G.riseFrom) return pose(x, 0, 'heel');
      const u = (gg - G.riseFrom) / (ST - G.riseFrom); return pose(x, G.toeOffPitch * u * u * smooth(u), 'toe'); };
    const A0 = stanceFoot(ST - 1e-6), A1 = stanceFoot(0);
    function foot(gg) {
      gg = ((gg % 1) + 1) % 1;
      if (gg < ST) return stanceFoot(gg);
      const u = (gg - ST) / (1 - ST), m = -2 * Ls * (1 - ST);                     // Hermite: ends match the stance foot's velocity
      const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, h01 = -2 * u * u * u + 3 * u * u, h11 = u * u * u - u * u;
      const ax = h00 * A0.ank[0] + h10 * m + h01 * A1.ank[0] + h11 * m;
      const ay = A0.ank[1] + (A1.ank[1] - A0.ank[1]) * smooth(u) + G.clearance * Math.pow(Math.sin(Math.PI * u), 1.3);
      const p = G.toeOffPitch * (1 - smooth(Math.min(1, u / .4))) + G.strikePitch * smooth(Math.max(0, (u - .55) / .45));
      const r = p * D, f = [Math.cos(r), -Math.sin(r)], n = [Math.sin(r), Math.cos(r)];
      const heel = [ax - .25 * FL * f[0] - AH * n[0], ay - .25 * FL * f[1] - AH * n[1]];
      return { heel, toe: [heel[0] + FL * f[0], heel[1] + FL * f[1]], ank: [ax, ay], f, n };
    }
    const lead = G.lead * reach * Math.sin(Math.max(0, slope));               // climbing: feet placed ahead of the hip
    const shear = pt => [pt[0] + lead, pt[1] + (pt[0] + lead) * tanS];              // onto the incline: flat soles become slope-parallel
    const legFrom = (F, isFar) => ({ ank: shear(F.ank), heel: shear(F.heel), toe: shear(F.toe), far: isFar });
    const near = legFrom(foot(g), false), far = legFrom(foot(g + .5), true);
    // ---- hip: a gentle wave, highest at mid-stance, capped so both legs always reach (no crouch) ----
    const wave = gg => .5 * G.bob * Math.cos(4 * Math.PI * (gg - G.peakAt));
    const H0 = hipBase(slope, Ls, foot, shear, wave, reach);
    const pelvisY = mix(H0 + wave(g), H0 + .5 * G.bob);
    for (const Lg of [near, far]) {
      const ax = Lg.ank[0], ay = Lg.ank[1] - pelvisY, dd = Math.min(Math.hypot(ax, ay), reach), th = Math.atan2(ay, ax);
      const A = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd))));
      const k1 = [L1 * Math.cos(th + A), L1 * Math.sin(th + A)], k2 = [L1 * Math.cos(th - A), L1 * Math.sin(th - A)];
      Lg.knee = k1[0] > k2[0] ? k1 : k2;                                          // knees bend forward
      for (const kk of ['ank', 'heel', 'toe']) Lg[kk] = [Lg[kk][0], Lg[kk][1] - pelvisY];   // to hip-relative coordinates
      const fx = Lg.toe[0] - Lg.heel[0], fy = Lg.toe[1] - Lg.heel[1], fl = Math.hypot(fx, fy) || 1; Lg.fw = [fx / fl, fy / fl]; Lg.up = [-Lg.fw[1], Lg.fw[0]];
    }
    const leanA = mix(G.lean, 2) * D;
    const S = (p, noLean) => { let q = p; if (!noLean && p[1] > 0) q = rot(p, [0, 0], -leanA); return { x: x + dir * q[0] * h * xs, y: y - (q[1] + pelvisY) * h }; };
    function arm(gg) {
      const ga = gg - GAIT.armLag, c = Math.cos(2 * Math.PI * ga), sa = mix(G.armFwd - GAIT.arm * c, 0) * D, fl = mix(GAIT.elbowBack + (GAIT.elbowFwd - GAIT.elbowBack) * (.5 - .5 * c), 15) * D;
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

  window.walker8Rig = rig;   // exposed for the gait lab
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
