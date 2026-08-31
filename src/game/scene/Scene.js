import * as THREE from 'three'
import { CAMERA_FRUSTUM_SIZE, CAMERA_NEAR, CAMERA_FAR } from '../constants/camera.js'
import { PLAYER_SPEED } from '../constants/gameplay.js'
import { RESOURCE_NODES, NODE_HP, NODE_YIELD_PER_HIT, HARVEST_RANGE } from '../constants/nodes.js'
import { cameraPositionFor } from './camera.js'
import { stepPosition } from './movement.js'
import { findNearestNode, hitNode, tickNodeRespawn } from './resources.js'
import { createInventory, addItem } from '../inventory.js'
import { game } from '../store.js'

const HARVEST_HINT = 'Espace / A pour récolter'

// Semi-isometric fixed-angle camera, low-poly ground + simple lighting/fog —
// see docs/spec.md §3-4. No renderer here: WebGLRenderer needs a real <canvas>
// and is owned by engine.js, so this class stays constructible (and mostly
// testable) outside a browser too.
export class Scene {
  constructor() {
    this.three = new THREE.Scene()
    this.three.background = new THREE.Color('#12181c')
    this.three.fog = new THREE.Fog('#12181c', 26, 70)

    this._setupLights()
    this._setupGround()
    this._setupHearthMarker()
    this._setupPlayer()
    this._setupNodes()

    this.inventory = createInventory()
    game.inventory = this.inventory
    this.nearestNode = null

    this.cameraTarget = this.player.position
    this.camera = this._createCamera()
    this._updateCamera()
  }

  _setupPlayer() {
    const geo = new THREE.CapsuleGeometry(0.45, 0.9, 4, 8)
    const mat = new THREE.MeshLambertMaterial({ color: '#6fa8b8' })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(3, 0.9, 3)
    this.three.add(mesh)
    this.player = { position: { x: 3, y: 0.9, z: 3 }, mesh }
  }

  _createCamera() {
    const s = CAMERA_FRUSTUM_SIZE
    const camera = new THREE.OrthographicCamera(-s, s, s, -s, CAMERA_NEAR, CAMERA_FAR)
    return camera
  }

  // Called by engine.js on resize — keeps the frustum height fixed (constant
  // zoom) while adapting width to the canvas aspect ratio.
  setAspect(aspect) {
    const s = CAMERA_FRUSTUM_SIZE
    this.camera.left = -s * aspect
    this.camera.right = s * aspect
    this.camera.top = s
    this.camera.bottom = -s
    this.camera.updateProjectionMatrix()
  }

  _setupLights() {
    const ambient = new THREE.AmbientLight('#8fa8ad', 0.7)
    const sun = new THREE.DirectionalLight('#fff3d6', 1.1)
    sun.position.set(8, 14, 6)
    this.three.add(ambient, sun)
  }

  _setupGround() {
    const geo = new THREE.PlaneGeometry(160, 160)
    const mat = new THREE.MeshLambertMaterial({ color: '#4c6152' })
    const ground = new THREE.Mesh(geo, mat)
    ground.rotation.x = -Math.PI / 2
    this.three.add(ground)
  }

  // Temporary visual anchor at the camp's spawn point (0,0,0) — placeholder
  // for the real hearth/campfire prop, useful in the meantime to eyeball that
  // the ground/camera/lighting are actually oriented correctly.
  _setupHearthMarker() {
    const geo = new THREE.ConeGeometry(0.8, 1.6, 6)
    const mat = new THREE.MeshLambertMaterial({ color: '#e8974a' })
    const marker = new THREE.Mesh(geo, mat)
    marker.position.set(0, 0.8, 0)
    this.three.add(marker)
  }

  _setupNodes() {
    this.nodes = RESOURCE_NODES.map((def) => {
      const mesh = def.kind === 'tree' ? this._buildTreeMesh() : this._buildRockMesh()
      mesh.position.set(def.x, 0, def.z)
      this.three.add(mesh)
      return { ...def, hp: NODE_HP, depleted: false, respawnTimer: 0, mesh }
    })
  }

  _buildTreeMesh() {
    const group = new THREE.Group()
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, 1.2, 6),
      new THREE.MeshLambertMaterial({ color: '#5a4632' }),
    )
    trunk.position.y = 0.6
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 1.8, 7),
      new THREE.MeshLambertMaterial({ color: '#3f6b4a' }),
    )
    canopy.position.y = 1.9
    group.add(trunk, canopy)
    return group
  }

  _buildRockMesh() {
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.6, 0),
      new THREE.MeshLambertMaterial({ color: '#8a8a86' }),
    )
    mesh.position.y = 0.45
    return mesh
  }

  // One hit: yields an item, depletes the node after NODE_HP hits. The actual
  // hp/depleted/respawnTimer transitions are pure (resources.js) — this just
  // applies the result and syncs the THREE mesh + inventory.
  _harvest(node) {
    const idx = this.nodes.indexOf(node)
    const updated = hitNode(node)
    this.nodes[idx] = updated
    updated.mesh.visible = !updated.depleted
    if (updated.depleted) this.nearestNode = null

    const { inventory } = addItem(this.inventory, node.item, NODE_YIELD_PER_HIT)
    this.inventory = inventory
    game.inventory = this.inventory
  }

  _updateNodes(dt) {
    for (let i = 0; i < this.nodes.length; i++) {
      const updated = tickNodeRespawn(this.nodes[i], dt)
      if (updated !== this.nodes[i]) {
        this.nodes[i] = updated
        updated.mesh.visible = !updated.depleted
      }
    }
  }

  _updateCamera() {
    const pos = cameraPositionFor(this.cameraTarget)
    this.camera.position.set(pos.x, pos.y, pos.z)
    this.camera.lookAt(this.cameraTarget.x, this.cameraTarget.y, this.cameraTarget.z)
  }

  update(dt, input) {
    this._updateNodes(dt)

    if (input) {
      const dir = input.moveVector()
      this.player.position = stepPosition(this.player.position, dir, PLAYER_SPEED, dt)
      this.player.mesh.position.set(this.player.position.x, this.player.position.y, this.player.position.z)
      if (dir.x !== 0 || dir.z !== 0) {
        this.player.mesh.rotation.y = Math.atan2(dir.x, dir.z)
      }
      this.cameraTarget = this.player.position

      this.nearestNode = findNearestNode(this.nodes, this.player.position, HARVEST_RANGE)
      game.hint = this.nearestNode ? HARVEST_HINT : ''
      if (this.nearestNode && input.actionPressed()) {
        this._harvest(this.nearestNode)
      }
    }
    this._updateCamera()
  }
}
