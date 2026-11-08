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

  // ---- the three types ----------------------------------------------------------------------------
  function make(o) {
    const { P0, P2, type, seed, DECK_W, INK } = o, r = rng(seed), dir = Math.sign(P2.x - P0.x) || 1;
    const mid = { x: (P0.x + P2.x) / 2, y: (P0.y + P2.y) / 2 }, span = Math.hypot(P2.x - P0.x, P2.y - P0.y);
    const DARK = '#2f2c28', TIMB = '#3a3733', DECK = '#8e897f', PLANK = '#56524b', PERP = .3, halfW = DECK_W * PERP * .5;
    const slots = [], pinnacles = [];
    const push = (sl) => { if (sl.u == null) sl.u = (sl.s == null ? 0 : sl.s / len) + r() * .012; const ang = -Math.PI * .55 + (r() - .5) * 1.2, dist = 60 + r() * 30; sl.sx = sl.still ? sl.x : sl.fromBelow ? sl.x : sl.x + Math.cos(ang) * dist * (r() < .5 ? -1 : 1); sl.sy = sl.still ? sl.y : sl.fromBelow ? sl.y + sl.h * .5 : sl.y + Math.abs(Math.sin(ang)) * dist; sl.mx = (sl.sx + sl.x) / 2 + (r() - .5) * 20; sl.my = Math.min(sl.sy, sl.y) - 12; sl.dur = .4 + r() * .2; sl.rot0 = sl.still ? 0 : (r() - .5) * .5; sl.a = sl.a || 1; slots.push(sl); };
    let P1, C, len;
    if (type === 'rope') P1 = { x: mid.x, y: mid.y + 30 + span * .04 };              // sag
    else if (type === 'truss') P1 = { x: mid.x, y: mid.y - 8 };                        // slight camber
    else P1 = { x: mid.x, y: mid.y - 4 };
    C = curve(P0, P1, P2); len = C.len; const at = C.at;

    if (type === 'rope') {
      const TH = 64;                                                                   // tower height
      const T0 = { x: P0.x - dir * 6, y: P0.y - TH }, T2 = { x: P2.x + dir * 6, y: P2.y - TH };
      // towers stand on the ledge tops; anchors are stakes behind them, back-stays run tower top -> anchor
      for (const [P, T, side] of [[P0, T0, -dir], [P2, T2, dir]]) {
        push({ kind: 'tower', x: T.x, y: P.y - TH / 2 + 2, w: 4.5, h: TH + 4, rot: 0, color: DARK, u: -.1, fromBelow: true });
        push({ kind: 'cap', x: T.x, y: P.y + 3, w: 18, h: 3, rot: 0, color: DARK, u: -.1 });
        const A = { x: P.x + side * 72, y: P.y + 1 };
        push({ kind: 'anchor', x: A.x, y: A.y + 4, w: 4, h: 14, rot: 0, color: DARK, u: -.1 });        // stake driven into the ledge
        push({ kind: 'anchor', x: A.x + side * 6, y: A.y + 1, w: 14, h: 6, rot: 0, color: DARK, u: -.1 }); // deadman block behind it
        push(member(T, { x: A.x, y: A.y - 2 }, 'stay', 1.6, INK, { u: -.09 }));
        const Dk = { x: P.x + side * 18, y: P.y + 1 };                                                     // deck-rope stake
        push({ kind: 'anchor', x: Dk.x, y: Dk.y + 3, w: 3.5, h: 10, rot: 0, color: DARK, u: -.1 });
        for (const s2 of [-1, 1]) push(member({ x: P.x, y: P.y + s2 * halfW * .3 }, { x: Dk.x, y: Dk.y - 2 }, 'rope', 1.5, INK, { u: -.02 }));
      }
      // main cables: pass TH above the towers' feet, sag to ~28px above the deck at mid-span
      const sagY = at(len / 2).y - 34, Q1 = { x: mid.x, y: 2 * sagY - .5 * (T0.y + T2.y) };
      const cable = curve(T0, Q1, T2);
      for (const side of [-1, 1]) for (const pc of run(cable, 'cable', 1.7, INK, 14)) push(Object.assign(pc, { x: pc.x + side * halfW * .35, u: -.08 + .05 * (pc.s / cable.len), front: side > 0 }));
      // hangers every 16px from cable to deck edge
      for (let s = 16; s < len - 8; s += 16) { const d = at(s), t = s / len; const cs = cable.at(t * cable.len); for (const side of [-1, 1]) { const dx = d.x + d.nx * side * halfW, dy = d.y + d.ny * side * halfW, cx = cs.x + side * halfW * .35; push(member({ x: cx, y: cs.y }, { x: dx, y: dy }, 'hanger', 1.1, INK, { s, u: -.02 + .02 * t, front: side > 0 })); } }
      // side ropes at deck level, deck planks slung between them
      for (const side of [-1, 1]) for (const pc of run(C, 'rope', 1.6, INK, 12)) push(Object.assign(pc, { x: pc.x + pc.s * 0 + (at(pc.s).nx * side * halfW), y: pc.y + at(pc.s).ny * side * halfW, u: -.01 + .01 * (pc.s / len), front: side > 0 }));
      for (let s = 0; s < len; s += 5) { const p = at(s); push({ s, kind: 'deck', x: p.x, y: p.y, w: 5.6, h: DECK_W * PERP, rot: p.ang, color: DECK, a: .9, order: .5, still: true }); if (r() > .1) push({ s, kind: 'plank', x: p.x, y: p.y, w: 2, h: DECK_W * PERP, rot: p.ang, color: PLANK, order: .6 }); }
    }
    else if (type === 'truss') {
      const H = Math.max(40, Math.min(52, span / 7));                                   // truss depth
      // abutments on the ledges
      push({ kind: 'abut', x: P0.x - dir * 10, y: P0.y + 5, w: 24, h: 8, rot: 0, color: DARK, u: -.1 });
      push({ kind: 'abut', x: P2.x + dir * 10, y: P2.y + 5, w: 24, h: 8, rot: 0, color: DARK, u: -.1 });
      const low = P0.y > P2.y ? P0 : P2, lowSide = low === P0 ? -dir : dir;
      push({ kind: 'abut', x: low.x + lowSide * 22, y: low.y - 3, w: 10, h: 12, rot: 0, color: DARK, u: -.1 });
      const top = s => { const p = at(s); return { x: p.x - p.nx * H, y: p.y - p.ny * H }; };
      // chords: bottom (carries the deck) and top, each as a run of pieces; built out from the near end
      for (const pc of run(C, 'chord', 3.4, TIMB, 20)) push(Object.assign(pc, { u: -.07 + .04 * (pc.s / len) }));
      for (let s = 0; s < len; s += 20) { const a = top(s), b = top(Math.min(len, s + 20)); push(Object.assign(member(a, b, 'chord', 2.8, TIMB), { s, u: -.06 + .04 * (s / len) })); }
      // verticals every 40px (end posts included), Howe diagonals leaning toward mid-span
      const bays = Math.max(4, Math.round(len / 40)), bay = len / bays;
      for (let i = 0; i <= bays; i++) { const s = i * bay, b = at(s), t = top(s); push(Object.assign(member({ x: b.x, y: b.y }, t, 'vert', 2.8, TIMB), { s, u: -.05 + .04 * (s / len) })); }
      for (let i = 0; i < bays; i++) { const s0 = i * bay, s1 = (i + 1) * bay, towardMid = (s0 + s1) / 2 < len / 2; const a = towardMid ? at(s0) : at(s1), b = towardMid ? top(s1) : top(s0); push(Object.assign(member({ x: a.x, y: a.y }, b, 'brace', 1.8, TIMB), { s: s0, u: -.045 + .04 * (s0 / len) })); }
      for (let s = 0; s < len; s += 5) { const p = at(s); push({ s, kind: 'deck', x: p.x, y: p.y, w: 5.6, h: DECK_W * PERP, rot: p.ang, color: DECK, a: .9, order: .5, still: true }); if (r() > .1) push({ s, kind: 'plank', x: p.x, y: p.y, w: 2, h: DECK_W * PERP, rot: p.ang, color: PLANK, order: .6 }); }
      for (let s = 6; s < len; s += 12) { const p = at(s); push({ s, kind: 'cleat', x: p.x - p.nx * 1.5, y: p.y - p.ny * 1.5, w: 2.2, h: DECK_W * PERP * .9, rot: p.ang, color: DARK, order: .7 }); }
      // a hand rail at 22px inside the truss
      for (let s = 10; s < len; s += 36) { const a = at(s), b = at(Math.min(len, s + 36)); push(Object.assign(member({ x: a.x + a.nx * halfW, y: a.y + a.ny * halfW - 20 }, { x: b.x + b.nx * halfW, y: b.y + b.ny * halfW - 20 }, 'rail', 1.4, INK), { s: s + 18, u: s / len + .03, a: .75, front: true })); if (s % 72 === 10) push({ s, kind: 'post', x: a.x + a.nx * halfW, y: a.y + a.ny * halfW - 10, w: 2.4, h: 22, rot: 0, color: INK, u: s / len + .025, front: true }); }
    }
    else if (type === 'cantilever') {
      // Bhutanese bazam: from each cliff, 4 beams stacked in contact, each projecting further than the one below,
      // all horizontal from the cliff line; tails lie on the lower ledge under a stone cairn, or socket into the upper
      // cliff face; a knee strut closes a triangle with the cliff; three stringers drop in between the two tips.
      // The deck follows the climb, so the lower stack sits under the low end and the upper stack under the high end.
      const T = 6, PITCH = 7, PROJ = [36, 66, 96, 126], NT = PROJ.length;
      const stack = (P, outDir, tailLen, under) => {
        // tier j's top surface: y = P.y + under + PITCH*(NT-1-j); beam from cliff line - tail to cliff line + proj
        const tips = [];
        PROJ.forEach((proj, j) => { const y = P.y + under + PITCH * (NT - 1 - j) + T / 2, x0 = P.x - outDir * tailLen, x1 = P.x + outDir * proj; push(member({ x: x0, y }, { x: x1, y }, 'chord', T, TIMB, { u: -.1 + .012 * j })); tips.push({ x: x1, y: y - T / 2 }); });
        // sleepers between tiers at the cliff line
        for (let j = 0; j < NT - 1; j++) push({ kind: 'abut', x: P.x + outDir * 4, y: P.y + under + PITCH * (NT - 1 - j) - 1, w: 8, h: 6, rot: 0, color: DARK, u: -.1 + .012 * j + .006 });
        return tips;
      };
      // the deck is 6px above the top tier at the cliff line; place the stacks accordingly
      const lowP = P0, highP = P2, under = 6;
      // each stack's top tier sits just under the deck where the deck passes over its outermost tip
      const topL = at(PROJ[NT - 1]).y + under - lowP.y, topU = at(len - PROJ[NT - 1]).y + under - highP.y;
      const tipsL = stack(lowP, dir, 170, topL), tipsU = stack(highP, -dir, 16, topU);
      const baseL = lowP.y + topL + PITCH * (NT - 1) + T, baseU = highP.y + topU + PITCH * (NT - 1) + T;
      // lower tails: stone cairn on the beams
      for (let q = 0; q < 12; q++) { const cx = lowP.x - dir * (26 + (q % 6) * 22 + (q >= 6 ? 11 : 0)), cy = lowP.y + topL - 3 + (q >= 6 ? -9 : 0); push({ kind: 'stone', x: cx + (r() - .5) * 4, y: cy, w: 12 + r() * 5, h: 9 + r() * 3, rot: (r() - .5) * .5, color: '#3a3733', u: -.05 + .004 * q }); }
      // upper tails: socket line on the cliff face
      push({ kind: 'abut', x: highP.x + dir * 8, y: highP.y + topU + PITCH * (NT - 1) / 2 + 2, w: 4, h: PITCH * NT + 2, rot: 0, color: INK, u: -.1 });
      // knee struts: from the cliff face 50px below each stack base up to the underside of tier 3
      push(member({ x: lowP.x - dir * 6, y: baseL + 50 }, { x: lowP.x + dir * PROJ[2] * .85, y: tipsL[2].y + T }, 'brace', 5, TIMB, { u: -.04 }));
      push(member({ x: highP.x + dir * 6, y: baseU + 50 }, { x: highP.x - dir * PROJ[2] * .85, y: tipsU[2].y + T }, 'brace', 5, TIMB, { u: -.04 }));
      // the deck: inclined, so between the tips it is carried by three stringers; over each stack it rests on the top tier
      // deck line = the path curve. Stringers from tipL to tipU under the deck.
      const sL = PROJ[NT - 1] / len, sU = 1 - PROJ[NT - 1] / len;
      for (let i = 0; i < 3; i++) { const o = (i - 1) * 7; const pa = at(sL * len), pb = at(sU * len); push(member({ x: pa.x, y: pa.y + 5 + o * .3 }, { x: pb.x, y: pb.y + 5 + o * .3 }, 'chord', 4, TIMB, { u: -.02 + .01 * i })); }
      // a short post from each stack's top tier tip up to the deck underside (the deck climbs above the horizontal tiers)
      for (const [tips, s] of [[tipsL, sL], [tipsU, sU]]) { const p = at(s * len); if (p.y + 4 < tips[NT - 1].y - 2) push(member({ x: tips[NT - 1].x, y: tips[NT - 1].y }, { x: p.x, y: p.y + 4 }, 'vert', 4, TIMB, { u: -.03 })); }
      for (let s = 0; s < len; s += 5) { const p = at(s); push({ s, kind: 'deck', x: p.x, y: p.y, w: 5.6, h: DECK_W * PERP, rot: p.ang, color: DECK, a: .9, order: .5, still: true }); if (r() > .1) push({ s, kind: 'plank', x: p.x, y: p.y, w: 2, h: DECK_W * PERP, rot: p.ang, color: PLANK, order: .6 }); }
      for (let s = 6; s < len; s += 12) { const p = at(s); push({ s, kind: 'cleat', x: p.x - p.nx * 1.5, y: p.y - p.ny * 1.5, w: 2.2, h: DECK_W * PERP * .9, rot: p.ang, color: DARK, order: .7 }); }
      for (let s = 10; s < len; s += 36) { const p = at(s), q = at(Math.min(len, s + 36)); for (const side of [-1, 1]) { const px = p.x + p.nx * side * halfW, py = p.y + p.ny * side * halfW, qx = q.x + q.nx * side * halfW, qy = q.y + q.ny * side * halfW; push({ s, kind: 'post', x: px, y: py - 11, w: 2.5, h: 24, rot: 0, color: INK, u: s / len + .012, front: side > 0 }); push(Object.assign(member({ x: px, y: py - 22 }, { x: qx, y: qy - 22 }, 'rail', 1.5, INK), { u: s / len + .02, a: .75, front: side > 0 })); } }
    }
    else { // pier: trestles on rock pinnacles
      const n = span > 300 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const s = len * (n === 1 ? .5 : .33 + .34 * i), p = at(s), H = 54 + r() * 24;
        pinnacles.push({ x: p.x, yTop: p.y + H + 6, w: 46, seed: seed * 3 + i });
        push({ kind: 'cap', x: p.x, y: p.y + 8, w: 28, h: 3.5, rot: 0, color: DARK, s, u: s / len - .05 });
        for (const side of [-1, 1]) push({ kind: 'leg', x: p.x + side * 9, y: p.y + 9 + H / 2, w: 3, h: H - 2, rot: 0, color: DARK, s, u: s / len - .06, fromBelow: true });
        push({ kind: 'brace', x: p.x, y: p.y + H * .5, w: 1.5, h: Math.min(30, H * .8), rot: .62, color: DARK, s, u: s / len - .055 });
        push({ kind: 'brace', x: p.x, y: p.y + H * .5, w: 1.5, h: Math.min(30, H * .8), rot: -.62, color: DARK, s, u: s / len - .055 });
        push({ kind: 'foot', x: p.x, y: p.y + H + 8, w: 28, h: 3.5, rot: 0, color: DARK, s, u: s / len - .07 });
      }
      // short end trestles on the ledges
      push({ kind: 'abut', x: P0.x - dir * 9, y: P0.y + 5, w: 22, h: 8, rot: 0, color: DARK, u: -.1 });    // sill on the lower lip
      push({ kind: 'abut', x: P2.x + dir * 9, y: P2.y + 5, w: 22, h: 8, rot: 0, color: DARK, u: -.1 });    // sill on the upper lip
      // stringers between supports, then deck and rails
      for (const pc of run(C, 'chord', 3, TIMB, 20)) push(Object.assign(pc, { y: pc.y + 3, u: pc.s / len - .03 }));
      for (let s = 0; s < len; s += 5) { const p = at(s); push({ s, kind: 'deck', x: p.x, y: p.y, w: 5.6, h: DECK_W * PERP, rot: p.ang, color: DECK, a: .9, order: .5, still: true }); if (r() > .1) push({ s, kind: 'plank', x: p.x, y: p.y, w: 2, h: DECK_W * PERP, rot: p.ang, color: PLANK, order: .6 }); }
      for (let s = 6; s < len; s += 12) { const p = at(s); push({ s, kind: 'cleat', x: p.x - p.nx * 1.5, y: p.y - p.ny * 1.5, w: 2.2, h: DECK_W * PERP * .9, rot: p.ang, color: DARK, order: .7 }); }
      for (let s = 10; s < len; s += 36) { const p = at(s), q = at(Math.min(len, s + 36)); for (const side of [-1, 1]) { const px = p.x + p.nx * side * halfW, py = p.y + p.ny * side * halfW, qx = q.x + q.nx * side * halfW, qy = q.y + q.ny * side * halfW; push({ s, kind: 'post', x: px, y: py - 11, w: 2.5, h: 24, rot: 0, color: INK, u: s / len + .012, front: side > 0 }); for (const lvl of [22, 12]) push(Object.assign(member({ x: px, y: py - lvl }, { x: qx, y: qy - lvl }, 'rail', 1.5, INK), { u: s / len + .02, a: .75, front: side > 0 })); } }
    }
    if (o.landing) { const L = o.landing, n = Math.max(2, Math.round(Math.hypot(L.x - P2.x, L.y - P2.y) / 5)), ang = Math.atan2(L.y - P2.y, L.x - P2.x);
      for (let i = 1; i <= n; i++) { const t = i / n, x = lerp(P2.x, L.x, t), y = lerp(P2.y, L.y, t); push({ kind: 'deck', x, y, w: 5.6, h: DECK_W * PERP, rot: ang + Math.PI / 2, color: DECK, a: .9, order: .5, still: true, u: 1 + .08 * t }); if (r() > .1) push({ kind: 'plank', x, y, w: 2, h: DECK_W * PERP, rot: ang + Math.PI / 2, color: PLANK, u: 1 + .08 * t + .005 }); } }
    slots.sort((a, b) => a.u - b.u);
    return { k: o.k, type, P0, P1, P2, len, at, slots, pinnacles };
  }
  return { make, sprite, drawPiece };
})();
