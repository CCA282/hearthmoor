# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This repo lives under `dev/games/`, sibling to `hamnet-village` (same author, same
Supabase project for identity). Auth is delegated to Supabase Auth — same project
as `hamnet-village`/`cine-planner`, but a separate concern (no shared table).

## Project status

**Early foundation, not yet a game.** What exists and works: project scaffold,
`net/` layer (Supabase client/auth/realtime rooms/generic save-load), a minimal
Three.js scene (semi-isometric camera, ground, fog, lighting), keyboard+gamepad
player movement + an edge-detected action button, a Lobby (local / create room /
join room by code), a Prairie-zone resource-gathering loop (harvest trees/rocks
into a discrete-item inventory, nodes deplete then respawn), and a HUD showing
the inventory + a harvest hint.

What does **not** exist yet, despite being in `docs/spec.md`: the other 3 zones
(Forêt sombre, Marais, Montagne), combat, equipment/crafting, buildings, any
actual scene state sync between host/guest (rooms connect via Presence but each
client currently renders its own unsynced local scene), and save/load of real
game state (`net/sync.js`'s `saveLocal`/`saveServer` are wired but nothing calls
them yet — there's no `serializeWorld`/`applyWorldState` equivalent, deferred
until the state above is worth persisting across sessions).

See `docs/spec.md` for the full v1 design spec and `docs/hamnet-village-tech-foundation.md`
for the technical patterns reused from `hamnet-village`. Keep this section in
sync with what actually exists, not with the aspirational spec.

## Commands

```bash
npm run dev       # dev server — talks directly to Supabase, no backend proxy
npm run build     # production build (use to verify correctness — no type-checker)
npm run preview   # serve the production build locally
npm run lint      # eslint src/
npm run test      # vitest — unit tests (src/tests/)
npm run test:e2e  # playwright — e2e tests (e2e/), starts its own dev server
```

After any change, run `npm run build` — after a change touching game logic or
`src/net/`, also run `npm run test`; after a UI/flow change, also run
`npm run test:e2e` (or at least the relevant spec file).

## Architecture (target — see docs/spec.md for full rationale)

**Hearthmoor** is a viking-themed co-op action/survival game, playable solo or
online (Supabase Realtime relays rooms, Postgres persists saves — no custom
backend). Frontend: Vue 3 + Vite. Unlike `hamnet-village` (2D canvas, top-down),
the game world renders in **3D low-poly via Three.js**, viewed from a **fixed
semi-isometric camera** (movement stays relative to the world, not the camera).

### Key differences from hamnet-village (see docs/hamnet-village-tech-foundation.md)

- Rendering: Three.js 3D scene instead of a 2D `<canvas>` context.
- World: one fixed, hand-designed map with 4 zones (Prairie, Forêt sombre, Marais,
  Montagne), not procedural.
- Gameplay: discrete stackable items + equipment slots (grid inventory), not
  global resource counters.
- Combat: latency-tolerant by design (telegraphed attacks, no client-side
  prediction in v1) — the host-authoritative networking model is unchanged from
  `hamnet-village`, see spec §7 for why.
- `net/` (Supabase client, auth, realtime rooms, save/load sync) is reused
  essentially unchanged from `hamnet-village`, just re-prefixed (`hearthmoor:room:`
  topics, `hearthmoor_worlds` table).

### File map

| Path | Role |
|------|------|
| `src/game/engine.js` | Singleton: RAF loop over `THREE.WebGLRenderer`, canvas resize, owns the `Input` instance |
| `src/game/scene/Scene.js` | `Scene` class (Three.js) — camera/ground/lights/fog setup + player mesh, equivalent of hamnet-village's `World.js` |
| `src/game/scene/camera.js` | Pure camera-follow math (no THREE/DOM) — unit-tested in isolation |
| `src/game/scene/movement.js` | Pure movement math (combine/clamp input vectors, step position) — unit-tested in isolation |
| `src/game/scene/resources.js` | Pure node logic: `findNearestNode`, `hitNode`, `tickNodeRespawn` — unit-tested in isolation |
| `src/game/input/index.js` | `Input` class — DOM/Gamepad API wiring only, delegates math to `keyboard.js`/`gamepad.js` |
| `src/game/input/keyboard.js`, `gamepad.js` | Pure functions: input state → world-space movement vector + edge-detected action press |
| `src/game/inventory.js` | Pure, immutable inventory ops (`addItem`/`removeItem`/`totalCount`/`isFull`) over a fixed-size slot array |
| `src/game/store.js` | `game` (Vue `reactive`) — the *only* reactive state (inventory mirror, hint text), same split as hamnet-village's `game`/`World` |
| `src/game/constants/*` | Declarative tuning data (camera, player speed, resource nodes, items) — no logic |
| `src/components/GameCanvas.vue` | Mounts the `<canvas>`, calls `engine.start()`/`stop()` |
| `src/components/Hud.vue` | Reads `game.inventory`/`game.hint`, purely presentational |
| `src/components/Lobby.vue` | Home screen: pseudo, local mode, create/join room |
| `src/net/*` | Supabase client, auth, room realtime relay (`hearthmoor:room:` prefix), generic save/load — ported from `hamnet-village` |

Testing convention established here (mirrors hamnet-village's `World.js` mixins
never being unit-tested directly, only their logic): anything that touches THREE
objects, the DOM, or the Gamepad API (`Scene.js`, `engine.js`, `input/index.js`)
is wiring-only and **not** unit tested — the math it depends on is extracted into
plain functions (`scene/camera.js`, `scene/movement.js`, `input/keyboard.js`,
`input/gamepad.js`) that are. Keep following this split as more systems
(combat, inventory...) get added.

### Tests

Same strategy as `hamnet-village` (see its `CLAUDE.md`/`docs/hamnet-village-tech-foundation.md`
§12 for the full rationale) — Vitest for pure logic and `net/*` with mocked
`localStorage`/`supabase`, Playwright e2e with a `window.__HEARTHMOOR_REALTIME_TEST_HOOK__`
hook so Realtime is never exercised for real in CI.
