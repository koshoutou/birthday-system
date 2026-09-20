<template>
  <!-- 登录页使用独立布局 -->
  <div v-if="route.path === '/login'" class="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
    <router-view />
    <!-- Toast 通知 -->
    <div class="fixed top-20 right-4 z-50 space-y-2">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="[
          'px-4 py-3 rounded-lg shadow-lg text-white text-sm max-w-sm transition-all duration-300',
          toast.type === 'success' ? 'bg-green-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        ]"
      >
        {{ toast.message }}
      </div>
    </div>
  </div>

  <!-- 其他页面使用带侧边栏的布局 -->
  <div v-else class="min-h-screen bg-gray-50">
    <!-- 顶部导航栏 -->
    <header class="bg-blue-600 text-white shadow-lg fixed top-0 left-0 right-0 z-50">
      <div class="flex items-center justify-between px-4 h-16">
        <div class="flex items-center space-x-4">
          <!-- 移动端汉堡菜单按钮 -->
          <button
            class="lg:hidden p-2 rounded-md hover:bg-blue-700 transition-colors"
            @click="sidebarOpen = !sidebarOpen"
          >
            <Menu v-if="!sidebarOpen" :size="24" />
            <X v-else :size="24" />
          </button>
          <router-link to="/" class="flex items-center space-x-2 text-xl font-bold">
            <span>🎂</span>
            <span class="hidden sm:inline">生日管理平台</span>
            <span class="sm:hidden">生日管理</span>
          </router-link>
        </div>
        <div class="flex items-center space-x-3">
          <!-- 用户下拉菜单 -->
          <div class="relative">
            <button
              @click="showUserMenu = !showUserMenu"
              class="flex items-center space-x-2 px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors text-sm"
            >
              <span class="hidden md:inline">{{ authStore.user?.username || '用户' }}</span>
              <ChevronDown :size="16" />
            </button>
            <!-- 下拉菜单 -->
            <div
              v-if="showUserMenu"
              class="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg py-1 z-50"
            >
              <button
                @click="openChangePasswordModal"
                class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
              >
                <Key :size="16" />
                <span>修改密码</span>
              </button>
              <div class="border-t border-gray-100 my-1"></div>
              <button
                @click="authStore.logout()"
                class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
              >
                <LogOut :size="16" />
                <span>退出登录</span>
              </button>
            </div>
            <!-- 点击外部关闭菜单 -->
            <div
              v-if="showUserMenu"
              class="fixed inset-0 z-40"
              @click="showUserMenu = false"
            ></div>
          </div>
        </div>
      </div>
    </header>

    <!-- 侧边栏遮罩 -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
      @click="sidebarOpen = false"
    ></div>

    <!-- 侧边栏 -->
    <aside
      :class="[
        'fixed top-16 left-0 bottom-0 w-64 bg-white shadow-lg z-40 transition-transform duration-300 overflow-y-auto',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      ]"
    >
      <nav class="py-4">
        <router-link
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          :class="[
            'flex items-center space-x-3 px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors border-l-4',
            isActive(item.path) ? 'bg-blue-50 text-blue-600 border-blue-600 font-medium' : 'border-transparent'
          ]"
          @click="sidebarOpen = false"
        >
          <component :is="item.icon" :size="20" />
          <span>{{ item.label }}</span>
        </router-link>
      </nav>
    </aside>

    <!-- 主内容区 -->
    <main class="pt-16 lg:pl-64 min-h-screen">
      <div class="p-4 md:p-6 lg:p-8">
        <router-view />
      </div>
    </main>

    <!-- Toast 通知 -->
    <div class="fixed top-20 right-4 z-50 space-y-2">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="[
          'px-4 py-3 rounded-lg shadow-lg text-white text-sm max-w-sm transition-all duration-300',
          toast.type === 'success' ? 'bg-green-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
        ]"
      >
        {{ toast.message }}
      </div>
    </div>

    <!-- 修改密码模态框 -->
    <Teleport to="body">
      <div v-if="showChangePasswordModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div class="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-800 flex items-center">
              <Lock :size="20" class="mr-2 text-blue-600" />
              修改密码
            </h3>
            <button @click="closeChangePasswordModal" class="p-1 hover:bg-gray-100 rounded-lg transition-colors">
              <X :size="20" />
            </button>
          </div>
          <form @submit.prevent="handleChangePassword" class="p-5 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">当前密码</label>
              <input
                v-model="passwordForm.oldPassword"
                type="password"
                placeholder="请输入当前密码"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">新密码</label>
              <input
                v-model="passwordForm.newPassword"
                type="password"
                placeholder="请输入新密码（至少6位）"
                required
                minlength="6"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">确认新密码</label>
              <input
                v-model="passwordForm.confirmPassword"
                type="password"
                placeholder="请再次输入新密码"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div class="flex space-x-3 pt-2">
              <button
                type="button"
                @click="closeChangePasswordModal"
                class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                取消
              </button>
              <button
                type="submit"
                :disabled="changingPassword"
                class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
              >
                {{ changingPassword ? '修改中...' : '确认修改' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, provide, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { Menu, X, LogOut, LayoutDashboard, Cake, Building2, Link, ChevronDown, Key, Lock } from 'lucide-vue-next'

const route = useRoute()
const authStore = useAuthStore()
const sidebarOpen = ref(false)
const showUserMenu = ref(false)

// 修改密码模态框
const showChangePasswordModal = ref(false)
const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})
const changingPassword = ref(false)

function openChangePasswordModal() {
  showUserMenu.value = false
  passwordForm.oldPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  showChangePasswordModal.value = true
}

function closeChangePasswordModal() {
  showChangePasswordModal.value = false
}

async function handleChangePassword() {
  if (!passwordForm.oldPassword || !passwordForm.newPassword) {
    showToast('请填写完整信息', 'error')
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    showToast('两次输入的新密码不一致', 'error')
    return
  }
  if (passwordForm.newPassword.length < 6) {
    showToast('新密码长度不能少于6位', 'error')
    return
  }

  changingPassword.value = true
  try {
    await authStore.changePassword(passwordForm.oldPassword, passwordForm.newPassword)
    showToast('密码修改成功，请重新登录')
    closeChangePasswordModal()
    setTimeout(() => {
      authStore.logout()
    }, 1500)
  } catch (err) {
    showToast(err.message || '密码修改失败', 'error')
  } finally {
    changingPassword.value = false
  }
}

const menuItems = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/birthdays', label: '生日管理', icon: Cake },
  { path: '/departments', label: '人员分类', icon: Building2 },
  { path: '/share-links', label: '外链管理', icon: Link }
]

function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

// Toast 通知系统
const toasts = reactive([])
let toastId = 0

function showToast(message, type = 'success', duration = 3000) {
  const id = ++toastId
  toasts.push({ id, message, type })
  setTimeout(() => {
    const index = toasts.findIndex(t => t.id === id)
    if (index > -1) toasts.splice(index, 1)
  }, duration)
}

provide('showToast', showToast)
</script>
