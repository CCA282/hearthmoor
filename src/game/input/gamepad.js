const DEAD_ZONE = 0.2

// Pure — takes a single Gamepad-like object ({ axes, buttons }) or null/undefined
// when no pad is connected, returns a world-space movement direction. Left
// stick drives it, d-pad (buttons 12-15) overrides to a full-magnitude push.
export function gamepadMoveVector(pad) {
  if (!pad) return { x: 0, z: 0 }
  let x = pad.axes[0] || 0
  let z = pad.axes[1] || 0
  if (Math.abs(x) < DEAD_ZONE) x = 0
  if (Math.abs(z) < DEAD_ZONE) z = 0
  if (pad.buttons[14]?.pressed) x = -1
  if (pad.buttons[15]?.pressed) x = 1
  if (pad.buttons[12]?.pressed) z = -1
  if (pad.buttons[13]?.pressed) z = 1
  return { x, z }
}

// Pure — true only on the frame button 0 (A/Cross) transitions from up to
// down, given this frame's and the previous frame's pad snapshot.
export function gamepadActionPressed(pad, prevPad) {
  const down = !!pad?.buttons[0]?.pressed
  const wasDown = !!prevPad?.buttons[0]?.pressed
  return down && !wasDown
}
