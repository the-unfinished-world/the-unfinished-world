// Procedural silhouette walker: conical hat, robe, staff. Seen from behind, slightly from the left.
// drawWalker(ctx, {x, y, h, phase, alpha, color, idle})
//   x,y   ground contact point (between the feet), design-space px
//   h     total height, hat apex to ground
//   phase walk cycle in radians; one full cycle = two steps (left, right)
window.drawWalker = function (ctx, o) {
  const { x, y, h } = o;
  const ph = o.phase || 0, c = o.color || '#161513', A = o.alpha == null ? 1 : o.alpha, idle = !!o.idle;
  const s = idle ? 0 : 1;
  const sin = Math.sin(ph), cos = Math.cos(ph);
  const bob = -s * h * .018 * (1 - Math.cos(2 * ph)) / 2;   // rises twice per cycle, at mid-stance
  ctx.save();
  ctx.globalAlpha = A;
  ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // ground shadow
  ctx.save(); ctx.globalAlpha = A * .16;
  ctx.beginPath(); ctx.ellipse(x, y + h * .01, h * .17, h * .035, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();

  // legs: back view. Swing shows as foot lift + lateral shift + slight shortening.
  const hem = y - h * .24 + bob;
  const stance = h * .055;
  const legW = h * .062;
  for (const side of [-1, 1]) {
    const sw = side * sin * s;                    // >0 this leg is swinging forward
    const lift = Math.max(0, sw) * h * .07;
    const lat = side * stance + sw * h * .012;
    const footY = y - lift;
    const kneeX = x + lat + side * h * .004, kneeY = (hem + footY) / 2 + Math.max(0, sw) * h * .02;
    ctx.lineWidth = legW;
    ctx.beginPath(); ctx.moveTo(x + lat * .7, hem - h * .02); ctx.lineTo(kneeX, kneeY); ctx.lineTo(x + lat, footY - h * .015); ctx.stroke();
    // foot
    ctx.beginPath(); ctx.ellipse(x + lat + side * h * .004, footY - h * .012, h * .038, h * .018, 0, 0, Math.PI * 2); ctx.fill();
  }

  // robe: shoulders to hem, cinched at the waist, hem sways opposite the swing
  const sway = s * sin * h * .018;
  const lean = s * h * .012;                      // slight forward lean (to the right/into the picture)
  const shY = y - h * .72 + bob, shW = h * .17;
  const waY = y - h * .50 + bob, waW = h * .125;
  const heW = h * .19;
  ctx.beginPath();
  ctx.moveTo(x + lean - shW, shY + h * .02);
  ctx.quadraticCurveTo(x + lean - shW * 1.05, shY - h * .03, x + lean, shY - h * .045);   // left shoulder up and over
  ctx.quadraticCurveTo(x + lean + shW * 1.05, shY - h * .03, x + lean + shW, shY + h * .02);
  ctx.quadraticCurveTo(x + lean + waW * 1.15, waY, x + sway + heW, hem);                      // right side down to hem
  ctx.quadraticCurveTo(x + sway, hem + h * .012, x + sway - heW, hem);                       // hem curve
  ctx.quadraticCurveTo(x + lean - waW * 1.15, waY, x + lean - shW, shY + h * .02);
  ctx.closePath(); ctx.fill();

  // sleeves / arms: hang and swing opposite to the legs
  const armSw = s * sin * h * .05;
  ctx.lineWidth = h * .06;
  ctx.beginPath(); ctx.moveTo(x + lean - shW * .85, shY + h * .03); ctx.lineTo(x + lean - shW * 1.05 - armSw * .3, waY + h * .04 + armSw * .2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + lean + shW * .85, shY + h * .03); ctx.lineTo(x + lean + shW * 1.0 + armSw * .3, waY + h * .05 - armSw * .2); ctx.stroke();

  // staff in the left hand: plants when the left foot is down
  const handX = x + lean - shW * 1.05 - armSw * .3, handY = waY + h * .04 + armSw * .2;
  const plant = Math.max(0, -sin) * s;               // 1 when planted
  const tipX = x - h * .26 + s * sin * h * .08, tipY = y - (1 - plant) * s * h * .04;
  const topX = handX + (handX - tipX) * .55, topY = handY + (handY - tipY) * .55;
  ctx.lineWidth = Math.max(.8, h * .014);
  ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(topX, topY); ctx.stroke();

  // neck and head
  ctx.lineWidth = h * .05;
  ctx.beginPath(); ctx.moveTo(x + lean, shY - h * .03); ctx.lineTo(x + lean + h * .005, shY - h * .10); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + lean + h * .006, shY - h * .14, h * .07, 0, Math.PI * 2); ctx.fill();

  // conical hat: shallow cone with a soft brim, slight nod with the stride
  const nod = s * Math.sin(2 * ph) * h * .004;
  const apexX = x + lean + h * .012, apexY = y - h * 1.0 + bob + nod, brimY = y - h * .84 + bob + nod, brimW = h * .30;
  ctx.beginPath();
  ctx.moveTo(apexX, apexY);
  ctx.quadraticCurveTo(apexX + brimW * .55, brimY - h * .06, apexX + brimW, brimY);
  ctx.quadraticCurveTo(apexX, brimY + h * .035, apexX - brimW, brimY);
  ctx.quadraticCurveTo(apexX - brimW * .55, brimY - h * .06, apexX, apexY);
  ctx.closePath(); ctx.fill();
  ctx.restore();
};
