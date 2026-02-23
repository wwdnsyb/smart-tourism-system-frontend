import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
// 🔥 1. 新增引入 ElMessage，用于拦截时弹出警告提示
import { ElMessage } from 'element-plus'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/hotel',
      name: 'hotel',
      component: () => import('../views/HotelView.vue'),
    },
    {
      path: '/attraction/:id',
      name: 'attraction-detail',
      component: () => import('../views/AttractionDetail.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/orders',
      name: 'orders',
      component: () => import('../views/OrderView.vue'),
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/hotel/:id',
      name: 'hotel-detail',
      component: () => import('../views/HotelDetail.vue')
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
      // 🔥 2. 给后台页面挂上“需要管理员权限”的牌子
      meta: { requiresAuth: true, requiresAdmin: true } 
    },
    {
      path: '/attractions',
      name: 'attractions',
      component: () => import('../views/AttractionsView.vue')
    },
    {
      path: '/user',
      name: 'user',
      component: () => import('../views/UserView.vue'),
      // 🔥 3. 给个人中心挂上“需要登录”的牌子
      meta: { requiresAuth: true } 
    },
  ],
})

// ==========================================
// 🔥 4. 核心：全局前置路由守卫 (安全拦截门)
// ==========================================
router.beforeEach((to, from, next) => {
  // 尝试从本地缓存中获取用户信息 (兼容 user_info 和 user 两种命名)
  const userInfoStr = localStorage.getItem('user_info') || localStorage.getItem('user')
  const userInfo = userInfoStr ? JSON.parse(userInfoStr) : null

  // 拦截场景 1：如果即将进入的页面需要【管理员权限】(去后台 /admin)
  if (to.meta.requiresAdmin) {
    if (!userInfo) {
      ElMessage.warning('请先登录管理员账号！')
      return next('/login') // 没登录，踢去登录页
    }
    // 判断是不是管理员（限制用户名为 admin 或者角色是 ADMIN）
    if (userInfo.username !== 'admin' && userInfo.role !== 'ADMIN') {
      ElMessage.error('🚨 警告：权限不足，禁止访问后台系统！')
      return next('/') // 权限不够，踢回首页
    }
  }

  // 拦截场景 2：如果即将进入的页面仅仅需要【普通登录】(去个人中心 /user)
  if (to.meta.requiresAuth && !to.meta.requiresAdmin) {
    if (!userInfo) {
      ElMessage.warning('请先登录后再访问个人中心！')
      return next('/login')
    }
  }

  // 场景 3：其他公开页面（首页、酒店列表等），直接放行
  next()
})

export default router