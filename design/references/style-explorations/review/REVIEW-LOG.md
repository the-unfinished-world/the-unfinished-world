# Art-director review loop — variant-k "The Ascent, ink" (2026-11-07)

Reviewer: independent subagent given the master references in `../../inspo/masters/` plus stills of the render.
Scores are parity with the references, 1-10.

## Round 1 — overall 4/10
rocks 3 · mist 4 · pines 2 · bridge 5 · figure 7 · composition 5 · templated-risk HIGH
Named tells: feathered drop-shadow rocks, lens-flare mist blobs, cloned pine sprite, uniform texture arcs,
rain streaks over the whole canvas, masses under the headline.
Fixes applied: contours as broken variable-width lines; washes pooled inside the clip; texture strokes in
vertical families; mist as hand-shaped bands with wobbly outline; masses fade to paper at the base; walls removed;
headline column cleared; deck planks, 3px posts, 1.5px rails, trestle feet; hat on head, hem in tails.

## Round 2 — overall 6/10
rocks 6 · mist 5 · pines 4 · bridge 6 · figure 7 · composition 6 · templated-risk MEDIUM
Remaining tells: straight-edged floating shard masses, lamppost pines, gradient far hills, flat pink moon,
pick-up-stick timber.
Fixes applied: Chaikin-rounded outlines; masses tall enough to overlap the one below by ~20%; no blur on contours;
top-of-frame masses fade; far hills flat wash + 1px broken contour; mid-height mist bands; pines as curved trunk +
sweeping arcs + layered needle pads; deck 25% grey with darker planks; timber flies within ~30° of final; hat brim droop.

## Round 3 — see below (appended when the rescoring returns)

## Round 3 — overall 7/10
rocks 7 · mist 7 · pines 6 · bridge 6 · figure 8 · composition 7 · templated-risk LOW-MEDIUM
"Reads as an ink painting at a glance; remaining gap is depth layering and focal collisions."
Fixes applied after (r4 stills): depth split (ledges near the walker at full value, 2-3 steps away 72%, further 50%;
background masses no texture, 1px contour); no flying timber within 70px of the figure and ghosts at ≤35% alpha until
they land; needle pads as 3-5 blobs of random width with rotated dashes and 20% dropped; left ledges pulled 24px clear
of the headline; moon drawn above the masses with a soft edge.
Not yet done from the reviewer's list: deck planks still read as one ribbon at hero zoom; nav text can sit on a mass
at some altitudes. Next candidates: plank contrast, a nav backdrop or lighter top band, pine/bridge depth sort.

## Figure sub-loop (walker4 → walker6)
Nikhil's direction: bare head with topknot, no hat, no staff, no bundle; then "more humanistic, simple human
silhouette, slight Murim touch, not buff, smooth not clunky polygons".
- f1 (walker4, stroked limbs): 4/10 — "pictogram, restroom sign in a bathrobe". Fixes: one closed outline, neck gap,
  sloped 0.22h shoulders, ankle-length flared robe, teardrop sleeves, lean + bob + hem swing, wobble + soft stroke.
- walker5 (single outline, Murim proportions) rejected by Nikhil: too broad, reads as fighters.
- f2 (walker6, slender single outline): 6.5/10 — generic human, not a fighter; walk hidden under the robe.
  Fixes: hem lifts 0.07h over the swinging leg with a knee bulge, hip amplitude up, lean 12°, head forward,
  arm ±20°, hips 0.20h, hem 0.28h, single shallow sash notch, rounded forearm tip.
- f3: 8/10 — "ship it"; proportions 8, robe 8, gait 7, silhouette 8, presence 8; walk reads at 100px via hem tilt and lean.
  Two minor fixes applied after: trailing hem corner droops instead of a flat shelf; sash is a front-outline concavity, not a hole.
  Scene side: timber exclusion widened to 90px around the head. Final still: f4-in-scene-full.jpg.

## Modern figure + brush bridge (2026-11-07, late)
Nikhil: "normal humans without a robe" (refs: Muybridge plate 553 rear/profile walking, walking silhouette), then
"torso too long, joints should blend", then "the human has to match the brush strokes of the rest".
- walker7.js: ordinary person (shirt, trousers, short hair), tapered limb outlines starting inside the body, shorter
  torso, rounded shoulders. brushfigure.js: offscreen render → blur+contrast merge (joints flow together) → feathered
  offsets + dry-brush grain → multiply composite.
- Bridge b1 review: 6/10 — deck was "the last vector element"; arrivals read as streaks; flat line weights.
  Fixes: deck as textured ink band with 2px planks (10% skipped), hierarchy (deck 5.6 / legs 3 / cap 3 / posts 2.5 /
  braces+rails 1.5 with breaks), cap beams, foot pads on rock, legs fading into mist inside the sprite, arrivals as
  final sprites gliding 60-90px over 0.4-0.6s with a 2° overshoot, no streaks.
- b2: bridge 8/10 (parity 8, structure 8, arrivals 7, hierarchy 8, integration 7); figure brush parity 8/10.
  Last two fixes applied: trestles lock only after their deck segment and grow down from the cap beam; figure neck
  narrowed and merge blur reduced so the head separates at 100px. Final stills: final-*.jpg/png.

## Status at end of 2026-11-07
Hero scene approved direction: variant-k.html + ink.js + walker7.js + brushfigure.js. Reviewer scores: scene 7/10,
bridge 8/10, figure 8/10. Next: real copy, then build the site (Next.js) around this canvas.

## Profile figure loop vs Nikhil's vector references (walker8.js, 2026-11-07 late pm)
Nikhil supplied three vector silhouettes (male/female profile walkers, few interior lines); files were lost, so the
verifier scored against review/FIGURE-REFERENCE-SPEC.md plus masters/walking-man-silhouette.png and the Muybridge plate.
Scores male / female: p2 4/5 → p3 6/7 → p4 7/7.5 → p5 8/8 ("pretty similar now").
Final fixes after p5: stride to ~.45h with the rear knee at 8° at push-off; armpit closed (upper arm .056h at the
shoulder, deltoid .044h). Both variants alternate per bridge in the scene (seeded by ledge index).
Final stills: p6-final-*.

## Structural plausibility loop — bridges.js (2026-11-07 evening), FRESH reviewer each round per Nikhil
Three real types, each supported only by rock it touches: rope suspension (towers on ledges, back-stays to anchors,
main cables, hangers, side ropes), timber Howe truss on abutments, beam-on-trestles with every trestle on a rock pinnacle.
- s1 (reviewer A, structural engineer): rope 7, truss 5, pier 6. Violations: back-stays too steep (anchors 25px
  behind 65px towers), no deck-rope anchors, truss had no level seat or thrust block and read as a wedge (mist veil on the
  test page), upper end trestle over the chasm, trestles ending above pinnacles, no cap beams, 35° ramp needs cleats.
  Suggested 4th type: Himalayan timber cantilever.
- Fixes applied: anchors 72px behind towers with stake + deadman, deck-rope stakes, cable sag increased, thrust block at
  the downhill chord, sill block instead of a trestle at the upper end, cap beams, trestle feet on flat pinnacle tops,
  cleats every 12px on truss and pier decks.
- s2 (reviewer B): rope 7, truss 5, pier 6. Key finding: bridge landings pile onto the same ledge corner and the
  truss hangs off the lip. Fixes applied: landings 14px inside the lip and 72px apart along the ledge top, dark pinnacle
  caps under trestle feet, pinnacle roughness reduced.
- s3: pending (reviewer C).
- s3 (reviewer C): truss 4, rope 5, walkway 7; "truss ends rest on nothing". Fixed by construction: structure now
  starts/ends exactly at the cliff lips, abutments 10px inside each lip, thrust block at the downhill end post, sill
  blocks for the walkway, towers 6px inside the lips; the walker lands on a plain approach deck 62px over rock and
  turns back to the lip. A fourth type, Himalayan timber cantilever (stacked corbel tiers with stone-weighted tails,
  a stepped bracket under the upper end), added; types cycle rope/truss/pier/cantilever. Nikhil: "close enough, move on."

## Typography + copy (fresh reviewer, 2026-11-07 evening)
Six fonts rendered with the real copy (type-row1/2.jpg). Verdict: EB Garamond 20/1.5, 420px measure, off-black
#1c1a17, italic title at the same size; runner-up Crimson Pro. Copy rewritten from ten paragraphs to nine in four
clumps (0.55em inside a clump, ~1.6em at a break), keeping "a different question" and the vision line verbatim;
Join as a plain underlined word after the first clump, "join the collective" as the last sentence. Scroll signal:
the first screen ends mid-sentence under the bottom fade. Applied in site.html; stills site-final-*.jpg.

## Highlights (fresh reviewer, 2026-11-07 evening)
Principle: highlight the thesis, not the vocabulary; at most one per paragraph; phrases with a claim or verb, never lone
adjectives; the skim test (highlights alone should say who, what we believe, what we want). Final set of six:
"interdisciplinary thinkers and builders" / "a different question" / "what it could make possible for humanity" /
"different ways of understanding the world meet" / "Everyone teaches and everyone learns." / "possibilities whose value
exceeds their immediate financial return". Removed: what is possible, across fields, and the four single trait words.
Treatment kept as the pink wash (rhymes with the moon; wash = idea, underline = action), opacity lowered to .5.

## Walker on the bridge (2026-11-07 late)
Fixes: near-side rails, posts, hangers, ropes and cable now draw in front of the walker (pieces flagged `front`,
drawn after the figure); far side and deck behind. Walker takes the deck slope: each foot lands on the incline under
it, soles parallel to the slope, pelvis from the lower foot measured against the incline. Deck boards reoriented to
lie across the walkway on all bridges. Fresh contact reviewer (c1 frames) reported flat soles and rails behind the
body; live re-check showed those frames predate the served script update. To be re-captured and re-reviewed.
Cantilever: reviewer D scored the first rebuild 3/10 ("sticks"); rebuilt per its numbers as stacked horizontal
tiers (36/66/96/126px), sleepers, stone cairn on the lower tails, socket line on the upper cliff, knee struts,
posts from tier tips up to the climbing deck, three stringers between tips. Reviewer E pending.
Copy: AI-era paragraph added after the "different question" clump; highlight on "the frontier of what is possible".
Reviewer E on the stacked cantilever: 5/10 (from 3); found the lower stack floating above its ledge because it was
placed relative to the climbing deck. Fixed: lower stack seated at the lip, upper stack capped 40px under its lip,
two posts per stack from tier tips up to the deck. Walker gait softened per Nikhil (bob halved, pelvis eased, gentler
knee and foot curves, slower brush shimmer). Nikhil: good enough, pushed.
