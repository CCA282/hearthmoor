<script setup>
import GameCanvas from './components/GameCanvas.vue'
</script>

<template>
  <div class="stage">
    <GameCanvas />
  </div>
</template>

<style scoped>
.stage {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>
