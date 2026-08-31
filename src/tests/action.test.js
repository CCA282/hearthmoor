import { describe, it, expect } from 'vitest'
import { keyboardActionPressed, keyboardAttackPressed } from '../game/input/keyboard.js'
import { gamepadActionPressed, gamepadAttackPressed } from '../game/input/gamepad.js'

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

describe('keyboardAttackPressed', () => {
  it('is true the first frame KeyF goes down', () => {
    expect(keyboardAttackPressed(new Set(['KeyF']), new Set())).toBe(true)
  })

  it('is false while held', () => {
    expect(keyboardAttackPressed(new Set(['KeyF']), new Set(['KeyF']))).toBe(false)
  })

  it('does not fire on the interact key (Space/E stay a separate button)', () => {
    expect(keyboardAttackPressed(new Set(['Space']), new Set())).toBe(false)
  })
})

describe('gamepadAttackPressed', () => {
  function padWithButton(index, pressed) {
    const buttons = Array(6).fill({ pressed: false })
    buttons[index] = { pressed }
    return { buttons }
  }

  it('is true the first frame button 2 (X) goes down', () => {
    expect(gamepadAttackPressed(padWithButton(2, true), padWithButton(2, false))).toBe(true)
  })

  it('is false while held', () => {
    expect(gamepadAttackPressed(padWithButton(2, true), padWithButton(2, true))).toBe(false)
  })

  it('does not fire on button 0 (interact stays a separate button)', () => {
    expect(gamepadAttackPressed(padWithButton(0, true), padWithButton(0, false))).toBe(false)
  })
})
