# Building the bridges, one person at a time

Decided 2026-11-08 (Nikhil): cantilever far side by crossing on a rope and building there; about 20-40 s per bridge. How each of the four bridges would really be built by one person working from the
near ledge with what they carry, and the animation steps that follow from it. Each step names the recorded motion it
uses (CMU motion capture) and which parts of the bridge appear while it plays (the bridge pieces in `bridges.js`).

The rule underneath: you work from where you stand. Anything on the far side gets there by a throw, a push or by you
walking out over what you have already built. You lay a deck by walking out on it, plank by plank.

## Before and after any build

- Set down what you hold: bend, place the staff / shield / spear / lantern / scroll on the ground beside you, stand.
  (lift clip 26_10, played as a place.) The object lies there while you work.
- Pick it up again when the bridge is done (or when you walk away): bend, take it, stand, then move on.

## Rope suspension (as in Himalayan and Andean rope bridges)

1. Drive the near anchor stakes and lash the anchors. (hammer 62_10; anchors, stays appear)
2. Raise the near towers. (push 81_05; towers, stays)
3. Coil the line just before throwing it. The coil in your hands grows as you coil. (62_21 coiling)
4. Throw the weighted line with a grapnel across the gorge until it bites on the far lip; it may take a few throws.
   The full coil passes to the far hand and the line pays out from it; the near hand throws the grapnel.
   (throw 141_11; a line arcs across and catches; far anchors appear where it bites)
5. Haul the two main cables across on the line and pull them taut. (drag 81_08 / pull; cables appear)
6. Walk out along the cables laying and lashing planks, tying hangers and side ropes as you go; you advance with the
   deck. (lift 26_10 + lashing/hammer 62_10; deck, planks, hangers, edge ropes appear near to far, with you on them)
7. On the far ledge, raise the far towers. (push 81_05)

## Timber truss (launched across, as small timber bridges were)

1. Saw the timbers to length; a pile builds up beside you. (saw 62_03)
2. Peg the first truss side together at the edge: chords, verticals, braces. (hammer 62_10; the near panel appears)
3. Push it out over the gap, add the next panel, push again: the truss grows outward until its end lands on the far
   lip. (push 81_05 alternating with hammer; panels appear near to far)
4. Same for the second side. (as above)
5. Walk out nailing cross beams and deck planks, then the handrail. (lift + hammer; deck near to far, with you on it)

## Pier trestle (on the rock pillar)

1. Carry the timbers to the edge. (carry 70_xx)
2. Lower the trestle legs onto the pillar on a rope. (lowering, ~pull reversed)
3. Climb down onto the pillar top and set the cap beam. (ladder 13_33, hammer; legs, braces, cap)
   The pillar tops are already places you can stand.
4. Climb back, slide the stringers out from the ledge onto the cap, then on to the far lip. (push/drag 81_05 / 81_08)
5. Walk out nailing the deck, then posts and rails. (lift + hammer; near to far)

## Cantilever (the Bhutanese bazam)

1. Carry stones and stack the counterweight cairn on the ledge. (carry 70_xx, lift; stones appear)
2. Slide the first beam tier out over the edge with its tail under the stones. (push 81_05; tier 1)
3. Each next tier slides out further over the one below and is weighted down. (push, lift stones; tiers 2-4)
4. The far side: throw a line, cross hand over hand, build the far stack from the far bank. (throw, hang/traverse, push)
5. Stringers across, then the deck walking out. (push, lift + hammer)

## Open choices

- Cantilever far side (decided): throw a line, cross hand over hand, build the far stack from the far bank, then lay
  the deck.
- Time per bridge (decided): about 20-40 seconds, the rope bridge at the long end.
- Coiling (from Nikhil): the left hand holds the coil, the right pulls rope from the pile and lays it on; a strand runs
  from the working hand back to the coil, and the coil grows turn by turn.
- Shared bridges: progress is saved per bridge and per step, so someone else can pick up where you stopped.

## Laying a deck (from Nikhil)

Not a smooth slide: build, build, build, then step up. Each work cycle (lift a plank, hammer it in) lays about a body
length of deck, which appears with the hammer strokes; then the builder stands and walks up to the new edge, and the
work waits while they walk. Any change of place during a build (onto the deck, over to the far ledge) is a walk.

Between motions (one step to the next, setting down, stepping up, picking up) the body eases from where it was into
the new motion over about a third of a second; within a cycle (place, then hammer; one throw, then the next) the end
of one motion eases into the start of the next.

## How it is built

Each bridge type gets a build script: a list of steps, each with its motion clip(s), tool, how long it takes, which
bridge pieces it reveals and in what order, and where the builder stands (the spot on the ledge, the pillar top, or
moving out along the deck as it grows). The scripts are data, so new bridge types or new steps are additions, not
rewrites. Saved progress is (bridge, step, fraction of step).
