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

The scene supplies shapes through one adapter (`sceneShapes(kFrom, kTo)` in `index.html`): ledge outlines, rock
pinnacles, the gorge walls and the bridge decks. Painting and physics read the same geometry functions.

Units are scene units (y down, as the canvas draws). Colliders are generated lazily per ledge index `k`, like the
painting.

## Phases (each ends with a look from Nikhil)

1. Colliders from the scene's shapes, with a debug overlay (`?debug=colliders`) drawing them over the painting.
2. Free movement and jumping in full-screen play mode, keyboard (WASD / arrows / Space), with the rig's walk, turn,
   jump and fall.
3. Camera that follows freely, the world below the route, phone controls, bridges fully built in play mode.
4. Multiplayer: other visitors' walkers, as their chosen characters.
5. Packaging: the collider format written up, so other projects can generate physics from their own shapes.
