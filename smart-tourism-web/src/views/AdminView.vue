<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const activeMenu = ref('dashboard')
const allOrders = ref([])
const searchKeyword = ref('')
const loading = ref(false)
const axios = window.axios

// 🔥 新增：用于控制图表切换的变量
const weekOffset = ref(0) // 0代表本周，-1代表上周，1代表下周
const currentWeekRange = ref('') // 用于显示 "2026-02-16 至 2026-02-22"

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
      
      updateTrendChart() // 加载完数据后初始化图表
    }
  } catch (error) {
    ElMessage.error('无法连接到数据库')
  } finally {
    loading.value = false
  }
}

// ==========================================
// 📊 新增图表日期计算与周次切换逻辑
// ==========================================

// 获取指定周次的星期一和星期日
const getWeekRange = (offset) => {
  const now = new Date()
  // 把周日(0)转成7，方便后续基于周一计算
  const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
  
  // 计算选中周的周一
  const start = new Date(now)
  start.setDate(now.getDate() - dayOfWeek + 1 + (offset * 7))
  start.setHours(0, 0, 0, 0)

  // 计算选中周的周日
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

// 切换图表周次
const changeWeek = (offsetChange) => {
  weekOffset.value += offsetChange
  updateTrendChart()
}
const resetWeek = () => {
  weekOffset.value = 0
  updateTrendChart()
}

// 重新计算并渲染图表数据
const updateTrendChart = () => {
  const { start, end } = getWeekRange(weekOffset.value)
  currentWeekRange.value = `${formatDate(start)} 至 ${formatDate(end)}`

  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const dailyTotals = [0, 0, 0, 0, 0, 0, 0]

  allOrders.value.forEach(order => {
    if (order.createTime) {
      // 解析订单的真实下单时间
      const orderDate = new Date(order.createTime.replace(' ', 'T'))
      
      // 核心过滤：只统计在这个【选中周】时间范围内的订单
      if (orderDate >= start && orderDate <= end) {
        let dayIndex = orderDate.getDay()
        dayIndex = dayIndex === 0 ? 6 : dayIndex - 1 // 转为数组索引 (周一=0, 周日=6)
        dailyTotals[dayIndex] += Number(order.price || 0)
      }
    }
  })

  // 动态设定图表的 100% 高度上限 (最低500元，防止几块钱把柱子拉满)
  const maxAmount = Math.max(...dailyTotals, 500)

  chartData.value = days.map((day, index) => {
    const total = dailyTotals[index]
    return {
      day,
      value: total,
      height: total > 0 ? (Math.min((total / maxAmount) * 100, 100) + '%') : '0%'
    }
  })
}

const handleDelete = (id) => {
  ElMessageBox.confirm('确定要删除这条订单记录吗？', '警告', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    try {
      const res = await axios.delete(`http://localhost:8080/api/orders/${id}`)
      if (res.data.code === 200) {
        ElMessage.success('订单已删除')
        loadAllOrders() 
      }
    } catch (error) {
      ElMessage.error('服务器连接失败')
    }
  })
}
// ==========================================
// 📈 核心功能：一键导出订单到 Excel (CSV格式) - 解决时间 #### 问题
// ==========================================
const exportToExcel = () => {
  // 1. 判断有没有数据
  if (filteredOrders.value.length === 0) {
    ElMessage.warning('当前没有可导出的订单数据')
    return
  }

  // 2. 准备 Excel 的表头
  let csvContent = "订单号,项目名称,下单用户,支付金额,游玩日期,订单状态,下单时间\n"

  // 3. 遍历当前表格里的数据，拼接到 csv 字符串中
  filteredOrders.value.forEach(item => {
    // 处理可能包含逗号的字段（防止把表格格式搞乱）
    const name = item.attractionName ? item.attractionName.replace(/,/g, '，') : ''
    const user = item.userName || ''
    const price = item.price || 0
    const status = item.status || '已支付'
    
    // 🔥 核心修复：在 ID、日期和时间后面加上一个制表符 '\t'
    // 强制 Excel 将其识别为普通文本，彻底解决 #### 挤压变形问题
    const id = item.id + '\t'
    const date = (item.date || '') + '\t'
    const createTime = (item.createTime || '') + '\t'

    csvContent += `${id},${name},${user},${price},${date},${status},${createTime}\n`
  })

  // 4. 生成文件并自动触发浏览器下载 (加上 \uFEFF 防止 Excel 打开时中文乱码)
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)

  link.setAttribute("href", url)
  // 动态生成文件名，包含当前时间戳
  link.setAttribute("download", `智慧旅游_订单明细_${new Date().toISOString().slice(0,10)}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

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

const handleLogout = () => {
  localStorage.clear()
  router.push('/login')
}

onMounted(() => {
  loadAllOrders()
})
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

        <div class="chart-section">
          <div class="chart-header">
            <h3 class="panel-title" style="margin: 0;">📅 每日订单金额分布</h3>
            <div class="week-controls">
              <span class="week-date-range">{{ currentWeekRange }}</span>
              <el-button-group>
                <el-button size="small" @click="changeWeek(-1)">◀ 上一周</el-button>
                <el-button size="small" @click="resetWeek">本周</el-button>
                <el-button size="small" @click="changeWeek(1)">下一周 ▶</el-button>
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
            <el-input v-model="searchKeyword" placeholder="🔍 搜索订单号、项目名或用户..." style="width: 350px;" clearable />
            
            <div class="action-buttons">
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

/* 🔥 增强图表控制区样式 */
.chart-section { background: #fff; padding: 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #f0f0f0; padding-bottom: 15px; }
.week-controls { display: flex; align-items: center; gap: 15px; }
.week-date-range { font-size: 14px; color: #606266; font-weight: bold; background: #f5f7fa; padding: 6px 16px; border-radius: 20px; }

.bar-chart { height: 200px; display: flex; align-items: flex-end; justify-content: space-around; padding-bottom: 20px; }
.bar-item { display: flex; flex-direction: column; align-items: center; width: 60px; height: 100%; justify-content: flex-end; }
.bar { width: 32px; background: linear-gradient(to top, #409EFF, #66b1ff); border-radius: 4px 4px 0 0; transition: height 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
.bar-value { font-size: 13px; color: #409EFF; font-weight: bold; margin-bottom: 8px; }
.bar-label { margin-top: 10px; font-size: 14px; font-weight: bold; color: #303133; }

.recent-table-section { background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
.panel-title { margin-bottom: 20px; font-size: 18px; font-weight: bold; color: #303133; }
.table-ops { margin-bottom: 20px; display: flex; gap: 10px; }
</style>