# Play mode: walking the gorge yourself

Status: phase 1 (colliders) in progress, 2026-11-08.

## Intent

Visitors can take the walker and move freely through the painted gorge: run, jump, fall, land on what is below,
climb back up. Later, several visitors at once see each other's walkers. The landing page stays a landing page; play is
a full-screen mode you choose.

The physics comes from the painting itself. Every solid thing in the scene is generated from a shape, and the same
shape that is painted becomes its collider, automatically. Anything added later that produces a shape (a new rock, a
new bridge type) is collidable with no extra work. The parts are modular so they can be reused elsewhere.

## Decisions (from Nikhil, 2026-11-08)

- Feel: a nimble platformer (quick, high jumps, strong air control).
- Falling: the gorge is real; walking off an edge, you land on whatever is below and climb again.
- Page: a full-screen play mode (a button fades the text away; leaving brings it back). Outside play mode the
  walker keeps strolling on its own.
- Reuse: no adapters for other engines now. Build the parts so they carry over: plain data in, plain data out.
- Multiplayer comes after free movement works (Supabase Realtime, already in the project).

## Architecture

Three layers, each usable on its own:

1. `play/shapes.js` — shapes to colliders. Pure functions, no DOM. Input: shapes (closed outlines for solid masses,
   open lines for walkable surfaces such as bridge decks). Output: colliders in a neutral JSON form:
   `{ kind: 'solid' | 'platform', points: [[x, y], ...], closed, material }`, each edge classified by its normal as
   `ground` (walkable slope), `wall` or `ceiling`. Platforms are one-way: you land on them from above and can jump up
   through or drop down through them.
2. `play/world.js` — a spatial index over collider edges with the queries a character needs (sweep, ray, overlap).
3. `play/controller.js` — a platformer character controller on that world: run, jump (variable height, coyote time,
   jump buffer), slopes, one-way platforms, drop-through, landing. It outputs motion (velocity, grounded, facing),
   which drives the existing walker rig (`rig.js`) and bodies (`bodies.js`).

Layering rule (2026-11-08): the painting is 2.5D, so a shape only collides where it is in front. A solid that a
bridge walkway runs through is painted behind that bridge: it keeps only its top, as a one-way surface you can land on, and
you walk past its sides (`PhysShapes.crosses`, `PhysShapes.tops`); a ledge's rock mass
only collides in its front band (`PhysShapes.clip`), since below that it is painted behind the ledges further down.

Starting play: any movement key (arrows / WASD / Space) takes the walker right where it is, with the text still on the
left. Esc or Leave hands the walk back. (Full-screen play, `enterPlay(true)`, exists but has no button at present.)

Bridges are built by someone (see below): a bridge's deck collider covers only the stretch laid so far, so stepping off
the built end you fall. What the walker had built before you took over stays built.

The scene supplies shapes through one adapter (`sceneShapes(kFrom, kTo)` in `index.html`): ledge outlines, rock
pinnacles, the gorge walls and the bridge decks. Painting and physics read the same geometry functions.

Units are scene units (y down, as the canvas draws). Colliders are generated lazily per ledge index `k`, like the
painting.

## Building the bridges (decided 2026-11-08)

You have to build a bridge to walk it. Each ledge has a building spot at the foot of the next bridge; standing there
and pressing E starts a building animation (recorded motion: lifting and setting planks, hammering, coiling rope for
rope bridges) and the bridge grows with the work, its deck walkable as it is laid. Press once and the character keeps
working; walking away pauses it and it resumes where it stopped. Nothing builds without a builder.

- Shared and lasting: built bridges are saved (Supabase) and stay for every visitor; the gorge is built up together.
  Several people can build and walk at once.
- The walker on the landing page also stops on each ledge and builds the next bridge with the same builder
  (`buildTick` in `index.html`, the same scripts in `build.js`). Its walk is a function of time, so each build is
  recorded ahead of time when the walk reaches it (an episode, about 2 ms to record) and becomes a dwell in the walk's
  time-distance table; while it plays, the bridge's progress follows the recording. Taking the walk over mid-build
  carries on from that moment (the bridge as far as it got, things set down, the step under way). Leaving play hands
  back to the walker's own timeline, so for now your building is not kept after you leave (until B3 saves it).
  A member's own character is the walker: when it arrives after load, the builds are recorded afresh with that body.

Saved and shared (B3, `world.js`, `supabase/004_bridges.sql`): each bridge's progress is { step, frac, done } and is
saved through `build_bridge`, which only moves it forward; `bridges_state` loads it. While you build it is saved every
1.5 s and at each new step. Others' progress arriving (from the database or a builder's live messages) is applied with
`TUWBuild.setProgress`, never backward; new pieces fly in. The walker's own builds are never saved (decided 2026-11-09: only bridges a person works on are kept, so an idle page
builds nothing for anyone). Taking over keeps them visible to you for that visit; carry on the one it was building and
that bridge is saved as you work. The walker walks bridges people have finished and carries on half-built ones from
where they stand.

Others (B4, `world.js`): while playing, your walker's state (position, speed, facing, slope, character, the build under
way, things set down, its bridge's progress) is broadcast about ten times a second on the Realtime channel `gorge`, with
a random id per tab and nothing about who you are. Everyone on the page, playing or not, draws the others 150 ms behind
(interpolated) with the same rig, bodies and builder poses; someone silent for 2.5 s is dropped (the goodbye sent on unload often never leaves the socket). Free-plan limits: 200
concurrent connections and 2 million Realtime messages a month (every visitor on the page holds a connection).

Steps: (B1) building animations from CMU construction recordings (subject 62 hammering, sawing, coiling rope; lifting),
shown on the bodies for a look; (B2) the build spot, E, progress and the growing bridge, locally, with the stroller
building too; (B3) shared, saved bridge state in Supabase; (B4) other people's walkers.

## Phases (each ends with a look from Nikhil)

1. Colliders from the scene's shapes, with a debug overlay (`?debug=colliders`) drawing them over the painting.
2. Free movement and jumping in full-screen play mode, keyboard (WASD / arrows / Space), with the rig's walk, turn,
   jump and fall.
3. Camera that follows freely, the world below the route, phone controls, bridges fully built in play mode.
4. Multiplayer: other visitors' walkers, as their chosen characters.
5. Packaging: the collider format written up, so other projects can generate physics from their own shapes.
