<script setup>
import { ref, computed, watch } from 'vue'
import { netState } from '../net/netState.js'
import { createRoomAsHost, joinRoomAsGuest, leaveRoom, onHostLeft, onDisconnected } from '../net/realtime.js'

// ── State ─────────────────────────────────────────────────────────────────────

const step = ref('home')        // home | online | join | waiting_players
const error = ref('')
const busy = ref(false)
const roomCodeInput = ref('')
const displayCode = ref('')

// ── Navigation ────────────────────────────────────────────────────────────────

function goHome() { step.value = 'home'; error.value = ''; displayCode.value = ''; busy.value = false }
watch(() => netState.mode, (v) => { if (v === null) goHome() })

function startLocal() {
  netState.mode = 'local'
}

function goOnline() { step.value = 'online'; error.value = '' }

// ── Online host ───────────────────────────────────────────────────────────────

async function createRoom() {
  error.value = ''; busy.value = true
  try {
    onDisconnected(() => { netState.connected = false })
    const { code } = await createRoomAsHost()
    netState.connected = true
    displayCode.value = code
    netState.roomCode = code
    netState.mode = 'host'
    step.value = 'waiting_players'
  } catch {
    error.value = 'Impossible de se connecter au serveur'
    leaveRoom()
  }
  busy.value = false
}

// ── Online guest ──────────────────────────────────────────────────────────────

async function joinRoom() {
  const code = roomCodeInput.value.trim().toUpperCase()
  if (code.length !== 6) { error.value = 'Code invalide (6 caractères)'; return }
  error.value = ''; busy.value = true
  try {
    onHostLeft(() => { error.value = "L'hôte a quitté la partie" })
    onDisconnected(() => { netState.connected = false })
    await joinRoomAsGuest(code, netState.playerName.trim() || null)
    netState.connected = true
    netState.roomCode = code
    netState.mode = 'guest'
  } catch (e) {
    error.value = e.message || 'Impossible de se connecter au serveur'
    leaveRoom()
  }
  busy.value = false
}

const playing = computed(() => netState.mode !== null && step.value !== 'waiting_players')
</script>

<template>
  <transition name="lobby-fade">
    <div class="lobby" v-if="!playing">
      <div class="card" v-if="step === 'home'">
        <h1 class="title">🏚️ Hearthmoor</h1>
        <p class="sub">Aventure/survie coopérative — camp, exploration, combat</p>
        <div class="name-field">
          <label class="name-label">Votre pseudo</label>
          <input
            class="name-input"
            v-model="netState.playerName"
            placeholder="Joueur…"
            maxlength="12"
            spellcheck="false"
          />
        </div>
        <div class="actions">
          <button class="btn primary" @pointerdown="startLocal">🌲 Jouer en local</button>
          <button class="btn" @pointerdown="goOnline">🌐 Jouer en ligne</button>
        </div>
      </div>

      <div class="card" v-else-if="step === 'online'">
        <h2>Jouer en ligne</h2>
        <div class="actions">
          <button class="btn primary" :disabled="busy" @pointerdown="createRoom">🏕️ Créer une room</button>
          <button class="btn" @pointerdown="step = 'join'">🔑 Rejoindre une room</button>
        </div>
        <p class="err" v-if="error">{{ error }}</p>
        <button class="back" @pointerdown="goHome">← Retour</button>
      </div>

      <div class="card" v-else-if="step === 'join'">
        <h2>Rejoindre une room</h2>
        <input
          class="code-input"
          v-model="roomCodeInput"
          placeholder="CODE (6 lettres)"
          maxlength="6"
          spellcheck="false"
          @keydown.enter="joinRoom"
        />
        <div class="actions">
          <button class="btn primary" :disabled="busy" @pointerdown="joinRoom">Rejoindre</button>
        </div>
        <p class="err" v-if="error">{{ error }}</p>
        <button class="back" @pointerdown="step = 'online'">← Retour</button>
      </div>

      <div class="card" v-else-if="step === 'waiting_players'">
        <h2>Room créée</h2>
        <p class="sub">Partagez ce code avec vos amis :</p>
        <div class="room-code">{{ displayCode }}</div>
        <div class="actions">
          <button class="btn primary" @pointerdown="step = 'playing'">🎮 Jouer !</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.lobby {
  position: fixed;
  inset: 0;
  background: radial-gradient(circle at 50% 30%, #1d2a2e 0%, #12181c 70%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.card {
  background: var(--moor-panel);
  border: 2px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
  padding: 36px 40px 30px;
  min-width: 320px;
  max-width: 420px;
  width: 90vw;
  display: flex;
  flex-direction: column;
  gap: 18px;
  align-items: center;
  text-align: center;
  color: var(--moor-ink);
}

.title { margin: 0; font-size: 32px; }
h2 { margin: 0; font-size: 20px; }
.sub { margin: 0; font-size: 14px; color: var(--moor-ink-soft); }

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.btn {
  width: 100%;
  padding: 14px;
  font-size: 16px;
  font-weight: 800;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  background: var(--moor-panel-dark);
  color: var(--moor-ink);
  transition: transform 0.08s, opacity 0.08s;
}
.btn:hover { transform: translateY(-1px); }
.btn:active { transform: translateY(1px); }
.btn.primary {
  background: var(--moor-fire);
  color: #2a1608;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.name-field {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: flex-start;
}
.name-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--moor-ink-soft);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.name-input, .code-input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  font-size: 17px;
  font-weight: 700;
  text-align: center;
  border: 2px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: var(--moor-panel-dark);
  color: var(--moor-ink);
  outline: none;
}
.name-input:focus, .code-input:focus { border-color: var(--moor-fire); }
.code-input { letter-spacing: 8px; text-transform: uppercase; }

.room-code {
  font-size: 40px;
  font-weight: 900;
  letter-spacing: 10px;
  color: var(--moor-fire);
  background: var(--moor-panel-dark);
  border-radius: 12px;
  padding: 14px 20px;
  width: 100%;
  box-sizing: border-box;
  text-align: center;
}

.err { color: #e0736a; font-size: 13px; font-weight: 700; }

.back {
  background: none;
  border: none;
  color: var(--moor-ink-soft);
  font-size: 13px;
  cursor: pointer;
  padding: 4px 8px;
  align-self: flex-start;
}
.back:hover { color: var(--moor-ink); }

.lobby-fade-enter-active, .lobby-fade-leave-active { transition: opacity 0.4s; }
.lobby-fade-enter-from, .lobby-fade-leave-to { opacity: 0; }
</style>
