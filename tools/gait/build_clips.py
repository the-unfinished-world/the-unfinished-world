"""Build gait-clips.js (the walker's motion clips) from CMU motion-capture files.

Source: CMU Graphics Lab Motion Capture Database, http://mocap.cs.cmu.edu
("The motion capture data may be copied, modified, or redistributed without permission.")
Download the .asf/.amc files named in CLIPS into one folder, then:
    python3 -I tools/gait/build_clips.py <that folder> gait-clips.js

Each clip becomes one loop: a single stride from a left-foot strike to the next, seen from the walker's left side
(facing +x), in units of body height, ground at y = 0 where the stride starts. Joint positions are stored relative to
a frame that moves at the stride's average velocity (D per cycle), so the player adds that progression back.
The loop seam is closed by spreading the end-start mismatch across the stride. Pure Python, no dependencies.
"""
import sys, math, json, os

CLIPS = {   # name: (cmu trial, seconds window that contains two left strikes, label)
    'level':  ('35_01', 0.5, 3.0, 'level walk, subject 35'),
    'ramp':   ('74_18', 1.2, 3.0, 'ramp walk, subject 74 (about 14 degrees)'),
    'stairs': ('83_34', 3.9, 7.0, 'stair climb, subject 83 (about 23 degrees)'),
}
STAND = ('83_34', 0.0, 0.8)   # the subject standing still before the stairs
TURN = ('39_11', 3.53, 5.43)   # walk forward, turn around, walk back: from the right-foot strike just before the turn
TURN_START_PHASE = .5           # to the left-foot strike just after it (the ledges are short); starts half a stride in
TURN_FPS = 30
RUN = ('35_17', 0.2, 1.2)      # a jog (subject 35, the level-walk subject): one stride, looped like the walks
JUMP = ('16_05', 0.55, 1.95)   # a two-footed forward jump: crouch, take-off, flight, landing, recovery
# building the bridges: (trial, from, to, loop?, mirror?, tool). Mirror swaps left and right so the working hand is the
# near one (seen from the side); rest angles come from the subject standing at the start of the recording.
ACTIONS = {
    'hammer': ('62_10', 5.52, 6.93, True, True, 'hammer'),    # four strokes, bent over at deck height (subject 62)
    'lift':   ('26_10', 0.30, 4.90, False, False, 'plank'),  # bend, lift a plank, stand (subject 26)
    'coil':   ('62_21', 4.53, 6.45, True, False, 'rope'),    # one turn of coiling a rope, for the rope bridges
}
N = 40                        # samples per stride
# standard skeleton: our joint name -> CMU bone whose END is that joint (L = near side, seen walking to the right)
JOINTS = {'pelvis': 'root', 'hipL': 'lhipjoint', 'kneeL': 'lfemur', 'ankleL': 'ltibia', 'ballL': 'lfoot', 'toeL': 'ltoes',
          'hipR': 'rhipjoint', 'kneeR': 'rfemur', 'ankleR': 'rtibia', 'ballR': 'rfoot', 'toeR': 'rtoes',
          'spine': 'upperback', 'chest': 'thorax', 'neck': 'lowerneck', 'skull': 'upperneck', 'crown': 'head',
          'shoulderL': 'lclavicle', 'elbowL': 'lhumerus', 'wristL': 'lradius', 'handL': 'lwrist',
          'shoulderR': 'rclavicle', 'elbowR': 'rhumerus', 'wristR': 'rradius', 'handR': 'rwrist'}

def rx(a): c, s = math.cos(a), math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]
def ry(a): c, s = math.cos(a), math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]
def rz(a): c, s = math.cos(a), math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]
def mm(A, B): return [[sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
def mv(A, v): return [sum(A[i][k] * v[k] for k in range(3)) for i in range(3)]
def tr(A): return [[A[j][i] for j in range(3)] for i in range(3)]
def eul(x, y, z): return mm(rz(math.radians(z)), mm(ry(math.radians(y)), rx(math.radians(x))))

def read_asf(p):
    bones, hier, sec, cur = {}, {}, None, None
    for ln in open(p):
        t = ln.split()
        if not t: continue
        if t[0].startswith(':'): sec = t[0]; continue
        if sec == ':bonedata':
            if t[0] == 'begin': cur = {'dof': []}
            elif t[0] == 'end': bones[cur['name']] = cur
            elif t[0] == 'name': cur['name'] = t[1]
            elif t[0] == 'direction': cur['dir'] = [float(x) for x in t[1:4]]
            elif t[0] == 'length': cur['len'] = float(t[1])
            elif t[0] == 'axis': cur['axis'] = [float(x) for x in t[1:4]]
            elif t[0] == 'dof': cur['dof'] = t[1:]
        if sec == ':hierarchy' and t[0] not in ('begin', 'end'): hier[t[0]] = t[1:]
    for b in bones.values(): b['C'] = eul(*b['axis']); b['Ci'] = tr(b['C'])
    return bones, hier

def read_amc(p):
    frames, cur = [], None
    for ln in open(p):
        t = ln.split()
        if not t or t[0].startswith(('#', ':')): continue
        if len(t) == 1 and t[0].isdigit(): cur = {}; frames.append(cur); continue
        cur[t[0]] = [float(x) for x in t[1:]]
    return frames[::2]   # 120 -> 60 fps

def fk(bones, hier, fr):
    r = fr['root']; pos = {'root': r[0:3]}; R = {'root': eul(*r[3:6])}; stack = ['root']
    while stack:
        p = stack.pop()
        for c in hier.get(p, []):
            b = bones[c]; a = dict(zip(b['dof'], fr.get(c, []))); M = eul(a.get('rx', 0), a.get('ry', 0), a.get('rz', 0))
            R[c] = mm(R[p], mm(b['C'], mm(M, b['Ci']))); off = mv(R[c], [d * b['len'] for d in b['dir']])
            pos[c] = [pos[p][i] + off[i] for i in range(3)]; stack.append(c)
    return {k: pos[v] for k, v in JOINTS.items()}

def load(folder, trial):
    bones, hier = read_asf(os.path.join(folder, trial.split('_')[0] + '.asf'))
    return [fk(bones, hier, f) for f in read_amc(os.path.join(folder, trial + '.amc'))]

def strikes(F):
    a = [f['ankleL'] for f in F]; out, armed = [], False
    for i in range(1, len(F)):
        v = math.dist(a[i], a[i - 1]) * 60
        if v > 30: armed = True
        if armed and v < 6 and (not out or i - out[-1] > 30): out.append(i); armed = False
    return out

def height(F):   # standing height: crown above the lower toe, from the first frames
    return max(f['crown'][1] - min(f['toeL'][1], f['toeR'][1]) for f in F[:20]) * 1.02

def side(F, i, w, a, f, g0, H):
    o = {}
    for k in JOINTS:
        p = [F[i][k][q] * (1 - w) + F[min(i + 1, len(F) - 1)][k][q] * w for q in range(3)]
        o[k] = [((p[0] - a[0]) * f[0] + (p[2] - a[2]) * f[2]) / H, (p[1] - g0) / H]
    return o

def clip(folder, trial, lo, hi):
    F = load(folder, trial); H = height(F); S = [s for s in strikes(F) if lo * 60 <= s <= hi * 60]; s0, s1 = S[0], S[1]
    a, b = F[s0]['pelvis'], F[s1]['pelvis']; f = [b[0] - a[0], 0, b[2] - a[2]]; n = math.hypot(f[0], f[2]); f = [f[0] / n, 0, f[2] / n]
    g0 = min(F[s0]['toeL'][1], F[s0]['ankleL'][1])
    raw = []
    for k in range(N + 1):
        t = s0 + (s1 - s0) * k / N; i = int(t); raw.append(side(F, i, t - i, a, f, g0, H))
    D = [raw[N]['pelvis'][0] - raw[0]['pelvis'][0], raw[N]['pelvis'][1] - raw[0]['pelvis'][1]]
    frames = []
    for k in range(N):
        fr = {}
        for j in JOINTS:
            res = [raw[N][j][q] - raw[0][j][q] - D[q] for q in range(2)]      # loop mismatch for this joint
            fr[j] = [round(raw[k][j][q] - D[q] * k / N - res[q] * k / N, 4) for q in range(2)]
        frames.append(fr)
    for sd in 'LR': repair_foot(frames, sd); smooth_swing(frames, sd, D)
    return {'D': [round(D[0], 4), round(D[1], 4)], 'dur': round((s1 - s0) / 60, 3), 'frames': frames}

def ang(a, b): return math.atan2(b[1] - a[1], b[0] - a[0])
def wrap(a): return (a + math.pi) % (2 * math.pi) - math.pi
def med(v): v = sorted(v); return v[len(v) // 2]

def repair_foot(frames, sd):
    # Some captures lose the foot markers for a few frames of the swing: the ankle-to-ball bone shrinks and points
    # backwards. Find those frames (foot length or foot-to-shin angle far from typical) and rebuild ball and toe there
    # by interpolating the foot-to-shin and toe-to-foot angles between the good frames on either side (the loop wraps).
    K, A, B, T = 'knee' + sd, 'ankle' + sd, 'ball' + sd, 'toe' + sd; n = len(frames)
    rel = [wrap(ang(f[A], f[B]) - ang(f[K], f[A])) for f in frames]
    tre = [wrap(ang(f[B], f[T]) - ang(f[A], f[B])) for f in frames]
    fl = [math.dist(f[A], f[B]) for f in frames]; tl = [math.dist(f[B], f[T]) for f in frames]
    mr, mf, mt = med(rel), med(fl), med(tl)
    bad = [abs(wrap(rel[i] - mr)) > math.radians(55) or fl[i] < .85 * mf for i in range(n)]
    if not any(bad): return
    for i in range(n):
        if not bad[i]: continue
        a = i; b = i
        while bad[a % n]: a -= 1
        while bad[b % n]: b += 1
        w = (i - a) / (b - a); ra, rb = rel[a % n], rel[b % n]; ta, tb = tre[a % n], tre[b % n]
        r = ra + wrap(rb - ra) * w; t = ta + wrap(tb - ta) * w
        f = frames[i]; fa = ang(f[K], f[A]) + r
        f[B] = [round(f[A][0] + mf * math.cos(fa), 4), round(f[A][1] + mf * math.sin(fa), 4)]
        f[T] = [round(f[B][0] + mt * math.cos(fa + t), 4), round(f[B][1] + mt * math.sin(fa + t), 4)]
    print('  repaired', sd, 'foot in', sum(bad), 'frames', file=sys.stderr)

def smooth_swing(frames, sd, D):
    # The recorded swing can lurch: on the stairs the foot rises, dips over the step edge, then whips forward in a
    # frame or two, which reads as a hop on a smooth deck. Replace the ankle's path between toe-off and heel-strike
    # with a minimum-jerk curve in ground coordinates (zero velocity at both ends, so stance is untouched and the
    # planted foot cannot slide), keep the recorded clearance as a smooth bump, then re-solve the knee from the
    # real thigh and shin lengths. The foot keeps its recorded orientation relative to the ankle.
    n = len(frames); H, K, A, B, T = 'hip' + sd, 'knee' + sd, 'ankle' + sd, 'ball' + sd, 'toe' + sd
    world = lambda i, p: [p[0] + D[0] * i / n, p[1] + D[1] * i / n]          # moving frame -> ground frame
    W = [world(i, frames[i][A]) for i in range(n)] + [world(n, frames[0][A])]
    sp = [math.dist(W[i + 1], W[i]) for i in range(n)]
    still = sorted(sp)[n // 4]; moving = [v > max(3 * still, .004) for v in sp]
    # the swing = the longest run of moving frames (cyclic)
    best, start = (0, 0), None
    for k in range(2 * n):
        if moving[k % n]:
            if start is None: start = k
            if k - start + 1 > best[0] and k - start + 1 <= n: best = (k - start + 1, start)
        else: start = None
    m, a = best
    if m < 4: return
    i0, i1 = a - 1, a + m          # last planted frame before, first planted frame after (indices may exceed n)
    p0, p1 = world(i0, frames[i0 % n][A]), world(i1, frames[i1 % n][A])
    if i0 % n > i0: p0 = world(i0 % n, frames[i0 % n][A])
    # cyclic indices: express both ends in the same ground frame by adding whole strides
    p0 = [frames[i0 % n][A][0] + D[0] * i0 / n, frames[i0 % n][A][1] + D[1] * i0 / n]
    p1 = [frames[i1 % n][A][0] + D[0] * i1 / n, frames[i1 % n][A][1] + D[1] * i1 / n]
    orig = [[frames[k % n][A][0] + D[0] * k / n, frames[k % n][A][1] + D[1] * k / n] for k in range(i0, i1 + 1)]
    L = len(orig) - 1
    clear = max(o[1] - (p0[1] + (p1[1] - p0[1]) * (j / L)) for j, o in enumerate(orig))
    l1 = med([math.dist(f[H], f[K]) for f in frames]); l2 = med([math.dist(f[K], f[A]) for f in frames])
    for j in range(1, L):
        k = i0 + j; f = frames[k % n]; t = j / L; mj = 10 * t ** 3 - 15 * t ** 4 + 6 * t ** 5
        g = [p0[0] + (p1[0] - p0[0]) * mj, p0[1] + (p1[1] - p0[1]) * mj + clear * 16 * t * t * (1 - t) * (1 - t)]
        na = [round(g[0] - D[0] * k / n, 4), round(g[1] - D[1] * k / n, 4)]
        dB, dT = [f[B][0] - f[A][0], f[B][1] - f[A][1]], [f[T][0] - f[A][0], f[T][1] - f[A][1]]
        hp = f[H]; d = min(math.dist(hp, na), l1 + l2 - 1e-4); th = math.atan2(na[1] - hp[1], na[0] - hp[0])
        c = max(-1, min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))); al = math.acos(c)
        k1 = [hp[0] + l1 * math.cos(th + al), hp[1] + l1 * math.sin(th + al)]; k2 = [hp[0] + l1 * math.cos(th - al), hp[1] + l1 * math.sin(th - al)]
        f[K] = [round(v, 4) for v in (k1 if k1[0] > k2[0] else k2)]          # knees bend forward
        f[A] = na; f[B] = [round(na[0] + dB[0], 4), round(na[1] + dB[1], 4)]; f[T] = [round(na[0] + dT[0], 4), round(na[1] + dT[1], 4)]
    print('  smoothed', sd, 'swing over', L, 'frames, clearance', round(clear, 3), file=sys.stderr)

def jump_clip(folder, trial, t0, t1):
    # The jump, side-on along its direction. The clip's own rise is taken out (the physics decides how high a jump
    # goes); what stays is the body: crouch, legs tucking up in flight, reaching down to land, absorbing the landing.
    # Frame y is relative to the standing ground; 'lift' records the removed rise.
    # Marks (seconds into the clip): takeoff (feet leave), apex, land (feet back down).
    F = load(folder, trial); H = height(F); i0, i1 = int(round(t0 * 60)), int(round(t1 * 60))
    a, b = F[i0]['pelvis'], F[i1]['pelvis']; R = [b[0] - a[0], 0, b[2] - a[2]]; nr = math.hypot(R[0], R[2]); R = [R[0] / nr, 0, R[2] / nr]
    g0 = min(F[i0]['ankleL'][1], F[i0]['ankleR'][1]); base = F[i0]['pelvis'][1]
    feet = [min(F[i]['ankleL'][1], F[i]['ankleR'][1]) - g0 for i in range(i0, i1 + 1)]
    air = [k for k, v in enumerate(feet) if v > .35]
    tk, ld = air[0], air[-1] + 1
    out = {'frames': [], 'lift': [], 'fps': TURN_FPS}
    n = int(round((t1 - t0) * TURN_FPS))
    for k in range(n + 1):
        t = i0 + (i1 - i0) * k / n; i = int(t); w = t - i; j = min(i + 1, len(F) - 1)
        f = {q: [F[i][q][c] * (1 - w) + F[j][q][c] * w for c in range(3)] for q in JOINTS}
        lift = max(0, f['pelvis'][1] - base)   # the body's rise above standing: removed (the physics sets the height),
                                               # so the crouch stays and in flight the legs tuck up under the body
        px = (f['pelvis'][0] - a[0]) * R[0] + (f['pelvis'][2] - a[2]) * R[2]
        out['frames'].append([round(v, 4) for q in JOINTS for v in ((((f[q][0] - a[0]) * R[0] + (f[q][2] - a[2]) * R[2]) - px) / H, (f[q][1] - g0 - lift) / H)])
        out['lift'].append(round(lift / H, 4))
    out['dur'] = round(t1 - t0, 3); out['takeoff'] = round(tk / 60, 3); out['land'] = round(ld / 60, 3)
    apex = max(range(tk, ld), key=lambda q: feet[q]); out['apex'] = round(apex / 60, 3)
    for sd in 'LR': pass
    print('jump', trial, 'dur', out['dur'], 'takeoff', out['takeoff'], 'apex', out['apex'], 'land', out['land'], file=sys.stderr)
    return out

def action_clip(folder, trial, t0, t1, loop, mirror, tool):
    F = load(folder, trial); H = height(F); i0, i1 = int(round(t0 * 60)), int(round(t1 * 60))
    def facing(f):
        l, r = f['hipL'], f['hipR']; d = [l[0] - r[0], l[2] - r[2]]; fx, fz = -d[1], d[0]; n = math.hypot(fx, fz) or 1; return [fx / n, fz / n]
    fs = [facing(F[i]) for i in range(i0, i1 + 1)]; fx = sum(v[0] for v in fs); fz = sum(v[1] for v in fs); n = math.hypot(fx, fz); R = [fx / n, fz / n]
    g0 = min(min(F[i]['ankleL'][1], F[i]['ankleR'][1]) for i in range(i0, i1 + 1))
    swap = lambda q: (q[:-1] + ('R' if q[-1] == 'L' else 'L')) if mirror and q[-1] in 'LR' and q not in ('pelvis',) else q
    def side(f):
        px = f['pelvis'][0] * R[0] + f['pelvis'][2] * R[1]
        return {q: [((f[swap(q)][0] * R[0] + f[swap(q)][2] * R[1]) - px) / H, (f[swap(q)][1] - g0) / H] for q in JOINTS}
    N = int(round((t1 - t0) * TURN_FPS)); raw = []
    for k in range(N + 1):
        t = i0 + (i1 - i0) * k / N; i = int(t); w = t - i; j = min(i + 1, len(F) - 1)
        raw.append(side({q: [F[i][q][c] * (1 - w) + F[j][q][c] * w for c in range(3)] for q in JOINTS}))
    if loop:   # close the seam like the strides
        for k in range(N + 1):
            for q in JOINTS: raw[k][q] = [raw[k][q][c] - (raw[N][q][c] - raw[0][q][c]) * k / N for c in range(2)]
        raw = raw[:-1]
    st = side(F[0]); g1 = min(st['ankleL'][1], st['ankleR'][1])   # the subject standing at the start: rest angles
    def a(p, q): return math.atan2(q[1] - p[1], q[0] - p[0])
    rest = {'footL': round(a(st['ankleL'], st['ballL']), 4), 'footR': round(a(st['ankleR'], st['ballR']), 4),
            'toeL': round(wrap(a(st['ballL'], st['toeL']) - a(st['ankleL'], st['ballL'])), 4), 'toeR': round(wrap(a(st['ballR'], st['toeR']) - a(st['ankleR'], st['ballR'])), 4),
            'head': round(a(st['skull'], st['crown']), 4)}
    print('action', trial, 'frames', len(raw), 'loop' if loop else 'once', file=sys.stderr)
    return {'fps': TURN_FPS, 'loop': loop, 'tool': tool, 'dur': round(len(raw) / TURN_FPS if loop else (t1 - t0), 3), 'rest': rest, 'source': 'CMU mocap ' + trial,
            'frames': [[round(v, 4) for q in JOINTS for v in fr[q]] for fr in raw]}

def rests(c, ground):
    # each subject's own "flat foot" and toe angles (median over mid-stance), and the head's average angle
    F = c['frames']; n = len(F); r = {}
    for sd, lo, hi in (('L', .15, .45), ('R', .65, .95)):
        idx = range(int(n * lo), int(n * hi))
        r['foot' + sd] = round(med([ang(F[i]['ankle' + sd], F[i]['ball' + sd]) for i in idx]) - ground, 4)
        r['toe' + sd] = round(med([wrap(ang(F[i]['ball' + sd], F[i]['toe' + sd]) - ang(F[i]['ankle' + sd], F[i]['ball' + sd])) for i in idx]), 4)
    hs = [ang(f['skull'], f['crown']) for f in F]; r['head'] = round(math.atan2(sum(math.sin(a) for a in hs), sum(math.cos(a) for a in hs)), 4)
    return r

def stand(folder, trial, lo, hi):
    F = load(folder, trial); H = height(F); i0, i1 = int(lo * 60), int(hi * 60)
    # facing: the direction the subject walks off in later in the clip
    a, b = F[i0]['pelvis'], F[min(len(F) - 1, i1 + 240)]['pelvis']; f = [b[0] - a[0], 0, b[2] - a[2]]; n = math.hypot(f[0], f[2]); f = [f[0] / n, 0, f[2] / n]
    g0 = min(min(F[i][k][1] for k in ('toeL', 'toeR', 'ankleL', 'ankleR')) for i in range(i0, i1))
    acc = {k: [0, 0] for k in JOINTS}
    for i in range(i0, i1):
        s = side(F, i, 0, a, f, g0, H)
        for k in JOINTS: acc[k][0] += s[k][0]; acc[k][1] += s[k][1]
    m = i1 - i0; px = acc['pelvis'][0] / m
    return {k: [round(v[0] / m - px, 4), round(v[1] / m, 4)] for k, v in acc.items()}

def turn_clip(folder, trial, t0, t1):
    # The turn-around, seen from the side. Unlike the strides, the body turns, so for each frame we keep: joint
    # positions projected on the picture plane (x along the walk-in direction, y up, units of body height, x relative
    # to the pelvis), the pelvis track (root), the facing (yaw: 0 = walking in, pi = walking back), and the pitch of
    # the feet, toes, torso and head measured in 3D (so they stay right when the body faces the viewer).
    F = load(folder, trial); H = height(F); i0, i1 = int(round(t0 * 60)), int(round(t1 * 60))
    a, b = F[max(0, i0 - 60)]['pelvis'], F[i0]['pelvis']; R = [b[0] - a[0], 0, b[2] - a[2]]; nr = math.hypot(R[0], R[2]); R = [R[0] / nr, 0, R[2] / nr]
    g0 = min(F[i0]['ankleL'][1], F[i0]['ankleR'][1])
    hor = lambda v: math.hypot(v[0], v[2])
    def facing(f):   # unit horizontal vector the body faces: perpendicular to the hip line, pointing the way it walks
        l, r = f['hipL'], f['hipR']; d = [l[0] - r[0], l[2] - r[2]]; fx, fz = -d[1], d[0]; n = math.hypot(fx, fz) or 1; return [fx / n, 0, fz / n]
    f0 = facing(F[i0]); sgn = 1 if f0[0] * R[0] + f0[2] * R[2] > 0 else -1
    def pitch_along(v, fv):   # angle of v above the horizontal, signed by whether it points along the facing
        fwd = v[0] * fv[0] + v[2] * fv[2]; return math.atan2(v[1], fwd)
    out = {'frames': [], 'root': [], 'yaw': [], 'pitch': []}; prev = None
    n = int(round((t1 - t0) * TURN_FPS))
    for k in range(n + 1):
        t = i0 + (i1 - i0) * k / n; i = int(t); w = t - i; j = min(i + 1, len(F) - 1)
        f = {q: [F[i][q][c] * (1 - w) + F[j][q][c] * w for c in range(3)] for q in JOINTS}
        fv = facing(f); fv = [fv[0] * sgn, 0, fv[2] * sgn]
        yaw = math.atan2(fv[2] * R[0] - fv[0] * R[2], fv[0] * R[0] + fv[2] * R[2])
        if prev is not None: yaw = prev + wrap(yaw - prev)
        prev = yaw
        px = (f['pelvis'][0] - b[0]) * R[0] + (f['pelvis'][2] - b[2]) * R[2]
        out['root'].append(round(px / H, 4)); out['yaw'].append(round(yaw, 4))
        out['frames'].append([round(v, 4) for q in JOINTS for v in ((((f[q][0] - b[0]) * R[0] + (f[q][2] - b[2]) * R[2]) - px) / H, (f[q][1] - g0) / H)])
        sub3 = lambda p, q: [p[0] - q[0], p[1] - q[1], p[2] - q[2]]
        hipm = [(f['hipL'][c] + f['hipR'][c]) / 2 for c in range(3)]
        out['pitch'].append([round(v, 4) for v in (
            pitch_along(sub3(f['ballL'], f['ankleL']), fv), pitch_along(sub3(f['ballR'], f['ankleR']), fv),
            pitch_along(sub3(f['toeL'], f['ballL']), fv), pitch_along(sub3(f['toeR'], f['ballR']), fv),
            math.atan2(sub3(f['neck'], hipm)[1], (sub3(f['neck'], hipm)[0] * fv[0] + sub3(f['neck'], hipm)[2] * fv[2])),
            math.atan2(sub3(f['crown'], f['skull'])[1], (sub3(f['crown'], f['skull'])[0] * fv[0] + sub3(f['crown'], f['skull'])[2] * fv[2])))])
    # rests: feet and toes flat at mid-stance of the walking part, torso and head at their walking average
    P = out['pitch']; m = len(P)
    out['rest'] = [round(med([p[c] for p in P[:m // 6]]), 4) for c in range(6)]
    out['dur'] = round(t1 - t0, 3); out['fps'] = TURN_FPS; out['startPhase'] = TURN_START_PHASE
    yaws = out['yaw']; out['apex'] = round(min(range(m), key=lambda q: abs(abs(yaws[q]) - math.pi / 2)) / TURN_FPS, 3)   # facing the viewer
    print('turn', trial, 'dur', out['dur'], 'apex', out['apex'], 'yaw end deg', round(math.degrees(yaws[-1]), 1), 'root', min(out['root']), max(out['root']), out['root'][-1], file=sys.stderr)
    return out

if __name__ == '__main__':
    folder, out = sys.argv[1], sys.argv[2]
    st = stand(folder, *STAND)
    data = {'joints': list(JOINTS), 'stand': st, 'clips': {},
            'standRest': {'footL': round(ang(st['ankleL'], st['ballL']), 4), 'footR': round(ang(st['ankleR'], st['ballR']), 4),
                          'toeL': round(wrap(ang(st['ballL'], st['toeL']) - ang(st['ankleL'], st['ballL'])), 4), 'toeR': round(wrap(ang(st['ballR'], st['toeR']) - ang(st['ankleR'], st['ballR'])), 4),
                          'head': round(ang(st['skull'], st['crown']), 4)}}
    for name, (trial, lo, hi, label) in CLIPS.items():
        c = clip(folder, trial, lo, hi); c['label'] = label; c['source'] = 'CMU mocap ' + trial
        c['slope'] = round(math.atan2(c['D'][1], c['D'][0]), 4)
        c['ground'] = 0 if name in ('level', 'stairs') else c['slope']    # what the planted foot lies flat on (stair treads are level)
        c['rest'] = rests(c, c['ground']); data['clips'][name] = c
        print(name, trial, 'stride', c['D'], 'dur', c['dur'], 'slope deg', round(math.degrees(c['slope']), 1), file=sys.stderr)
    data['turn'] = turn_clip(folder, *TURN)
    r = clip(folder, RUN[0], RUN[1], RUN[2]); r['label'] = 'jog, subject 35'; r['source'] = 'CMU mocap ' + RUN[0]; r['slope'] = 0; r['ground'] = 0; r['rest'] = rests(r, 0)
    r['frames'] = [[v for j in JOINTS for v in fr[j]] for fr in r['frames']]; data['run'] = r
    print('run', RUN[0], 'stride', r['D'], 'dur', r['dur'], file=sys.stderr)
    data['jump'] = jump_clip(folder, *JUMP)
    data['actions'] = {name: action_clip(folder, *spec) for name, spec in ACTIONS.items()}
    # compact: frames as flat arrays in joint order
    for c in data['clips'].values(): c['frames'] = [[v for j in data['joints'] for v in fr[j]] for fr in c['frames']]
    data['stand'] = [v for j in data['joints'] for v in data['stand'][j]]
    with open(out, 'w') as fh:
        fh.write('// Generated by tools/gait/build_clips.py from the CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu).\n')
        fh.write('// Motion clips for the walker rig: one looping stride each, side view, units of body height. See rig.js.\n')
        fh.write('window.TUW_CLIPS = ' + json.dumps(data, separators=(',', ':')) + ';\n')
