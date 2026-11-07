// Brush-ink wanderer. Same skeleton as walker2 (hip/knee gait, pelvis from the stance leg) with a
// Vagabond-leaning silhouette: loose hair, ragged hem, bundle and straw hat slung on the back, staff.
// drawWalker3(ctx, {x, y, h, phase, alpha, idle, yaw, seed})
window.drawWalker3 = function (ctx, o) {
  const { x, y, h } = o;
  const ph = o.phase || 0, A = o.alpha == null ? 1 : o.alpha, idle = o.idle || 0, yaw = o.yaw == null ? .6 : o.yaw;
  const D = Math.PI / 180, cy = Math.cos(yaw), sy = Math.sin(yaw);
  const P = (X, Y, Z) => ({ x: x + (X * cy + Z * sy), y: y - Y });
  const mix = (a, b, t) => a + (b - a) * t;
  const hipA = f => 3 + 22 * Math.cos(f);
  const kneeA = f => { f = ((f % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return f < Math.PI ? 10 + 10 * Math.sin(f) : 10 + 55 * Math.sin(f - Math.PI); };
  const L1 = h * .25, L2 = h * .22, hipX = h * .065;
  function leg(f, side) {
    const a = mix(hipA(f), 3, idle) * D, k = mix(kneeA(f), 8, idle) * D;
    const knee = { X: side * hipX, Y: -L1 * Math.cos(a), Z: L1 * Math.sin(a) };
    const ank = { X: side * hipX, Y: knee.Y - L2 * Math.cos(a - k), Z: knee.Z + L2 * Math.sin(a - k) };
    const toe = { X: side * hipX, Y: ank.Y - h * .02, Z: ank.Z + h * .07 };
    return { knee, ank, toe };
  }
  const Lg = leg(ph, -1), Rg = leg(ph + Math.PI, 1);
  const lowest = Math.min(Lg.toe.Y, Rg.toe.Y, Lg.ank.Y - h * .02, Rg.ank.Y - h * .02);
  const pelvisY = -lowest;
  const lift = pt => ({ X: pt.X, Y: pt.Y + pelvisY, Z: pt.Z });
  const pj = pt => { const q = lift(pt); return P(q.X, q.Y, q.Z); };
  const lean = mix(.035, .012, idle) * h;
  const shY = pelvisY + h * .25, shX = h * .16;
  const twist = mix(Math.sin(ph) * .02 * h, 0, idle);
  const UA = h * .16, FA = h * .15;
  function arm(f, side) {
    const sa = mix(-.7 * 22 * Math.cos(f), 0, idle) * D, el = mix(25 + 20 * Math.max(0, Math.cos(f)), 20, idle) * D;
    const sh = { X: side * shX + (side > 0 ? twist : -twist), Y: shY, Z: lean };
    const elb = { X: sh.X + side * h * .01, Y: sh.Y - UA * Math.cos(sa), Z: sh.Z + UA * Math.sin(sa) };
    const hand = { X: elb.X, Y: elb.Y - FA * Math.cos(sa - el), Z: elb.Z + FA * Math.sin(sa - el) };
    return { sh, elb, hand };
  }
  const La = arm(ph, -1), Ra = arm(ph + Math.PI, 1);

  // brush: every fill is drawn twice with a tiny offset for a bled edge
  ctx.save(); ctx.globalAlpha = A; ctx.fillStyle = ctx.strokeStyle = o.color || '#161513'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const stroke = (pts, w) => { ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); };

  ctx.save(); ctx.globalAlpha = A * .14; ctx.beginPath(); ctx.ellipse(x + lean * .5, y + h * .008, h * .16, h * .03, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();

  // bundle on the back (behind the torso)
  const back = P(0, shY - h * .06, lean - h * .02);
  ctx.save(); ctx.globalAlpha = A * .92; ctx.beginPath(); ctx.ellipse(back.x + h * .03, back.y + h * .1, h * .09, h * .07, .3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  // legs
  for (const [g, side] of [[Lg, -1], [Rg, 1]]) {
    const hip = P(side * hipX, pelvisY, 0);
    stroke([hip, pj(g.knee), pj(g.ank)], h * .065);
    stroke([pj(g.ank), pj(g.toe)], h * .05);
  }
  // robe with the hem breaking into tapering tails
  const sL = P(-shX, shY, lean), sR = P(shX, shY, lean), kL = pj(Lg.knee), kR = pj(Rg.knee);
  const hemY = Math.min(kL.y, kR.y) + h * .02;
  const hemL = Math.min(kL.x, kR.x) - h * .11, hemR = Math.max(kL.x, kR.x) + h * .11;
  const waistY = y - (pelvisY + h * .08);
  const flap = mix(Math.sin(ph) * h * .03, 0, idle);
  ctx.beginPath();
  ctx.moveTo(sL.x, sL.y + h * .02);
  ctx.quadraticCurveTo(sL.x - h * .02, sL.y - h * .03, (sL.x + sR.x) / 2, sL.y - h * .045);
  ctx.quadraticCurveTo(sR.x + h * .02, sR.y - h * .03, sR.x, sR.y + h * .02);
  ctx.quadraticCurveTo(sR.x - h * .01, waistY, hemR, hemY - h * .03);
  ctx.lineTo(hemR - h * .02 + flap, hemY + h * .07);           // tail 1
  ctx.lineTo(hemR - h * .08, hemY - h * .01);
  ctx.lineTo((hemL + hemR) / 2 + h * .02 - flap, hemY + h * .05); // tail 2
  ctx.lineTo((hemL + hemR) / 2 - h * .05, hemY - h * .005);
  ctx.lineTo(hemL + h * .03 + flap * .5, hemY + h * .08);        // tail 3
  ctx.lineTo(hemL, hemY - h * .02);
  ctx.quadraticCurveTo(sL.x + h * .01, waistY, sL.x, sL.y + h * .02);
  ctx.closePath(); ctx.fill();
  // sleeves
  for (const a of [La, Ra]) stroke([P(a.sh.X, a.sh.Y, a.sh.Z), P(a.elb.X, a.elb.Y, a.elb.Z), P(a.hand.X, a.hand.Y, a.hand.Z)], h * .075);
  // staff (left hand)
  const lh = P(La.hand.X, La.hand.Y, La.hand.Z);
  const lf = ((ph % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const planted = idle > .5 ? 1 : (lf < Math.PI ? 1 : 0);
  const tip = P(-shX - h * .08, planted ? 0 : h * .04, mix(h * .08 * Math.cos(ph), h * .04, idle));
  const top = { x: lh.x + (lh.x - tip.x) * .75, y: lh.y + (lh.y - tip.y) * .75 };
  stroke([tip, top], Math.max(.8, h * .014));
  // neck, head, hair
  const nb = P(0, shY - h * .02, lean), nt = P(0, shY + h * .05, lean + h * .004);
  stroke([nb, nt], h * .05);
  const hc = P(0, shY + h * .11, lean + h * .005);
  ctx.beginPath(); ctx.arc(hc.x, hc.y, h * .07, 0, Math.PI * 2); ctx.fill();
  // hair under the brim: a few strands trailing back
  const r = h * .07, sway = mix(Math.sin(ph) * h * .008, 0, idle);
  const tie = { x: hc.x - r * .4, y: hc.y - r * .3 };
  stroke([tie, { x: tie.x - r * .6 + sway, y: tie.y + r * .9 }, { x: tie.x - r * .4 + sway * 1.6, y: tie.y + r * 2.0 }], h * .03);
  stroke([tie, { x: tie.x - r * 1.0 + sway, y: tie.y + r * .7 }, { x: tie.x - r * 1.1 + sway * 1.4, y: tie.y + r * 1.6 }], h * .022);
  // conical straw hat on the head, slight nod with the stride
  const nod = mix(Math.sin(2 * ph) * h * .004, 0, idle);
  const brimW = h * .27, ax = hc.x + lean * .4, brimY = hc.y - r * .15 + nod, apexY = brimY - h * .17;
  // brim tips droop; the outline gets a hair of jitter so it is not the one crisp triangle in the scene
  const jt = h * .006, jx = () => (Math.random() - .5) * jt;
  ctx.beginPath(); ctx.moveTo(ax + jx(), apexY + h * .01);
  ctx.quadraticCurveTo(ax + brimW * .45, brimY - h * .075, ax + brimW * .8 + jx(), brimY - h * .005);
  ctx.quadraticCurveTo(ax + brimW * .95, brimY + h * .01, ax + brimW, brimY + h * .03);
  ctx.quadraticCurveTo(ax, brimY + h * .04 + jx(), ax - brimW, brimY + h * .03);
  ctx.quadraticCurveTo(ax - brimW * .95, brimY + h * .01, ax - brimW * .8 + jx(), brimY - h * .005);
  ctx.quadraticCurveTo(ax - brimW * .45, brimY - h * .075, ax + jx(), apexY + h * .01); ctx.closePath(); ctx.fill();
  ctx.restore();
};
