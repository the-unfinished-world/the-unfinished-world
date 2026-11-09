// Building the bridges. A bridge is built by someone doing the work: each bridge type has a build script (plain data,
// below), a list of steps; each step plays recorded motion (rig.js actions), lasts a while, and reveals some of the
// bridge's pieces (bridges.js slots) near to far. Progress per bridge is { step, frac, done }; it is plain data so it
// can be saved and shared. The scene asks: which pieces are revealed (and since when), how far the deck is walkable,
// where the builder stands, and what pose they are in.
//
//   TUWBuild.state(k)                      progress of bridge k (created empty)
//   TUWBuild.complete(Bk)                  mark a bridge built (e.g. what the stroller finished before play)
//   TUWBuild.advance(Bk, dt, T)            do dt seconds of work on bridge Bk at scene time T; returns the step now on
//   TUWBuild.revealed(Bk, sl)              when piece sl appeared (scene time), or null if not yet
//   TUWBuild.deckExtent(Bk)                how far along the bridge (0..len) the deck can be walked
//   TUWBuild.step(Bk)                      the current step ({ id, at: 'spot' | 'deck' | 'far', ... }) or null when done
//   TUWBuild.pose(Bk, t)                   the builder's pose t seconds into the current step (with tool, toolSize)
//   TUWBuild.line(Bk, t)                   the grapnel line while it is being thrown / lies across: { pts } or null
(function () {
  const R = () => window.TUWRig;
  // ---- the scripts ----------------------------------------------------------------------------------------------
  // reveal(sl, Bk) picks the pieces a step builds; they appear in near-to-far order through the step. Pieces no step
  // claims go up with the last step. act: an action name, or a list played in turn; reps: one-shots repeated.
  const near = sl => sl._end === 'near', far = sl => sl._end === 'far';
  const SCRIPTS = {
    rope: [
      { id: 'coil', act: 'coil', dur: 5, at: 'spot', grow: true },
      { id: 'anchors', act: 'hammer', dur: 4, at: 'spot', reveal: sl => near(sl) && (sl.kind === 'anchor' || sl.kind === 'cap' || (sl.kind === 'rope' && sl.s == null)) },
      { id: 'towers', act: 'push', dur: 3.5, at: 'spot', reveal: sl => near(sl) && (sl.kind === 'tower' || sl.kind === 'stay') },
      { id: 'throw', act: 'throw', reps: 3, dur: 4.5, at: 'spot', line: true, atEnd: true, reveal: sl => far(sl) && (sl.kind === 'anchor' || sl.kind === 'cap' || (sl.kind === 'rope' && sl.s == null)) },
      { id: 'cables', act: 'haul', dur: 5, at: 'spot', line: true, reveal: sl => sl.kind === 'cable' },
      { id: 'deck', act: ['lift', 'hammer', 'hammer'], dur: 13, at: 'deck', reveal: sl => /^(deck|plank|hanger)$/.test(sl.kind) || (sl.kind === 'rope' && sl.s != null) },
      { id: 'far', act: 'push', dur: 3, at: 'far', reveal: sl => far(sl) },
    ],
    // the other three get their own sequences next; until then: frame from the ledge, then the deck walking out
    generic: [
      { id: 'frame', act: ['hammer', 'push'], dur: 7, at: 'spot', reveal: sl => !/^(deck|plank|cleat|rail|post)$/.test(sl.kind) },
      { id: 'deck', act: ['lift', 'hammer', 'hammer'], dur: 14, at: 'deck', reveal: sl => true },
    ],
  };
  const scriptOf = Bk => SCRIPTS[Bk.type] || SCRIPTS.generic;

  // ---- per bridge -----------------------------------------------------------------------------------------------
  const STATES = new Map();
  function state(k) { let s = STATES.get(k); if (!s) STATES.set(k, s = { step: 0, frac: 0, done: false, t: new Map() }); return s; }
  // where along the bridge each piece is (0..len, by projection on the chord) and which end it belongs to; and which
  // step builds it
  function prep(Bk) {
    if (Bk._prep) return Bk._prep;
    const ax = Bk.P2.x - Bk.P0.x, ay = Bk.P2.y - Bk.P0.y, L2 = ax * ax + ay * ay;
    for (const sl of Bk.slots) { const u = ((sl.x - Bk.P0.x) * ax + (sl.y - Bk.P0.y) * ay) / L2; sl._o = Math.max(0, Math.min(1, u)) * Bk.len; sl._end = u < .5 ? 'near' : 'far'; }
    const sc = scriptOf(Bk), lists = sc.map(() => []), taken = new Set();
    sc.forEach((st, i) => { if (!st.reveal) return; for (const sl of Bk.slots) if (!taken.has(sl) && st.reveal(sl, Bk)) { lists[i].push(sl); taken.add(sl); } });
    for (const sl of Bk.slots) if (!taken.has(sl)) lists[lists.length - 1].push(sl);
    lists.forEach(l => l.sort((a, b) => a._o - b._o || a.u - b.u));
    return (Bk._prep = { sc, lists });
  }
  function complete(Bk) { const s = state(Bk.k); for (const sl of Bk.slots) if (!s.t.has(sl)) s.t.set(sl, -1e9); s.done = true; s.step = prep(Bk).sc.length; s.frac = 0; }
  function advance(Bk, dt, T) {
    const s = state(Bk.k), { sc, lists } = prep(Bk); if (s.done) return null;
    const st = sc[s.step], list = lists[s.step];
    s.frac = Math.min(1, s.frac + dt / st.dur);
    const n = st.atEnd ? (s.frac >= .97 ? list.length : 0) : Math.floor(s.frac * list.length + 1e-9);
    for (let i = 0; i < n; i++) if (!s.t.has(list[i])) s.t.set(list[i], T);
    if (s.frac >= 1) { for (const sl of list) if (!s.t.has(sl)) s.t.set(sl, T); s.step++; s.frac = 0; if (s.step >= sc.length) s.done = true; }
    return s.done ? null : sc[s.step];
  }
  function revealed(Bk, sl) { const s = STATES.get(Bk.k); if (!s) return null; const t = s.t.get(sl); return t == null ? null : t; }
  function deckExtent(Bk) {
    const s = STATES.get(Bk.k); if (!s) return 0; if (s.done) return Bk.len;
    prep(Bk); let ext = 0; for (const sl of Bk.slots) if ((sl.kind === 'deck') && s.t.has(sl)) ext = Math.max(ext, sl._o + 3); return Math.min(Bk.len, ext);
  }
  function step(Bk) { const s = state(Bk.k), sc = prep(Bk).sc; return s.done ? null : sc[s.step]; }
  // the builder's pose: the step's action(s) played in turn (one-shots repeated reps times across the step)
  function pose(Bk, t) {
    const st = step(Bk), rig = R(); if (!st || !rig) return null;
    const acts = [].concat(st.act), A = rig.actions;
    let p;
    if (st.reps) { const d = A[acts[0]].dur, per = st.dur / st.reps; p = rig.action(acts[0], Math.min(d - .01, (t % per) * d / per)); }
    else if (acts.length === 1) p = rig.action(acts[0], t);
    else { const cyc = acts.reduce((a, n) => a + A[n].dur, 0); let u = t % cyc, i = 0; while (u > A[acts[i]].dur && i < acts.length - 1) { u -= A[acts[i]].dur; i++; } p = rig.action(acts[i], u); }
    if (st.grow) p = Object.assign({}, p, { toolSize: state(Bk.k).frac });
    if (!p.tool) p = Object.assign({}, p, { tool: 'empty' });   // working hands: held things stay set down
    return p;
  }
  // the grapnel line: thrown three times (short, shorter of the far lip, then it catches), then lying across until
  // the cables are in
  function line(Bk, t, hand, target) {
    const st = step(Bk); if (!st || !st.line) return null;
    if (st.id === 'cables') return { from: hand, to: target, sag: .12, done: true };
    const per = st.dur / st.reps, n = Math.floor(t / per), u = (t % per) / per, rel = .42;   // release a little before mid-throw
    if (u < rel) return null;
    const v = (u - rel) / (1 - rel), reach = n >= st.reps - 1 ? 1 : n === 0 ? .45 : .75;
    return { from: hand, to: target, reach, v, caught: n >= st.reps - 1 };
  }
  window.TUWBuild = { state, complete, advance, revealed, deckExtent, step, pose, line, prep, scripts: SCRIPTS };
})();
