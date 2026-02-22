<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { ElMessage } from 'element-plus'

const router = useRouter()
const { userInfo, logout } = useAuth()

const axios = window.axios
// 景点数据
const attractions = ref([])
// 搜索词
const searchQuery = ref('')
// 当前选中的分类
const selectedCategory = ref('全部')

// ---------------------------------------------------------
// 🔥 新增：导航栏平滑滚动逻辑
// ---------------------------------------------------------
const scrollToAttractions = () => {
  const element = document.getElementById('attractions-list')
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' })
  }
}

// ---------------------------------------------------------
// 🔥 新增：卡片点击跳转详情页逻辑
// ---------------------------------------------------------
const goToDetail = (id) => {
  router.push({ name: 'attraction-detail', params: { id: id } })
}

// ---------------------------------------------------------
// 🔥 核心修改 1：抽离“获取数据”的逻辑 (查)
// ---------------------------------------------------------
const fetchData = async () => {
  try {
    // 假设你的后端接口是 /api/scenic-spots (如果不一样请修改这里)
    // 如果你还没写这个接口，可以先暂时用回 getAttractions()，但逻辑框架要保留
    const res = await axios.get('http://localhost:8080/api/scenic-spots')
    
    // 处理数据 (保留你原本的评分逻辑)
    attractions.value = res.data.map(item => ({
      ...item,
      rating: item.rating || 4.8 // 如果数据库没存评分，就给默认 4.8
    }))
    
  } catch (error) {
    console.error('获取数据失败:', error)
    // ElMessage.error('无法连接到服务器') // 调试时可以先注释掉
  }
}

// ---------------------------------------------------------
// 🔥 核心修改 2：万能同步模版函数 (增/删/改)
// 以后任何按钮点击，只要包裹在这个函数里，就会自动刷新数据！
// ---------------------------------------------------------
const handleDataSync = async (actionFunction) => {
  try {
    // 1. 执行具体操作 (比如：预订、删除、点赞)
    await actionFunction()
    
    // 2. 操作成功后，自动重新拉取最新数据
    await fetchData()
    
  } catch (error) {
    console.error('操作失败', error)
    ElMessage.error('操作失败，请重试')
  }
}

// ---------------------------------------------------------
// 示例：如何使用 handleDataSync (你可以把这个绑在按钮上测试)
// ---------------------------------------------------------
const testBooking = async (id) => {
  // 使用万能模版包裹你的逻辑
  await handleDataSync(async () => {
    // 这里写你真实的业务请求，例如：
    // await axios.post('/api/orders', { scenicId: id })
    console.log(`正在预订景点 ID: ${id}...`)
    ElMessage.success('预订成功！列表已自动刷新')
  })
}

// 初始化
onMounted(() => {
  fetchData() // 页面一加载，先查一次
})

// --- 下面是原本的 UI 逻辑 (保持不变) ---

// 轮播图数据
const carouselItems = ref([
  { id: 1, image: 'https://picsum.photos/1920/600?random=10' },
  { id: 2, image: 'https://picsum.photos/1920/600?random=11' },
  { id: 3, image: 'https://picsum.photos/1920/600?random=12' },
])

// 分类选项
const categories = [
  { label: '全部', value: '全部' },
  { label: '自然风光', value: '自然风光' },
  { label: '历史古迹', value: '历史古迹' },
  { label: '主题乐园', value: '主题乐园' }
]

// 筛选后的景点
const filteredAttractions = computed(() => {
  let result = [...attractions.value]
  if (selectedCategory.value !== '全部') {
    result = result.filter(item => item.category === selectedCategory.value) // 确保数据库字段也有 category
  }
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.trim().toLowerCase()
    result = result.filter(item => item.name.toLowerCase().includes(query))
  }
  return result
})
</script>

<template>
  <div class="home-view">
    <!-- 顶部导航栏 -->
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
            <el-button type="warning" @click="$router.push('/user')" style="margin-right: 10px;">
              👤 个人中心
            </el-button>
            <el-button v-if="userInfo.username === 'admin'" type="warning" size="small" @click="router.push('/admin')">后台管理</el-button>
            <el-button type="danger" size="small" plain @click="logout">退出</el-button>
          </template>
          <template v-else>
            <el-button type="primary" size="small" @click="router.push('/login')">登录/注册</el-button>
          </template>
        </nav>
      </div>
    </header>

    <!-- 轮播图 -->
    <section class="banner-section">
      <el-carousel height="600px" indicator-position="outside">
        <el-carousel-item
          v-for="item in carouselItems"
          :key="item.id"
        >
          <div class="carousel-slide">
            <img
              :src="item.image"
              alt="风景图"
              class="carousel-image"
            >
            <div class="carousel-overlay">
              <h2 class="carousel-title">探索未知的世界</h2>
              <p class="carousel-subtitle">发现最美的风景，体验最精彩的旅程</p>
            </div>
          </div>
        </el-carousel-item>
      </el-carousel>
    </section>

    <!-- 热门景点区 -->
    <section class="attractions-section" id="attractions-list">
      <div class="section-container">
        <h2 class="section-title">热门景点推荐</h2>
        
        <!-- 操作栏：分类筛选和搜索 -->
        <div class="action-bar">
          <div class="category-filter">
            <el-radio-group v-model="selectedCategory" size="small">
              <el-radio-button
                v-for="category in categories"
                :key="category.value"
                :label="category.value"
              >
                {{ category.label }}
              </el-radio-button>
            </el-radio-group>
          </div>
          <div class="search-box">
            <el-input
              v-model="searchQuery"
              placeholder="搜索景点名称"
              prefix-icon="Search"
              size="small"
              clearable
            />
          </div>
        </div>
        
        <el-row :gutter="20">
          <el-col
            v-for="attraction in filteredAttractions"
            :key="attraction.id"
            :xs="24"
            :sm="24"
            :md="8"
            :lg="6"
            :xl="6"
          >
            <el-card
              class="attraction-card"
              shadow="hover"
              @click="goToDetail(attraction.id)"
            >
              <div class="card-image-wrapper">
                <img
                  :src="attraction.image"
                  :alt="attraction.name"
                  class="card-image"
                >
              </div>
              <div class="card-content">
                <h3 class="card-title">{{ attraction.name }}</h3>
                <div class="card-rating">
                  <el-rate
                    v-model="attraction.rating"
                    disabled
                    show-score
                    text-color="#ff9900"
                    score-template="{value}"
                  />
                </div>
                <p class="card-description">{{ attraction.description }}</p>
                <div class="card-footer">
                  <span class="card-price">
                    <span class="price-symbol">¥</span>
                    <span class="price-value">{{ attraction.price }}</span>
                  </span>
                  <el-button
                    type="primary"
                    size="small"
                    @click="router.push({ name: 'attraction-detail', params: { id: attraction.id } })"
                  >
                    查看详情
                  </el-button>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-view {
  min-height: 100vh;
  background-color: #f5f7fa;
}

/* 导航栏样式 */
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

.menu-item:hover {
  color: #409eff;
}

.menu-item.active {
  color: #409eff;
}

.menu-item.active::after {
  content: '';
  position: absolute;
  bottom: -8px;
  left: 0;
  right: 0;
  height: 2px;
  background-color: #409eff;
}

.welcome-text {
  color: #606266;
  font-size: 14px;
  margin-right: 12px;
}

/* 轮播图样式 */
.banner-section {
  width: 100%;
  margin-bottom: 60px;
}

.carousel-slide {
  position: relative;
  width: 100%;
  height: 100%;
}

.carousel-image {
  width: 100%;
  height: 600px;
  object-fit: cover;
}

.carousel-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.3) 0%,
    rgba(0, 0, 0, 0.1) 100%
  );
  color: #fff;
}

.carousel-title {
  font-size: 56px;
  font-weight: 700;
  margin: 0 0 16px 0;
  text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.5);
  letter-spacing: 2px;
}

.carousel-subtitle {
  font-size: 20px;
  margin: 0;
  text-shadow: 1px 1px 4px rgba(0, 0, 0, 0.5);
  opacity: 0.95;
}

/* 热门景点区样式 */
.attractions-section {
  padding: 60px 0 80px;
}

.section-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.section-title {
  font-size: 36px;
  font-weight: 700;
  color: #303133;
  text-align: center;
  margin: 0 0 20px 0;
  position: relative;
  padding-bottom: 20px;
}

.section-title::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 80px;
  height: 4px;
  background: linear-gradient(90deg, #409eff 0%, #67c23a 100%);
  border-radius: 2px;
}

/* 操作栏样式 */
.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 16px;
}

.category-filter {
  display: flex;
  align-items: center;
}

.search-box {
  min-width: 200px;
  width: 300px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .action-bar {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-box {
    width: 100%;
  }
}

/* 景点卡片样式 */
.attraction-card {
  margin-bottom: 24px;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
}

.attraction-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15) !important;
}

.card-image-wrapper {
  width: 100%;
  padding-top: 75%; /* 4:3 宽高比 */
  position: relative;
  overflow: hidden;
  background-color: #f0f0f0;
}

.card-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.attraction-card:hover .card-image {
  transform: scale(1.1);
}

.card-content {
  padding: 20px;
}

.card-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 12px 0;
}

.card-rating {
  margin-bottom: 12px;
}

.card-description {
  font-size: 14px;
  color: #606266;
  line-height: 1.6;
  margin: 0 0 16px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-price {
  display: flex;
  align-items: baseline;
  color: #f56c6c;
  font-weight: 600;
}

.price-symbol {
  font-size: 16px;
  margin-right: 2px;
}

.price-value {
  font-size: 24px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .navbar-container {
    padding: 0 16px;
    height: 60px;
  }

  .brand-title {
    font-size: 22px;
  }

  .navbar-menu {
    gap: 16px;
  }

  .menu-item {
    font-size: 14px;
  }

  .carousel-title {
    font-size: 36px;
  }

  .carousel-subtitle {
    font-size: 16px;
  }

  .carousel-image {
    height: 400px;
  }

  .section-title {
    font-size: 28px;
  }

  .attractions-section {
    padding: 40px 0 60px;
  }
}
</style>
