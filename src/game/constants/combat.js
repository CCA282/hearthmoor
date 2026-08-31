// Combat tuning — see docs/spec.md §7: latency-tolerant by design (telegraphed
// attacks, no client-side prediction), not a twitch/frame-perfect system.
export const PLAYER_MAX_HEALTH = 100
export const PLAYER_ATTACK_DAMAGE = 15
export const PLAYER_ATTACK_RANGE = 1.8
export const PLAYER_ATTACK_COOLDOWN = 0.5 // seconds between player swings

export const ENEMY_MAX_HEALTH = 40
export const ENEMY_ATTACK_DAMAGE = 10
export const ENEMY_ATTACK_RANGE = 1.6
export const ENEMY_AGGRO_RANGE = 6
export const ENEMY_CHASE_SPEED = 3.2
export const ENEMY_ATTACK_WINDUP = 0.5   // telegraph before the hit actually lands
export const ENEMY_ATTACK_COOLDOWN = 1.8 // pause after landing (or whiffing) a hit
export const ENEMY_RESPAWN_TIME = 20     // seconds before a dead enemy respawns
