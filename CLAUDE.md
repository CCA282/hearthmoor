# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This repo lives under `dev/games/`, sibling to `hamnet-village` (same author, same
Supabase project for identity). Auth is delegated to Supabase Auth — same project
as `hamnet-village`/`cine-planner`, but a separate concern (no shared table).

## Project status

**Early foundation, not yet a game — but the core action loop (move, gather,
fight, sync) now works.** What exists and works: project scaffold, `net/` layer
(Supabase client/auth/realtime rooms/generic save-load), a minimal Three.js
scene (semi-isometric camera, ground, fog, lighting), keyboard+gamepad player
movement + edge-detected action/attack buttons, a Lobby (local / create room /
join room by code), a Prairie-zone resource-gathering loop (harvest trees/rocks
into a discrete-item per-player inventory, nodes deplete then respawn), **basic
combat** (2 boars with a simple idle→chase→telegraphed-attack AI, player attack/
health/death+respawn-at-camp, meat loot on a kill), **a first equipment/crafting
loop** (a workbench in the Prairie zone, one recipe — 15 wood → `hache_bois` — auto-
equips into the `weapon` slot on craft, and an equipped weapon adds its
`damageBonus` on top of the base attack damage, see `equipment.js`/`crafting.js`),
a HUD showing inventory + health bar + equipped-weapon badge + a context hint
(harvest/craft/attack), **real host/guest state sync** covering all of the
above including equipment: the host simulates everyone (its own player from
real input, remote players from their last-received input, all enemies) and
broadcasts a snapshot ~30Hz; guests never simulate locally (no client-side
prediction, see `docs/spec.md` §7) and just apply whatever the host sends —
see `Scene.serializeSnapshot`/`applySnapshot`, `engine.js`'s `_tickHost`/`_tickGuest`.
There's also now **persistence for solo/host games**: a Sauvegarder button + a
2-minute autosave in the HUD, and a Nouvelle partie/Continuer choice in the
Lobby before starting locally — a save is just a `serializeSnapshot()` payload
(same shape as the network snapshot, `docs/spec.md` §12) round-tripped through
`net/sync.js` (localStorage or Postgres depending on `netState.user`, ported
unchanged from hamnet-village), and `engine.newGame(snapshot?)` is the one
place that resets to a fresh `Scene` and optionally replays a save onto it.
There's a Quitter button too, the first way to leave a game and return to the
Lobby at all. A first visual pass landed too: a low-poly player silhouette
(capsule + head, sharing a material via `mesh.userData.bodyMaterial` for cheap
recoloring — see `setLocalPlayerId`), a more detailed boar (legs/ears/tusks),
a small glowing campfire replacing the old placeholder cone, a hemisphere
light for a colder/warmer sky-ground grade, and a redesigned HUD (icon
inventory chips, layered health bar, toast) and Lobby (gradient card, ember
glow, room-code pulse). **No shadows** — a shadow-casting light needs its
shadow map redrawn every frame regardless of whether it moves (things move
every frame anyway), and that cost was enough to slow the render loop under
load, which throttles simulated game time too (`engine.js`'s dt clamp) and
broke attack-timing e2e tests — not worth it at this scale; revisit only with
a real profiling case for it.

What does **not** exist yet, despite being in `docs/spec.md`: the other 3 zones
(Forêt sombre, Marais, Montagne), the other 3 weapons and armor/tier progression
(currently a single weapon, tier 1 of 3, no armor slots at all), buildings, any
account/login UI (`net/accounts.js` is ported and unit-tested but nothing in
`src/components/` calls it, so `netState.user` is always null in practice and
every save currently goes to localStorage — the server path is wired and would
just start working once a login screen exists), and a way to load a save before
hosting an online room (only the local-play entry point offers Continuer;
`createRoom()` always starts fresh).

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
- Combat: latency-tolerant by design (telegraphed attacks — `ENEMY_ATTACK_WINDUP`
  in `constants/combat.js` — no client-side prediction), same reasoning already
  applied to movement/harvesting, see spec §7. The host-authoritative networking
  model itself is unchanged from `hamnet-village`. Equipment/weapon tiers are just
  getting started — one weapon (`hache_bois`, tier 1 of 3) craftable at a fixed
  workbench, auto-equips into `equipment.weapon` and adds a flat `damageBonus` on
  top of `PLAYER_ATTACK_DAMAGE` (see `equipment.js`); no armor slots yet.
- `net/` (Supabase client, auth, realtime rooms, save/load sync) is reused
  essentially unchanged from `hamnet-village`, just re-prefixed (`hearthmoor:room:`
  topics, `hearthmoor_worlds` table).

### File map

| Path | Role |
|------|------|
| `src/game/engine.js` | Singleton: RAF loop over `THREE.WebGLRenderer`, canvas resize, owns the `Input` instance, `newGame(snapshot?)` (fresh `Scene`, optionally replays a save) |
| `src/game/scene/Scene.js` | `Scene` class (Three.js) — camera/ground/lights/fog, multiplayer `players[]` (local + remote, each with inventory/health), resource nodes, enemies, snapshot serialize/apply. Equivalent of hamnet-village's `World.js` |
| `src/game/scene/camera.js` | Pure camera-follow math (no THREE/DOM) — unit-tested in isolation |
| `src/game/scene/movement.js` | Pure movement math (combine/clamp input vectors, step position) — unit-tested in isolation |
| `src/game/scene/resources.js` | Pure node logic: `findNearestNode`, `hitNode`, `tickNodeRespawn` — unit-tested in isolation |
| `src/game/scene/enemyAI.js` | Pure enemy state machine: `stepEnemy` (idle/chase/attackWindup/attackCooldown), `findNearestEnemy` — unit-tested in isolation |
| `src/game/input/index.js` | `Input` class — DOM/Gamepad API wiring only, delegates math to `keyboard.js`/`gamepad.js` |
| `src/game/input/keyboard.js`, `gamepad.js` | Pure functions: input state → world-space movement vector + edge-detected action/attack press |
| `src/game/inventory.js` | Pure, immutable inventory ops (`addItem`/`removeItem`/`totalCount`/`isFull`) over a fixed-size slot array |
| `src/game/combat.js` | Pure health ops (`applyDamage`/`heal`/`isDead`), bounded to `[0, max]` |
| `src/game/equipment.js` | Pure: `attackDamageFor(player)` (base + equipped weapon bonus), `equipItem(equipment, itemId)` |
| `src/game/crafting.js` | Pure: `canAffordRecipe`/`craftRecipe` over `constants/crafting.js`'s `RECIPES` |
| `src/game/store.js` | `game` (Vue `reactive`) — the *only* reactive state (inventory mirror, hint text, health/maxHealth, equipment mirror), same split as hamnet-village's `game`/`World` |
| `src/game/constants/*` | Declarative tuning data (camera, player speed, resource nodes, items, enemy spawns, combat) — no logic |
| `src/components/GameCanvas.vue` | Mounts the `<canvas>`, calls `engine.start()`/`stop()` |
| `src/components/Hud.vue` | Reads `game.inventory`/`game.hint`/`game.health`, purely presentational |
| `src/components/Lobby.vue` | Home screen: pseudo, local mode, create/join room — wires host (`onGuestJoined`/`onGuestLeft`/`onInput`) and guest (`onState`, `setLocalPlayerId`) to `Scene` |
| `src/net/*` | Supabase client, auth, room realtime relay (`hearthmoor:room:` prefix), generic save/load — ported from `hamnet-village` |

Testing convention: `THREE.Scene`/`Mesh`/`Geometry`/`Camera`/`Light` are plain JS
objects — they don't need a real browser/WebGL context to construct or update, so
`Scene.js` **is** unit-tested directly (`new Scene()` works fine under vitest's
`node` environment, see `src/tests/scene-snapshot.test.js`). Only `THREE.WebGLRenderer`
needs a real `<canvas>` — that's why `engine.js` (which owns the renderer) and
`input/index.js` (DOM listeners, `navigator.getGamepads()`) stay wiring-only,
untested directly, with their math extracted into plain functions
(`scene/camera.js`, `scene/movement.js`, `scene/resources.js`, `input/keyboard.js`,
`input/gamepad.js`) instead. Prefer testing pure extracted logic over `Scene`
methods when both are possible — it's faster and doesn't need a THREE instance —
but don't hesitate to construct a real `Scene` for orchestration-level behavior
(who gets created/removed, what gets synced) that doesn't reduce to one pure function.

### Tests

Same strategy as `hamnet-village` (see its `CLAUDE.md`/`docs/hamnet-village-tech-foundation.md`
§12 for the full rationale) — Vitest for pure logic and `net/*` with mocked
`localStorage`/`supabase`, Playwright e2e with a `window.__HEARTHMOOR_REALTIME_TEST_HOOK__`
hook so Realtime is never exercised for real in CI.
