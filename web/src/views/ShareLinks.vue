<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-800">外链管理</h1>
      <button
        @click="openCreateModal"
        class="flex items-center space-x-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm mt-3 sm:mt-0"
      >
        <Plus :size="16" />
        <span>创建外链</span>
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <Loader2 :size="32" class="animate-spin text-blue-500" />
      <span class="ml-3 text-gray-500">加载中...</span>
    </div>

    <!-- 外链列表 -->
    <div v-else class="space-y-4">
      <div
        v-for="link in shareLinks"
        :key="link.id"
        class="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition-shadow"
      >
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-2 mb-1">
              <h3 class="font-semibold text-gray-800 truncate">{{ link.name }}</h3>
              <span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">
                {{ link.person_count || link.count || link.birthday_count || 0 }} 人
              </span>
              <span v-if="link.is_all" class="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                全部人员
              </span>
            </div>
            <p v-if="link.description" class="text-sm text-gray-500 mb-2">{{ link.description }}</p>
            <div class="flex items-center space-x-2 text-xs text-gray-400">
              <span>创建于 {{ formatDate(link.created_at) }}</span>
            </div>
          </div>
          <div class="flex items-center space-x-2 flex-shrink-0">
            <button
              @click="previewLink(link)"
              class="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              title="预览"
            >
              <Eye :size="14" />
              <span class="hidden sm:inline">预览</span>
            </button>
            <button
              @click="copyLink(link)"
              class="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
              title="复制链接"
            >
              <Copy :size="14" />
              <span class="hidden sm:inline">复制</span>
            </button>
            <button
              @click="openEditModal(link)"
              class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="编辑"
            >
              <Pencil :size="16" />
            </button>
            <button
              @click="handleDelete(link)"
              class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="删除"
            >
              <Trash2 :size="16" />
            </button>
          </div>
        </div>
        <!-- 外链地址 -->
        <div class="mt-3 flex items-center space-x-2 bg-gray-50 rounded-lg px-3 py-2">
          <Link :size="14" class="text-gray-400 flex-shrink-0" />
          <span class="text-sm text-blue-600 truncate flex-1">{{ getLinkUrl(link) }}</span>
        </div>
      </div>

      <div v-if="shareLinks.length === 0" class="text-center py-12 text-gray-400">
        暂无外链，点击上方按钮创建
      </div>
    </div>

    <!-- 创建/编辑模态框 -->
    <Teleport to="body">
      <div v-if="showFormModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-800">
              {{ editingItem ? '编辑外链' : '创建外链' }}
            </h3>
            <button @click="closeFormModal" class="p-1 hover:bg-gray-100 rounded-lg transition-colors">
              <X :size="20" />
            </button>
          </div>
          <form @submit.prevent="handleSave" class="p-5 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">外链名称 <span class="text-red-500">*</span></label>
              <input
                v-model="form.name"
                type="text"
                placeholder="请输入外链名称"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">外链描述</label>
              <textarea
                v-model="form.description"
                rows="2"
                placeholder="可选描述信息"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              ></textarea>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">选择范围 <span class="text-red-500">*</span></label>
              <div class="space-y-2">
                <label class="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    v-model="form.scope"
                    value="all"
                    class="text-blue-600"
                  />
                  <span class="text-sm text-gray-700">全部人员 ({{ allPersons.length }} 人)</span>
                </label>
                <label class="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    v-model="form.scope"
                    value="partial"
                    class="text-blue-600"
                  />
                  <span class="text-sm text-gray-700">选择部分人员</span>
                </label>
              </div>
            </div>

            <!-- 人员选择 -->
            <div v-if="form.scope === 'partial'" class="border border-gray-200 rounded-lg p-3">
              <!-- 部门筛选 -->
              <div class="mb-3">
                <label class="block text-xs text-gray-500 mb-1">按分类筛选</label>
                <select
                  v-model="selectedDepartment"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">全部分类 ({{ allPersons.length }} 人)</option>
                  <option v-for="dept in departments" :key="dept.id" :value="dept.id">
                    {{ dept.name }}
                  </option>
                </select>
              </div>
              <!-- 搜索 -->
              <div class="relative mb-3">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" :size="16" />
                <input
                  v-model="personSearch"
                  type="text"
                  placeholder="搜索人员..."
                  class="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <!-- 全选/取消全选 -->
              <div class="flex items-center justify-between mb-2 px-2">
                <label class="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    :checked="isAllFilteredSelected"
                    :indeterminate.prop="isSomeFilteredSelected"
                    @change="toggleSelectAllFiltered"
                    class="rounded border-gray-300 text-blue-600"
                  />
                  <span class="text-xs text-gray-600">全选当前筛选 ({{ filteredPersons.length }} 人)</span>
                </label>
                <button
                  type="button"
                  @click="form.person_ids = []"
                  class="text-xs text-red-500 hover:text-red-600"
                >
                  清空选择
                </button>
              </div>
              <!-- 人员列表 -->
              <div class="max-h-64 overflow-y-auto space-y-1 border-t border-gray-100 pt-2">
                <label
                  v-for="person in filteredPersons"
                  :key="person.id"
                  class="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :value="person.id"
                    v-model="form.person_ids"
                    class="rounded border-gray-300 text-blue-600"
                  />
                  <span class="text-sm text-gray-700">{{ person.name }}</span>
                  <span v-if="person.department_name" class="text-xs text-gray-400">
                    ({{ person.department_name }})
                  </span>
                  <span v-if="person.type === 'lunar'" class="text-xs text-amber-500">农历</span>
                </label>
                <div v-if="filteredPersons.length === 0" class="text-center text-sm text-gray-400 py-4">
                  暂无匹配人员
                </div>
              </div>
              <p class="text-xs text-gray-500 mt-2">已选择 {{ form.person_ids.length }} 人</p>
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

    <!-- 预览模态框 -->
    <Teleport to="body">
      <div v-if="showPreviewModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-800">预览 - {{ previewTitle }}</h3>
            <button @click="showPreviewModal = false" class="p-1 hover:bg-gray-100 rounded-lg transition-colors">
              <X :size="20" />
            </button>
          </div>
          <div class="p-5">
            <div v-if="previewLoading" class="flex items-center justify-center py-10">
              <Loader2 :size="24" class="animate-spin text-blue-500" />
              <span class="ml-2 text-gray-500">加载中...</span>
            </div>
            <pre v-else-if="previewContent" class="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">{{ previewContent }}</pre>
            <p v-else class="text-center text-gray-400 py-10">无法加载预览内容</p>
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
            确定要删除外链「{{ deleteTarget?.name }}」吗？此操作不可撤销。
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
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject, watch } from 'vue'
import { get, post, put, del } from '../utils/api'
import {
  Plus, Pencil, Trash2, X, Loader2, Link, Copy, Eye, Search
} from 'lucide-vue-next'

const showToast = inject('showToast')

const loading = ref(true)
const shareLinks = ref([])
const allPersons = ref([])  // 所有人员，一次性获取
const departments = ref([])
const selectedDepartment = ref('')

const showFormModal = ref(false)
const showDeleteConfirm = ref(false)
const showPreviewModal = ref(false)
const editingItem = ref(null)
const saving = ref(false)
const deleting = ref(false)
const deleteTarget = ref(null)

const previewTitle = ref('')
const previewContent = ref('')
const previewLoading = ref(false)

const personSearch = ref('')

const form = reactive({
  name: '',
  description: '',
  scope: 'all',
  person_ids: []
})

const filteredPersons = computed(() => {
  let result = allPersons.value

  if (selectedDepartment.value) {
    const deptId = Number(selectedDepartment.value)
    result = result.filter(p => p.department_id === deptId)
  }

  if (personSearch.value.trim()) {
    const keyword = personSearch.value.trim().toLowerCase()
    result = result.filter(p =>
      (p.name || '').toLowerCase().includes(keyword) ||
      ((p.department_name || '')).toLowerCase().includes(keyword)
    )
  }

  return result
})

const isAllFilteredSelected = computed(() => {
  if (filteredPersons.value.length === 0) return false
  return filteredPersons.value.every(p => form.person_ids.includes(p.id))
})

const isSomeFilteredSelected = computed(() => {
  if (filteredPersons.value.length === 0) return false
  if (isAllFilteredSelected.value) return false
  return filteredPersons.value.some(p => form.person_ids.includes(p.id))
})

function toggleSelectAllFiltered() {
  const filteredIds = filteredPersons.value.map(p => p.id)
  if (isAllFilteredSelected.value) {
    form.person_ids = form.person_ids.filter(id => !filteredIds.includes(id))
  } else {
    const merged = new Set([...form.person_ids, ...filteredIds])
    form.person_ids = Array.from(merged)
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function getLinkUrl(link) {
  if (link.url) return link.url
  if (link.token) {
    return `${window.location.origin}/api/s/${link.token}`
  }
  return `${window.location.origin}/api/s/${link.id}`
}

async function fetchShareLinks() {
  loading.value = true
  try {
    const data = await get('/share-links')
    shareLinks.value = Array.isArray(data) ? data : (data.share_links || data.data || data.items || [])
  } catch (err) {
    showToast(err.message || '获取外链列表失败', 'error')
  } finally {
    loading.value = false
  }
}

// 一次性获取所有人员（不分页）— 使用专门的 API
async function fetchAllPersons() {
  try {
    const data = await get('/share-links/all-persons')
    if (data && typeof data === 'object' && !Array.isArray(data) && 'data' in data) {
      allPersons.value = data.data || []
    } else if (Array.isArray(data)) {
      allPersons.value = data
    } else {
      allPersons.value = data.birthdays || data.items || []
    }
  } catch (err) {
    console.error('获取人员列表失败:', err)
  }
}

async function fetchDepartments() {
  try {
    const data = await get('/departments')
    departments.value = Array.isArray(data) ? data : (data.departments || data.data || [])
  } catch (err) {
    console.error('获取部门列表失败:', err)
  }
}

function openCreateModal() {
  editingItem.value = null
  Object.assign(form, { name: '', description: '', scope: 'all', person_ids: [] })
  personSearch.value = ''
  selectedDepartment.value = ''
  showFormModal.value = true
}

async function openEditModal(link) {
  editingItem.value = link
  Object.assign(form, {
    name: link.name,
    description: link.description || '',
    scope: link.is_all ? 'all' : 'partial',
    person_ids: []
  })
  personSearch.value = ''
  selectedDepartment.value = ''

  if (!link.is_all) {
    try {
      const data = await get(`/share-links/${link.id}/birthdays`)
      const list = Array.isArray(data) ? data : (data.data || data.items || [])
      form.person_ids = list.map(b => b.id)
    } catch (err) {
      console.error('获取外链关联生日失败:', err)
    }
  }

  showFormModal.value = true
}

function closeFormModal() {
  showFormModal.value = false
  editingItem.value = null
}

async function handleSave() {
  if (!form.name.trim()) {
    showToast('请输入外链名称', 'error')
    return
  }

  if (form.scope === 'partial' && form.person_ids.length === 0) {
    showToast('请至少选择一个人员', 'error')
    return
  }

  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      description: form.description || null,
      is_all: form.scope === 'all',
      birthday_ids: form.scope === 'partial' ? form.person_ids : []
    }

    if (editingItem.value) {
      await put(`/share-links/${editingItem.value.id}`, payload)
      showToast('修改成功')
    } else {
      await post('/share-links', payload)
      showToast('创建成功')
    }
    closeFormModal()
    fetchShareLinks()
  } catch (err) {
    showToast(err.message || '保存失败', 'error')
  } finally {
    saving.value = false
  }
}

function handleDelete(link) {
  deleteTarget.value = link
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  deleting.value = true
  try {
    await del(`/share-links/${deleteTarget.value.id}`)
    showToast('删除成功')
    showDeleteConfirm.value = false
    fetchShareLinks()
  } catch (err) {
    showToast(err.message || '删除失败', 'error')
  } finally {
    deleting.value = false
  }
}

async function copyLink(link) {
  const url = getLinkUrl(link)
  try {
    await navigator.clipboard.writeText(url)
    showToast('链接已复制到剪贴板')
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = url
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    showToast('链接已复制到剪贴板')
  }
}

async function previewLink(link) {
  previewTitle.value = link.name
  previewContent.value = ''
  previewLoading.value = true
  showPreviewModal.value = true

  try {
    const url = getLinkUrl(link)
    const response = await fetch(url)
    if (response.ok) {
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const data = await response.json()
        previewContent.value = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
      } else {
        previewContent.value = await response.text()
      }
    } else {
      previewContent.value = '无法加载预览内容'
    }
  } catch {
    previewContent.value = '网络请求失败，无法预览'
  } finally {
    previewLoading.value = false
  }
}

onMounted(() => {
  fetchShareLinks()
  fetchAllPersons()
  fetchDepartments()
})
</script>