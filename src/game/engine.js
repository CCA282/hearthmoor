import * as THREE from 'three'
import { Scene } from './scene/Scene.js'
import { Input } from './input/index.js'
import { netState } from '../net/netState.js'
import { broadcastState, sendInput } from '../net/realtime.js'

const SYNC_INTERVAL = 0.033 // ~30Hz, same cadence as hamnet-village

class Engine {
  constructor() {
    this.scene = new Scene()
    this.input = new Input()
    this.renderer = null
    this.canvas = null
    this.raf = 0
    this.last = 0
    this.running = false
    this._resizeObs = null
    this._syncTimer = 0
    this._inputTimer = 0
    this._pendingAction = false
    this._pendingAttack = false
  }

  _resize() {
    if (!this.canvas || !this.renderer) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    this.scene.setAspect(w / h)
  }

  start(canvas) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })

    this._resize()
    this._resizeObs = new ResizeObserver(() => this._resize())
    this._resizeObs.observe(canvas)

    this.running = true
    this.last = performance.now()
    const loop = (now) => {
      if (!this.running) return
      let dt = (now - this.last) / 1000
      this.last = now
      if (dt > 0.05) dt = 0.05

      if (netState.mode === 'guest') {
        this._tickGuest(dt)
      } else {
        this.scene.update(dt, this.input)
        if (netState.mode === 'host') this._tickHost(dt)
      }

      this.renderer.render(this.scene.three, this.scene.camera)
      this.input.endFrame()

      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  // Host: broadcast a full state snapshot ~30Hz. The host itself keeps
  // simulating everyone (its own player from real input, remote players from
  // their last-received remoteInput) via the normal scene.update() above.
  _tickHost(dt) {
    this._syncTimer += dt
    if (this._syncTimer >= SYNC_INTERVAL) {
      this._syncTimer = 0
      broadcastState(this.scene.serializeSnapshot())
    }
  }

  // Guest: never simulates locally (docs/spec.md §7 — no client-side
  // prediction) — just buffers input between sends (so a tap between two
  // 33ms ticks isn't lost) and applies whatever state the host broadcasts.
  _tickGuest(dt) {
    if (this.input.actionPressed()) this._pendingAction = true
    if (this.input.attackPressed()) this._pendingAttack = true

    this._inputTimer += dt
    if (this._inputTimer >= SYNC_INTERVAL) {
      this._inputTimer = 0
      const dir = this.input.moveVector()
      sendInput({ mx: dir.x, mz: dir.z, action: this._pendingAction, attack: this._pendingAttack })
      this._pendingAction = false
      this._pendingAttack = false
    }
    this.scene.updateGuestVisuals(dt)
  }

  applySnapshot(snap) {
    this.scene.applySnapshot(snap)
  }

  // Starts a fresh game — used both for "new game" (no snapshot) and for
  // "continue" (a snapshot loaded from localStorage/Postgres, same shape as
  // the network sync snapshot, see docs/spec.md §12). Replaces `this.scene`
  // outright rather than mutating the existing one so a stale in-progress
  // game (dead enemies, depleted nodes...) never bleeds into the next one.
  newGame(snapshot = null) {
    this.scene = new Scene()
    if (snapshot) this.scene.applySnapshot(snapshot)
    this._syncTimer = 0
    this._inputTimer = 0
    this._pendingAction = false
    this._pendingAttack = false
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
    if (this._resizeObs) { this._resizeObs.disconnect(); this._resizeObs = null }
  }
}

export const engine = new Engine()
