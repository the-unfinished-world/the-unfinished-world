// Skeleton-driven silhouette walker. Joints in body space (X right, Y up, Z forward), projected with a yaw so the
// gait reads from behind. Pelvis height comes from the stance leg, so the bob and foot lift are geometric, not faked.
// drawWalker2(ctx, {x, y, h, phase, alpha, idle, yaw})
//   x,y   ground point under the pelvis, design px; h total height (hat apex to ground)
//   phase gait cycle, radians; left leg heel-strike at 0, right at PI
//   yaw   radians; 0 = walking straight away, + = away and to the right
window.drawWalker2 = function (ctx, o) {
  const { x, y, h } = o;
  const ph = o.phase || 0, A = o.alpha == null ? 1 : o.alpha, idle = o.idle || 0, yaw = o.yaw == null ? .6 : o.yaw;
  const D = Math.PI / 180;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const P = (X, Y, Z) => ({ x: x + (X * cy + Z * sy), y: y - Y });

  // --- gait curves (degrees) ---------------------------------------------
  const hipA = f => 3 + 22 * Math.cos(f);                                 // + = forward
  const kneeA = f => { f = ((f % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return f < Math.PI ? 10 + 10 * Math.sin(f) : 10 + 55 * Math.sin(f - Math.PI); };
  const mix = (a, b, t) => a + (b - a) * t;
  const L1 = h * .25, L2 = h * .22, hipX = h * .065;

  function leg(f, side) {                                                 // side: -1 left, +1 right
    const a = mix(hipA(f), 3, idle) * D, k = mix(kneeA(f), 8, idle) * D;
    const knee = { X: side * hipX, Y: -L1 * Math.cos(a), Z: L1 * Math.sin(a) };
    const ank = { X: side * hipX, Y: knee.Y - L2 * Math.cos(a - k), Z: knee.Z + L2 * Math.sin(a - k) };
    const toe = { X: side * hipX, Y: ank.Y - h * .02, Z: ank.Z + h * .07 };
    return { knee, ank, toe };
  }
  const Lg = leg(ph, -1), Rg = leg(ph + Math.PI, 1);
  // pelvis height: the lower foot is on the ground
  const lowest = Math.min(Lg.toe.Y, Rg.toe.Y, Lg.ank.Y - h * .02, Rg.ank.Y - h * .02);
  const pelvisY = -lowest;
  const lift = pt => ({ X: pt.X, Y: pt.Y + pelvisY, Z: pt.Z });

  // --- torso, arms, head --------------------------------------------------
  const lean = mix(.03, .01, idle) * h;
  const shY = pelvisY + h * .25, shX = h * .16;
  const torsoTwist = mix(Math.sin(ph) * .02 * h, 0, idle);
  const UA = h * .16, FA = h * .15;
  function arm(f, side) {
    const sa = mix(-.7 * 22 * Math.cos(f), 0, idle) * D;                  // opposite to same-side leg
    const el = mix(25 + 20 * Math.max(0, Math.cos(f)), 20, idle) * D;
    const sh = { X: side * shX + (side > 0 ? torsoTwist : -torsoTwist), Y: shY, Z: lean };
    const elb = { X: sh.X + side * h * .01, Y: sh.Y - UA * Math.cos(sa), Z: sh.Z + UA * Math.sin(sa) };
    const hand = { X: elb.X, Y: elb.Y - FA * Math.cos(sa - el), Z: elb.Z + FA * Math.sin(sa - el) };
    return { sh, elb, hand };
  }
  const La = arm(ph, -1), Ra = arm(ph + Math.PI, 1);
  const headC = { X: 0, Y: shY + h * .11, Z: lean + h * .005 };

  ctx.save();
  ctx.globalAlpha = A;
  ctx.fillStyle = ctx.strokeStyle = o.color || '#161513';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // ground shadow under the stance foot
  ctx.save(); ctx.globalAlpha = A * .15;
  ctx.beginPath(); ctx.ellipse(x + lean * .5, y + h * .008, h * .16, h * .03, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();

  const stroke = (pts, w) => { ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); };
  const pj = pt => { const q = lift(pt); return P(q.X, q.Y, q.Z); };

  // legs (hip -> knee -> ankle -> toe)
  for (const [g, side] of [[Lg, -1], [Rg, 1]]) {
    const hip = P(side * hipX, pelvisY, 0);
    stroke([hip, pj(g.knee), pj(g.ank)], h * .065);
    stroke([pj(g.ank), pj(g.toe)], h * .05);
  }

  // robe: shoulders down to just above the knees; hem follows the thighs
  const sL = P(-shX, shY, lean), sR = P(shX, shY, lean);
  const kL = pj(Lg.knee), kR = pj(Rg.knee);
  const hemY = Math.min(kL.y, kR.y) - h * .01;
  const hemL = { x: Math.min(kL.x, kR.x) - h * .09, y: hemY }, hemR = { x: Math.max(kL.x, kR.x) + h * .09, y: hemY };
  const waistY = y - (pelvisY + h * .08);
  ctx.beginPath();
  ctx.moveTo(sL.x, sL.y + h * .02);
  ctx.quadraticCurveTo(sL.x - h * .02, sL.y - h * .03, (sL.x + sR.x) / 2, sL.y - h * .045);
  ctx.quadraticCurveTo(sR.x + h * .02, sR.y - h * .03, sR.x, sR.y + h * .02);
  ctx.quadraticCurveTo(sR.x - h * .02, waistY, hemR.x, hemR.y);
  ctx.quadraticCurveTo((hemL.x + hemR.x) / 2, hemY + h * .02, hemL.x, hemL.y);
  ctx.quadraticCurveTo(sL.x + h * .02, waistY, sL.x, sL.y + h * .02);
  ctx.closePath(); ctx.fill();

  // sleeves / arms
  for (const a of [La, Ra]) stroke([P(a.sh.X, a.sh.Y, a.sh.Z), P(a.elb.X, a.elb.Y, a.elb.Z), P(a.hand.X, a.hand.Y, a.hand.Z)], h * .07);

  // staff in the left hand, planted when the left leg is in stance
  const lh = P(La.hand.X, La.hand.Y, La.hand.Z);
  const lf = ((ph % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const planted = idle > .5 ? 1 : (lf < Math.PI ? 1 : 0);
  const tip = P(-shX - h * .08, planted ? 0 : h * .04, mix(h * .08 * Math.cos(ph), h * .04, idle));
  const top = { x: lh.x + (lh.x - tip.x) * .6, y: lh.y + (lh.y - tip.y) * .6 };
  stroke([tip, top], Math.max(.8, h * .014));

  // neck, head, hat
  const nb = P(0, shY - h * .02, lean), nt = P(0, shY + h * .05, lean + h * .004);
  stroke([nb, nt], h * .05);
  const hc = P(headC.X, headC.Y, headC.Z);
  ctx.beginPath(); ctx.arc(hc.x, hc.y, h * .07, 0, Math.PI * 2); ctx.fill();
  const nod = mix(Math.sin(2 * ph) * h * .004, 0, idle);
  const apex = P(0, h * 1.0 - h * .03 + pelvisY - (h * .47) , lean + h * .01), brimW = h * .30;
  const apexY = hc.y - h * .20 + nod, brimY = hc.y - h * .03 + nod, ax = hc.x + h * .012;
  ctx.beginPath();
  ctx.moveTo(ax, apexY);
  ctx.quadraticCurveTo(ax + brimW * .55, brimY - h * .06, ax + brimW, brimY);
  ctx.quadraticCurveTo(ax, brimY + h * .035, ax - brimW, brimY);
  ctx.quadraticCurveTo(ax - brimW * .55, brimY - h * .06, ax, apexY);
  ctx.closePath(); ctx.fill();
  ctx.restore();
};
