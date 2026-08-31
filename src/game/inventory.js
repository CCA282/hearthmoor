import { ITEMS } from './constants/items.js'

export const INVENTORY_SIZE = 16

// A slot is either `null` (empty) or `{ itemId, count }`.
export function createInventory(size = INVENTORY_SIZE) {
  return Array.from({ length: size }, () => null)
}

// Immutable — returns a new inventory array rather than mutating `inventory`,
// consistent with how Scene.js already treats player.position (see movement.js).
// Fills existing stacks of the same item first, then empty slots.
export function addItem(inventory, itemId, count) {
  const maxStack = ITEMS[itemId]?.maxStack ?? Infinity
  const slots = inventory.map((s) => (s ? { ...s } : null))
  let remaining = count

  for (const slot of slots) {
    if (remaining <= 0) break
    if (slot && slot.itemId === itemId && slot.count < maxStack) {
      const add = Math.min(maxStack - slot.count, remaining)
      slot.count += add
      remaining -= add
    }
  }
  for (let i = 0; i < slots.length && remaining > 0; i++) {
    if (slots[i]) continue
    const add = Math.min(maxStack, remaining)
    slots[i] = { itemId, count: add }
    remaining -= add
  }

  return { inventory: slots, added: count - remaining, overflow: remaining }
}

export function removeItem(inventory, itemId, count) {
  const slots = inventory.map((s) => (s ? { ...s } : null))
  let remaining = count

  for (let i = 0; i < slots.length && remaining > 0; i++) {
    const slot = slots[i]
    if (!slot || slot.itemId !== itemId) continue
    const take = Math.min(slot.count, remaining)
    slot.count -= take
    remaining -= take
    if (slot.count === 0) slots[i] = null
  }

  return { inventory: slots, removed: count - remaining }
}

export function totalCount(inventory, itemId) {
  return inventory.reduce((sum, s) => sum + (s && s.itemId === itemId ? s.count : 0), 0)
}

export function isFull(inventory) {
  return inventory.every((s) => s !== null)
}
