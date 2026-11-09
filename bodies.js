// Bodies: the silhouette hung on a rig pose (rig.js). A body is plain data, so new or per-person bodies can be added
// later without touching the motion. All sizes are fractions of body height.
//   Base shapes: limbs [width at start, width at end] (shin adds a calf width part way down); torso outline points
//   [up, forward] from the hip joint (re-scaled to the pose's own torso length); head ellipse radii; face, hair and
//   headwear points [forward, up] around the head centre; foot points [forward, up] from the ankle, sole at -ankle.
//   Proportions: height (scale of the scene walker), build (limb and torso thickness), upper (upper-body length
//   against the legs, scaled about the hips so the feet stay planted), head (head size), stoop (forward lean, degrees).
//   Garments hang from the hips to a hem placed along the legs (hip 0, knee 1, ankle 2), so they swing with the stride.
//   Props: staff (held in the near hand, foot on the deck), sword (at the hip), axe and pack (on the back).
//   TUWBodies.make(spec) builds a body; TUWBodies.variants / .archetypes are ready-made sets.
//   drawBody(ctx, body, pose, { x, y, h, dir, xScale, color })   x, y = ground point on screen; dir = +1 right, -1 left
(function () {
  const BASE = {
    thigh: [.08, .055], shin: [.055, .03], calf: [.06, .36], upperArm: [.056, .037], forearm: [.037, .03], hand: [.03, .02],
    shoulder: [.044, .05], shoulderDrop: .07, neck: .045, torsoTop: .335,
    head: [.052, .062], face: [[.044, .03], [.053, .027], [.056, .018], [.051, .01], [.052, 0], [.048, -.012], [.04, -.05], [.012, -.062], [-.025, -.05], [-.014, -.01], [0, .03]],
    foot: [[-.038, -.012], [-.036, -.036], [-.025, -.04], [.06, -.04], [.062, -.02], [.03, 0], [.012, .014], [-.02, .014]], toe: [.045, .024, .014],
  };
  const MALE = Object.assign({}, BASE, {
    id: 'male',
    torso: [[.33, .02], [.32, .046], [.27, .066], [.22, .064], [.16, .052], [.10, .043], [.04, .046], [0, .052], [-.03, .03], [-.035, -.03], [.0, -.06], [.04, -.072], [.09, -.063], [.15, -.057], [.21, -.062], [.26, -.074], [.30, -.084], [.325, -.072], [.335, -.03]],
  });
  const FEMALE = Object.assign({}, BASE, {
    id: 'female', neck: .038, shoulderDrop: .075, thigh: [.084, .054], calf: [.062, .36],
    // natural profile: modest bust, gentle waist, fuller hips and seat (the earlier outline was a deep S-curve)
    torso: [[.315, .024], [.29, .045], [.25, .066], [.215, .06], [.17, .047], [.11, .048], [.05, .056], [0, .06], [-.035, .036], [-.04, -.02], [-.02, -.07], [.03, -.084], [.09, -.066], [.16, -.056], [.22, -.062], [.27, -.07], [.3, -.064], [.318, -.03]], torsoTop: .315,
  });

  // ---- parts -------------------------------------------------------------------------------------------------
  const HAIR = {   // head frame [forward, up]
    short: [[-.058, -.02], [-.063, .025], [-.047, .06], [-.015, .071], [.02, .067], [.042, .046], [.032, .005], [-.02, -.03]],
    bun: [[-.058, -.02], [-.063, .025], [-.047, .058], [-.015, .07], [.018, .066], [.038, .048], [.03, .01], [-.02, -.03], [-.05, -.03], [-.072, -.025], [-.075, -.04], [-.058, -.045]],
    crop: [[-.054, -.012], [-.058, .025], [-.044, .055], [-.012, .066], [.02, .062], [.04, .042], [.03, .012], [-.02, -.02]],
    ponytail: [[-.058, -.02], [-.063, .025], [-.047, .058], [-.015, .07], [.018, .066], [.038, .048], [.03, .01], [-.04, .0], [-.06, .03], [-.06, .05], [-.1, .03], [-.13, -.02], [-.12, -.05], [-.08, -.02], [-.05, -.03]],   // swung out behind
    long: [[-.06, -.02], [-.066, .03], [-.048, .062], [-.012, .074], [.02, .068], [.042, .048], [.034, .012], [.0, .0], [-.02, -.06], [-.03, -.13], [-.07, -.135], [-.074, -.07]],
    curly: [[-.07, -.03], [-.078, .02], [-.066, .066], [-.03, .088], [.012, .088], [.046, .07], [.056, .036], [.036, .01], [-.02, -.035], [-.05, -.05]],
    curls: [[-.064, -.03], [-.07, -.005], [-.066, .03], [-.072, .05], [-.052, .066], [-.04, .082], [-.012, .078], [.004, .086], [.03, .074], [.048, .062], [.05, .04], [.036, .02], [-.01, .0], [-.03, -.035]],
    wild: [[-.064, -.02], [-.09, -.02], [-.075, .02], [-.095, .045], [-.066, .06], [-.07, .085], [-.035, .08], [-.02, .1], [.0, .078], [.03, .086], [.04, .062], [.058, .05], [.038, .02], [-.02, -.01], [-.04, -.07], [-.06, -.1], [-.07, -.06]],
    topknot: [[-.056, -.015], [-.06, .025], [-.046, .056], [-.025, .066], [-.03, .088], [-.012, .104], [.006, .1], [.004, .072], [.024, .066], [.042, .046], [.032, .008], [-.02, -.025]],
    bald: [[-.05, .0], [-.04, .04], [-.02, .05], [-.03, .0]],
  };
  const HEADWEAR = {
    hat: [[-.078, .03], [.082, .03], [.08, .042], [.046, .046], [.042, .09], [.0, .1], [-.04, .092], [-.046, .046], [-.08, .042]],
    kasa: [[-.135, .025], [-.12, .04], [-.04, .085], [.0, .102], [.04, .085], [.12, .04], [.135, .025], [.0, .05]],
    hood: [[.062, .045], [.042, .085], [-.03, .115], [-.046, .088], [-.076, .046], [-.084, -.02], [-.074, -.095], [-.034, -.115], [-.004, -.074], [.012, -.03], [.038, .03]],
    helmet: [[.07, .0], [.07, .045], [.04, .075], [.0, .085], [-.04, .075], [-.06, .03], [-.07, -.04], [-.04, -.06], [-.03, -.02], [.0, -.03], [.02, -.06], [.055, -.075], [.068, -.035]],   // Corinthian: cheek guards and nape
    crest: [[.04, .075], [.045, .12], [0, .16], [-.07, .155], [-.12, .11], [-.13, .04], [-.115, -.03], [-.095, .02], [-.08, .075], [-.04, .09]],   // solid fan with a tail down the back
    petasos: [[-.1, .03], [-.09, .05], [-.045, .06], [-.04, .095], [0, .105], [.04, .095], [.045, .06], [.09, .05], [.1, .03], [0, .04]],   // Greek traveller's / herdsman's hat
    veil: [[.035, .05], [.0, .088], [-.05, .078], [-.08, .03], [-.09, -.06], [-.1, -.15], [-.06, -.16], [-.03, -.07], [.02, .0]],
  };
  const BEARD = { short: [[.05, -.025], [.054, -.05], [.04, -.08], [.01, -.085], [-.012, -.06], [-.006, -.03]], full: [[.05, -.02], [.07, -.05], [.088, -.1], [.07, -.115], [.03, -.09], [.0, -.05], [-.01, -.02]] };   // juts forward so it reads off the chest
  const MANTLE = { fur: [[.35, .04], [.33, .085], [.29, .1], [.265, .082], [.235, .095], [.205, .06], [.19, -.02], [.205, -.08], [.19, -.105], [.235, -.12], [.27, -.108], [.3, -.125], [.335, -.105], [.36, -.06]] };
  const PACK = [[.3, -.075], [.31, -.12], [.29, -.158], [.18, -.168], [.08, -.15], [.06, -.11], [.08, -.075]];
  // garments: top (torso up where it starts), hem (along the legs: hip 0, knee 1, ankle 2), flare, back (extra trail)
  const GARMENT = {
    tunic: { top: .3, hem: .75, flare: .012, back: 0 },
    chiton: { top: .3, hem: .35, flare: .01, back: 0 },
    skirt: { top: .03, hem: 1.05, flare: .02, back: .005 },
    coat: { top: .31, hem: 1.25, flare: .02, back: .012 },
    himation: { top: .3, hem: 1.55, hemBack: 1.85, roll: .085, flare: .035, back: .03 },   // sloped hem shows the ankles; cloth roll at the front waist
    himationLong: { top: .3, hem: 1.75, hemBack: 1.88, flare: .035, back: .03 },
    chlamys: { top: .33, hem: 1.0, flare: .03, back: .05 },
    robe: { top: .31, hem: 1.95, flare: .03, back: .01 },
    peplos: { top: .31, hem: 1.95, flare: .035, back: .012, over: true },
    cloak: { top: .33, hem: 1.6, flare: .04, back: .07 },
    hakama: { top: .14, hem: 1.95, flare: .03, back: .015, split: true },   // one wide tube per leg: reads as trousers, not a gown
    kilt: { top: .03, hem: .9, flare: .018, back: .006 },
  };

  const HOLD = { staff: { at: [.14, -.18], above: .26 }, crook: { at: [.14, -.18], above: .3 }, javelin: { at: [.05, -.07] }, laurel: { at: [.16, -.13] }, scroll: { at: [.12, -.22] }, lantern: { at: [.15, -.17] }, shield: { at: [.1, -.2] }, axe: { at: [.1, -.12] } };
  function make(spec) {
    const base = spec.base === 'female' ? FEMALE : MALE, w = spec.build || 1, lw = spec.limbs || w, sw = (v, k) => v.map((x, i) => i < 2 ? x * k : x);
    return Object.assign({}, base, {
      id: spec.id, label: spec.label || spec.id, base: spec.base || 'male', build: spec.build || 1, height: spec.height || 1, upper: spec.upper || 1, headScale: spec.head || 1, stoop: (spec.stoop || 0) * Math.PI / 180, nod: (spec.nod || 0) * Math.PI / 180,
      thigh: sw(base.thigh, lw * (spec.legs || 1)), shin: sw(base.shin, lw * (spec.legs || 1)), calf: [base.calf[0] * lw * (spec.legs || 1) * (spec.calf || 1), base.calf[1]],
      upperArm: sw(base.upperArm, lw), forearm: sw(base.forearm, lw), shoulder: base.shoulder.map(x => x * w), neck: base.neck * Math.sqrt(w),
      torso: base.torso.map(p => [p[0], p[1] * w * (p[1] > 0 ? (spec.chest || 1) : (spec.back || 1)) * (p[0] > .02 && p[0] < .16 ? (spec.waist || 1) : 1)]),
      hair: HAIR[spec.hair || (spec.base === 'female' ? 'bun' : 'short')], headwear: spec.headwear ? [].concat(spec.headwear).map(k => HEADWEAR[k]) : null,
      beard: spec.beard ? BEARD[spec.beard] : null, mantle: spec.mantle ? MANTLE[spec.mantle] : null,
      garment: spec.garment ? GARMENT[spec.garment] : null,
      extras: [spec.pack && PACK].filter(Boolean).map(pts => pts.map(p => [p[0], p[1] * w])),
      props: spec.props || [],
      // a held prop takes over the near arm: hand target relative to the shoulder, and how far the prop rises above the hand
      hold: spec.hold || (spec.props || []).map(p => HOLD[p]).find(Boolean) || null,
    });
  }
  const VARIANTS = [
    { id: 'walker', label: 'Walker', base: 'male' },
    { id: 'walker-f', label: 'Walker (woman)', base: 'female' },
    { id: 'coat-hat', label: 'Coat and hat', base: 'male', garment: 'coat', headwear: 'hat', height: 1.03 },
    { id: 'ponytail-skirt', label: 'Ponytail and skirt', base: 'female', hair: 'ponytail', garment: 'skirt', height: .96 },
    { id: 'long-coat', label: 'Long coat', base: 'female', hair: 'long', garment: 'coat' },
    { id: 'curly-pack', label: 'Backpacker', base: 'male', hair: 'curly', pack: true, build: 1.06, height: .98 },
    { id: 'broad-crop', label: 'Broad build', base: 'male', hair: 'crop', build: 1.14, height: 1.05 },
    { id: 'curly-pack-f', label: 'Backpacker (woman)', base: 'female', hair: 'curly', pack: true, height: .95 },
    { id: 'slim-tunic', label: 'Slim, tunic', base: 'male', hair: 'ponytail', garment: 'tunic', build: .92, height: 1.06 },
    { id: 'hat-skirt', label: 'Hat and skirt', base: 'female', hair: 'long', garment: 'skirt', headwear: 'hat', height: .97 },
  ].map(make);
  // archetypes: proportions follow the type (heads tall: ~7.5 everyday, 8 heroic / athletic, 7 for a heavy build)
  const ARCHETYPES = [
    { id: 'philosopher', label: 'Greek philosopher', base: 'male', hair: 'curls', garment: 'himation', props: ['staff'], hold: { at: [.1, -.02], above: .03 }, nod: 10, build: 1.04, height: 1.0 },
    { id: 'sage', label: 'Bearded sage', base: 'male', hair: 'bald', beard: 'full', garment: 'robe', props: ['staff'], hold: { at: [.14, -.16], above: .14 }, stoop: 12, height: .95 },
    { id: 'wanderer', label: 'Lone wanderer', base: 'male', hair: 'short', headwear: 'hood', garment: 'cloak', props: ['staff'], build: .96, height: 1.04 },
    { id: 'ronin', label: 'Wandering swordsman', base: 'male', hair: 'topknot', garment: 'hakama', props: ['sword'], legs: 1.35, build: 1.12, height: 1.0 },
    { id: 'ronin-kasa', label: 'Swordsman, straw hat', base: 'male', hair: 'topknot', headwear: 'kasa', garment: 'hakama', props: ['sword'], legs: 1.35, build: 1.12, height: 1.01 },
    { id: 'barbarian', label: 'Barbarian', base: 'male', hair: 'wild', beard: 'short', mantle: 'fur', garment: 'kilt', props: ['axe'], build: 1.3, limbs: 1.3, upper: 1.04, head: 1.0, height: 1.08 },
    { id: 'athlete', label: 'Athlete', base: 'male', hair: 'crop', garment: 'chiton', props: ['javelin'], build: .96, limbs: 1.05, chest: 1.45, back: 1.15, waist: .8, calf: 1.15, upper: .95, head: .94, height: 1.04 },
    { id: 'athlete-f', label: 'Athlete (f)', base: 'female', hair: 'ponytail', garment: 'chiton', props: ['javelin'], build: .95, calf: 1.1, upper: .95, head: .95, height: 1.0 },
    { id: 'pilgrim', label: 'Pilgrim monk', base: 'male', hair: 'bald', garment: 'robe', props: ['staff'], hold: { at: [.14, -.18], above: .32 }, pack: true, stoop: 4, height: .98 },
    { id: 'hoplite', label: 'Hoplite', base: 'male', hair: 'crop', headwear: ['helmet', 'crest'], garment: 'chiton', props: ['shield', 'spear'], build: 1.12, limbs: 1.1, chest: 1.2, calf: 1.15, height: 1.03 },
    { id: 'scribe', label: 'Scribe', base: 'male', hair: 'curls', beard: 'short', garment: 'himationLong', props: ['scroll'], build: 1.0, stoop: 4, height: .98 },
    { id: 'lantern', label: 'Lantern bearer', base: 'female', hair: 'long', headwear: 'hood', garment: 'cloak', props: ['lantern'], height: .97 },
    { id: 'shepherd', label: 'Shepherd', base: 'male', hair: 'curly', headwear: 'petasos', beard: 'short', garment: 'chlamys', props: ['crook'], build: 1.05, height: 1.0 },
    { id: 'oracle', label: 'Oracle', base: 'female', hair: 'long', headwear: 'veil', garment: 'peplos', props: ['laurel'], height: 1.0 },
].map(make);
  // every character, and a lookup by id (profiles store the id; older profiles stored 'male' / 'female')
  const ALL = [...ARCHETYPES, ...VARIANTS], LEGACY = { male: 'walker', female: 'walker-f' };
  const byId = id => ALL.find(b => b.id === (LEGACY[id] || id)) || null;
  window.TUWBodies = { male: MALE, female: FEMALE, make, variants: VARIANTS, archetypes: ARCHETYPES, all: ALL, byId, parts: { HAIR, HEADWEAR, BEARD, MANTLE, GARMENT } };

  // ---- drawing -----------------------------------------------------------------------------------------------
  function spline(ctx, pts, k) {
    const n = pts.length, P = i => pts[((i % n) + n) % n];
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < n; i++) { const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2); ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k / 3, p1[1] + (p2[1] - p0[1]) * k / 3, p2[0] - (p3[0] - p1[0]) * k / 3, p2[1] - (p3[1] - p1[1]) * k / 3, p2[0], p2[1]); }
    ctx.closePath(); ctx.fill();
  }
  const add = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const len = a => Math.hypot(a[0], a[1]);
  const unit = a => [Math.cos(a), Math.sin(a)];
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const rotAbout = (p, c, a) => { const s = Math.sin(a), co = Math.cos(a), d = sub(p, c); return [c[0] + d[0] * co - d[1] * s, c[1] + d[0] * s + d[1] * co]; };
  // a local frame: origin o, "up" at angle a, scale k; point [forward, up] -> pose coordinates
  const frame = (o, a, k, fs) => { k = k || 1; fs = fs == null ? 1 : fs; const u = unit(a), f = [u[1], -u[0]]; return p => [o[0] + (f[0] * p[0] * fs + u[0] * p[1]) * k, o[1] + (f[1] * p[0] * fs + u[1] * p[1]) * k]; };
  const ROUND = new Set([HEADWEAR.hat, HEADWEAR.kasa, HEADWEAR.petasos]);
  const UPPER = new Set(['spine', 'chest', 'neck', 'skull', 'crown', 'shoulderL', 'elbowL', 'wristL', 'handL', 'shoulderR', 'elbowR', 'wristR', 'handR']);

  window.drawBodyLines = (ctx, body, pose, o) => window.drawBody(ctx, body, pose, Object.assign({}, o, { linesOnly: true }));
  window.drawBody = function (ctx, body, pose, o) {
    // fc: how much of the profile shows (1 side-on, toward 0 facing the viewer during a turn); profile shapes narrow by it
    const { angles, ankle } = pose, h = o.h, sx = (o.dir || 1) * (o.xScale == null ? 1 : o.xScale), fc = pose.fc == null ? 1 : pose.fc, fx = a => [Math.cos(a) * fc, Math.sin(a)];
    // people lean into a climb, and lean very slightly forward even on the level (the level capture leans back a touch)
    const sl = Math.max(0, pose.slope || 0), hip0 = lerp2(pose.P('hipL'), pose.P('hipR'), .5), lean = body.stoop + .3 * sl + .07 * Math.max(0, 1 - sl / .25) * (pose.fc == null ? 1 : pose.fc);
    // proportions: the upper body scales (and stoops) about the hips; the legs and feet are the recorded ones
    const cache = {};
    const P = n => cache[n] || (cache[n] = UPPER.has(n) ? rotAbout(add(hip0, sub(pose.P(n), hip0), body.upper), hip0, -lean) : pose.P(n));
    const torsoUp = angles.torsoUp - lean, headUp = angles.head - lean * .5 - body.nod;
    // a held staff takes over the near arm: hand forward at waist height, small swing kept from the recording
    // while working (the pose carries a tool) things held in the hands are set down; worn things (sword, axe, pack) stay
    const busy = !!pose.tool;
    if (body.hold && !busy) {
      const sh = P('shoulderL'), a = len(sub(P('elbowL'), sh)), b = len(sub(P('handL'), P('elbowL'))), rec = P('handL');
      const target = add(add(sh, [body.hold.at[0] * fc, body.hold.at[1]], 1), sub(rec, add(sh, [0, -(a + b) * .9], 1)), .1), d = Math.min(len(sub(target, sh)), a + b - .005);
      const th = Math.atan2(target[1] - sh[1], target[0] - sh[0]), A = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
      const e1 = add(sh, unit(th + A), a), e2 = add(sh, unit(th - A), a), el = e1[0] < e2[0] ? e1 : e2, hd = add(sh, unit(th), d);
      cache.elbowL = el; cache.handL = hd; cache.wristL = lerp2(el, hd, .72);
    }
    const S = p => [o.x + p[0] * h * sx, o.y - p[1] * h];
    // wind: o.wind is the scene's wind along screen x (-1..1), o.time gives the gusts; in pose space it blows along
    // or against the way the body faces. Cloth, long hair and the lantern give to it.
    const tt = o.time || 0, gust = 1 + .35 * Math.sin(tt * 5.3) + .2 * Math.sin(tt * 8.7 + 1), wx = (o.wind || 0) * Math.sign(sx) * gust;
    ctx.save(); ctx.fillStyle = ctx.strokeStyle = o.color || '#1d1b18'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const limb = (a, b, w0, w1, wm, tm) => {   // tapered stroke in pose coordinates, optional bulge wm at fraction tm
      const n = 6, A = S(a), B = S(b);
      for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, t = (t0 + t1) / 2;
        const w = wm == null ? w0 + (w1 - w0) * t : t < tm ? w0 + (wm - w0) * t / tm : wm + (w1 - wm) * (t - tm) / (1 - tm);
        ctx.lineWidth = w * h; ctx.beginPath(); ctx.moveTo(A[0] + (B[0] - A[0]) * t0, A[1] + (B[1] - A[1]) * t0); ctx.lineTo(A[0] + (B[0] - A[0]) * t1, A[1] + (B[1] - A[1]) * t1); ctx.stroke(); }
    };
    const shape = (pts, k) => spline(ctx, pts.map(S), k);
    const hipMid = lerp2(P('hipL'), P('hipR'), .5), nk = P('neck');
    const tsc = len(sub(nk, hipMid)) / body.torsoTop, T = frame(hipMid, torsoUp, 1, fc), TT = p => T([p[1], p[0] * tsc]);
    const legAt = (s, t) => t <= 1 ? lerp2(P('hip' + s), P('knee' + s), t) : lerp2(P('knee' + s), P('ankle' + s), t - 1);
    const shoulderOf = s => { const sh = P('shoulder' + s), el = P('elbow' + s), d = len(sub(el, sh)) || 1; return add(sh, sub(el, sh), body.shoulderDrop / d); };
    function arm(s) {
      const sh = shoulderOf(s), Sh = S(sh), ks = .6 + .4 * fc; ctx.beginPath(); ctx.ellipse(Sh[0], Sh[1], body.shoulder[0] * h * ks, body.shoulder[1] * h * ks, 0, 0, Math.PI * 2); ctx.fill();
      limb(sh, P('elbow' + s), ...body.upperArm); limb(P('elbow' + s), P('wrist' + s), ...body.forearm); limb(P('wrist' + s), P('hand' + s), ...body.hand);
    }
    function leg(s) {
      limb(P('hip' + s), P('knee' + s), ...body.thigh);
      limb(P('knee' + s), P('ankle' + s), body.shin[0], body.shin[1], body.calf[0], body.calf[1]);
      const F = frame(P('ankle' + s), angles['foot' + s] + Math.PI / 2, 1, fc);
      shape(body.foot.map(p => F([p[0], p[1] * ankle / .04])), .35);
      const ball = F([body.foot[3][0], -ankle + body.toe[1] / 2]);
      limb(ball, add(ball, fx(angles['toe' + s]), body.toe[0]), body.toe[1], body.toe[2]);
    }
    // garment geometry, shared by the fill and the fold lines
    function geom(g) {
      const w = body.thigh[0];
      // which leg is in front changes as the legs pass each other; blend across that moment instead of switching,
      // or the hem and front edge would snap from one leg to the other mid-stride
      const sm = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t), hb2 = g.hemBack || g.hem;
      const wL = sm(.5 + (P('kneeL')[0] - P('kneeR')[0]) / .12);   // 1 when the near knee leads
      const front = lerp2(legAt('R', g.hem), legAt('L', g.hem), wL), back = lerp2(legAt('L', hb2), legAt('R', hb2), wL);
      const kneeFront = lerp2(P('kneeR'), P('kneeL'), wL), trail = g.back > .03 ? .03 : 0;
      const hb = add(back, [-(w * .55 + g.flare + g.back) + wx * (.035 + trail), -.004], 1), hf = add(front, [w * .55 + g.flare + wx * .03, -.004], 1);
      const kf = g.hem > 1.2 ? add(kneeFront, [w * .6 + g.flare * .5, 0], 1) : null;
      if (kf) hf[0] = Math.max(hf[0], kf[0]);
      return { w, hb, hf, kf };
    }
    function garment(g) {
      const w = body.thigh[0];
      if (g.split) {   // one tube per leg, plus a waist band
        for (const sd of ['R', 'L']) {
          const hp = P('hip' + sd), hm = add(legAt(sd, g.hem), [wx * .02, 0], 1), d = sub(hm, hp), L = len(d) || 1, n = [-d[1] / L, d[0] / L];
          shape([add(hp, n, w * .75), add(hm, n, w * .55 + g.flare), add(add(hm, d, .02 / L), [0, -.006], 1), add(hm, n, -(w * .55 + g.flare)), add(hp, n, -w * .75)], .2);
        }
        shape([TT([g.top, -.07]), TT([-.02, -.085]), TT([-.02, .08]), TT([g.top, .065])], .3);
        return;
      }
      const { hb, hf, kf } = geom(g);
      const pts = [TT([g.top, -.07]), TT([.04, -.095]), lerp2(TT([.04, -.095]), hb, .55), hb, lerp2(hb, hf, .5).map((v, i) => i ? v - .008 : v), hf];
      if (kf) {   // long cloth hangs straight down from the forward knee instead of letting it poke through
        pts.push(kf);
        if (g.roll) pts.push(TT([.1, g.roll]));   // the himation's rolled cloth bulging at the front waist
        pts.push(TT([.14, .06]));                 // chest straight down to the knee: no pinch at the hip
      } else pts.push(lerp2(TT([0, .06]), hf, .55), TT([0, .06]));
      pts.push(TT([g.top, .055]));
      shape(pts, .35);
      if (g.over) shape([TT([g.top, -.075]), TT([.02, -.1]), TT([-.06, -.125]), TT([-.065, .105]), TT([.02, .08]), TT([g.top, .06])], .15);   // overfold: a sharp step in the outline at the hip
    }
    // fold lines: thin paper-coloured lines inside the cloth, as on the vases; drawn by the brush pass over the ink
    function folds(g) {
      ctx.strokeStyle = o.lineColor || '#f1ede4'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(.7, h * .0065); ctx.globalAlpha = .6;
      const curve = (a, c, e) => { const A = S(a), C = S(c), E = S(e); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo(C[0], C[1], E[0], E[1]); ctx.stroke(); };
      if (g.split) { for (const sd of ['R', 'L']) { const hp = P('hip' + sd), hm = legAt(sd, g.hem * .9); curve(lerp2(hp, hm, .25), lerp2(hp, hm, .6), hm); } return; }
      const { hb, hf, kf } = geom(g), waist = t => lerp2(TT([.03, -.07]), TT([.03, .055]), t), long = !!kf;
      for (const t of long ? [.28, .55, .8] : [.35, .7]) {
        const top = waist(t), bot = add(lerp2(hb, hf, t), [0, .03], 1), mid = lerp2(top, bot, .5);
        curve(top, add(mid, [long ? (kf[0] - mid[0]) * .25 : 0, 0], 1), bot);
      }
      if (g.roll || g.top >= .3) {   // the swag across the chest from the shoulder (himation, cloak, robe)
        curve(TT([.29, .05]), TT([.2, -.01]), TT([.06, -.07])); if (g.roll) curve(TT([.22, .058]), TT([.14, .0]), TT([.01, -.06]));
      }
      if (g.back >= .05) curve(TT([.3, -.065]), lerp2(TT([.15, -.08]), hb, .4), add(hb, [.02, .03], 1));   // cloak trailing behind
    }
    function torso() {
      shape(body.torso.map(TT), .5);
      if (fc < .97) {   // turning toward the viewer: the chest's width shows between the real shoulders and hips
        const sL = shoulderOf('L'), sR = shoulderOf('R'), pad = .02 * Math.sqrt(1 - fc * fc) * body.build;
        const out = (p, q, k) => { const d = sub(p, q), l = len(d) || 1; return add(p, d, k / l); };
        // chest seen from the front: hips, a slight waist, rounded shoulders, the neck base
        const hL = out(P('hipL'), P('hipR'), pad), hR = out(P('hipR'), P('hipL'), pad), wL = out(lerp2(P('hipL'), sL, .45), lerp2(P('hipR'), sR, .45), -.012), wR = out(lerp2(P('hipR'), sR, .45), lerp2(P('hipL'), sL, .45), -.012);
        shape([hL, wL, out(sL, sR, -.006), add(lerp2(sL, nk, .5), [0, .012], 1), nk, add(lerp2(sR, nk, .5), [0, .012], 1), out(sR, sL, -.006), wR, hR], .45);
      }
      for (const ex of body.extras) shape(ex.map(TT), .45);
      if (body.mantle) shape(body.mantle.map(TT), .3);
    }
    function head() {
      // the head sits on the neck along the head's own up axis; its height comes from the pose's neck-to-crown distance
      const k = body.headScale, up = headUp, cr = P('crown'), reach = len(sub(cr, nk)) - body.head[1] * .95 * k;
      const c = add(add(nk, unit(up), reach), unit(up - Math.PI / 2), -.004 * k * fc), Hf = frame(c, up, k, fc), Hh = frame(c, up, k, Math.max(fc, .7)), Hr = frame(c, up, k), Sc = S(c);
      limb(nk, add(nk, unit(up), reach * .8), body.neck, body.neck);
      ctx.save(); ctx.translate(Sc[0], Sc[1]); ctx.rotate(-(up - Math.PI / 2) * Math.sign(sx)); ctx.beginPath(); ctx.ellipse(0, 0, body.head[0] * k * h * Math.abs(sx), body.head[1] * k * h, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      const blow = F => p => F([p[0] + wx * .2 * Math.max(0, .04 - p[1]), p[1]]);   // lower hair streams with the wind
      shape(body.face.map(Hf), .4); shape(body.hair.map(blow(Hh)), .5);
      if (body.beard) shape(body.beard.map(Hh), .45);
      if (body.headwear) for (const hw of body.headwear) shape(hw.map(ROUND.has(hw) ? Hr : hw === HEADWEAR.crest ? Hf : blow(Hh)), .3);   // round brims stay wide when facing the viewer
    }
    function props(stage) {
      for (const p of body.props) {
        if (busy && /^(staff|crook|javelin|laurel|scroll|lantern|shield|spear)$/.test(p)) continue;
        if (p === 'sword' && stage === 0) { const g = TT([.035, .04]); limb(g, TT([-.16, -.27]), .022, .018); limb(g, TT([.08, .13]), .024, .024); const G = S(g); ctx.beginPath(); ctx.arc(G[0], G[1], .03 * h / 2, 0, Math.PI * 2); ctx.fill(); }   // scabbard back and down, hilt forward, guard
        if (p === 'axe' && stage === 0) { const top = TT([.52, -.14]); limb(top, TT([.16, .09]), .022, .022); shape([[-.015, .02], [-.05, .04], [-.095, .065], [-.08, -.005], [-.09, -.08], [-.05, -.03], [-.015, -.015]].map(q => add(top, q, 1)), .2); }   // over the shoulder, bearded crescent blade
        if (p === 'staff' && stage === 1) {   // near hand grips it; the foot rests on the deck ahead
          const hd = P('handL'), d = fx(-Math.PI / 2 + .12), k = Math.tan(pose.slope || 0), t = (k * hd[0] - hd[1]) / (d[1] - k * d[0]);
          limb(add(hd, d, -(body.hold && body.hold.above != null ? body.hold.above : .26)), add(hd, d, t), .02, .016);
        }
        if (p === 'crook' && stage === 1) {   // shepherd's crook: a staff with a hook turned forward at the top
          const hd = P('handL'), d = fx(-Math.PI / 2 + .12), k = Math.tan(pose.slope || 0), t = (k * hd[0] - hd[1]) / (d[1] - k * d[0]), top = add(hd, d, -.3);
          limb(top, add(hd, d, t), .02, .016);
          const C = S(add(top, [.035, 0], 1)); ctx.lineWidth = .018 * h; ctx.beginPath(); ctx.arc(C[0], C[1], .035 * h, Math.PI, Math.PI * 2.15, sx < 0); ctx.stroke();
        }
        if (p === 'scroll' && stage === 1) { const hd = P('handL'); limb(add(hd, fx(-.5), -.06), add(hd, fx(-.5), .09), .045, .045); }
        if (p === 'lantern' && stage === 1) {   // a short pole forward from the hand, the lantern hanging plumb from its tip
          const hd = P('handL'), tip = add(hd, fx(.75), .2); limb(hd, tip, .014, .012); const la = wx * .35 + Math.sin(tt * 2.3) * .08, L = add(tip, [Math.sin(la) * .04, -Math.cos(la) * .04], 1); limb(tip, L, .008, .008);
          shape([[-.012, .012], [.012, .012], [.03, -.012], [.03, -.07], [.02, -.085], [-.02, -.085], [-.03, -.07], [-.03, -.012]].map(q => add(L, q, 1)), .25);
        }
        if (p === 'shield' && stage === 1) {   // the round hoplon on the near forearm, seen face-on: the vase painter's sign of a warrior
          const c = lerp2(P('elbowL'), P('handL'), .4), C = S(c); ctx.beginPath(); ctx.ellipse(C[0], C[1], .2 * h * Math.abs(sx) * fc, .2 * h, 0, 0, Math.PI * 2); ctx.fill();
        }
        if (p === 'spear' && stage === 0) { const hd = P('handR'), a = Math.PI / 2 + .55, d = fx(a); limb(add(hd, d, -.25), add(hd, d, 1.0), .016, .012); const tip = add(hd, d, 1.0); shape([add(tip, d, .07), add(tip, unit(a + 1.4), .018), add(tip, unit(a - 1.4), .018)], .2); }   // sloped back over the shoulder
        if (p === 'javelin' && stage === 1) { const hd = P('handL'), d = fx(20 * Math.PI / 180); limb(add(hd, d, -.36), add(hd, d, .56), .014, .01); }
        if (p === 'laurel' && stage === 1) { const hd = P('handL'), tip = add(hd, fx(55 * Math.PI / 180), .12); limb(hd, tip, .012, .01); const T2 = S(tip); for (const [dx, dy, r] of [[0, 0, .026], [-.022, -.014, .02], [.018, -.018, .019], [.004, .022, .018]]) { ctx.beginPath(); ctx.arc(T2[0] + dx * h * sx, T2[1] - dy * h, r * h, 0, Math.PI * 2); ctx.fill(); } }
      }
    }
    if (o.linesOnly) { if (body.garment) folds(body.garment); ctx.restore(); return; }
    // tools from the pose (building): hammer in the near hand, a plank carried between the hands, a coil of rope
    function tool(t) {
      if (t === 'hammer') { const wr = P('wristL'), hd = P('handL'), d = sub(hd, wr), L = len(d) || 1, u = [d[0] / L, d[1] / L], tip = add(hd, u, .11), n = [-u[1], u[0]];
        limb(wr, tip, .014, .014); limb(add(tip, n, -.035), add(tip, n, .03), .028, .024); }
      if (t === 'plank') { const a = P('handL'), b = P('handR'), m = lerp2(a, b, .5), d = sub(b, a), L = len(d) || 1, u = L > .03 ? [d[0] / L, d[1] / L] : [1, 0]; limb(add(m, u, -.22), add(m, u, .22), .028, .028); }
      if (t === 'rope') { const m = lerp2(P('handL'), P('handR'), .5), C = S(add(m, [.02, -.02], 1)); ctx.lineWidth = .016 * h; ctx.beginPath(); ctx.ellipse(C[0], C[1], .05 * h * Math.abs(sx) * fc, .07 * h, 0, 0, Math.PI * 2); ctx.stroke(); }
    }
    props(0); arm('R'); leg('R'); if (body.garment) garment(body.garment); torso(); head(); leg('L'); arm('L'); props(1); if (pose.tool) tool(pose.tool);
    ctx.restore();
  };
})();
