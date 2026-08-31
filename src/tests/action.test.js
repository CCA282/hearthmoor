import { describe, it, expect } from 'vitest'
import { keyboardActionPressed } from '../game/input/keyboard.js'
import { gamepadActionPressed } from '../game/input/gamepad.js'

describe('keyboardActionPressed', () => {
  it('is true the first frame the key goes down', () => {
    expect(keyboardActionPressed(new Set(['Space']), new Set())).toBe(true)
  })

  it('is false while the key stays held', () => {
    expect(keyboardActionPressed(new Set(['Space']), new Set(['Space']))).toBe(false)
  })

  it('is false when the key is not pressed at all', () => {
    expect(keyboardActionPressed(new Set(), new Set())).toBe(false)
  })

  it('accepts KeyE as an alternate action key', () => {
    expect(keyboardActionPressed(new Set(['KeyE']), new Set())).toBe(true)
  })

  it('is false the frame after release', () => {
    expect(keyboardActionPressed(new Set(), new Set(['Space']))).toBe(false)
  })
})

describe('gamepadActionPressed', () => {
  function pad(pressed) {
    return { buttons: [{ pressed }] }
  }

  it('is true the first frame button 0 goes down', () => {
    expect(gamepadActionPressed(pad(true), pad(false))).toBe(true)
  })

  it('is false while button 0 stays held', () => {
    expect(gamepadActionPressed(pad(true), pad(true))).toBe(false)
  })

  it('is false when there is no pad', () => {
    expect(gamepadActionPressed(null, null)).toBe(false)
  })

  it('treats a null prevPad (pad just connected) as "was not pressed"', () => {
    expect(gamepadActionPressed(pad(true), null)).toBe(true)
  })
})
