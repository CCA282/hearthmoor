import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { engine } from './game/engine.js'
import { netState } from './net/netState.js'
import { game } from './game/store.js'

createApp(App).mount('#app')

// Expose state for E2E testing
window.__engine = engine
window.__netState = netState
window.__game = game
