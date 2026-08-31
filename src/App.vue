<script setup>
import { computed } from 'vue'
import GameCanvas from './components/GameCanvas.vue'
import Hud from './components/Hud.vue'
import Lobby from './components/Lobby.vue'
import { netState } from './net/netState.js'

const inGame = computed(() => netState.mode !== null)
</script>

<template>
  <div class="stage">
    <Lobby />
    <template v-if="inGame">
      <GameCanvas />
      <Hud />
    </template>
  </div>
</template>

<style scoped>
.stage {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>
