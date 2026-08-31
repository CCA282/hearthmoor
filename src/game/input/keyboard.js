// Pure — takes the set of currently-down key codes, returns a world-space
// movement direction (not normalized — diagonals give length √2, see
// scene/movement.js's clampToUnit).
export function keyboardMoveVector(keysDown) {
  let x = 0
  let z = 0
  if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) x -= 1
  if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) x += 1
  if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) z -= 1
  if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) z += 1
  return { x, z }
}

function edgePressed(keys, keysDown, prevKeysDown) {
  const down = keys.some((k) => keysDown.has(k))
  const wasDown = keys.some((k) => prevKeysDown.has(k))
  return down && !wasDown
}

const ACTION_KEYS = ['Space', 'KeyE']
const ATTACK_KEYS = ['KeyF', 'ShiftLeft']

// Pure — true only on the frame the interact/harvest key transitions from up
// to down (not held), given this frame's and the previous frame's key sets.
export function keyboardActionPressed(keysDown, prevKeysDown) {
  return edgePressed(ACTION_KEYS, keysDown, prevKeysDown)
}

// Pure — same edge-detection, but the attack key (deliberately separate from
// the interact/harvest key so a player can stand near both a resource node
// and an enemy without one action accidentally triggering the other).
export function keyboardAttackPressed(keysDown, prevKeysDown) {
  return edgePressed(ATTACK_KEYS, keysDown, prevKeysDown)
}
