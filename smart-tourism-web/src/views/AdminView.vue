<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as echarts from 'echarts'

const router = useRouter()
const activeMenu = ref('dashboard')
const allOrders = ref([])
const searchKeyword = ref('')
const loading = ref(false)
const axios = window.axios

const weekOffset = ref(0)
const currentWeekRange = ref('') 

const chartData = ref([
  { day: '周一', value: 0, height: '0%' },
  { day: '周二', value: 0, height: '0%' },
  { day: '周三', value: 0, height: '0%' },
  { day: '周四', value: 0, height: '0%' },
  { day: '周五', value: 0, height: '0%' },
  { day: '周六', value: 0, height: '0%' },
  { day: '周日', value: 0, height: '0%' },
])

const loadAllOrders = async () => {
  loading.value = true
  try {
    const res = await axios.get('http://localhost:8080/api/orders/all')
    if (res.data.code === 200) {
      allOrders.value = res.data.data.map(item => ({
        id: item.id,
        attractionName: item.hotelName, 
        price: item.amount,            
        date: item.checkIn,            
        userName: item.userName,       
        status: item.status || '已支付',
        createTime: item.createTime     
      }))
      
      updateTrendChart() 
      initMapChart() // 加载完真实订单后，再去渲染真实地图
    }
  } catch (error) {
    ElMessage.error('无法连接到数据库')
  } finally {
    loading.value = false
  }
}

// ==========================================
// 🧠 新增：从真实订单提取地域数据的智能算法
// ==========================================
const generateRealMapData = () => {
  const provinceMap = {}

  // 遍历你数据库拉出来的所有真实订单
  allOrders.value.forEach(order => {
    const name = order.attractionName || ''
    let province = ''

    // 智能关键词提取：根据你订单里的项目名称，映射到真实的中国省份
    if (name.includes('北京') || name.includes('故宫') || name.includes('颐和园') || name.includes('长城')) province = '北京市'
    else if (name.includes('上海') || name.includes('东方明珠') || name.includes('迪士尼')) province = '上海市'
    else if (name.includes('广东') || name.includes('广州') || name.includes('深圳') || name.includes('长隆')) province = '广东省'
    else if (name.includes('四川') || name.includes('成都') || name.includes('九寨沟')) province = '四川省'
    else if (name.includes('浙江') || name.includes('杭州') || name.includes('西湖')) province = '浙江省'
    else if (name.includes('江苏') || name.includes('南京') || name.includes('苏州')) province = '江苏省'
    else if (name.includes('陕西') || name.includes('西安') || name.includes('兵马俑')) province = '陕西省'
    else if (name.includes('海南') || name.includes('三亚')) province = '海南省'
    else if (name.includes('山东') || name.includes('青岛') || name.includes('泰山')) province = '山东省'
    else if (name.includes('湖南') || name.includes('长沙') || name.includes('张家界')) province = '湖南省'
    else if (name.includes('湖北') || name.includes('武汉')) province = '湖北省'
    else if (name.includes('福建') || name.includes('厦门')) province = '福建省'
    else if (name.includes('重庆')) province = '重庆市'
    else if (name.includes('天津')) province = '天津市'
    // 可以根据你的实际测试数据继续往下加...
    
    // 如果匹配到了省份，就把这个订单的金额累加到该省份上
    if (province) {
      if (!provinceMap[province]) {
        provinceMap[province] = 0
      }
      provinceMap[province] += Number(order.price || 0) // 这里我们统计的是真实消费金额
    }
  })

  // 转换为 ECharts 需要的 [{name: 'xx', value: 100}] 格式
  return Object.keys(provinceMap).map(key => ({
    name: key,
    value: provinceMap[key]
  }))
}

// ==========================================
// 🗺️ 渲染地图 (完全绑定真实数据)
// ==========================================
const initMapChart = async () => {
  await nextTick() 
  const chartDom = document.getElementById('china-map')
  if (!chartDom) return
  
  const myChart = echarts.init(chartDom)
  myChart.showLoading()

  try {
    const response = await fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
    const mapData = await response.json()
    echarts.registerMap('china', mapData)

    // 🔥 核心修改：调用上面的算法，拿到真实的分析数据！
    const realData = generateRealMapData()
    // 动态计算最大值，确保颜色渐变无论几百块还是几万块都能完美显示
    const maxValue = realData.length > 0 ? Math.max(...realData.map(item => item.value)) : 500

    const option = {
      title: { 
        text: '📍 全国各地区客流消费真实统计', 
        left: 'center', 
        textStyle: { color: '#303133', fontSize: 16, fontWeight: 'bold' } 
      },
      tooltip: { 
        trigger: 'item', 
        formatter: '{b}<br/>真实消费额：¥{c}' 
      },
      visualMap: {
        min: 0, 
        max: maxValue, // 🔥 动态最大值
        left: '10', bottom: '10',
        text: ['高消费', '低消费'],
        calculable: true,
        inRange: { color: ['#e6f2ff', '#409EFF', '#004a99'] }
      },
      series: [
        {
          name: '真实消费金额',
          type: 'map',
          map: 'china',
          roam: true, 
          zoom: 1.2,
          label: { show: true, fontSize: 10, color: '#666' },
          itemStyle: { borderColor: '#fff', borderWidth: 1 },
          emphasis: { itemStyle: { areaColor: '#ffb84d', shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } },
          data: realData // 🔥 彻底绑定真实数据
        }
      ]
    }
    
    myChart.hideLoading()
    myChart.setOption(option)
    window.addEventListener('resize', () => myChart.resize())

  } catch (error) {
    console.error('地图加载失败', error)
    myChart.hideLoading()
  }
}

// ----------------------------------------------------
// 下面是原有的逻辑：柱状图周次切换、删除订单、导出Excel等
// ----------------------------------------------------
const getWeekRange = (offset) => {
  const now = new Date()
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
  const start = new Date(now)
  start.setDate(now.getDate() - dayOfWeek + 1 + (offset * 7))
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

const formatDate = (date) => {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

const changeWeek = (offsetChange) => { weekOffset.value += offsetChange; updateTrendChart() }
const resetWeek = () => { weekOffset.value = 0; updateTrendChart() }

const updateTrendChart = () => {
  const { start, end } = getWeekRange(weekOffset.value)
  currentWeekRange.value = `${formatDate(start)} 至 ${formatDate(end)}`
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const dailyTotals = [0, 0, 0, 0, 0, 0, 0]

  allOrders.value.forEach(order => {
    if (order.createTime) {
      const orderDate = new Date(order.createTime.replace(' ', 'T'))
      if (orderDate >= start && orderDate <= end) {
        let dayIndex = orderDate.getDay()
        dayIndex = dayIndex === 0 ? 6 : dayIndex - 1 
        dailyTotals[dayIndex] += Number(order.price || 0)
      }
    }
  })
  const maxAmount = Math.max(...dailyTotals, 500)
  chartData.value = days.map((day, index) => {
    const total = dailyTotals[index]
    return { day, value: total, height: total > 0 ? (Math.min((total / maxAmount) * 100, 100) + '%') : '0%' }
  })
}

const handleDelete = (id) => {
  ElMessageBox.confirm('确定要删除这条订单记录吗？', '警告', {
    confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning',
  }).then(async () => {
    try {
      const res = await axios.delete(`http://localhost:8080/api/orders/${id}`)
      if (res.data.code === 200) { ElMessage.success('订单已删除'); loadAllOrders() }
    } catch (error) { ElMessage.error('服务器连接失败') }
  })
}

const exportToExcel = () => {
  if (filteredOrders.value.length === 0) { ElMessage.warning('当前没有可导出的订单数据'); return }
  let csvContent = "订单号,项目名称,下单用户,支付金额,游玩日期,订单状态,下单时间\n"
  filteredOrders.value.forEach(item => {
    const name = item.attractionName ? item.attractionName.replace(/,/g, '，') : ''
    const user = item.userName || ''
    const price = item.price || 0
    const status = item.status || '已支付'
    const id = item.id + '\t'
    const date = (item.date || '') + '\t'
    const createTime = (item.createTime || '') + '\t'
    csvContent += `${id},${name},${user},${price},${date},${status},${createTime}\n`
  })
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement("a")
  link.setAttribute("href", URL.createObjectURL(blob))
  link.setAttribute("download", `智慧旅游_订单明细_${new Date().toISOString().slice(0,10)}.csv`)
  document.body.appendChild(link); link.click(); document.body.removeChild(link)
  ElMessage.success('🎉 订单导出成功！')
}

const totalRevenue = computed(() => allOrders.value.reduce((sum, item) => sum + Number(item.price || 0), 0))
const totalOrders = computed(() => allOrders.value.length)
const filteredOrders = computed(() => {
  if (!searchKeyword.value) return allOrders.value
  const keyword = searchKeyword.value.toLowerCase()
  return allOrders.value.filter(item => 
    String(item.id).includes(keyword) || 
    (item.attractionName && item.attractionName.toLowerCase().includes(keyword))
  )
})

const handleLogout = () => { localStorage.clear(); router.push('/login') }
onMounted(() => { loadAllOrders() })
</script>

<template>
  <div class="admin-container">
    <div class="sidebar">
      <div class="logo">🚀 智慧旅游管理</div>
      <div class="menu">
        <div class="menu-item" :class="{ active: activeMenu === 'dashboard' }" @click="activeMenu = 'dashboard'">📊 数据看板</div>
        <div class="menu-item" :class="{ active: activeMenu === 'orders' }" @click="activeMenu = 'orders'">📄 订单管理</div>
      </div>
      <div class="logout-btn" @click="handleLogout">🚪 退出系统</div>
    </div>

    <div class="main-content">
      <div class="top-bar">
        <h2>{{ activeMenu === 'dashboard' ? '数据可视化大屏' : '订单与财务管理' }}</h2>
        <div class="admin-info">
          <span class="role-badge">超级管理员</span>
          <span class="admin-name">Admin</span>
        </div>
      </div>

      <div v-if="activeMenu === 'dashboard'" class="dashboard-panel">
        <div class="stat-cards">
          <div class="stat-card blue">
            <div class="stat-title">总销售额 (Revenue)</div>
            <div class="stat-num">¥{{ totalRevenue }}</div>
            <div class="stat-icon">💰</div>
          </div>
          <div class="stat-card green">
            <div class="stat-title">总订单数 (Orders)</div>
            <div class="stat-num">{{ totalOrders }}</div>
            <div class="stat-icon">📦</div>
          </div>
        </div>

        <div class="charts-row">
          <div class="chart-section left-chart">
            <div class="chart-header">
              <h3 class="panel-title" style="margin: 0;">📅 每日订单金额分布</h3>
              <div class="week-controls">
                <span class="week-date-range">{{ currentWeekRange }}</span>
                <el-button-group>
                  <el-button size="small" @click="changeWeek(-1)">◀ 上周</el-button>
                  <el-button size="small" @click="resetWeek">本周</el-button>
                  <el-button size="small" @click="changeWeek(1)">下周 ▶</el-button>
                </el-button-group>
              </div>
            </div>
            <div class="bar-chart">
              <div class="bar-item" v-for="(item, index) in chartData" :key="index">
                <div class="bar-value" v-if="item.value > 0">¥{{ item.value }}</div>
                <div class="bar" :style="{ height: item.height }"></div>
                <div class="bar-label">{{ item.day }}</div>
              </div>
            </div>
          </div>

          <div class="chart-section right-map">
            <div id="china-map" style="width: 100%; height: 350px;"></div>
          </div>
        </div>
        
        <div class="recent-table-section">
          <h3 class="panel-title">🚀 最新实时订单流水</h3>
          <el-table :data="allOrders.slice(0, 8)" border v-loading="loading" stripe>
            <el-table-column prop="attractionName" label="项目名称" />
            <el-table-column prop="userName" label="下单用户" width="120" />
            <el-table-column label="金额" width="120">
              <template #default="scope">¥{{ scope.row.price }}</template>
            </el-table-column>
            <el-table-column prop="date" label="预订日期" width="150" />
            <el-table-column label="状态" width="100">
              <template #default><el-tag type="success" size="small" effect="dark">已支付</el-tag></template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <div v-if="activeMenu === 'orders'" class="orders-panel">
        <el-card shadow="never">
          <div class="table-ops">
            <div class="action-buttons">
              <el-input v-model="searchKeyword" placeholder="🔍 搜索订单号、项目名或用户..." style="width: 350px; margin-right: 15px;" clearable />
              <el-button type="primary" @click="loadAllOrders">刷新列表</el-button>
              <el-button type="success" @click="exportToExcel">📥 导出 Excel</el-button>
            </div>
          </div>
          <el-table :data="filteredOrders" border stripe v-loading="loading">
            <el-table-column prop="id" label="订单号" width="100" />
            <el-table-column prop="attractionName" label="项目名称" />
            <el-table-column prop="userName" label="下单用户" width="120" />
            <el-table-column label="金额" width="120">
              <template #default="scope">¥{{ scope.row.price }}</template>
            </el-table-column>
            <el-table-column prop="date" label="游玩日期" width="150" />
            <el-table-column label="操作" width="120" align="center">
              <template #default="scope">
                <el-button size="small" type="danger" plain @click="handleDelete(scope.row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 你的原始基础样式保留 */
.admin-container { display: flex; height: 100vh; background-color: #f5f7fa; }
.sidebar { width: 240px; background: #304156; color: #fff; display: flex; flex-direction: column; }
.logo { height: 64px; line-height: 64px; text-align: center; font-size: 20px; font-weight: bold; background: #2b2f3a; color: #409EFF; }
.menu { flex: 1; padding-top: 20px; }
.menu-item { height: 56px; line-height: 56px; padding-left: 30px; cursor: pointer; transition: 0.3s; border-left: 4px solid transparent; }
.menu-item.active { background: #1f2d3d; color: #409EFF; border-left-color: #409EFF; }
.logout-btn { height: 50px; line-height: 50px; text-align: center; background: #d94545; cursor: pointer; font-weight: bold; }
.main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.top-bar { height: 64px; background: #fff; box-shadow: 0 1px 4px rgba(0,21,41,.08); display: flex; align-items: center; justify-content: space-between; padding: 0 30px; }
.admin-name { font-weight: bold; color: #303133; }
.role-badge { background: #e6f7ff; color: #1890ff; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 10px; }
.dashboard-panel, .orders-panel { padding: 24px; flex: 1; overflow-y: auto; }
.stat-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-bottom: 24px; }
.stat-card { background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); position: relative; }
.stat-card.blue { border-top: 6px solid #409EFF; }
.stat-card.green { border-top: 6px solid #67C23A; }
.stat-title { font-size: 16px; color: #606266; margin-bottom: 12px; font-weight: 500; }
.stat-num { font-size: 36px; font-weight: 800; color: #1a1a1a !important; margin-top: 5px; }
.stat-icon { position: absolute; right: 30px; top: 30px; font-size: 45px; opacity: 0.1; }

/* 🔥 新增并排布局 CSS */
.charts-row { display: flex; gap: 24px; margin-bottom: 24px; }
.chart-section { background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.left-chart { flex: 1.2; display: flex; flex-direction: column; }
.right-map { flex: 0.8; display: flex; align-items: center; justify-content: center; }

/* 你的原始柱状图样式保留 */
.chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #f0f0f0; padding-bottom: 15px; }
.week-controls { display: flex; align-items: center; gap: 15px; }
.week-date-range { font-size: 14px; color: #606266; font-weight: bold; background: #f5f7fa; padding: 6px 16px; border-radius: 20px; }
.bar-chart { height: 260px; display: flex; align-items: flex-end; justify-content: space-around; padding-bottom: 20px; flex: 1; }
.bar-item { display: flex; flex-direction: column; align-items: center; width: 60px; height: 100%; justify-content: flex-end; }
.bar { width: 32px; background: linear-gradient(to top, #409EFF, #66b1ff); border-radius: 4px 4px 0 0; transition: height 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
.bar-value { font-size: 13px; color: #409EFF; font-weight: bold; margin-bottom: 8px; }
.bar-label { margin-top: 10px; font-size: 14px; font-weight: bold; color: #303133; }

.recent-table-section { background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.panel-title { margin-bottom: 20px; font-size: 18px; font-weight: bold; color: #303133; }
.table-ops { margin-bottom: 20px; display: flex; gap: 10px; align-items: center; }
.action-buttons { display: flex; align-items: center; }
</style>