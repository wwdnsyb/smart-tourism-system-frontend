import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    // 👇👇👇 新增这一段，专门用来显示酒店页面 👇👇👇
    {
      path: '/hotel',
      name: 'hotel',
      // 这里用了懒加载，和你其他的页面保持一致
      component: () => import('../views/HotelView.vue'),
    },
    // 👆👆👆 新增结束 👆👆👆
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
    },
  ],
})

export default router