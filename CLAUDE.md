# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This repo lives under `dev/games/`, sibling to `hamnet-village` (same author, same
Supabase project for identity). Auth is delegated to Supabase Auth — same project
as `hamnet-village`/`cine-planner`, but a separate concern (no shared table).

## Project status

**Bootstrapping.** See `docs/spec.md` for the full v1 design spec (agreed with the
user) and `docs/hamnet-village-tech-foundation.md` for the technical patterns this
project reuses from `hamnet-village`. This section will be replaced by the real
architecture doc as things get built — keep it in sync with what actually exists,
not with the aspirational spec.

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

### File map (fills in as built)

| Path | Role |
|------|------|
| `src/game/engine.js` | Singleton: RAF loop, canvas resize, input↔scene bridge |
| `src/game/scene/Scene.js` | `Scene` class shell (Three.js) — equivalent of hamnet-village's `World.js` |
| `src/net/*` | Supabase client, auth, room realtime relay, save/load — ported from `hamnet-village` |

### Tests

Same strategy as `hamnet-village` (see its `CLAUDE.md`/`docs/hamnet-village-tech-foundation.md`
§12 for the full rationale) — Vitest for pure logic and `net/*` with mocked
`localStorage`/`supabase`, Playwright e2e with a `window.__HEARTHMOOR_REALTIME_TEST_HOOK__`
hook so Realtime is never exercised for real in CI.
