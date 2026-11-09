// Shapes -> colliders. Pure functions over plain data, no DOM, no scene knowledge, so any project that can describe
// its solid things as outlines and its walkable surfaces as lines gets physics from them.
//
//   PhysShapes.solid(points, opts)     a closed outline of something solid (a rock mass, a wall)
//   PhysShapes.platform(points, opts)  an open line you can stand on from above and jump or drop through (a deck)
//   PhysShapes.toJSON(colliders)       the neutral form: { version, units, up, colliders: [{ kind, closed, points,
//                                      material, tag }] } (edges are derived again on load)
//   PhysShapes.fromJSON(json)          back to colliders with classified edges
//   PhysShapes.clip(points, box)       cut a closed outline to a box { x0, y0, x1, y1 } (any side may be omitted);
//                                      use it to keep only the part of a shape that should collide (e.g. the front
//                                      band of a mass whose lower part is painted behind something nearer)
//
// Coordinates are y-down (as a canvas draws). Each collider carries its edges, each edge its outward normal and a
// class from the normal: 'ground' (walkable: within maxSlope of up), 'ceiling' (facing down), or 'wall'.
// opts: { tolerance (simplify, default 1.5), maxSlope (degrees, default 50), material, tag }
(function (root) {
  const DEF = { tolerance: 1.5, maxSlope: 50 };

  // Ramer-Douglas-Peucker on an open polyline
  function simplifyOpen(pts, tol) {
    if (pts.length < 3 || tol <= 0) return pts.slice();
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop(); let best = -1, bi = -1;
      const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
      for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > best) { best = d; bi = i; } }
      if (best > tol) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }
  function simplifyClosed(pts, tol) {
    if (pts.length < 4) return pts.slice();
    // split at the point farthest from the first so the ring is simplified as two open halves
    let far = 0, fd = -1; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; far = i; } }
    const A = simplifyOpen(pts.slice(0, far + 1), tol), B = simplifyOpen(pts.slice(far).concat([pts[0]]), tol);
    return A.concat(B.slice(1, -1));
  }
  const area = pts => { let s = 0; for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; s += x0 * y1 - x1 * y0; } return s / 2; };
  const aabbOf = pts => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return { x0, y0, x1, y1 }; };

  function classify(nx, ny, maxSlope) {   // y-down: "up" is (0, -1)
    const c = Math.cos(maxSlope * Math.PI / 180), upness = -ny;
    return upness >= c ? 'ground' : upness <= -c ? 'ceiling' : 'wall';
  }
  function edgesOf(pts, closed, outwardSign, maxSlope, oneWay) {
    const out = [], n = pts.length, m = closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      if (L < 1e-6) continue;
      // in y-down coordinates a positive-area (clockwise on screen) ring has its outside on the left of each edge
      let nx = dy / L * outwardSign, ny = -dx / L * outwardSign;
      if (oneWay && ny > 0) { nx = -nx; ny = -ny; }          // a platform's surface faces up
      out.push({ a, b, nx, ny, len: L, cls: oneWay ? (classify(nx, ny, maxSlope) === 'ground' ? 'ground' : 'wall') : classify(nx, ny, maxSlope), oneWay: !!oneWay });
    }
    return out;
  }

  function solid(points, opts) {
    const o = Object.assign({}, DEF, opts), pts = simplifyClosed(points.map(p => [p[0], p[1]]), o.tolerance);
    const sign = area(pts) > 0 ? 1 : -1;
    return { kind: 'solid', closed: true, points: pts, material: o.material || 'rock', tag: o.tag || null, aabb: aabbOf(pts), edges: edgesOf(pts, true, sign, o.maxSlope, false) };
  }
  function platform(points, opts) {
    const o = Object.assign({}, DEF, opts), pts = simplifyOpen(points.map(p => [p[0], p[1]]), o.tolerance);
    return { kind: 'platform', closed: false, points: pts, material: o.material || 'wood', tag: o.tag || null, aabb: aabbOf(pts), edges: edgesOf(pts, false, 1, o.maxSlope, true) };
  }
  // Sutherland-Hodgman against each given side of an axis-aligned box
  function clip(points, box) {
    let pts = points.map(p => [p[0], p[1]]);
    const sides = [['x0', 0, 1], ['x1', 0, -1], ['y0', 1, 1], ['y1', 1, -1]];
    for (const [k, axis, sgn] of sides) {
      if (box[k] == null || pts.length < 3) continue;
      const lim = box[k], inside = p => (p[axis] - lim) * sgn >= 0, out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], ia = inside(a), ib = inside(b);
        if (ia) out.push(a);
        if (ia !== ib) { const t = (lim - a[axis]) / (b[axis] - a[axis]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      }
      pts = out;
    }
    return pts;
  }
  function toJSON(colliders, meta) {
    return Object.assign({ version: 1, units: 'scene', up: [0, -1] }, meta || {}, {
      colliders: colliders.map(c => ({ kind: c.kind, closed: c.closed, points: c.points.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]), material: c.material, tag: c.tag })) });
  }
  function fromJSON(json, opts) {
    return json.colliders.map(c => (c.kind === 'platform' ? platform : solid)(c.points, Object.assign({ tolerance: 0, material: c.material, tag: c.tag }, opts)));
  }
  root.PhysShapes = { solid, platform, clip, toJSON, fromJSON, simplifyOpen, simplifyClosed, classify };
})(typeof window !== 'undefined' ? window : globalThis);
