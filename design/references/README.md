# Design references — The Unfinished World landing page

## Chosen direction (2026-11-07)
`style-explorations/site.html` is the simple site page Nikhil asked for: one font (Cormorant Garamond) at one size,
title top-left, no nav, one Join button, plain paragraphs from the brand doc that scroll over the fixed ascent scene.
Bridges come from `bridges.js` (rope suspension / Howe truss / trestles on rock pinnacles), reviewed for physical
plausibility by a fresh reviewer each round.

`style-explorations/variant-k.html` + `ink.js` + `walker7.js` + `brushfigure.js` (current, "The Ascent, ink"): same mechanic as J, rendered as
shan shui ink: washes pooled inside broken brush contours, texture-stroke families, mist bands that eat mass bases,
blob-cluster pines, moss dots, Hiroshige-style timber bridge (planks, posts, rails, trestles). Built against
`inspo/masters/` (see NOTES.md) with an art-director review loop; stills per round in `review/`.

Earlier: `style-explorations/variant-j.html` + `walker3.js` (latest spike, "The Ascent"): one continuous world, terraces zigzag
up a gorge, bridge k joins terrace k to k+1, every bridge stays behind and sinks into mist, camera climbs with the walker,
parallax mountain ranges behind. Walker: brush-ink wanderer (loose hair, ragged hem, hat + bundle on the back, staff).
Nikhil is sketching the intended composition; this spike is the mechanic, not the look.

Previous: `style-explorations/variant-h2.html` + `walker2.js` (current). Continuous loop: three bridges, alternating
left→right / right→left, camera pushes into the far landing between them. Walker is a skeleton-driven silhouette
(hip/knee gait curves, pelvis height from the stance leg, foot-locked cadence, yaw so the gait reads from behind).
Previous single-bridge version: `variant-h.html` + `assembly.js` + `walker.js`: ink woodblock language, wide "Ghibli" composition,
causeway assembling from particles between a near ridge and a far cliff, hatted robed walker trailing the build frontier.
Loops: build 15s, hold 5s, dissolve 4s. Open any variant via a local server (fonts load from Google Fonts):
`python3 -m http.server 8771 --directory style-explorations`

## Other style explorations (kept for later reference)
- `variant-a` Sumi Ink (liked, the ink language came from here)
- `variant-b` Carved Block (second choice, flat planes + bokashi sky + vertical type)
- `variant-c` Blueprint Night (line art on black)
- `variant-d` Paper Layers (cutout parallax)
- `variant-e` Riso Poster (halftone, lavender)
- `variant-f` Engraved Line (hatching, Bodoni)
- `variant-g` Hiroshige Road (one-point road, round 2)
- `variant-i` Monument Isometric (cube span, round 2)
- `board.html`, `board-r2.html` side-by-side boards

## Inspiration images
`inspo/`: two shin-hanga prints (cliff + moon over water; green mountain village). Figure refs Nikhil screenshotted
(hatted figure walking through grass from behind; sitting figure with conical hat on rocks; boater) were viewed but the
temp files moved before they could be copied; re-drop them here if wanted.

## Later ideas (Nikhil, 2026-11-07)
- Progress of humanity as the walker climbs: bridges get higher-tech with altitude (rope → timber → iron → modern),
  newer buildings appear on the ledges, so the ascent reads as the story of technology. Longer-term goal, not for v1.
