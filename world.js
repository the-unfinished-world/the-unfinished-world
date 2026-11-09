// The shared gorge: bridge progress kept for everyone (Supabase, supabase/004_bridges.sql) and the other people walking
// it right now (Supabase Realtime, broadcast on one channel). Plain data in and out; the scene (index.html) draws.
//
//   TUWWorld.shared                Map k -> { step, frac, done }: saved progress of each bridge (grows, never shrinks)
//   TUWWorld.loaded                true once the saved progress has arrived (or failed to)
//   TUWWorld.save(k, p)            keep bridge k's progress p (throttled; only forward). flush(k) sends it now
//   TUWWorld.send(state)           tell the others where you are and what you are doing (throttled to ~10 per second)
//   TUWWorld.leave()               tell them you have stopped playing
//   TUWWorld.remotes               Map id -> { body, frames: [{ at, s }] }: the others, newest frames last
//   TUWWorld.onShared(fn)          fn(k, p) when a bridge's saved progress moves forward (from the database or a builder)
//
// A message (state): { x, y, vx, vy, g (grounded), f (facing), sl (slope), ch (character id), b (build, if working),
// d (things set down), p (progress of the bridge being built: { k, step, frac, done }) }.
(function () {
  const URL_ = 'https://pzzivuxhfpaiucbfqypw.supabase.co';
  const KEY = 'sb_publishable_wDp2THeQsaJSkjkUwMRbJw_A-OmMO8e';   // the publishable key (public by design), as in members.js
  const me = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2);
  const shared = new Map(), remotes = new Map(), listeners = [];
  const W = { me, shared, remotes, loaded: false, save, flush, send, leave, onShared: fn => listeners.push(fn) };
  window.TUWWorld = W;
  const ahead = (p, q) => !q || (!q.done && (p.done || p.step > q.step || (p.step === q.step && p.frac > q.frac)));
  function learn(k, p) {   // progress seen (database, a builder's message, or our own work): keep the furthest
    if (!p || !ahead(p, shared.get(k))) return false;
    shared.set(k, { step: p.step | 0, frac: +p.frac || 0, done: !!p.done }); for (const fn of listeners) fn(k, shared.get(k)); return true;
  }
  W.learn = learn;

  // ---- saved progress ------------------------------------------------------------------------------------------
  const rpc = (fn, body) => fetch(URL_ + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    .then(r => r.ok ? r.json() : Promise.reject(r.status));
  rpc('bridges_state').then(rows => { for (const r of rows) learn(r.k, r); }).catch(() => {}).finally(() => { W.loaded = true; });
  const pending = new Map(), lastSent = new Map();
  function save(k, p) {
    if (!p || !ahead(p, shared.get(k)) && !ahead(p, pending.get(k))) return;
    learn(k, p); const prev = lastSent.get(k) || { at: 0, step: -1 };
    pending.set(k, p);
    if (p.done || p.step !== prev.step || performance.now() - prev.at > 1500) flush(k);   // a new step at once, else every 1.5 s
  }
  function flush(k) {
    const p = pending.get(k); if (!p) return; pending.delete(k); lastSent.set(k, { at: performance.now(), step: p.step });
    rpc('build_bridge', { p_k: k, p_step: p.step, p_frac: p.frac, p_done: !!p.done }).then(rows => { if (rows && rows[0]) learn(k, rows[0]); }).catch(() => {});
  }
  setInterval(() => { for (const k of [...pending.keys()]) if (performance.now() - (lastSent.get(k) || { at: 0 }).at > 1500) flush(k); }, 500);

  // ---- the others ----------------------------------------------------------------------------------------------
  let ch = null, lastSend = 0;
  function connect() {
    const sb = window.tuwMembers && window.tuwMembers.client && window.tuwMembers.client();
    if (!sb) return setTimeout(connect, 400);
    ch = sb.channel('gorge', { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'w' }, ({ payload: m }) => {
      if (!m || !m.id || m.id === me) return;
      if (m.gone) { remotes.delete(m.id); return; }
      let r = remotes.get(m.id); if (!r) remotes.set(m.id, r = { frames: [] });
      r.body = m.ch; r.frames.push({ at: performance.now(), s: m }); if (r.frames.length > 20) r.frames.shift();
      if (m.p) learn(m.p.k, m.p);
    });
    ch.subscribe();
  }
  connect();
  function send(s) {
    const now = performance.now(); if (!ch || now - lastSend < 100) return; lastSend = now;
    ch.send({ type: 'broadcast', event: 'w', payload: Object.assign({ id: me }, s) });
  }
  function leave() { if (ch) ch.send({ type: 'broadcast', event: 'w', payload: { id: me, gone: true } }); }
  addEventListener('pagehide', leave);
  // someone who stops sending (closed or reloaded the tab, switched away, lost connection) goes after 2.5 s: players send
  // ~10 times a second even standing still, and the goodbye sent as a page unloads often never leaves the socket
  setInterval(() => { const now = performance.now(); for (const [id, r] of remotes) if (now - r.frames[r.frames.length - 1].at > 2500) remotes.delete(id); }, 500);
})();
