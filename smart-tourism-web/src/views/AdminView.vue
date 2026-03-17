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
  { day: '周一', value: 0, height: '0%' }, { day: '周二', value: 0, height: '0%' },
  { day: '周三', value: 0, height: '0%' }, { day: '周四', value: 0, height: '0%' },
  { day: '周五', value: 0, height: '0%' }, { day: '周六', value: 0, height: '0%' },
  { day: '周日', value: 0, height: '0%' },
])

const loadAllOrders = async () => {
  loading.value = true
  try {
    const res = await axios.get('http://localhost:8080/api/orders/all')
    if (res.data.code === 200) {
      allOrders.value = res.data.data.map(item => ({
        id: item.id,
        // 🔥 新增：捕获我们之前加的业务字段
        orderNo: item.orderNo || `OLD_${item.id}`, // 业务订单号
        alipayTradeNo: item.alipayTradeNo || '暂无', // 支付宝流水号
        status: item.status, // 真实支付状态 PAID/UNPAID
        payTime: item.payTime || '未支付', // 支付时间

        attractionName: item.hotelName,
        price: item.amount,
        date: item.checkIn,
        userName: item.userName,
        createTime: item.createTime
      }))
      updateTrendChart()
      if (activeMenu.value === 'dashboard') initMapChart()
    }
  } catch (error) {
    ElMessage.error('无法连接到数据库获取订单')
  } finally {
    loading.value = false
  }
}

const generateRealMapData = () => {
  const provinceMap = {}
  allOrders.value.forEach(order => {
    const name = order.attractionName || ''
    let province = ''
    if (name.includes('北京') || name.includes('故宫') || name.includes('长城')) province = '北京市'
    else if (name.includes('上海') || name.includes('迪士尼') || name.includes('东方明珠')) province = '上海市'
    else if (name.includes('广东') || name.includes('广州') || name.includes('长隆')) province = '广东省'
    else if (name.includes('四川') || name.includes('成都')) province = '四川省'
    else if (name.includes('浙江') || name.includes('杭州') || name.includes('西湖')) province = '浙江省'
    else if (name.includes('江苏') || name.includes('南京')) province = '江苏省'
    else if (name.includes('陕西') || name.includes('西安')) province = '陕西省'
    else if (name.includes('海南') || name.includes('三亚')) province = '海南省'
    else if (name.includes('山东') || name.includes('青岛')) province = '山东省'
    else if (name.includes('湖南') || name.includes('长沙')) province = '湖南省'
    else if (name.includes('湖北') || name.includes('武汉')) province = '湖北省'

    if (province) {
      if (!provinceMap[province]) provinceMap[province] = 0
      provinceMap[province] += Number(order.price || 0)
    }
  })
  return Object.keys(provinceMap).map(key => ({ name: key, value: provinceMap[key] }))
}

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

    const realData = generateRealMapData()
    const maxValue = realData.length > 0 ? Math.max(...realData.map(item => item.value)) : 500

    const option = {
      title: { text: '📍 全国各地区客流消费真实统计', left: 'center', textStyle: { color: '#303133', fontSize: 16, fontWeight: 'bold' } },
      tooltip: { trigger: 'item', formatter: '{b}<br/>真实消费额：¥{c}' },
      visualMap: { min: 0, max: maxValue, left: '10', bottom: '10', text: ['高消费', '低消费'], calculable: true, inRange: { color: ['#e6f2ff', '#409EFF', '#004a99'] } },
      series: [{ name: '真实消费金额', type: 'map', map: 'china', roam: true, zoom: 1.2, label: { show: true, fontSize: 10, color: '#666' }, itemStyle: { borderColor: '#fff', borderWidth: 1 }, emphasis: { itemStyle: { areaColor: '#ffb84d', shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } }, data: realData }]
    }
    myChart.hideLoading()
    myChart.setOption(option)
    window.addEventListener('resize', () => myChart.resize())
  } catch (error) {
    console.error('地图加载失败', error)
    myChart.hideLoading()
  }
}


const scenicList = ref([])
const scenicLoading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const scenicFormRef = ref(null)

const scenicForm = ref({
  id: null, name: '', category: '', price: 0, rating: 5.0, imageUrl: '', description: '',
  address: '', isHotelData: false // 🔥 新增这两个
})

const scenicRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
  price: [{ required: true, message: '请输入价格', trigger: 'blur' }]
}

// 1. 🔥 智能双重加载：把两个表的数据库拉到一起展示
const loadScenicSpots = async () => {
  scenicLoading.value = true
  try {
    let combinedList = []

    // 第一步：拉取所有景区数据
    try {
      const spotRes = await axios.get('http://localhost:8080/api/scenic-spots')
      let spots = Array.isArray(spotRes.data) ? spotRes.data : (spotRes.data.data || [])
      // 给景区数据打个暗号，方便后面删除/修改时知道请求哪个接口
      spots = spots.map(item => ({ ...item, isHotelData: false }))
      combinedList = [...combinedList, ...spots]
    } catch (e) { console.error("景区接口报错", e) }

    // 第二步：拉取所有酒店数据 (假设你的后端路径是 /api/hotels，如果不对请改这里 👇)
    try {
      const hotelRes = await axios.get('http://localhost:8080/api/hotels')
      let rawHotels = Array.isArray(hotelRes.data) ? hotelRes.data : (hotelRes.data.data || [])

      // 强制给酒店数据加上 Category，触发前端的 🏨 标签，并标记来源
      let hotels = rawHotels.map(item => ({
        ...item,
        category: '酒店住宿',
        isHotelData: true
      }))
      combinedList = [...combinedList, ...hotels]
    } catch (e) { console.error("酒店接口没找到或报错了", e) }

    // 合并赋值给表格
    scenicList.value = combinedList

  } catch (error) {
    ElMessage.error('获取列表失败')
  } finally {
    scenicLoading.value = false
  }
}

const openAddScenicDialog = () => {
  isEdit.value = false
  scenicForm.value = { id: null, name: '', category: '', price: 0, rating: 5.0, imageUrl: '', description: '' }
  dialogVisible.value = true
}

// --- 菜单与其它老逻辑 ---
const handleMenuChange = (menuName) => {
  activeMenu.value = menuName
  if (menuName === 'dashboard') setTimeout(() => initMapChart(), 300)
  else if (menuName === 'scenic') loadScenicSpots()
  else if (menuName === 'comments') loadAllComments() // 🔥 新增这行：点菜单时去拉取数据
  else if (menuName === 'users') loadAllUsers() // 🔥 新增：点菜单时加载用户数据
}

const getWeekRange = (offset) => { const now = new Date(); const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); const start = new Date(now); start.setDate(now.getDate() - dayOfWeek + 1 + (offset * 7)); start.setHours(0, 0, 0, 0); const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999); return { start, end } }
const formatDate = (date) => { const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${date.getFullYear()}-${m}-${d}` }
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
        let dayIndex = orderDate.getDay(); dayIndex = dayIndex === 0 ? 6 : dayIndex - 1
        dailyTotals[dayIndex] += Number(order.price || 0)
      }
    }
  })
  const maxAmount = Math.max(...dailyTotals, 500)
  chartData.value = days.map((day, index) => { const total = dailyTotals[index]; return { day, value: total, height: total > 0 ? (Math.min((total / maxAmount) * 100, 100) + '%') : '0%' } })
}

const handleOrderDelete = (id) => {
  ElMessageBox.confirm('确定要删除这条订单记录吗？', '警告', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' })
    .then(async () => { try { const res = await axios.delete(`http://localhost:8080/api/orders/${id}`); if (res.data.code === 200) { ElMessage.success('订单已删除'); loadAllOrders() } } catch (error) { ElMessage.error('服务器连接失败') } })
}

const exportToExcel = () => {
  if (filteredOrders.value.length === 0) { ElMessage.warning('当前没有可导出的数据'); return }

  // 🔥 更新表头，加入流水号和支付状态
  let csvContent = "业务订单号,支付宝流水号,项目名称,下单用户,支付金额,订单状态,创建时间,支付时间\n"

  filteredOrders.value.forEach(item => {
    const statusText = item.status === 'PAID' ? '已支付' : '待支付'
    // 注意：长数字后面加 '\t' 是为了防止 Excel 把它变成科学记数法
    csvContent += `${item.orderNo}\t,${item.alipayTradeNo}\t,${item.attractionName ? item.attractionName.replace(/,/g, '，') : ''},${item.userName || ''},${item.price || 0},${statusText},${(item.createTime || '') + '\t'},${(item.payTime || '') + '\t'}\n`
  })

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement("a");
  link.setAttribute("href", URL.createObjectURL(blob));
  link.setAttribute("download", `智慧旅游_财务订单明细_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  ElMessage.success('🎉 财务报表导出成功！')
}

const totalRevenue = computed(() => allOrders.value.reduce((sum, item) => sum + Number(item.price || 0), 0))
const totalOrders = computed(() => allOrders.value.length)
const filteredOrders = computed(() => {
  if (!searchKeyword.value) return allOrders.value
  const keyword = searchKeyword.value.toLowerCase()
  return allOrders.value.filter(item => String(item.id).includes(keyword) || (item.attractionName && item.attractionName.toLowerCase().includes(keyword)))
})

const handleLogout = () => { localStorage.clear(); router.push('/login') }

const allComments = ref([])
const commentsLoading = ref(false)

const loadAllComments = async () => {
  commentsLoading.value = true
  try {
    const res = await axios.get('http://localhost:8080/api/comments/all')
    if (res.data.code === 200) {
      // 拿到数据后，按时间倒序排，让最新发的评价排在最上面！
      allComments.value = res.data.data.sort((a, b) => new Date(b.createTime) - new Date(a.createTime))
    }
  } catch (error) {
    ElMessage.error('获取评价列表失败')
  } finally {
    commentsLoading.value = false
  }
}

const handleCommentDelete = (id) => {
  ElMessageBox.confirm('确定要永久删除这条含有违规内容的评价吗？', '🚨 内容审核警告', {
    confirmButtonText: '强制删除',
    cancelButtonText: '取消',
    type: 'error'
  }).then(async () => {
    try {
      const res = await axios.delete(`http://localhost:8080/api/comments/${id}`)
      if (res.data.code === 200) {
        ElMessage.success('违规评价已成功清理！')
        loadAllComments() // 删完立刻刷新列表
      }
    } catch (error) {
      ElMessage.error('删除失败')
    }
  })
}

// ==========================================
// ⛰️ 景区专属操作逻辑 (原接口: /api/scenic-spots)
// ==========================================

const openEditScenicDialog = (row) => {
  isEdit.value = true
  scenicForm.value = { ...row }
  dialogVisible.value = true
}

const submitScenicForm = async () => {
  if (!scenicFormRef.value) return
  await scenicFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        const payload = { ...scenicForm.value }
        delete payload.isHotelData // 剔除无关字段
        if (isEdit.value) {
          await axios.put(`http://localhost:8080/api/scenic-spots/${payload.id}`, payload)
          ElMessage.success('🎉 景区修改成功！')
        } else {
          await axios.post('http://localhost:8080/api/scenic-spots', payload)
          ElMessage.success('🎉 新景区上架成功！')
        }
        dialogVisible.value = false
        loadScenicSpots()
      } catch (error) {
        ElMessage.error('景区保存失败，请检查后端报错')
      }
    }
  })
}

const handleScenicDelete = (row) => {
  ElMessageBox.confirm(`确定要永久下架景区【${row.name}】吗？`, '危险操作', { confirmButtonText: '狠心下架', cancelButtonText: '取消', type: 'error' }).then(async () => {
    try {
      await axios.delete(`http://localhost:8080/api/scenic-spots/${row.id}`)
      ElMessage.success('景区下架成功！')
      loadScenicSpots()
    } catch (error) {
      ElMessage.error('下架失败：可能存在关联订单或收藏无法删除')
    }
  })
}

// ==========================================
// 🏨 酒店专属操作逻辑 (原接口: /api/hotels)
// ==========================================
const hotelDialogVisible = ref(false)
const isHotelEdit = ref(false)
const hotelFormRef = ref(null)
const hotelForm = ref({
  id: null, name: '', category: '', address: '', price: 0, rating: 5.0, imageUrl: '', description: ''
})

const hotelRules = {
  name: [{ required: true, message: '请输入酒店名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择星级', trigger: 'change' }],
  price: [{ required: true, message: '请输入价格', trigger: 'blur' }]
}

const openAddHotelDialog = () => {
  isHotelEdit.value = false
  hotelForm.value = { id: null, name: '', category: '', address: '', price: 0, rating: 5.0, imageUrl: '', description: '' }
  hotelDialogVisible.value = true
}

const openEditHotelDialog = (row) => {
  isHotelEdit.value = true
  hotelForm.value = { ...row }
  hotelDialogVisible.value = true
}

const submitHotelForm = async () => {
  if (!hotelFormRef.value) return
  await hotelFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        const payload = { ...hotelForm.value }
        delete payload.isHotelData // 剔除无关字段
        if (isHotelEdit.value) {
          await axios.put(`http://localhost:8080/api/hotels/${payload.id}`, payload)
          ElMessage.success('🎉 酒店修改成功！')
        } else {
          await axios.post('http://localhost:8080/api/hotels', payload)
          ElMessage.success('🎉 新酒店上架成功！')
        }
        hotelDialogVisible.value = false
        loadScenicSpots()
      } catch (error) {
        ElMessage.error('酒店保存失败，请检查后端报错')
      }
    }
  })
}

const handleHotelDelete = (row) => {
  ElMessageBox.confirm(`确定要永久下架酒店【${row.name}】吗？`, '危险操作', { confirmButtonText: '狠心下架', cancelButtonText: '取消', type: 'error' }).then(async () => {
    try {
      await axios.delete(`http://localhost:8080/api/hotels/${row.id}`)
      ElMessage.success('酒店下架成功！')
      loadScenicSpots()
    } catch (error) {
      ElMessage.error('下架失败：可能存在关联订单或收藏无法删除')
    }
  })
}

// ==========================================
// 🔥 新增：用户管理专属操作逻辑
// ==========================================
const userList = ref([])
const usersLoading = ref(false)

const loadAllUsers = async () => {
  usersLoading.value = true
  try {
    // 确保你的 SpringBoot 后端有这个接口
    const res = await axios.get('http://localhost:8080/api/users')
    userList.value = Array.isArray(res.data) ? res.data : (res.data.data || [])
  } catch (error) {
    ElMessage.error('获取用户列表失败，请确保后台已连通')
  } finally {
    usersLoading.value = false
  }
}

const handleUserDelete = (id) => {
  ElMessageBox.confirm('确定要永久注销该用户吗？此操作不可逆！', '🚨 风险警告', {
    confirmButtonText: '狠心注销',
    cancelButtonText: '取消',
    type: 'error'
  }).then(async () => {
    try {
      await axios.delete(`http://localhost:8080/api/users/${id}`)
      ElMessage.success('用户注销成功！')
      loadAllUsers() // 删完立刻刷新列表
    } catch (error) {
      ElMessage.error('注销失败：可能存在关联的订单数据限制删除')
    }
  })
}

onMounted(() => {
  loadAllOrders()
  loadScenicSpots()
})
</script>

<template>
  <div class="admin-container">
    <div class="sidebar">
      <div class="logo">🚀 智慧旅游管理</div>
      <div class="menu">
        <div class="menu-item" :class="{ active: activeMenu === 'dashboard' }" @click="handleMenuChange('dashboard')">
          <span style="margin-right: 8px;">📊</span> 数据看板
        </div>
        <div class="menu-item" :class="{ active: activeMenu === 'users' }" @click="handleMenuChange('users')">
          <span style="margin-right: 8px;">👥</span> 用户管理中心
        </div>
        <div class="menu-item" :class="{ active: activeMenu === 'orders' }" @click="handleMenuChange('orders')">
          <span style="margin-right: 8px;">📄</span> 订单管理
        </div>
        <div class="menu-item" :class="{ active: activeMenu === 'scenic' }" @click="handleMenuChange('scenic')">
          <span style="margin-right: 8px;">🏕️</span> 景点与酒店管理
        </div>
        <div class="menu-item" :class="{ active: activeMenu === 'comments' }" @click="handleMenuChange('comments')">
          <span style="margin-right: 8px;">💬</span> 评价审核中心
        </div>
      </div>
      <div class="logout-wrapper">
        <div class="logout-btn" @click="handleLogout">
          <span style="margin-right: 5px;">🚪</span> 安全退出系统
        </div>
      </div>
    </div>

    <div class="main-content">
      <div class="top-bar">
        <h2>
          {{
            activeMenu === 'dashboard' ? '数据可视化大屏' :
              (activeMenu === 'users' ? '平台用户综合管理' :
                (activeMenu === 'orders' ? '订单与财务管理' :
                  (activeMenu === 'comments' ? '评价审核中心' : '平台商品上架管理')))
          }}
        </h2>
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
                  <el-button size="small" round @click="changeWeek(-1)">◀ 上周</el-button>
                  <el-button size="small" @click="resetWeek">本周</el-button>
                  <el-button size="small" round @click="changeWeek(1)">下周 ▶</el-button>
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
            <el-table-column label="金额" width="120"><template #default="scope">¥{{ scope.row.price
            }}</template></el-table-column>
            <el-table-column prop="date" label="预订日期" width="150" />
            <el-table-column label="状态" width="100"><template #default><el-tag type="success" size="small"
                  effect="dark">已支付</el-tag></template></el-table-column>
          </el-table>
        </div>
      </div>

      <div v-if="activeMenu === 'users'" class="orders-panel">
        <el-card shadow="never" class="premium-card">
          <div class="table-ops" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; color: #303133;">👥 平台全部注册用户</h3>
            <el-button type="primary" round class="action-btn" @click="loadAllUsers">🔄 刷新数据</el-button>
          </div>

          <el-table :data="userList" border stripe v-loading="usersLoading">
            <el-table-column prop="id" label="用户ID" width="80" align="center" />
            
            <el-table-column label="用户名" min-width="150">
              <template #default="scope">
                <span style="font-weight: bold; color: #303133;">{{ scope.row.username }}</span>
              </template>
            </el-table-column>

            <el-table-column label="身份/角色" width="150" align="center">
              <template #default="scope">
                <el-tag :type="(scope.row.role === 'ADMIN' || scope.row.role === 'admin') ? 'danger' : 'success'" effect="dark">
                  {{ (scope.row.role === 'ADMIN' || scope.row.role === 'admin') ? '超级管理员' : '普通用户' }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column label="联系方式" min-width="150">
              <template #default="scope">
                {{ scope.row.phone || scope.row.email || '未绑定' }}
              </template>
            </el-table-column>

            <el-table-column label="操作" width="120" align="center" fixed="right">
              <template #default="scope">
                <el-button 
                  v-if="scope.row.username !== 'admin'" 
                  size="small" round type="danger" plain class="table-btn" 
                  @click="handleUserDelete(scope.row.id)">
                  🗑️ 注销
                </el-button>
                <el-tag v-else type="info" size="small">无法注销</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>

      <div v-if="activeMenu === 'orders'" class="orders-panel">
        <el-card shadow="never" class="premium-card">
          <div class="table-ops" style="margin-bottom: 20px;">
            <div class="action-buttons">
              <el-input v-model="searchKeyword" placeholder="🔍 搜索订单号或项目名..." style="width: 350px; margin-right: 15px;"
                clearable class="search-input-round" />
              <el-button type="primary" round class="action-btn" @click="loadAllOrders">刷新列表</el-button>
              <el-button type="success" round class="action-btn" @click="exportToExcel">📥 导出 Excel</el-button>
            </div>
          </div>

          <el-table :data="filteredOrders" border stripe v-loading="loading">
            <el-table-column prop="orderNo" label="业务订单号" width="180" />
            <el-table-column prop="attractionName" label="项目名称" min-width="150" />
            <el-table-column prop="userName" label="下单用户" width="100" />

            <el-table-column label="支付金额" width="100">
              <template #default="scope">
                <span style="color: #f56c6c; font-weight: bold;">¥{{ scope.row.price }}</span>
              </template>
            </el-table-column>

            <el-table-column label="订单状态" width="100" align="center">
              <template #default="scope">
                <el-tag :type="scope.row.status === 'PAID' ? 'success' : 'danger'" effect="dark">
                  {{ scope.row.status === 'PAID' ? '已支付' : '待支付' }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column prop="alipayTradeNo" label="支付宝流水号" width="180" show-overflow-tooltip />
            <el-table-column prop="payTime" label="支付时间" width="160" />

            <el-table-column label="操作" width="100" align="center" fixed="right">
              <template #default="scope">
                <el-button size="small" round type="danger" plain class="table-btn"
                  @click="handleOrderDelete(scope.row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>

      <div v-if="activeMenu === 'scenic'" class="orders-panel">
        <el-card shadow="never" class="premium-card">
          <div class="table-ops" style="display: flex; justify-content: flex-end; margin-bottom: 20px; gap: 12px;">
            <el-button type="primary" size="large" round class="action-btn gradient-primary"
              @click="openAddScenicDialog">
              ⛰️ 上架新景区
            </el-button>
            <el-button type="warning" size="large" round class="action-btn gradient-warning"
              @click="openAddHotelDialog">
              🏨 上架新酒店
            </el-button>
            <el-button size="large" round class="action-btn" @click="loadScenicSpots">🔄 刷新数据</el-button>
          </div>

          <el-table :data="scenicList" border stripe v-loading="scenicLoading">
            <el-table-column prop="id" label="ID" width="80" align="center" />
            <el-table-column label="主图" width="120" align="center">
              <template #default="scope">
                <el-image :src="scope.row.imageUrl || `https://picsum.photos/100/100?random=${scope.row.id}`"
                  style="width: 60px; height: 60px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
                  fit="cover" />
              </template>
            </el-table-column>

            <el-table-column label="名称" min-width="220">
              <template #default="scope">
                <el-tag size="small" effect="dark" :type="scope.row.isHotelData ? 'warning' : 'primary'"
                  style="margin-right: 8px; border-radius: 4px;">
                  {{ scope.row.isHotelData ? '🏨 酒店' : '⛰️ 景区' }}
                </el-tag>
                <span style="font-weight: bold; color: #303133; font-size: 15px;">{{ scope.row.name }}</span>
              </template>
            </el-table-column>

            <el-table-column prop="category" label="具体分类/星级" width="120" align="center">
              <template #default="scope">
                <el-tag :type="scope.row.isHotelData ? 'warning' : 'success'" effect="plain">
                  {{ scope.row.category || (scope.row.isHotelData ? '酒店住宿' : '未分类') }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column prop="price" label="当前价格" width="120" align="center">
              <template #default="scope">
                <span style="color: #f56c6c; font-weight: bold; font-size: 16px;">¥{{ scope.row.price }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="rating" label="系统评分" width="100" align="center">
              <template #default="scope">
                <span style="color: #e6a23c; font-weight: bold;">★ {{ scope.row.rating }}</span>
              </template>
            </el-table-column>

            <el-table-column label="操作" width="220" align="center" fixed="right">
              <template #default="scope">
                <template v-if="scope.row.isHotelData">
                  <el-button size="small" round type="warning" plain class="table-btn"
                    @click="openEditHotelDialog(scope.row)">✏️ 编辑</el-button>
                  <el-button size="small" round type="danger" plain class="table-btn"
                    @click="handleHotelDelete(scope.row)">🗑️ 下架</el-button>
                </template>
                <template v-else>
                  <el-button size="small" round type="primary" plain class="table-btn"
                    @click="openEditScenicDialog(scope.row)">✏️ 编辑</el-button>
                  <el-button size="small" round type="danger" plain class="table-btn"
                    @click="handleScenicDelete(scope.row)">🗑️ 下架</el-button>
                </template>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-dialog v-model="dialogVisible" :title="isEdit ? '✏️ 编辑景区信息' : '🚀 上架新景区'" width="650px" destroy-on-close
          class="custom-dialog">
          <el-form :model="scenicForm" :rules="scenicRules" ref="scenicFormRef" label-width="110px"
            style="padding-right: 20px;">
            <el-form-item label="景区名称" prop="name">
              <el-input v-model="scenicForm.name" placeholder="请输入名称" />
            </el-form-item>

            <el-form-item label="具体分类" prop="category">
              <el-select v-model="scenicForm.category" placeholder="请选择景区类型" style="width: 100%;">
                <el-option label="自然风光" value="自然风光" />
                <el-option label="历史古迹" value="历史古迹" />
                <el-option label="主题乐园" value="主题乐园" />
                <el-option label="城市观光" value="城市观光" />
              </el-select>
            </el-form-item>

            <el-form-item label="售卖价格" prop="price">
              <el-input-number v-model="scenicForm.price" :min="0" :precision="2" :step="10" style="width: 100%;" />
            </el-form-item>

            <el-form-item label="系统评分" prop="rating">
              <el-rate v-model="scenicForm.rating" allow-half show-score />
            </el-form-item>

            <el-form-item label="封面图片链接" prop="imageUrl">
              <el-input v-model="scenicForm.imageUrl" placeholder="请输入图片网络链接 (http://...)" />
            </el-form-item>

            <el-form-item label="详细介绍" prop="description">
              <el-input type="textarea" v-model="scenicForm.description" :rows="4" placeholder="向游客介绍一下这里吧..." />
            </el-form-item>
          </el-form>

          <template #footer>
            <span class="dialog-footer">
              <el-button round @click="dialogVisible = false">取消</el-button>
              <el-button type="primary" round class="action-btn" @click="submitScenicForm">{{ isEdit ? '保存修改' : '确认上架'
              }}</el-button>
            </span>
          </template>
        </el-dialog>

        <el-dialog v-model="hotelDialogVisible" :title="isHotelEdit ? '✏️ 编辑酒店信息' : '🚀 上架新酒店'" width="650px"
          destroy-on-close class="custom-dialog">
          <el-form :model="hotelForm" :rules="hotelRules" ref="hotelFormRef" label-width="110px"
            style="padding-right: 20px;">
            <el-form-item label="酒店名称" prop="name">
              <el-input v-model="hotelForm.name" placeholder="请输入酒店名称" />
            </el-form-item>

            <el-form-item label="酒店星级" prop="category">
              <el-select v-model="hotelForm.category" placeholder="请选择酒店星级" style="width: 100%;">
                <el-option label="五星级/豪华" value="五星级/豪华" />
                <el-option label="四星级/高档" value="四星级/高档" />
                <el-option label="经济/快捷" value="经济/快捷" />
              </el-select>
            </el-form-item>

            <el-form-item label="详细地址" prop="address">
              <el-input v-model="hotelForm.address" placeholder="请输入酒店具体地址" />
            </el-form-item>

            <el-form-item label="客房价格" prop="price">
              <el-input-number v-model="hotelForm.price" :min="0" :precision="2" :step="10" style="width: 100%;" />
            </el-form-item>

            <el-form-item label="系统评分" prop="rating">
              <el-rate v-model="hotelForm.rating" allow-half show-score />
            </el-form-item>

            <el-form-item label="封面图片链接" prop="imageUrl">
              <el-input v-model="hotelForm.imageUrl" placeholder="请输入图片网络链接 (http://...)" />
            </el-form-item>

            <el-form-item label="详细介绍" prop="description">
              <el-input type="textarea" v-model="hotelForm.description" :rows="4" placeholder="向游客介绍一下这家酒店吧..." />
            </el-form-item>
          </el-form>

          <template #footer>
            <span class="dialog-footer">
              <el-button round @click="hotelDialogVisible = false">取消</el-button>
              <el-button type="warning" round class="action-btn" @click="submitHotelForm">{{ isHotelEdit ? '保存修改' :
                '确认上架' }}</el-button>
            </span>
          </template>
        </el-dialog>
      </div>

      <div v-if="activeMenu === 'comments'" class="orders-panel">
        <el-card shadow="never" class="premium-card">
          <div class="table-ops"
            style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; color: #303133;">💬 全站用户动态与审核</h3>
            <el-button type="primary" round class="action-btn" @click="loadAllComments">🔄 刷新动态</el-button>
          </div>

          <el-table :data="allComments" border stripe v-loading="commentsLoading">
            <el-table-column prop="id" label="评价ID" width="80" align="center" />

            <el-table-column label="评价对象" min-width="180">
              <template #default="scope">
                <el-tag :type="scope.row.targetType === 'HOTEL' ? 'warning' : 'success'" effect="dark" size="small"
                  style="margin-right: 8px;">
                  {{ scope.row.targetType === 'HOTEL' ? '🏨' : '⛰️' }}
                </el-tag>
                <span style="font-weight: bold; color: #303133;">
                  {{ scope.row.targetName || '未知目标' }}
                </span>
              </template>
            </el-table-column>

            <el-table-column prop="userName" label="评价用户" width="120" />

            <el-table-column label="用户打分" width="150">
              <template #default="scope">
                <el-rate v-model="scope.row.rating" disabled show-score text-color="#ff9900" />
              </template>
            </el-table-column>

            <el-table-column prop="content" label="评价内容" min-width="250" show-overflow-tooltip>
              <template #default="scope">
                <span style="color: #606266;">{{ scope.row.content }}</span>
              </template>
            </el-table-column>

            <el-table-column prop="createTime" label="发布时间" width="170" />

            <el-table-column label="操作(风控)" width="120" align="center" fixed="right">
              <template #default="scope">
                <el-button size="small" round type="danger" plain class="table-btn"
                  @click="handleCommentDelete(scope.row.id)">🗑️ 删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* =====================================
   🔥 核心视觉提升区 (美化专属样式)
   ===================================== */

/* 顶部与表格主要操作按钮 */
.action-btn {
  font-weight: bold;
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3) !important;
}

/* 渐变色大按钮 */
.gradient-primary {
  background: linear-gradient(135deg, #409eff, #36d1dc);
  border: none;
}

.gradient-warning {
  background: linear-gradient(135deg, #f59a23, #f5bc63);
  border: none;
}

/* 表格内部小操作按钮 */
.table-btn {
  font-weight: 600;
  transition: all 0.3s ease;
}

.table-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 搜索框圆角化 */
:deep(.search-input-round .el-input__wrapper) {
  border-radius: 20px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

/* 弹窗圆角化美化 */
:deep(.custom-dialog) {
  border-radius: 12px !important;
  overflow: hidden;
}

/* 侧边栏高级退出按钮 */
.logout-wrapper {
  padding: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.logout-btn {
  height: 44px;
  line-height: 44px;
  text-align: center;
  background: linear-gradient(135deg, #ff4d4f, #ff7875);
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s;
  box-shadow: 0 4px 10px rgba(255, 77, 79, 0.2);
}

.logout-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 15px rgba(255, 77, 79, 0.4);
  background: linear-gradient(135deg, #ff7875, #ff4d4f);
}

/* 背景卡片美化 */
.premium-card {
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04) !important;
  border: none;
}

/* =====================================
   ⬇️ 以下为原版布局结构样式 ⬇️
   ===================================== */
.admin-container {
  display: flex;
  height: 100vh;
  background-color: #f0f2f5;
}

.sidebar {
  width: 250px;
  background: #2b333e;
  color: #fff;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.logo {
  height: 70px;
  line-height: 70px;
  text-align: center;
  font-size: 22px;
  font-weight: 800;
  background: #1f262e;
  color: #409EFF;
  letter-spacing: 1px;
}

.menu {
  flex: 1;
  padding-top: 15px;
}

.menu-item {
  height: 50px;
  line-height: 50px;
  padding-left: 30px;
  margin: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  color: #a3b1c6;
  font-weight: 500;
}

.menu-item:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}

.menu-item.active {
  background: #409EFF;
  color: #fff;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3);
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-bar {
  height: 70px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, .08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30px;
  z-index: 5;
}

.top-bar h2 {
  margin: 0;
  font-size: 20px;
  color: #303133;
}

.admin-name {
  font-weight: bold;
  color: #303133;
}

.role-badge {
  background: #e6f7ff;
  color: #1890ff;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
  margin-right: 12px;
  border: 1px solid #91d5ff;
}

.dashboard-panel,
.orders-panel {
  padding: 24px;
  flex: 1;
  overflow-y: auto;
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  margin-bottom: 24px;
}

.stat-card {
  background: #fff;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  position: relative;
  transition: transform 0.3s;
}

.stat-card:hover {
  transform: translateY(-5px);
}

.stat-card.blue {
  border-top: 6px solid #409EFF;
}

.stat-card.green {
  border-top: 6px solid #67C23A;
}

.stat-title {
  font-size: 16px;
  color: #909399;
  margin-bottom: 12px;
  font-weight: 500;
}

.stat-num {
  font-size: 40px;
  font-weight: 800;
  color: #303133 !important;
  margin-top: 5px;
}

.stat-icon {
  position: absolute;
  right: 30px;
  top: 30px;
  font-size: 50px;
  opacity: 0.1;
}

.charts-row {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
}

.chart-section {
  background: #fff;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.left-chart {
  flex: 1.2;
  display: flex;
  flex-direction: column;
}

.right-map {
  flex: 0.8;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 15px;
}

.week-controls {
  display: flex;
  align-items: center;
  gap: 15px;
}

.week-date-range {
  font-size: 14px;
  color: #606266;
  font-weight: bold;
  background: #f5f7fa;
  padding: 6px 16px;
  border-radius: 20px;
}

.bar-chart {
  height: 260px;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  padding-bottom: 20px;
  flex: 1;
}

.bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 60px;
  height: 100%;
  justify-content: flex-end;
}

.bar {
  width: 32px;
  background: linear-gradient(to top, #409EFF, #66b1ff);
  border-radius: 4px 4px 0 0;
  transition: height 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.bar-value {
  font-size: 13px;
  color: #409EFF;
  font-weight: bold;
  margin-bottom: 8px;
}

.bar-label {
  margin-top: 10px;
  font-size: 14px;
  font-weight: bold;
  color: #303133;
}

.recent-table-section {
  background: #fff;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.panel-title {
  margin-bottom: 20px;
  font-size: 18px;
  font-weight: bold;
  color: #303133;
}

.table-ops {
  display: flex;
  align-items: center;
}

.action-buttons {
  display: flex;
  align-items: center;
}
</style>