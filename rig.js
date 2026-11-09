// Walker rig: plays recorded motion clips (gait-clips.js) on a standard skeleton and returns a pose.
// Three swappable layers:   clips (gait-clips.js)  ->  this player (pose for a slope and a phase)  ->  a body (bodies.js).
// A pose is joint positions in units of body height, facing +x, y up, origin on the ground under the walker,
// seen from the walker's left side (L = near side). Any clip set that uses the same joint names drops in.
//   TUWRig.pose({ slope, phase, idle })             phase in radians (one stride per 2*PI), idle 0..1 blends to standing
//   TUWRig.stride(slope)                             horizontal distance per stride, in body heights
(function () {
  const C = window.TUW_CLIPS; if (!C) return;
  const J = C.joints, NJ = J.length, IDX = {}; J.forEach((n, i) => IDX[n] = i);
  const clips = Object.keys(C.clips).map(name => Object.assign({ name }, C.clips[name])).sort((a, b) => a.slope - b.slope);
  const ANKLE = .04;            // the clips put the ankle joint on the ground; the sole sits this far below it
  const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
  const at = (arr, n) => [arr[2 * IDX[n]], arr[2 * IDX[n] + 1]];
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const FOOT_ON_DECK = .8;      // planted feet lie at this fraction of the deck slope (heel slightly up on steep decks)
  // Angles that need each capture subject's own rest values: foot and toe relative to that subject's flat foot,
  // head relative to its average. Measured per clip (gait-clips.js 'rest'), then blended by weight.
  function clipAngles(arr, rest, ground) {
    const g = n => at(arr, n), o = {};
    for (const s of ['L', 'R']) { const f = ang(g('ankle' + s), g('ball' + s)); o['foot' + s] = wrap(f - ground - rest['foot' + s]); o['toe' + s] = wrap(ang(g('ball' + s), g('toe' + s)) - f - rest['toe' + s]); }
    o.head = wrap(ang(g('skull'), g('crown')) - rest.head);
    return o;
  }
  const STAND_ANG = { footL: 0, footR: 0, toeL: 0, toeR: 0, head: 0 };
  // centre each clip's arm swing on the shoulder: a capture subject who carries an arm forward (the level-walk subject
  // swings the near arm only in front of the body) makes every character look stiff, so most of that offset is removed
  for (const c of clips.concat(C.run ? [C.run] : [])) for (const sd of ['L', 'R']) {
    const si = 2 * IDX['shoulder' + sd], hi = 2 * IDX['hand' + sd]; let m = 0;
    for (const f of c.frames) m += f[hi] - f[si]; m = m / c.frames.length * .8;
    for (const f of c.frames) for (const [n, k] of [['elbow', .5], ['wrist', .85], ['hand', 1]]) f[2 * IDX[n + sd]] -= m * k;
  }

  function sample(c, cyc) {
    const n = c.frames.length, f = (((cyc % 1) + 1) % 1) * n, i = Math.floor(f) % n, w = f - Math.floor(f), A = c.frames[i], B = c.frames[(i + 1) % n], out = new Array(2 * NJ);
    for (let k = 0; k < 2 * NJ; k++) out[k] = A[k] + (B[k] - A[k]) * w;
    return out;
  }
  function weights(slope) {
    if (slope <= clips[0].slope) return [[clips[0], 1]];
    for (let i = 0; i < clips.length - 1; i++) { const a = clips[i], b = clips[i + 1]; if (slope < b.slope) { const t = (slope - a.slope) / (b.slope - a.slope); return [[a, 1 - t], [b, t]]; } }
    return [[clips[clips.length - 1], 1]];
  }
  const RUN = C.run ? Object.assign({ name: 'run' }, C.run) : null;
  function stride(slope, run) { let d = 0; for (const [c, w] of weights(slope)) d += c.D[0] * w; const r = RUN ? Math.max(0, Math.min(1, run || 0)) : 0; return d * (1 - r) + (r ? RUN.D[0] * r : 0); }

  function pose(o) {
    const slope = o.slope || 0, cyc = (o.phase || 0) / (2 * Math.PI), W = weights(slope), arr = new Array(2 * NJ).fill(0), D = [0, 0];
    const A = { footL: 0, footR: 0, toeL: 0, toeR: 0, head: 0 };
    // o.run (0..1) blends toward the jog; walks are weighted by slope within the rest
    const rw = RUN ? Math.max(0, Math.min(1, o.run || 0)) : 0, Wr = rw > 0 ? W.map(([c, w]) => [c, w * (1 - rw)]).concat([[RUN, rw]]) : W;
    for (const [c, w] of Wr) { const s = sample(c, cyc); for (let k = 0; k < 2 * NJ; k++) arr[k] += s[k] * w; D[0] += c.D[0] * w; D[1] += c.D[1] * w;
      const a = clipAngles(s, c.rest, c.ground); for (const k in A) A[k] += a[k] * w; }
    // fit the stride to the actual slope: shear so the planted foot travels along the deck, not the clip's own incline
    const k = Math.tan(slope) - D[1] / D[0], px = at(arr, 'pelvis')[0];
    for (let j = 0; j < NJ; j++) arr[2 * j + 1] += k * (arr[2 * j] - px) + ANKLE;
    const idle = Math.max(0, Math.min(1, o.idle || 0));
    if (idle > 0) { for (let j = 0; j < NJ; j++) { arr[2 * j] += (C.stand[2 * j] + px - arr[2 * j]) * idle; arr[2 * j + 1] += (C.stand[2 * j + 1] + ANKLE - arr[2 * j + 1]) * idle; }
      for (const k in A) A[k] += (STAND_ANG[k] - A[k]) * idle; }
    // standing at rest: weight on the far leg, near foot a little forward and its knee eased (contrapposto)
    if (idle > 0) for (const [n, dx, dy] of [['ankleL', .06, 0], ['ballL', .06, 0], ['toeL', .06, 0], ['kneeL', .04, -.01]]) { arr[2 * IDX[n]] += dx * idle; arr[2 * IDX[n] + 1] += dy * idle; }
    // centre the figure over its ground point
    for (let j = 0; j < NJ; j++) arr[2 * j] -= px;
    const P = n => at(arr, n);
    const torsoUp = ang(mid(P('hipL'), P('hipR')), P('neck')), deck = slope * FOOT_ON_DECK * (1 - idle);
    // head: upright with the recorded nod, leaning a little with the body
    const head = Math.PI / 2 + A.head + (torsoUp - Math.PI / 2) * .35;
    return { P, slope, D, ankle: ANKLE, angles: { head, torsoUp, footL: deck + A.footL, footR: deck + A.footR, toeL: deck + A.footL + A.toeL, toeR: deck + A.footR + A.toeR } };
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  // ---- the turn-around (gait-clips.js 'turn'): one recorded 180-degree step-turn with a stride either side ----
  // turnPose(tc) -> a pose like pose() plus: fc (how much of the profile shows, 1 = side-on, 0 = facing the viewer),
  // mirrored (past the half-way point the body faces back, so x is mirrored and drawing flips direction), and
  // rootX (pelvis travel along the walk-in direction, in body heights). tc is seconds into the clip.
  const TC = C.turn;
  function turnPose(tc) {
    const n = TC.frames.length, f = Math.max(0, Math.min(n - 1.001, tc * TC.fps)), i = Math.floor(f), w = f - i, A = TC.frames[i], B = TC.frames[i + 1];
    const arr = new Array(2 * NJ); for (let k = 0; k < 2 * NJ; k++) arr[k] = A[k] + (B[k] - A[k]) * w;
    const L = (a, b) => a + (b - a) * w, yaw = L(TC.yaw[i], TC.yaw[i + 1]), pa = TC.pitch[i], pb = TC.pitch[i + 1], pt = pa.map((v, k) => v + (pb[k] - v) * w), r = TC.rest;
    const c = Math.cos(yaw), mirrored = c < 0;
    for (let j = 0; j < NJ; j++) { if (mirrored) arr[2 * j] = -arr[2 * j]; arr[2 * j + 1] += ANKLE; }
    // the recorded counter-swing of the arms through the pivot is wide; facing the viewer it reads as flailing, so the
    // arms are drawn in toward their shoulders the more the body faces out (side-on they are left as recorded)
    const pull = .2 + .8 * Math.abs(c);
    for (const sd of ['L', 'R']) { const sx0 = arr[2 * IDX['shoulder' + sd]]; for (const n2 of ['elbow', 'wrist', 'hand']) { const k = 2 * IDX[n2 + sd]; arr[k] = sx0 + (arr[k] - sx0) * pull; } }
    const P = n2 => at(arr, n2), torsoUp = pt[4], fL = pt[0] - r[0], fR = pt[1] - r[1];
    return { P, slope: 0, D: [0, 0], ankle: ANKLE, fc: Math.max(.12, Math.abs(c)), mirrored, yaw, rootX: L(TC.root[i], TC.root[i + 1]),
      angles: { torsoUp, head: Math.PI / 2 + (pt[5] - r[5]) + (torsoUp - Math.PI / 2) * .35, footL: fL, footR: fR, toeL: pt[2] - r[2], toeR: pt[3] - r[3] } };
  }
  // the hold moment: near facing the viewer with both feet down (where a pause to look out over the gorge freezes)
  let hold = TC ? TC.apex : 0;
  if (TC) { let best = 1e9; for (let t = Math.max(.15, TC.apex - .45); t <= TC.apex + .25; t += 1 / 60) { const p = turnPose(t), lift = Math.max(p.P('ankleL')[1], p.P('ankleR')[1]) + .02 * Math.abs(Math.abs(p.yaw) - Math.PI / 2); if (lift < best) { best = lift; hold = t; } } }
  const turn = TC ? { pose: turnPose, dur: TC.dur, apex: TC.apex, hold, startPhase: TC.startPhase || 0, rootAt: tc => { const f = Math.max(0, Math.min(TC.root.length - 1.001, tc * TC.fps)), i = Math.floor(f); return TC.root[i] + (TC.root[i + 1] - TC.root[i]) * (f - i); } } : null;
  // blend two poses (crossfades into and out of the turn); w = 0 gives a, 1 gives b
  function blend(a, b, w) {
    if (w <= 0) return a; if (w >= 1) return b;
    const L = (x, y) => x + (y - x) * w, ang = {};
    for (const k in a.angles) ang[k] = L(a.angles[k], b.angles[k]);
    return Object.assign({}, b, { P: n => { const p = a.P(n), q = b.P(n); return [L(p[0], q[0]), L(p[1], q[1])]; }, angles: ang, fc: L(a.fc == null ? 1 : a.fc, b.fc == null ? 1 : b.fc), slope: L(a.slope || 0, b.slope || 0) });
  }
  // ---- the jump (gait-clips.js 'jump'): crouch, take-off, flight, landing, recovery; its own rise is removed so the
  // physics sets the height. jumpPose(tc) with tc in seconds; marks: takeoff, apex, land, dur.
  const JC = C.jump;
  let jumpPose = null;
  if (JC) {
    const f0 = JC.frames[0], g0 = n2 => at(f0, n2);
    const jr = { footL: ang(g0('ankleL'), g0('ballL')), footR: ang(g0('ankleR'), g0('ballR')), toeL: wrap(ang(g0('ballL'), g0('toeL')) - ang(g0('ankleL'), g0('ballL'))), toeR: wrap(ang(g0('ballR'), g0('toeR')) - ang(g0('ankleR'), g0('ballR'))), head: ang(g0('skull'), g0('crown')) };
    jumpPose = (tc, tuck) => {
      const n = JC.frames.length, f = Math.max(0, Math.min(n - 1.001, tc * JC.fps)), i = Math.floor(f), w = f - i, A2 = JC.frames[i], B2 = JC.frames[i + 1];
      const arr = new Array(2 * NJ); for (let k = 0; k < 2 * NJ; k++) arr[k] = A2[k] + (B2[k] - A2[k]) * w;
      for (let j = 0; j < NJ; j++) arr[2 * j + 1] += ANKLE;
      // a platformer jump wants a clear tuck: in flight lift the feet further (knees re-solved from the leg lengths)
      const fl = (tc - JC.takeoff) / (JC.land - JC.takeoff), tk = (tuck || 0) * (fl > 0 && fl < 1 ? Math.sin(Math.PI * fl) : 0);
      if (tk > 0) for (const sd of ['L', 'R']) {
        const g = n2 => [arr[2 * IDX[n2 + sd]], arr[2 * IDX[n2 + sd] + 1]], hp = g('hip'), kn = g('knee'), an = g('ankle');
        const l1 = Math.hypot(kn[0] - hp[0], kn[1] - hp[1]), l2 = Math.hypot(an[0] - kn[0], an[1] - kn[1]);
        let tx = an[0] + .05 * tk, ty = an[1] + .2 * tk; const dx = tx - hp[0], dy = ty - hp[1], d = Math.min(Math.hypot(dx, dy), l1 + l2 - 1e-3), th = Math.atan2(dy, dx);
        tx = hp[0] + Math.cos(th) * d; ty = hp[1] + Math.sin(th) * d;
        const al = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))), k1 = [hp[0] + l1 * Math.cos(th + al), hp[1] + l1 * Math.sin(th + al)], k2 = [hp[0] + l1 * Math.cos(th - al), hp[1] + l1 * Math.sin(th - al)], kk = k1[0] > k2[0] ? k1 : k2;
        const ddx = tx - an[0], ddy = ty - an[1];
        arr[2 * IDX['knee' + sd]] = kk[0]; arr[2 * IDX['knee' + sd] + 1] = kk[1];
        for (const n2 of ['ankle', 'ball', 'toe']) { arr[2 * IDX[n2 + sd]] += ddx; arr[2 * IDX[n2 + sd] + 1] += ddy; }
      }
      const P = n2 => at(arr, n2), a = clipAngles(arr, jr, 0), torsoUp = ang(mid(P('hipL'), P('hipR')), P('neck'));
      return { P, slope: 0, D: [0, 0], ankle: ANKLE, angles: { head: Math.PI / 2 + a.head + (torsoUp - Math.PI / 2) * .35, torsoUp, footL: a.footL, footR: a.footR, toeL: a.footL + a.toeL, toeR: a.footR + a.toeR } };
    };
  }
  const jump = JC ? { pose: jumpPose, dur: JC.dur, takeoff: JC.takeoff, apex: JC.apex, land: JC.land } : null;
  window.TUWRig = { pose, stride, clips, joints: J, turn, blend, jump, run: RUN };
})();
