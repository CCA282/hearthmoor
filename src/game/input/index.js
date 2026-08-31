import { keyboardMoveVector } from './keyboard.js'
import { gamepadMoveVector } from './gamepad.js'
import { combineMoveVectors, clampToUnit } from '../scene/movement.js'

// Browser-only wiring (DOM listeners, Gamepad API) — the actual math lives in
// pure, unit-tested functions (keyboard.js/gamepad.js/scene/movement.js).
export class Input {
  constructor() {
    this.keysDown = new Set()
    this._onKeyDown = (e) => this.keysDown.add(e.code)
    this._onKeyUp = (e) => this.keysDown.delete(e.code)
    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
  }

  moveVector() {
    const kb = keyboardMoveVector(this.keysDown)
    const pads = navigator.getGamepads ? navigator.getGamepads() : []
    const pad = gamepadMoveVector(pads[0])
    return clampToUnit(combineMoveVectors(kb, pad))
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
  }
}
