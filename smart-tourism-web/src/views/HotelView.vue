<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { ElMessage } from 'element-plus'
import { Location, Star } from '@element-plus/icons-vue'

const router = useRouter()
const { userInfo, logout } = useAuth()
const axios = window.axios

const hotels = ref([])
const searchQuery = ref('')
const selectedStar = ref(0) // 0代表全部

// 请求后端真实酒店数据
const fetchHotels = async () => {
  try {
    const res = await axios.get('http://localhost:8080/api/hotels')
    // 映射 imageUrl 到 image，防止图片裂开
    hotels.value = res.data.map(item => ({
      ...item,
      image: item.imageUrl || item.image || 'https://picsum.photos/800/600?hotel',
      rating: item.rating ? Number(item.rating) : 4.8,
      price: item.price || 0,
      // 随机给几个高大上的标签，如果你的数据库里有 tags 字段，就直接用 item.tags
      tags: ['免费Wi-Fi', '健身房', '含早餐'].slice(0, Math.floor(Math.random() * 3) + 1)
    }))
  } catch (error) {
    console.error('获取酒店数据失败:', error)
    ElMessage.error('无法同步酒店数据，请检查后端服务')
  }
}

onMounted(() => {
  fetchHotels()
})

// 搜索和星级过滤逻辑
const filteredHotels = computed(() => {
  let result = [...hotels.value]
  
  // 按星级过滤
  if (selectedStar.value > 0) {
    // 假设 rating 是 4.5，按 4 星或 5 星算都可以，这里粗略匹配整数部分
    result = result.filter(item => Math.floor(item.rating) === selectedStar.value)
  }
  
  // 按名称或地址搜索
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.trim().toLowerCase()
    result = result.filter(item => 
      (item.name && item.name.toLowerCase().includes(query)) ||
      (item.address && item.address.toLowerCase().includes(query))
    )
  }
  
  return result
})

// 点击预订按钮
const handleBook = (hotel) => {
  if (!userInfo.value) {
    ElMessage.warning('请先登录后再预订')
    router.push('/login')
    return
  }
  ElMessage.success(`准备预订：${hotel.name}，跳转开发中...`)
  // 等你以后建了 HotelDetail.vue 可以用这行：
  router.push({ name: 'hotel-detail', params: { id: hotel.id } })
}
</script>

<template>
  <div class="hotel-view">
    <header class="navbar">
      <div class="navbar-container">
        <div class="navbar-brand">
          <h1 class="brand-title">智慧旅游</h1>
        </div>
        <nav class="navbar-menu">
          <router-link to="/" class="menu-item" active-class="active">首页</router-link>
          <router-link to="/#attractions-list" class="menu-item">景点</router-link>
          <router-link to="/hotel" class="menu-item" active-class="active">酒店</router-link>
          
          <template v-if="userInfo">
            <span class="welcome-text">欢迎，{{ userInfo.username }}</span>
            <el-button type="warning" @click="$router.push('/user')" style="margin-right: 10px;">
              👤 个人中心
            </el-button>
            <el-button v-if="userInfo.role === 'ADMIN' || userInfo.username === 'admin'" type="danger" size="small" @click="router.push('/admin')">后台管理</el-button>
            <el-button type="info" size="small" plain @click="logout">退出</el-button>
          </template>
          <template v-else>
            <el-button type="primary" size="small" @click="router.push('/login')">登录/注册</el-button>
          </template>
        </nav>
      </div>
    </header>

    <div class="hotel-banner">
      <div class="banner-content">
        <h2>精选品质酒店</h2>
        <p>为您提供温馨、舒适的住宿体验，让旅途像家一样</p>
      </div>
    </div>

    <div class="main-container">
      
      <div class="filter-bar">
        <div class="star-filter">
          <span class="filter-label">酒店星级：</span>
          <el-radio-group v-model="selectedStar" size="large">
            <el-radio-button :label="0">全部</el-radio-button>
            <el-radio-button :label="5">五星级/豪华</el-radio-button>
            <el-radio-button :label="4">四星级/高档</el-radio-button>
            <el-radio-button :label="3">经济/快捷</el-radio-button>
          </el-radio-group>
        </div>
        <div class="search-box">
          <el-input
            v-model="searchQuery"
            placeholder="搜索酒店名称或位置..."
            prefix-icon="Search"
            size="large"
            clearable
          />
        </div>
      </div>

      <el-empty v-if="filteredHotels.length === 0" description="没有找到符合条件的酒店" />

      <el-row :gutter="24" class="hotel-grid">
        <el-col
          v-for="hotel in filteredHotels"
          :key="hotel.id"
          :xs="24"
          :sm="24"
          :md="12"
          :lg="8"
        >
          <el-card class="hotel-card" shadow="hover" :body-style="{ padding: '0px' }">
            <div class="card-image-wrapper">
              <img :src="hotel.image" :alt="hotel.name" class="hotel-image">
              <div class="rating-badge">
                <el-icon><Star /></el-icon> {{ hotel.rating }}
              </div>
            </div>
            
            <div class="hotel-info">
              <h3 class="hotel-name">{{ hotel.name }}</h3>
              
              <div class="hotel-location">
                <el-icon><Location /></el-icon>
                <span>{{ hotel.address }}</span>
              </div>
              
              <div class="hotel-tags">
                <el-tag 
                  v-for="(tag, index) in hotel.tags" 
                  :key="index"
                  size="small"
                  type="info"
                  effect="plain"
                  class="tag-item"
                >
                  {{ tag }}
                </el-tag>
              </div>
              
              <div class="hotel-footer">
                <div class="price-box">
                  <span class="price-symbol">¥</span>
                  <span class="price-value">{{ hotel.price }}</span>
                  <span class="price-unit">起</span>
                </div>
                <el-button type="primary" class="book-btn" @click="handleBook(hotel)">
                  查看并预订
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
.hotel-view {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding-bottom: 60px;
}

/* 导航栏样式 (复用首页) */
.navbar {
  width: 100%;
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
  font-weight: 700;
  color: #409eff;
  margin: 0;
  background: linear-gradient(135deg, #409eff 0%, #67c23a 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
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
.menu-item:hover, .menu-item.active { color: #409eff; }
.menu-item.active::after {
  content: ''; position: absolute; bottom: -8px; left: 0; right: 0; height: 2px; background-color: #409eff;
}
.welcome-text { color: #606266; font-size: 14px; margin-right: 12px; }

/* 酒店顶部 Banner */
.hotel-banner {
  height: 300px;
  background: linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1920') center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: white;
  margin-bottom: 40px;
}
.banner-content h2 {
  font-size: 42px;
  font-weight: bold;
  margin: 0 0 15px 0;
  letter-spacing: 2px;
  text-shadow: 2px 2px 8px rgba(0,0,0,0.5);
}
.banner-content p {
  font-size: 18px;
  margin: 0;
  opacity: 0.9;
  text-shadow: 1px 1px 4px rgba(0,0,0,0.5);
}

/* 主体容器 */
.main-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

/* 过滤栏 */
.filter-bar {
  background: white;
  padding: 20px 24px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 20px;
}
.star-filter {
  display: flex;
  align-items: center;
}
.filter-label {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
  margin-right: 15px;
}
.search-box {
  width: 350px;
}

/* 酒店卡片网格 */
.hotel-grid {
  margin-top: 20px;
}
.hotel-card {
  border-radius: 12px;
  border: none;
  transition: all 0.3s ease;
  margin-bottom: 24px;
  overflow: hidden;
}
.hotel-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 16px 32px rgba(0,0,0,0.12) !important;
}

.card-image-wrapper {
  position: relative;
  width: 100%;
  height: 220px;
  overflow: hidden;
}
.hotel-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}
.hotel-card:hover .hotel-image {
  transform: scale(1.08);
}
.rating-badge {
  position: absolute;
  bottom: 15px;
  right: 15px;
  background: rgba(0,0,0,0.7);
  color: #ff9900;
  padding: 4px 10px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 4px;
  backdrop-filter: blur(4px);
}

.hotel-info {
  padding: 20px;
}
.hotel-name {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 12px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hotel-location {
  display: flex;
  align-items: center;
  color: #909399;
  font-size: 14px;
  margin-bottom: 12px;
}
.hotel-location .el-icon {
  margin-right: 5px;
  font-size: 16px;
}
.hotel-location span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hotel-tags {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.tag-item {
  border-radius: 4px;
}

.hotel-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-top: 1px solid #ebeef5;
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
  font-weight: bold;
  margin: 0 2px;
}
.price-unit {
  font-size: 14px;
  color: #909399;
}
.book-btn {
  border-radius: 20px;
  padding: 8px 20px;
  font-weight: bold;
}

/* 响应式 */
@media (max-width: 768px) {
  .filter-bar {
    flex-direction: column;
    align-items: stretch;
  }
  .search-box {
    width: 100%;
  }
  .banner-content h2 {
    font-size: 32px;
  }
}
</style>