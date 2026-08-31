import { describe, it, expect } from 'vitest'
import { attackDamageFor, equipItem } from '../game/equipment.js'
import { PLAYER_ATTACK_DAMAGE } from '../game/constants/combat.js'

describe('attackDamageFor', () => {
  it('returns the base damage when nothing is equipped', () => {
    expect(attackDamageFor({ equipment: { weapon: null } })).toBe(PLAYER_ATTACK_DAMAGE)
  })

  it('returns the base damage when equipment is missing entirely', () => {
    expect(attackDamageFor({})).toBe(PLAYER_ATTACK_DAMAGE)
  })

  it('adds the equipped weapon damage bonus', () => {
    const dmg = attackDamageFor({ equipment: { weapon: 'hache_bois' } })
    expect(dmg).toBe(PLAYER_ATTACK_DAMAGE + 10)
  })

  it('ignores an unknown/invalid weapon id gracefully', () => {
    expect(attackDamageFor({ equipment: { weapon: 'not-a-real-item' } })).toBe(PLAYER_ATTACK_DAMAGE)
  })
})

describe('equipItem', () => {
  it('equips a weapon into the weapon slot', () => {
    const eq = equipItem({ weapon: null }, 'hache_bois')
    expect(eq).toEqual({ weapon: 'hache_bois' })
  })

  it('does not mutate the input equipment object', () => {
    const original = { weapon: null }
    equipItem(original, 'hache_bois')
    expect(original).toEqual({ weapon: null })
  })

  it('replaces whatever was previously equipped in that slot', () => {
    const eq = equipItem({ weapon: 'hache_bois' }, 'hache_bois')
    expect(eq.weapon).toBe('hache_bois')
  })

  it('is a no-op for an item with no slot (not equippable)', () => {
    const original = { weapon: null }
    const eq = equipItem(original, 'wood')
    expect(eq).toBe(original)
  })
})
