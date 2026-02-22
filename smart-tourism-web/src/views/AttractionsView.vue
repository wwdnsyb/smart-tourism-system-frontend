<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { ElMessage } from 'element-plus'

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
    // 映射 imageUrl 到 image
    attractions.value = res.data.map(item => ({
      ...item,
      image: item.imageUrl || item.image,
      rating: item.rating || 5.0
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
    result = result.filter(item => item.name.toLowerCase().includes(query))
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
            <el-button type="warning" @click="$router.push('/user')" style="margin-right: 10px;">👤 个人中心</el-button>
            <el-button type="danger" size="small" plain @click="logout">退出</el-button>
          </template>
          <template v-else>
            <el-button type="primary" size="small" @click="router.push('/login')">登录/注册</el-button>
          </template>
        </nav>
      </div>
    </header>

    <div class="main-content">
      <div class="page-header">
        <h2>全部景点</h2>
        <p>发现最美的风景，开启你的奇妙旅程</p>
      </div>

      <div class="action-bar">
        <div class="category-filter">
          <el-radio-group v-model="selectedCategory" size="large">
            <el-radio-button v-for="category in categories" :key="category.value" :label="category.value">
              {{ category.label }}
            </el-radio-button>
          </el-radio-group>
        </div>
        <div class="search-box">
          <el-input v-model="searchQuery" placeholder="搜索景点名称..." prefix-icon="Search" size="large" clearable />
        </div>
      </div>

      <el-empty v-if="filteredAttractions.length === 0" description="暂无匹配的景点数据" />
      
      <el-row :gutter="24">
        <el-col v-for="attraction in filteredAttractions" :key="attraction.id" :xs="24" :sm="12" :md="8" :lg="6">
          <el-card class="attraction-card" shadow="hover" @click="goToDetail(attraction.id)">
            <img :src="attraction.image" :alt="attraction.name" class="card-image">
            <div class="card-content">
              <h3 class="card-title">{{ attraction.name }}</h3>
              <el-rate v-model="attraction.rating" disabled show-score text-color="#ff9900" />
              <p class="card-description">{{ attraction.description }}</p>
              <div class="card-footer">
                <span class="card-price"><span class="price-symbol">¥</span>{{ attraction.price }}</span>
                <el-button type="primary" plain size="small">查看详情</el-button>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<style scoped>
.attractions-page {
  min-height: 100vh;
  background-color: #f5f7fa;
}

/* 导航栏样式复用首页 */
.navbar { background-color: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 1000; }
.navbar-container { max-width: 1200px; margin: 0 auto; padding: 0 24px; display: flex; justify-content: space-between; align-items: center; height: 70px; }
.brand-title { font-size: 28px; font-weight: 700; background: linear-gradient(135deg, #409eff 0%, #67c23a 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0; }
.navbar-menu { display: flex; gap: 32px; align-items: center; }
.menu-item { color: #606266; text-decoration: none; font-size: 16px; font-weight: 500; transition: color 0.3s; }
.menu-item:hover, .menu-item.active { color: #409eff; }
.welcome-text { font-size: 14px; color: #606266; margin-right: 12px; }

/* 页面主体 */
.main-content { max-width: 1200px; margin: 0 auto; padding: 40px 24px; }
.page-header { text-align: center; margin-bottom: 40px; }
.page-header h2 { font-size: 36px; color: #303133; margin-bottom: 10px; }
.page-header p { font-size: 16px; color: #909399; }

.action-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; flex-wrap: wrap; gap: 20px; }
.search-box { width: 300px; }

.attraction-card { border-radius: 12px; cursor: pointer; transition: transform 0.3s; margin-bottom: 24px; border: none; }
.attraction-card:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.1) !important; }
.card-image { width: 100%; height: 200px; object-fit: cover; border-radius: 12px 12px 0 0; display: block; }
.card-content { padding: 16px; }
.card-title { font-size: 18px; margin: 0 0 10px; color: #303133; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-description { font-size: 13px; color: #606266; margin: 10px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 15px; }
.card-price { color: #f56c6c; font-size: 22px; font-weight: bold; }
.price-symbol { font-size: 14px; margin-right: 2px; }

@media (max-width: 768px) {
  .action-bar { flex-direction: column; align-items: stretch; }
  .search-box { width: 100%; }
}
</style>