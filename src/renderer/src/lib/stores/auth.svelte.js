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
    window.location.href = '/auth/google'
  }

  async signInAs(email) {
    this.user = await api.testLogin(email)
    window.location.reload()
  }
}

export const auth = new AuthStore()
