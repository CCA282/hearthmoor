import { describe, it, expect } from 'vitest'
import { applyDamage, heal, isDead } from '../game/combat.js'

describe('applyDamage', () => {
  it('subtracts the amount from health', () => {
    expect(applyDamage(100, 15)).toBe(85)
  })

  it('never goes below 0', () => {
    expect(applyDamage(10, 999)).toBe(0)
  })

  it('exact-lethal damage results in 0, not negative', () => {
    expect(applyDamage(15, 15)).toBe(0)
  })
})

describe('heal', () => {
  it('adds the amount to health', () => {
    expect(heal(50, 20, 100)).toBe(70)
  })

  it('never exceeds maxHealth', () => {
    expect(heal(90, 50, 100)).toBe(100)
  })
})

describe('isDead', () => {
  it('is true at exactly 0', () => {
    expect(isDead(0)).toBe(true)
  })

  it('is true below 0 (defensive)', () => {
    expect(isDead(-5)).toBe(true)
  })

  it('is false above 0', () => {
    expect(isDead(1)).toBe(false)
  })
})
