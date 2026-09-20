<template>
  <div class="w-full max-w-md p-8">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
      <div class="text-center mb-8">
        <div class="text-5xl mb-3">🎂</div>
        <h1 class="text-2xl font-bold text-gray-800">生日管理平台</h1>
        <p class="text-gray-500 mt-2">请登录您的账号</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-5">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">用户名</label>
          <div class="relative">
            <User class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" :size="18" />
            <input
              v-model="username"
              type="text"
              placeholder="请输入用户名"
              required
              class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              :disabled="loading"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">密码</label>
          <div class="relative">
            <Lock class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" :size="18" />
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入密码"
              required
              class="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              :disabled="loading"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <Eye v-if="!showPassword" :size="18" />
              <EyeOff v-else :size="18" />
            </button>
          </div>
        </div>

        <div
          v-if="errorMsg"
          class="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-lg"
        >
          {{ errorMsg }}
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="loading" class="flex items-center justify-center space-x-2">
            <Loader2 :size="18" class="animate-spin" />
            <span>登录中...</span>
          </span>
          <span v-else>登 录</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { User, Lock, Eye, EyeOff, Loader2 } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  if (!username.value.trim() || !password.value.trim()) {
    errorMsg.value = '请输入用户名和密码'
    return
  }

  loading.value = true
  errorMsg.value = ''

  try {
    await authStore.login(username.value.trim(), password.value)
    router.push('/')
  } catch (error) {
    errorMsg.value = error.message || '登录失败，请检查用户名和密码'
  } finally {
    loading.value = false
  }
}
</script>
