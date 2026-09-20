import { defineStore } from 'pinia'
import { get, post, put } from '../utils/api'
import router from '../router'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    isLoggedIn: !!localStorage.getItem('token')
  }),

  actions: {
    async login(username, password) {
      try {
        const data = await post('/auth/login', { username, password })
        this.token = data.token
        this.user = data.user || { username }
        this.isLoggedIn = true
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(this.user))
        return data
      } catch (error) {
        throw error
      }
    },

    logout() {
      this.token = ''
      this.user = null
      this.isLoggedIn = false
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      router.push('/login')
    },

    async fetchMe() {
      try {
        const data = await get('/auth/me')
        this.user = data
        this.isLoggedIn = true
        localStorage.setItem('user', JSON.stringify(data))
        return data
      } catch (error) {
        this.logout()
        throw error
      }
    },

    async changePassword(oldPwd, newPwd) {
      try {
        const data = await post('/auth/change-password', { oldPassword: oldPwd, newPassword: newPwd })
        return data
      } catch (error) {
        throw error
      }
    }
  }
})
