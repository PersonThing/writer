import * as api from '../api.js'

class AuthStore {
  user = $state(null)
  loading = $state(true)
  testLoginAvailable = $state(false)
  allowedEmails = $state([])

  async init() {
    try {
      const state = await api.getAuthState()
      this.user = state.user
      this.testLoginAvailable = state.testLoginAvailable
      this.allowedEmails = state.allowedEmails
    } catch (e) {
      console.error('auth init failed:', e)
      this.user = null
    } finally {
      this.loading = false
    }
  }

  async logout() {
    await api.logout()
    this.user = null
    window.location.reload()
  }

  signIn() {
    // Preserve the current in-app path so we come back to it after
    // Google redirects through /auth/google/callback.
    const next = window.location.pathname + window.location.search
    const params = new URLSearchParams({ next })
    window.location.href = `/auth/google?${params.toString()}`
  }

  async signInAs(email) {
    this.user = await api.testLogin(email)
    window.location.reload()
  }
}

export const auth = new AuthStore()
