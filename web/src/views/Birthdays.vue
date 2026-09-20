<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-800">生日管理</h1>
      <div class="flex flex-wrap items-center gap-2 mt-3 sm:mt-0">
        <button
          @click="openImportModal"
          class="flex items-center space-x-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
        >
          <Upload :size="16" />
          <span>导入</span>
        </button>
        <button
          @click="handleExport"
          class="flex items-center space-x-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
        >
          <Download :size="16" />
          <span>导出</span>
        </button>
        <button
          v-if="selectedCount > 0"
          @click="handleBatchDelete"
          class="flex items-center space-x-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
        >
          <Trash2 :size="16" />
          <span>批量删除 ({{ selectedCount }})</span>
        </button>
        <button
          v-if="selectedCount > 0"
          @click="openBatchDeptModal"
          class="flex items-center space-x-1 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm"
        >
          <FolderEdit :size="16" />
          <span>批量修改部门</span>
        </button>
        <button
          @click="openAddModal"
          class="flex items-center space-x-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          <Plus :size="16" />
          <span>添加</span>
        </button>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <div class="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-100">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" :size="16" />
          <input
            v-model="filters.name"
            type="text"
            placeholder="搜索姓名..."
            class="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            @input="debouncedSearch"
          />
        </div>
        <select
          v-model="filters.department_id"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          @change="fetchBirthdays"
        >
          <option value="">全部分类</option>
          <option v-for="dept in departments" :key="dept.id" :value="dept.id">
            {{ dept.name }}
          </option>
        </select>
        <select
          v-model="filters.type"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          @change="fetchBirthdays"
        >
          <option value="">全部类型</option>
          <option value="solar">公历</option>
          <option value="lunar">农历</option>
        </select>
        <select
          v-model="filters.month"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          @change="fetchBirthdays"
        >
          <option value="">全部月份</option>
          <option v-for="m in 12" :key="m" :value="m">{{ m }}月</option>
        </select>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <Loader2 :size="32" class="animate-spin text-blue-500" />
      <span class="ml-3 text-gray-500">加载中...</span>
    </div>

    <!-- 生日列表 -->
    <div v-else class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  :checked="isAllSelected"
                  :indeterminate.prop="isIndeterminate"
                  @change="toggleSelectAll"
                  class="rounded border-gray-300"
                />
              </th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">姓名</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">日期</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">类型</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">年龄</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">分类</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">下次生日</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="item in birthdays"
              :key="item.id"
              class="hover:bg-gray-50 transition-colors cursor-pointer"
              @click="openDetailModal(item)"
            >
              <td class="px-4 py-3" @click.stop>
                <input
                  type="checkbox"
                  :checked="selectedIds.has(item.id)"
                  @change="toggleSelect(item.id)"
                  class="rounded border-gray-300"
                />
              </td>
              <td class="px-4 py-3 text-sm font-medium text-gray-800">{{ item.name }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">
                {{ item.month }}月{{ item.day }}日
                <span v-if="item.is_leap" class="text-xs text-amber-600">(闰)</span>
              </td>
              <td class="px-4 py-3">
                <span
                  :class="item.type === 'solar' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
                  class="px-2 py-0.5 rounded-full text-xs font-medium"
                >
                  {{ item.type === 'solar' ? '公历' : '农历' }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ item.year ? calcAge(item.year) : '-' }}</td>
              <td class="px-4 py-3 text-sm text-gray-600">{{ item.department_name || '-' }}</td>
              <td class="px-4 py-3 text-sm">
                <span class="text-blue-600 font-medium">{{ nextBirthdayMap[item.id]?.daysUntil ?? '-' }} 天</span>
                <span class="text-xs text-gray-400 ml-1">({{ nextBirthdayMap[item.id]?.label || '-' }})</span>
              </td>
              <td class="px-4 py-3" @click.stop>
                <div class="flex items-center space-x-2">
                  <button
                    @click="openEditModal(item)"
                    class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="编辑"
                  >
                    <Pencil :size="16" />
                  </button>
                  <button
                    @click="handleDelete(item)"
                    class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="删除"
                  >
                    <Trash2 :size="16" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="birthdays.length === 0">
              <td colspan="8" class="px-4 py-12 text-center text-gray-400">
                暂无数据
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页 + 全选所有页 -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-3 border-t border-gray-200 gap-3">
        <div class="flex items-center space-x-3">
          <label class="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              :checked="allPagesSelected"
              :indeterminate.prop="somePagesSelected"
              @change="toggleSelectAllPages"
              class="rounded border-gray-300"
            />
            <span class="text-sm text-gray-700">
              全选所有 {{ total }} 条
              <span v-if="selectedCount > 0" class="text-blue-600">(已选 {{ selectedCount }})</span>
            </span>
          </label>
        </div>
        <div v-if="total > pageSize" class="flex items-center space-x-3">
          <span class="text-sm text-gray-500">
            第 {{ currentPage }} / {{ totalPages }} 页
          </span>
          <div class="flex items-center space-x-1">
            <button
              @click="changePage(1)"
              :disabled="currentPage === 1"
              class="px-2 py-1 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              首页
            </button>
            <button
              @click="changePage(currentPage - 1)"
              :disabled="currentPage === 1"
              class="px-2 py-1 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <button
              @click="changePage(currentPage + 1)"
              :disabled="currentPage === totalPages"
              class="px-2 py-1 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
            <button
              @click="changePage(totalPages)"
              :disabled="currentPage === totalPages"
              class="px-2 py-1 text-sm border rounded-lg hover:bg-gray-50 disabled:cursor-not-allowed"
            >
              末页
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加/编辑模态框 -->
    <Teleport to="body">
      <div v-if="showFormModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-800">
              {{ editingItem ? '编辑生日' : '添加生日' }}
            </h3>
            <button @click="closeFormModal" class="p-1 hover:bg-gray-100 rounded-lg transition-colors">
              <X :size="20" />
            </button>
          </div>
          <form @submit.prevent="handleSave" class="p-5 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">姓名 <span class="text-red-500">*</span></label>
              <input
                v-model="form.name"
                type="text"
                placeholder="请输入姓名"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">月 <span class="text-red-500">*</span></label>
                <select
                  v-model.number="form.month"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">选择月</option>
                  <option v-for="m in 12" :key="m" :value="m">{{ m }}月</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">日 <span class="text-red-500">*</span></label>
                <select
                  v-model.number="form.day"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">选择日</option>
                  <option v-for="d in daysInMonth" :key="d" :value="d">{{ d }}日</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">年（可选）</label>
              <input
                v-model.number="form.year"
                type="number"
                placeholder="出生年份，如 1990"
                min="1900"
                :max="new Date().getFullYear()"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">类型 <span class="text-red-500">*</span></label>
              <select
                v-model="form.type"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="solar">公历</option>
                <option value="lunar">农历</option>
              </select>
            </div>
            <div v-if="form.type === 'lunar'">
              <label class="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="form.is_leap"
                  class="rounded border-gray-300 text-blue-600"
                />
                <span class="text-sm text-gray-700">闰月（如该农历月当年存在闰月）</span>
              </label>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">分类</label>
              <select
                v-model="form.department_id"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="">未分配分类</option>
                <option v-for="dept in departments" :key="dept.id" :value="dept.id">
                  {{ dept.name }}
                </option>
              </select>
            </div>
            <div class="flex space-x-3 pt-2">
              <button
                type="button"
                @click="closeFormModal"
                class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                取消
              </button>
              <button
                type="submit"
                :disabled="saving"
                class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
              >
                {{ saving ? '保存中...' : '保存' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- 导入模态框 -->
    <Teleport to="body">
      <div v-if="showImportModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-800">导入生日数据</h3>
            <button @click="showImportModal = false" class="p-1 hover:bg-gray-100 rounded-lg transition-colors">
              <X :size="20" />
            </button>
          </div>
          <div class="p-5 space-y-4">
            <p class="text-sm text-gray-600">
              支持 birthdays.txt 格式（每行一条，用 <code class="bg-gray-100 px-1 rounded">-</code> 分隔）：<br>
              <code class="bg-gray-100 px-1 rounded text-xs">姓名-月-日-a</code>（公历）<br>
              <code class="bg-gray-100 px-1 rounded text-xs">姓名-月-日-b</code>（农历）<br>
              <code class="bg-gray-100 px-1 rounded text-xs">姓名-年-月-日-a</code>（带年份）<br>
              <code class="bg-gray-100 px-1 rounded text-xs">姓名-月-日-a-分类</code>（带分类）<br>
              <code class="bg-gray-100 px-1 rounded text-xs">姓名-年-月-日-b-分类</code>（完整格式）<br>
              <code class="bg-gray-100 px-1 rounded text-xs">姓名-月-日-b-分类(闰)</code>（农历闰月）<br>
              其中 a=公历，b=农历
            </p>
            <textarea
              v-model="importText"
              rows="10"
              placeholder="张三-10-18-a&#10;李四-1990-5-20-b-技术分类&#10;王五-3-15-a-市场分类&#10;赵六-4-15-b-技术分类(闰)"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
            ></textarea>
            <div class="flex space-x-3">
              <button
                @click="showImportModal = false"
                class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                取消
              </button>
              <button
                @click="handleImport"
                :disabled="importing"
                class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
              >
                {{ importing ? '导入中...' : '导入' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 批量修改部门模态框 -->
    <Teleport to="body">
      <div v-if="showBatchDeptModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm">
          <div class="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-800">批量修改部门</h3>
            <button @click="showBatchDeptModal = false" class="p-1 hover:bg-gray-100 rounded-lg transition-colors">
              <X :size="20" />
            </button>
          </div>
          <div class="p-5 space-y-4">
            <p class="text-sm text-gray-600">已选择 {{ selectedCount }} 条记录</p>
            <select
              v-model="batchDeptId"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">清除部门</option>
              <option v-for="dept in departments" :key="dept.id" :value="dept.id">
                {{ dept.name }}
              </option>
            </select>
            <div class="flex space-x-3">
              <button
                @click="showBatchDeptModal = false"
                class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                取消
              </button>
              <button
                @click="handleBatchDept"
                :disabled="saving"
                class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 确认删除模态框 -->
    <Teleport to="body">
      <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
          <h3 class="text-lg font-semibold text-gray-800 mb-2">确认删除</h3>
          <p class="text-sm text-gray-600 mb-6">
            {{ deleteTarget?.batch ? `确定要删除选中的 ${selectedCount} 条记录吗？` : `确定要删除「${deleteTarget?.name}」的生日记录吗？` }}
            此操作不可撤销。
          </p>
          <div class="flex space-x-3">
            <button
              @click="showDeleteConfirm = false"
              class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              取消
            </button>
            <button
              @click="confirmDelete"
              :disabled="deleting"
              class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm disabled:opacity-50"
            >
              {{ deleting ? '删除中...' : '删除' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 详情弹窗 -->
    <Teleport to="body">
      <div v-if="showDetailModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm">
          <div class="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-800">生日详情</h3>
            <button @click="showDetailModal = false" class="p-1 hover:bg-gray-100 rounded-lg transition-colors">
              <X :size="20" />
            </button>
          </div>
          <div v-if="detailItem" class="p-5 space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-gray-500 text-sm">姓名</span>
              <span class="text-gray-800 font-medium">{{ detailItem.name }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-500 text-sm">生日日期</span>
              <span class="text-gray-800">
                {{ detailItem.month }}月{{ detailItem.day }}日
                <span v-if="detailItem.is_leap" class="text-xs text-amber-600">(闰)</span>
                <span v-if="detailItem.year" class="text-xs text-gray-500"> ({{ detailItem.year }}年)</span>
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-500 text-sm">类型</span>
              <span
                :class="detailItem.type === 'solar' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
                class="px-2 py-0.5 rounded-full text-xs font-medium"
              >
                {{ detailItem.type === 'solar' ? '公历' : '农历' }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-500 text-sm">分类</span>
              <span class="text-gray-800">{{ detailItem.department_name || '未分类' }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-500 text-sm">下次生日</span>
              <span class="text-gray-800">{{ nextBirthdayMap[detailItem.id]?.label || '-' }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-500 text-sm">距离天数</span>
              <span class="text-blue-600 font-medium">{{ nextBirthdayMap[detailItem.id]?.daysUntil ?? '-' }} 天</span>
            </div>
            <div class="flex space-x-3 pt-2">
              <button
                @click="showDetailModal = false; openEditModal(detailItem)"
                class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                编辑
              </button>
              <button
                @click="showDetailModal = false"
                class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject, watch } from 'vue'
import { get, post, put, del } from '../utils/api'
import {
  Plus, Search, Pencil, Trash2, Upload, Download, X, Loader2, FolderEdit
} from 'lucide-vue-next'

const showToast = inject('showToast')

// 列表数据
const loading = ref(true)
const birthdays = ref([])
const departments = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

// 筛选
const filters = reactive({
  name: '',
  department_id: '',
  type: '',
  month: ''
})

// 选择 - 用 Set 支持任意数量的 id
const selectedIds = ref(new Set())
const selectedCount = computed(() => selectedIds.value.size)

// 当前页全选状态
const isAllSelected = computed(() => {
  return birthdays.value.length > 0 && birthdays.value.every(item => selectedIds.value.has(item.id))
})
const isIndeterminate = computed(() => {
  if (isAllSelected.value) return false
  return birthdays.value.some(item => selectedIds.value.has(item.id))
})

// "全选所有页" 状态
const allPagesSelected = ref(false)
const somePagesSelected = computed(() => selectedCount.value > 0 && !allPagesSelected.value)

// 下次生日信息缓存 (id -> { daysUntil, label })
const nextBirthdayMap = reactive({})

// 模态框
const showFormModal = ref(false)
const showImportModal = ref(false)
const showBatchDeptModal = ref(false)
const showDeleteConfirm = ref(false)
const editingItem = ref(null)
const saving = ref(false)
const deleting = ref(false)
const importing = ref(false)
const deleteTarget = ref(null)

// 详情弹窗
const showDetailModal = ref(false)
const detailItem = ref(null)

// 表单
const form = reactive({
  name: '',
  month: '',
  day: '',
  year: '',
  type: 'solar',
  is_leap: false,
  department_id: ''
})

const importText = ref('')
const batchDeptId = ref('')

// 日期计算
const daysInMonth = computed(() => {
  const month = form.month
  if (!month) return 31
  const daysMap = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return daysMap[month - 1] || 31
})

function calcAge(year) {
  if (!year) return '-'
  const thisYear = new Date().getFullYear()
  return thisYear - year
}

// 公历生日距离
function getSolarNextBirthdayInfo(item) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const currentYear = today.getFullYear()
  let birthday = new Date(currentYear, item.month - 1, item.day)
  birthday.setHours(0, 0, 0, 0)

  if (birthday < today) {
    birthday = new Date(currentYear + 1, item.month - 1, item.day)
    birthday.setHours(0, 0, 0, 0)
  }

  const diffTime = birthday.getTime() - today.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))
  return {
    daysUntil: diffDays,
    label: `${birthday.getFullYear()}/${birthday.getMonth() + 1}/${birthday.getDate()}`,
  }
}

// 异步计算所有可见记录的"下次生日"
async function loadNextBirthdayMap() {
  const token = localStorage.getItem('token')
  for (const item of birthdays.value) {
    if (item.type === 'solar') {
      nextBirthdayMap[item.id] = getSolarNextBirthdayInfo(item)
    } else {
      // 农历：调用 API
      try {
        const res = await fetch(
          `/api/lunar/next-birthday?lunarMonth=${item.month}&lunarDay=${item.day}&isLeap=${item.is_leap ? 1 : 0}`,
          { headers: { 'Authorization': `Bearer ${token || ''}` } }
        )
        if (res.ok) {
          const json = await res.json()
          if (json.success && json.data) {
            const d = json.data
            const leapStr = item.is_leap ? '(闰)' : ''
            nextBirthdayMap[item.id] = {
              daysUntil: d.daysUntil,
              label: `${d.year}/${d.month}/${d.day} 农历${item.month}月${leapStr}${item.day}日`,
            }
            continue
          }
        }
      } catch (e) {
        console.error('农历生日查询失败', e)
      }
      nextBirthdayMap[item.id] = { daysUntil: '-', label: '计算中...' }
    }
  }
}

// 防抖搜索
let searchTimer = null
function debouncedSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    currentPage.value = 1
    fetchBirthdays()
  }, 300)
}

// 获取部门列表
async function fetchDepartments() {
  try {
    const data = await get('/departments')
    departments.value = Array.isArray(data) ? data : (data.departments || data.data || [])
  } catch (err) {
    console.error('获取部门列表失败:', err)
  }
}

// 获取生日列表
async function fetchBirthdays() {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      page_size: pageSize.value,
      name: filters.name || undefined,
      department_id: filters.department_id || undefined,
      type: filters.type || undefined,
      month: filters.month || undefined,
    }
    const data = await get('/birthdays', params)
    let list = []
    if (data && typeof data === 'object' && !Array.isArray(data) && 'data' in data) {
      list = data.data || []
      total.value = data.total || list.length
    } else if (Array.isArray(data)) {
      list = data
      total.value = data.length
    } else {
      list = data.birthdays || data.items || []
      total.value = data.total || list.length
    }
    birthdays.value = list

    // 检查"全选所有页"状态是否还有效
    refreshAllPagesSelected()

    // 异步加载下次生日
    loadNextBirthdayMap()
  } catch (err) {
    showToast(err.message || '获取生日列表失败', 'error')
  } finally {
    loading.value = false
  }
}

// 分页
function changePage(page) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  fetchBirthdays()
}

// 选择
function toggleSelect(id) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
  refreshAllPagesSelected()
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    // 取消当前页所有
    birthdays.value.forEach(item => selectedIds.value.delete(item.id))
  } else {
    // 选中当前页所有
    birthdays.value.forEach(item => selectedIds.value.add(item.id))
  }
  refreshAllPagesSelected()
}

// "全选所有页" 切换 - 调用 API 一次性获取所有匹配记录
async function toggleSelectAllPages() {
  if (allPagesSelected.value) {
    // 取消全选
    selectedIds.value = new Set()
    allPagesSelected.value = false
    return
  }

  loading.value = true
  try {
    const params = {
      all: 1,
      name: filters.name || undefined,
      department_id: filters.department_id || undefined,
      type: filters.type || undefined,
      month: filters.month || undefined,
    }
    const data = await get('/birthdays', params)
    let list = []
    if (data && typeof data === 'object' && !Array.isArray(data) && 'data' in data) {
      list = data.data || []
    } else if (Array.isArray(data)) {
      list = data
    } else {
      list = data.birthdays || data.items || []
    }
    const newSet = new Set(list.map(item => item.id))
    selectedIds.value = newSet
    allPagesSelected.value = list.length === total.value
  } catch (err) {
    showToast(err.message || '获取全部记录失败', 'error')
  } finally {
    loading.value = false
  }
}

// 跨页切换后重新检查"全选所有页"状态
function refreshAllPagesSelected() {
  // 如果当前已选数量等于 total，且 total>0，则全选所有页生效
  allPagesSelected.value = selectedCount.value === total.value && total.value > 0
}

// 添加/编辑
function openAddModal() {
  editingItem.value = null
  Object.assign(form, {
    name: '', month: '', day: '', year: '', type: 'solar', is_leap: false, department_id: ''
  })
  showFormModal.value = true
}

function openEditModal(item) {
  editingItem.value = item
  Object.assign(form, {
    name: item.name,
    month: item.month,
    day: item.day,
    year: item.year || '',
    type: item.type || 'solar',
    is_leap: item.is_leap === 1 || item.is_leap === true,
    department_id: item.department_id || '',
  })
  showFormModal.value = true
}

function closeFormModal() {
  showFormModal.value = false
  editingItem.value = null
}

async function handleSave() {
  if (!form.name.trim() || !form.month || !form.day) {
    showToast('请填写姓名、月和日', 'error')
    return
  }

  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      month: Number(form.month),
      day: Number(form.day),
      type: form.type,
      is_leap: form.type === 'lunar' ? (form.is_leap ? 1 : 0) : 0,
      department_id: form.department_id ? Number(form.department_id) : null,
    }
    if (form.year) payload.year = Number(form.year)

    if (editingItem.value) {
      await put(`/birthdays/${editingItem.value.id}`, payload)
      showToast('修改成功')
    } else {
      await post('/birthdays', payload)
      showToast('添加成功')
    }
    closeFormModal()
    fetchBirthdays()
  } catch (err) {
    showToast(err.message || '保存失败', 'error')
  } finally {
    saving.value = false
  }
}

// 删除
function handleDelete(item) {
  deleteTarget.value = { id: item.id, name: item.name, batch: false }
  showDeleteConfirm.value = true
}

function handleBatchDelete() {
  deleteTarget.value = { batch: true }
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  deleting.value = true
  try {
    if (deleteTarget.value.batch) {
      const idsToDelete = Array.from(selectedIds.value)
      await post('/birthdays/batch-delete', { ids: idsToDelete })
      showToast(`成功删除 ${idsToDelete.length} 条记录`)
      selectedIds.value = new Set()
      allPagesSelected.value = false
    } else {
      await del(`/birthdays/${deleteTarget.value.id}`)
      showToast('删除成功')
    }
    showDeleteConfirm.value = false
    fetchBirthdays()
  } catch (err) {
    showToast(err.message || '删除失败', 'error')
  } finally {
    deleting.value = false
  }
}

// 批量修改部门
function openBatchDeptModal() {
  batchDeptId.value = ''
  showBatchDeptModal.value = true
}

async function handleBatchDept() {
  saving.value = true
  try {
    const idsToUpdate = Array.from(selectedIds.value)
    await post('/birthdays/batch-update-department', {
      ids: idsToUpdate,
      department_id: batchDeptId.value ? Number(batchDeptId.value) : null,
    })
    showToast('批量修改部门成功')
    showBatchDeptModal.value = false
    selectedIds.value = new Set()
    allPagesSelected.value = false
    fetchBirthdays()
  } catch (err) {
    showToast(err.message || '修改失败', 'error')
  } finally {
    saving.value = false
  }
}

// 导入
function openImportModal() {
  importText.value = ''
  showImportModal.value = true
}

async function handleImport() {
  if (!importText.value.trim()) {
    showToast('请粘贴导入内容', 'error')
    return
  }
  importing.value = true
  try {
    const res = await post('/birthdays/import', { content: importText.value })
    showToast(res.message || `成功 ${res.data?.success || 0} 条`)
    showImportModal.value = false
    fetchBirthdays()
  } catch (err) {
    showToast(err.message || '导入失败', 'error')
  } finally {
    importing.value = false
  }
}

// 导出
async function handleExport() {
  const token = localStorage.getItem('token')
  try {
    let content

    if (selectedCount.value > 0) {
      // 导出选中的
      const idsToExport = Array.from(selectedIds.value)
      const response = await fetch('/api/birthdays/export-selected', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ ids: idsToExport }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.message || '导出失败')
      }

      content = await response.text()
    } else {
      // 没有选中，导出全部
      const response = await fetch('/api/birthdays/export', {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
        },
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.message || '导出失败')
      }
      content = await response.text()
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'birthdays.txt'
    a.click()
    URL.revokeObjectURL(url)
    showToast(selectedCount.value > 0 ? `成功导出 ${selectedCount.value} 条记录` : '导出成功')
  } catch (err) {
    showToast(err.message || '导出失败', 'error')
  }
}

// 详情
function openDetailModal(item) {
  detailItem.value = item
  showDetailModal.value = true
}

onMounted(() => {
  fetchDepartments()
  fetchBirthdays()
})
</script>