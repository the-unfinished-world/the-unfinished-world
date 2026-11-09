// A world of colliders (from shapes.js) with the queries a character needs. Plain data, no DOM.
//   const w = new PhysWorld({ cell: 64 })
//   w.add(collider, group)        group: any key used to add/remove a batch (e.g. a chunk of scenery)
//   w.removeGroup(group)
//   w.edgesIn(x0, y0, x1, y1)     edges whose bounds touch the box (each edge once)
//   w.raycast(ox, oy, dx, dy, maxT, { oneWay: true })  nearest hit { t, x, y, edge } along o + d*t, or null;
//                                 one-way edges only stop rays travelling against their normal (falling onto them)
(function (root) {
  class PhysWorld {
    constructor(o) { this.cell = (o && o.cell) || 64; this.grid = new Map(); this.groups = new Map(); this.stamp = 0; }
    key(i, j) { return i * 73856093 ^ j * 19349663; }
    add(col, group) {
      const list = this.groups.get(group) || []; this.groups.set(group, list); list.push(col);
      for (const e of col.edges) {
        e.col = col; e.x0 = Math.min(e.a[0], e.b[0]); e.x1 = Math.max(e.a[0], e.b[0]); e.y0 = Math.min(e.a[1], e.b[1]); e.y1 = Math.max(e.a[1], e.b[1]);
        const c = this.cell; e.cells = [];
        for (let i = Math.floor(e.x0 / c); i <= Math.floor(e.x1 / c); i++) for (let j = Math.floor(e.y0 / c); j <= Math.floor(e.y1 / c); j++) {
          const k = this.key(i, j); let b = this.grid.get(k); if (!b) this.grid.set(k, b = []); b.push(e); e.cells.push(k);
        }
      }
      return col;
    }
    removeGroup(group) {
      const list = this.groups.get(group); if (!list) return;
      for (const col of list) for (const e of col.edges) for (const k of e.cells) { const b = this.grid.get(k); if (b) { const i = b.indexOf(e); if (i >= 0) b.splice(i, 1); } }
      this.groups.delete(group);
    }
    has(group) { return this.groups.has(group); }
    colliders() { const out = []; for (const l of this.groups.values()) out.push(...l); return out; }
    edgesIn(x0, y0, x1, y1) {
      const c = this.cell, s = ++this.stamp, out = [];
      for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(y0 / c); j <= Math.floor(y1 / c); j++) {
        const b = this.grid.get(this.key(i, j)); if (!b) continue;
        for (const e of b) if (e._s !== s && e.x1 >= x0 && e.x0 <= x1 && e.y1 >= y0 && e.y0 <= y1) { e._s = s; out.push(e); }
      }
      return out;
    }
    raycast(ox, oy, dx, dy, maxT, opts) {
      const ex = ox + dx * maxT, ey = oy + dy * maxT; let best = null;
      for (const e of this.edgesIn(Math.min(ox, ex), Math.min(oy, ey), Math.max(ox, ex), Math.max(oy, ey))) {
        if (e.oneWay && (!opts || opts.oneWay !== false) && dx * e.nx + dy * e.ny >= 0) continue;
        const sx = e.b[0] - e.a[0], sy = e.b[1] - e.a[1], den = dx * sy - dy * sx; if (Math.abs(den) < 1e-9) continue;
        const qx = e.a[0] - ox, qy = e.a[1] - oy, t = (qx * sy - qy * sx) / den, u = (qx * dy - qy * dx) / den;
        if (t >= 0 && t <= maxT && u >= 0 && u <= 1 && (!best || t < best.t)) best = { t, x: ox + dx * t, y: oy + dy * t, edge: e };
      }
      return best;
    }
  }
  root.PhysWorld = PhysWorld;
})(typeof window !== 'undefined' ? window : globalThis);
