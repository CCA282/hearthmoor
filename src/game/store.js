import { reactive } from 'vue'
import { PLAYER_MAX_HEALTH } from './constants/combat.js'

// The only Vue-reactive object — mirrors just enough of Scene's state for the
// UI to react to. Everything else (positions, node hp, timers...) stays plain
// JS inside Scene, non-reactive on purpose (same split as hamnet-village's
// `game`/`World` — see docs/hamnet-village-tech-foundation.md §3).
export const game = reactive({
  inventory: [],
  hint: '',
  health: PLAYER_MAX_HEALTH,
  maxHealth: PLAYER_MAX_HEALTH,
})
