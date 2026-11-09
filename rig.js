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
  function stride(slope) { let d = 0; for (const [c, w] of weights(slope)) d += c.D[0] * w; return d; }

  function pose(o) {
    const slope = o.slope || 0, cyc = (o.phase || 0) / (2 * Math.PI), W = weights(slope), arr = new Array(2 * NJ).fill(0), D = [0, 0];
    const A = { footL: 0, footR: 0, toeL: 0, toeR: 0, head: 0 };
    for (const [c, w] of W) { const s = sample(c, cyc); for (let k = 0; k < 2 * NJ; k++) arr[k] += s[k] * w; D[0] += c.D[0] * w; D[1] += c.D[1] * w;
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
  window.TUWRig = { pose, stride, clips, joints: J };
})();
