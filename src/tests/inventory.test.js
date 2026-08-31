import { describe, it, expect } from 'vitest'
import { createInventory, addItem, removeItem, totalCount, isFull, INVENTORY_SIZE } from '../game/inventory.js'

describe('createInventory', () => {
  it('creates the default size, all empty slots', () => {
    const inv = createInventory()
    expect(inv).toHaveLength(INVENTORY_SIZE)
    expect(inv.every((s) => s === null)).toBe(true)
  })

  it('accepts a custom size', () => {
    expect(createInventory(4)).toHaveLength(4)
  })
})

describe('addItem', () => {
  it('adds to an empty inventory, filling the first empty slot', () => {
    const { inventory, added, overflow } = addItem(createInventory(4), 'wood', 3)
    expect(added).toBe(3)
    expect(overflow).toBe(0)
    expect(inventory[0]).toEqual({ itemId: 'wood', count: 3 })
    expect(inventory[1]).toBeNull()
  })

  it('stacks onto an existing slot of the same item below max', () => {
    let inv = addItem(createInventory(4), 'wood', 5).inventory
    inv = addItem(inv, 'wood', 4).inventory
    expect(inv[0]).toEqual({ itemId: 'wood', count: 9 })
    expect(inv[1]).toBeNull()
  })

  it('overflows into a new slot once the current stack hits maxStack', () => {
    const inv = addItem(createInventory(4), 'wood', 20).inventory // wood maxStack = 20
    const { inventory } = addItem(inv, 'wood', 5)
    expect(inventory[0]).toEqual({ itemId: 'wood', count: 20 })
    expect(inventory[1]).toEqual({ itemId: 'wood', count: 5 })
  })

  it('reports overflow when every slot is full', () => {
    let inv = createInventory(1)
    inv = addItem(inv, 'wood', 20).inventory // fills the only slot to max
    const { inventory, added, overflow } = addItem(inv, 'wood', 5)
    expect(added).toBe(0)
    expect(overflow).toBe(5)
    expect(inventory[0]).toEqual({ itemId: 'wood', count: 20 })
  })

  it('does not mutate the input inventory (immutable)', () => {
    const original = createInventory(2)
    addItem(original, 'wood', 1)
    expect(original[0]).toBeNull()
  })

  it('keeps different item types in separate slots', () => {
    let inv = addItem(createInventory(4), 'wood', 2).inventory
    inv = addItem(inv, 'stone', 3).inventory
    expect(inv[0]).toEqual({ itemId: 'wood', count: 2 })
    expect(inv[1]).toEqual({ itemId: 'stone', count: 3 })
  })
})

describe('removeItem', () => {
  it('removes from a stack, keeping the slot if some remain', () => {
    const withWood = addItem(createInventory(4), 'wood', 5).inventory
    const { inventory, removed } = removeItem(withWood, 'wood', 2)
    expect(removed).toBe(2)
    expect(inventory[0]).toEqual({ itemId: 'wood', count: 3 })
  })

  it('clears the slot entirely when count drops to zero', () => {
    const withWood = addItem(createInventory(4), 'wood', 3).inventory
    const { inventory } = removeItem(withWood, 'wood', 3)
    expect(inventory[0]).toBeNull()
  })

  it('removes across multiple slots of the same item if needed', () => {
    let inv = addItem(createInventory(4), 'wood', 20).inventory
    inv = addItem(inv, 'wood', 5).inventory // slot0=20, slot1=5
    const { inventory, removed } = removeItem(inv, 'wood', 22)
    expect(removed).toBe(22)
    expect(inventory[0]).toBeNull()
    expect(inventory[1]).toEqual({ itemId: 'wood', count: 3 })
  })

  it('reports a partial removal when there is less than requested', () => {
    const withWood = addItem(createInventory(4), 'wood', 2).inventory
    const { removed } = removeItem(withWood, 'wood', 10)
    expect(removed).toBe(2)
  })
})

describe('totalCount', () => {
  it('sums across multiple slots of the same item', () => {
    let inv = addItem(createInventory(4), 'wood', 20).inventory
    inv = addItem(inv, 'wood', 7).inventory
    expect(totalCount(inv, 'wood')).toBe(27)
  })

  it('returns 0 for an item not present', () => {
    expect(totalCount(createInventory(), 'stone')).toBe(0)
  })
})

describe('isFull', () => {
  it('is false on an empty inventory', () => {
    expect(isFull(createInventory(2))).toBe(false)
  })

  it('is true once every slot holds a stack', () => {
    let inv = addItem(createInventory(2), 'wood', 20).inventory
    inv = addItem(inv, 'stone', 20).inventory
    expect(isFull(inv)).toBe(true)
  })
})
