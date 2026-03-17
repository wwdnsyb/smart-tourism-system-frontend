<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Picture, Star, StarFilled, Position, Location } from '@element-plus/icons-vue' // 增加了 Position 和 Location 以支持地图UI
import { useAuth } from '../composables/useAuth'
import RoutePlan from '@/components/RoutePlan.vue'
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


// 控制地图是否显示的开关，默认不显示
const showMap = ref(false)

// ---------------------------------------------------------
// 获取真实的单个景点详情
// ---------------------------------------------------------
const loadAttractionDetail = async () => {
  const id = Number(route.params.id)
  if (isNaN(id)) {
    ElMessage.error('无效的景点ID')
    return
  }
  
  try {
    const res = await axios.get(`http://localhost:8080/api/scenic-spots/${id}`)
    const data = res.data
    
    attraction.value = {
      ...data,
      image: data.imageUrl || data.image, 
      rating: data.rating || 5.0,
      openTime: data.openTime || '08:00 - 18:00',
      address: data.address || '暂无地址'
    }

    // 👇 === 强制注入测试坐标，激活高德地图 === 👇
    attraction.value.longitude = 116.397026; // 故宫经度
    attraction.value.latitude = 39.918058;   // 故宫纬度
    // 👆 ======================================= 👆

  } catch (error) {
    console.error('获取详情失败:', error)
    ElMessage.error('获取景点详情失败，请检查后端服务')
    setTimeout(() => router.push('/'), 2000)
  }
}

// 初始化加载景点数据和评论
onMounted(() => {
  loadAttractionDetail()
  loadComments()
  checkFavoriteStatus() // 🔥 新增：从后端检查真实收藏状态
})

// 🔥 新增：去数据库查询该用户是否收藏了当前景点
const checkFavoriteStatus = async () => {
  if (!userInfo.value || !userInfo.value.id) return // 没登录就不查
  
  try {
    const res = await axios.get(`http://localhost:8080/api/favorites/${userInfo.value.id}`)
    if (res.data.code === 200) {
      const favorites = res.data.data
      const currentId = Number(route.params.id)
      // 遍历后端的收藏列表，看看有没有当前景点 (类型必须是 SPOT)
      isFavorited.value = favorites.some(item => item.targetId === currentId && item.targetType === 'SPOT')
    }
  } catch (error) {
    console.error('检查收藏状态失败:', error)
  }
}

const paymentDialogVisible = ref(false)

const openBookingDialog = () => {
  if (!userInfo.value) {
    ElMessage.warning('请先登录')
    router.push('/login')
    return
  }
  if (!visitDate.value) {
    ElMessage.warning('请先选择游玩日期')
    return
  }
  // 验证通过，打开支付选择界面
  paymentDialogVisible.value = true
}
// 2. 方案 A：硬核支付宝沙箱支付
const handleAlipaySandbox = () => {
  ElMessageBox.confirm(
    `<div style="line-height: 1.8; font-size: 14px;">
      <p>为了展示完整的技术链路，本系统接入了<b>支付宝沙箱环境</b>。</p>
      <p>请在此复制测试账号，并在稍后的支付宝页面右侧选择<b>“登录账户付款”</b>：</p>
      <div style="background: #f4f4f5; padding: 12px; border-radius: 6px; margin-top: 12px; border: 1px dashed #909399;">
        <p style="margin: 0;">👤 <b>买家账号：</b><span style="color:#409EFF; font-weight: bold;">【gnjfhy5689@sandbox.com】</span></p>
        <p style="margin: 5px 0 0 0;">🔑 <b>登录密码：</b>111111</p>
        <p style="margin: 5px 0 0 0;">🔒 <b>支付密码：</b>111111</p>
      </div>
      <p style="color: #E6A23C; font-size: 12px; margin-top: 10px;">⚠️ 注：此为虚拟测试环境，绝对不会扣除您真实的资金！</p>
    </div>`,
    '🛡️ 支付宝沙箱测试提示',
    {
      dangerouslyUseHTMLString: true,
      confirmButtonText: '已复制账号，前往支付',
      cancelButtonText: '暂不体验',
      type: 'info'
    }
  ).then(async () => { 
    
    // 1. 动态生成门票订单号 (TICKET开头)
    const orderNo = 'TICKET' + new Date().getTime() 

    // 2. 🚨 核心修复：这里使用的是 attraction 和 visitDate，绝对不会再报 undefined 了！
    const orderData = {
      orderNo: orderNo, 
      hotelId: attraction.value.id, 
      hotelName: attraction.value.name + ' (门票)',
      userName: userInfo.value ? userInfo.value.username : '游客', 
      phone: userInfo.value ? (userInfo.value.phone || '暂无手机号') : '暂无手机号',
      checkIn: visitDate.value, 
      checkOut: visitDate.value, 
      amount: attraction.value.price
    }

    try {
      // 3. 存入数据库 (状态默认为 UNPAID)
      await axios.post('http://localhost:8080/api/orders', orderData)
      
      // 4. 跳转支付宝
      const subject = attraction.value.name + '门票'
      window.location.href = `http://localhost:8080/api/alipay/pay?orderId=${orderNo}&amount=${attraction.value.price}&subject=${subject}`
    } catch (error) {
      console.error("后台接口报错：", error)
      ElMessage.error('创建订单失败，无法发起支付')
    }
  }).catch((err) => {
    // 抓虫雷达
    if (err === 'cancel' || err === 'close') {
      ElMessage.info('已取消沙箱支付')
    } else {
      console.error('🚨 抓到报错：', err)
      ElMessage.error('程序运行报错：' + (err.message || '未知错误'))
    }
  })
}

// 3. 方案 B：模拟支付 (加入了秒变 PAID 的逻辑)
const handleMockPay = async () => {
  try {
    const orderNo = 'MOCK_TICKET_' + new Date().getTime()

    // 1. 组装发给后端的真实数据
    const orderData = {
      orderNo: orderNo, // 必须传单号
      hotelId: attraction.value.id, 
      hotelName: attraction.value.name + ' (门票)', 
      userName: userInfo.value ? userInfo.value.username : '游客', 
      phone: userInfo.value ? (userInfo.value.phone || '暂无手机号') : '暂无手机号',
      checkIn: visitDate.value, 
      checkOut: visitDate.value, 
      amount: attraction.value.price
    }

    // 2. 发送真实请求，生成 UNPAID 订单
    await axios.post('http://localhost:8080/api/orders', orderData)
    
    // 3. 🔥 核心修复：立刻请求后端把这个订单改成已支付！(使用最稳的 URL 传参)
    const mockTradeNo = 'MOCK_TRADE_' + new Date().getTime()
    await axios.post(`http://localhost:8080/api/orders/paySuccess?orderNo=${orderNo}&alipayTradeNo=${mockTradeNo}`)
    
    ElMessage.success('模拟支付成功！门票已出票。')
    paymentDialogVisible.value = false // 关闭弹窗
    
    setTimeout(() => {
      // 支付成功后跳回个人中心的订单页
      router.push({ path: '/user', query: { tab: 'orders' } })
    }, 1000)
    
  } catch (error) {
    console.error('门票下单失败:', error)
    ElMessage.error('支付失败，请检查后端服务是否正常')
  }
}

// 加入收藏 (保持不变)
// ==========================================
// 🔥 核心修改：真实联网版收藏逻辑
// ==========================================
const isFavorited = ref(false)

const handleFavorite = async () => {
  // 1. 拦截未登录用户
  if (!userInfo.value || !userInfo.value.id) {
    ElMessage.warning('请先登录后再收藏！')
    router.push('/login')
    return
  }

  const currentId = Number(route.params.id)

  try {
    if (!isFavorited.value) {
      // 🚀 发起添加收藏请求
      const favoriteData = {
        userId: userInfo.value.id,
        targetId: currentId,
        targetType: 'SPOT', // 🚨 关键：告诉后端这是景点
        name: attraction.value.name,
        price: attraction.value.price,
        image: attraction.value.image // 传入景点封面图
      }
      
      const res = await axios.post('http://localhost:8080/api/favorites/add', favoriteData)
      
      if (res.data.code === 200) {
        isFavorited.value = true
        ElMessage.success('🎉 已存入您的专属收藏夹')
      } else {
        ElMessage.error(res.data.msg || '收藏失败')
      }
      
    } else {
      // 🚀 发起取消收藏请求
      const res = await axios.delete('http://localhost:8080/api/favorites/remove', {
        params: {
          userId: userInfo.value.id,
          targetId: currentId,
          targetType: 'SPOT' // 🚨 关键：告诉后端取消的是这个景点
        }
      })
      
      if (res.data.code === 200) {
        isFavorited.value = false
        ElMessage.info('已取消收藏')
      } else {
        ElMessage.error(res.data.msg || '取消失败')
      }
    }
  } catch (error) {
    console.error('收藏操作报错:', error)
    ElMessage.error('服务器连接异常，请稍后再试')
  }
}
// ==========================================
// 🔥 评价系统核心逻辑
// ==========================================
const comments = ref([]) // 存放从后端拉取的评论列表
const newComment = ref({
  rating: 5,
  content: ''
})
const isSubmitting = ref(false)

// 1. 拉取当前景点的所有评价
const loadComments = async () => {
  try {
    const res = await axios.get(`http://localhost:8080/api/comments/ATTRACTION/${route.params.id}`)
    if (res.data.code === 200) {
      comments.value = res.data.data
    }
  } catch (error) {
    console.error('获取评价失败:', error)
  }
}

// 2. 提交新评价
const handleSubmitComment = async () => {
  if (!userInfo.value) {
    ElMessage.warning('请先登录后再发表评价！')
    router.push('/login')
    return
  }
  if (!newComment.value.content.trim()) {
    ElMessage.warning('评价内容不能为空哦！')
    return
  }

  isSubmitting.value = true
  try {
    const commentData = {
      targetId: route.params.id,
      targetType: 'ATTRACTION', // 告诉后端这是给景点的评价
      userName: userInfo.value.username,
      rating: newComment.value.rating,
      content: newComment.value.content
    }
    const res = await axios.post('http://localhost:8080/api/comments', commentData)
    if (res.data.code === 200) {
      ElMessage.success('🎉 评价发布成功！')
      newComment.value.content = '' // 清空输入框
      newComment.value.rating = 5   // 重置评分为5星
      loadComments() // 立刻刷新评价列表！
    }
  } catch (error) {
    ElMessage.error('评价发布失败，请检查网络')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="attraction-detail">
    <div class="breadcrumb-container">
      <el-breadcrumb separator=">">
        <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
        <el-breadcrumb-item>景点详情</el-breadcrumb-item>
      </el-breadcrumb>
    </div>
    
    <div class="content-container">
      <el-row :gutter="40">
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

        <el-col :xs="24" :sm="24" :md="10" :lg="10">
          <div class="info-section">
            <h1 class="attraction-name">{{ attraction.name }}</h1>

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

            <div class="price-section">
              <span class="price-symbol">¥</span>
              <span class="price-value">{{ attraction.price }}</span>
              <span class="price-unit">/人</span>
            </div>

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

            <div class="description-section">
              <h3 class="section-title">景点简介</h3>
              <p class="description-text">{{ attraction.description }}</p>
            </div>

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

      <el-row :gutter="0" style="margin-top: 40px;">
        <el-col :span="24">
          <el-card class="route-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <span class="section-title" style="display: flex; align-items: center; font-weight: bold; font-size: 18px;">
                  <el-icon style="margin-right: 8px; color: #409eff;"><Location /></el-icon>
                  路线导航与交通规划
                </span>
              </div>
            </template>
            
            <div class="route-wrapper" v-if="attraction.longitude && attraction.latitude">
              <div v-if="!showMap" class="map-placeholder">
                <el-icon class="map-icon"><Position /></el-icon>
                <p>点击加载高德地图路线规划，省流量更极速</p>
                <el-button type="primary" round size="large" @click="showMap = true">
                  🌍 开启路线导航
                </el-button>
              </div>
              
              <RoutePlan 
                v-else
                :destName="attraction.name" 
                :destLngLat="[attraction.longitude, attraction.latitude]" 
              />
            </div>
            
            <div v-else class="no-coords" style="padding: 40px 0;">
              <el-empty description="该景点暂未设置坐标信息，无法开启导航" />
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="0" style="margin-top: 40px;">
        <el-col :span="24">
      <el-card class="reviews-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span class="section-title">💬 游客评价 ({{ comments.length }}条)</span>
          </div>
        </template>
        
        <div class="reviews-list" v-if="comments.length > 0">
          <div v-for="comment in comments" :key="comment.id" class="review-item" style="border-bottom: 1px solid #ebeef5; padding: 15px 0;">
            <div class="review-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div class="user-info" style="font-weight: bold; color: #409EFF;">
                👤 {{ comment.userName }}
              </div>
              <div class="review-time" style="color: #909399; font-size: 13px;">
                {{ comment.createTime }}
              </div>
            </div>
            <div class="review-rating" style="margin-bottom: 10px;">
              <el-rate v-model="comment.rating" disabled show-score text-color="#ff9900" />
            </div>
            <div class="review-content" style="color: #606266; line-height: 1.6;">
              {{ comment.content }}
            </div>
          </div>
        </div>
        <el-empty v-else description="还没有人评价过哦，快来抢沙发吧！" />

        <div class="write-review" style="margin-top: 30px; background: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h4 style="margin-top: 0; color: #303133;">✍️ 发表您的评价</h4>
          <el-form label-position="left">
            <el-form-item label="您的打分">
              <el-rate v-model="newComment.rating" show-text />
            </el-form-item>
            <el-form-item label="评价内容">
              <el-input 
                type="textarea" 
                v-model="newComment.content" 
                :rows="3" 
                placeholder="这里的风景怎么样？好玩吗？分享一下您的真实感受吧..." 
                maxlength="500"
                show-word-limit
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" size="large" @click="handleSubmitComment" :loading="isSubmitting">
                🚀 提交评价
              </el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-card>
        </el-col>
      </el-row>
    </div>
    <el-dialog 
      v-model="paymentDialogVisible" 
      title="💳 请选择支付方式" 
      width="550px"
      append-to-body
      destroy-on-close
    >
      <div class="dialog-order-summary">
        正在支付：<b style="color:#303133">{{ attraction.name }}</b> 门票<br>
        游玩日期：{{ visitDate }} <br>
        需支付：<b style="color: #f56c6c; font-size: 22px;">¥{{ attraction.price }}</b>
      </div>

      <div class="payment-options">
        <div class="pay-option-box alipay-box" @click="handleAlipaySandbox">
          <div class="pay-icon"><span style="font-size: 32px; color: #1677FF;">🟦</span></div>
          <div class="pay-info">
            <h3 style="margin: 0; color: #303133;">支付宝真实网关体验 (推荐)</h3>
            <p style="margin: 5px 0 0; font-size: 12px; color: #909399;">对接官方沙箱网关，体验企业级核心支付闭环</p>
          </div>
          <el-tag type="primary" effect="dark" size="small" round>技术展示</el-tag>
        </div>

        <div class="pay-option-box mock-box" @click="handleMockPay">
          <div class="pay-icon"><span style="font-size: 32px;">⚡</span></div>
          <div class="pay-info">
            <h3 style="margin: 0; color: #303133;">一键快捷模拟支付</h3>
            <p style="margin: 5px 0 0; font-size: 12px; color: #909399;">绕过网关直接模拟订单生成，适合快速流程测试</p>
          </div>
          <el-tag type="success" effect="plain" size="small" round>极速通道</el-tag>
        </div>
      </div>
    </el-dialog>
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
/* 地图懒加载占位区样式 */
.map-placeholder {
  height: 200px;
  background-color: #f8f9fa;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #909399;
  transition: all 0.3s;
}
.map-placeholder:hover {
  border-color: #409eff;
  background-color: #ecf5ff;
}
.map-placeholder .map-icon {
  font-size: 40px;
  color: #a0cfff;
  margin-bottom: 10px;
}
.map-placeholder p {
  margin-bottom: 20px;
  font-size: 14px;
}
/* 🔥 新增：支付弹窗专属样式 */
.dialog-order-summary {
  background-color: #f4f4f5;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 25px;
  font-size: 15px;
  line-height: 1.6;
  color: #606266;
}
.payment-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.pay-option-box {
  display: flex;
  align-items: center;
  padding: 20px;
  border: 2px solid #ebeef5;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
}
.pay-option-box:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.08);
}
.alipay-box:hover {
  border-color: #1677FF;
  background-color: #f0f7ff;
}
.mock-box:hover {
  border-color: #67C23A;
  background-color: #f0f9eb;
}
.pay-icon {
  margin-right: 20px;
}
.pay-info {
  flex: 1;
}
</style>