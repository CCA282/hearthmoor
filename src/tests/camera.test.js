import { describe, it, expect } from 'vitest'
import { cameraPositionFor } from '../game/scene/camera.js'

describe('cameraPositionFor', () => {
  it('adds the fixed offset to the target position', () => {
    const pos = cameraPositionFor({ x: 0, y: 0, z: 0 }, { x: 12, y: 16, z: 12 })
    expect(pos).toEqual({ x: 12, y: 16, z: 12 })
  })

  it('follows the target as it moves — offset stays constant', () => {
    const pos = cameraPositionFor({ x: 5, y: 0, z: -3 }, { x: 12, y: 16, z: 12 })
    expect(pos).toEqual({ x: 17, y: 16, z: 9 })
  })

  it('defaults y to 0 when the target has no y (ground-level entities)', () => {
    const pos = cameraPositionFor({ x: 0, z: 0 }, { x: 12, y: 16, z: 12 })
    expect(pos.y).toBe(16)
  })

  it('uses the module default offset when none is passed', () => {
    const pos = cameraPositionFor({ x: 0, y: 0, z: 0 })
    expect(pos).toEqual({ x: 12, y: 16, z: 12 })
  })
})
