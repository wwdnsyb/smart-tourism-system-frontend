<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { ElMessage } from 'element-plus'
import { Location, Star, Filter, Calendar } from '@element-plus/icons-vue' // 引入更多图标

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
      // 随机给几个高大上的标签
      tags: ['免费Wi-Fi', '健身房', '含早餐', '无边泳池'].slice(0, Math.floor(Math.random() * 3) + 2)
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

  // 🔥 修复：把原来的 `? :` 换成 `||`。
  // 这样只要 category 没匹配上，就会自动用 rating 来判断！
  if (selectedStar.value > 0) {
    result = result.filter(item => {
      const cat = item.category || ''
      const r = Number(item.rating) || 0

      if (selectedStar.value === 5) {
        return cat.includes('五星') || cat.includes('豪华') || r >= 4.8
      } else if (selectedStar.value === 4) {
        return cat.includes('四星') || cat.includes('高档') || (r >= 4.0 && r < 4.8)
      } else if (selectedStar.value === 3) {
        return cat.includes('经济') || cat.includes('快捷') || r < 4.0
      }
      return true
    })
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
  router.push({ path: `/hotel/${hotel.id}` })
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
          <router-link to="/attractions" class="menu-item" active-class="active">景点</router-link>
          <router-link to="/hotel" class="menu-item" active-class="active">酒店</router-link>

          <template v-if="userInfo">
            <span class="welcome-text">欢迎，{{ userInfo.username }}</span>
            <el-button class="gradient-btn btn-orange" round size="small" @click="$router.push('/user')" style="margin-right: 10px;">
              👤 个人中心
            </el-button>
            <el-button v-if="userInfo.role === 'ADMIN' || userInfo.username === 'admin'" class="gradient-btn btn-blue" round size="small" @click="router.push('/admin')" style="margin-right: 10px;">
              ⚙️ 后台管理
            </el-button>
            <el-button class="gradient-btn btn-red-outline" round size="small" @click="logout">
              退出
            </el-button>
          </template>
          <template v-else>
            <el-button class="gradient-btn btn-blue" round size="small" @click="router.push('/login')">登录 / 注册</el-button>
          </template>
        </nav>
      </div>
    </header>

    <div class="hotel-banner">
      <div class="banner-content">
        <h2>✨ 臻选品质酒店 ✨</h2>
        <p>为您提供温馨、舒适的住宿体验，让旅途像家一样</p>
      </div>
    </div>

    <div class="main-container">
      <div class="filter-bar">
        <div class="star-filter">
          <span class="filter-label">
            <el-icon style="margin-right: 6px;"><Filter /></el-icon>酒店星级：
          </span>
          <el-radio-group v-model="selectedStar" size="large">
            <el-radio-button :label="0">全部</el-radio-button>
            <el-radio-button :label="5">五星/豪华</el-radio-button>
            <el-radio-button :label="4">四星/高档</el-radio-button>
            <el-radio-button :label="3">经济/快捷</el-radio-button>
          </el-radio-group>
        </div>
        <div class="search-box">
          <el-input v-model="searchQuery" placeholder="搜索酒店名称或位置..." :prefix-icon="Search" size="large" clearable />
        </div>
      </div>

      <el-empty v-if="filteredHotels.length === 0" description="没有找到符合条件的酒店，换个关键词试试吧~" />

      <el-row :gutter="24" class="hotel-grid">
        <el-col v-for="(hotel, index) in filteredHotels" :key="hotel.id" :xs="24" :sm="12" :md="8" :lg="6" :xl="6"
          class="animate-card" :style="{ animationDelay: `${index * 0.05}s` }">
          
          <el-card class="hotel-card premium-card" shadow="hover" :body-style="{ padding: '0px' }" @click="handleBook(hotel)">
            <div class="card-image-wrapper">
              <div v-if="hotel.category && hotel.category.includes('五星')" class="badge luxury-badge">👑 豪华臻选</div>
              <div v-else-if="hotel.rating >= 4.0" class="badge quality-badge">💎 品质优选</div>
              
              <img :src="hotel.image" :alt="hotel.name" class="hotel-image">
              
              <div class="rating-badge">
                <el-icon style="margin-right: 4px;"><Star /></el-icon> {{ hotel.rating }}
              </div>
            </div>

            <div class="hotel-info">
              <h3 class="hotel-name">{{ hotel.name }}</h3>

              <div class="hotel-location">
                <el-icon><Location /></el-icon>
                <span>{{ hotel.address }}</span>
              </div>

              <div class="hotel-tags">
                <el-tag v-for="(tag, idx) in hotel.tags" :key="idx" size="small" effect="plain" type="info" round class="tag-item">
                  {{ tag }}
                </el-tag>
              </div>

              <div class="hotel-footer">
                <div class="price-box">
                  <span class="price-symbol">¥</span>
                  <span class="price-value">{{ hotel.price }}</span>
                  <span class="price-unit">/晚</span>
                </div>
                <el-button type="primary" round class="gradient-btn btn-blue" size="small">
                  立即查看
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
.hotel-view {
  min-height: 100vh;
  background-color: transparent; 
  padding-bottom: 80px;
  position: relative;
  z-index: 1;
}

/* 🔥 修复 2：加入酒店页专属的温馨度假背景 */
.hotel-view::before {
  content: '';
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  /* 暖色调的海滨日落/度假村 */
  background: url('https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?q=80&w=2000&auto=format&fit=crop') center/cover no-repeat;
  opacity: 0.25; /* 25%透明度，高级且不抢戏 */
  z-index: -1;
  pointer-events: none;
}

/* 导航栏样式 (复用首页) */
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
  margin: 0;
  background: linear-gradient(135deg, #409eff 0%, #36d1dc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
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
  color: #606266;
  font-size: 14px;
  margin-right: 12px;
  font-weight: 500;
}

/* 酒店顶部 Banner */
.hotel-banner {
  height: 350px;
  /* 换了一张更高级的酒店背景图，增加了渐变遮罩 */
  background: linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.2)), url('https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=2070') center/cover no-repeat;
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

/* 主体容器 */
.main-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

/* 🔥 UI升级：悬浮式过滤栏 */
.filter-bar {
  background: white;
  padding: 20px 24px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: -60px; /* 向上浮动盖住Banner */
  margin-bottom: 40px;
  position: relative;
  z-index: 10;
  flex-wrap: wrap;
  gap: 20px;
}

.star-filter {
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

/* 酒店卡片网格 */
.hotel-grid {
  margin-top: 20px;
}

/* 🔥 UI升级：入场加载动画 */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-card {
  animation: fadeInUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
}

.hotel-card {
  border-radius: 16px;
  border: none;
  transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  margin-bottom: 30px;
  overflow: hidden;
  cursor: pointer;
  background: #ffffff; /* 保证卡片底色为白，和背景形成对比 */
}

.hotel-card:hover {
  transform: translateY(-10px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1) !important;
}

.card-image-wrapper {
  position: relative;
  width: 100%;
  height: 240px;
  overflow: hidden;
}

/* 🔥 UI升级：左上角高级角标 */
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
  box-shadow: 0 4px 10px rgba(0,0,0,0.2);
  letter-spacing: 1px;
}

.luxury-badge {
  background: linear-gradient(135deg, #e6a23c, #f5bc63);
}

.quality-badge {
  background: linear-gradient(135deg, #409eff, #66b1ff);
}

.hotel-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.hotel-card:hover .hotel-image {
  transform: scale(1.08);
}

/* 🔥 UI升级：毛玻璃评分徽章 */
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
  border: 1px solid rgba(255,255,255,0.2);
}

.hotel-info {
  padding: 24px;
}

.hotel-name {
  font-size: 22px;
  font-weight: 700;
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
  margin-bottom: 16px;
}

.hotel-location .el-icon {
  margin-right: 6px;
  font-size: 16px;
  color: #409eff;
}

.hotel-location span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hotel-tags {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.hotel-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-top: 1px dashed #ebeef5;
  padding-top: 20px;
}

.price-box {
  color: #f56c6c;
}

.price-symbol {
  font-size: 16px;
  font-weight: bold;
}

.price-value {
  font-size: 32px;
  font-weight: 800;
  margin: 0 2px;
}

.price-unit {
  font-size: 13px;
  color: #909399;
}

.book-btn {
  padding: 10px 24px;
  font-weight: bold;
  font-size: 15px;
  background: linear-gradient(135deg, #409eff, #36d1dc);
  border: none;
  transition: all 0.3s;
}

.book-btn:hover {
  background: linear-gradient(135deg, #66b1ff, #409eff);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
}

/* 响应式 */
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