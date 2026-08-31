<script setup>
import { computed } from 'vue'
import { game } from '../game/store.js'
import { ITEMS } from '../game/constants/items.js'

const stacks = computed(() => game.inventory.filter(Boolean))
</script>

<template>
  <div class="hud">
    <div class="inventory" v-if="stacks.length">
      <div class="slot" v-for="(s, i) in stacks" :key="i">
        {{ ITEMS[s.itemId].name }} × {{ s.count }}
      </div>
    </div>
    <div class="hint" v-if="game.hint">{{ game.hint }}</div>
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
</style>
