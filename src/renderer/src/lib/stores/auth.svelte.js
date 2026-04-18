import * as api from '../api.js'

class AuthStore {
  user = $state(null)
  loading = $state(true)

  async init() {
    try {
      this.user = await api.getCurrentUser()
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
}

export const auth = new AuthStore()
