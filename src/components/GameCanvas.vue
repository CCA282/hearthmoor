<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { engine } from '../game/engine.js'

const canvasEl = ref(null)

onMounted(() => engine.start(canvasEl.value))
onBeforeUnmount(() => engine.stop())
</script>

<template>
  <canvas ref="canvasEl" class="game-canvas" />
</template>

<style scoped>
.game-canvas {
  display: block;
  width: 100vw;
  height: 100vh;
}
</style>
