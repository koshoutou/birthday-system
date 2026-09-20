<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-800 mb-6">仪表盘</h1>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <Loader2 :size="32" class="animate-spin text-blue-500" />
      <span class="ml-3 text-gray-500">加载中...</span>
    </div>

    <div v-else-if="error" class="bg-red-50 text-red-600 p-4 rounded-lg">
      {{ error }}
      <button @click="fetchData" class="ml-3 underline text-sm">重试</button>
    </div>

    <div v-else>
      <!-- 今日农历信息横幅 -->
      <div v-if="todayLunar" class="bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 rounded-xl shadow-lg p-5 mb-8 text-white overflow-hidden relative">
        <div class="absolute top-0 right-0 w-32 h-32 bg-white bg-opacity-10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div class="absolute bottom-0 left-0 w-24 h-24 bg-white bg-opacity-10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
        <div class="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-center space-x-4">
            <div class="bg-white bg-opacity-20 p-3 rounded-lg backdrop-blur-sm">
              <Calendar :size="28" class="text-white" />
            </div>
            <div>
              <p class="text-sm text-white text-opacity-80">今日农历</p>
              <p class="text-2xl font-bold mt-0.5">
                {{ todayLunar.lunarYear }}年 · {{ todayLunar.lunarDate }}
              </p>
              <p class="text-sm text-white text-opacity-80 mt-1">
                {{ todayLunar.dayOfWeek }}
                <span class="mx-1">·</span>
                {{ todayLunar.zodiac }}
                <span v-if="todayLunar.solarTerm" class="mx-1">·</span>
                <span v-if="todayLunar.solarTerm">{{ todayLunar.solarTerm }}</span>
              </p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-sm text-white text-opacity-80">公历日期</p>
            <p class="text-xl font-semibold mt-0.5">{{ todayLunar.gregorian }}</p>
            <p class="text-lg font-mono mt-1 tracking-wider tabular-nums">
              <span class="text-white text-opacity-70 text-sm mr-1">北京时间</span>
              {{ currentTime }}
            </p>
          </div>
        </div>
      </div>

      <!-- 统计卡片 -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">总人数</p>
              <p class="text-2xl font-bold text-gray-800 mt-1">{{ stats.totalPeople || 0 }}</p>
            </div>
            <div class="bg-blue-100 p-3 rounded-lg">
              <Users :size="24" class="text-blue-600" />
            </div>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">分类数量</p>
              <p class="text-2xl font-bold text-gray-800 mt-1">{{ stats.totalDepartments || 0 }}</p>
            </div>
            <div class="bg-green-100 p-3 rounded-lg">
              <Building2 :size="24" class="text-green-600" />
            </div>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">本月生日</p>
              <p class="text-2xl font-bold text-gray-800 mt-1">{{ stats.monthBirthdays || 0 }}</p>
            </div>
            <div class="bg-purple-100 p-3 rounded-lg">
              <Calendar :size="24" class="text-purple-600" />
            </div>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">今日生日</p>
              <p class="text-2xl font-bold text-gray-800 mt-1">{{ stats.todayBirthdays || 0 }}</p>
            </div>
            <div class="bg-orange-100 p-3 rounded-lg">
              <Cake :size="24" class="text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <!-- 图表区域 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- 按部门统计 -->
        <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 class="text-lg font-semibold text-gray-800 mb-4">按分类统计</h3>
          <div v-if="departmentStats.length === 0" class="text-gray-400 text-center py-8">
            暂无数据
          </div>
          <div v-else class="space-y-3">
            <div v-for="dept in departmentStats" :key="dept.name" class="flex items-center space-x-3">
              <span class="text-sm text-gray-600 w-24 truncate text-right">{{ dept.name }}</span>
              <div class="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                <div
                  class="bg-blue-500 h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                  :style="{ width: getBarWidth(dept.count) + '%' }"
                >
                  <span v-if="getBarWidth(dept.count) > 15" class="text-xs text-white font-medium">
                    {{ dept.count }}
                  </span>
                </div>
              </div>
              <span v-if="getBarWidth(dept.count) <= 15" class="text-sm text-gray-500 w-8">
                {{ dept.count }}
              </span>
            </div>
          </div>
        </div>

        <!-- 按公农历统计 -->
        <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 class="text-lg font-semibold text-gray-800 mb-4">按公农历统计</h3>
          <div v-if="typeStats.length === 0" class="text-gray-400 text-center py-8">
            暂无数据
          </div>
          <div v-else class="space-y-3">
            <div v-for="item in typeStats" :key="item.type" class="flex items-center space-x-3">
              <span class="text-sm text-gray-600 w-24 truncate text-right">{{ item.type }}</span>
              <div class="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                <div
                  :class="item.type === '公历' ? 'bg-green-500' : 'bg-amber-500'"
                  class="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                  :style="{ width: getBarWidth(item.count) + '%' }"
                >
                  <span v-if="getBarWidth(item.count) > 15" class="text-xs text-white font-medium">
                    {{ item.count }}
                  </span>
                </div>
              </div>
              <span v-if="getBarWidth(item.count) <= 15" class="text-sm text-gray-500 w-8">
                {{ item.count }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 生日列表 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- 近30天即将过生日 -->
        <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Clock :size="20" class="mr-2 text-blue-500" />
            近30天即将过生日
          </h3>
          <div v-if="upcomingBirthdays.length === 0" class="text-gray-400 text-center py-8">
            近30天没有即将过生日的人员
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="item in upcomingBirthdays"
              :key="item.id"
              class="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Cake :size="16" class="text-blue-600" />
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-800">{{ item.name }}</p>
                  <p class="text-xs text-gray-500">
                    {{ item.department || '未分配分类' }}
                    <span v-if="item.birth_type === 'lunar'" class="text-amber-600 ml-1">(农历)</span>
                  </p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm font-medium" :class="item.days_until === 0 ? 'text-red-500' : 'text-gray-700'">
                  {{ item.days_until === 0 ? '今天' : item.days_until + '天后' }}
                </p>
                <p class="text-xs text-gray-400">{{ item.date }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 近7天已过生日 -->
        <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <History :size="20" class="mr-2 text-green-500" />
            近7天已过生日
          </h3>
          <div v-if="recentBirthdays.length === 0" class="text-gray-400 text-center py-8">
            近7天没有已过生日的人员
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="item in recentBirthdays"
              :key="item.id"
              class="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <Gift :size="16" class="text-green-600" />
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-800">{{ item.name }}</p>
                  <p class="text-xs text-gray-500">
                    {{ item.department || '未分配分类' }}
                    <span v-if="item.birth_type === 'lunar'" class="text-amber-600 ml-1">(农历)</span>
                  </p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm text-gray-500">{{ item.days_ago }}天前</p>
                <p class="text-xs text-gray-400">{{ item.date }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import { get } from '../utils/api'
import {
  Users, Building2, Calendar, Cake, Clock, History, Gift, Loader2
} from 'lucide-vue-next'

const showToast = inject('showToast')

const loading = ref(true)
const error = ref('')
const dashboardData = ref(null)
const todayLunar = ref(null)
const currentTime = ref('')

// 北京时间实时更新
let timeInterval = null

function updateBeijingTime() {
  // 创建一个表示北京时间的 Date 对象（UTC+8）
  const now = new Date()
  // 使用 Intl.DateTimeFormat 获取北京时间
  try {
    const beijingTimeStr = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now)
    currentTime.value = beijingTimeStr
  } catch {
    // 回退方案：手动计算
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
    const beijing = new Date(utc + 3600000 * 8)
    const h = String(beijing.getHours()).padStart(2, '0')
    const m = String(beijing.getMinutes()).padStart(2, '0')
    const s = String(beijing.getSeconds()).padStart(2, '0')
    currentTime.value = `${h}:${m}:${s}`
  }
}

const stats = computed(() => dashboardData.value || {})

const departmentStats = computed(() => {
  if (!dashboardData.value?.departmentStats) return []
  return dashboardData.value.departmentStats
})

const typeStats = computed(() => {
  if (!dashboardData.value?.typeStats) return []
  return dashboardData.value.typeStats
})

const upcomingBirthdays = computed(() => {
  if (!dashboardData.value?.upcomingBirthdays) return []
  return dashboardData.value.upcomingBirthdays
})

const recentBirthdays = computed(() => {
  if (!dashboardData.value?.recentBirthdays) return []
  return dashboardData.value.recentBirthdays
})

function getBarWidth(count) {
  if (!departmentStats.value.length && !typeStats.value.length) return 0
  const allCounts = [
    ...departmentStats.value.map(d => d.count),
    ...typeStats.value.map(t => t.count)
  ]
  const max = Math.max(...allCounts, 1)
  return Math.max((count / max) * 100, 5)
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    dashboardData.value = await get('/dashboard')
  } catch (err) {
    error.value = err.message || '加载仪表盘数据失败'
    showToast(error.value, 'error')
  } finally {
    loading.value = false
  }
}

// 加载今日农历信息（不需要认证，公开接口）
async function fetchTodayLunar() {
  try {
    const token = localStorage.getItem('token')
    const res = await fetch('/api/lunar/today', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    })
    if (res.ok) {
      const json = await res.json()
      if (json.success && json.data) {
        todayLunar.value = json.data
      }
    }
  } catch (e) {
    // 静默失败
    console.error('加载今日农历失败', e)
  }
}

onMounted(() => {
  fetchData()
  fetchTodayLunar()
  updateBeijingTime()
  // 每秒更新一次北京时间
  timeInterval = setInterval(updateBeijingTime, 1000)
})

onUnmounted(() => {
  if (timeInterval) {
    clearInterval(timeInterval)
    timeInterval = null
  }
})
</script>