# The walker's movement: current outline (walker8.js, 2026-11-08)

Figure: profile silhouette, 100 px tall in the scene (~1.75 m). Walks continuously up bridges sloped ~30-35 degrees,
pivots briefly at each ledge, then climbs the next bridge in the opposite direction.

## How the motion is produced now
- Gait cycle driven by keyframed joint angles (smooth cosine easing between keys), on FLAT ground:
  - hip (thigh from vertical): +36 at heel strike, +30, -22, -24 at toe-off, +26 mid-swing  (60 degree range)
  - knee flexion: 6 at heel strike, 14 loading, 8 mid-stance, 10, 40, 54 peak swing, 16
  - foot pitch: -8 (toe up) at heel strike ... +22 (heel up) at toe-off
  - shoulder swing +/-26 degrees opposite the legs, elbow 20-28 degrees
  - trunk lean 4 degrees; added vertical bob 0.6% of height
- Pelvis height: set so the lowest foot point touches the ground; low-pass filtered between frames.
- Slopes: the flat-ground foot positions are sheared onto the incline (each foot point raised by x*tan(slope)), knees
  re-solved with two-bone IK; if the downhill foot cannot be reached, the hip DROPS until it can.
- Cadence: one gait cycle per 0.84 x height of path walked => step length 0.42 H; speed 58 px/s (~1.0 m/s);
  ~83 steps/min.

## Measured (gait-lab.html)
| | flat | 35 degree incline (where the walker always is) | normal human walking |
|---|---|---|---|
| hip vertical bob per step | 2.3% H | 14.1% H | ~2.5-3% H (4-5 cm) |
| max foot separation | 45% H | 45% H | ~35-40% H flat; 20-30% shorter on steep uphill |
| peak knee flexion | 54 deg | 123 deg (squat) | ~60 deg swing, ~15-20 deg loading |
| hip range | 60 deg | (IK) | ~40 deg (30 flex / 10 ext) |
| arm swing | +/-26 deg | same | ~+/-15-20 deg |
| cadence | ~83 steps/min | same | ~100-115 steps/min |

## Diagnosis
The walk is authored for flat ground and bent onto a 35 degree slope. On the slope the trailing foot must reach far
downhill, so the hip drops a long way at every double-support and rises again: a lunge-and-spring every step. The
stride is long and slow (83 steps/min at 0.42 H), which reads as exaggerated striding even on flat ground.

## Proposed rebuild (foot-placement driven)
- Author the feet, not the joint angles: stance foot locked to the ground (moves back relative to the hip at walking
  speed, so no sliding), swing foot on a smooth Hermite arc with ~4% H clearance; heel-strike / flat / toe-off roll.
- Step length 30% H on flat, shortened on slopes (x0.8 at 35 degrees); cadence derived from it (~100-110 steps/min);
  speed eased to ~50 px/s for a calmer walk.
- Hip height from a smooth sinusoid, 2.5% H peak-to-peak, then knees solved by IK; never a crouch.
- Arms +/-15 degrees, elbows 15-22 degrees, slight forward lean that grows a little uphill, head steady.

## Rounds 3 and 4 (after the foot-placement rebuild)

Fresh reviewer, round 3: flat 7/10, climb 5/10. The climb read as "sitting in air" because the hip used one fixed
height for the whole cycle, low enough for the widest double-support moment, so the stance knee never straightened
(70 -> 73 -> 46 deg). Flat stance knees were 18-23 deg (sneaking).

Changes:
- Hip height is now computed per phase (`hipCurve`): as high as both legs reach with the knee at least 5 deg (flat) /
  7 deg (climb) bent, smoothed from below (never above the reach cap), then the travel squeezed to a 2.5% H bob budget.
  The stance knee extends as the body passes over the foot, like real stair ascent.
- Climb: trunk lean 19 -> 13 deg, foot lead 0.22, heel rise faster (`riseExp` 1.5 vs 2 flat).
- Near rails: drawn behind the body above the knee line; posts and deck edge in front below it; paper gap 0.8 px.
- Ledge turn: narrowest width 28% -> 60%, turn window 24 -> 14 units, so it no longer reads as a post.

Measured now (knee deg; human norm in brackets):
| | contact | loading | mid | late | toe-off | swing | bob |
|---|---|---|---|---|---|---|---|
| flat | 8 (5) | 9 (15-20) | 12 (5) | 29 at 45% | 45 (35-40) | 62 (60-65) | 2.4% |
| 35 deg climb | 60 (60) | 48 | 11 | 8 | 14 | 82 (90-100) | 2.5% |

Round 4 (fresh reviewer): flat 8/10, climb 7/10. Follow-ups applied: figure ink more solid (rails behind no longer
show through the torso), climb foot lead 0.26 (pelvis further over the feet), arm swing 14 -> 16 deg. The pale gap
where the near lower handrail crosses the shin is intentional: that rail is in front of the leg.
