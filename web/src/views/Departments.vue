<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-800">人员分类</h1>
      <button
        @click="openAddModal"
        class="flex items-center space-x-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm mt-3 sm:mt-0"
      >
        <Plus :size="16" />
        <span>添加分类</span>
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <Loader2 :size="32" class="animate-spin text-blue-500" />
      <span class="ml-3 text-gray-500">加载中...</span>
    </div>

    <!-- 分类列表 -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="dept in departments"
        :key="dept.id"
        class="bg-white rounded-xl shadow-sm p-5 border border-gray-100 hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between">
          <div class="flex items-center space-x-3 flex-1 min-w-0">
            <div class="bg-blue-100 p-2.5 rounded-lg">
              <Building2 :size="20" class="text-blue-600" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-gray-800 truncate">{{ dept.name }}</h3>
              <p class="text-sm text-gray-500 mt-0.5">
                {{ dept.birthday_count || dept.count || dept.person_count || 0 }} 人
              </p>
            </div>
          </div>
          <div class="flex items-center space-x-1 flex-shrink-0">
            <button
              @click="openPersonsModal(dept)"
              class="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="查看人员"
            >
              <Users :size="16" />
            </button>
            <button
              @click="openEditModal(dept)"
              class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="编辑"
            >
              <Pencil :size="16" />
            </button>
            <button
              @click="handleDelete(dept)"
              class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="删除"
            >
              <Trash2 :size="16" />
            </button>
          </div>
        </div>
        <!-- 操作栏：快捷查看 -->
        <div class="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
          <span class="text-gray-400">点击"人员图标"查看详情</span>
          <button
            @click="openPersonsModal(dept)"
            class="text-blue-600 hover:text-blue-700 hover:underline"
          >
            查看人员 →
          </button>
        </div>
      </div>

      <div v-if="departments.length === 0" class="col-span-full text-center py-12 text-gray-400">
        暂无分类，点击上方按钮添加
      </div>
    </div>

    <!-- 添加/编辑模态框 -->
    <Teleport to="body">
      <div v-if="showFormModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm">
          <div class="flex items-center justify-between p-5 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-800">
              {{ editingItem ? '编辑分类' : '添加分类' }}
            </h3>
            <button @click="closeFormModal" class="p-1 hover:bg-gray-100 rounded-lg transition-colors">
              <X :size="20" />
            </button>
          </div>
          <form @submit.prevent="handleSave" class="p-5 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">分类名称 <span class="text-red-500">*</span></label>
              <input
                v-model="form.name"
                type="text"
                placeholder="请输入分类名称"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
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

    <!-- 确认删除模态框 -->
    <Teleport to="body">
      <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
          <h3 class="text-lg font-semibold text-gray-800 mb-2">确认删除</h3>
          <p class="text-sm text-gray-600 mb-6">
            确定要删除分类「{{ deleteTarget?.name }}」吗？
            <span v-if="(deleteTarget?.birthday_count || deleteTarget?.count || 0) > 0" class="text-red-500">
              该分类下有 {{ deleteTarget?.birthday_count || deleteTarget?.count || 0 }} 人，删除后这些人员将变为未分配分类。
            </span>
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

    <!-- 查看分类人员模态框 -->
    <Teleport to="body">
      <div v-if="showPersonsModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <div class="flex items-center justify-between p-5 border-b border-gray-200">
            <div class="flex items-center space-x-3">
              <div class="bg-blue-100 p-2 rounded-lg">
                <Building2 :size="20" class="text-blue-600" />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-800">{{ personsDept?.name }}</h3>
                <p class="text-xs text-gray-500 mt-0.5">共 {{ persons.length }} 人</p>
              </div>
            </div>
            <button @click="closePersonsModal" class="p-1 hover:bg-gray-100 rounded-lg transition-colors">
              <X :size="20" />
            </button>
          </div>

          <!-- 人员搜索 -->
          <div class="p-4 border-b border-gray-100">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" :size="16" />
              <input
                v-model="personSearch"
                type="text"
                placeholder="搜索人员姓名..."
                class="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <!-- 人员列表 -->
          <div class="flex-1 overflow-y-auto p-4">
            <div v-if="personsLoading" class="flex items-center justify-center py-12">
              <Loader2 :size="24" class="animate-spin text-blue-500" />
              <span class="ml-2 text-gray-500">加载中...</span>
            </div>
            <div v-else-if="filteredPersons.length === 0" class="text-center py-12 text-gray-400">
              {{ persons.length === 0 ? '该分类下暂无人员' : '未找到匹配的人员' }}
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="person in filteredPersons"
                :key="person.id"
                class="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div class="flex items-center space-x-3 flex-1 min-w-0">
                  <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Users :size="14" class="text-blue-600" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-800 truncate">{{ person.name }}</p>
                    <p class="text-xs text-gray-400">
                      {{ person.month }}月{{ person.day }}日
                      <span v-if="person.is_leap" class="text-amber-600">(闰)</span>
                      <span v-if="person.year" class="text-gray-400 ml-1">({{ person.year }}年)</span>
                    </p>
                  </div>
                </div>
                <div class="flex items-center space-x-2 flex-shrink-0">
                  <span
                    :class="person.type === 'solar' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
                    class="px-2 py-0.5 rounded-full text-xs font-medium"
                  >
                    {{ person.type === 'solar' ? '公历' : '农历' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部操作 -->
          <div class="p-4 border-t border-gray-100 flex items-center justify-between">
            <p class="text-xs text-gray-500">
              显示 {{ filteredPersons.length }} / {{ persons.length }} 人
            </p>
            <button
              @click="closePersonsModal"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { get, post, put, del } from '../utils/api'
import { Plus, Pencil, Trash2, X, Loader2, Building2, Users, Search } from 'lucide-vue-next'

const showToast = inject('showToast')

const loading = ref(true)
const departments = ref([])
const showFormModal = ref(false)
const showDeleteConfirm = ref(false)
const showPersonsModal = ref(false)
const editingItem = ref(null)
const saving = ref(false)
const deleting = ref(false)
const deleteTarget = ref(null)

// 查看人员相关
const personsDept = ref(null)
const persons = ref([])
const personsLoading = ref(false)
const personSearch = ref('')

const filteredPersons = computed(() => {
  if (!personSearch.value.trim()) return persons.value
  const keyword = personSearch.value.trim().toLowerCase()
  return persons.value.filter(p => (p.name || '').toLowerCase().includes(keyword))
})

const form = reactive({
  name: ''
})

async function fetchDepartments() {
  loading.value = true
  try {
    const data = await get('/departments')
    departments.value = Array.isArray(data) ? data : (data.departments || data.data || [])
  } catch (err) {
    showToast(err.message || '获取分类列表失败', 'error')
  } finally {
    loading.value = false
  }
}

function openAddModal() {
  editingItem.value = null
  form.name = ''
  showFormModal.value = true
}

function openEditModal(dept) {
  editingItem.value = dept
  form.name = dept.name
  showFormModal.value = true
}

function closeFormModal() {
  showFormModal.value = false
  editingItem.value = null
}

async function handleSave() {
  if (!form.name.trim()) {
    showToast('请输入分类名称', 'error')
    return
  }

  saving.value = true
  try {
    if (editingItem.value) {
      await put(`/departments/${editingItem.value.id}`, { name: form.name.trim() })
      showToast('修改成功')
    } else {
      await post('/departments', { name: form.name.trim() })
      showToast('添加成功')
    }
    closeFormModal()
    fetchDepartments()
  } catch (err) {
    showToast(err.message || '保存失败', 'error')
  } finally {
    saving.value = false
  }
}

function handleDelete(dept) {
  deleteTarget.value = dept
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  deleting.value = true
  try {
    await del(`/departments/${deleteTarget.value.id}`)
    showToast('删除成功')
    showDeleteConfirm.value = false
    fetchDepartments()
  } catch (err) {
    showToast(err.message || '删除失败', 'error')
  } finally {
    deleting.value = false
  }
}

// 查看人员
async function openPersonsModal(dept) {
  personsDept.value = dept
  personSearch.value = ''
  persons.value = []
  showPersonsModal.value = true
  await fetchPersons(dept.id)
}

async function fetchPersons(deptId) {
  personsLoading.value = true
  try {
    const data = await get(`/departments/${deptId}/persons`)
    if (data && typeof data === 'object' && !Array.isArray(data) && 'data' in data) {
      persons.value = data.data?.persons || []
    } else if (data?.persons) {
      persons.value = data.persons
    } else if (Array.isArray(data)) {
      persons.value = data
    } else {
      persons.value = []
    }
  } catch (err) {
    showToast(err.message || '获取人员失败', 'error')
    persons.value = []
  } finally {
    personsLoading.value = false
  }
}

function closePersonsModal() {
  showPersonsModal.value = false
  personsDept.value = null
  personSearch.value = ''
}

onMounted(() => {
  fetchDepartments()
})
</script>