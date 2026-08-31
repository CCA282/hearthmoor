import { describe, it, expect } from 'vitest'
import { keyboardMoveVector } from '../game/input/keyboard.js'
import { gamepadMoveVector } from '../game/input/gamepad.js'
import { combineMoveVectors, clampToUnit, stepPosition } from '../game/scene/movement.js'

describe('keyboardMoveVector', () => {
  it('returns zero when nothing is pressed', () => {
    expect(keyboardMoveVector(new Set())).toEqual({ x: 0, z: 0 })
  })

  it('W/ArrowUp moves toward -z', () => {
    expect(keyboardMoveVector(new Set(['KeyW']))).toEqual({ x: 0, z: -1 })
    expect(keyboardMoveVector(new Set(['ArrowUp']))).toEqual({ x: 0, z: -1 })
  })

  it('S/ArrowDown moves toward +z', () => {
    expect(keyboardMoveVector(new Set(['KeyS']))).toEqual({ x: 0, z: 1 })
  })

  it('A moves toward -x, D moves toward +x', () => {
    expect(keyboardMoveVector(new Set(['KeyA']))).toEqual({ x: -1, z: 0 })
    expect(keyboardMoveVector(new Set(['KeyD']))).toEqual({ x: 1, z: 0 })
  })

  it('opposite keys cancel out', () => {
    expect(keyboardMoveVector(new Set(['KeyA', 'KeyD']))).toEqual({ x: 0, z: 0 })
  })

  it('diagonal input is not pre-normalized (length √2)', () => {
    const v = keyboardMoveVector(new Set(['KeyW', 'KeyD']))
    expect(v).toEqual({ x: 1, z: -1 })
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(Math.SQRT2)
  })
})

describe('gamepadMoveVector', () => {
  it('returns zero when no pad is connected', () => {
    expect(gamepadMoveVector(null)).toEqual({ x: 0, z: 0 })
    expect(gamepadMoveVector(undefined)).toEqual({ x: 0, z: 0 })
  })

  it('reads the left stick axes', () => {
    const pad = { axes: [0.8, -0.6], buttons: [] }
    const v = gamepadMoveVector(pad)
    expect(v.x).toBeCloseTo(0.8)
    expect(v.z).toBeCloseTo(-0.6)
  })

  it('applies a dead zone below 0.2', () => {
    const pad = { axes: [0.1, -0.15], buttons: [] }
    expect(gamepadMoveVector(pad)).toEqual({ x: 0, z: 0 })
  })

  it('d-pad buttons override the stick to a full push', () => {
    const buttons = Array(16).fill({ pressed: false })
    buttons[15] = { pressed: true } // right
    const pad = { axes: [0, 0], buttons }
    expect(gamepadMoveVector(pad)).toEqual({ x: 1, z: 0 })
  })
})

describe('combineMoveVectors / clampToUnit', () => {
  it('combines two vectors additively', () => {
    expect(combineMoveVectors({ x: 1, z: 0 }, { x: 0.5, z: -1 })).toEqual({ x: 1.5, z: -1 })
  })

  it('clampToUnit leaves short vectors untouched (partial analog push)', () => {
    expect(clampToUnit({ x: 0.5, z: 0 })).toEqual({ x: 0.5, z: 0 })
  })

  it('clampToUnit rescales vectors longer than 1 down to length 1', () => {
    const v = clampToUnit({ x: 1, z: 1 }) // length √2
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(1)
    expect(v.x).toBeCloseTo(v.z)
  })

  it('clampToUnit leaves the zero vector untouched', () => {
    expect(clampToUnit({ x: 0, z: 0 })).toEqual({ x: 0, z: 0 })
  })
})

describe('stepPosition', () => {
  it('moves position by direction * speed * dt, preserving y', () => {
    const pos = stepPosition({ x: 0, y: 0.9, z: 0 }, { x: 1, z: 0 }, 6, 0.5)
    expect(pos).toEqual({ x: 3, y: 0.9, z: 0 })
  })

  it('does not move when direction is zero', () => {
    const pos = stepPosition({ x: 5, y: 0, z: 5 }, { x: 0, z: 0 }, 6, 0.5)
    expect(pos).toEqual({ x: 5, y: 0, z: 5 })
  })

  it('moves diagonally when direction has both components', () => {
    const pos = stepPosition({ x: 0, y: 0, z: 0 }, { x: 1, z: -1 }, 2, 1)
    expect(pos).toEqual({ x: 2, y: 0, z: -2 })
  })
})
