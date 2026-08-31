<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { game } from '../game/store.js'
import { ITEMS } from '../game/constants/items.js'
import { netState } from '../net/netState.js'
import { engine } from '../game/engine.js'
import { saveLocal, saveServer } from '../net/sync.js'
import { leaveRoom } from '../net/realtime.js'

const stacks = computed(() => game.inventory.filter(Boolean))
const healthPct = computed(() => (game.maxHealth > 0 ? (game.health / game.maxHealth) * 100 : 0))
const equippedWeaponName = computed(() => {
  const id = game.equipment?.weapon
  return id ? ITEMS[id]?.name : null
})

// ── Save / autosave (mirrors hamnet-village's Hud.vue) ──────────────────────
// Where a save lives depends only on netState.user, never on local/host/guest.

const canSave = computed(() => netState.mode === 'local' || netState.mode === 'host')
const flashMsg = ref('')
let flashTimer = null

function flash(msg) {
  flashMsg.value = msg
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => { flashMsg.value = '' }, 2500)
}

async function triggerSave() {
  const id = netState.worldId || crypto.randomUUID()
  netState.worldId = id
  const snapshot = engine.scene.serializeSnapshot()
  if (netState.user) {
    try {
      const savedId = await saveServer(snapshot, id, netState.worldName)
      if (savedId) { netState.worldId = savedId; flash('Sauvegardé sur ton compte !') }
      else flash('Erreur de sauvegarde')
    } catch {
      flash('Erreur de sauvegarde')
    }
  } else {
    try {
      saveLocal(snapshot, id, netState.worldName)
      flash('Sauvegardé sur cet appareil !')
    } catch {
      flash('Erreur de sauvegarde')
    }
  }
}

const AUTOSAVE_INTERVAL_MS = 2 * 60 * 1000
let autosaveTimer = null
onMounted(() => {
  autosaveTimer = setInterval(() => {
    if (canSave.value) triggerSave()
  }, AUTOSAVE_INTERVAL_MS)
})
onUnmounted(() => clearInterval(autosaveTimer))

function quitToMenu() {
  if (netState.mode === 'host' || netState.mode === 'guest') leaveRoom()
  netState.mode = null
  netState.roomCode = null
  netState.connected = false
  netState.myPlayerId = null
}
</script>

<template>
  <div class="hud">
    <div class="inventory" v-if="stacks.length">
      <div class="slot" v-for="(s, i) in stacks" :key="i">
        {{ ITEMS[s.itemId].name }} × {{ s.count }}
      </div>
    </div>
    <div class="health-bar">
      <div class="health-fill" :style="{ width: healthPct + '%' }" />
      <span class="health-label">{{ Math.ceil(game.health) }} / {{ game.maxHealth }}</span>
    </div>
    <div class="equipped" v-if="equippedWeaponName">🪓 {{ equippedWeaponName }}</div>
    <div class="hint" v-if="game.hint">{{ game.hint }}</div>
    <div class="menu-bar">
      <button class="menu-btn" v-if="canSave" @pointerdown="triggerSave">💾 Sauvegarder</button>
      <button class="menu-btn" @pointerdown="quitToMenu">🚪 Quitter</button>
    </div>
    <div class="flash" v-if="flashMsg">{{ flashMsg }}</div>
  </div>
</template>

<style scoped>
.hud {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 10;
}

.inventory {
  position: absolute;
  top: 16px;
  left: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: rgba(18, 24, 28, 0.72);
  padding: 10px 14px;
  border-radius: 10px;
}
.slot {
  color: var(--moor-ink);
  font-weight: 700;
  font-size: 13px;
}

.health-bar {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 160px;
  height: 24px;
  background: rgba(18, 24, 28, 0.72);
  border-radius: 999px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.health-fill {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #a83a34, #e0736a);
  transition: width 0.15s;
}
.health-label {
  position: relative;
  font-size: 11px;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}

.equipped {
  position: absolute;
  top: 48px;
  right: 16px;
  background: rgba(18, 24, 28, 0.72);
  color: var(--moor-ink);
  font-weight: 700;
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 999px;
}

.hint {
  position: absolute;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(18, 24, 28, 0.72);
  color: var(--moor-fire);
  font-weight: 700;
  font-size: 13px;
  padding: 8px 16px;
  border-radius: 999px;
}

.menu-bar {
  position: absolute;
  bottom: 16px;
  right: 16px;
  display: flex;
  gap: 8px;
  pointer-events: auto;
}
.menu-btn {
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 700;
  border: none;
  border-radius: 999px;
  background: rgba(18, 24, 28, 0.72);
  color: var(--moor-ink);
  cursor: pointer;
}
.menu-btn:hover { background: rgba(18, 24, 28, 0.9); }

.flash {
  position: absolute;
  top: 80px;
  right: 16px;
  background: rgba(18, 24, 28, 0.85);
  color: var(--moor-fire);
  font-weight: 700;
  font-size: 12px;
  padding: 8px 14px;
  border-radius: 999px;
}
</style>
