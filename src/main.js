import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { engine } from './game/engine.js'
import { netState } from './net/netState.js'

createApp(App).mount('#app')

// Expose state for E2E testing
window.__engine = engine
window.__netState = netState
