<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { ElMessage } from 'element-plus'
import { Location, Star, Filter, Calendar } from '@element-plus/icons-vue' // 补充高级图标

const router = useRouter()
const { userInfo, logout } = useAuth()
const axios = window.axios

const attractions = ref([])
const searchQuery = ref('')
const selectedCategory = ref('全部')

const categories = [
  { label: '全部', value: '全部' },
  { label: '自然风光', value: '自然风光' },
  { label: '历史古迹', value: '历史古迹' },
  { label: '主题乐园', value: '主题乐园' }
]

// 请求后端真实景点数据
const fetchAttractions = async () => {
  try {
    const res = await axios.get('http://localhost:8080/api/scenic-spots')
    attractions.value = res.data.map(item => ({
      ...item,
      image: item.imageUrl || item.image || `https://picsum.photos/800/600?random=${item.id}`,
      rating: item.rating ? Number(item.rating) : 4.8,
      price: item.price || 0,
      // 给景点加上高逼格的随机标签
      tags: ['AAAAA景区', '出片圣地', '亲子必游', '历史文化', '天然氧吧'].sort(() => 0.5 - Math.random()).slice(0, 2)
    }))
  } catch (error) {
    ElMessage.error('获取景点列表失败，请检查后端')
  }
}

onMounted(() => {
  fetchAttractions()
})

// 筛选逻辑
const filteredAttractions = computed(() => {
  let result = [...attractions.value]
  if (selectedCategory.value !== '全部') {
    result = result.filter(item => item.category === selectedCategory.value)
  }
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.trim().toLowerCase()
    result = result.filter(item =>
      (item.name && item.name.toLowerCase().includes(query)) ||
      (item.address && item.address.toLowerCase().includes(query))
    )
  }
  return result
})

// 跳转详情页
const goToDetail = (id) => {
  router.push({ name: 'attraction-detail', params: { id: id } })
}
</script>

<template>
  <div class="attractions-page">
    <header class="navbar">
      <div class="navbar-container">
        <div class="navbar-brand">
          <h1 class="brand-title">智慧旅游</h1>
        </div>
        <nav class="navbar-menu">
          <router-link to="/" class="menu-item" active-class="active">首页</router-link>
          <router-link to="/attractions" class="menu-item" active-class="active">景点</router-link>
          <router-link to="/hotel" class="menu-item" active-class="active">酒店</router-link>

          <template v-if="userInfo">
            <span class="welcome-text">欢迎，{{ userInfo.username }}</span>
            <el-button type="warning" round @click="$router.push('/user')" style="margin-right: 10px;">
              👤 个人中心
            </el-button>
            <el-button v-if="userInfo.role === 'ADMIN' || userInfo.username === 'admin'" type="danger" round
              size="small" @click="router.push('/admin')">后台管理</el-button>
            <el-button type="info" size="small" round plain @click="logout">退出</el-button>
          </template>
          <template v-else>
            <el-button type="primary" round size="small" @click="router.push('/login')">登录/注册</el-button>
          </template>
        </nav>
      </div>
    </header>

    <div class="attraction-banner">
      <div class="banner-content">
        <h2>✨ 探索奇妙世界 ✨</h2>
        <p>发现最美的风景，开启属于你的奇妙旅程</p>
      </div>
    </div>

    <div class="main-content">
      <div class="filter-bar">
        <div class="category-filter">
          <span class="filter-label">
            <el-icon style="margin-right: 4px;">
              <Filter />
            </el-icon>景点分类：
          </span>
          <el-radio-group v-model="selectedCategory" size="large">
            <el-radio-button v-for="category in categories" :key="category.value" :label="category.value">
              {{ category.label }}
            </el-radio-button>
          </el-radio-group>
        </div>
        <div class="search-box">
          <el-input v-model="searchQuery" placeholder="搜索景点名称或位置..." prefix-icon="Search" size="large" clearable />
        </div>
      </div>

      <el-empty v-if="filteredAttractions.length === 0" description="暂无匹配的景点数据，换个词试试吧~" />

      <el-row :gutter="24" class="attraction-grid">
        <el-col v-for="(attraction, index) in filteredAttractions" :key="attraction.id" :xs="24" :sm="12" :md="8"
          :lg="6" class="animate-card" :style="{ animationDelay: `${index * 0.1}s` }">

          <el-card class="attraction-card" shadow="hover" :body-style="{ padding: '0px' }"
            @click="goToDetail(attraction.id)">
            <div class="card-image-wrapper">

              <div v-if="attraction.rating >= 4.8" class="badge hot-badge">🔥 必去高分</div>
              <div v-else-if="attraction.price <= 100" class="badge value-badge">💰 超值特惠</div>

              <img :src="attraction.image" :alt="attraction.name" class="card-image">

              <div class="rating-badge">
                <el-icon>
                  <Star />
                </el-icon> {{ attraction.rating }}
              </div>
            </div>

            <div class="card-content">
              <h3 class="card-title">{{ attraction.name }}</h3>

              <div class="card-tags">
                <el-tag v-for="(tag, i) in attraction.tags" :key="i" size="small" effect="light" type="success" round
                  class="tag-item">
                  {{ tag }}
                </el-tag>
              </div>

              <p class="card-description">{{ attraction.description || '暂无详细介绍，等您来探索...' }}</p>

              <div class="card-footer">
                <div class="price-box">
                  <span class="price-symbol">¥</span>
                  <span class="price-value">{{ attraction.price }}</span>
                  <span class="price-unit">/人</span>
                </div>
                <el-button type="success" round class="book-btn">
                  <el-icon style="margin-right: 4px;">
                    <Calendar />
                  </el-icon>查看详情
                </el-button>
              </div>
            </div>
          </el-card>

        </el-col>
      </el-row>
    </div>
  </div>
</template>

<style scoped>
/* 🔥 修复 1：去掉实心灰底，改为透明，并设置定位层级 */
.attractions-page {
  min-height: 100vh;
  background-color: transparent; 
  padding-bottom: 80px;
  position: relative;
  z-index: 1;
}

/* 🔥 修复 2：加入景点页专属的自然森林背景 */
.attractions-page::before {
  content: '';
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  /* 清新治愈的森林溪流 */
  background: url('https://images.unsplash.com/photo-1433086966358-54859d0ed716?q=80&w=2000&auto=format&fit=crop') center/cover no-repeat;
  opacity: 0.25; /* 25%透明度，高级且不抢戏 */
  z-index: -1;
  pointer-events: none;
}

/* 导航栏样式 (加入毛玻璃高级效果) */
.navbar {
  width: 100%;
  background-color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.navbar-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 70px;
}

.brand-title {
  font-size: 28px;
  font-weight: 800;
  background: linear-gradient(135deg, #409eff 0%, #36d1dc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
  letter-spacing: 1px;
}

.navbar-menu {
  display: flex;
  gap: 32px;
  align-items: center;
}

.menu-item {
  color: #606266;
  text-decoration: none;
  font-size: 16px;
  font-weight: 500;
  transition: color 0.3s ease;
  position: relative;
}

.menu-item:hover,
.menu-item.active {
  color: #409eff;
}

.menu-item.active::after {
  content: '';
  position: absolute;
  bottom: -10px;
  left: 0;
  right: 0;
  height: 3px;
  background-color: #409eff;
  border-radius: 2px;
}

.welcome-text {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
  margin-right: 12px;
}

/* 🔥 UI 升级：沉浸式 Banner */
.attraction-banner {
  height: 350px;
  background: linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.2)), url('https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=2070') center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: white;
  margin-bottom: 20px;
}

.banner-content h2 {
  font-size: 48px;
  font-weight: 800;
  margin: 0 0 15px 0;
  letter-spacing: 3px;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
}

.banner-content p {
  font-size: 20px;
  margin: 0;
  opacity: 0.95;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
  letter-spacing: 1px;
}

/* 主体内容区 */
.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

/* 🔥 UI 升级：悬浮式筛选栏 */
.filter-bar {
  background: white;
  padding: 20px 24px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: -60px;
  /* 向上浮动盖住Banner */
  margin-bottom: 40px;
  position: relative;
  z-index: 10;
  flex-wrap: wrap;
  gap: 20px;
}

.category-filter {
  display: flex;
  align-items: center;
}

.filter-label {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-right: 15px;
  display: flex;
  align-items: center;
}

.search-box {
  width: 350px;
}

/* 🔥 UI 升级：卡片入场动画 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-card {
  animation: fadeInUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
}

.attraction-grid {
  margin-top: 20px;
}

/* 卡片样式优化 */
.attraction-card {
  border-radius: 16px;
  border: none;
  transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  margin-bottom: 30px;
  overflow: hidden;
  cursor: pointer;
  background: #ffffff; /* 卡片本身保持白底，衬托出背后的风景 */
}

.attraction-card:hover {
  transform: translateY(-10px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1) !important;
}

.card-image-wrapper {
  position: relative;
  width: 100%;
  height: 220px;
  overflow: hidden;
}

.card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
  display: block;
}

.attraction-card:hover .card-image {
  transform: scale(1.08);
}

/* 🔥 UI 升级：左上角高级角标 */
.badge {
  position: absolute;
  top: 15px;
  left: 15px;
  color: #fff;
  padding: 6px 14px;
  border-radius: 8px 2px 8px 2px;
  font-size: 13px;
  font-weight: bold;
  z-index: 10;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  letter-spacing: 1px;
}

.hot-badge {
  background: linear-gradient(135deg, #ff6b6b, #ff4757);
}

.value-badge {
  background: linear-gradient(135deg, #67c23a, #95d475);
}

/* 🔥 UI 升级：右下角毛玻璃评分徽章 */
.rating-badge {
  position: absolute;
  bottom: 15px;
  right: 15px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  color: #fff;
  padding: 6px 12px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.card-content {
  padding: 20px;
}

.card-title {
  font-size: 20px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 12px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-tags {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.card-description {
  font-size: 13px;
  color: #909399;
  line-height: 1.6;
  margin: 0 0 16px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  height: 42px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-top: 1px dashed #ebeef5;
  padding-top: 16px;
}

.price-box {
  color: #f56c6c;
}

.price-symbol {
  font-size: 16px;
  font-weight: bold;
}

.price-value {
  font-size: 28px;
  font-weight: 800;
  margin: 0 2px;
}

.price-unit {
  font-size: 13px;
  color: #909399;
}

/* 🔥 UI 升级：圆角渐变按钮 */
.book-btn {
  padding: 10px 20px;
  font-weight: bold;
  font-size: 14px;
  background: linear-gradient(135deg, #67c23a, #529b2e);
  border: none;
  transition: all 0.3s;
}

.book-btn:hover {
  background: linear-gradient(135deg, #85ce61, #67c23a);
  box-shadow: 0 4px 12px rgba(103, 194, 58, 0.4);
}

@media (max-width: 768px) {
  .filter-bar {
    flex-direction: column;
    align-items: stretch;
    margin-top: -30px;
  }

  .search-box {
    width: 100%;
  }

  .banner-content h2 {
    font-size: 32px;
  }
}
</style>