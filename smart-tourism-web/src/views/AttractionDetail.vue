<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Picture, Star, StarFilled } from '@element-plus/icons-vue'
import { useAuth } from '../composables/useAuth'
// ❌ 删除了 import { getAttractions } from '../utils/data'

const route = useRoute()
const router = useRouter()
const { userInfo } = useAuth()
const axios = window.axios // 确保引入 axios

// 景点数据 (初始空状态)
const attraction = ref({
  id: 0,
  name: '加载中...',
  image: '',
  rating: 5.0,
  price: 0,
  openTime: '',
  address: '',
  description: '',
})

// 游玩日期
const visitDate = ref('')

// 禁用日期逻辑
const disabledDate = (time) => {
  return time.getTime() < Date.now() - 24 * 60 * 60 * 1000
}

// 评论相关
const comments = ref([])
const newComment = ref('')
const newRating = ref(5)

// ---------------------------------------------------------
// 🔥 核心修改：向 Java 后端请求真实的单个景点详情
// ---------------------------------------------------------
const loadAttractionDetail = async () => {
  const id = Number(route.params.id)
  if (isNaN(id)) {
    ElMessage.error('无效的景点ID')
    return
  }
  
  try {
    // 调用后端 @GetMapping("/{id}") 接口
    const res = await axios.get(`http://localhost:8080/api/scenic-spots/${id}`)
    const data = res.data
    
    // 更新数据，注意把后端的 imageUrl 映射给前端的 image
    attraction.value = {
      ...data,
      image: data.imageUrl || data.image, 
      rating: data.rating || 5.0,
      openTime: data.openTime || '08:00 - 18:00',
      address: data.address || '暂无地址'
    }
  } catch (error) {
    console.error('获取详情失败:', error)
    ElMessage.error('获取景点详情失败，请检查后端服务')
    // 如果获取失败，两秒后自动返回首页
    setTimeout(() => router.push('/'), 2000)
  }
}

// 加载评论 (保持你的本地逻辑不变)
const loadComments = () => {
  const id = Number(route.params.id)
  const key = `comments_${id}`
  const storedComments = localStorage.getItem(key)
  
  if (storedComments) {
    comments.value = JSON.parse(storedComments)
  } else {
    comments.value = [
      {
        id: 1,
        username: '游客1',
        avatar: 'https://picsum.photos/40/40?random=1',
        rating: 5,
        content: '西湖太美了，风景如画，值得一去！',
        time: '2026-01-15 10:30'
      }
    ]
    localStorage.setItem(key, JSON.stringify(comments.value))
  }
}

// 提交评论 (保持不变)
const submitComment = () => {
  if (!userInfo.value) {
    ElMessage.warning('请先登录')
    return
  }
  if (!newComment.value.trim()) {
    ElMessage.warning('请输入评论内容')
    return
  }
  const id = Number(route.params.id)
  const key = `comments_${id}`
  const comment = {
    id: Date.now(),
    username: userInfo.value.username,
    avatar: `https://picsum.photos/40/40?random=${Math.floor(Math.random() * 1000)}`,
    rating: newRating.value,
    content: newComment.value.trim(),
    time: new Date().toLocaleString()
  }
  comments.value.unshift(comment)
  localStorage.setItem(key, JSON.stringify(comments.value))
  newComment.value = ''
  newRating.value = 5
  ElMessage.success('评论提交成功')
}

// 初始化加载景点数据和评论
onMounted(() => {
  loadAttractionDetail() // 现在这里会去查数据库了！
  loadComments()
  
  // 初始化收藏状态
  const favorites = JSON.parse(localStorage.getItem('my_favorites') || '[]')
  const currentId = Number(route.params.id)
  isFavorited.value = favorites.some(item => item.id === currentId)
})

// 预订门票 (保持不变)
const openBookingDialog = async () => {
  if (!userInfo.value) {
    ElMessage.warning('请先登录')
    router.push('/login')
    return
  }
  if (!visitDate.value) {
    ElMessage.warning('请先选择游玩日期')
    return
  }
  try {
    await ElMessageBox.confirm(
      `您预订的是 ${attraction.value.name} 在 ${visitDate.value} 的门票，价格 ¥${attraction.value.price}`,
      '支付确认',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' }
    )
    const newOrder = {
      id: Date.now(),
      attractionName: attraction.value.name,
      price: attraction.value.price,
      date: visitDate.value,
      image: attraction.value.image,
      status: '已支付',
      createTime: new Date().toLocaleString()
    }
    const orders = JSON.parse(localStorage.getItem('orders') || '[]')
    orders.push(newOrder)
    localStorage.setItem('orders', JSON.stringify(orders))
    
    ElMessage.success('支付成功！')
    setTimeout(() => {
      router.push({ path: '/user', query: { tab: 'orders' } })
    }, 1000)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('支付失败，请重试')
    }
  }
}

// 加入收藏 (保持不变)
const isFavorited = ref(false)
const handleFavorite = () => {
  const currentId = Number(route.params.id)
  const favorites = JSON.parse(localStorage.getItem('my_favorites') || '[]')
  
  if (!isFavorited.value) {
    const newItem = {
      id: currentId,
      name: attraction.value.name,
      price: attraction.value.price,
      image: attraction.value.image
    }
    favorites.push(newItem)
    localStorage.setItem('my_favorites', JSON.stringify(favorites))
    isFavorited.value = true
    ElMessage.success('已加入收藏')
  } else {
    const updatedFavorites = favorites.filter(item => item.id !== currentId)
    localStorage.setItem('my_favorites', JSON.stringify(updatedFavorites))
    isFavorited.value = false
    ElMessage.info('已取消收藏')
  }
}
</script>

<template>
  <div class="attraction-detail">
    <!-- 面包屑导航 -->
    <div class="breadcrumb-container">
      <el-breadcrumb separator=">">
        <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
        <el-breadcrumb-item>景点详情</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <!-- 主体内容 -->
    <div class="content-container">
      <el-row :gutter="40">
        <!-- 左侧：景点封面图 -->
        <el-col :xs="24" :sm="24" :md="14" :lg="14">
          <div class="image-wrapper">
            <el-image
              :src="attraction.image"
              :alt="attraction.name"
              fit="cover"
              class="cover-image"
            >
              <template #error>
                <div class="image-slot">
                  <el-icon><Picture /></el-icon>
                </div>
              </template>
            </el-image>
          </div>
        </el-col>

        <!-- 右侧：景点信息区 -->
        <el-col :xs="24" :sm="24" :md="10" :lg="10">
          <div class="info-section">
            <!-- 景点名称 -->
            <h1 class="attraction-name">{{ attraction.name }}</h1>

            <!-- 评分 -->
            <div class="rating-section">
              <el-rate
                v-model="attraction.rating"
                disabled
                show-score
                text-color="#ff9900"
                score-template="{value}"
                class="rating"
              />
            </div>

            <!-- 价格 -->
            <div class="price-section">
              <span class="price-symbol">¥</span>
              <span class="price-value">{{ attraction.price }}</span>
              <span class="price-unit">/人</span>
            </div>

            <!-- 详细信息 -->
            <el-descriptions
              :column="1"
              border
              class="descriptions"
            >
              <el-descriptions-item label="开放时间">
                {{ attraction.openTime }}
              </el-descriptions-item>
              <el-descriptions-item label="详细地址">
                {{ attraction.address }}
              </el-descriptions-item>
            </el-descriptions>

            <!-- 简介 -->
            <div class="description-section">
              <h3 class="section-title">景点简介</h3>
              <p class="description-text">{{ attraction.description }}</p>
            </div>

            <!-- 日期选择 -->
            <div style="margin-bottom: 20px;">
              <span style="margin-right: 10px; font-weight: bold;">选择日期：</span>
              <el-date-picker
                v-model="visitDate"
                type="date"
                placeholder="请选择游玩日期"
                :disabled-date="disabledDate"
                value-format="YYYY-MM-DD"
              />
            </div>
            
            <!-- 操作按钮 -->
            <div class="action-buttons">
              <el-button
                type="primary"
                size="large"
                class="book-btn"
                @click="openBookingDialog"
              >
                立即预订
              </el-button>
              <el-button
                size="large"
                :type="isFavorited ? 'danger' : 'default'"
                class="favorite-btn"
                @click="handleFavorite"
              >
                <el-icon v-if="isFavorited"><StarFilled /></el-icon>
                <el-icon v-else><Star /></el-icon>
                {{ isFavorited ? '已收藏' : '加入收藏' }}
              </el-button>
            </div>
          </div>
        </el-col>
      </el-row>

      <!-- 评论留言模块 -->
      <el-row :gutter="0" style="margin-top: 60px;">
        <el-col :span="24">
          <el-card class="comments-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <span class="comments-title">游客评价 ({{ attraction.rating }}分)</span>
              </div>
            </template>
            
            <!-- 评论列表 -->
            <div class="comments-list">
              <template v-if="comments.length === 0">
                <div class="no-comments">
                  <p>暂无评论，快来抢沙发吧！</p>
                </div>
              </template>
              <template v-else>
                <div class="comment-item" v-for="comment in comments" :key="comment.id">
                  <div class="comment-header">
                    <el-avatar :src="comment.avatar" size="small" style="margin-right: 10px;">{{ comment.username.charAt(0) }}</el-avatar>
                    <div class="comment-user-info">
                      <span class="comment-username">{{ comment.username }}</span>
                      <span class="comment-time">{{ comment.time }}</span>
                    </div>
                    <div class="comment-rating">
                      <el-rate v-model="comment.rating" disabled :max="5" size="small" />
                    </div>
                  </div>
                  <div class="comment-content">
                    {{ comment.content }}
                  </div>
                </div>
              </template>
            </div>
            
            <!-- 发表评论 -->
            <div class="comment-form">
              <h4 class="form-title">发表评价</h4>
              <div class="form-content">
                <el-form label-width="80px">
                  <el-form-item label="评分">
                    <el-rate v-model="newRating" :max="5" />
                  </el-form-item>
                  <el-form-item label="评论内容">
                    <el-input
                      v-model="newComment"
                      type="textarea"
                      placeholder="请输入您的评价..."
                      rows="4"
                    />
                  </el-form-item>
                  <el-form-item>
                    <el-button type="primary" @click="submitComment">提交评价</el-button>
                  </el-form-item>
                </el-form>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>


  </div>
</template>

<style scoped>
.attraction-detail {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 20px 0 60px;
}

.breadcrumb-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 24px;
}

.content-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.image-wrapper {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.cover-image {
  width: 100%;
  height: 500px;
  border-radius: 12px;
}

.image-slot {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  background: #f5f7fa;
  color: #909399;
  font-size: 30px;
}

.info-section {
  padding: 0 20px;
}

.attraction-name {
  font-size: 36px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 20px 0;
  line-height: 1.2;
}

.rating-section {
  margin-bottom: 24px;
}

.rating {
  font-size: 16px;
}

.price-section {
  margin-bottom: 30px;
  display: flex;
  align-items: baseline;
}

.price-symbol {
  font-size: 24px;
  color: #f56c6c;
  font-weight: 600;
  margin-right: 4px;
}

.price-value {
  font-size: 48px;
  color: #f56c6c;
  font-weight: 700;
  margin-right: 8px;
}

.price-unit {
  font-size: 18px;
  color: #909399;
}

.descriptions {
  margin-bottom: 30px;
}

.description-section {
  margin-bottom: 40px;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 16px 0;
}

.description-text {
  font-size: 15px;
  line-height: 1.8;
  color: #606266;
  margin: 0;
  text-align: justify;
}

.action-buttons {
  display: flex;
  gap: 16px;
  margin-top: 40px;
}

.book-btn {
  flex: 1;
  height: 50px;
  font-size: 16px;
  font-weight: 600;
}

.favorite-btn {
  flex: 1;
  height: 50px;
  font-size: 16px;
}



/* 评论模块样式 */
.comments-card {
  border-radius: 12px;
  overflow: hidden;
}

.comments-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.comments-list {
  margin: 20px 0;
}

.no-comments {
  text-align: center;
  padding: 40px 0;
  color: #909399;
  font-size: 16px;
}

.comment-item {
  padding: 20px 0;
  border-bottom: 1px solid #f0f0f0;
}

.comment-item:last-child {
  border-bottom: none;
}

.comment-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.comment-user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.comment-username {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.comment-time {
  font-size: 12px;
  color: #909399;
}

.comment-rating {
  margin-left: 10px;
}

.comment-content {
  font-size: 14px;
  line-height: 1.6;
  color: #606266;
  margin-left: 48px;
}

.comment-form {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid #e4e7ed;
}

.form-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 20px;
}

.form-content {
  background-color: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .attraction-name {
    font-size: 28px;
  }

  .price-value {
    font-size: 36px;
  }

  .cover-image {
    height: 300px;
  }

  .info-section {
    padding: 20px 0;
  }

  .action-buttons {
    flex-direction: column;
  }

  .book-btn,
  .favorite-btn {
    width: 100%;
  }

  .comment-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .comment-rating {
    margin-left: 0;
  }

  .comment-content {
    margin-left: 0;
  }

  .form-content {
    padding: 15px;
  }
}
</style>
