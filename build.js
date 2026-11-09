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
//   TUWBuild.line(Bk, t, g)                a line being thrown / hauled / lowered / lying across, or null (g: scene points,
//                                          below)
//   TUWBuild.along(L, u)                   a point u (0..1) along a line { from, to, sag }
// g, from the scene: { L, R } the hands, far (where a thrown line bites), cross (the crossing line { from, to, sag },
// whose ends are a stake at the building spot and one at the far landing, HANG body heights above the ground)
(function () {
  const R = () => window.TUWRig;
  // ---- the scripts ----------------------------------------------------------------------------------------------
  // reveal(sl, Bk) picks the pieces a step builds; they appear in near-to-far order through the step. Pieces no step
  // claims go up with the last step. act: an action name, or a list played in turn; reps: one-shots repeated.
  const near = sl => sl._end === 'near', far = sl => sl._end === 'far';
  // laying the deck, in cycles: set a plank down on the edge (sped up), hammer it in. Each cycle lays perCycle units of deck during the
  // hammering; between cycles the builder steps up to the new edge (build, build, build, step up)
  const DECK = [{ n: 'place', speed: 2.6 }, { n: 'hammer', speed: 1.25 }];   // set a plank down on the edge, nail it
  const byU = (a, b) => a.u - b.u;   // build order by the pieces' own sequence (bottom-up, tier by tier) instead of near-to-far
  // Steps: act, dur | perCycle, at ('spot' | 'deck' | 'far' | 'line': hanging on the crossing line, moving along it,
  // travel 1 over / -1 back), reveal, order, line ('throw' | 'haul' | 'lower' | 'across'), tool (replaces the carried
  // plank, e.g. a stone), hold (a frozen moment of the clip), grow, holdCoil, reps, atEnd.
  const SCRIPTS = {
    rope: [
      { id: 'anchors', act: 'hammer', dur: 3, at: 'spot', reveal: sl => near(sl) && (sl.kind === 'anchor' || sl.kind === 'cap' || (sl.kind === 'rope' && sl.s == null)) },
      { id: 'towers', act: 'push', dur: 3, at: 'spot', reveal: sl => near(sl) && (sl.kind === 'tower' || sl.kind === 'stay') },
      // coil the line, then throw it from the coil: the full coil passes to the far hand, the near hand throws the grapnel
      { id: 'coil', act: 'coil', dur: 4, at: 'spot', grow: true },
      { id: 'throw', act: 'throw', reps: 3, dur: 4.5, at: 'spot', line: 'throw', atEnd: true, holdCoil: true, reveal: sl => far(sl) && (sl.kind === 'anchor' || sl.kind === 'cap' || (sl.kind === 'rope' && sl.s == null)) },
      { id: 'cables', act: 'haul', dur: 4, at: 'spot', line: 'haul', reveal: sl => sl.kind === 'cable' },
      { id: 'deck', act: DECK, perCycle: 64, at: 'deck', reveal: sl => /^(deck|plank|hanger)$/.test(sl.kind) || (sl.kind === 'rope' && sl.s != null) },
      { id: 'far', act: 'push', dur: 3, at: 'far', reveal: sl => far(sl) },
    ],
    // timber truss, launched: saw the timbers, set the near sill, then peg a panel and push it out, again and again, until
    // the truss lands on the far lip; then walk out laying the deck
    truss: [
      { id: 'saw', act: 'saw', dur: 3, at: 'spot' },
      { id: 'sills', act: 'hammer', dur: 2.5, at: 'spot', reveal: sl => near(sl) && sl.kind === 'abut' },
      { id: 'truss', act: ['hammer', 'push'], dur: 8, at: 'spot', reveal: sl => /^(chord|vert|brace|abut)$/.test(sl.kind) },
      { id: 'deck', act: DECK, perCycle: 80, at: 'deck', reveal: sl => true },
    ],
    // pier trestle: saw the timbers, lower each trestle onto its rock pillar on a rope (foot, legs, braces, cap), slide the
    // stringers out over the caps to the far lip, then the deck
    pier: [
      { id: 'saw', act: 'saw', dur: 3, at: 'spot' },
      { id: 'lower', act: 'haul', dur: 5, at: 'spot', line: 'lower', order: byU, reveal: sl => /^(foot|leg|brace|cap)$/.test(sl.kind) },
      { id: 'stringers', act: 'push', dur: 4, at: 'spot', reveal: sl => sl.kind === 'chord' || sl.kind === 'abut' },
      { id: 'deck', act: DECK, perCycle: 80, at: 'deck', reveal: sl => true },
    ],
    // cantilever (bazam): slide the near beam tiers out, weight their tails with stones, coil and throw a line, cross on
    // it hand over hand, build the far stack, slide back down the line, push the stringers across, lay the deck
    cantilever: [
      { id: 'tiers', act: 'push', dur: 3.5, at: 'spot', order: byU, reveal: sl => near(sl) && ((sl.kind === 'chord' && sl.s == null) || sl.kind === 'abut') },
      { id: 'stones', act: [{ n: 'lift', speed: 2.6 }, { n: 'place', speed: 2.6 }], dur: 3.54, at: 'spot', tool: 'stone', order: byU, reveal: sl => sl.kind === 'stone' },
      { id: 'coil', act: 'coil', dur: 2.5, at: 'spot', grow: true },
      { id: 'throw', act: 'throw', reps: 2, dur: 3, at: 'spot', line: 'throw', atEnd: true, holdCoil: true },
      { id: 'over', act: { n: 'climb', speed: 2 }, dur: 6, at: 'line', travel: 1, line: 'across' },
      { id: 'far', act: 'push', dur: 3, at: 'far', line: 'across', order: byU, reveal: sl => far(sl) && ((sl.kind === 'chord' && sl.s == null) || sl.kind === 'abut' || sl.kind === 'brace') },
      { id: 'back', act: 'climb', hold: .35, dur: 2.5, at: 'line', travel: -1, line: 'across' },
      { id: 'stringers', act: 'push', dur: 2.5, at: 'spot', line: 'across', reveal: sl => (sl.kind === 'chord' && sl.s != null) || sl.kind === 'brace' || sl.kind === 'vert' },
      { id: 'deck', act: DECK, perCycle: 80, at: 'deck', reveal: sl => true },
    ],
    // any other type: frame from the ledge, then the deck walking out
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
    lists.forEach((l, i) => l.sort(sc[i].order || ((a, b) => a._o - b._o || a.u - b.u)));
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
  function pose(Bk, t, g) {
    const st = step(Bk), rig = R(); if (!st || !rig) return null;
    const acts = actsOf(st), A = rig.actions;
    let p;
    if (st.reps) {
      const d = A[acts[0].n].dur, per = st.dur / st.reps, n = Math.floor(t / per), tc = Math.min(d - .01, (t % per) * d / per);
      p = rig.action(acts[0].n, tc);
      if (n < st.reps - 1) p = ease(rig, p, rig.action(acts[0].n, 0), (d - tc) * per / d);
    }
    else if (st.hold != null) p = rig.action(acts[0].n, st.hold);
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
    if (st.tool && p.tool === 'plank') p = Object.assign({}, p, { tool: st.tool });
    if (!p.tool) p = Object.assign({}, p, { tool: 'empty' });   // working hands: held things stay set down
    if (st.at === 'line' && g && g.cross) {   // hanging under the line, hands on it, head toward the far side, along its slope
      const C = g.cross, u = travelU(Bk), e = .01, a = along(C, Math.max(0, u - e)), b = along(C, Math.min(1, u + e)), out = Math.sign(C.to[0] - C.from[0]) || 1;
      p = rig.onRope(p, Math.atan2(-(b[1] - a[1]), (b[0] - a[0]) * out), HANG);
    }
    return p;
  }
  // how far along the crossing line the builder is (0 at the spot, 1 at the far landing)
  function travelU(Bk) { const st = step(Bk); if (!st || !st.travel) return 0; const f = state(Bk.k).frac, s = f * f * (3 - 2 * f); return st.travel > 0 ? s : 1 - s; }
  const HANG = .8;   // the crossing line's height above the ground at its stakes, in body heights (hands on it)
  function along(L, u) {   // the same sagging curve drawLine paints: a quadratic, its control below the chord's middle
    const [ax, ay] = L.from, [bx, by] = L.to, mx = (ax + bx) / 2, my = (ay + by) / 2 + Math.hypot(bx - ax, by - ay) * (L.sag || 0), v = 1 - u;
    return [v * v * ax + 2 * u * v * mx + u * u * bx, v * v * ay + 2 * u * v * my + u * u * by];
  }
  // the grapnel line: thrown three times (short, shorter of the far lip, then it catches), then lying across until
  // the cables are in
  // g: { L, R, far, cross } (see the top). A thrown line pays out from the coil (far hand); a hauled or lowered one runs from
  // the near hand; one lying across runs stake to stake
  function line(Bk, t, g) {
    const st = step(Bk); if (!st || !st.line) return null;
    if (st.line === 'haul') return { from: g.L, to: g.far, sag: .12, done: true };
    if (st.line === 'across') return Object.assign({}, g.cross, { done: true, stakes: true });
    if (st.line === 'lower') {   // down to the pillar whose trestle is going up
      const pins = Bk.pinnacles; if (!pins || !pins.length) return null;
      const pin = pins[Math.min(pins.length - 1, Math.floor(state(Bk.k).frac * pins.length))];
      return { from: g.L, to: [pin.x, pin.yTop - 4], sag: 0, done: true };
    }
    const target = g.far, hand = st.holdCoil ? g.R : g.L, per = st.dur / st.reps, n = Math.floor(t / per), u = (t % per) / per, rel = REL;
    if (u < rel) return null;
    const v = (u - rel) / (1 - rel), reach = n >= st.reps - 1 ? 1 : n === 0 ? .45 : .75;
    return { from: hand, to: target, reach, v, caught: n >= st.reps - 1 };
  }
  // where the builder stands on the deck during the current cycle: just behind the edge laid by the cycles before
  function station(Bk) { const st = step(Bk); if (!st || !st.perCycle) return null; const s = state(Bk.k), n = Math.floor(s.frac * cyclesOf(Bk, st) + 1e-9); return Math.max(4, Math.min(Bk.len - 4, n * st.perCycle - 8)); }
  window.TUWBuild = { state, complete, advance, revealed, deckExtent, step, pose, line, along, travelU, HANG, prep, station, durOf, scripts: SCRIPTS };
})();
