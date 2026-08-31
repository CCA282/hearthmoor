import { keyboardMoveVector, keyboardActionPressed } from './keyboard.js'
import { gamepadMoveVector, gamepadActionPressed } from './gamepad.js'
import { combineMoveVectors, clampToUnit } from '../scene/movement.js'

// Browser-only wiring (DOM listeners, Gamepad API) — the actual math lives in
// pure, unit-tested functions (keyboard.js/gamepad.js/scene/movement.js).
export class Input {
  constructor() {
    this.keysDown = new Set()
    this._prevKeysDown = new Set()
    this._prevPad = null

    this._onKeyDown = (e) => this.keysDown.add(e.code)
    this._onKeyUp = (e) => this.keysDown.delete(e.code)
    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
  }

  _firstPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : []
    return pads[0] ?? null
  }

  moveVector() {
    const kb = keyboardMoveVector(this.keysDown)
    const pad = gamepadMoveVector(this._firstPad())
    return clampToUnit(combineMoveVectors(kb, pad))
  }

  actionPressed() {
    const kb = keyboardActionPressed(this.keysDown, this._prevKeysDown)
    const pad = gamepadActionPressed(this._firstPad(), this._prevPad)
    return kb || pad
  }

  // Called once per frame, after Scene.update() has read this frame's state —
  // snapshots it so the *next* frame's actionPressed() can edge-detect.
  endFrame() {
    this._prevKeysDown = new Set(this.keysDown)
    const pad = this._firstPad()
    this._prevPad = pad ? { buttons: Array.from(pad.buttons, (b) => ({ pressed: b.pressed })) } : null
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
  }
}
