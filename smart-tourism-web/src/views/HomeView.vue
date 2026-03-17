<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { ElMessage } from 'element-plus'
import { Star, Location, Search } from '@element-plus/icons-vue'

const router = useRouter()
const { userInfo, logout } = useAuth()

const axios = window.axios
// 景点数据
const attractions = ref([])
// 酒店数据
const hotels = ref([])

// 搜索词
const searchQuery = ref('')
// 当前选中的分类
const selectedCategory = ref('全部')

const scrollToAttractions = () => {
  const element = document.getElementById('attractions-list')
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' })
  }
}

const goToDetail = (id) => {
  router.push({ name: 'attraction-detail', params: { id: id } })
}

const goToHotelDetail = (id) => {
  router.push(`/hotel/${id}`)
}

const fetchData = async () => {
  try {
    const res = await axios.get('http://localhost:8080/api/scenic-spots')
    const rawData = Array.isArray(res.data) ? res.data : (res.data.data || [])
    attractions.value = rawData.map(item => ({
      ...item,
      rating: item.rating || 4.8
    }))
  } catch (error) {
    console.error('获取景点数据失败:', error)
  }

  try {
    const hotelRes = await axios.get('http://localhost:8080/api/hotels')
    const rawHotels = Array.isArray(hotelRes.data) ? hotelRes.data : (hotelRes.data.data || [])
    hotels.value = rawHotels.map(item => ({
      ...item,
      rating: item.rating || 4.9
    }))
  } catch (error) {
    console.error('获取酒店数据失败:', error)
  }
}

const handleDataSync = async (actionFunction) => {
  try {
    await actionFunction()
    await fetchData()
  } catch (error) {
    console.error('操作失败', error)
    ElMessage.error('操作失败，请重试')
  }
}

onMounted(() => {
  fetchData() 
})

const carouselItems = ref([
  { id: 1, image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2070&auto=format&fit=crop' },
  { id: 2, image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=2070&auto=format&fit=crop' },
  { id: 3, image: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=2070&auto=format&fit=crop' },
])

const categories = [
  { label: '全部', value: '全部' },
  { label: '自然风光', value: '自然风光' },
  { label: '历史古迹', value: '历史古迹' },
  { label: '主题乐园', value: '主题乐园' }
]

// 🔥 1. 恢复丢失的景点过滤逻辑，解除黑屏！
const filteredAttractions = computed(() => {
  let result = [...(attractions.value || [])]
  if (selectedCategory.value !== '全部') {
    result = result.filter(item => item.category === selectedCategory.value)
  }
  if (searchQuery.value && searchQuery.value.trim()) {
    const query = searchQuery.value.trim().toLowerCase()
    result = result.filter(item => item.name && item.name.toLowerCase().includes(query))
  }
  return result.slice(0, 8)
})

const selectedHotelStar = ref(0)

// 🔥 2. 升级首页酒店过滤逻辑（使用宽容的 || 兜底算法）
const filteredHomeHotels = computed(() => {
  let result = [...hotels.value]
  if (selectedHotelStar.value > 0) {
    result = result.filter(item => {
      const cat = item.category || ''
      const r = Number(item.rating) || 0

      if (selectedHotelStar.value === 5) {
        return cat.includes('五星') || cat.includes('豪华') || r >= 4.8
      } else if (selectedHotelStar.value === 4) {
        return cat.includes('四星') || cat.includes('高档') || (r >= 4.0 && r < 4.8)
      } else if (selectedHotelStar.value === 3) {
        return cat.includes('经济') || cat.includes('快捷') || r < 4.0
      }
      return true
    })
  }
  return result.slice(0, 8)
})

// 🔥 3. 补充唤醒 AI 的全局事件
const callAiGuide = () => {
  const prompt = "我准备出门旅游玩3天，预算大概2000元，请结合咱们平台里现有的景点，帮我量身定制一份专属的旅游行程攻略！"
  window.dispatchEvent(new CustomEvent('call-ai-assistant', { detail: prompt }))
}
</script>

<template>
  <div class="home-view">
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
            <el-button class="gradient-btn btn-orange" round size="small" @click="$router.push('/user')"
              style="margin-right: 10px;">
              👤 个人中心
            </el-button>
            <el-button v-if="userInfo.username === 'admin' || userInfo.role === 'ADMIN'" class="gradient-btn btn-blue"
              round size="small" @click="router.push('/admin')" style="margin-right: 10px;">
              ⚙️ 后台管理
            </el-button>
            <el-button class="gradient-btn btn-red-outline" round size="small" @click="logout">
              退出
            </el-button>
          </template>
          <template v-else>
            <el-button type="primary" size="small" @click="router.push('/login')">登录/注册</el-button>
          </template>
        </nav>
      </div>
    </header>

    <section class="banner-section">
      <el-carousel height="600px" indicator-position="outside">
        <el-carousel-item v-for="item in carouselItems" :key="item.id">
          <div class="carousel-slide">
            <img :src="item.image" alt="风景图" class="carousel-image">
            <div class="carousel-overlay">
              <h2 class="carousel-title">探索未知的世界</h2>
              <p class="carousel-subtitle">发现最美的风景，体验最精彩的旅程</p>
              <el-button type="primary" size="large" round style="margin-top: 20px;"
                @click="scrollToAttractions">立即出发</el-button>
            </div>
          </div>
        </el-carousel-item>
      </el-carousel>
    </section>

    <section class="attractions-section" id="attractions-list">
      <div class="section-container">
        <h2 class="section-title">🏔️ 热门景点推荐</h2>

        <div class="action-bar">
          <div class="category-filter">
            <el-radio-group v-model="selectedCategory" size="small">
              <el-radio-button v-for="category in categories" :key="category.value" :label="category.value">
                {{ category.label }}
              </el-radio-button>
            </el-radio-group>
          </div>
          <div class="search-box">
            <el-input v-model="searchQuery" placeholder="搜索景点名称" prefix-icon="Search" size="small" clearable />
          </div>
        </div>

        <el-empty v-if="filteredAttractions.length === 0" description="没有找到对应的景点" />

        <el-row :gutter="20">
          <el-col v-for="attraction in filteredAttractions" :key="attraction.id" :xs="24" :sm="24" :md="8" :lg="6"
            :xl="6">
            <el-card class="attraction-card" shadow="hover" @click="goToDetail(attraction.id)">
              <div class="card-image-wrapper">
                <img
                  :src="attraction.imageUrl || attraction.image || `https://picsum.photos/400/300?random=${attraction.id}`"
                  :alt="attraction.name" class="card-image">
                <div v-if="attraction.rating >= 4.8" class="card-badge tag-scenic">🔥 必去高分</div>
                <div v-else-if="attraction.price <= 100" class="card-badge tag-scenic"
                  style="background: linear-gradient(135deg, #67c23a, #95d475);">💰 超值特惠</div>
              </div>
              <div class="card-content">
                <h3 class="card-title">{{ attraction.name }}</h3>
                <div class="card-rating">
                  <el-rate v-model="attraction.rating" disabled show-score text-color="#ff9900"
                    score-template="{value}" />
                </div>
                <p class="card-description">{{ attraction.description || '暂无详细介绍，等您来探索...' }}</p>
                <div class="card-footer">
                  <span class="card-price">
                    <span class="price-symbol">¥</span>
                    <span class="price-value">{{ attraction.price }}</span>
                    <span style="font-size: 12px; color: #909399; margin-left: 2px;">起</span>
                  </span>
                  <el-button type="primary" size="small" @click.stop="goToDetail(attraction.id)">
                    查看详情
                  </el-button>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <div class="view-more-wrapper">
          <el-button class="gradient-btn btn-green" plain round size="large" @click="router.push('/attractions')">探索更多景点
            ></el-button>
        </div>
      </div>
    </section>

    <section class="hotels-section">
      <div class="section-container">
        <h2 class="section-title">🏨 臻选品质酒店</h2>
        <p class="section-subtitle">为您提供舒适安心的住宿体验</p>

        <div class="action-bar"
          style="justify-content: center; margin-bottom: 40px; background: transparent; box-shadow: none;">
          <el-radio-group v-model="selectedHotelStar" size="large">
            <el-radio-button :label="0">全部</el-radio-button>
            <el-radio-button :label="5">五星/豪华</el-radio-button>
            <el-radio-button :label="4">四星/高档</el-radio-button>
            <el-radio-button :label="3">经济/快捷</el-radio-button>
          </el-radio-group>
        </div>

        <el-empty v-if="filteredHomeHotels.length === 0" description="暂无符合该星级的酒店" />

        <el-row :gutter="20" v-else>
          <el-col v-for="hotel in filteredHomeHotels" :key="hotel.id" :xs="24" :sm="12" :md="8" :lg="6" :xl="6">
            <el-card class="hotel-card premium-card" shadow="hover" :body-style="{ padding: '0px' }"
              @click="goToHotelDetail(hotel.id)">
              <div class="card-image-wrapper">
                <div v-if="hotel.category && hotel.category.includes('五星')" class="badge badge-gold">👑 豪华甄选</div>
                <div v-else-if="hotel.rating >= 4.7" class="badge badge-blue">💎 品质优选</div>

                <el-image
                  :src="hotel.imageUrl || hotel.image || `https://picsum.photos/400/300?random=${hotel.id + 100}`"
                  :alt="hotel.name" class="card-image" lazy />

                <div class="rating-badge">
                  <el-icon style="margin-right: 4px;">
                    <Star />
                  </el-icon> {{ hotel.rating }}
                </div>
              </div>

              <div class="card-content" style="padding: 20px;">
                <h3 class="card-title" style="margin: 0 0 10px 0; font-size: 18px;">{{ hotel.name }}</h3>

                <div class="card-address" v-if="hotel.address"
                  style="color: #909399; font-size: 13px; margin-bottom: 12px;">
                  <el-icon style="color: #409eff; margin-right: 4px;">
                    <Location />
                  </el-icon> {{ hotel.address }}
                </div>

                <div class="card-footer"
                  style="display: flex; justify-content: space-between; align-items: flex-end; padding-top: 15px; border-top: 1px dashed #ebeef5;">
                  <span class="card-price" style="color: #f56c6c; display: flex; align-items: baseline;">
                    <span style="font-size: 14px; font-weight: bold; margin-right: 2px;">¥</span>
                    <span style="font-size: 24px; font-weight: 800;">{{ hotel.price }}</span>
                    <span style="font-size: 12px; color: #909399; margin-left: 2px;">/晚</span>
                  </span>
                  <el-button class="gradient-btn btn-blue" round size="small" @click.stop="goToHotelDetail(hotel.id)">
                    立即预订
                  </el-button>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <div class="view-more-wrapper">
          <el-button size="large" round @click="router.push('/hotel')">查看更多酒店 ></el-button>
        </div>
      </div>
    </section>

    <footer class="site-footer">
      <div class="footer-container">
        <div class="footer-content">
          <div class="footer-section">
            <h3>🚀 智慧旅游系统</h3>
            <p>让旅行更简单，让体验更美好。<br />随时随地，发现你身边的美丽风景。</p>
          </div>
          <div class="footer-section">
            <h4>联系我们</h4>
            <p>客服热线：400-888-6666</p>
            <p>联系邮箱：support@smarttravel.com</p>
            <p>公司地址：软件园南路 88 号</p>
          </div>
          <div class="footer-section">
            <h4>快速链接</h4>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <a href="#">关于我们</a>
              <a href="#">服务条款</a>
              <a href="#">隐私政策</a>
            </div>
          </div>
        </div>
        <div class="copyright">
          © 2026 Smart Tourism System. All Rights Reserved. Designed by YB.
        </div>
      </div>
    </footer>

  </div>
</template>

<style scoped>
/* =======================================
   原版样式 (修复了遮挡背景的实心底色)
   ======================================= */
.home-view {
  min-height: 100vh;
  /* 🔥 修复 1：把原来的 #f5f7fa 改为透明，让底层风景透出来 */
  background-color: transparent; 
  position: relative;
  z-index: 1;
}

/* 🔥 修复 2：升级沉浸式山水背景，调高透明度，强制全屏覆盖 */
.home-view::before {
  content: '';
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  /* 绝美的高山湖泊风光 */
  background: url('https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=2074&auto=format&fit=crop') center/cover no-repeat;
  opacity: 0.25; /* 调高到 25%，风景更加明显 */
  z-index: -1;   /* 保证背景永远在最底层 */
  pointer-events: none; /* 防止遮挡鼠标点击事件 */
}

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

.banner-section {
  width: 100%;
  margin-bottom: 20px;
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
  background: linear-gradient(to bottom,
      rgba(0, 0, 0, 0.4) 0%,
      rgba(0, 0, 0, 0.1) 100%);
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

.attractions-section {
  padding: 40px 0 20px;
}

.section-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.section-title {
  font-size: 32px;
  font-weight: 700;
  color: #303133;
  text-align: center;
  margin: 0 0 8px 0;
}

.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  margin-top: 30px;
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

.attraction-card {
  margin-bottom: 24px;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
  border: none;
}

.attraction-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1) !important;
}

.card-image-wrapper {
  width: 100%;
  padding-top: 75%;
  /* 4:3 宽高比 */
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-rating {
  margin-bottom: 12px;
}

.card-description {
  font-size: 13px;
  color: #909399;
  line-height: 1.6;
  margin: 0 0 16px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  height: 42px;
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

/* =======================================
   🔥 新增：高级 UI 样式 (酒店专区、标签、页脚)
   ======================================= */

/* 卡片左上角的高级标签 */
.card-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  color: #fff;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: bold;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  z-index: 10;
}

.tag-scenic {
  background: linear-gradient(135deg, #ff6b6b, #ff4757);
}

.tag-hotel {
  background: linear-gradient(135deg, #4facfe, #00f2fe);
}

/* 酒店专区 */
.hotels-section {
  padding: 60px 0 80px;
  /* 🔥 修复 3：把原来的 #fff 改为透明，让下半部分也能看到风景 */
  background-color: transparent; 
}

.section-subtitle {
  text-align: center;
  color: #909399;
  font-size: 15px;
  margin-bottom: 40px;
}

.card-address {
  font-size: 13px;
  color: #606266;
  margin-bottom: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.view-more-wrapper {
  text-align: center;
  margin-top: 30px;
}

/* 底部企业级 Footer */
.site-footer {
  background: #2b2f3a;
  color: #fff;
  padding: 60px 0 20px;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.footer-content {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 40px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 40px;
  margin-bottom: 20px;
}

.footer-section {
  flex: 1;
  min-width: 250px;
}

.footer-section h3 {
  color: #409eff;
  font-size: 24px;
  margin-bottom: 20px;
}

.footer-section h4 {
  font-size: 18px;
  margin-bottom: 20px;
}

.footer-section p {
  color: #909399;
  font-size: 14px;
  line-height: 1.8;
  margin-bottom: 8px;
}

.footer-section a {
  color: #909399;
  text-decoration: none;
  font-size: 14px;
  transition: color 0.3s;
}

.footer-section a:hover {
  color: #409eff;
}

.copyright {
  text-align: center;
  color: #606266;
  font-size: 14px;
}

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

  .attractions-section,
  .hotels-section {
    padding: 40px 0 40px;
  }

  .action-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-box {
    width: 100%;
  }
}

/* 🌟 毛玻璃导航栏 */
.navbar {
  width: 100%;
  background-color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  /* 核心：毛玻璃模糊效果 */
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  position: sticky;
  top: 0;
  z-index: 1000;
}

/* Logo 文字渐变 */
.brand-title {
  background: linear-gradient(135deg, #409eff 0%, #36d1dc 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* 🌟 高级悬浮卡片 */
.premium-card {
  border-radius: 16px;
  border: none;
  transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  background: #ffffff; /* 卡片保留白底，让文字清晰可读 */
}

.premium-card:hover {
  transform: translateY(-10px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1) !important;
}

/* 🌟 图片放大效果 */
.card-image-wrapper {
  position: relative;
  overflow: hidden;
  border-radius: 16px 16px 0 0;
}

.card-image {
  width: 100%;
  object-fit: cover;
  transition: transform 0.6s;
}

.premium-card:hover .card-image {
  transform: scale(1.08);
}

/* 🌟 左上角渐变角标 */
.badge {
  position: absolute;
  top: 15px;
  left: 15px;
  z-index: 10;
  color: #fff;
  padding: 6px 14px;
  border-radius: 8px 2px 8px 2px;
  font-size: 13px;
  font-weight: bold;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
}

.badge-red {
  background: linear-gradient(135deg, #ff6b6b, #ff4757);
}

.badge-blue {
  background: linear-gradient(135deg, #409eff, #66b1ff);
}

.badge-gold {
  background: linear-gradient(135deg, #e6a23c, #f5bc63);
}

/* 🌟 右下角毛玻璃评分 */
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
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* =======================================
   🔥 核心组件升级包 (渐变按钮)
   ======================================= */
.gradient-btn {
  border: none !important;
  font-weight: bold;
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.btn-blue {
  background: linear-gradient(135deg, #409eff, #36d1dc) !important;
  color: white !important;
}

.btn-blue:hover {
  background: linear-gradient(135deg, #66b1ff, #409eff) !important;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4) !important;
  transform: translateY(-2px);
}

.btn-green {
  background: linear-gradient(135deg, #67c23a, #529b2e) !important;
  color: white !important;
}

.btn-green:hover {
  background: linear-gradient(135deg, #85ce61, #67c23a) !important;
  box-shadow: 0 4px 12px rgba(103, 194, 58, 0.4) !important;
  transform: translateY(-2px);
}

.btn-orange {
  background: linear-gradient(135deg, #f59a23, #f5bc63) !important;
  color: white !important;
}

.btn-orange:hover {
  background: linear-gradient(135deg, #f5bc63, #f59a23) !important;
  box-shadow: 0 4px 12px rgba(245, 154, 35, 0.4) !important;
  transform: translateY(-2px);
}

.btn-red-outline {
  background: transparent !important;
  border: 1px solid #f56c6c !important;
  color: #f56c6c !important;
}

.btn-red-outline:hover {
  background: #f56c6c !important;
  color: white !important;
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.3) !important;
  transform: translateY(-2px);
}
</style>