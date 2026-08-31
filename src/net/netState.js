import { reactive, watch } from 'vue'
import { supabase } from './supabase.js'

export const netState = reactive({
  mode: null,         // null | 'local' | 'host' | 'guest'
  roomCode: null,
  connected: false,
  myPlayerId: null,   // guest: which player ID is controlled locally
  worldId: null,      // current world save ID (local or server)
  worldName: 'Mon monde',
  playerName: localStorage.getItem('hearthmoor_player_name') || '',
  user: null,          // { id, email } si connecté via Supabase, sinon null
})

watch(() => netState.playerName, (v) => localStorage.setItem('hearthmoor_player_name', v))

function toUser(user) {
  return user ? { id: user.id, email: user.email } : null
}

supabase.auth.getSession().then(({ data }) => { netState.user = toUser(data.session?.user) })
supabase.auth.onAuthStateChange((_event, session) => { netState.user = toUser(session?.user) })
