import * as THREE from 'three'
import { Scene } from './scene/Scene.js'
import { Input } from './input/index.js'

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

      this.scene.update(dt, this.input)
      this.renderer.render(this.scene.three, this.scene.camera)

      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
    if (this._resizeObs) { this._resizeObs.disconnect(); this._resizeObs = null }
  }
}

export const engine = new Engine()
