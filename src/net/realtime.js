import { supabase } from './supabase.js'

// One Supabase Realtime channel per room, topic-namespaced with `hearthmoor:` —
// the project is shared with other games, so an unprefixed room code could
// collide with another game's channel topic.
const ROOM_PREFIX = 'hearthmoor:room:'
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const JOIN_TIMEOUT_MS = 4000

function genCode() {
  return Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
}

function genId() {
  return crypto.randomUUID()
}

let _channel = null
let _role = null   // 'host' | 'guest'
let _myId = null   // hostId (host) or guestId (guest)
const _handlers = {}

function dispatch(type, payload) { _handlers[type]?.(payload) }

export function onState(fn) { _handlers.state = fn }
export function onInput(fn) { _handlers.input = fn }
export function onGuestJoined(fn) { _handlers.guest_joined = fn }
export function onGuestLeft(fn) { _handlers.guest_left = fn }
export function onHostLeft(fn) { _handlers.host_left = fn }
export function onDisconnected(fn) { _handlers.disconnected = fn }

function testHook() {
  return typeof window !== 'undefined' ? window.__HEARTHMOOR_REALTIME_TEST_HOOK__ : null
}

function presenceEntries(state) {
  return Object.values(state).flat()
}

// Host: claim a fresh room code (retrying on the rare presence-detected collision) and
// subscribe. Resolves once this client is tracked as the room's host.
export async function createRoomAsHost() {
  const hook = testHook()
  if (hook) return hook.createRoomAsHost(dispatch)

  _role = 'host'
  _myId = genId()

  let code
  for (;;) {
    code = genCode()
    const ch = supabase.channel(ROOM_PREFIX + code, { config: { presence: { key: _myId } } })
    let subscribed = false

    // Presence listeners must be registered before subscribe() — realtime-js throws
    // if they're added once the channel has already joined.
    ch.on('presence', { event: 'join' }, ({ newPresences }) => {
      for (const p of newPresences) {
        if (p.role === 'guest') dispatch('guest_joined', { guestId: p.guestId, name: p.name ?? null })
      }
    })
    ch.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      for (const p of leftPresences) {
        if (p.role === 'guest') dispatch('guest_left', { guestId: p.guestId })
      }
    })
    ch.on('broadcast', { event: 'input' }, ({ payload }) => dispatch('input', payload))

    const alreadyTaken = await new Promise((resolve) => {
      ch.on('presence', { event: 'sync' }, () => {
        resolve(presenceEntries(ch.presenceState()).some((p) => p.role === 'host'))
      })
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') subscribed = true
        else if (subscribed && (status === 'CLOSED' || status === 'CHANNEL_ERROR')) dispatch('disconnected')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') resolve(false)
      })
    })
    if (!alreadyTaken) { _channel = ch; break }
    await supabase.removeChannel(ch)
  }

  await _channel.track({ role: 'host', hostId: _myId })
  return { code, hostId: _myId }
}

// Guest: subscribe to an existing room's channel. Rejects if no host presence and no
// `state` broadcast show up within JOIN_TIMEOUT_MS (there's no server to ask "does this
// room exist?" anymore — existence is inferred from presence/traffic on the topic).
export async function joinRoomAsGuest(code, name) {
  const hook = testHook()
  if (hook) return hook.joinRoomAsGuest(code, name, dispatch)

  _role = 'guest'
  _myId = genId()

  const ch = supabase.channel(ROOM_PREFIX + code, { config: { presence: { key: _myId } } })
  _channel = ch
  let subscribed = false

  // Presence listeners must be registered before subscribe() — realtime-js throws
  // if they're added once the channel has already joined.
  ch.on('presence', { event: 'leave' }, ({ leftPresences }) => {
    if (leftPresences.some((p) => p.role === 'host')) dispatch('host_left')
  })

  const hostSeen = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), JOIN_TIMEOUT_MS)
    const settle = (found) => { clearTimeout(timer); resolve(found) }

    ch.on('presence', { event: 'sync' }, () => {
      if (presenceEntries(ch.presenceState()).some((p) => p.role === 'host')) settle(true)
    })
    ch.on('presence', { event: 'join' }, ({ newPresences }) => {
      if (newPresences.some((p) => p.role === 'host')) settle(true)
    })
    ch.on('broadcast', { event: 'state' }, ({ payload }) => {
      settle(true)
      dispatch('state', payload)
    })
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') subscribed = true
      else if (subscribed && (status === 'CLOSED' || status === 'CHANNEL_ERROR')) dispatch('disconnected')
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') settle(false)
    })
  })

  if (!hostSeen) {
    await supabase.removeChannel(ch)
    _channel = null
    throw new Error('Room introuvable')
  }

  await ch.track({ role: 'guest', guestId: _myId, name: name ?? null })
  return { guestId: _myId }
}

export function broadcastState(snap) {
  _channel?.send({ type: 'broadcast', event: 'state', payload: snap })
}

export function sendInput(input) {
  _channel?.send({ type: 'broadcast', event: 'input', payload: { guestId: _myId, input } })
}

export function leaveRoom() {
  const hook = testHook()
  if (hook) { hook.leaveRoom?.(); _channel = null; _role = null; _myId = null; return }

  if (_channel) supabase.removeChannel(_channel)
  _channel = null
  _role = null
  _myId = null
}
