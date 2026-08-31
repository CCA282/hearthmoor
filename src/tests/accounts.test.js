import { describe, it, expect, beforeEach, vi } from 'vitest'

const authMock = {
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}

vi.mock('../net/supabase.js', () => ({ supabase: { auth: authMock } }))

const { signup, login, logout } = await import('../net/accounts.js')

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('signup / login', () => {
  it('signup returns the user on success', async () => {
    authMock.signUp.mockResolvedValue({ data: { user: { id: 'u1', email: 'clement@example.com' } }, error: null })
    const user = await signup('clement@example.com', 'password123')
    expect(user).toEqual({ id: 'u1', email: 'clement@example.com' })
    expect(authMock.signUp).toHaveBeenCalledWith({ email: 'clement@example.com', password: 'password123' })
  })

  it('signup throws on failure', async () => {
    authMock.signUp.mockResolvedValue({ data: {}, error: new Error('Un compte existe déjà avec cet email') })
    await expect(signup('clement@example.com', 'password123')).rejects.toThrow('Un compte existe déjà avec cet email')
  })

  it('login returns the user on success', async () => {
    authMock.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u2', email: 'bob@example.com' } }, error: null })
    const user = await login('bob@example.com', 'password123')
    expect(user).toEqual({ id: 'u2', email: 'bob@example.com' })
  })

  it('login throws on invalid credentials', async () => {
    authMock.signInWithPassword.mockResolvedValue({ data: {}, error: new Error('Identifiants invalides') })
    await expect(login('bob@example.com', 'wrong')).rejects.toThrow('Identifiants invalides')
  })
})

describe('logout', () => {
  it('calls supabase signOut', async () => {
    authMock.signOut.mockResolvedValue({ error: null })
    await logout()
    expect(authMock.signOut).toHaveBeenCalled()
  })
})
