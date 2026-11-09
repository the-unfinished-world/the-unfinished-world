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

1. Saw the timbers to length on a trestle. (saw 62_03, the stroke enlarged so it reads at the walker's size)
2. Set the near sill. (hammer 62_10; the near abutment)
3. Peg a panel, push it out, peg the next: the truss grows outward until it lands on the far lip. (hammer and push 81_05
   in turn; chords, verticals and braces appear near to far, then the far sill)
4. Walk out laying and nailing the deck. (place + hammer; deck and cleats near to far, with you on them)

## Pier trestle (on the rock pillars)

1. Saw the timbers. (saw 62_03)
2. Send each trestle out to its pillar on a rope and set it up there: foot, legs, braces, cap. (haul 81_08, paying out;
   a line runs from your hand to the pillar top; one pillar after the other)
3. Slide the stringers out over the caps to the far lip. (push 81_05; stringers and sills near to far)
4. Walk out laying the deck; posts and rails go up with it. (place + hammer)

## Cantilever (the Bhutanese bazam)

1. Slide the near beam tiers out over the edge, one above the other. (push 81_05; tiers bottom up)
2. Weight their tails with stones. (lift and place 26_10, carrying a stone; the cairn)
3. Coil the line, then throw it from the coil until it bites on the far landing. (coil 62_21, throw 141_11)
4. Cross on the line hand over hand, hanging under it. (ladder climb 13_33 turned on its side and mirrored, so up the
   ladder is along the rope and facing the ladder is facing the rope; it follows the line's slope)
5. Build the far stack from the far bank. (push; far tiers, sockets, the far knee strut)
6. Slide back down the line. (the climb held still)
7. Push the stringers across from the near side; the posts and the near knee strut go in. (push)
8. Walk out laying the deck, with posts and rails. (place + hammer)

Durations: truss about 28 s, pier about 27 s, rope about 39 s, cantilever about 41 s (plus the walks up the deck).

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

## The landing-page walker

The walker builds each bridge in turn with the same builder as play, once it has turned on the ledge. A rope bridge
leaves it on the far landing, already facing along the ledge, so it goes straight on to the next spot.

## How it is built

Each bridge type gets a build script: a list of steps, each with its motion clip(s), tool, how long it takes, which
bridge pieces it reveals and in what order, and where the builder stands (the spot on the ledge, the pillar top, or
moving out along the deck as it grows). The scripts are data, so new bridge types or new steps are additions, not
rewrites. Saved progress is (bridge, step, fraction of step).
