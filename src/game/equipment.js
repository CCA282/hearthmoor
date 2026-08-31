import { ITEMS } from './constants/items.js'
import { PLAYER_ATTACK_DAMAGE } from './constants/combat.js'

// Pure — effective attack damage for a player, base damage plus whatever
// bonus their equipped weapon (if any) grants. `player` only needs an
// `equipment: { weapon: itemId | null }` shape.
export function attackDamageFor(player) {
  const weaponId = player.equipment?.weapon
  const bonus = weaponId ? (ITEMS[weaponId]?.damageBonus ?? 0) : 0
  return PLAYER_ATTACK_DAMAGE + bonus
}

// Pure — equips itemId into its item definition's slot, returning a NEW
// equipment object (immutable, same style as inventory.js). No-op (same
// reference back) if the item has no `slot` (not equippable).
export function equipItem(equipment, itemId) {
  const def = ITEMS[itemId]
  if (!def?.slot) return equipment
  return { ...equipment, [def.slot]: itemId }
}
