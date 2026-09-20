import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/birthdays',
    name: 'Birthdays',
    component: () => import('../views/Birthdays.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/departments',
    name: 'Departments',
    component: () => import('../views/Departments.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/share-links',
    name: 'ShareLinks',
    component: () => import('../views/ShareLinks.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')

  if (to.meta.requiresAuth && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/')
  } else {
    next()
  }
})

export default router
