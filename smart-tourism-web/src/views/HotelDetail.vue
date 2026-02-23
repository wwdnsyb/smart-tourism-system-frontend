<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
// ⚠️ 新增引入了 Position 图标
import { Location, Position } from '@element-plus/icons-vue'
// ⚠️ 新增引入 RoutePlan 组件
import RoutePlan from '@/components/RoutePlan.vue'
// ⚠️ 新增引入获取用户信息的 composables
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
  // ⚠️ 新增经纬度字段的初始值
  longitude: null,
  latitude: null
})

// 入住和离店日期
const dateRange = ref([])
// 房间数量
const roomCount = ref(1)

// ⚠️ 新增控制地图懒加载的开关
const showMap = ref(false)

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
})

// ==========================================
// 🔥 真实联网版：提交预订订单
// ==========================================
const confirmBooking = async () => {
  if (!dateRange.value || dateRange.value.length === 0) {
    ElMessage.warning('请选择入住和退房日期')
    return
  }
  
  const totalPrice = hotel.value.price * roomCount.value
  
  try {
    await ElMessageBox.confirm(
      `您将预订 ${roomCount.value} 间【${hotel.value.name}】\n入住：${dateRange.value[0]}\n退房：${dateRange.value[1]}\n总价：¥${totalPrice}`,
      '确认订单',
      { confirmButtonText: '确认支付', cancelButtonText: '取消', type: 'warning' }
    )
    
    // 组装要发给后端的真实数据，字段名对应你的 Java Entity
    const orderData = {
      hotelId: hotel.value.id,
      hotelName: hotel.value.name,
      userName: userInfo.value ? userInfo.value.username : '游客', 
      phone: userInfo.value ? (userInfo.value.phone || '暂无手机号') : '暂无手机号',
      
      checkIn: dateRange.value[0], 
      checkOut: dateRange.value[1],
      
      amount: totalPrice
    }

    // 发送真实 POST 请求到你的 Java 后端
    await axios.post('http://localhost:8080/api/orders', orderData)
    
    ElMessage.success('支付成功，期待您的入住！')
    
    setTimeout(() => {
      // 支付成功后跳回个人中心的订单页
      router.push({ path: '/user', query: { tab: 'orders' } })
    }, 1000)
    
  } catch (error) {
    if (error !== 'cancel') {
      console.error('下单失败:', error)
      ElMessage.error('支付异常，请检查后端接口是否报错')
    }
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
            <div class="rating"><el-rate v-model="hotel.rating" disabled show-score text-color="#ff9900"/></div>
            
            <p class="address"><el-icon><Location /></el-icon> {{ hotel.address }}</p>
            <p class="desc">{{ hotel.description }}</p>
            
            <div class="booking-box">
              <div class="price">
                <span class="symbol">¥</span>{{ hotel.price }}<span class="unit">/晚</span>
              </div>
              
              <el-form label-position="top" style="margin-top: 20px;">
                <el-form-item label="入住 - 退房日期">
                  <el-date-picker
                    v-model="dateRange"
                    type="daterange"
                    range-separator="至"
                    start-placeholder="入住日期"
                    end-placeholder="退房日期"
                    value-format="YYYY-MM-DD"
                    style="width: 100%"
                  />
                </el-form-item>
                <el-form-item label="房间数量">
                  <el-input-number v-model="roomCount" :min="1" :max="5" />
                </el-form-item>
                <el-button type="primary" size="large" class="submit-btn" @click="confirmBooking">
                  立即预订
                </el-button>
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
                <span class="section-title" style="display: flex; align-items: center; font-weight: bold; font-size: 18px;">
                  <el-icon style="margin-right: 8px; color: #409eff;"><Location /></el-icon>
                  酒店位置与交通规划
                </span>
              </div>
            </template>
            
            <div class="route-wrapper" v-if="hotel.longitude && hotel.latitude">
              <div v-if="!showMap" class="map-placeholder">
                <el-icon class="map-icon"><Position /></el-icon>
                <p>点击加载高德地图路线规划，省流量更极速</p>
                <el-button type="primary" round size="large" @click="showMap = true">
                  🌍 开启路线导航
                </el-button>
              </div>
              
              <RoutePlan 
                v-else
                :destName="hotel.name" 
                :destLngLat="[hotel.longitude, hotel.latitude]" 
              />
            </div>
            
            <div v-else class="no-coords" style="padding: 40px 0;">
              <el-empty description="该酒店暂未设置坐标信息，无法开启导航" />
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<style scoped>
.hotel-detail-page { min-height: 100vh; background-color: #f5f7fa; padding: 30px 0; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
.detail-card { border-radius: 12px; }
.hotel-img { width: 100%; height: 450px; object-fit: cover; border-radius: 8px; }
.hotel-name { font-size: 32px; margin: 0 0 10px 0; color: #303133; }
.rating { margin-bottom: 15px; }
.address { color: #606266; margin-bottom: 20px; display: flex; align-items: center; gap: 5px; }
.desc { color: #606266; line-height: 1.8; margin-bottom: 30px; text-align: justify; }
.booking-box { background: #fafafa; padding: 20px; border-radius: 8px; border: 1px solid #ebeef5; }
.price { color: #f56c6c; font-size: 36px; font-weight: bold; }
.symbol { font-size: 20px; margin-right: 4px; }
.unit { font-size: 16px; color: #909399; font-weight: normal; margin-left: 4px; }
.submit-btn { width: 100%; margin-top: 10px; font-size: 18px; font-weight: bold; }

/* ========================================== */
/* ⚠️ 新增：地图懒加载占位区样式 ⚠️ */
/* ========================================== */
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
</style>