// Brush treatment for the walker: render the skeleton figure to an offscreen buffer, merge joints with a
// blur + contrast threshold (a morphological close, so limbs flow into the body), then give it torn feathered
// edges and dry-brush grain, and composite with multiply so it sits in the ink like the rocks and the bridge.
// drawWalkerBrush(ctx, opts) — same opts as drawWalker7.
(function () {
  const S = 2;                     // supersample
  let buf, mer, out, grain;
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function makeGrain() {
    grain = canvas(256, 256); const g = grain.getContext('2d'); const img = g.createImageData(256, 256);
    let seed = 7; const r = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < img.data.length; i += 4) { const v = r(); const a = v > .86 ? (v - .86) / .14 * 255 : 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * .9; }
    g.putImageData(img, 0, 0);
  }
  window.drawWalkerBrush = function (ctx, o) {
    const h = o.h, W = Math.ceil(h * 1.3), H = Math.ceil(h * 1.35);
    if (!buf || buf.width !== W * S || buf.height !== H * S) { buf = canvas(W * S, H * S); mer = canvas(W * S, H * S); out = canvas(W * S, H * S); }
    if (!grain) makeGrain();
    const ox = W * .5, oy = H * .9;                                  // figure ground point inside the buffer
    // 1. raw parts in black on white
    const b = buf.getContext('2d'); b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-over'; b.filter = 'none'; b.globalAlpha = 1;
    b.fillStyle = '#fff'; b.fillRect(0, 0, W * S, H * S);
    b.setTransform(S, 0, 0, S, 0, 0);
    // o.draw(ctx, o) draws the raw figure (e.g. a body on a rig pose); without it, the procedural walker
    (o.draw || (window.drawWalker8 && o.variant ? drawWalker8 : drawWalker7))(b, Object.assign({}, o, { x: ox, y: oy, color: '#000', alpha: 1 }));
    // 2. merge joints: blur then hard contrast = smooth closed silhouette
    const m = mer.getContext('2d'); m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'source-over'; m.globalAlpha = 1;
    m.fillStyle = '#fff'; m.fillRect(0, 0, W * S, H * S);
    m.filter = `blur(${Math.max(1.0, h * .0065 * S)}px) contrast(1600%)`; m.drawImage(buf, 0, 0); m.filter = 'none';
    // 3. brush edge: feathered copies with tiny offsets, then dry grain inside
    const c = out.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.filter = 'none';
    c.fillStyle = '#fff'; c.fillRect(0, 0, W * S, H * S);
    c.globalCompositeOperation = 'multiply';
    const t = (o.phase || 0) * .12;
    const e = Math.min(.7, h * .005); const offs = [[0, 0, 1], [Math.cos(t) * e, Math.sin(t * 1.3) * e * .8, .45]];
    for (const [dx, dy, a] of offs) { c.globalAlpha = a; c.drawImage(mer, dx * S, dy * S); }
    c.filter = 'none'; c.globalAlpha = 1;
    if (!o.draw && window.drawWalker8Lines && o.variant) { c.globalCompositeOperation = 'source-over'; c.save(); c.setTransform(S, 0, 0, S, 0, 0); drawWalker8Lines(c, Object.assign({}, o, { x: ox, y: oy, lineColor: '#fff' })); c.restore(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'multiply'; }
    // pooled ink low on the figure (feet and hem), lighter wash high (shoulders catch the light)
    c.globalCompositeOperation = 'screen';
    const g = c.createLinearGradient(0, (oy - h) * S, 0, oy * S); g.addColorStop(0, 'rgba(255,255,255,.07)'); g.addColorStop(.55, 'rgba(255,255,255,.03)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, W * S, H * S);
    c.globalCompositeOperation = 'lighten'; c.globalAlpha = .13;
    const gx = Math.floor((o.x * 3) % 128), gy = Math.floor((o.y * 2) % 128);
    for (let yy = -gy; yy < H * S; yy += 256) for (let xx = -gx; xx < W * S; xx += 256) c.drawImage(grain, xx, yy);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    // 4. composite into the scene with multiply (white vanishes, ink stays ink)
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.drawImage(out, o.x - ox, o.y - oy, W, H); ctx.restore();
  };
})();
