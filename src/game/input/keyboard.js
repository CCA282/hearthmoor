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

const ACTION_KEYS = ['Space', 'KeyE']

// Pure — true only on the frame the action key transitions from up to down
// (not held), given this frame's and the previous frame's key sets.
export function keyboardActionPressed(keysDown, prevKeysDown) {
  const down = ACTION_KEYS.some((k) => keysDown.has(k))
  const wasDown = ACTION_KEYS.some((k) => prevKeysDown.has(k))
  return down && !wasDown
}
