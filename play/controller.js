// A platformer character on a PhysWorld (world.js). Plain data in, plain data out; no DOM, no drawing.
//   const c = new PhysCharacter(world, { x, y, height })    x, y: the feet (y-down); height in world units
//   c.step(dt, { x: -1..1, jump: held, down: held })        call at a fixed small dt (e.g. 1/120)
//   c.x, c.y, c.vx, c.vy, c.grounded, c.facing, c.slope (ground angle along facing, + = uphill), c.events (this step)
// Feel ("nimble"): quick acceleration, high variable-height jumps, strong air control, coyote time and a jump buffer,
// one-way platforms you can jump up through and drop down through (down + jump, or hold down). All tuning is in body
// heights per second so any size of character feels the same; override any field of TUNE through opts.tune.
(function (root) {
  const TUNE = {
    run: 3.0, accel: 20, decel: 26, airAccel: 14, airDecel: 6,     // H/s and H/s^2
    gravity: 32, fallMult: 1.45, maxFall: 17, jumpVel: 9.6, jumpCut: .45,
    coyote: .1, buffer: .13, stepUp: .28, snap: .32, halfWidth: .16, maxSlope: 52, dropTime: .28, dropHold: .22,
  };
  class PhysCharacter {
    constructor(world, o) {
      this.w = world; this.x = o.x; this.y = o.y; this.h = o.height || 68; this.vx = 0; this.vy = 0;
      this.t = Object.assign({}, TUNE, o.tune); this.grounded = false; this.ground = null; this.facing = o.facing || 1; this.slope = 0;
      this.time = 0; this.lastGround = -1; this.jumpAt = -1; this.wasJump = false; this.cut = false; this.drop = null; this.dropUntil = 0; this.downFor = 0; this.events = [];
    }
    ray(ox, oy, dx, dy, len, filter) {   // nearest hit that passes the filter
      const hit = this.w.raycast(ox, oy, dx, dy, len, { oneWay: true }); if (!hit) return null;
      if (filter(hit.edge)) return hit;
      // the nearest was filtered out: look a little beyond it
      const rest = this.ray(hit.x + dx * .01, hit.y + dy * .01, dx, dy, len - hit.t - .01, filter); if (rest) rest.t += hit.t + .01; return rest;
    }
    groundOK(e) { return e.cls === 'ground' && !(this.drop && e.col === this.drop && this.time < this.dropUntil); }
    wallOK(e) { return !e.oneWay && e.cls !== 'ground'; }
    step(dt, inp) {
      const T = this.t, H = this.h; this.events = []; this.time += dt;
      const ix = Math.max(-1, Math.min(1, inp.x || 0));
      if (Math.abs(ix) > .1) this.facing = ix > 0 ? 1 : -1;
      // jump input: a press is remembered for a moment (buffer); holding down + jump on a deck drops through it
      const pressed = inp.jump && !this.wasJump; this.wasJump = !!inp.jump; if (pressed) this.jumpAt = this.time;
      this.downFor = inp.down ? this.downFor + dt : 0;
      const onOneWay = this.grounded && this.ground && this.ground.oneWay;
      if (onOneWay && ((pressed && inp.down) || this.downFor > T.dropHold)) {
        this.drop = this.ground.col; this.dropUntil = this.time + T.dropTime; this.grounded = false; this.vy = 1.5 * H; this.jumpAt = -1; this.downFor = -1e9; this.events.push('drop');
      }
      // horizontal speed
      const target = ix * T.run * H, acc = (this.grounded ? (Math.abs(target) > Math.abs(this.vx) || Math.sign(target) !== Math.sign(this.vx) ? T.accel : T.decel) : (ix ? T.airAccel : T.airDecel)) * H;
      this.vx += Math.max(-acc * dt, Math.min(acc * dt, target - this.vx));
      // jumping (coyote time: a moment after walking off an edge still counts as grounded)
      if (this.jumpAt >= 0 && this.time - this.jumpAt <= T.buffer && (this.grounded || this.time - this.lastGround <= T.coyote) && !inp.down) {
        this.vy = -T.jumpVel * H; this.grounded = false; this.lastGround = -1; this.jumpAt = -1; this.cut = false; this.events.push('jump');
      }
      if (!inp.jump && this.vy < 0 && !this.cut) { this.vy *= T.jumpCut; this.cut = true; }   // let go early: a shorter hop
      // walls: rays at shin, waist and chest height in the direction of travel
      let dx = this.vx * dt;
      if (Math.abs(dx) > 1e-6) {
        const s = Math.sign(dx), reach = T.halfWidth * H;
        for (const f of [.38, .62, .88]) {
          const hit = this.ray(this.x, this.y - f * H, s, 0, Math.abs(dx) + reach, e => this.wallOK(e));
          if (hit) { dx = s * Math.max(0, hit.t - reach); this.vx = 0; }
        }
      }
      if (this.grounded) {
        // walk along the ground: step up small rises, follow slopes down, leave the ground at an edge
        const nx = this.x + dx, up = T.stepUp * H, hit = this.ray(nx, this.y - up, 0, 1, up + T.snap * H + Math.abs(dx) * 1.3, e => this.groundOK(e));
        if (hit) { this.x = nx; this.y = hit.y; this.ground = hit.edge; this.vy = 0; this.lastGround = this.time; }
        else { this.x = nx; this.grounded = false; this.ground = null; this.vy = Math.max(this.vy, 0); this.events.push('leave'); }
      } else {
        this.x += dx;
        this.vy = Math.min(T.maxFall * H, this.vy + T.gravity * H * (this.vy > 0 ? T.fallMult : 1) * dt);
        const dy = this.vy * dt;
        if (dy > 0) {   // falling: land on ground below the feet (three feet rays: centre and toes)
          let best = null;
          for (const o of [0, -.6, .6]) { const hit = this.ray(this.x + o * T.halfWidth * H, this.y - 2, 0, 1, dy + 2, e => this.groundOK(e)); if (hit && (!best || hit.t < best.t)) best = hit; }
          if (best) { this.y = best.y; this.vy = 0; this.grounded = true; this.ground = best.edge; this.lastGround = this.time; this.events.push('land'); }
          else this.y += dy;
        } else if (dy < 0) {   // rising: stop under ceilings (decks are one-way, so a jump passes up through them)
          const hit = this.ray(this.x, this.y - H, 0, -1, -dy, e => this.wallOK(e));
          if (hit) { this.y = hit.y + H; this.vy = 0; } else this.y += dy;
        }
      }
      if (this.grounded && this.ground) { const e = this.ground, ex = e.b[0] - e.a[0], ey = e.b[1] - e.a[1], a = Math.atan2(-ey * Math.sign(ex || 1), Math.abs(ex)); this.slope = a * this.facing; }
      else this.slope = 0;
      return this;
    }
  }
  root.PhysCharacter = PhysCharacter; root.PhysCharacter.TUNE = TUNE;
})(typeof window !== 'undefined' ? window : globalThis);
