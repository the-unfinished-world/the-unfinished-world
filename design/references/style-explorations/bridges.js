// Bridge construction for the ascent. Three real bridge types, each supported only by rock it actually touches.
//   rope  : suspension footbridge. Towers on each ledge, back-stays to anchors in the rock, two main cables,
//           hangers down to a sagging deck slung on side ropes.
//   truss : timber Howe truss. Rests on abutments at the two ledges only; top chord, bottom chord (deck),
//           verticals, diagonals leaning toward mid-span. No supports under the span.
//   pier  : beam bridge on trestles, but every trestle stands on a rock pinnacle that rises out of the mist
//           (the pinnacles are returned so the scene can paint them), plus short end trestles on the ledges.
// Pieces are small brush sprites that fly in; `u` is the construction time along the walker's approach
// (u < 0 = before the walker reaches the bridge start, u in [0,1] = as the walker crosses). Structure first,
// deck after, railing last.
window.Bridges = (function () {
  const lerp = (a, b, t) => a + (b - a) * t;
  const bez = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
  const { rng, roughen, pathOf, vnoise } = Ink;

  // ---- sprites -------------------------------------------------------------------------------------
  const SPR = new Map(), SS = 3, PAD = 4;
  function sprite(sl) {
    const w = Math.max(1, Math.round(sl.w * 2) / 2), hh = Math.max(1, Math.round(sl.h * 2) / 2), key = `${sl.kind}_${w}_${hh}_${sl.color}`;
    let s = SPR.get(key); if (s) return s;
    const c = document.createElement('canvas'); c.width = Math.ceil((w + 2 * PAD) * SS); c.height = Math.ceil((hh + 2 * PAD) * SS);
    const o = c.getContext('2d'); o.setTransform(SS, 0, 0, SS, PAD * SS, PAD * SS);
    const r = rng(key.length * 131 + Math.round(w * 7 + hh * 13)), short = Math.min(w, hh);
    const line = sl.kind === 'rail' || sl.kind === 'cable' || sl.kind === 'stay' || sl.kind === 'hanger' || sl.kind === 'rope';
    if (line) {
      const along = w >= hh, L = along ? w : hh, T = along ? hh : w;
      const segs = Math.max(4, Math.floor(L / 4)); o.strokeStyle = sl.color; o.lineCap = 'round';
      for (let i = 0; i < segs; i++) { const t0 = i / segs, t1 = (i + 1) / segs; o.lineWidth = T * lerp(.6, 1.4, vnoise(i * .9, 5)); o.globalAlpha = lerp(.6, 1, vnoise(i * .7 + 20, 6)); if (sl.kind === 'rail' && r() < .05) continue; o.beginPath(); if (along) { o.moveTo(w * t0, hh / 2 + (r() - .5) * .4); o.lineTo(w * t1, hh / 2 + (r() - .5) * .4); } else { o.moveTo(w / 2 + (r() - .5) * .4, hh * t0); o.lineTo(w / 2 + (r() - .5) * .4, hh * t1); } o.stroke(); }
    } else if (sl.kind === 'stone') {
      o.fillStyle = sl.color; o.globalAlpha = .92; o.beginPath(); o.ellipse(w / 2, hh / 2, w / 2, hh / 2, 0, 0, Math.PI * 2); o.fill(); o.globalAlpha = .35; o.fillStyle = '#f1ede4'; o.beginPath(); o.ellipse(w * .4, hh * .35, w * .22, hh * .18, 0, 0, Math.PI * 2); o.fill();
    } else {
      const amp = Math.min(1.1, short * .35 + .15);
      const pts = roughen([[0, 0], [w, 0], [w, hh], [0, hh]], Math.round(w * 3 + hh * 5), amp, 2.5);
      o.fillStyle = sl.color; o.globalAlpha = sl.kind === 'deck' ? .9 : .92; pathOf(o, pts); o.fill();
      o.globalCompositeOperation = 'destination-out'; o.globalAlpha = .18; o.lineWidth = short * .35; o.strokeStyle = '#000'; o.lineCap = 'round';
      o.beginPath(); if (w >= hh) { o.moveTo(w * .15, hh * lerp(.3, .7, r())); o.lineTo(w * .85, hh * lerp(.3, .7, r())); } else { o.moveTo(w * lerp(.3, .7, r()), hh * .15); o.lineTo(w * lerp(.3, .7, r()), hh * .85); } o.stroke();
      o.globalCompositeOperation = 'source-over';
      if (sl.kind === 'post' || sl.kind === 'leg' || sl.kind === 'tower' || sl.kind === 'vert') { o.fillStyle = sl.color; o.globalAlpha = .5; o.beginPath(); o.ellipse(w / 2, hh - short * .3, w * .8, short * .6, 0, 0, Math.PI * 2); o.fill(); o.beginPath(); o.ellipse(w / 2, short * .3, w * .7, short * .5, 0, 0, Math.PI * 2); o.fill(); }
      if (sl.kind === 'plank' || sl.kind === 'deck') { o.strokeStyle = sl.color; o.globalAlpha = .35; o.lineWidth = .4; o.beginPath(); o.moveTo(w + .6, hh * .1); o.lineTo(w + .6 + (r() - .5), hh * .9); o.stroke(); }
    }
    s = { c, w, hh }; SPR.set(key, s); return s;
  }
  function drawPiece(ctx, sl) { const s = sprite(sl); ctx.drawImage(s.c, -s.w / 2 - PAD, -s.hh / 2 - PAD, s.w + 2 * PAD, s.hh + 2 * PAD); }

  // ---- geometry helpers ----------------------------------------------------------------------------
  function curve(P0, P1, P2) {
    const pts = []; let len = 0, prev = null;
    for (let i = 0; i <= 80; i++) { const t = i / 80, p = { x: bez(P0.x, P1.x, P2.x, t), y: bez(P0.y, P1.y, P2.y, t) }; if (prev) len += Math.hypot(p.x - prev.x, p.y - prev.y); pts.push({ t, s: len }); prev = p; }
    const tOf = s => { let lo = 0; while (lo < pts.length - 1 && pts[lo + 1].s < s) lo++; const a = pts[lo], b = pts[Math.min(lo + 1, pts.length - 1)]; return lerp(a.t, b.t, b.s === a.s ? 0 : (s - a.s) / (b.s - a.s)); };
    const at = s => { const t = tOf(Math.max(0, Math.min(len, s))); const x = bez(P0.x, P1.x, P2.x, t), y = bez(P0.y, P1.y, P2.y, t); const tx = 2 * (1 - t) * (P1.x - P0.x) + 2 * t * (P2.x - P1.x), ty = 2 * (1 - t) * (P1.y - P0.y) + 2 * t * (P2.y - P1.y); const ang = Math.atan2(ty, tx); return { x, y, ang, nx: -Math.sin(ang), ny: Math.cos(ang) }; };
    return { len, at };
  }
  // a straight member between two points as one piece
  const member = (a, b, kind, h, color, extra) => Object.assign({ kind, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w: Math.hypot(b.x - a.x, b.y - a.y), h, rot: Math.atan2(b.y - a.y, b.x - a.x), color }, extra || {});
  // a curve as a run of short pieces
  function run(C, kind, h, color, step, extra) { const out = []; for (let s = 0; s < C.len; s += step) { const a = C.at(s), b = C.at(Math.min(C.len, s + step)); out.push(Object.assign(member(a, b, kind, h, color), { s }, extra || {})); } return out; }

  // ---- the camera -----------------------------------------------------------------------------------
  // One oblique view for every bridge: depth (across the walkway) always projects to the same screen vector,
  // far edge up and slightly right. Near edge = centreline - DEPTH, far edge = centreline + DEPTH. Posts are plumb.
  const DEPTH = { x: 4, y: -14 }, DL = Math.hypot(DEPTH.x, DEPTH.y), DU = { x: DEPTH.x / DL, y: DEPTH.y / DL };
  const nearPt = (p, k) => ({ x: p.x - DEPTH.x * (k == null ? 1 : k), y: p.y - DEPTH.y * (k == null ? 1 : k) });
  const farPt = (p, k) => ({ x: p.x + DEPTH.x * (k == null ? 1 : k), y: p.y + DEPTH.y * (k == null ? 1 : k) });
  // draw a piece: deck boards use a sheared frame (x along the path, y along DEPTH); everything else rotates
  function place(ctx, sl, x, y, rot, alpha) {
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
    if (sl.shear) { const c = Math.cos(rot), s = Math.sin(rot); ctx.transform(c, s, sl.shear.x, sl.shear.y, x, y); } else { ctx.translate(x, y); ctx.rotate(rot); }
    drawPiece(ctx, sl); ctx.restore();
  }

  // a thin paper gap drawn under a near piece where it crosses the black figure, so the overlap reads
  function halo(ctx, sl, x, y, rot, pad) { ctx.save(); if (sl.shear) { const c = Math.cos(rot), s = Math.sin(rot); ctx.transform(c, s, sl.shear.x, sl.shear.y, x, y); } else { ctx.translate(x, y); ctx.rotate(rot); } ctx.fillStyle = '#ece7dc'; const w = Math.max(1, sl.w), hh = Math.max(1, sl.h); ctx.fillRect(-w / 2 - pad, -hh / 2 - pad, w + 2 * pad, hh + 2 * pad); ctx.restore(); }

  // ---- the bridge types -----------------------------------------------------------------------------
  function make(o) {
    const { P0, P2, type, seed, DECK_W, INK } = o, r = rng(seed), dir = Math.sign(P2.x - P0.x) || 1;
    const mid = { x: (P0.x + P2.x) / 2, y: (P0.y + P2.y) / 2 }, span = Math.hypot(P2.x - P0.x, P2.y - P0.y);
    const DARK = '#2f2c28', TIMB = '#3a3733', DECK = '#8e897f', PLANK = '#56524b', PERP = .3, halfW = DECK_W * PERP * .5;
    const slots = [], pinnacles = [];
    const push = (sl) => { if (sl.u == null) sl.u = (sl.s == null ? 0 : sl.s / len) + r() * .012; const ang = -Math.PI * .55 + (r() - .5) * 1.2, dist = 60 + r() * 30; sl.sx = sl.still ? sl.x : sl.fromBelow ? sl.x : sl.x + Math.cos(ang) * dist * (r() < .5 ? -1 : 1); sl.sy = sl.still ? sl.y : sl.fromBelow ? sl.y + sl.h * .5 : sl.y + Math.abs(Math.sin(ang)) * dist; sl.mx = (sl.sx + sl.x) / 2 + (r() - .5) * 20; sl.my = Math.min(sl.sy, sl.y) - 12; sl.dur = .4 + r() * .2; sl.rot0 = sl.still ? 0 : (r() - .5) * .5; sl.a = sl.a || 1; slots.push(sl); };
    // deck boards across the walkway (sheared to DEPTH), optional cleats; s0/s1 limit the run; uOff shifts build time
    const deckRun = (Cv, opts) => { opts = opts || {}; const L = Cv.len;
      for (let s = 0; s < L; s += 5) { const p = Cv.at(s), u = opts.u ? opts.u(s) : undefined;
        push({ s, u, kind: 'deck', x: p.x, y: p.y, w: 5.6, h: 2 * DL, rot: p.ang, shear: DU, color: DECK, a: .9, order: .5, still: true });
        if (r() > .1) push({ s, u: u == null ? undefined : u + .004, kind: 'plank', x: p.x, y: p.y, w: 2, h: 2 * DL, rot: p.ang, shear: DU, color: PLANK, order: .6 }); }
      if (opts.cleats) for (let s = 6; s < L; s += 12) { const p = Cv.at(s); push({ s, kind: 'cleat', x: p.x, y: p.y, w: 2.2, h: 2 * DL * .9, rot: p.ang, shear: DU, color: DARK, order: .7 }); } };
    // plumb posts on the near and far deck edges, rails between post tops; near side drawn in front of the walker
    const railRun = (Cv, levels) => { const L = Cv.len;
      for (let s = 10; s < L - 4; s += 36) { const p = Cv.at(s), q = Cv.at(Math.min(L, s + 36));
        for (const side of [-1, 1]) { const front = side < 0, Pp = front ? nearPt(p) : farPt(p), Qp = front ? nearPt(q) : farPt(q);
          push({ s, kind: 'post', x: Pp.x, y: Pp.y - 24, w: 2.6, h: 48, rot: 0, color: INK, u: s / len + .012, front });
          if (s + 36 <= L + 30) for (const lvl of levels) push(Object.assign(member({ x: Pp.x, y: Pp.y - lvl }, { x: Qp.x, y: Qp.y - lvl }, 'rail', 1.5, INK), { u: s / len + .02, a: .75, front })); } } };
    // the underside of the deck's near edge at path point p
    const underNear = (p, gap) => ({ x: p.x - DEPTH.x, y: p.y - DEPTH.y + (gap == null ? 3 : gap) });
    let P1, C, len;
    if (type === 'rope') P1 = { x: mid.x, y: mid.y + 30 + span * .04 };              // sag
    else if (type === 'truss') P1 = { x: mid.x, y: mid.y - 8 };                        // slight camber
    else P1 = { x: mid.x, y: mid.y - 4 };
    C = curve(P0, P1, P2); len = C.len; const at = C.at;

    if (type === 'rope') {
      // suspension footbridge: a tower on each deck edge at each end, back-stays to anchors behind, a main cable per
      // side sagging between its towers, plumb hangers down to that side's deck edge, side ropes along both edges.
      const TH = 64, tops = { near: [], far: [] };
      const sidePt = (which, p) => which === 'near' ? nearPt(p) : farPt(p);
      for (const [P, back] of [[P0, -dir], [P2, dir]]) {
        const base = { x: P.x + back * 6, y: P.y };
        push(Object.assign(member(nearPt(base, .9), farPt(base, .9), 'cap', 3, DARK), { u: -.1 }));        // sill between the tower feet
        for (const which of ['far', 'near']) { const front = which === 'near', B = sidePt(which, base), Tt = { x: B.x, y: B.y - TH };
          push({ kind: 'tower', x: B.x, y: B.y - TH / 2 + 2, w: 4.5, h: TH + 4, rot: 0, color: DARK, u: -.1, fromBelow: true, front });
          tops[which].push(Tt);
          const A = { x: B.x + back * 72, y: B.y + 1 };
          push({ kind: 'anchor', x: A.x, y: A.y + 4, w: 4, h: 14, rot: 0, color: DARK, u: -.1, front });
          push({ kind: 'anchor', x: A.x + back * 6, y: A.y + 1, w: 14, h: 6, rot: 0, color: DARK, u: -.1, front });
          push(member(Tt, { x: A.x, y: A.y - 2 }, 'stay', 1.6, INK, { u: -.09, front }));
          const Dk = sidePt(which, { x: P.x + back * 18, y: P.y + 1 }), E = sidePt(which, P);       // deck-rope stake for this edge
          push({ kind: 'anchor', x: Dk.x, y: Dk.y + 3, w: 3.5, h: 10, rot: 0, color: DARK, u: -.1, front });
          push(member(E, { x: Dk.x, y: Dk.y - 2 }, 'rope', 1.5, INK, { u: -.02, front })); }
      }
      for (const which of ['far', 'near']) { const front = which === 'near', [Ta, Tb] = tops[which];
        const edgeMid = sidePt(which, at(len / 2)), sagY = edgeMid.y - 34, Q1 = { x: (Ta.x + Tb.x) / 2, y: 2 * sagY - .5 * (Ta.y + Tb.y) };
        const cable = curve(Ta, Q1, Tb);
        for (const pc of run(cable, 'cable', 1.7, INK, 14)) push(Object.assign(pc, { u: -.08 + .05 * (pc.s / cable.len), front }));
        // plumb hangers: the cable's x is linear in t, so the hanger above an edge point is found directly
        for (let s = 16; s < len - 8; s += 16) { const E = sidePt(which, at(s)), t = (E.x - Ta.x) / (Tb.x - Ta.x); if (t <= 0 || t >= 1) continue; const cy = bez(Ta.y, Q1.y, Tb.y, t); if (cy < E.y - 6) push(member({ x: E.x, y: cy }, E, 'hanger', 1.1, INK, { s, u: -.02 + .02 * (s / len), front })); }
        const edge = curve(sidePt(which, P0), sidePt(which, P1), sidePt(which, P2));
        for (const pc of run(edge, 'rope', 1.6, INK, 12)) push(Object.assign(pc, { u: -.01 + .01 * (pc.s / len), front })); }
      deckRun(C);
    }
    else if (type === 'truss') {
      // timber Howe truss: a truss plane on each deck edge, plumb verticals, top chords at handrail height,
      // diagonals leaning toward mid-span; transverse abutment sills at both lips, a thrust block at the low end.
      const H = 41;
      for (const [P, back] of [[P0, -dir], [P2, dir]]) { const base = { x: P.x + back * 8, y: P.y + 4 }; push(Object.assign(member(nearPt(base, 1.15), farPt(base, 1.15), 'abut', 8, DARK), { u: -.1 })); }
      const low = P0.y > P2.y ? P0 : P2, lowSide = low === P0 ? -dir : dir, lowN = nearPt(low);
      push({ kind: 'abut', x: lowN.x + lowSide * 20, y: lowN.y - 2, w: 10, h: 12, rot: 0, color: DARK, u: -.1 });
      const bays = Math.max(4, Math.round(len / 40)), bay = len / bays;
      for (const which of ['far', 'near']) { const front = which === 'near', E = s => which === 'near' ? nearPt(at(s)) : farPt(at(s)), Tp = s => { const e = E(s); return { x: e.x, y: e.y - H }; };
        for (let s = 0; s < len; s += 20) { const s2 = Math.min(len, s + 20); push(Object.assign(member(E(s), E(s2), 'chord', 3.4, TIMB), { s, u: -.07 + .04 * (s / len), front })); push(Object.assign(member(Tp(s), Tp(s2), 'chord', 2.8, TIMB), { s, u: -.06 + .04 * (s / len), front })); }
        for (let i = 0; i <= bays; i++) { const s = i * bay; push(Object.assign(member(E(s), Tp(s), 'vert', 2.8, TIMB), { s, u: -.05 + .04 * (s / len), front })); }
        for (let i = 0; i < bays; i++) { const s0 = i * bay, s1 = (i + 1) * bay, towardMid = (s0 + s1) / 2 < len / 2; push(Object.assign(member(towardMid ? E(s0) : E(s1), towardMid ? Tp(s1) : Tp(s0), 'brace', 1.8, TIMB), { s: s0, u: -.045 + .04 * (s0 / len), front })); } }
      deckRun(C, { cleats: true });
    }
    else if (type === 'cantilever') {
      // Bhutanese bazam adapted to a climbing crossing: from each cliff, 4 beams stacked in contact project
      // horizontally, each further than the one below; lower tails lie on the ledge under a stone cairn, upper tails
      // socket into the cliff; a knee strut from the cliff face to tier 3; posts from the tiers up to the deck;
      // stringers under the deck between the two stacks. Everything meets the deck at its near-edge underside.
      const T = 6, PITCH = 7, PROJ = [36, 66, 96, 126], NT = PROJ.length, D0 = Math.abs(DEPTH.y) + 4;
      const sAtX = x => { let best = 0, bd = 1e9; for (let s = 0; s <= len; s += 2) { const dd = Math.abs(at(s).x - x); if (dd < bd) { bd = dd; best = s; } } return best; };
      const underY = x => underNear(at(sAtX(x)), 2).y;
      const stack = (P, outDir, tailLen, top) => {
        const tips = [];
        PROJ.forEach((proj, j) => { const y = P.y + top + PITCH * (NT - 1 - j) + T / 2, yTop = y - T / 2; let pr = proj;
          for (let dd = 4; dd <= proj; dd += 2) if (underY(P.x + outDir * dd) >= yTop - 1) { pr = Math.max(10, dd - 3); break; }   // stop where the beam meets the deck underside
          const x0 = P.x - outDir * tailLen, x1 = P.x + outDir * pr; push(member({ x: x0, y }, { x: x1, y }, 'chord', T, TIMB, { u: -.1 + .012 * j })); tips.push({ x: x1, y: yTop }); });
        for (let j = 0; j < NT - 1; j++) push({ kind: 'abut', x: P.x + outDir * 4, y: P.y + top + PITCH * (NT - 1 - j) - 1, w: 8, h: 6, rot: 0, color: DARK, u: -.1 + .012 * j + .006 });
        return tips;
      };
      const lowP = P0, highP = P2;
      const topL = D0, topU = Math.min(40 + D0, at(len - PROJ[NT - 1]).y + D0 - highP.y);
      const tipsL = stack(lowP, dir, 170, topL), tipsU = stack(highP, -dir, 16, topU);
      const baseL = lowP.y + topL + PITCH * (NT - 1) + T, baseU = highP.y + topU + PITCH * (NT - 1) + T;
      for (let q = 0; q < 12; q++) { const cx = lowP.x - dir * (26 + (q % 6) * 22 + (q >= 6 ? 11 : 0)), cy = lowP.y + topL - 3 + (q >= 6 ? -9 : 0); push({ kind: 'stone', x: cx + (r() - .5) * 4, y: cy, w: 12 + r() * 5, h: 9 + r() * 3, rot: (r() - .5) * .5, color: '#3a3733', u: -.05 + .004 * q }); }
      push({ kind: 'abut', x: highP.x + dir * 8, y: highP.y + topU + PITCH * (NT - 1) / 2 + 2, w: 4, h: PITCH * NT + 2, rot: 0, color: INK, u: -.1 });
      push(member({ x: lowP.x - dir * 30, y: baseL + 50 }, { x: lowP.x + dir * PROJ[2] * .85, y: tipsL[2].y + T }, 'brace', 5, TIMB, { u: -.04 }));
      push(member({ x: highP.x + dir * 30, y: baseU + 50 }, { x: highP.x - dir * PROJ[2] * .85, y: tipsU[2].y + T }, 'brace', 5, TIMB, { u: -.04 }));
      // stringers along the deck's near-edge underside, full length
      for (let i = 0; i < 2; i++) for (const pc of run(C, 'chord', 4, TIMB, 20)) { const u0 = underNear(at(pc.s), 3 + i * 4); push(Object.assign(pc, { x: pc.x - DEPTH.x, y: pc.y - DEPTH.y + 3 + i * 4, u: pc.s / len - .03 + .005 * i })); }
      // posts from the tiers up to the near-edge underside: at each stack's tip and mid-stack
      const postUp = (x, yTop) => { const top = underNear(at(sAtX(x)), 2); if (top.y < yTop - 2) push(member({ x, y: yTop }, { x, y: top.y }, 'vert', 4, TIMB, { u: -.03 })); };
      postUp(tipsL[NT - 1].x, tipsL[NT - 1].y); postUp((lowP.x + tipsL[NT - 1].x) / 2, tipsL[NT - 1].y);
      postUp(tipsU[NT - 1].x, tipsU[NT - 1].y); postUp((highP.x + tipsU[NT - 1].x) / 2, tipsU[NT - 1].y);
      deckRun(C, { cleats: true });
      railRun(C, [46, 26]);
    }
    else { // pier: trestles on rock pinnacles
      const n = span > 300 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const s = len * (n === 1 ? .5 : .33 + .34 * i), p = at(s), H = 54 + r() * 24, q = nearPt(p), tA = Math.tan(p.ang);
        const capY = q.y + 6, footY = q.y + H + 8;
        pinnacles.push({ x: q.x, yTop: footY - 2, w: 46, seed: seed * 3 + i });
        push({ kind: 'cap', x: q.x, y: capY, w: 28, h: 3.5, rot: p.ang, color: DARK, s, u: s / len - .05 });          // bolster follows the deck underside
        for (const side of [-1, 1]) { const lx = q.x + side * 9, top = capY + side * 9 * tA + 1.5; push({ kind: 'leg', x: lx, y: (top + footY) / 2, w: 3, h: footY - top, rot: 0, color: DARK, s, u: s / len - .06, fromBelow: true }); }
        const midY = (capY + footY) / 2;
        push({ kind: 'brace', x: q.x, y: midY, w: 1.5, h: Math.min(30, H * .8), rot: .62, color: DARK, s, u: s / len - .055 });
        push({ kind: 'brace', x: q.x, y: midY, w: 1.5, h: Math.min(30, H * .8), rot: -.62, color: DARK, s, u: s / len - .055 });
        push({ kind: 'foot', x: q.x, y: footY, w: 28, h: 3.5, rot: 0, color: DARK, s, u: s / len - .07 });
      }
      // short end trestles on the ledges
      { const base = { x: P0.x - dir * 9, y: P0.y + 4 }; push(Object.assign(member(nearPt(base, 1.15), farPt(base, 1.15), 'abut', 8, DARK), { u: -.1 })); }    // sill on the lower lip
      { const base = { x: P2.x + dir * 9, y: P2.y + 4 }; push(Object.assign(member(nearPt(base, 1.15), farPt(base, 1.15), 'abut', 8, DARK), { u: -.1 })); }    // sill on the upper lip
      // stringers between supports, then deck and rails
      for (const pc of run(C, 'chord', 3, TIMB, 20)) push(Object.assign(pc, { x: pc.x - DEPTH.x, y: pc.y - DEPTH.y + 3, u: pc.s / len - .03 }));
      deckRun(C, { cleats: true });
      railRun(C, [46, 26]);
    }
    if (o.landing) { const L = o.landing, n = Math.max(2, Math.round(Math.hypot(L.x - P2.x, L.y - P2.y) / 5)), ang = Math.atan2(L.y - P2.y, L.x - P2.x);
      for (let i = 1; i <= n; i++) { const t = i / n, x = lerp(P2.x, L.x, t), y = lerp(P2.y, L.y, t); push({ kind: 'deck', x, y, w: 5.6, h: 2 * DL, rot: ang, shear: DU, color: DECK, a: .9, order: .5, still: true, u: .97 + .03 * t }); if (r() > .1) push({ kind: 'plank', x, y, w: 2, h: 2 * DL, rot: ang, shear: DU, color: PLANK, u: .97 + .03 * t + .005 }); } }
    slots.sort((a, b) => a.u - b.u);
    return { k: o.k, type, P0, P1, P2, len, at, slots, pinnacles };
  }
  return { make, sprite, drawPiece, place, halo, DEPTH };
})();
