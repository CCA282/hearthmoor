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
      <div class="inv-label">Inventaire</div>
      <div class="inv-grid">
        <div class="chip" v-for="(s, i) in stacks" :key="i" :title="ITEMS[s.itemId].name">
          <span class="chip-icon">{{ ITEMS[s.itemId].icon }}</span>
          <span class="chip-count">{{ s.count }}</span>
        </div>
      </div>
    </div>

    <div class="status">
      <div class="health-bar" :class="{ low: healthPct <= 30 }">
        <span class="health-icon">❤️</span>
        <div class="health-track">
          <div class="health-fill" :style="{ width: healthPct + '%' }" />
        </div>
        <span class="health-label">{{ Math.ceil(game.health) }} / {{ game.maxHealth }}</span>
      </div>
      <div class="equipped" v-if="equippedWeaponName">
        <span class="chip-icon">{{ ITEMS[game.equipment.weapon].icon }}</span>
        {{ equippedWeaponName }}
      </div>
    </div>

    <div class="hint" v-if="game.hint">{{ game.hint }}</div>

    <div class="menu-bar">
      <button class="menu-btn" v-if="canSave" @pointerdown="triggerSave">💾 Sauvegarder</button>
      <button class="menu-btn quit" @pointerdown="quitToMenu">🚪 Quitter</button>
    </div>

    <transition name="flash-pop">
      <div class="flash" v-if="flashMsg">{{ flashMsg }}</div>
    </transition>
  </div>
</template>

<style scoped>
.hud {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  font-family: inherit;
}

.inventory {
  position: absolute;
  top: 16px;
  left: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: linear-gradient(180deg, rgba(29, 42, 46, 0.82), rgba(18, 24, 28, 0.82));
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
  padding: 10px 12px;
  border-radius: 14px;
  backdrop-filter: blur(2px);
}
.inv-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--moor-ink-soft);
  padding: 0 2px;
}
.inv-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.chip {
  position: relative;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--moor-panel-dark);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 9px;
  font-size: 18px;
}
.chip-icon { line-height: 1; }
.chip-count {
  position: absolute;
  bottom: -3px;
  right: -3px;
  min-width: 16px;
  padding: 1px 4px;
  font-size: 10px;
  font-weight: 800;
  text-align: center;
  color: #fff;
  background: var(--moor-fire);
  border-radius: 999px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

.status {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.health-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 190px;
  height: 30px;
  background: linear-gradient(180deg, rgba(29, 42, 46, 0.82), rgba(18, 24, 28, 0.82));
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
  border-radius: 999px;
  padding: 0 10px;
}
.health-bar.low .health-fill { animation: pulse-low 1s ease-in-out infinite; }
.health-icon { font-size: 13px; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5)); }
.health-track {
  position: relative;
  flex: 1;
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.35);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);
}
.health-fill {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #a83a34, #e0736a);
  transition: width 0.15s;
}
.health-label {
  font-size: 11px;
  font-weight: 800;
  color: var(--moor-ink);
  white-space: nowrap;
}

.equipped {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(18, 24, 28, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--moor-ink);
  font-weight: 700;
  font-size: 12px;
  padding: 5px 12px;
  border-radius: 999px;
}
.equipped .chip-icon { font-size: 14px; }

.hint {
  position: absolute;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(18, 24, 28, 0.82);
  border: 1px solid rgba(232, 151, 74, 0.35);
  color: var(--moor-fire);
  font-weight: 700;
  font-size: 13px;
  padding: 8px 16px;
  border-radius: 999px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
  animation: hint-in 0.15s ease-out;
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
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(18, 24, 28, 0.78);
  color: var(--moor-ink);
  cursor: pointer;
  transition: transform 0.08s, background 0.12s;
}
.menu-btn:hover { background: rgba(18, 24, 28, 0.95); transform: translateY(-1px); }
.menu-btn:active { transform: translateY(1px); }
.menu-btn.quit:hover { color: #e0736a; }

.flash {
  position: absolute;
  top: 80px;
  right: 16px;
  background: rgba(18, 24, 28, 0.9);
  border: 1px solid rgba(232, 151, 74, 0.35);
  color: var(--moor-fire);
  font-weight: 700;
  font-size: 12px;
  padding: 8px 14px;
  border-radius: 999px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
}
.flash-pop-enter-active { transition: opacity 0.15s, transform 0.15s; }
.flash-pop-leave-active { transition: opacity 0.4s; }
.flash-pop-enter-from { opacity: 0; transform: translateY(-6px); }
.flash-pop-leave-to { opacity: 0; }

@keyframes hint-in {
  from { opacity: 0; transform: translate(-50%, 4px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
@keyframes pulse-low {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.35); }
}
</style>
