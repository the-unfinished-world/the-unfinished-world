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
  // laying the deck, in cycles: set a plank down on the edge (sped up), hammer it in. Each cycle lays perCycle units of deck during the
  // hammering; between cycles the builder steps up to the new edge (build, build, build, step up)
  const DECK = [{ n: 'place', speed: 2.6 }, { n: 'hammer', speed: 1.25 }];   // set a plank down on the edge, nail it
  const SCRIPTS = {
    rope: [
      { id: 'anchors', act: 'hammer', dur: 3, at: 'spot', reveal: sl => near(sl) && (sl.kind === 'anchor' || sl.kind === 'cap' || (sl.kind === 'rope' && sl.s == null)) },
      { id: 'towers', act: 'push', dur: 3, at: 'spot', reveal: sl => near(sl) && (sl.kind === 'tower' || sl.kind === 'stay') },
      // coil the line, then throw it from the coil: the full coil passes to the far hand, the near hand throws the grapnel
      { id: 'coil', act: 'coil', dur: 4, at: 'spot', grow: true },
      { id: 'throw', act: 'throw', reps: 3, dur: 4.5, at: 'spot', line: true, atEnd: true, holdCoil: true, reveal: sl => far(sl) && (sl.kind === 'anchor' || sl.kind === 'cap' || (sl.kind === 'rope' && sl.s == null)) },
      { id: 'cables', act: 'haul', dur: 4, at: 'spot', line: true, reveal: sl => sl.kind === 'cable' },
      { id: 'deck', act: DECK, perCycle: 64, at: 'deck', reveal: sl => /^(deck|plank|hanger)$/.test(sl.kind) || (sl.kind === 'rope' && sl.s != null) },
      { id: 'far', act: 'push', dur: 3, at: 'far', reveal: sl => far(sl) },
    ],
    // the other three get their own sequences next; until then: frame from the ledge, then the deck walking out
    generic: [
      { id: 'frame', act: ['hammer', 'push'], dur: 7, at: 'spot', reveal: sl => !/^(deck|plank|cleat|rail|post)$/.test(sl.kind) },
      { id: 'deck', act: DECK, perCycle: 64, at: 'deck', reveal: sl => true },
    ],
  };
  const scriptOf = Bk => SCRIPTS[Bk.type] || SCRIPTS.generic;
  const actsOf = st => [].concat(st.act).map(a => typeof a === 'string' ? { n: a, speed: 1 } : a);
  const cycleDur = st => actsOf(st).reduce((t, a) => t + R().actions[a.n].dur / a.speed, 0);
  function cyclesOf(Bk, st) { return st.perCycle ? Math.max(1, Math.ceil(Bk.len / st.perCycle)) : 0; }
  function durOf(Bk, st) { return st.perCycle ? cyclesOf(Bk, st) * cycleDur(st) : st.dur; }

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
    s.frac = Math.min(1, s.frac + dt / durOf(Bk, st));
    if (st.perCycle) {   // pieces up to the stretch being hammered in this cycle
      const N = cyclesOf(Bk, st), x = s.frac * N, n = Math.floor(x), u = x - n, a0 = actsOf(st), hs = (R().actions[a0[0].n].dur / a0[0].speed) / cycleDur(st);
      const upto = Math.min(Bk.len, (n + Math.max(0, (u - hs) / (1 - hs))) * st.perCycle) + (s.frac >= 1 ? 1e9 : 0);
      for (const sl of list) if (sl._o <= upto && !s.t.has(sl)) s.t.set(sl, T);
    } else {
      const n = st.atEnd ? (s.frac >= .97 ? list.length : 0) : Math.floor(s.frac * list.length + 1e-9);
      for (let i = 0; i < n; i++) if (!s.t.has(list[i])) s.t.set(list[i], T);
    }
    if (s.frac >= 1) { for (const sl of list) if (!s.t.has(sl)) s.t.set(sl, T); s.step++; s.frac = 0; if (s.step >= sc.length) s.done = true; }
    return s.done ? null : sc[s.step];
  }
  function revealed(Bk, sl) { const s = STATES.get(Bk.k); if (!s) return null; const t = s.t.get(sl); return t == null ? null : t; }
  function deckExtent(Bk) {
    const s = STATES.get(Bk.k); if (!s) return 0; if (s.done) return Bk.len;
    prep(Bk); let ext = 0; for (const sl of Bk.slots) if ((sl.kind === 'deck') && s.t.has(sl)) ext = Math.max(ext, sl._o + 3); return Math.min(Bk.len, ext);
  }
  function step(Bk) { const s = state(Bk.k), sc = prep(Bk).sc; return s.done ? null : sc[s.step]; }
  // the builder's pose: the step's action(s) played in turn (one-shots repeated reps times across the step). Where one
  // motion hands over to the next (place -> hammer, one throw -> the next) the last moment eases into the next start
  const REL = .42, EASE = .22;   // the grapnel leaves the hand a little before mid-throw; hand-over ease (s)
  function ease(rig, p, q, left) {
    if (left >= EASE) return p;
    const w = 1 - left / EASE, s = w * w * (3 - 2 * w), b = rig.blend(p, q, s);
    return Object.assign(b, { tool: s < .5 ? p.tool : q.tool });
  }
  function pose(Bk, t) {
    const st = step(Bk), rig = R(); if (!st || !rig) return null;
    const acts = actsOf(st), A = rig.actions;
    let p;
    if (st.reps) {
      const d = A[acts[0].n].dur, per = st.dur / st.reps, n = Math.floor(t / per), tc = Math.min(d - .01, (t % per) * d / per);
      p = rig.action(acts[0].n, tc);
      if (n < st.reps - 1) p = ease(rig, p, rig.action(acts[0].n, 0), (d - tc) * per / d);
    }
    else if (acts.length === 1) p = rig.action(acts[0].n, t * acts[0].speed);
    else {
      const cyc = cycleDur(st), dOf = j => A[acts[j].n].dur / acts[j].speed; let u = t % cyc, i = 0;
      while (u > dOf(i) && i < acts.length - 1) { u -= dOf(i); i++; }
      const j = (i + 1) % acts.length;
      p = ease(rig, rig.action(acts[i].n, u * acts[i].speed), rig.action(acts[j].n, 0), dOf(i) - u);
    }
    if (st.grow) p = Object.assign({}, p, { toolSize: state(Bk.k).frac });
    if (st.holdCoil) {   // the coil just made: it moves over to the far hand; until each throw, the line runs from it to the grapnel in the near hand
      const per = st.dur / st.reps, u = (t % per) / per, m = Math.min(1, t / .5);
      p = Object.assign({}, p, { tool: 'rope', toolSize: 1, coilHand: m * m * (3 - 2 * m), strand: u < REL ? 'L' : null, pile: false, grapnel: u < REL });
    }
    if (!p.tool) p = Object.assign({}, p, { tool: 'empty' });   // working hands: held things stay set down
    return p;
  }
  // the grapnel line: thrown three times (short, shorter of the far lip, then it catches), then lying across until
  // the cables are in
  // hands: { L, R } in scene coordinates; a thrown line pays out from the coil (far hand), a hauled one runs from the near hand
  function line(Bk, t, hands, target) {
    const st = step(Bk); if (!st || !st.line) return null;
    if (st.id === 'cables') return { from: hands.L, to: target, sag: .12, done: true };
    const hand = st.holdCoil ? hands.R : hands.L, per = st.dur / st.reps, n = Math.floor(t / per), u = (t % per) / per, rel = REL;
    if (u < rel) return null;
    const v = (u - rel) / (1 - rel), reach = n >= st.reps - 1 ? 1 : n === 0 ? .45 : .75;
    return { from: hand, to: target, reach, v, caught: n >= st.reps - 1 };
  }
  // where the builder stands on the deck during the current cycle: just behind the edge laid by the cycles before
  function station(Bk) { const st = step(Bk); if (!st || !st.perCycle) return null; const s = state(Bk.k), n = Math.floor(s.frac * cyclesOf(Bk, st) + 1e-9); return Math.max(4, Math.min(Bk.len - 4, n * st.perCycle - 8)); }
  window.TUWBuild = { state, complete, advance, revealed, deckExtent, step, pose, line, prep, station, durOf, scripts: SCRIPTS };
})();
