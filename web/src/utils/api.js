const baseURL = '/api'

function getToken() {
  return localStorage.getItem('token')
}

async function request(url, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const config = {
    ...options,
    headers
  }

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body)
  }

  try {
    const response = await fetch(`${baseURL}${url}`, config)

    // 对于登录接口，不做401自动跳转，让前端处理错误
    if (response.status === 401 && url === '/auth/login') {
      const errorData = await response.json().catch(() => ({}))
      return Promise.reject(new Error(errorData.message || '用户名或密码错误'))
    }

    if (response.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
      return Promise.reject(new Error('未授权，请重新登录'))
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.message || errorData.error || `请求失败 (${response.status})`
      return Promise.reject(new Error(errorMessage))
    }

    // 处理 204 No Content
    if (response.status === 204) {
      return null
    }

    // 如果是纯文本或CSV，直接返回文本
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('text/plain') || contentType.includes('text/csv')) {
      return await response.text()
    }

    const json = await response.json()

    // 后端统一返回 { success, data, message } 格式，自动提取 data
    if (json && typeof json === 'object' && 'success' in json) {
      if (!json.success) {
        return Promise.reject(new Error(json.message || '请求失败'))
      }
      // 如果响应中包含分页字段（total/page/pageSize），需要保留这些字段
      if ('total' in json || 'page' in json || 'pageSize' in json || 'page_size' in json) {
        const result = {}
        if (json.data !== undefined) result.data = json.data
        if (json.total !== undefined) result.total = json.total
        if (json.page !== undefined) result.page = json.page
        if (json.pageSize !== undefined) result.pageSize = json.pageSize
        if (json.page_size !== undefined) result.page_size = json.page_size
        if (json.message !== undefined) result.message = json.message
        return result
      }
      return json.data !== undefined ? json.data : json
    }

    return json
  } catch (error) {
    if (error.message === '未授权，请重新登录') {
      throw error
    }
    throw new Error(error.message || '网络请求失败')
  }
}

export function get(url, params) {
  let fullUrl = url
  if (params) {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, value)
      }
    })
    const queryString = searchParams.toString()
    if (queryString) {
      fullUrl += `?${queryString}`
    }
  }
  return request(fullUrl, { method: 'GET' })
}

export function post(url, data) {
  return request(url, {
    method: 'POST',
    body: data
  })
}

export function put(url, data) {
  return request(url, {
    method: 'PUT',
    body: data
  })
}

export function del(url) {
  return request(url, { method: 'DELETE' })
}

export default { get, post, put, del }
