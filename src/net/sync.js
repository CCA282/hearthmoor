import { supabase } from './supabase.js'

// Generic persistence layer — data-shape agnostic on purpose. The caller builds
// the snapshot object (whatever the Scene/inventory model looks like once it
// exists — see docs/spec.md) and hands it to these functions; this file only
// decides *where* it's stored (localStorage vs Postgres), matching hamnet-village's
// rule: storage location depends only on netState.user, never on local/host/guest.

// ── Local save (localStorage) ─────────────────────────────────────────────────

const LS_INDEX = 'hearthmoor_saves'

function lsIndex() {
  try { return JSON.parse(localStorage.getItem(LS_INDEX) || '[]') } catch { return [] }
}
function lsSave(index) { localStorage.setItem(LS_INDEX, JSON.stringify(index)) }

export function listLocalSaves() {
  return lsIndex().map(({ id, name, savedAt }) => ({ id, name, savedAt }))
}

export function saveLocal(data, id, name) {
  const record = { ...data, name, savedAt: new Date().toISOString(), id }
  localStorage.setItem('hearthmoor_world_' + id, JSON.stringify(record))
  const idx = lsIndex().filter((e) => e.id !== id)
  idx.unshift({ id, name, savedAt: record.savedAt })
  lsSave(idx)
  return id
}

export function loadLocal(id) {
  try { return JSON.parse(localStorage.getItem('hearthmoor_world_' + id)) } catch { return null }
}

export function deleteLocal(id) {
  localStorage.removeItem('hearthmoor_world_' + id)
  lsSave(lsIndex().filter((e) => e.id !== id))
}

// ── Server save (Supabase Postgres, table `hearthmoor_worlds`, RLS'd to auth.uid()) ──

export async function listServerSaves() {
  const { data, error } = await supabase
    .from('hearthmoor_worlds')
    .select('id, name, saved_at')
    .order('saved_at', { ascending: false })
  if (error) return []
  return data.map((w) => ({ id: w.id, name: w.name, savedAt: w.saved_at }))
}

export async function saveServer(data, id, name) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const row = { owner_id: user.id, name, data }
  if (id) row.id = id
  const { data: saved, error } = await supabase.from('hearthmoor_worlds').upsert(row).select('id').single()
  return error ? null : saved.id
}

export async function loadServer(id) {
  const { data, error } = await supabase
    .from('hearthmoor_worlds')
    .select('name, data, saved_at')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return { ...data.data, name: data.name, id, savedAt: data.saved_at }
}

export async function deleteServer(id) {
  const { error } = await supabase.from('hearthmoor_worlds').delete().eq('id', id)
  return !error
}
