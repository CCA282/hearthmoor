// Pure — health never goes below 0 or above max.
export function applyDamage(health, amount) {
  return Math.max(0, health - amount)
}

export function heal(health, amount, maxHealth) {
  return Math.min(maxHealth, health + amount)
}

export function isDead(health) {
  return health <= 0
}
