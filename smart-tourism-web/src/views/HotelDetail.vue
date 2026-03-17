<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Location, Position, Star, StarFilled } from '@element-plus/icons-vue' 
import RoutePlan from '@/components/RoutePlan.vue'
import { useAuth } from '../composables/useAuth'

const route = useRoute()
const router = useRouter()
const axios = window.axios
const { userInfo } = useAuth() // 获取当前登录用户信息

const hotel = ref({
  id: 0,
  name: '加载中...',
  image: '',
  rating: 5.0,
  price: 0,
  address: '',
  description: '',
  longitude: null,
  latitude: null
})

// 入住和离店日期
const dateRange = ref([])
// 房间数量
const roomCount = ref(1)
// 🔥 新增：禁用过去的日期
const disabledDate = (time) => {
  // 减去 24 小时的毫秒数，确保可以选“今天”，但不能选“昨天”及以前
  return time.getTime() < Date.now() - 24 * 60 * 60 * 1000
}

// 控制地图懒加载的开关
const showMap = ref(false)

// 控制双轨制支付弹窗
const paymentDialogVisible = ref(false)

// 🔥 新增：动态计算入住晚数
const stayNights = computed(() => {
  if (dateRange.value && dateRange.value.length === 2) {
    const start = new Date(dateRange.value[0])
    const end = new Date(dateRange.value[1])
    // 计算时间差的毫秒数，转换为天数
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return nights > 0 ? nights : 1 // 哪怕不小心选了同一天，保底算1晚
  }
  return 1 // 没选日期时默认1晚
})

// 🔥 修复：动态计算总价 = 单价 × 房间数 × 入住晚数
const totalPrice = computed(() => {
  return hotel.value.price * roomCount.value * stayNights.value
})

// 获取数据库真实酒店详情
const fetchHotelDetail = async () => {
  const id = Number(route.params.id)
  try {
    const res = await axios.get(`http://localhost:8080/api/hotels/${id}`)
    const data = res.data
    hotel.value = {
      ...data,
      image: data.imageUrl || data.image || 'https://picsum.photos/800/600?hotel',
      rating: data.rating ? Number(data.rating) : 4.8
    }
  } catch (error) {
    ElMessage.error('获取酒店详情失败')
    setTimeout(() => router.back(), 2000)
  }
}

onMounted(() => {
  fetchHotelDetail()
  loadComments()
  checkFavoriteStatus() // 初始化时检查这间酒店有没有被收藏过
})

// ==========================================
// 🔥 新增：双轨制收银台逻辑
// ==========================================

// 1. 点击“立即预订”按钮：拦截验证，打开收银台弹窗
const openBookingDialog = () => {
  if (!userInfo.value) {
    ElMessage.warning('请先登录')
    router.push('/login')
    return
  }
  if (!dateRange.value || dateRange.value.length === 0) {
    ElMessage.warning('请选择入住和退房日期')
    return
  }
  // 验证通过，打开支付选择界面
  paymentDialogVisible.value = true
}

// ==========================================
// 🔥 新增：真实联网版 酒店收藏逻辑
// ==========================================
const isFavorited = ref(false)

// 1. 检查是否已收藏
const checkFavoriteStatus = async () => {
  if (!userInfo.value || !userInfo.value.id) return
  try {
    const res = await axios.get(`http://localhost:8080/api/favorites/${userInfo.value.id}`)
    if (res.data.code === 200) {
      const favorites = res.data.data
      const currentId = Number(route.params.id)
      // 🚨 关键：这里检查的是 HOTEL
      isFavorited.value = favorites.some(item => item.targetId === currentId && item.targetType === 'HOTEL')
    }
  } catch (error) {
    console.error('检查收藏状态失败:', error)
  }
}

// 2. 点击收藏/取消收藏按钮
const handleFavorite = async () => {
  if (!userInfo.value || !userInfo.value.id) {
    ElMessage.warning('请先登录后再收藏！')
    router.push('/login')
    return
  }

  const currentId = Number(route.params.id)

  try {
    if (!isFavorited.value) {
      // 🚀 添加酒店收藏
      const favoriteData = {
        userId: userInfo.value.id,
        targetId: currentId,
        targetType: 'HOTEL', // 🚨 必须告诉后端这是酒店！
        name: hotel.value.name,
        price: hotel.value.price,
        image: hotel.value.image
      }

      const res = await axios.post('http://localhost:8080/api/favorites/add', favoriteData)
      if (res.data.code === 200) {
        isFavorited.value = true
        ElMessage.success('🎉 已存入您的专属收藏夹')
      } else {
        ElMessage.error(res.data.msg || '收藏失败')
      }
    } else {
      // 🚀 取消酒店收藏
      const res = await axios.delete('http://localhost:8080/api/favorites/remove', {
        params: {
          userId: userInfo.value.id,
          targetId: currentId,
          targetType: 'HOTEL' // 🚨 取消的也是酒店
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

// 2. 方案 A：硬核支付宝沙箱支付 (已修复重复定义并加上雷达)
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
    // 1. 动态生成酒店订单号
    const orderNo = 'HOTEL' + new Date().getTime()

    // 2. 组装发给后端的真实订单数据
    const orderData = {
      orderNo: orderNo,
      hotelId: hotel.value.id,
      hotelName: hotel.value.name,
      userName: userInfo.value ? userInfo.value.username : '游客',
      phone: userInfo.value ? (userInfo.value.phone || '暂无手机号') : '暂无手机号',
      checkIn: dateRange.value[0],
      checkOut: dateRange.value[1],
      amount: totalPrice.value
    }

    try {
      // 3. 先把这条订单存进 MySQL！状态是 UNPAID
      await axios.post('http://localhost:8080/api/orders', orderData)

      // 4. 存库成功后，呼叫支付宝收银台！
      const subject = `${roomCount.value}间 - ${hotel.value.name}`
      window.location.href = `http://localhost:8080/api/alipay/pay?orderId=${orderNo}&amount=${totalPrice.value}&subject=${subject}`
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

// 3. 方案 B：真实联网版，提交预订订单 (🔥 已接入自动改状态逻辑)
const handleMockPay = async () => {
  try {
    const orderNo = 'MOCK_' + new Date().getTime()

    // 1. 组装发给后端的真实数据
    const orderData = {
      orderNo: orderNo,
      hotelId: hotel.value.id,
      hotelName: hotel.value.name,
      userName: userInfo.value ? userInfo.value.username : '游客',
      phone: userInfo.value ? (userInfo.value.phone || '暂无手机号') : '暂无手机号',
      checkIn: dateRange.value[0],
      checkOut: dateRange.value[1],
      amount: totalPrice.value
    }

    // 2. 发送真实 POST 请求生成 UNPAID 订单
    await axios.post('http://localhost:8080/api/orders', orderData)

    // 3. 🔥 立刻请求后端把这个订单改成已支付！(换成最稳的 URL 传参)
    const mockTradeNo = 'MOCK_TRADE_' + new Date().getTime()
    await axios.post(`http://localhost:8080/api/orders/paySuccess?orderNo=${orderNo}&alipayTradeNo=${mockTradeNo}`)

    ElMessage.success('一键模拟支付成功，期待您的入住！')
    paymentDialogVisible.value = false

    setTimeout(() => {
      // 支付成功后跳回个人中心的订单页
      router.push({ path: '/user', query: { tab: 'orders' } })
    }, 1000)

  } catch (error) {
    console.error('下单失败:', error)
    ElMessage.error('支付异常，请确保后端已重启并正常运行！')
  }
}
// ==========================================
// 🔥 酒店评价系统核心逻辑
// ==========================================
const comments = ref([])
const newComment = ref({
  rating: 5,
  content: ''
})
const isSubmitting = ref(false)

// 1. 拉取当前酒店的所有评价 (注意这里是 HOTEL)
const loadComments = async () => {
  try {
    const res = await axios.get(`http://localhost:8080/api/comments/HOTEL/${route.params.id}`)
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
      targetType: 'HOTEL', // 🔥 告诉后端这是给酒店的评价
      userName: userInfo.value.username,
      rating: newComment.value.rating,
      content: newComment.value.content
    }
    const res = await axios.post('http://localhost:8080/api/comments', commentData)
    if (res.data.code === 200) {
      ElMessage.success('🎉 评价发布成功！')
      newComment.value.content = ''
      newComment.value.rating = 5
      loadComments() // 刷新列表
    }
  } catch (error) {
    ElMessage.error('评价发布失败，请检查网络')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="hotel-detail-page">
    <div class="container">
      <el-page-header @back="() => router.back()" content="酒店详情" style="margin-bottom: 20px;" />

      <el-card shadow="never" class="detail-card">
        <el-row :gutter="40">
          <el-col :xs="24" :md="12">
            <img :src="hotel.image" :alt="hotel.name" class="hotel-img" />
          </el-col>

          <el-col :xs="24" :md="12" class="info-section">
            <h1 class="hotel-name">{{ hotel.name }}</h1>
            <div class="rating"><el-rate v-model="hotel.rating" disabled show-score text-color="#ff9900" /></div>

            <p class="address"><el-icon>
                <Location />
              </el-icon> {{ hotel.address }}</p>
            <p class="desc">{{ hotel.description }}</p>

            <div class="booking-box">
              <div class="price">
                <span class="symbol">¥</span>{{ hotel.price }}<span class="unit">/晚</span>
              </div>

              <el-form label-position="top" style="margin-top: 20px;">
                <el-form-item label="入住 - 退房日期">
                  <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="入住日期"
                    end-placeholder="退房日期" value-format="YYYY-MM-DD" style="width: 100%"
                    :disabled-date="disabledDate" />
                </el-form-item>
                <el-form-item label="房间数量">
                  <el-input-number v-model="roomCount" :min="1" :max="5" />
                </el-form-item>
                <div style="display: flex; gap: 15px; margin-top: 15px;">
                  <el-button type="primary" size="large" style="flex: 1; margin-top: 0;" @click="openBookingDialog">
                    立即预订
                  </el-button>

                  <el-button size="large" :type="isFavorited ? 'danger' : 'default'" style="flex: 1; margin-left: 0;"
                    @click="handleFavorite">
                    <el-icon v-if="isFavorited">
                      <StarFilled />
                    </el-icon>
                    <el-icon v-else>
                      <Star />
                    </el-icon>
                    {{ isFavorited ? '已收藏' : '加入收藏' }}
                  </el-button>
                </div>
              </el-form>
            </div>
          </el-col>
        </el-row>
      </el-card>

      <el-row :gutter="0" style="margin-top: 40px;">
        <el-col :span="24">
          <el-card class="route-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <span class="section-title"
                  style="display: flex; align-items: center; font-weight: bold; font-size: 18px;">
                  <el-icon style="margin-right: 8px; color: #409eff;">
                    <Location />
                  </el-icon>
                  酒店位置与交通规划
                </span>
              </div>
            </template>

            <div class="route-wrapper" v-if="hotel.longitude && hotel.latitude">
              <div v-if="!showMap" class="map-placeholder">
                <el-icon class="map-icon">
                  <Position />
                </el-icon>
                <p>点击加载高德地图路线规划，省流量更极速</p>
                <el-button type="primary" round size="large" @click="showMap = true">
                  🌍 开启路线导航
                </el-button>
              </div>

              <RoutePlan v-else :destName="hotel.name" :destLngLat="[hotel.longitude, hotel.latitude]" />
            </div>

            <div v-else class="no-coords" style="padding: 40px 0;">
              <el-empty description="该酒店暂未设置坐标信息，无法开启导航" />
            </div>
          </el-card>
        </el-col>
      </el-row>
      <el-row :gutter="0" style="margin-top: 40px;">
        <el-col :span="24">
          <el-card class="reviews-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <span class="section-title" style="font-weight: bold; font-size: 18px;">💬 住客评价 ({{ comments.length
                  }}条)</span>
              </div>
            </template>

            <div class="reviews-list" v-if="comments.length > 0">
              <div v-for="comment in comments" :key="comment.id" class="review-item"
                style="border-bottom: 1px solid #ebeef5; padding: 15px 0;">
                <div class="review-header"
                  style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
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
            <el-empty v-else description="还没有人评价过这家酒店哦，快来抢沙发吧！" />

            <div class="write-review" style="margin-top: 30px; background: #f8f9fa; padding: 20px; border-radius: 8px;">
              <h4 style="margin-top: 0; color: #303133;">✍️ 发表您的入住体验</h4>
              <el-form label-position="left">
                <el-form-item label="您的打分">
                  <el-rate v-model="newComment.rating" show-text />
                </el-form-item>
                <el-form-item label="评价内容">
                  <el-input type="textarea" v-model="newComment.content" :rows="3"
                    placeholder="床铺舒服吗？服务好不好？分享一下您的真实感受吧..." maxlength="500" show-word-limit />
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

    <el-dialog v-model="paymentDialogVisible" title="💳 请选择支付方式" width="550px" append-to-body destroy-on-close>
      <div class="dialog-order-summary">
        正在预订：<b style="color:#303133">{{ hotel.name }}</b><br>
        房间明细：{{ roomCount }} 间 × {{ stayNights }} 晚<br>
        入住时间：{{ dateRange[0] }} 至 {{ dateRange[1] }}<br>
        订单总价：<b style="color: #f56c6c; font-size: 22px;">¥{{ totalPrice }}</b>
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
.hotel-detail-page {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 30px 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.detail-card {
  border-radius: 12px;
}

.hotel-img {
  width: 100%;
  height: 450px;
  object-fit: cover;
  border-radius: 8px;
}

.hotel-name {
  font-size: 32px;
  margin: 0 0 10px 0;
  color: #303133;
}

.rating {
  margin-bottom: 15px;
}

.address {
  color: #606266;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.desc {
  color: #606266;
  line-height: 1.8;
  margin-bottom: 30px;
  text-align: justify;
}

.booking-box {
  background: #fafafa;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}

.price {
  color: #f56c6c;
  font-size: 36px;
  font-weight: bold;
}

.symbol {
  font-size: 20px;
  margin-right: 4px;
}

.unit {
  font-size: 16px;
  color: #909399;
  font-weight: normal;
  margin-left: 4px;
}

.submit-btn {
  width: 100%;
  margin-top: 10px;
  font-size: 18px;
  font-weight: bold;
}

/* 地图懒加载样式 */
.route-card {
  border-radius: 12px;
}

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
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
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