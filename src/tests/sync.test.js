import { describe, it, expect, beforeEach, vi } from 'vitest'

function makeLocalStorage() {
  let store = {}
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    clear: () => { store = {} },
  }
}
vi.stubGlobal('localStorage', makeLocalStorage())

// Minimal stand-in for supabase-js's PostgrestFilterBuilder: every chain method returns
// the same thenable object, so `await supabase.from(...).select(...).order(...)` (or any
// other call order our code actually uses) resolves to whatever `result` was configured.
function makeQueryBuilder(result) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    maybeSingle: vi.fn(() => builder),
    single: vi.fn(() => builder),
    then: (resolve) => resolve(result),
  }
  return builder
}

const supabaseMock = { auth: { getUser: vi.fn() }, from: vi.fn() }
vi.mock('../net/supabase.js', () => ({ supabase: supabaseMock }))

const {
  saveLocal, loadLocal, listLocalSaves, deleteLocal,
  saveServer, listServerSaves, loadServer, deleteServer,
} = await import('../net/sync.js')

function signIn(userId) { supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: userId } } }) }
function signOut() { supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null } }) }

beforeEach(() => {
  localStorage.clear()
  supabaseMock.from.mockReset()
  supabaseMock.auth.getUser.mockReset()
})

// ── localStorage (sans compte) ──────────────────────────────────────────────

describe('saveLocal / loadLocal / listLocalSaves / deleteLocal', () => {
  it('round-trips a save', () => {
    const id = saveLocal({ zone: 'prairie' }, 'w1', 'Mon monde')
    expect(id).toBe('w1')
    const loaded = loadLocal('w1')
    expect(loaded.name).toBe('Mon monde')
    expect(loaded.id).toBe('w1')
    expect(loaded.zone).toBe('prairie')
  })

  it('lists saves most-recent-first', () => {
    saveLocal({}, 'a', 'A')
    saveLocal({}, 'b', 'B')
    expect(listLocalSaves().map((s) => s.id)).toEqual(['b', 'a'])
  })

  it('re-saving the same id updates it without duplicating the index entry', () => {
    saveLocal({}, 'w1', 'Mon monde')
    saveLocal({}, 'w1', 'Mon monde renommé')
    const list = listLocalSaves()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Mon monde renommé')
  })

  it('deleteLocal removes the save and its index entry', () => {
    saveLocal({}, 'w1', 'Mon monde')
    deleteLocal('w1')
    expect(loadLocal('w1')).toBeNull()
    expect(listLocalSaves()).toHaveLength(0)
  })

  it('loadLocal returns null for an unknown id', () => {
    expect(loadLocal('missing')).toBeNull()
  })
})

// ── Backend (Supabase Postgres, table `hearthmoor_worlds`) ──────────────────

describe('saveServer / listServerSaves / loadServer / deleteServer', () => {
  it('saveServer upserts a row tagged with owner_id when signed in', async () => {
    signIn('u1')
    const builder = makeQueryBuilder({ data: { id: 'w1' }, error: null })
    supabaseMock.from.mockReturnValue(builder)

    const id = await saveServer({ zone: 'prairie' }, 'w1', 'Mon monde')

    expect(id).toBe('w1')
    expect(supabaseMock.from).toHaveBeenCalledWith('hearthmoor_worlds')
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ owner_id: 'u1', name: 'Mon monde', id: 'w1', data: { zone: 'prairie' } }),
    )
  })

  it('saveServer returns null without querying when signed out', async () => {
    signOut()
    const id = await saveServer({}, 'w1', 'Mon monde')
    expect(id).toBeNull()
    expect(supabaseMock.from).not.toHaveBeenCalled()
  })

  it('saveServer returns null when the upsert fails', async () => {
    signIn('u1')
    supabaseMock.from.mockReturnValue(makeQueryBuilder({ data: null, error: new Error('boom') }))
    expect(await saveServer({}, 'w1', 'Mon monde')).toBeNull()
  })

  it('listServerSaves returns the mapped list on success', async () => {
    supabaseMock.from.mockReturnValue(
      makeQueryBuilder({ data: [{ id: 'w1', name: 'Mon monde', saved_at: '2026-01-01' }], error: null }),
    )
    const list = await listServerSaves()
    expect(list).toEqual([{ id: 'w1', name: 'Mon monde', savedAt: '2026-01-01' }])
    expect(supabaseMock.from).toHaveBeenCalledWith('hearthmoor_worlds')
  })

  it('listServerSaves returns [] on error (e.g. signed out, RLS denies)', async () => {
    supabaseMock.from.mockReturnValue(makeQueryBuilder({ data: null, error: new Error('denied') }))
    expect(await listServerSaves()).toEqual([])
  })

  it('loadServer merges the row metadata back onto the flat snapshot', async () => {
    supabaseMock.from.mockReturnValue(
      makeQueryBuilder({ data: { name: 'Mon monde', data: { zone: 'prairie' }, saved_at: '2026-01-01' }, error: null }),
    )
    expect(await loadServer('w1')).toEqual({ zone: 'prairie', name: 'Mon monde', id: 'w1', savedAt: '2026-01-01' })
  })

  it('loadServer returns null on failure (e.g. owned by another account)', async () => {
    supabaseMock.from.mockReturnValue(makeQueryBuilder({ data: null, error: null }))
    expect(await loadServer('w1')).toBeNull()
  })

  it('deleteServer deletes the row by id and returns true on success', async () => {
    const builder = makeQueryBuilder({ error: null })
    supabaseMock.from.mockReturnValue(builder)

    expect(await deleteServer('w1')).toBe(true)
    expect(supabaseMock.from).toHaveBeenCalledWith('hearthmoor_worlds')
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'w1')
  })

  it('deleteServer returns false when the delete fails (e.g. RLS denies)', async () => {
    supabaseMock.from.mockReturnValue(makeQueryBuilder({ error: new Error('denied') }))
    expect(await deleteServer('w1')).toBe(false)
  })
})
